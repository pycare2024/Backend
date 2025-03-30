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
const { generateJitsiMeetingLink } = require("../JitsiHelper");
const DoctorAccountsSchema = require("../model/DoctorAccountsSchema");
const DoctorTransactionsSchema = require("../model/DoctorTransactionsSchema");


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
        const { selectedDate, patient_id, preferredTime } = req.body;

        if (!selectedDate || !patient_id || !preferredTime) {
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

        // ✅ Define time ranges for filtering
        let timeFilter = {};
        if (preferredTime === "morning") {
            timeFilter = { "Slots.startTime": { $gte: "09:00", $lt: "12:00" } };
        } else if (preferredTime === "afternoon") {
            timeFilter = { "Slots.startTime": { $gte: "12:00", $lt: "16:00" } };
        } else if (preferredTime === "evening") {
            timeFilter = { "Slots.startTime": { $gte: "16:00", $lt: "19:00" } };
        } else {
            return res.status(400).json({ message: "Invalid preferredTime. Use morning, afternoon, or evening." });
        }

        // ✅ Find doctors with available slots in the selected time range
        let lastAssignment = await DoctorsAssignmentPrioritySchema.findOne({ Date: appointmentDate });

        const availableDoctors = await DoctorScheduleSchema.find({
            Date: appointmentDate,
            SlotsAvailable: { $gt: 0 },
            "Slots.isBooked": false,
            ...timeFilter // ✅ Apply time filter
        }).sort({ doctor_id: 1 });

        if (availableDoctors.length === 0) {
            return res.status(404).json({
                message: `No doctors available in the ${preferredTime} on the selected date.`,
                selectedDate: appointmentDate,
            });
        }

        // ✅ Find the earliest available slot across all doctors
        let earliestSlotTime = null;
        availableDoctors.forEach(doc => {
            const firstAvailableSlot = doc.Slots.find(slot => !slot.isBooked);
            if (firstAvailableSlot && (!earliestSlotTime || firstAvailableSlot.startTime < earliestSlotTime)) {
                earliestSlotTime = firstAvailableSlot.startTime;
            }
        });

        if (!earliestSlotTime) {
            return res.status(500).json({ message: "Unexpected error: No available slots found." });
        }

        // ✅ Filter doctors who have the **same earliest slot**
        const doctorsWithEarliestSlot = availableDoctors.filter(doc =>
            doc.Slots.some(slot => !slot.isBooked && slot.startTime === earliestSlotTime)
        );

        if (doctorsWithEarliestSlot.length === 0) {
            return res.status(500).json({ message: "Unexpected error: No doctor found for the earliest slot." });
        }

        // ✅ Apply **Round-Robin selection** among these doctors
        let selectedDoctor;
        if (!lastAssignment) {
            selectedDoctor = doctorsWithEarliestSlot[0];
            await DoctorsAssignmentPrioritySchema.create({
                Date: appointmentDate,
                LastDoctorAssigned: selectedDoctor.doctor_id
            });
        } else {
            const lastAssignedDoctorIndex = doctorsWithEarliestSlot.findIndex(doc => doc.doctor_id.toString() === lastAssignment.LastDoctorAssigned.toString());
            selectedDoctor = (lastAssignedDoctorIndex === -1 || lastAssignedDoctorIndex === doctorsWithEarliestSlot.length - 1)
                ? doctorsWithEarliestSlot[0]
                : doctorsWithEarliestSlot[lastAssignedDoctorIndex + 1];

            await DoctorsAssignmentPrioritySchema.updateOne(
                { Date: appointmentDate },
                { $set: { LastDoctorAssigned: selectedDoctor.doctor_id } }
            );
        }

        // ✅ Get the **earliest slot** for the selected doctor
        const earliestSlot = selectedDoctor.Slots.find(slot => !slot.isBooked && slot.startTime === earliestSlotTime);
        if (!earliestSlot) {
            return res.status(500).json({ message: "Unexpected error: No available slot found for the selected doctor." });
        }

        const patient = await patientSchema.findById(new mongoose.Types.ObjectId(patient_id));
        if (!patient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        const patientPhoneNumber = patient.Mobile;
        const patientName = patient.Name;

        // ✅ Create an Appointment Record
        const newAppointment = new AppointmentRecordsSchema({
            patient_id,
            patientName,
            patientPhoneNumber,
            doctorScheduleId: selectedDoctor._id,
            doctor_id: selectedDoctor.doctor_id,
            DateOfAppointment: appointmentDate,
            AppStartTime: earliestSlot.startTime,
            AppEndTime: earliestSlot.endTime,
            WeekDay: selectedDoctor.WeekDay,
            payment_status: "pending",
            payment_id: null,
            payment_link_id: null,
            meeting_link: null
        });

        const savedAppointment = await newAppointment.save();

        // ✅ Generate a Razorpay Payment Link
        const paymentLinkResponse = await razorpay.paymentLink.create({
            amount: 100,
            currency: "INR",
            accept_partial: false,
            description: "Appointment Booking Fee",
            notify: { sms: true, email: false },
            reference_id: `appointment_${savedAppointment._id}`,
            notes: { appointment_id: savedAppointment._id.toString(), patient_id }
        });

        const paymentLink = paymentLinkResponse.short_url;
        const paymentLinkId = paymentLinkResponse.id;
        const uniquePaymentCode = paymentLink.split("/").pop();

        // ✅ Update Appointment Record with Payment Link
        await AppointmentRecordsSchema.updateOne(
            { _id: savedAppointment._id },
            { $set: { payment_link_id: paymentLinkId } }
        );

        // ✅ Send Payment Link via WhatsApp
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
                        { name: "1", value: patientName },
                        { name: "2", value: uniquePaymentCode }
                    ]
                })
            });

            const whatsappData = await whatsappResponse.json();
            if (!whatsappResponse.ok) {
                console.error("Failed to send WhatsApp message:", whatsappData);
            }
        }

        const doctor = await DoctorSchema.findById(new mongoose.Types.ObjectId(selectedDoctor.doctor_id));

        if (!doctor) {
            console.error("Doctor not found with doctor id->", selectedDoctor.doctor_id);
            return res.status(404).json({ message: "Doctor not found." });
        }

        return res.status(200).json({
            message: `Appointment booked pending payment.`,
            doctorName: doctor.Name,
            remainingSlots: selectedDoctor.SlotsAvailable - 1,
            appointmentDetails: savedAppointment,
            paymentLink,
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
                return res.status(404).json({ message: "Appointment not found." });
            }

            await DoctorScheduleSchema.updateOne(
                {
                    _id: appointment.doctorScheduleId,
                    "Slots.startTime": appointment.AppStartTime,
                    "Slots.isBooked": false
                },
                {
                    $set:
                    {
                        "Slots.$.isBooked": true,
                        "Slots.$.bookedBy": appointment.patient_id
                    },
                    $inc: { SlotsAvailable: -1 }
                },

            );

            const doctor = await DoctorSchema.findById(new mongoose.Types.ObjectId(appointment.doctor_id));

            if (!doctor) {
                console.error("Doctor not found with doctor id->", appointment.doctor_id);
                return res.status(404).json({ message: "Doctor not found." });
            }

            const patientPhoneNumber = appointment.patientPhoneNumber;
            const patientName = appointment.patientName;
            const DofAppt = appointment.DateOfAppointment;
            const apptTime = appointment.AppStartTime;
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
                                value: "Your consultation is scheduled. The meeting link will be sent to you once the doctor starts the session. ⏳ Please wait for further updates. Thank you for your patience! 😊"
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

AppointmentRoute.post("/startSession/:appointmentId", async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await AppointmentRecordsSchema.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        const appointmentDate = appointment.DateOfAppointment;
        const appointmentTime = appointment.AppStartTime;

        const [hours, minutes] = appointmentTime.split(":").map(Number);
        const scheduledTime = new Date(appointmentDate);
        scheduledTime.setHours(hours);
        scheduledTime.setMinutes(minutes);
        scheduledTime.setSeconds(0);
        scheduledTime.setMilliseconds(0);

        const currentTime = new Date();
        const twentyMinutesLater = new Date(scheduledTime.getTime() + 20 * 60000);

        if (currentTime < scheduledTime) {
            return res.status(400).json({
                message: `You cannot start the session before the scheduled time: ${scheduledTime.toLocaleString()}`
            });
        }

        if (currentTime > twentyMinutesLater) {
            return res.status(400).json({
                message: "The session window has expired. You cannot send the meeting link more than 20 minutes after the scheduled time."
            });
        }

        // Proceed with session start
        const updatedAppointment = await AppointmentRecordsSchema.findByIdAndUpdate(
            appointmentId,
            {
                session_started: true,
                session_start_time: new Date()
            },
            { new: true }
        );

        const patientName = appointment.patientName;
        const patientPhoneNumber = appointment.patientPhoneNumber;
        const meet_link = appointment.meeting_link;
        const doctor_id = appointment.doctor_id;

        const doctor = await DoctorSchema.findById(new mongoose.Types.ObjectId(doctor_id));
        if (!doctor) {
            console.error("Doctor not found with doctor id->", doctor_id);
            return res.status(404).json({ message: "Doctor not found." });
        }

        const doctor_name = doctor.Name;

        if (patientPhoneNumber) {
            const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${patientPhoneNumber}`, {
                method: "POST",
                headers: {
                    "Authorization": WATI_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    template_name: "meeting_link",
                    broadcast_name: "providing_meeting_link",
                    parameters: [
                        { name: "patient_name", value: patientName },
                        { name: "doctor_name", value: doctor_name },
                        { name: "meet_link", value: meet_link }
                    ]
                })
            });

            const whatsappData = await whatsappResponse.json();
            if (!whatsappResponse.ok) {
                console.error("Failed to send WhatsApp message:", whatsappData);
            }
        }

        res.status(200).json({
            message: "Session started successfully",
            appointment: updatedAppointment
        });

    } catch (error) {
        console.error("Error starting session:", error);
        res.status(500).json({ message: "Server error" });
    }
});

AppointmentRoute.get("/doctor-appointments-range", async (req, res) => {
    try {
        const { doctorId, from, to } = req.query;

        if (!doctorId || !from || !to) {
            return res.status(400).json({ message: "Doctor ID, from date, and to date are required." });
        }

        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);

        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);

        const filter = {
            doctor_id: doctorId,
            DateOfAppointment: { $gte: fromDate, $lte: toDate },
        };

        const appointments = await AppointmentRecordsSchema.find(filter)
            .sort({ DateOfAppointment: 1 })
            .lean();

        res.status(200).json(appointments);
    } catch (error) {
        console.error("Error fetching doctor appointments (range):", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

AppointmentRoute.post("/markCompleted/:appointmentId", async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await AppointmentRecordsSchema.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        // ✅ Step 1: Check if session started
        if (!appointment.session_started || !appointment.session_start_time) {
            return res.status(400).json({ message: "Session has not been started yet." });
        }

        // 🧪 [Time constraint removed for testing]
        const sessionStart = new Date(appointment.session_start_time);
        const currentTime = new Date();
        const twentyMinutesLater = new Date(sessionStart.getTime() + 20 * 60000);
        if (currentTime < twentyMinutesLater) {
            return res.status(400).json({
                message: "You can only mark the appointment as completed after 20 minutes of session start time."
            });
        }

        // ✅ Step 2: Mark as completed
        appointment.appointment_status = "completed";

        // ✅ Step 3: Check if already paid
        if (appointment.isPaidToDoctor) {
            await appointment.save();
            return res.status(200).json({
                message: "Appointment marked as completed. Doctor was already paid.",
                appointment
            });
        }

        // ✅ Step 4: Check payout eligibility
        if (appointment.payment_status !== "confirmed") {
            await appointment.save();
            return res.status(200).json({
                message: "Appointment marked as completed, but not eligible for payout (payment not confirmed).",
                appointment
            });
        }

        // ✅ Step 5: Perform payout
        const doctorId = appointment.doctor_id;
        const amount = 500; // Update if needed

        await DoctorTransactionsSchema.create({
            doctorId,
            type: "credit",
            amount,
            source: "appointment",
            referenceId: appointment._id,
            note: "Payout for completed appointment",
            status: "completed"
        });

        await DoctorAccountsSchema.findOneAndUpdate(
            { doctorId },
            {
                $inc: {
                    totalEarnings: amount,
                    currentBalance: amount
                },
                $set: { lastUpdated: new Date() }
            },
            { upsert: true }
        );

        appointment.isPaidToDoctor = true;
        await appointment.save();

        res.status(200).json({
            message: "Appointment marked as completed and doctor credited.",
            appointment
        });

    } catch (error) {
        console.error("Error in markCompleted:", error);
        res.status(500).json({ message: "Server error" });
    }
});

AppointmentRoute.post("/markNoShow/:appointmentId", async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await AppointmentRecordsSchema.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        if (!appointment.session_started || !appointment.session_start_time) {
            return res.status(400).json({ message: "Session has not been started yet." });
        }

        const sessionStart = new Date(appointment.session_start_time);
        const currentTime = new Date();
        const twentyMinutesLater = new Date(sessionStart.getTime() + 20 * 60000);

        if (currentTime < twentyMinutesLater) {
            return res.status(400).json({
                message: "You can only mark as no-show after 20 minutes from session start time."
            });
        }

        // ✅ Update status
        appointment.appointment_status = "no_show";

        // ✅ Check if already paid
        if (appointment.isPaidToDoctor) {
            await appointment.save();
            return res.status(200).json({
                message: "Marked as no-show. Doctor already paid.",
                appointment
            });
        }

        // ✅ Check payment status
        if (appointment.payment_status !== "confirmed") {
            await appointment.save();
            return res.status(200).json({
                message: "Marked as no-show. Not eligible for payout (payment not confirmed).",
                appointment
            });
        }

        // ✅ Pay the doctor (same as completed)
        const doctorId = appointment.doctor_id;
        const amount = 500; // fixed or dynamic

        await DoctorTransactionsSchema.create({
            doctorId,
            type: "credit",
            amount,
            source: "appointment",
            referenceId: appointment._id,
            note: "Payout for no-show (doctor attended)",
            status: "completed"
        });

        await DoctorAccountsSchema.findOneAndUpdate(
            { doctorId },
            {
                $inc: {
                    totalEarnings: amount,
                    currentBalance: amount
                },
                $set: { lastUpdated: new Date() }
            },
            { upsert: true }
        );

        appointment.isPaidToDoctor = true;
        await appointment.save();

        res.status(200).json({
            message: "Appointment marked as no-show. Doctor has been credited.",
            appointment
        });

    } catch (error) {
        console.error("Error marking as no-show:", error);
        res.status(500).json({ message: "Server error" });
    }
});


module.exports = AppointmentRoute;

