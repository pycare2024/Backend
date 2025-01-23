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