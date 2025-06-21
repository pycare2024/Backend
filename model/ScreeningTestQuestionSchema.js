const mongoose = require("mongoose");

const ScreeningTestQuestionSchema = new mongoose.Schema(
  {
    section: {
      type: String,
      required: true // e.g., "depression", "anxiety"
    },
    instrument: {
      type: String,
      required: true // e.g., "PHQ-9", "BDI-2", "GAD-7", "BAI",Y-BOCS
    },
    order: {
      type: Number,
      required: true,
    },
    question: {
      type: String,
      required: true
    },
    options: {
      type: [String],
      required: true
    }
  },
  {
    collection: "ScreeningTestQuestions",
    timestamps: true
  }
);

module.exports = mongoose.model("ScreeningTestQuestionSchema", ScreeningTestQuestionSchema);