const mongoose = require("mongoose");

const GAFSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patients",
      required: true,
    },
    patientName: {
      type: String,
      required: true,
    },
    gafScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    description: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "GAFRecords",
  }
);

module.exports = mongoose.model("GAFFeedback", GAFSchema);