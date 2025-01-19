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
router.post("/bookAppointment", async (req, res) => {
    const { date, patientId } = req.body;

    if (!date || !patientId) {
        return res.status(400).json({ message: "Date and patient ID are required." });
    }

    try {
        // Convert date to start and end of the day for querying
        const appointmentDate = new Date(date);
        const startOfDay = new Date(appointmentDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(appointmentDate.setHours(23, 59, 59, 999));

        // Find the first doctor with available slots for the given date
        const doctorSchedule = await DoctorSchedule.findOne({
            Date: { $gte: startOfDay, $lte: endOfDay },
            SlotsAvailable: { $gt: 0 }
        });

        if (!doctorSchedule) {
            return res.status(404).json({
                message: "No doctors are available for the selected date. Please choose another date."
            });
        }

        // Reduce available slots and update the schedule
        const updatedSlots = doctorSchedule.SlotsAvailable - 1;
        await DoctorSchedule.updateOne(
            { _id: doctorSchedule._id },
            { SlotsAvailable: updatedSlots }
        );

        // Create a new appointment record
        const newAppointment = new AppointmentRecords({
            patient_id: mongoose.Types.ObjectId(patientId),
            doctor_id: doctorSchedule.doctor_id,
            DateOfAppointment: startOfDay
        });

        await newAppointment.save();

        return res.status(200).json({
            message: `Appointment successfully booked with Doctor ID ${doctorSchedule.doctor_id} on ${startOfDay.toDateString()}.`
        });
    } catch (error) {
        console.error("Error booking appointment:", error);
        return res.status(500).json({
            message: "An error occurred while booking the appointment. Please try again later."
        });
    }
});


module.exports = AppointmentRoute;