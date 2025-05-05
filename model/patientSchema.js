const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  Name: { type: String, required: true },
  Age: { type: Number },
  Gender: { type: String },
  Location: { type: String },
  Mobile: { type: Number },
  Problem: { type: [String] },

  // 👇 New fields
  userType: { 
    type: String, 
    enum: ["retail", "corporate"], 
    required: true,
    default: "retail"
  },
  empId: { type: String, default: null },      // Only if corporate
  companyCode: { type: String, default: null }, // Only if corporate
  isFamilyMember: { type: Boolean, default: false } // New field: True for family members, False for employees

}, {
  collection: "Patients"
});

module.exports = mongoose.model("patientSchema", patientSchema);