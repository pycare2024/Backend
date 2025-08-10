const express = require('express');
const axios = require("axios");
const WhatsappRoute = express.Router();
const DoctorSchema = require('../model/DoctorSchema');
const DoctorScheduleSchema = require('../model/DoctorScheduleSchema');

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token

WhatsappRoute.get("/filteredDoctorsWithSlots", async (req, res) => {
    try {
        const { date, isStudent, gender, language, phoneNumber, page = 1, limit = 3 } = req.query;

        if (!date) return res.status(400).json({ error: "date is required" });
        if (!phoneNumber) return res.status(400).json({ error: "phoneNumber is required" });

        const [year, month, day] = date.split('-').map(Number);
        const targetDateStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const targetDateEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        const doctorFilters = { platformType: "marketplace" };

        if (gender && gender !== 'No Preference') doctorFilters.Gender = gender;
        if (isStudent) doctorFilters.consultsStudents = isStudent === 'true';
        if (language) {
            doctorFilters.languagesSpoken = { $elemMatch: { $regex: new RegExp(`^${language}$`, 'i') } };
        }

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

        // Shuffle
        for (let i = doctorsWithSlots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [doctorsWithSlots[i], doctorsWithSlots[j]] = [doctorsWithSlots[j], doctorsWithSlots[i]];
        }

        const paginatedDoctors = doctorsWithSlots.slice((page - 1) * limit, page * limit);

        if (paginatedDoctors.length < 3) {
            return res.status(200).json({ message: "Not enough doctors found" });
        }

        const docVars = paginatedDoctors.map(doc => ({
            name: doc.Name,
            exp: doc.experienceYears,
            id: doc._id
        }));

        // ✅ Send WhatsApp Template Message — MATCHING resetPassword structure
        const payload = {
            template_name: "lets_check_therapists", // must match WATI approved template name
            broadcast_name: "doctor_choices",
            parameters: [
                { name: "th1_name", value: docVars[0].name },
                { name: "th1_exp", value: docVars[0].exp.toString() },
                { name: "th1_link", value: "https://psy-care.in/#/marketplace/" + docVars[0].id.toString() },
                { name: "th2_name", value: docVars[1].name },
                { name: "th2_exp", value: docVars[1].exp.toString() },
                { name: "th2_link", value: "https://psy-care.in/#/marketplace/" + docVars[1].id.toString() },
                { name: "th3_name", value: docVars[2].name },
                { name: "th3_exp", value: docVars[2].exp.toString() },
                { name: "th3_link", value: "https://psy-care.in/#/marketplace/" + docVars[2].id.toString() },
            ]
        };

        const whatsappResponse = await fetch(
            `${WATI_API_URL}?whatsappNumber=${phoneNumber}`,
            {
                method: "POST",
                headers: {
                    "Authorization": WATI_API_KEY, // no Bearer
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        let data;
        const text = await whatsappResponse.text(); // get raw body first
        try {
            data = text ? JSON.parse(text) : null;
        } catch (parseErr) {
            data = { raw: text };
        }

        if (!whatsappResponse.ok) {
            console.log("Status:", whatsappResponse.status);
            console.log("Headers:", Object.fromEntries(whatsappResponse.headers));
            console.log("Raw text:", text);
            console.error("❌ Failed to send WhatsApp message:", data);
        } else {
            console.log("✅ WhatsApp message sent:", data);
        }

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

        res.status(200).json({ message: "Doctors sent via WhatsApp", doctors: sanitizedDoctors });

    } catch (err) {
        console.error("❌ Error in /filteredDoctorsWithSlots:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = WhatsappRoute;