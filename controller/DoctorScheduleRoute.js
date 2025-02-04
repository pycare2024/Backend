const express = require("express");
const mongoose = require("mongoose");
const DoctorScheduleSchema = require("../model/DoctorScheduleSchema");
const DoctorSchema = require("../model/DoctorSchema");

const DoctorScheduleRoute = express.Router();

// Route to get all doctor schedules
DoctorScheduleRoute.get("/doctorSchedules", async (req, res) => {
    try {
        const schedules = await DoctorScheduleSchema.find();
        res.status(200).json({
            message: "Doctor schedules fetched successfully.",
            data: schedules,
        });
    } catch (error) {
        console.error("Error fetching doctor schedules:", error);
        res.status(500).json({
            message: "Error fetching doctor schedules.",
            error: error.message,
        });
    }
});

// Route to create a doctor schedule or return message if already exists
DoctorScheduleRoute.post("/addSchedule", async (req, res) => {
    const { doctor_id, date, slotsAvailable, weekDay } = req.body;

    try {
        // Validate input
        if (!doctor_id || !date || !slotsAvailable || !weekDay) {
            return res.status(400).json({
                message: "Doctor ID, date, slots available, and weekday are required.",
            });
        }

        // Parse the date to ensure it's a valid date
        const parsedDate = new Date(date);
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }

        // Ensure the date is at UTC midnight (start of the day)
        const appointmentDate = new Date(parsedDate.setUTCHours(0, 0, 0, 0));

        // Check if a schedule already exists for the doctor on the same date and weekday
        const existingSchedule = await DoctorScheduleSchema.findOne({
            doctor_id,
            Date: appointmentDate,  // Use 'Date' as defined in the schema
            WeekDay: weekDay,       // Use 'WeekDay' as defined in the schema
        });

        if (existingSchedule) {
            return res.status(400).json({
                message: "Schedule already exists for this doctor on the selected day.",
            });
        }

        // Create a new schedule for the doctor
        const newSchedule = new DoctorScheduleSchema({
            doctor_id,
            Date: appointmentDate,       // Use 'Date' as defined in the schema
            SlotsAvailable: slotsAvailable,
            WeekDay: weekDay,            // Use 'WeekDay' as defined in the schema
        });

        await newSchedule.save();

        res.status(201).json({
            message: "Schedule created successfully.",
            data: newSchedule,
        });
    } catch (error) {
        console.error("Error adding doctor schedule:", error);
        res.status(500).json({
            message: "Error adding doctor schedule.",
            error: error.message,
        });
    }
});

module.exports = DoctorScheduleRoute;