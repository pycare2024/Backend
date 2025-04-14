const mongoose = require("mongoose");

const CorporateSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  companyCode: { type: String, unique: true, required: true },
  empIdFormat: { type: String, required: true },
  registeredDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  totalCredits: { type: Number, default: 0 },
  rechargeHistory: [
    {
      credits: { type: Number, required: true },
      amount: { type: Number, required: true },
      paymentId: { type: String },
      date: { type: Date, default: Date.now }
    }
  ],
  associatedPatients: [{
    empId: { type: String, required: true },
    employeePhone: { type: String, required: true },
    familyMembers: [{
      name: { type: String, required: true },
      mobile: { type: String, required: true },
      relation: { type: String, required: true }
    }]
  }]
}, {
  collection: "Corporates"
});

module.exports = mongoose.model("Corporate", CorporateSchema);