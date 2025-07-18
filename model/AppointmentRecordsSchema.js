const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const AppointmentRecordsSchema = new mongoose.Schema({
    patient_id: { type: ObjectId, ref: 'Patient' },
    patientName: { type: String },
    patientPhoneNumber: { type: Number },
    doctor_id: { type: ObjectId, ref: 'Doctor' },
    doctorScheduleId: { type: ObjectId },
    DateOfAppointment: { type: Date },
    AppStartTime: { type: String },
    AppEndTime: { type: String },
    appointment_status: {
        type: String,
        enum: ['scheduled', 'completed', 'no_show', 'cancelled'],
        default: 'scheduled'
    },
    WeekDay: { type: String },
    payment_status: { type: String },
    payment_id: { type: String },
    refund_id: { type: String, default: "not applicable" },
    cancellation_reason: { type: String, default: "not applicable" },
    payment_link_id: { type: String },
    meeting_link: { type: String },
    session_started: { type: Boolean, default: false },
    session_start_time: { type: Date, default: null },
    isPaidToDoctor: { type: Boolean, default: false },
    notes: { type: String, default: "" },
    recommendations: { type: String, default: "" }, 
    feedbackGiven: { type: Boolean, default: false },
    ORSGiven: { type: Boolean, default: false },

    // ✅ Follow-up logic
    isFollowUp: { type: Boolean, default: false },
    linkedToAppointmentId: { type: ObjectId, ref: 'AppointmentRecordsSchema', default: null },
    followUpRecommended: { type: Boolean, default: false },

    // ✅ New field for student ID proof
    studentIdProofUrl: { type: String, default: null }  // Cloudinary URL
}, {
    collection: "AppointmentRecords"
});

module.exports = mongoose.model("AppointmentRecordsSchema", AppointmentRecordsSchema);