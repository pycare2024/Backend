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
        const startOfDay = new Date(selectedDate).setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate).setHours(23, 59, 59, 999);

        const doctorsSchedule = await DoctorScheduleSchema.find({
            Date: { $gte: startOfDay, $lte: endOfDay },
            SlotsAvailable: { $gt: 0 },
        });

        if (doctorsSchedule.length === 0) {
            const alternativeDates = await DoctorScheduleSchema.find({
                SlotsAvailable: { $gt: 0 },
            }).limit(3).select("Date");

            return res.status(404).json({
                message: "No appointments are available for the selected date. Here are some alternative dates:",
                alternativeDates: alternativeDates.map(d => d.Date),
            });
        }

        const doctorToBook = doctorsSchedule[0];

        const newAppointment = new AppointmentRecordsSchema({
            patient_id,
            doctor_id: doctorToBook.doctor_id,
            DateOfAppointment: selectedDate,
        });

        await newAppointment.save();

        doctorToBook.SlotsAvailable -= 1;
        await doctorToBook.save();

        return res.status(201).json({
            message: `Great! Your appointment is booked with Dr. ${doctorToBook.doctor_id}`,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error booking appointment. Please try again." });
    }
});


module.exports = AppointmentRoute;