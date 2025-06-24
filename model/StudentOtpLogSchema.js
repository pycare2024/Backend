const mongoose = require("mongoose");

const StudentOtpLogSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true // Enables faster lookups
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ["new", "existing"],
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "verified", "expired"],
    default: "pending"
  },
  verifiedAt: {
    type: Date
  }
}, {
  collection: "StudentOtpLogs",
  timestamps: true // adds createdAt and updatedAt automatically
});

module.exports = mongoose.model("StudentOtpLog", StudentOtpLogSchema);