const express = require("express");
const mongoose = require("mongoose");
const AppointmentRoute = express.Router();
const DoctorScheduleSchema = require("../model/DoctorScheduleSchema");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");
const DoctorSchema = require("../model/DoctorSchema");

AppointmentRoute.get("/appointments", (req, res) => {
    AppointmentRecordsSchema.find((err, data) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch Appointment Records" });
        }
        res.json(data);
    });
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

AppointmentRoute.post('/bookAppointment', async (req, res) => {
    try {
        const { selectedDate, patient_id } = req.body;

        // Validate input
        if (!selectedDate || !patient_id) {
            return res.status(400).json({ message: "Date and Patient ID are required." });
        }

        if (!mongoose.Types.ObjectId.isValid(patient_id)) {
            return res.status(400).json({ message: "Invalid Patient ID." });
        }

        // Parse the selected date
        const date = new Date(selectedDate);
        if (isNaN(date)) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }

        // Ensure date is at UTC midnight
        const appointmentDate = new Date(date.setUTCHours(0, 0, 0, 0));

        // Check if an appointment already exists for the patient on the selected date
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

        // Fetch the last assigned doctor for this date
        let lastAssignment = await DoctorsAssignmentPrioritySchema.findOne({ Date: appointmentDate });

        // Get all available doctors sorted by doctor_id
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
            // First appointment for this date, assign the first available doctor
            selectedDoctor = availableDoctors[0];

            // Create a new entry in DoctorsAssignmentPriority
            await DoctorsAssignmentPrioritySchema.create({
                Date: appointmentDate,
                LastDoctorAssigned: selectedDoctor.doctor_id
            });

        } else {
            // Find the next doctor in round-robin order
            const lastAssignedDoctorIndex = availableDoctors.findIndex(doc => doc.doctor_id.toString() === lastAssignment.LastDoctorAssigned.toString());

            if (lastAssignedDoctorIndex === -1 || lastAssignedDoctorIndex === availableDoctors.length - 1) {
                // If last assigned doctor is not in the list or it's the last doctor, select the first doctor
                selectedDoctor = availableDoctors[0];
            } else {
                // Select the next doctor in the list
                selectedDoctor = availableDoctors[lastAssignedDoctorIndex + 1];
            }

            // Update the DoctorsAssignmentPriority table
            await DoctorsAssignmentPrioritySchema.updateOne(
                { Date: appointmentDate },
                { $set: { LastDoctorAssigned: selectedDoctor.doctor_id } }
            );
        }

        // Book the appointment and update doctor's schedule
        await DoctorScheduleSchema.updateOne(
            { _id: selectedDoctor._id },
            { $inc: { SlotsAvailable: -1 } }
        );

        // Create a new appointment record
        const appointment = await AppointmentRecordsSchema.create({
            patient_id,
            doctor_id: selectedDoctor.doctor_id,
            DateOfAppointment: appointmentDate,
            WeekDay: selectedDoctor.WeekDay,
        });

        return res.status(200).json({
            message: "Appointment successfully booked.",
            doctorId: selectedDoctor.doctor_id,
            remainingSlots: selectedDoctor.SlotsAvailable - 1, // Since we just decremented
            appointmentDetails: appointment,
        });

    } catch (error) {
        console.error("Error booking appointment:", error);
        return res.status(500).json({
            message: "An error occurred while booking the appointment. Please try again later.",
            error: error.message,
        });
    }
});


module.exports = AppointmentRoute;