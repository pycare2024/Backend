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
const InitiateRefund = require("../Utility/InitiateRefund");
const Corporate = require("../model/CorporateSchema");
const CorporateSchema = require("../model/CorporateSchema");
const NewScreeningTestSchema = require("../model/NewScreeningTestSchema");
const multer = require("multer");
const cloudinary = require("../Utility/cloudinary");

// Use memory storage for multer
const storage = multer.memoryStorage();
const upload = multer({ storage });



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

        // console.log("Appointments->",appointments);

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
        const { selectedDate, patient_id, preferredTime, userType, empId, companyCode } = req.body;

        if (!selectedDate || !patient_id || !preferredTime) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // Check if screening test exists
        const existingAssessment = await NewScreeningTestSchema.findOne({ patient_id });
        if (!existingAssessment) {
            return res.status(403).json({
                message: "🧠 Please complete the psychometric test before booking an appointment. Go to Home page and take the Psychometric Assessment first!"
            });
        }

        const appointmentDate = new Date(selectedDate);
        if (isNaN(appointmentDate)) return res.status(400).json({ message: "Invalid date format." });

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

        let timeFilter = {};
        if (preferredTime === "morning") timeFilter = { "Slots.startTime": { $gte: "09:00", $lt: "12:00" } };
        else if (preferredTime === "afternoon") timeFilter = { "Slots.startTime": { $gte: "12:00", $lt: "16:00" } };
        else if (preferredTime === "evening") timeFilter = { "Slots.startTime": { $gte: "16:00", $lt: "21:00" } };
        else return res.status(400).json({ message: "Invalid preferredTime." });

        // STEP 1: Get eligible doctor IDs based on userType
        const eligibleDoctorIds = await DoctorSchema.find({
            Role: userType === "corporate" ? "Therapist" : "Consultant",
            platformType: "corporate"
        }).distinct("_id");

        const availableDoctors = await DoctorScheduleSchema.find({
            Date: appointmentDate,
            SlotsAvailable: { $gt: 0 },
            "Slots.isBooked": false,
            doctor_id: { $in: eligibleDoctorIds },
            ...timeFilter,
        }).sort({ doctor_id: 1 });

        if (!availableDoctors.length) {
            return res.status(404).json({ message: "No doctors available at the selected time." });
        }

        // STEP 2: Find earliest slot and shortlist doctors
        let earliestSlotTime = null;
        availableDoctors.forEach(doc => {
            const slot = doc.Slots.find(s => !s.isBooked);
            if (slot && (!earliestSlotTime || slot.startTime < earliestSlotTime)) {
                earliestSlotTime = slot.startTime;
            }
        });

        const doctorsWithEarliest = availableDoctors.filter(doc =>
            doc.Slots.some(s => !s.isBooked && s.startTime === earliestSlotTime)
        );

        // STEP 3: Rotate using DoctorsAssignmentPrioritySchema
        const trackerField = userType === "corporate" ? "LastPhDTherapistAssigned" : "LastMAConsultantAssigned";
        let selectedDoctor;
        const assignmentRecord = await DoctorsAssignmentPrioritySchema.findOne({ Date: appointmentDate });

        if (!assignmentRecord) {
            selectedDoctor = doctorsWithEarliest[0];
            await DoctorsAssignmentPrioritySchema.create({
                Date: appointmentDate,
                [trackerField]: selectedDoctor.doctor_id
            });
        } else {
            const idx = doctorsWithEarliest.findIndex(doc =>
                doc.doctor_id.toString() === (assignmentRecord[trackerField]?.toString())
            );
            selectedDoctor = (idx === -1 || idx === doctorsWithEarliest.length - 1)
                ? doctorsWithEarliest[0]
                : doctorsWithEarliest[idx + 1];

            await DoctorsAssignmentPrioritySchema.updateOne(
                { Date: appointmentDate },
                { $set: { [trackerField]: selectedDoctor.doctor_id } }
            );
        }

        // STEP 4: Finalize slot and create appointment
        const selectedSlot = selectedDoctor.Slots.find(s => !s.isBooked && s.startTime === earliestSlotTime);
        if (!selectedSlot) return res.status(500).json({ message: "No available slot found." });

        const patient = await patientSchema.findById(patient_id);
        if (!patient) return res.status(404).json({ message: "Patient not found." });

        const appointmentData = {
            patient_id,
            patientName: patient.Name,
            patientPhoneNumber: patient.Mobile,
            doctorScheduleId: selectedDoctor._id,
            doctor_id: selectedDoctor.doctor_id,
            DateOfAppointment: appointmentDate,
            AppStartTime: selectedSlot.startTime,
            AppEndTime: selectedSlot.endTime,
            WeekDay: selectedDoctor.WeekDay,
            payment_status: "confirmed",
            userType,
            empId,
            companyCode,
            meeting_link: generateJitsiMeetingLink(),
            appointment_fees: 1000 // ✅ Set correct corporate fee
        };

        const doctor = await DoctorSchema.findById(selectedDoctor.doctor_id);
        const DoctorName = doctor?.Name || "Doctor";
        const DoctorPhNo = doctor?.Mobile || "0000000000";
        const patientName = patient.Name;
        const phone = patient.Mobile;
        const DofAppt = appointmentDate.toDateString();
        const apptTime = selectedSlot.startTime;
        const clinicName = "PsyCare";

        // CORPORATE FLOW
        const company = await Corporate.findOne({ companyCode });
        if (!company) return res.status(404).json({ message: "Company not found." });
        if (company.totalCredits <= 0) {
            return res.status(403).json({ message: "Insufficient company credits." });
        }

        company.totalCredits -= 1;
        await company.save();

        const savedAppointment = await new AppointmentRecordsSchema(appointmentData).save();

        await DoctorScheduleSchema.updateOne(
            { _id: selectedDoctor._id, "Slots.startTime": selectedSlot.startTime },
            {
                $set: { "Slots.$.isBooked": true, "Slots.$.bookedBy": patient_id },
                $inc: { SlotsAvailable: -1 }
            }
        );

        await Corporate.updateOne(
            { companyCode, "associatedPatients.empId": empId },
            {
                $push: {
                    "associatedPatients.$.visits": {
                        date: appointmentDate,
                        purpose: "Appointment"
                    }
                }
            }
        );

        // WhatsApp confirmation to patient
        if (phone) {
            await fetch(`${WATI_API_URL}?whatsappNumber=91${phone}`, {
                method: "POST",
                headers: {
                    Authorization: WATI_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    template_name: "appointment_details",
                    broadcast_name: "CorporateAppointmentConfirm",
                    parameters: [
                        { name: "name", value: patientName },
                        { name: "appointment_date", value: DofAppt },
                        { name: "appointment_time", value: apptTime },
                        { name: "doctor_name", value: DoctorName },
                        { name: "clinic_name", value: clinicName },
                        { name: "payment_id", value: "Corporate Package" },
                        { name: "link", value: "Your appointment is confirmed and covered under your company’s plan. ✅" }
                    ]
                })
            });
        }

        // WhatsApp notification to doctor
        if (DoctorPhNo) {
            await fetch(`${WATI_API_URL}?whatsappNumber=91${DoctorPhNo}`, {
                method: "POST",
                headers: {
                    Authorization: WATI_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    template_name: "new_appointment_notification_to_doctor",
                    broadcast_name: "appointment_notification_to_doctor",
                    parameters: [
                        { name: "Doctor_Name", value: DoctorName },
                        { name: "Patient_Name", value: patientName },
                        { name: "Date", value: DofAppt },
                        { name: "Time_Slot", value: `${selectedSlot.startTime} - ${selectedSlot.endTime}` }
                    ]
                })
            });
        }

        return res.status(200).json({
            message: "Appointment booked (corporate)",
            appointmentDetails: savedAppointment,
            doctorName: DoctorName,
            remainingCredits: company.totalCredits
        });

    } catch (err) {
        console.error("Error booking appointment:", err);
        return res.status(500).json({ message: "Booking failed.", error: err.message });
    }
});

AppointmentRoute.post("/bookFollowUpAppointment", async (req, res) => {
    try {

        console.log("Req body->", req.body);
        const { selectedDate, patient_id, preferredTime, userType, empId, companyCode, doctor_id, previousAppointmentId } = req.body;

        if (!selectedDate || !patient_id || !preferredTime || !doctor_id) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const appointmentDate = new Date(selectedDate);
        if (isNaN(appointmentDate)) return res.status(400).json({ message: "Invalid date format." });

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

        let timeFilter = {};
        if (preferredTime === "morning") timeFilter = { "Slots.startTime": { $gte: "09:00", $lt: "12:00" } };
        else if (preferredTime === "afternoon") timeFilter = { "Slots.startTime": { $gte: "12:00", $lt: "16:00" } };
        else if (preferredTime === "evening") timeFilter = { "Slots.startTime": { $gte: "16:00", $lt: "21:00" } };
        else return res.status(400).json({ message: "Invalid preferredTime." });

        const doctorSchedule = await DoctorScheduleSchema.findOne({
            Date: appointmentDate,
            doctor_id,
            SlotsAvailable: { $gt: 0 },
            "Slots.isBooked": false,
            ...timeFilter,
        });

        if (!doctorSchedule) {
            return res.status(404).json({ message: "The selected doctor has no available slots for the chosen time." });
        }

        const selectedSlot = doctorSchedule.Slots.find(s => !s.isBooked && s.startTime >= timeFilter["Slots.startTime"].$gte);

        if (!selectedSlot) return res.status(500).json({ message: "No available slot found for the selected doctor." });

        const patient = await patientSchema.findById(patient_id);
        if (!patient) return res.status(404).json({ message: "Patient not found." });

        const appointmentData = {
            patient_id,
            patientName: patient.Name,
            patientPhoneNumber: patient.Mobile,
            doctorScheduleId: doctorSchedule._id,
            doctor_id,
            DateOfAppointment: appointmentDate,
            AppStartTime: selectedSlot.startTime,
            AppEndTime: selectedSlot.endTime,
            WeekDay: doctorSchedule.WeekDay,
            payment_status: userType === "corporate" ? "confirmed" : "pending",
            userType,
            empId: userType === "corporate" ? empId : undefined,
            companyCode: userType === "corporate" ? companyCode : undefined,
            isFollowUp: true,
            linkedToAppointmentId: previousAppointmentId
        };

        const doctor = await DoctorSchema.findById(doctor_id);
        if (!doctor) return res.status(404).json({ message: "Assigned doctor not found." });

        // ✅ Validate correct Role for follow-up
        if (userType === "corporate" && doctor.Role !== "Therapist") {
            return res.status(400).json({ message: "Corporate patients must be assigned to a therapist (PhD)." });
        }
        if (userType === "retail" && doctor.Role !== "Consultant") {
            return res.status(400).json({ message: "Retail patients must be assigned to a consultant (MA)." });
        }
        const patientName = patient.Name;
        const phone = patient.Mobile;
        const DofAppt = appointmentData.DateOfAppointment.toDateString();
        const apptTime = appointmentData.AppStartTime;
        const DoctorName = doctor?.Name || "Doctor";
        const DoctorPhNo = doctor?.Mobile || "12345";
        const clinicName = "PsyCare";

        if (userType === "corporate") {

            console.log("Corporate booking detected");
            console.log("Patient book follow Up Appointment,  patient id->", patient_id);

            const company = await Corporate.findOne({ companyCode });
            if (!company) return res.status(404).json({ message: "Company not found." });

            if (company.totalCredits <= 0) {
                return res.status(403).json({ message: "Insufficient credits in company account." });
            }

            console.log("✅ Deducting credit for:", companyCode);
            company.totalCredits -= 1;
            await company.save();

            const meetingLink = generateJitsiMeetingLink();
            appointmentData.meeting_link = meetingLink;

            const savedAppointment = await new AppointmentRecordsSchema(appointmentData).save();

            await DoctorScheduleSchema.updateOne(
                {
                    _id: doctorSchedule._id,
                    "Slots.startTime": selectedSlot.startTime,
                    "Slots.isBooked": false
                },
                {
                    $set: {
                        "Slots.$.isBooked": true,
                        "Slots.$.bookedBy": patient_id
                    },
                    $inc: { SlotsAvailable: -1 }
                }
            );

            const corporate = await Corporate.findOneAndUpdate(
                {
                    companyCode: companyCode,
                    "associatedPatients.empId": empId,   // very important: match empId (employee only)
                },
                {
                    $push: {
                        "associatedPatients.$.visits": {
                            date: appointmentDate,
                            purpose: "Follow up Appointment"  // or save from frontend if dynamic
                        }
                    }
                },
                { new: true }
            );

            if (!corporate) {
                console.error("Employee not found inside corporate during visit update.");
            } else {
                console.log("✅ Visit successfully added to employee record");
            }

            if (phone) {
                await fetch(`${WATI_API_URL}?whatsappNumber=91${phone}`, {
                    method: "POST",
                    headers: {
                        Authorization: WATI_API_KEY,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        template_name: "appointment_details",
                        broadcast_name: "CorporateFollowupConfirm",
                        parameters: [
                            { name: "name", value: patientName },
                            { name: "appointment_date", value: DofAppt },
                            { name: "appointment_time", value: apptTime },
                            { name: "doctor_name", value: DoctorName },
                            { name: "clinic_name", value: clinicName },
                            { name: "payment_id", value: "Corporate Package" },
                            {
                                name: "link",
                                value: "Your follow-up is confirmed and covered under your company’s package. ✅"
                            }
                        ]
                    })
                });
            }

            const timeSlot = `${selectedSlot.startTime} - ${selectedSlot.endTime}`;

            if (DoctorPhNo) {
                await fetch(`${WATI_API_URL}?whatsappNumber=91${DoctorPhNo}`, {
                    method: "POST",
                    headers: {
                        Authorization: WATI_API_KEY,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        template_name: "new_appointment_notification_to_doctor",
                        broadcast_name: "appointment_notification_to_doctor",
                        parameters: [
                            { name: "Doctor_Name", value: DoctorName },
                            { name: "Patient_Name", value: patientName },
                            { name: "Date", value: DofAppt },
                            { name: "Time_Slot", value: timeSlot }
                        ]
                    })
                });
            }

            return res.status(200).json({
                message: `Follow-up booked successfully with Dr. ${DoctorName} (corporate).`,
                appointmentDetails: appointmentData,
                doctorName: DoctorName,
                remainingCredits: company.totalCredits
            });
        }

        // Retail
        const savedAppointment = await new AppointmentRecordsSchema(appointmentData).save();

        const paymentLinkResponse = await razorpay.paymentLink.create({
            amount: 100,
            currency: "INR",
            accept_partial: false,
            description: "Appointment Booking Fee",
            notify: { sms: true },
            reference_id: `appointment_${savedAppointment._id}`,
            notes: { appointment_id: savedAppointment._id.toString(), patient_id },
        });

        await AppointmentRecordsSchema.updateOne(
            { _id: savedAppointment._id },
            { $set: { payment_link_id: paymentLinkResponse.id } }
        );

        const uniquePaymentCode = paymentLinkResponse.short_url.split("/").pop();
        if (phone) {
            await fetch(`${WATI_API_URL}?whatsappNumber=91${phone}`, {
                method: "POST",
                headers: {
                    Authorization: WATI_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    template_name: "payment_link",
                    broadcast_name: "PaymentLinkBroadcast",
                    parameters: [
                        { name: "1", value: patientName },
                        { name: "2", value: uniquePaymentCode }
                    ]
                }),
            });
        }

        return res.status(200).json({
            message: `Follow-up booked with Dr. ${DoctorName} (retail).`,
            appointmentDetails: savedAppointment,
            doctorName: DoctorName,
            paymentLink: paymentLinkResponse.short_url,
        });

    } catch (err) {
        console.error("Error booking follow-up appointment:", err);
        return res.status(500).json({ message: "Booking follow-up failed.", error: err.message });
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

                if (doctor.Mobile) {
                    await fetch(`${WATI_API_URL}?whatsappNumber=91${doctor.Mobile}`, {
                        method: "POST",
                        headers: {
                            Authorization: WATI_API_KEY,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            template_name: "new_appointment_notification_to_doctor",
                            broadcast_name: "appointment_notification_to_doctor",
                            parameters: [
                                { name: "Doctor_Name", value: doctor.Name },
                                { name: "Patient_Name", value: patientName },
                                { name: "Date", value: DofAppt },
                                { name: "Time_Slot", value: `${appointment.AppStartTime} - ${appointment.AppEndTime}` }
                            ]
                        })
                    });
                }

                const whatsappData = await whatsappResponse.json();
                if (!whatsappResponse.ok) {
                    console.error("Failed to send WhatsApp message:", whatsappData);
                }
            }

            // Notify fixed admins (Vivek and Dhruv)
            const admins = [
                { name: "Vivek", number: "8107191657" },
                { name: "Dhruv", number: "9871535106" }
            ];

            for (const admin of admins) {
                try {
                    await fetch(`${WATI_API_URL}?whatsappNumber=91${admin.number}`, {
                        method: "POST",
                        headers: {
                            Authorization: WATI_API_KEY,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            template_name: "appointment_notification_reminder", // 👈 your new template name
                            broadcast_name: "appointment_alert_admin",
                            parameters: [
                                { name: "1", value: admin.name },                // Hello {{1}},
                                { name: "2", value: DoctorName },               // Employee Name: {{2}}
                                { name: "3", value: doctor.platformType },
                                { name: "4", value: patientName },              // Specialist: {{3}}
                                { name: "5", value: `${DofAppt}, ${apptTime}` }, // Date & Time: {{4}}
                                { name: "6", value: "Online" }, // Mode: {{5}}
                                { name: "7", value: appointment._id.toString() } // Appointment ID: {{6}}
                            ]
                        })
                    });
                }
                catch (err) {
                    console.error(`Failed to send WhatsApp to admin ${admin.name}:`, err.message);
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
        if (appointment.session_started) {
            return res.status(400).json({ message: "Session has already been started." });
        }

        const appointmentDate = appointment.DateOfAppointment; // This is a Date object
        const appointmentTime = appointment.AppStartTime;      // e.g., "19:06" for 7:06 PM

        const [hours, minutes] = appointmentTime.split(":").map(Number);
        const appointmentDateObj = new Date(appointmentDate);

        const scheduledTimeIST = new Date(appointmentDateObj);
        scheduledTimeIST.setHours(hours);
        scheduledTimeIST.setMinutes(minutes);
        scheduledTimeIST.setSeconds(0);
        scheduledTimeIST.setMilliseconds(0);

        // Current time in IST
        const nowUTC = new Date();
        const currentTimeIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));

        // 20-minute window
        const twentyMinutesLaterIST = new Date(scheduledTimeIST.getTime() + 20 * 60000);

        // Comparison
        if (currentTimeIST < scheduledTimeIST) {
            return res.status(400).json({
                message: `You cannot start the session before the scheduled time: ${scheduledTimeIST.toLocaleString("en-IN")}`
            });
        }

        if (currentTimeIST > twentyMinutesLaterIST) {
            return res.status(400).json({
                message: "The session window has expired. You cannot send the meeting link more than 20 minutes after the scheduled time."
            });
        }

        // ✅ Proceed with session start
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
            console.error("Doctor not found with doctor id ->", doctor_id);
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
        console.error("Error starting session:", error.message, error.stack);
        res.status(500).json({ message: "Server error", error: error.message });
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
        const { notes, recommendations, followUpRecommended } = req.body;

        if (!notes || notes.trim() === "") {
            return res.status(400).json({ message: "Notes are required to complete the session." });
        }

        const appointment = await AppointmentRecordsSchema.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        appointment.notes = notes;
        appointment.recommendations = recommendations || "";
        appointment.followUpRecommended = followUpRecommended || false;

        if (!appointment.session_started || !appointment.session_start_time) {
            return res.status(400).json({ message: "Session has not been started yet." });
        }

        const sessionStart = new Date(appointment.session_start_time);
        const currentTime = new Date();
        const twentyMinutesLater = new Date(sessionStart.getTime() + 20 * 60000);
        if (currentTime < twentyMinutesLater) {
            return res.status(400).json({
                message: "You can only mark the appointment as completed after 20 minutes of session start time."
            });
        }

        appointment.appointment_status = "completed";

        if (appointment.isPaidToDoctor) {
            await appointment.save();
            return res.status(200).json({
                message: "Appointment marked as completed. Doctor was already paid.",
                appointment
            });
        }

        if (appointment.payment_status !== "confirmed") {
            await appointment.save();
            return res.status(200).json({
                message: "Appointment marked as completed, but not eligible for payout (payment not confirmed).",
                appointment
            });
        }

        const doctorId = appointment.doctor_id;
        const appointmentFee = appointment.appointment_fees || 0;
        const amount = Math.round(appointmentFee * 0.75);

        await DoctorTransactionsSchema.create({
            doctorId,
            type: "credit",
            amount,
            source: "appointment",
            referenceId: appointment._id,
            note: "Payout for appointment (Completed)",
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

        // ✅ Send WhatsApp message with recommendations
        const patientName = appointment.patientName;
        const patientPhoneNumber = appointment.patientPhoneNumber;
        const recommendationsText =
            appointment.recommendations && appointment.recommendations.trim() !== ""
                ? appointment.recommendations
                : "Here are some general suggestions to help you maintain your mental wellness: 🌱 Stay consistent with self-care, practice mindfulness, and don't hesitate to seek support when needed.";

        if (patientPhoneNumber) {
            try {
                const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${patientPhoneNumber}`, {
                    method: "POST",
                    headers: {
                        Authorization: WATI_API_KEY,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        template_name: "send_session_recommendations",
                        broadcast_name: "recommendationBroadcast",
                        parameters: [
                            { name: "name", value: patientName },
                            { name: "1", value: recommendationsText }
                        ]
                    })
                });

                const whatsappResult = await whatsappResponse.json();
                console.log("\u{1F4E4} WhatsApp message sent:", whatsappResult);
            } catch (err) {
                console.error("\u{274C} WhatsApp sending failed:", err);
            }
        }

        if (patientPhoneNumber) {
            try {
                const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${patientPhoneNumber}`, {
                    method: "POST",
                    headers: {
                        Authorization: WATI_API_KEY,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        template_name: "srs_feedback_form",
                        broadcast_name: "feedbackform",
                        parameters: [
                            { name: "name", value: patientName },
                        ]
                    })
                });

                const whatsappResult = await whatsappResponse.json();
                console.log("\u{1F4E4} WhatsApp message sent:", whatsappResult);
            } catch (err) {
                console.error("\u{274C} WhatsApp sending failed:", err);
            }
        }

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
        const amount = Math.round((appointment.appointment_fees || 0) * 0.75) / 2;

        await DoctorTransactionsSchema.create({
            doctorId,
            type: "credit",
            amount,
            source: "appointment",
            referenceId: appointment._id,
            note: "Payout for appointment (No-Show)",
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

AppointmentRoute.post("/cancelAndRefund/:appointmentId", async (req, res) => {
    try {
        const { appointmentId } = req.params;

        // 1. Fetch appointment
        const appointment = await AppointmentRecordsSchema.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        if (appointment.appointment_status === "cancelled") {
            return res.status(400).json({ message: "Appointment is already cancelled." });
        }
        if (appointment.isPaidToDoctor) {
            return res.status(400).json({ message: "Doctor has already been paid for this appointment. Cannot cancel and refund." });
        }

        // 2. Fetch patient to get userType
        const patient = await patientSchema.findById(appointment.patient_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        // 3. Retail flow
        if (patient.userType === "retail") {
            if (!appointment.payment_id || appointment.payment_status !== "confirmed") {
                return res.status(400).json({ message: "Refund cannot be processed. Payment is not confirmed or missing." });
            }

            const refund = await InitiateRefund(appointment.payment_id);

            appointment.appointment_status = "cancelled";
            appointment.payment_status = "refunded";
            appointment.refund_id = refund.id;
            appointment.cancellation_reason = "Cancelled by Admin";
            await appointment.save();

            // Send WhatsApp
            const doctor = await DoctorSchema.findById(appointment.doctor_id);
            if (appointment.patientPhoneNumber && doctor) {
                const formattedDate = new Date(appointment.DateOfAppointment).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric"
                });

                const payload = {
                    template_name: "payment_refund",
                    broadcast_name: "Doctor_Cancelled_Refund",
                    parameters: [
                        { name: "patient_name", value: appointment.patientName },
                        { name: "doctor_name", value: doctor.Name },
                        { name: "date", value: formattedDate },
                        { name: "time", value: appointment.AppStartTime }
                    ]
                };

                await fetch(`${WATI_API_URL}?whatsappNumber=91${appointment.patientPhoneNumber}`, {
                    method: "POST",
                    headers: {
                        "Authorization": WATI_API_KEY,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
            }

            return res.status(200).json({ message: "Retail appointment cancelled and refund initiated.", refund });
        }

        // 4. Corporate flow
        if (patient.userType === "corporate") {
            const corporate = await CorporateSchema.findOne({ companyCode: patient.companyCode });
            if (!corporate) {
                return res.status(404).json({ message: "Corporate record not found." });
            }

            corporate.totalCredits += 1;
            corporate.refundHistory.push({
                credits: 1,
                appointmentId: appointment._id,
                reason: "Appointment cancelled"
            });
            await corporate.save();

            appointment.appointment_status = "cancelled";
            appointment.cancellation_reason = "Cancelled by Admin";
            await appointment.save();

            const doctor = await DoctorSchema.findById(appointment.doctor_id);
            if (appointment.patientPhoneNumber && doctor) {
                const formattedDate = new Date(appointment.DateOfAppointment).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric"
                });

                const payload = {
                    template_name: "corporate_appointment_refund",
                    broadcast_name: "Doctor_Cancelled_Refund_Corporate",
                    parameters: [
                        { name: "patient_name", value: appointment.patientName },
                        { name: "emp_id", value: patient.empId },
                        { name: "doctor_name", value: doctor.Name },
                        { name: "date", value: formattedDate },
                        { name: "time", value: appointment.AppStartTime }
                    ]
                };

                await fetch(`${WATI_API_URL}?whatsappNumber=91${appointment.patientPhoneNumber}`, {
                    method: "POST",
                    headers: {
                        "Authorization": WATI_API_KEY,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
            }

            return res.status(200).json({ message: "Corporate appointment cancelled and credit restored." });
        }

        return res.status(400).json({ message: "Invalid user type." });

    } catch (error) {
        console.error("Cancellation/refund error:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

AppointmentRoute.post("/autoCancelUnstartedAppointments", async (req, res) => {
    try {
        const nowUTC = new Date();
        const nowIST = new Date(nowUTC.getTime() + 5.5 * 60 * 60 * 1000);

        const appointments = await AppointmentRecordsSchema.find({
            appointment_status: "scheduled",
            payment_status: "confirmed",
            session_started: false
        });

        const cancelled = [];

        for (const appt of appointments) {
            try {
                const appointmentDate = new Date(appt.DateOfAppointment);
                const [hours, minutes] = appt.AppStartTime.split(":").map(Number);
                appointmentDate.setHours(hours, minutes, 0, 0);

                const deadline = new Date(appointmentDate.getTime() + 20 * 60000);
                if (nowIST <= deadline) continue;

                // Skip if already refunded or paid
                if (appt.isPaidToDoctor || appt.payment_status === "refunded") continue;

                const patient = await patientSchema.findById(appt.patient_id);
                if (!patient) continue;

                const isCorporate = patient.userType === "corporate";

                if (isCorporate) {
                    const corporate = await CorporateSchema.findOne({ companyCode: patient.companyCode });
                    if (!corporate) continue;

                    corporate.totalCredits += 1;
                    corporate.refundHistory.push({
                        credits: 1,
                        appointmentId: appt._id,
                        reason: "Auto-cancelled: Doctor did not start session"
                    });
                    await corporate.save();

                    appt.appointment_status = "cancelled";
                    appt.payment_status = "refunded";
                    appt.cancellation_reason = "Auto-cancelled: Doctor did not start session";
                    await appt.save();

                    // WhatsApp - corporate refund
                    const doctor = await DoctorSchema.findById(appt.doctor_id);
                    const phone = appt.patientPhoneNumber;
                    if (phone && doctor) {
                        const formattedDate = new Date(appt.DateOfAppointment).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric"
                        });

                        await fetch(`${WATI_API_URL}?whatsappNumber=91${phone}`, {
                            method: "POST",
                            headers: {
                                Authorization: WATI_API_KEY,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                template_name: "corporate_appointment_refund",
                                broadcast_name: "AutoCancel_CorpRefund",
                                parameters: [
                                    { name: "patient_name", value: appt.patientName },
                                    { name: "emp_id", value: patient.empId || "NA" },
                                    { name: "doctor_name", value: doctor.Name },
                                    { name: "date", value: formattedDate },
                                    { name: "time", value: appt.AppStartTime }
                                ]
                            })
                        });
                    }

                    cancelled.push(appt._id);
                    continue; // ✅ Skip Razorpay logic
                }

                // Retail flow: Refund through Razorpay
                if (!appt.payment_id) continue;

                const refund = await InitiateRefund(appt.payment_id);

                appt.appointment_status = "cancelled";
                appt.payment_status = "refunded";
                appt.refund_id = refund.id;
                appt.cancellation_reason = "Auto-cancelled: Doctor did not start session";
                await appt.save();

                const doctor = await DoctorSchema.findById(appt.doctor_id);
                const phone = appt.patientPhoneNumber;
                if (phone && doctor) {
                    const formattedDate = new Date(appt.DateOfAppointment).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric"
                    });

                    await fetch(`${WATI_API_URL}?whatsappNumber=91${phone}`, {
                        method: "POST",
                        headers: {
                            Authorization: WATI_API_KEY,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            template_name: "payment_refund",
                            broadcast_name: "Auto_Cancelled_Refund",
                            parameters: [
                                { name: "patient_name", value: appt.patientName },
                                { name: "doctor_name", value: doctor.Name },
                                { name: "date", value: formattedDate },
                                { name: "time", value: appt.AppStartTime }
                            ]
                        })
                    });
                }

                cancelled.push(appt._id);

            } catch (err) {
                console.error(`❌ Failed to auto-cancel appointment ${appt._id}:`, err.message);
                // Optionally mark for manual handling
                appt.cancellation_reason = "Auto-cancel failed: " + err.message;
                await appt.save();
            }
        }

        res.status(200).json({
            message: "✅ Auto-cancel check completed.",
            totalChecked: appointments.length,
            cancelledAppointments: cancelled
        });

    } catch (error) {
        console.error("❌ Error in auto-cancel logic:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

AppointmentRoute.get("/appointments/latest/:mobile", async (req, res) => {
    try {
        const { mobile } = req.params;

        // Find the latest appointment for the given mobile number
        const latestAppointment = await AppointmentRecordsSchema.findOne({ mobile })
            .sort({ createdAt: -1 });

        if (!latestAppointment) {
            return res.status(404).json({ message: "No appointment found for this mobile number" });
        }

        res.json(latestAppointment);
    } catch (err) {
        console.error("Error fetching latest appointment:", err);
        res.status(500).json({ error: "Failed to fetch latest appointment" });
    }
});

AppointmentRoute.post("/bookRetailAppointmentMarketplace", async (req, res) => {
    try {
        const {
            doctor_id,
            schedule_id,
            slot_time,
            patient_id,
            isStudentBooking, // <-- NEW
            studentIdUrl
        } = req.body;

        console.log("Request Body ->", req.body);

        // Validate input
        if (!doctor_id || !schedule_id || !slot_time || !patient_id) {
            return res.status(400).json({ message: "Missing required fields." });
        }

        if (!mongoose.Types.ObjectId.isValid(schedule_id)) {
            return res.status(400).json({ message: "Invalid schedule_id format." });
        }

        // Get doctor & validate
        const doctor = await DoctorSchema.findById(doctor_id);
        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found." });
        }

        console.log("Student id url -> ", studentIdUrl);

        // Check patient exists
        const patient = await patientSchema.findById(patient_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        // Check & lock slot
        const schedule = await DoctorScheduleSchema.findById(schedule_id);
        if (!schedule || schedule.doctor_id.toString() !== doctor_id) {
            return res.status(404).json({ message: "Doctor schedule not found or mismatched." });
        }

        // Find & validate the slot
        console.log("Schedule ->", schedule);
        const selectedSlot = schedule.Slots.find(
            (s) => s.startTime === slot_time && s.isBooked === false
        );

        console.log("Selected slot ->", schedule);
        if (!selectedSlot) {
            return res.status(409).json({ message: "Selected slot already booked or invalid." });
        }

        // Calculate consultation fee with 18% GST
        const baseFee = schedule.pricePerSlot || 944;
        console.log("base fee ->", baseFee);
        let consultationFee = baseFee + Math.round(baseFee * 0.18); // Add GST

        // // Apply 50% student discount if applicable
        // if (doctor.consultsStudents && isStudentBooking === true) {
        //     consultationFee = Math.floor(consultationFee / 2);
        // }

        // Lock the slot
        selectedSlot.isBooked = true;
        selectedSlot.bookedBy = patient._id;
        schedule.SlotsAvailable -= 1;
        await schedule.save();

        // Create appointment in DB (pending payment)
        const appointment = await new AppointmentRecordsSchema({
            patient_id: patient._id,
            patientName: patient.Name,
            patientPhoneNumber: patient.Mobile,
            doctor_id,
            doctorScheduleId: schedule_id,
            DateOfAppointment: schedule.Date,
            WeekDay: schedule.WeekDay,
            AppStartTime: selectedSlot.startTime,
            AppEndTime: selectedSlot.endTime,
            appointment_status: "scheduled",
            payment_status: "pending",
            consultation_fee: consultationFee, // optional for record
            isStudentBooking: isStudentBooking || false,
            studentIdProofUrl: isStudentBooking ? studentIdUrl : undefined,
            appointment_fees: baseFee,
        }).save();

        // Generate payment link
        const paymentLink = await razorpay.paymentLink.create({
            amount: consultationFee * 100, // Razorpay needs amount in paise
            currency: "INR",
            accept_partial: false,
            description: "PsyCare Appointment",
            reference_id: `appointment_${appointment._id}`,
            notify: { sms: true },
            notes: {
                appointment_id: appointment._id.toString(),
                patient_id: patient._id.toString(),
            },
        });

        // Save paymentLink ID
        await AppointmentRecordsSchema.updateOne(
            { _id: appointment._id },
            { $set: { payment_link_id: paymentLink.id } }
        );

        // Send WhatsApp payment link
        const shortLinkCode = paymentLink.short_url.split("/").pop();
        if (patient.Mobile) {
            await fetch(`${WATI_API_URL}?whatsappNumber=91${patient.Mobile}`, {
                method: "POST",
                headers: {
                    Authorization: WATI_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    template_name: "payment_link",
                    broadcast_name: "PaymentLinkBroadcast",
                    parameters: [
                        { name: "1", value: patient.Name },
                        { name: "2", value: shortLinkCode },
                    ],
                }),
            });
        }

        return res.status(200).json({
            message: "Appointment booked. Awaiting payment.",
            appointmentId: appointment._id,
            paymentLink: paymentLink.short_url,
            doctorName: doctor?.Name,
        });
    } catch (err) {
        console.error("❌ Error booking retail appointment:", err);
        return res.status(500).json({ message: "Internal server error.", error: err.message });
    }
});

AppointmentRoute.get("/marketplace/getAvailableSlots/:doctorId", async (req, res) => {
    const { doctorId } = req.params;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // start of today

        const fifteenDaysLater = new Date();
        fifteenDaysLater.setDate(today.getDate() + 15);
        fifteenDaysLater.setHours(23, 59, 59, 999); // end of the 15th day

        const schedules = await DoctorScheduleSchema.find({
            doctor_id: doctorId,
            Date: { $gte: today, $lte: fifteenDaysLater },
            SlotsAvailable: { $gt: 0 },
        }).sort({ Date: 1 });

        const result = schedules.map(schedule => ({
            schedule_id: schedule._id,
            date: schedule.Date,
            weekday: schedule.WeekDay,
            pricePerSlot: schedule.pricePerSlot || null, // include price per day
            slots: schedule.Slots.filter(slot => !slot.isBooked),
        }));

        console.log("Slot details ->", result);

        return res.status(200).json({ availableSchedules: result });
    } catch (err) {
        console.error("❌ Error fetching slots:", err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
});

AppointmentRoute.get("/checkPaymentStatus/:appointmentId", async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await AppointmentRecordsSchema.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        return res.status(200).json({
            payment_status: appointment.payment_status,
            appointment_details: appointment
        });
    } catch (error) {
        console.error("Error checking payment status:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

AppointmentRoute.get("/marketplacedoctorsWithSlots", async (req, res) => {
    try {
        const { date, pricePerSlot } = req.query;

        if (!date) {
            return res.status(400).json({ error: "date is required" });
        }

        const [year, month, day] = date.split('-').map(Number);
        const targetDateStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const targetDateEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        const doctors = await DoctorSchema.find({ platformType: "marketplace" });

        const doctorsWithSlots = [];

        for (const doctor of doctors) {
            const scheduleQuery = {
                doctor_id: doctor._id,
                Date: { $gte: targetDateStart, $lte: targetDateEnd },
                SlotsAvailable: { $gt: 0 }
            };

            // ✅ Add price filter only if given
            if (pricePerSlot) {
                scheduleQuery.pricePerSlot = Number(pricePerSlot);
            }

            // console.log("Schedule query ->", scheduleQuery);

            const schedules = await DoctorScheduleSchema.find(scheduleQuery);

            const hasUnbookedSlots = schedules.some(schedule =>
                schedule.Slots.some(slot => !slot.isBooked)
            );

            if (hasUnbookedSlots) {
                doctorsWithSlots.push(doctor);
            }
        }

        res.status(200).json(doctorsWithSlots);
    } catch (err) {
        console.error("❌ Error in /marketplacedoctorsWithSlots:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

AppointmentRoute.post("/upload-student-id", upload.any(), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const file = req.files[0]; // Get the first uploaded file
        const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

        const result = await cloudinary.uploader.upload(base64Image, {
            folder: "student_id_cards",
            public_id: `student_${Date.now()}`,
            resource_type: "image",
        });

        console.log("Url -> ", result.secure_url);

        res.status(200).json({
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
        });
    } catch (err) {
        console.error("❌ Upload Error:", err);
        res.status(500).json({ error: "Upload failed. Please try again." });
    }
});

module.exports = AppointmentRoute;

