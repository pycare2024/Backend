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
        console.log('Request Body:', req.body);

        const { selectedDate, patient_id } = req.body;

        // Validate input
        if (!selectedDate || !patient_id) {
            return res.status(400).json({ message: 'Date and patient ID are required.' });
        }

        // Validate patient_id as a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(patient_id)) {
            return res.status(400).json({ message: 'Invalid patient ID.' });
        }

        // Parse and validate the selectedDate
        const date = new Date(selectedDate);
        if (isNaN(date)) {
            return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
        }

        // Convert the selectedDate into a UTC day range
        const startOfDay = new Date(selectedDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        console.log('Query Start of Day (UTC):', startOfDay.toISOString());
        console.log('Query End of Day (UTC):', endOfDay.toISOString());

        // Find a doctor schedule for the given date with available slots
        const doctorSchedule = await DoctorScheduleSchema.findOne({
            Date: { $gte: startOfDay, $lt: endOfDay },
            SlotsAvailable: { $gt: 0 },
        });

        if (!doctorSchedule) {
            return res.status(404).json({
                message: 'No doctors available on the selected date. Please choose another date.',
                startOfDay,
                endOfDay,
                doctorSchedule,
            });
        }

        console.log('Doctor Schedule Found:', doctorSchedule);

        // Decrement the available slots
        const updatedSlots = parseInt(doctorSchedule.SlotsAvailable, 10) - 1;

        // Update the doctor's schedule in the database
        await DoctorScheduleSchema.updateOne(
            { _id: doctorSchedule._id },
            { SlotsAvailable: updatedSlots.toString() }
        );

        // Create a new appointment record
        await AppointmentRecordsSchema.create({
            patient_id,
            doctor_id: doctorSchedule.doctor_id,
            DateOfAppointment: startOfDay,
        });

        // Respond with success
        return res.status(200).json({
            message: 'Appointment successfully booked.',
            doctorId: doctorSchedule.doctor_id,
            remainingSlots: updatedSlots,
        });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            message: 'An error occurred while booking the appointment. Please try again later.',
        });
    }
});


module.exports = AppointmentRoute;