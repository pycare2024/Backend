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
// Route to create a doctor schedule or return a message if already exists
DoctorScheduleRoute.post("/addSchedule", async (req, res) => {
    const { doctor_id, date, weekDay, slots } = req.body;

    try {
        // Validate input
        if (!doctor_id || !date || !weekDay || !slots || !Array.isArray(slots) || slots.length === 0) {
            return res.status(400).json({
                message: "Doctor ID, date, weekday, and slots array are required.",
            });
        }

        // Parse the date to ensure it's a valid date
        const parsedDate = new Date(date);
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }

        // Ensure the date is at UTC midnight (start of the day)
        const appointmentDate = new Date(parsedDate.setUTCHours(0, 0, 0, 0));

        // Check if a schedule already exists for the doctor on the same date
        const existingSchedule = await DoctorScheduleSchema.findOne({
            doctor_id,
            Date: appointmentDate,
            WeekDay: weekDay,
        });

        if (existingSchedule) {
            return res.status(400).json({
                message: "Schedule already exists for this doctor on the selected date.",
            });
        }

        // Create a new schedule for the doctor
        const newSchedule = new DoctorScheduleSchema({
            doctor_id,
            Date: appointmentDate,
            WeekDay: weekDay,
            SlotsAvailable: slots.length, // Total number of slots
            Slots: slots, // Store the slots array
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

// Route to modify an existing doctor schedule, including slots
DoctorScheduleRoute.put("/updateSchedule/:id", async (req, res) => {
    const { id } = req.params;
    const { date, weekDay, slots } = req.body; // Make sure 'slots' is lowercase

    try {
        const schedule = await DoctorScheduleSchema.findById(id);
        if (!schedule) {
            return res.status(404).json({ message: "Doctor schedule not found." });
        }

        if (date) {
            const parsedDate = new Date(date);
            if (isNaN(parsedDate)) {
                return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
            }
            schedule.Date = new Date(parsedDate.setUTCHours(0, 0, 0, 0));
        }

        if (weekDay) schedule.WeekDay = weekDay;

        // Update only non-booked slots
        if (slots && Array.isArray(slots)) {
            schedule.Slots = schedule.Slots.map(existingSlot => {
                if (!existingSlot.isBooked) {
                    const updatedSlot = slots.find(s => s._id.toString() === existingSlot._id.toString());
                    if (updatedSlot) {
                        existingSlot.startTime = updatedSlot.startTime;
                        existingSlot.endTime = updatedSlot.endTime;
                    }
                }
                return existingSlot;
            });
        }

        // Recalculate SlotsAvailable
        schedule.SlotsAvailable = schedule.Slots.filter(slot => !slot.isBooked).length;

        // Save changes
        const updatedSchedule = await schedule.save();

        res.status(200).json({
            message: "Doctor schedule updated successfully.",
            data: updatedSchedule
        });

    } catch (error) {
        console.error("Error updating doctor schedule:", error);
        res.status(500).json({ message: "Error updating doctor schedule.", error: error.message });
    }
});

DoctorScheduleRoute.get("/doctorSchedules/:doctor_id/:date", async (req, res) => {
    const { doctor_id, date } = req.params;
    try {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }

        const schedule = await DoctorScheduleSchema.findOne({
            doctor_id,
            Date: new Date(parsedDate.setUTCHours(0, 0, 0, 0)),
        });

        if (!schedule) {
            return res.status(404).json({
                message: "No schedule found for this doctor on the selected date.",
                slots: []
            });
        }

        // Check if slots are empty and return appropriate message
        if (!schedule.Slots || schedule.Slots.length === 0) {
            return res.status(200).json({
                message: "Schedule found, but no slots available.",
                scheduleId: schedule._id,
                slots: []
            });
        }

        res.status(200).json({
            message: "Doctor schedules retrieved successfully.",
            scheduleId: schedule._id,
            slots: schedule.Slots // Return slots if available
        });
    } catch (error) {
        console.error("Error fetching schedule:", error);
        res.status(500).json({ message: "Error fetching schedule.", error: error.message });
    }
});

DoctorScheduleRoute.delete("/deleteSlot/:scheduleId/:slotId", async (req, res) => {
    const { scheduleId, slotId } = req.params;

    try {
        // Fetch the schedule before updating
        const schedule = await DoctorScheduleSchema.findById(scheduleId);
        if (!schedule) return res.status(404).json({ message: "Schedule not found" });

        // Ensure slot exists before attempting deletion
        const slotExists = schedule.Slots.some(slot => slot._id.toString() === slotId);
        if (!slotExists) return res.status(404).json({ message: "Slot not found." });

        // Remove the slot
        const updatedSchedule = await DoctorScheduleSchema.findOneAndUpdate(
            { _id: scheduleId },
            { $pull: { Slots: { _id: slotId } } },
            { new: true }
        );

        if (!updatedSchedule) {
            return res.status(500).json({ message: "Slot deletion failed." });
        }

        // Recalculate SlotsAvailable based on updated Slots length
        updatedSchedule.SlotsAvailable = updatedSchedule.Slots.length;
        await updatedSchedule.save(); // Save the updated count

        res.status(200).json({ message: "Slot deleted successfully.", updatedSchedule });
    } catch (error) {
        console.error("Error deleting slot:", error);
        res.status(500).json({ message: "Error deleting slot.", error: error.message });
    }
});


module.exports = DoctorScheduleRoute;