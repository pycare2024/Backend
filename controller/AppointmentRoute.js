const express = require("express");
const mongoose = require("mongoose");
const AppointmentRoute = express.Router();
const DoctorScheduleSchema = require("../model/DoctorScheduleSchema");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

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
        // Fetch all unique available dates and weekdays where slots are available
        const availableDates = await DoctorScheduleSchema.aggregate([
            {
                $match: {
                    SlotsAvailable: { $gt: 0 },
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
                    _id: "$Date",
                    WeekDay: { $first: "$WeekDay" },
                },
            },
            {
                $sort: { "_id": 1 }, // Optional: Sort by date if needed
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

        // Find and update doctor schedule atomically
        const doctorSchedule = await DoctorScheduleSchema.findOneAndUpdate(
            { Date: appointmentDate, SlotsAvailable: { $gt: 0 } }, // Match exact date and slots available
            { $inc: { SlotsAvailable: -1 } }, // Decrement slots atomically
            { new: true } // Return the updated document
        );

        // If no doctor schedule is found
        if (!doctorSchedule) {
            return res.status(404).json({
                message: "No doctors available on the selected date. Please choose another date.",
                selectedDate: appointmentDate,
            });
        }

        // Create a new appointment record
        const appointment = await AppointmentRecordsSchema.create({
            patient_id,
            doctor_id: doctorSchedule.doctor_id,
            DateOfAppointment: appointmentDate,
            WeekDay: doctorSchedule.WeekDay,
        });

        // Return success response
        return res.status(200).json({
            message: "Appointment successfully booked.",
            doctorId: doctorSchedule.doctor_id,
            remainingSlots: doctorSchedule.SlotsAvailable,
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