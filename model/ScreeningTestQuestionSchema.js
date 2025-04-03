const mongoose = require("mongoose");

const ScreeningTestQuestionSchema = new mongoose.Schema(
  {
    section: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      required: true,
      unique: true
    },
    question: {
      type: String,
      required: true
    },
    options: {
      type: [String], // Array of answer strings (1-based mapping to answer index)
      required: true
    }
  },
  {
    collection: "ScreeningTestQuestions",
    timestamps: true
  }
);

module.exports = mongoose.model("ScreeningTestQuestionSchema", ScreeningTestQuestionSchema);