const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const DoctorScheduleSchema = new mongoose.Schema({
  doctor_id: { type: ObjectId, required: true, ref: "Doctor" },
  Date: { type: Date, required: true },
  WeekDay: { type: String },
  SlotsAvailable: { type: Number },
  pricePerSlot: { type: Number, required: true }, // 💰 Unified price for all slots of the day
  Slots: [
    {
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      isBooked: { type: Boolean, default: false },
      bookedBy: { type: ObjectId, ref: "Patient", default: null }
    }
  ]
}, {
  collection: "DoctorSchedule",
  timestamps: true
});

module.exports = mongoose.model("DoctorScheduleSchema", DoctorScheduleSchema);