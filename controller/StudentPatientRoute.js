const express = require("express");
const StudentPatientRoute = express.Router();
const Student = require("../model/StudentSchema"); // ✅ adjust path if needed

// ✅ Register new student
StudentPatientRoute.post("/register", async (req, res) => {
  try {
    const { name, email, phone, gender, age, institution, course } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and Email are required." });
    }

    // Check if email is already used
    const existing = await Student.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Student already registered with this email." });
    }

    const newStudent = new Student({
      name,
      email,
      phone,
      gender,
      age,
      institution,
      course,
      verified: true  // ✅ assuming OTP was already verified
    });

    await newStudent.save();

    res.status(201).json({
      message: "Student registered successfully.",
      studentId: newStudent.studentId,
      student: newStudent
    });

  } catch (error) {
    console.error("Error registering student:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// ✅ Get student details by email
StudentPatientRoute.get("/get/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const student = await Student.findOne({ email });

    if (!student) {
      return res.status(404).json({ message: "No student found with this email." });
    }

    res.status(200).json({ student });

  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

module.exports = StudentPatientRoute;