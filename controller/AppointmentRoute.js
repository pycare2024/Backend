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
AppointmentRoute.post('/bookAppointment', async (req, res) => {
    try {
        console.log('Request Body:', req.body); // Debug the request body

        const { selectedDate, patient_id } = req.body;

        if (!selectedDate || !patient_id) {
            return res.status(400).json({ message: 'Date and patient ID are required.' });
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(patient_id)) {
            return res.status(400).json({ message: 'Invalid patient ID.' });
        }

        const date = new Date(selectedDate);
        if (isNaN(date)) {
            return res.status(400).json({ message: 'Invalid date format.' });
        }

        // Find doctor with available slots
        const doctorSchedule = await DoctorScheduleSchema.findOne({
            Date: date,
            SlotsAvailable: { $gt: 0 },
        });

        if (!doctorSchedule) {
            return res.status(404).json({
                message: 'No doctors available on the selected date. Please choose another date.',
            });
        }

        // Decrement slots and book appointment
        const updatedSlots = parseInt(doctorSchedule.SlotsAvailable) - 1;
        await DoctorScheduleSchema.updateOne(
            { _id: doctorSchedule._id },
            { SlotsAvailable: updatedSlots.toString() }
        );

        await AppointmentRecordsSchema.create({
            patient_id,
            doctor_id: doctorSchedule.doctor_id,
            DateOfAppointment: date,
        });

        return res.status(200).json({
            message: 'Appointment successfully booked.',
            doctorId: doctorSchedule.doctor_id,
        });
    } catch (error) {
        console.error('Error:', error); // Log error details
        return res.status(500).json({
            message: 'An error occurred while booking the appointment. Please try again later.',
        });
    }
});


module.exports = AppointmentRoute;