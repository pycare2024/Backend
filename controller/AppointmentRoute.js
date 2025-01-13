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
        // Parse the selectedDate and reset time part to 00:00:00
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0); // Set time to 00:00:00 for comparison

        // Find doctors with available slots for the selected date
        const doctorsSchedule = await DoctorScheduleSchema.find({
            Date: selectedDateObj,
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
        doctorToBook.SlotsAvailable -= 1;
        await doctorToBook.save();

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