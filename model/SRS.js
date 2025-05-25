const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const SRSSchema = new mongoose.Schema({
  patient_id: { type: ObjectId, ref: "Patient", required: true },
  session_id: { type: ObjectId, ref: "Appointments", required: true },

  date: { type: Date, default: Date.now },

  ratings: {
    relationship: { type: Number, min: 0, max: 10, required: true },
    goalsTopics: { type: Number, min: 0, max: 10, required: true },
    approachFit: { type: Number, min: 0, max: 10, required: true },
    overall: { type: Number, min: 0, max: 10, required: true }
  },

  comments: { type: String, default: "" }, // Optional free text

}, {
  collection: "SessionRatingScaleRecord"
});

module.exports = mongoose.model("SRS", SRSSchema);