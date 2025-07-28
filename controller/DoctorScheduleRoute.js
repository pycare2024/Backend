const express = require("express");
const mongoose = require("mongoose");
const DoctorScheduleSchema = require("../model/DoctorScheduleSchema");
const DoctorSchema = require("../model/DoctorSchema");

const DoctorScheduleRoute = express.Router();

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token

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


DoctorScheduleRoute.post("/addSchedule", async (req, res) => {
    const { doctor_id, date, weekDay, slots, pricePerSlot } = req.body;

    console.log("Req body -> ",req.body);

    try {
        // Validation
        if (!doctor_id || !date || !weekDay || !slots || !Array.isArray(slots) || slots.length === 0 || typeof pricePerSlot !== 'number') {
            return res.status(400).json({
                message: "Doctor ID, date, weekday, slots, and pricePerSlot are required.",
            });
        }

        if (pricePerSlot <= 0) {
            return res.status(400).json({ message: "Price per slot must be a positive number." });
        }

        const parsedDate = new Date(date);
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }

        const appointmentDate = new Date(parsedDate.setUTCHours(0, 0, 0, 0));

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

        const newSchedule = new DoctorScheduleSchema({
            doctor_id,
            Date: appointmentDate,
            WeekDay: weekDay,
            SlotsAvailable: slots.length,
            pricePerSlot, // ✅ NEW FIELD
            Slots: slots,
        });

        await newSchedule.save();

        const formattedSlots = slots
            .map(slot => `• ${slot.startTime} - ${slot.endTime}`)
            .join(', ');


        // Format date range (if you're sending multiple days, update logic accordingly)
        const formattedDate = new Date(appointmentDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });




        const doctor = await DoctorSchema.findById(doctor_id);

        // console.log("Name->", doctor.Name);
        // console.log("Mobile->", doctor.Mobile);
        // console.log("Date->", formattedDate);
        // console.log("Raw Slots->", slots);
        // console.log("Slots->", formattedSlots);

        if (!doctor || !doctor.Mobile) {
            console.warn("Doctor not found or missing phone number. Skipping WhatsApp message.");
        } else {
            const whatsappPayload = {
                template_name: "doctor_schedule_notification",
                broadcast_name: "Doctor_Schedule_Notification",
                parameters: [
                    { name: "doctor_name", value: doctor.Name },
                    { name: "date_range", value: formattedDate },
                    { name: "slot_list", value: formattedSlots }
                ]
            };

            try {
                const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${doctor.Mobile}`, {
                    method: "POST",
                    headers: {
                        "Authorization": WATI_API_KEY,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(whatsappPayload)
                });

                const responseData = await whatsappResponse.json();
                console.log("Response Data->", responseData);

                if (!whatsappResponse.ok) {
                    console.error("❌ Failed to send WhatsApp message to doctor:", responseData);
                } else {
                    console.log("✅ WhatsApp notification sent to doctor.");
                }
            } catch (err) {
                console.error("❌ Error sending WhatsApp message:", err.message);
            }
        }
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

// DoctorScheduleRoute.post("/addSchedule", async (req, res) => {
//     const { doctor_id, date, weekDay, slots } = req.body;

//     try {
//         // Validate input
//         if (!doctor_id || !date || !weekDay || !slots || !Array.isArray(slots) || slots.length === 0) {
//             return res.status(400).json({
//                 message: "Doctor ID, date, weekday, and slots array are required.",
//             });
//         }

//         // Parse the date to ensure it's a valid date
//         const parsedDate = new Date(date);
//         if (isNaN(parsedDate)) {
//             return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
//         }

//         // Ensure the date is at UTC midnight (start of the day)
//         const appointmentDate = new Date(parsedDate.setUTCHours(0, 0, 0, 0));

//         // Check if a schedule already exists for the doctor on the same date
//         const existingSchedule = await DoctorScheduleSchema.findOne({
//             doctor_id,
//             Date: appointmentDate,
//             WeekDay: weekDay,
//         });

//         if (existingSchedule) {
//             return res.status(400).json({
//                 message: "Schedule already exists for this doctor on the selected date.",
//             });
//         }

//         // Create a new schedule for the doctor
//         const newSchedule = new DoctorScheduleSchema({
//             doctor_id,
//             Date: appointmentDate,
//             WeekDay: weekDay,
//             SlotsAvailable: slots.length, // Total number of slots
//             Slots: slots, // Store the slots array
//         });

//         await newSchedule.save();

//         const formattedSlots = slots
//             .map(slot => `• ${slot.startTime} - ${slot.endTime}`)
//             .join(', ');


//         // Format date range (if you're sending multiple days, update logic accordingly)
//         const formattedDate = new Date(appointmentDate).toLocaleDateString("en-IN", {
//             day: "2-digit",
//             month: "short",
//             year: "numeric"
//         });




//         const doctor = await DoctorSchema.findById(doctor_id);

//         // console.log("Name->", doctor.Name);
//         // console.log("Mobile->", doctor.Mobile);
//         // console.log("Date->", formattedDate);
//         // console.log("Raw Slots->", slots);
//         // console.log("Slots->", formattedSlots);

//         if (!doctor || !doctor.Mobile) {
//             console.warn("Doctor not found or missing phone number. Skipping WhatsApp message.");
//         } else {
//             const whatsappPayload = {
//                 template_name: "doctor_schedule_notification",
//                 broadcast_name: "Doctor_Schedule_Notification",
//                 parameters: [
//                     { name: "doctor_name", value: doctor.Name },
//                     { name: "date_range", value: formattedDate },
//                     { name: "slot_list", value: formattedSlots }
//                 ]
//             };

//             try {
//                 const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${doctor.Mobile}`, {
//                     method: "POST",
//                     headers: {
//                         "Authorization": WATI_API_KEY,
//                         "Content-Type": "application/json"
//                     },
//                     body: JSON.stringify(whatsappPayload)
//                 });

//                 const responseData = await whatsappResponse.json();
//                 console.log("Response Data->", responseData);

//                 if (!whatsappResponse.ok) {
//                     console.error("❌ Failed to send WhatsApp message to doctor:", responseData);
//                 } else {
//                     console.log("✅ WhatsApp notification sent to doctor.");
//                 }
//             } catch (err) {
//                 console.error("❌ Error sending WhatsApp message:", err.message);
//             }
//         }

//         res.status(201).json({
//             message: "Schedule created successfully.",
//             data: newSchedule,
//         });
//     } catch (error) {
//         console.error("Error adding doctor schedule:", error);
//         res.status(500).json({
//             message: "Error adding doctor schedule.",
//             error: error.message,
//         });
//     }
// });

// Route to modify an existing doctor schedule, including slots
DoctorScheduleRoute.put("/updateSchedule/:id", async (req, res) => {
    const { id } = req.params;
    const { date, weekDay, slots, pricePerDay } = req.body;

    try {
        const schedule = await DoctorScheduleSchema.findById(id);
        if (!schedule) {
            return res.status(404).json({ message: "Doctor schedule not found." });
        }

        // Update date if provided and valid
        if (date) {
            const parsedDate = new Date(date);
            if (isNaN(parsedDate)) {
                return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
            }
            schedule.Date = new Date(parsedDate.setUTCHours(0, 0, 0, 0));
        }

        // Update weekday if provided
        if (weekDay) {
            schedule.WeekDay = weekDay;
        }

        // Update slots if provided (only if not booked)
        if (slots && Array.isArray(slots)) {
            schedule.Slots = schedule.Slots.map(existingSlot => {
                if (!existingSlot.isBooked) {
                    const updatedSlot = slots.find(s => s._id?.toString() === existingSlot._id.toString());
                    if (updatedSlot) {
                        existingSlot.startTime = updatedSlot.startTime || existingSlot.startTime;
                        existingSlot.endTime = updatedSlot.endTime || existingSlot.endTime;
                    }
                }
                return existingSlot;
            });
        }

        // Update pricePerDay if valid
        if (typeof pricePerDay === 'number' && pricePerDay > 0) {
            schedule.pricePerDay = pricePerDay;
        }

        // Recalculate available slots
        schedule.SlotsAvailable = schedule.Slots.filter(slot => !slot.isBooked).length;

        // Save the updated document
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
                slots: [],
                pricePerDay: null
            });
        }

        if (!schedule.Slots || schedule.Slots.length === 0) {
            return res.status(200).json({
                message: "Schedule found, but no slots available.",
                scheduleId: schedule._id,
                slots: [],
                pricePerDay: schedule.pricePerDay || null
            });
        }

        res.status(200).json({
            message: "Doctor schedules retrieved successfully.",
            scheduleId: schedule._id,
            slots: schedule.Slots,
            pricePerDay: schedule.pricePerDay || null
        });

    } catch (error) {
        console.error("Error fetching schedule:", error);
        res.status(500).json({ message: "Error fetching schedule.", error: error.message });
    }
});

DoctorScheduleRoute.delete("/deleteSlot/:scheduleId/:slotId", async (req, res) => {
    const { scheduleId, slotId } = req.params;

    try {
        // 1. Fetch the schedule
        const schedule = await DoctorScheduleSchema.findById(scheduleId);
        if (!schedule) {
            return res.status(404).json({ message: "Schedule not found." });
        }

        // 2. Check if the slot exists
        const slotExists = schedule.Slots.some(slot => slot._id.toString() === slotId);
        if (!slotExists) {
            return res.status(404).json({ message: "Slot not found." });
        }

        // 3. Remove the slot
        const updatedSchedule = await DoctorScheduleSchema.findByIdAndUpdate(
            scheduleId,
            { $pull: { Slots: { _id: slotId } } },
            { new: true }
        );

        if (!updatedSchedule) {
            return res.status(500).json({ message: "Slot deletion failed." });
        }

        // 4. Check if all slots have been deleted
        if (updatedSchedule.Slots.length === 0) {
            await DoctorScheduleSchema.findByIdAndDelete(scheduleId);
            return res.status(200).json({
                message: "Slot deleted successfully. All slots removed, schedule deleted.",
                scheduleDeleted: true
            });
        }

        // 5. Recalculate SlotsAvailable and save
        updatedSchedule.SlotsAvailable = updatedSchedule.Slots.length;
        await updatedSchedule.save();

        // 6. Respond with updated schedule info
        res.status(200).json({
            message: "Slot deleted successfully.",
            scheduleDeleted: false,
            scheduleId: updatedSchedule._id,
            SlotsAvailable: updatedSchedule.SlotsAvailable,
            slots: updatedSchedule.Slots,
            pricePerDay: updatedSchedule.pricePerDay || null
        });

    } catch (error) {
        console.error("Error deleting slot:", error);
        res.status(500).json({ message: "Error deleting slot.", error: error.message });
    }
});


module.exports = DoctorScheduleRoute;