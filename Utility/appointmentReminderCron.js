const cron = require("node-cron");
const moment = require("moment-timezone");
const fetch = require("node-fetch");

const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

// WATI credentials
const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token

const sentReminders = new Set();

function appointmentReminderCron() {
  cron.schedule("*/1 * * * *", async () => {
    const now = moment().tz("Asia/Kolkata"); // ✅ Use IST consistently

    const startOfDay = now.clone().startOf("day").toDate();
    const endOfDay = now.clone().endOf("day").toDate();

    try {
      console.log("🕐 Running Cron Job for appointment Reminder");

      const appointments = await AppointmentRecordsSchema.find({
        appointment_status: "scheduled",
        DateOfAppointment: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      for (let appt of appointments) {
        const [hourStr, minuteStr] = appt.AppStartTime.split(":");
        const hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);

        const fullDateTime = moment(appt.DateOfAppointment)
          .tz("Asia/Kolkata")
          .set({ hour, minute, second: 0, millisecond: 0 });

        const minutesToStart = fullDateTime.diff(now, "minutes");
        const cacheKey = `${appt._id}_${minutesToStart}`;

        console.log(
          `➡️ ${appt.patientName}: Starts at ${fullDateTime.format()} | Now: ${now.format()} | Diff: ${minutesToStart} min`
        );

        // 60-minute reminder
        if (minutesToStart === 60 && !sentReminders.has(cacheKey)) {
          await sendReminder(appt, "psycare_1hr_reminder", "Auto_1hr_Reminder", fullDateTime);
          sentReminders.add(cacheKey);
          console.log(`✅ Sent 1-hour reminder to ${appt.patientName}`);
        }

        // 30-minute reminder
        if (minutesToStart === 30 && !sentReminders.has(cacheKey)) {
          await sendReminder(appt, "psycare_30min_reminder", "Auto_30min_Reminder", fullDateTime);
          sentReminders.add(cacheKey);
          console.log(`✅ Sent 30-min reminder to ${appt.patientName}`);
        }
      }
    } catch (err) {
      console.error("❌ Reminder cron job error:", err.message);
    }
  });
}

async function sendReminder(appt, templateName, broadcastName, fullDateTime) {
  if (!appt.patientPhoneNumber) return;

  const formattedTime = fullDateTime.format("hh:mm A");

  await fetch(`${WATI_API_URL}?whatsappNumber=91${appt.patientPhoneNumber}`, {
    method: "POST",
    headers: {
      Authorization: WATI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_name: templateName,
      broadcast_name: broadcastName,
      parameters: [
        { name: "patient_name", value: appt.patientName },
        { name: "time", value: formattedTime },
      ],
    }),
  });
}

module.exports = appointmentReminderCron;