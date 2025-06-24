const mongoose = require("mongoose");

const CorporateEmployeeMasterSchema = new mongoose.Schema({
  companyCode: { type: String, required: true },
  empId: { type: String, required: true },
  name: { type: String, required: true },
  registered: { type: Boolean, default: false }, // 🔁 Update after registration
}, {
  timestamps: true,
  collection: "CorporateEmployeeMaster"
});

module.exports = mongoose.model("CorporateEmployeeMaster", CorporateEmployeeMasterSchema);