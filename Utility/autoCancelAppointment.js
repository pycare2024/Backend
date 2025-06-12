const cron = require("node-cron");
const axios = require("axios");

function autoCancelAppointment() {
  cron.schedule("*/1 * * * *", async () => {
    try {
      console.log("⏱ Running auto-cancel appointment check...");
      await axios.post("https://backend-xhl4.onrender.com/AppointmentRoute/autoCancelUnstartedAppointments");
    } catch (error) {
      console.error("❌ Cron job error:", error.message);
    }
  });
}

module.exports = autoCancelAppointment;