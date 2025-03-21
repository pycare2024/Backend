const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const razorpay = require("../razorpay");
const AppointmentRoute = express.Router();
const DoctorSchema = require("../model/DoctorSchema");
const DoctorScheduleSchema = require("../model/DoctorScheduleSchema");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");
const DoctorsAssignmentPrioritySchema = require("../model/DoctorsAssignmentPrioritySchema"); // ✅ Import this!
const fetch = require("node-fetch");
const patientSchema = require("../model/patientSchema");
const doc = require("pdfkit");
const {generateJitsiMeetingLink} = require("../JitsiHelper");

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token


AppointmentRoute.get("/appointments", (req, res) => {
    AppointmentRecordsSchema.find((err, data) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch Appointment Records" });
        }
        res.json(data);
    });
});

AppointmentRoute.get("/doctor-appointments", async (req, res) => {
    try {
        const { doctor_id, date } = req.query;

        if (!doctor_id) {
            return res.status(400).json({ message: "Doctor ID is required." });
        }

        let filter = { doctor_id };

        if (date) {
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0); // Normalize to start of the day

            const nextDay = new Date(selectedDate);
            nextDay.setDate(nextDay.getDate() + 1);

            filter.DateOfAppointment = { $gte: selectedDate, $lt: nextDay };
        }

        const appointments = await AppointmentRecordsSchema.find(filter)
            .sort({ DateOfAppointment: 1 }) // Sort by date
            .lean();

        res.status(200).json({ success: true, appointments });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
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

        const patient = await patientSchema.findById(new mongoose.Types.ObjectId(patient_id));
        if (!patient) {
            console.error("Debug: Patient not found for ID:", patient_id);
            return res.status(404).json({ message: "Patient not found." });
        }

        const patientPhoneNumber = patient.Mobile;
        const patientName = patient.Name;

        // ✅ Step 1: Create an Appointment Record First
        const newAppointment = new AppointmentRecordsSchema({
            patient_id,
            patientName: patientName,
            patientPhoneNumber: patientPhoneNumber,
            doctor_id: selectedDoctor.doctor_id,
            DateOfAppointment: appointmentDate,
            WeekDay: selectedDoctor.WeekDay,
            payment_status: "pending",
            payment_id: null,
            payment_link_id: null,// Will update after payment link creation
            meeting_link: null 
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

        const paymentLink = paymentLinkResponse.short_url; // ✅ Payment link
        const paymentLinkId = paymentLinkResponse.id; // ✅ Extract Razorpay Payment Link ID
        const uniquePaymentCode = paymentLink.split("/").pop(); // ✅ Extract unique part of link

        // ✅ Step 3: Update Appointment Record with Payment Link ID
        await AppointmentRecordsSchema.updateOne(
            { _id: savedAppointment._id },
            { $set: { payment_link_id: paymentLinkId } }
        );

        // ✅ Step 4: Reduce Available Slots for the Selected Doctor
        await DoctorScheduleSchema.updateOne(
            { _id: selectedDoctor._id },
            { $inc: { SlotsAvailable: -1 } }
        );

        // ✅ Step 5: Send Payment Link via WhatsApp using WATI API
        if (patientPhoneNumber) {
            const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${patientPhoneNumber}`, {
                method: "POST",
                headers: {
                    "Authorization": WATI_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    template_name: "payment_link",
                    broadcast_name: "PaymentLinkBroadcast",
                    parameters: [
                        {
                            name: "1",
                            value: patientName  // ✅ Patient's name for {{1}}
                        },
                        {
                            name: "2",
                            value: uniquePaymentCode  // ✅ Unique payment link or ID for {{2}}
                        }
                    ]
                })
            });

            const whatsappData = await whatsappResponse.json();
            if (!whatsappResponse.ok) {
                console.error("Failed to send WhatsApp message:", whatsappData);
            }
        }

        // ✅ Step 5: Return Payment Link to Chatbot
        return res.status(200).json({
            message: "Appointment booked pending payment.",
            doctorId: selectedDoctor.doctor_id,
            remainingSlots: selectedDoctor.SlotsAvailable - 1,
            appointmentDetails: savedAppointment,
            paymentLink: paymentLink, // ✅ Correct Payment Link
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

        console.log("Recieved Sign", receivedSignature);
        console.log("Expected Signature", expectedSignature);

        if (expectedSignature !== receivedSignature) {
            console.error("❌ Invalid signature! Possible security breach.");
            return res.status(400).json({ message: "Invalid signature" });
        }

        console.log("✅ Webhook signature verified");

        const { event, payload } = req.body;

        console.log("Received Payload:", payload);

        if (event === "payment.captured") {
            const paymentData = payload.payment.entity;
            const appointmentId = paymentData.notes.appointment_id;

            console.log("🔹 Payment Captured for AppointmentID", appointmentId);

            if (!appointmentId) {
                return res.status(400).json({ message: "No appointment ID found in payment notes." });
            }

            const link = generateJitsiMeetingLink(); // Generating jitsi meeting link

            // ✅ Update Appointment Status to "confirmed"
            await AppointmentRecordsSchema.updateOne(
                { _id: appointmentId },
                { $set: { payment_status: "confirmed", payment_id: paymentData.id, meeting_link: link } }
            );

            const appointment = await AppointmentRecordsSchema.findById(new mongoose.Types.ObjectId(appointmentId));
            if (!appointment) {
                console.error("Appointment not found for Appointment Id:", appointmentId);
                return res.status(404).json({ message: "Patient not found." });
            }

            const doctor = await DoctorSchema.findById(new mongoose.Types.ObjectId(appointment.doctor_id));

            if(!doctor)
                {
                    console.error("Doctor not found with doctor id->",appointment.doctor_id);
                    return res.status(404).json({ message: "Doctor not found." });
                }

            const patientPhoneNumber = appointment.patientPhoneNumber;
            const patientName = appointment.patientName;
            const DofAppt = appointment.DateOfAppointment;
            const apptTime = "soon to rolled out";
            const DoctorName = doctor.Name;
            const clinicName = "PsyCare";
            const payId = paymentData.id;

            if (patientPhoneNumber) {
                const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${patientPhoneNumber}`, {
                    method: "POST",
                    headers: {
                        "Authorization": WATI_API_KEY,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        template_name: "appointment_details",
                        broadcast_name: "appointmentDetailBroadcast",
                        parameters: [
                            {
                                name: "name",
                                value: patientName  // ✅ Patient's name for {{1}}
                            },
                            {
                                name: "appointment_date",
                                value: DofAppt  // ✅ Unique payment link or ID for {{2}}
                            },
                            {
                                name: "appointment_time",
                                value: apptTime  // ✅ Patient's name for {{1}}
                            },
                            {
                                name: "doctor_name",
                                value: DoctorName  // ✅ Unique payment link or ID for {{2}}
                            },
                            {
                                name: "clinic_name",
                                value: clinicName // ✅ Patient's name for {{1}}
                            },
                            {
                                name: "payment_id",
                                value: payId  // ✅ Unique payment link or ID for {{2}}
                            },
                            {
                                name: "link",
                                value: link
                            }
                        ]
                    })
                });

                const whatsappData = await whatsappResponse.json();
                if (!whatsappResponse.ok) {
                    console.error("Failed to send WhatsApp message:", whatsappData);
                }
            }

            return res.status(200).json({ message: "Payment verified and appointment confirmed." });
        }

        res.status(200).json({ message: "Webhook received but no action taken." });
    } catch (error) {
        console.error("❌ Webhook processing failed:", error);
        res.status(500).json({ message: "Webhook processing failed.", error: error.message });
    }
});

module.exports = AppointmentRoute;

