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

  refundHistory: [
    {
      credits: { type: Number, required: true, default: 1 }, // usually 1 per cancellation
      appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "AppointmentRecords" },
      reason: { type: String, default: "Appointment cancelled" },
      date: { type: Date, default: Date.now }
    }
  ],
  associatedPatients: [{
    empId: { type: String, required: true },
    employeePhone: { type: String, required: true },
    department: { type: String },
    familyMembers: [{
      name: { type: String, required: true },
      mobile: { type: String, required: true },
      relation: { type: String, required: true }
    }],
    visits: [  // ✅ Only visits of employees now
      {
        date: { type: Date, default: Date.now },
      }
    ]
  }]
}, {
  collection: "Corporates"
});

module.exports = mongoose.model("Corporate", CorporateSchema);