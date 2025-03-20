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
        const { selectedDate, patient_id } = req.body;

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

        // ✅ Step 1: Create an Appointment Record First
        const newAppointment = new AppointmentRecordsSchema({
            patient_id,
            doctor_id: selectedDoctor.doctor_id,
            DateOfAppointment: appointmentDate,
            WeekDay: selectedDoctor.WeekDay,
            payment_status: "pending",
            payment_id: null,
            payment_link_id: null, // Will update after payment link creation
        });

        const savedAppointment = await newAppointment.save();

        // ✅ Step 2: Generate a Razorpay Payment Link
        const paymentLinkResponse = await razorpay.paymentLink.create({
            amount: 100, // ₹100 converted to paise
            currency: "INR",
            accept_partial: false,
            description: "Appointment Booking Fee",
            notify: {
                sms: true,
                email: false,
            },
            reference_id: `appointment_${savedAppointment._id}`, // ✅ Use Appointment ID as Reference
            notes: {
                appointment_id: savedAppointment._id.toString(), // ✅ Store the Appointment Record ID
                patient_id: patient_id, 
            }
        });

        // ✅ Step 3: Update Appointment Record with Payment Link ID
        await AppointmentRecordsSchema.updateOne(
            { _id: savedAppointment._id },
            { $set: { payment_link_id: paymentLinkResponse.id } }
        );

        // ✅ Step 4: Reduce Available Slots for the Selected Doctor
        await DoctorScheduleSchema.updateOne(
            { _id: selectedDoctor._id },
            { $inc: { SlotsAvailable: -1 } }
        );

        // ✅ Step 5: Return Payment Link to Chatbot
        return res.status(200).json({
            message: "Appointment booked pending payment.",
            doctorId: selectedDoctor.doctor_id,
            remainingSlots: selectedDoctor.SlotsAvailable - 1,
            appointmentDetails: savedAppointment,
            paymentLink: paymentLinkResponse.short_url, // ✅ Correct Payment Link
        });

    } catch (error) {
        console.error("Error booking appointment:", error);
        return res.status(500).json({
            message: "An error occurred while booking the appointment. Please try again later.",
            error: error.message,
        });
    }
});

AppointmentRoute.post("/razorpay-webhook", express.json(), async (req, res) => {
    try {
        const webhookSecret = "Agarwal@2020"; // Replace with your actual Razorpay webhook secret
        const receivedSignature = req.headers["x-razorpay-signature"];
        const body = JSON.stringify(req.body);

        // Verify the webhook signature
        const expectedSignature = crypto.createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");

        console.log("Recieved Sign",receivedSignature);    
        console.log("Expected Signature",expectedSignature);    

        if (expectedSignature !== receivedSignature) {
            console.error("❌ Invalid signature! Possible security breach.");
            return res.status(400).json({ message: "Invalid signature" });
        }

        console.log("✅ Webhook signature verified");

        const {event , payload } = req.body;

        console.log("Received Payload:", payload);

        if (event === "payment.captured") {
            const paymentData = payload.payment.entity;
            const appointmentId = paymentData.notes.appointment_id;
            
            console.log("🔹 Payment Captured for AppointmentID", appointmentId);

            if (!appointmentId) {
                return res.status(400).json({ message: "No appointment ID found in payment notes." });
            }

            // ✅ Update Appointment Status to "confirmed"
            await AppointmentRecordsSchema.updateOne(
                { _id: appointmentId },
                { $set: { payment_status: "confirmed", payment_id: paymentData.id } }
            );

            return res.status(200).json({ message: "Payment verified and appointment confirmed." });
        }

        res.status(200).json({ message: "Webhook received but no action taken." });
    } catch (error) {
        console.error("❌ Webhook processing failed:", error);
        res.status(500).json({ message: "Webhook processing failed.", error: error.message });
    }
});

module.exports = AppointmentRoute;

