const mongoose = require("mongoose");

const CorporateSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  companyCode: { type: String, unique: true, required: true }, // auto-generated
  empIdFormat: { type: String, required: true }, // ✅ New field added
  registeredDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  associatedPatients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Patient" }]
}, {
  collection: "Corporates"
});

module.exports = mongoose.model("Corporate", CorporateSchema);