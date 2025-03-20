const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const razorpay = require("../razorpay");
const AppointmentRoute = express.Router();
const DoctorScheduleSchema = require("../model/DoctorScheduleSchema");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");
const DoctorsAssignmentPrioritySchema = require("../model/DoctorsAssignmentPrioritySchema"); // ✅ Import this!
const axios = require("axios");



AppointmentRoute.get("/appointments", (req, res) => {
    AppointmentRecordsSchema.find((err, data) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch Appointment Records" });
        }
        res.json(data);
    });
});

// Route to get an appointment by appointment_id
AppointmentRoute.get("/appointment/:appointment_id", async (req, res) => {
    try {
        const { appointment_id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(appointment_id)) {
            return res.status(400).json({ message: "Invalid Appointment ID." });
        }

        const appointment = await AppointmentRecordsSchema.findById(appointment_id);

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        return res.status(200).json({ appointment });
    } catch (error) {
        console.error("Error fetching appointment by ID:", error);
        return res.status(500).json({ message: "An error occurred while fetching the appointment." });
    }
});

// Route to get all appointments for a patient with optional date filtering
AppointmentRoute.get("/appointments/:patient_id", async (req, res) => {
    try {
        const { patient_id } = req.params;
        const { date } = req.query; // Optional date filter

        if (!mongoose.Types.ObjectId.isValid(patient_id)) {
            return res.status(400).json({ message: "Invalid Patient ID." });
        }

        let query = { patient_id };
        
        if (date) {
            const selectedDate = new Date(date);
            if (isNaN(selectedDate)) {
                return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
            }
            query.DateOfAppointment = selectedDate;
        }

        const appointments = await AppointmentRecordsSchema.find(query);

        if (appointments.length === 0) {
            return res.status(404).json({ message: "No appointments found." });
        }

        return res.status(200).json({ appointments });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        return res.status(500).json({ message: "An error occurred while fetching appointments." });
    }
});

AppointmentRoute.get("/doctorSchedule", (req, res) => {
    DoctorScheduleSchema.find((err, data) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch Doctors schedule" });
        }
        res.json(data);
    });
});

AppointmentRoute.get('/availableDates', async (req, res) => {
    try {
        // Fetch all unique dates and weekdays where a doctor is scheduled (regardless of SlotsAvailable)
        const availableDates = await DoctorScheduleSchema.aggregate([
            {
                $match: {
                    Date: { $exists: true }, // Ensure the Date field exists
                },
            },
            {
                $project: {
                    Date: 1,
                    WeekDay: 1,
                },
            },
            {
                $group: {
                    _id: "$Date", // Group by unique dates
                    WeekDay: { $first: "$WeekDay" }, // Keep the corresponding WeekDay
                },
            },
            {
                $sort: { "_id": 1 }, // Sort dates in ascending order
            },
        ]);

        // Prepare the response with dynamic keys
        let response = {
            message: 'Available dates and weekdays retrieved successfully.',
        };

        availableDates.forEach((entry, index) => {
            const formattedDate = new Date(entry._id).toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
            response[`Date${index + 1}`] = formattedDate;
            response[`WeekDay${index + 1}`] = entry.WeekDay;
        });

        return res.status(200).json(response);

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            message: 'An error occurred while fetching the available dates.',
        });
    }
});

AppointmentRoute.post("/bookAppointment", async (req, res) => {
    try {
        const { selectedDate, patient_id} = req.body; 

        if (!selectedDate || !patient_id) {
            return res.status(400).json({ message: "All fields are required." });
        }

        if (!mongoose.Types.ObjectId.isValid(patient_id)) {
            return res.status(400).json({ message: "Invalid Patient ID." });
        }

        const appointmentDate = new Date(selectedDate);
        if (isNaN(appointmentDate)) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }

        // ✅ Check if the patient already has an appointment on this date
        const existingAppointment = await AppointmentRecordsSchema.findOne({
            patient_id,
            DateOfAppointment: appointmentDate,
        });

        if (existingAppointment) {
            return res.status(409).json({
                message: "You already have an appointment booked for this date.",
                appointmentDetails: existingAppointment,
            });
        }

        // ✅ Find an available doctor (Round-robin selection)
        let lastAssignment = await DoctorsAssignmentPrioritySchema.findOne({ Date: appointmentDate });

        const availableDoctors = await DoctorScheduleSchema.find({ 
            Date: appointmentDate, 
            SlotsAvailable: { $gt: 0 } 
        }).sort({ doctor_id: 1 });

        if (availableDoctors.length === 0) {
            return res.status(404).json({
                message: "No doctors available on the selected date. Please choose another date.",
                selectedDate: appointmentDate,
            });
        }

        let selectedDoctor;
        if (!lastAssignment) {
            selectedDoctor = availableDoctors[0];
            await DoctorsAssignmentPrioritySchema.create({
                Date: appointmentDate,
                LastDoctorAssigned: selectedDoctor.doctor_id
            });
        } else {
            const lastAssignedDoctorIndex = availableDoctors.findIndex(doc => doc.doctor_id.toString() === lastAssignment.LastDoctorAssigned.toString());
            selectedDoctor = (lastAssignedDoctorIndex === -1 || lastAssignedDoctorIndex === availableDoctors.length - 1)
                ? availableDoctors[0]
                : availableDoctors[lastAssignedDoctorIndex + 1];

            await DoctorsAssignmentPrioritySchema.updateOne(
                { Date: appointmentDate },
                { $set: { LastDoctorAssigned: selectedDoctor.doctor_id } }
            );
        }

        // ✅ Step 1: Create a Razorpay Order
        const order = await razorpay.orders.create({
            amount: 100, //(in paise)
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1, // Auto-capture payment
        });

        // ✅ Step 2: Create a "Pending" Appointment Record
        const newAppointment = new AppointmentRecordsSchema({
            patient_id,
            doctor_id: selectedDoctor.doctor_id,
            DateOfAppointment: appointmentDate,
            WeekDay: selectedDoctor.WeekDay,
            payment_status: "pending",
            payment_id: null,
            razorpay_order_id: order.id, // ✅ Store Razorpay Order ID
            razorpay_payment_link_id: null,
        });

        await newAppointment.save();

        // ✅ Step 3: Generate a Razorpay Payment Link
        const paymentLinkResponse = await razorpay.paymentLink.create({
            amount: 100, // Convert ₹100 to paise
            currency: "INR",
            accept_partial: false,
            description: "Appointment Booking Fee",
            notify: {
                sms: true,
                email: false,
            },
            reference_id: order.id, // ✅ Link payment link to order
        });

        // ✅ Step 4: Update Appointment Record with Payment Link ID
        newAppointment.razorpay_payment_link_id = paymentLinkResponse.id;
        await newAppointment.save();

        // ✅ Step 5: Reduce Available Slots for the Selected Doctor
        await DoctorScheduleSchema.updateOne(
            { _id: selectedDoctor._id },
            { $inc: { SlotsAvailable: -1 } }
        );

        // ✅ Step 6: Return Payment Link to Chatbot
        return res.status(200).json({
            message: "Appointment booked pending payment.",
            doctorId: selectedDoctor.doctor_id,
            remainingSlots: selectedDoctor.SlotsAvailable - 1,
            appointmentDetails: newAppointment,
            paymentLink: paymentLinkResponse.short_url, // ✅ Send Payment Link to Chatbot
        });

    } catch (error) {
        console.error("Error booking appointment:", error);
        return res.status(500).json({
            message: "An error occurred while booking the appointment. Please try again later.",
            error: error.message,
        });
    }
});

AppointmentRoute.post("/verify-payment", async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return res.status(400).json({ message: "Missing payment details." });
        }

        // ✅ Step 1: Verify the payment signature
        const generated_signature = crypto
            .createHmac("sha256", "YOUR_RAZORPAY_SECRET")
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ message: "Invalid payment signature." });
        }

        // ✅ Step 2: Find the appointment record using order_id
        const appointment = await AppointmentRecordsSchema.findOne({ razorpay_order_id });

        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        // ✅ Step 3: Update appointment with payment details
        appointment.payment_status = "paid";
        appointment.payment_id = razorpay_payment_id;
        await appointment.save();

        return res.status(200).json({
            message: "Payment verified successfully. Appointment confirmed!",
            appointmentDetails: appointment,
        });

    } catch (error) {
        console.error("Payment verification error:", error);
        return res.status(500).json({ message: "Payment verification failed.", error: error.message });
    }
});

AppointmentRoute.post("/razorpay-webhook", express.json(), async (req, res) => {
    try {
        const webhookSecret = "Agarwal@2019"; // Replace with your actual Razorpay webhook secret
        const receivedSignature = req.headers["x-razorpay-signature"];
        const body = JSON.stringify(req.body);

        // Verify the webhook signature
        const expectedSignature = crypto.createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");

        if (expectedSignature !== receivedSignature) {
            console.error("❌ Invalid signature! Possible security breach.");
            return res.status(400).json({ message: "Invalid signature" });
        }

        console.log("✅ Webhook signature verified");

        const event = req.body;

        if (event.event === "payment.captured") {
            const paymentId = event.payload.payment.entity.id;
            const orderId = event.payload.payment.entity.order_id;

            console.log("🔹 Payment Captured for Order ID:", orderId);

            // Find and update the appointment record
            const appointment = await AppointmentRecordsSchema.findOneAndUpdate(
                { razorpay_order_id: orderId },
                { $set: { payment_status: "confirmed", payment_id: paymentId } },
                { new: true }
            );

            if (!appointment) {
                console.error("❌ No matching appointment found for Order ID:", orderId);
                return res.status(404).json({ message: "Appointment not found" });
            }

            console.log("✅ Appointment Updated:", appointment);

            return res.status(200).json({ message: "Payment verified and appointment confirmed." });
        }

        res.status(200).json({ message: "Webhook received but no action taken." });
    } catch (error) {
        console.error("❌ Webhook processing failed:", error);
        res.status(500).json({ message: "Webhook processing failed.", error: error.message });
    }
});

module.exports = AppointmentRoute;

