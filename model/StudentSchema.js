const mongoose = require("mongoose");

const generateStudentId = (name) => {
  const namePart = name.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const randomPart = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  return `${namePart}${randomPart}`;
};

const StudentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {                          
    type: String,
    required: true,
    unique: true
  },
  phone: {                          
    type: String
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"]
  },
  age: Number,
  institution: String,
  course: String,
  verified: {                       // ✅ Email OTP verified
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: "Students",
  timestamps: true
});

StudentSchema.pre("save", function (next) {
  if (!this.studentId && this.name) {
    this.studentId = generateStudentId(this.name);
  }
  next();
});

module.exports = mongoose.model("Student", StudentSchema);