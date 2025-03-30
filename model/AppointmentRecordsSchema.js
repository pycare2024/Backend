const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const AppointmentRecordsSchema = new mongoose.Schema({
    "patient_id": { type: ObjectId },
    "patientName": { type: String },
    "patientPhoneNumber": { type: Number },
    "doctor_id": { type: ObjectId },
    "doctorScheduleId": { type: ObjectId },
    "DateOfAppointment": { type: Date },       // e.g. 2025-03-31
    "AppStartTime": { type: String },          // e.g. "10:00 AM"
    "AppEndTime": { type: String },
    "WeekDay": { type: String },
    "payment_status": { type: String },
    "payment_id": { type: String },
    "payment_link_id": { type: String },
    "meeting_link": { type: String },
    "session_started": { type: Boolean, default: false },
    "session_start_time": { type: Date }       // ✅ New: actual timestamp
}, {
    collection: "AppointmentRecords"
});

module.exports = mongoose.model("AppointmentRecordsSchema", AppointmentRecordsSchema);