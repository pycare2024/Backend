const express = require("express");
const AppointmentRoute = express.Router();
const DoctorScheduleSchema = require("../model/DoctorScheduleSchema");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

AppointmentRoute.get("/appointments",(req,res)=>{
    AppointmentRecordsSchema.find((err,data)=>{
        if(err)
            {
                return res.status(500).json({error:"Failed to fetch Appointment Records"});
            }
            res.json(data);
    });
});

AppointmentRoute.get("/doctorSchedule",(req,res)=>{
    DoctorScheduleSchema.find((err,data)=>{
        if(err)
            {
                return res.status(500).json({error:"Failed to fetch Doctors schedule"});
            }
            res.json(data);
    });
});

// Route for booking appointment
AppointmentRoute.post("/bookAppointment", async (req, res) => {
    const { patient_id, selectedDate } = req.body;

    if (!patient_id || !selectedDate) {
        return res.status(400).json({ error: "Patient ID and date are required" });
    }

    try {
        // Parse the selectedDate to ensure it's in UTC with time set to 00:00:00
        const selectedDateObj = new Date(selectedDate + "T00:00:00Z");

        // Set up the range for the selected date
        const startOfDay = new Date(selectedDateObj);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDateObj);
        endOfDay.setHours(23, 59, 59, 999);

        // Find doctors with available slots for the selected date
        const doctorsSchedule = await DoctorScheduleSchema.find({
            Date: { $gte: startOfDay, $lt: endOfDay },
            SlotsAvailable: { $gt: 0 } // Find doctors with available slots
        });

        if (doctorsSchedule.length === 0) {
            return res.status(404).json({
                message: "No appointments are available for the selected date. Please try another date."
            });
        }

        // Book appointment with the first available doctor
        const doctorToBook = doctorsSchedule[0]; // Select the first doctor with available slots

        // Create appointment record
        const newAppointment = new AppointmentRecordsSchema({
            patient_id,
            doctor_id: doctorToBook.doctor_id,
            DateOfAppointment: selectedDate
        });

        // Save the appointment
        await newAppointment.save();

        // Decrease the available slots for the doctor
        await DoctorScheduleSchema.updateOne(
            { _id: doctorToBook._id },
            { $inc: { SlotsAvailable: -1 } } // Decrease SlotsAvailable by 1
        );

        // Send success response
        return res.status(201).json({
            message: `Great! Your appointment is booked with Dr. ${doctorToBook.doctor_id}`
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error booking appointment. Please try again." });
    }
});


module.exports = AppointmentRoute;