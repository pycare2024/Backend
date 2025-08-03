const express = require('express');
const WhatsappRoute = express.Router();
const DoctorSchema = require('../model/DoctorSchema');
const DoctorScheduleSchema = require('../model/DoctorScheduleSchema');

WhatsappRoute.get("/filteredDoctorsWithSlots", async (req, res) => {
    try {
        const { date, isStudent, gender, language, page = 1, limit = 3 } = req.query;

        if (!date) return res.status(400).json({ error: "date is required" });

        const [year, month, day] = date.split('-').map(Number);
        const targetDateStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const targetDateEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        const doctorFilters = { platformType: "marketplace" };

        if (gender && gender !== 'No Preference') doctorFilters.Gender = gender;
        if (isStudent) doctorFilters.consultsStudents = isStudent === 'true';
        if (language) {
            doctorFilters.languagesSpoken = { $elemMatch: { $regex: new RegExp(`^${language}$`, 'i') } };
        }

        // Fetch all doctors matching filters (no limit yet)
        const doctors = await DoctorSchema.find(doctorFilters);

        const doctorsWithSlots = [];

        for (const doctor of doctors) {
            const schedules = await DoctorScheduleSchema.find({
                doctor_id: doctor._id,
                Date: { $gte: targetDateStart, $lte: targetDateEnd },
                SlotsAvailable: { $gt: 0 }
            });

            const hasUnbookedSlots = schedules.some(schedule =>
                schedule.Slots.some(slot => !slot.isBooked)
            );

            if (hasUnbookedSlots) {
                doctorsWithSlots.push(doctor);
            }
        }

        // Shuffle Array Function
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        // After filtering doctorsWithSlots, shuffle it
        shuffleArray(doctorsWithSlots);

        // Apply Pagination AFTER shuffle
        const paginatedDoctors = doctorsWithSlots.slice((page - 1) * limit, page * limit);

        const sanitizedDoctors = paginatedDoctors.map(doctor => ({
            doctorId: doctor._id,
            name: doctor.Name,
            city: doctor.City,
            gender: doctor.Gender,
            photo: doctor.photo,
            qualification: doctor.Qualification,
            experienceYears: doctor.experienceYears,
            experienceMonths: doctor.experienceMonths,
            languagesSpoken: doctor.languagesSpoken,
            areaOfExpertise: doctor.areaOfExpertise
        }));

        res.status(200).json(sanitizedDoctors);

    } catch (err) {
        console.error("❌ Error in /whatsapp/filteredDoctorsWithSlots:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = WhatsappRoute;