const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const NewScreeningTestSchema = new mongoose.Schema({
  patient_id: { type: ObjectId, required: true },
  scores: {
    type: Map, // dynamic map of instrument → score
    of: Number
  },
  DateOfTest: { type: Date, default: Date.now },
  report: { type: String },

  // 🔵 New fields
  companyCode: { type: String, default: null },
  department: { type: String, default: null }

}, {
  collection: "NewScreeningTestRecords"
});

module.exports = mongoose.model("NewScreeningTestSchema", NewScreeningTestSchema);