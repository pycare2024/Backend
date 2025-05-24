const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const NewScreeningTestSchema = new mongoose.Schema({
  patient_id: { type: ObjectId, required: true },

  scores: {
    type: Map,
    of: Number
  },

  DateOfTest: { type: Date, default: Date.now },
  report: { type: String },

  companyCode: { type: String, default: null },
  department: { type: String, default: null },

  responses: {
    type: Map,
    of: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true }
      }
    ]
  }
}, {
  collection: "NewScreeningTestRecords"
});

module.exports = mongoose.model("NewScreeningTestSchema", NewScreeningTestSchema);