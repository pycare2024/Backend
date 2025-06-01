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

        const availableDoctors = await DoctorScheduleSchema.find({
            Date: appointmentDate,
            SlotsAvailable: { $gt: 0 },
            "Slots.isBooked": false,
            ...timeFilter,
        }).sort({ doctor_id: 1 });

        if (!availableDoctors.length) return res.status(404).json({ message: "Unfortunately, no doctors are available at the selected time. Please try another time slot or date." });

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

        const lastAssignment = await DoctorsAssignmentPrioritySchema.findOne({ Date: appointmentDate });
        let selectedDoctor;
        if (!lastAssignment) {
            selectedDoctor = doctorsWithEarliest[0];
            await DoctorsAssignmentPrioritySchema.create({
                Date: appointmentDate,
                LastDoctorAssigned: selectedDoctor.doctor_id,
            });
        } else {
            const idx = doctorsWithEarliest.findIndex(doc =>
                doc.doctor_id.toString() === lastAssignment.LastDoctorAssigned.toString()
            );
            selectedDoctor =
                idx === -1 || idx === doctorsWithEarliest.length - 1
                    ? doctorsWithEarliest[0]
                    : doctorsWithEarliest[idx + 1];
            await DoctorsAssignmentPrioritySchema.updateOne(
                { Date: appointmentDate },
                { $set: { LastDoctorAssigned: selectedDoctor.doctor_id } }
            );
        }

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
            payment_status: userType === "corporate" ? "confirmed" : "pending",
            userType,
            empId: userType === "corporate" ? empId : undefined,
            companyCode: userType === "corporate" ? companyCode : undefined,
        };

        const doctor = await DoctorSchema.findById(selectedDoctor.doctor_id);
        const patientName = patient.Name;
        const phone = patient.Mobile;
        const DofAppt = appointmentData.DateOfAppointment.toDateString();
        const apptTime = appointmentData.AppStartTime;
        const DoctorName = doctor?.Name || "Doctor";
        const DoctorPhNo = doctor?.Mobile || "12345";
        const clinicName = "PsyCare";

        // console.log("Doctor mobile Number->",DoctorPhNo);

        if (userType === "corporate") {
            console.log("Corporate booking detected");

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
                    _id: selectedDoctor._id,
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
                            purpose: "Appointment"  // or save from frontend if dynamic
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
                        broadcast_name: "CorporateAppointmentConfirm",
                        parameters: [
                            { name: "name", value: patientName },
                            { name: "appointment_date", value: DofAppt },
                            { name: "appointment_time", value: apptTime },
                            { name: "doctor_name", value: DoctorName },
                            { name: "clinic_name", value: clinicName },
                            { name: "payment_id", value: "Corporate Package" },
                            {
                                name: "link",
                                value: "Your appointment has been confirmed and covered under your company’s package. No payment is required. ✅"
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
                message: `Appointment booked successfully (corporate). Remaining credits: ${company.totalCredits}`,
                appointmentDetails: appointmentData,
                doctorName: doctor?.Name,
                remainingCredits: company.totalCredits
            });
        }

        // RETAIL flow
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
            message: "Appointment booked (retail, pending payment).",
            appointmentDetails: savedAppointment,
            doctorName: doctor?.Name,
            paymentLink: paymentLinkResponse.short_url,
        });

    } catch (err) {
        console.error("Error booking appointment:", err);
        return res.status(500).json({ message: "Booking failed.", error: err.message });
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
        const amount = 500;

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
        const amount = 500; // fixed or dynamic

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
            const appointmentDate = new Date(appt.DateOfAppointment);
            const [hours, minutes] = appt.AppStartTime.split(":").map(Number);
            appointmentDate.setHours(hours, minutes, 0, 0);

            const deadline = new Date(appointmentDate.getTime() + 20 * 60000);

            if (nowIST > deadline) {
                try {
                    const refund = await InitiateRefund(appt.payment_id);

                    appt.appointment_status = "cancelled";
                    appt.payment_status = "refunded";
                    appt.refund_id = refund.id;
                    appt.cancellation_reason = "Auto-cancelled: Doctor did not start session";
                    await appt.save();

                    // ✅ Send WhatsApp refund message
                    const patientPhone = appt.patientPhoneNumber;
                    const patientName = appt.patientName;
                    const doctor = await DoctorSchema.findById(appt.doctor_id);

                    if (patientPhone && doctor) {
                        const formattedDate = new Date(appt.DateOfAppointment).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                        });

                        const payload = {
                            template_name: "payment_refund",
                            broadcast_name: "Auto_Cancelled_Refund",
                            parameters: [
                                { name: "patient_name", value: patientName },
                                { name: "doctor_name", value: doctor.Name },
                                { name: "date", value: formattedDate },
                                { name: "time", value: appt.AppStartTime }
                            ]
                        };

                        const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${patientPhone}`, {
                            method: "POST",
                            headers: {
                                "Authorization": WATI_API_KEY,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(payload)
                        });

                        const data = await whatsappResponse.json();
                        if (!whatsappResponse.ok) {
                            console.error("❌ Failed to send WhatsApp message:", data);
                        }
                    }

                    cancelled.push(appt._id);
                } catch (err) {
                    console.error(`❌ Refund failed for appointment ${appt._id}`, err.message);
                }
            }
        }

        res.status(200).json({
            message: `✅ Auto-cancel check completed.`,
            totalChecked: appointments.length,
            cancelledAppointments: cancelled
        });

    } catch (error) {
        console.error("❌ Error in auto-cancel logic:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = AppointmentRoute;

