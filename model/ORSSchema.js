const mongoose = require("mongoose");

const ORSSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patients", required: true },
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctors", required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "AppointmentRecords", required: true },

  date: { type: Date, default: Date.now },

  filledBy: {
    type: String,
    enum: ["Self", "Other"],
    required: true,
  },
  relationshipIfOther: {
    type: String,
    default: null,
  },

  ratings: {
    individual: { type: Number, min: 0, max: 10, required: true },
    interpersonal: { type: Number, min: 0, max: 10, required: true },
    social: { type: Number, min: 0, max: 10, required: true },
    overall: { type: Number, min: 0, max: 10, required: true },
  },

  notes: { type: String, default: "" }

}, { timestamps: true ,
    collection: "OutcomeRatingScaleRecords",
});

module.exports = mongoose.model("ORSFeedback", ORSSchema);