const express = require("express");
const CorporateRoute = express.Router();
const patientSchema = require("../model/patientSchema");
const Corporate = require("../model/CorporateSchema");

// Utility to generate a unique company code from the company name
function generateCompanyCode(name) {
  const initials = name
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase(); // e.g., Tata Consultancy Services -> TCS

  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digit code
  return `${initials}${randomNum}`; // e.g., TCS2381
}

CorporateRoute.post("/register", async (req, res) => {
  try {
    const { companyName, contactPerson, email, phone, empIdFormat } = req.body;

    if (!companyName || !contactPerson || !email || !phone || !empIdFormat) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingCompany = await Corporate.findOne({ email });
    if (existingCompany) {
      return res.status(409).json({ message: "Company with this email already exists." });
    }

    const companyCode = generateCompanyCode(companyName);

    const newCompany = new Corporate({
      companyName,
      contactPerson,
      email,
      phone,
      empIdFormat,
      companyCode,
      associatedPatients: [] // ✅ empty initially
    });

    await newCompany.save();

    res.status(201).json({
      message: "Company registered successfully",
      companyCode
    });

  } catch (err) {
    console.error("❌ Company registration error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

CorporateRoute.post("/verifyCorporatePatient", async (req, res) => {
  try {
    const { companyCode, empId } = req.body;

    if (!companyCode || !empId) {
      return res.status(400).json({ message: "Company code and Employee ID are required." });
    }

    const company = await Corporate.findOne({ companyCode });

    if (!company) {
      return res.status(404).json({ message: "Company not registered with us." });
    }

    const employee = company.associatedPatients.find(p => p.empId === empId);

    if (employee) {
      return res.status(200).json({
        exists: true,
        message: "Employee exists in our records.",
        employee // ✅ Include the full employee object
      });
    } else {
      return res.status(200).json({
        exists: false,
        message: "Employee not found. Proceed to registration."
      });
    }

  } catch (error) {
    console.error("❌ Error verifying corporate patient:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
});

CorporateRoute.post("/registerFamilyMember", async (req, res) => {
  try {
    const {
      empId,
      companyCode,
      name,
      mobile,
      relation,
      age,
      gender,
      location,
      problem
    } = req.body;

    if (!empId || !companyCode || !name || !mobile || !relation || !age || !gender || !location || !problem) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const company = await Corporate.findOne({ companyCode });
    if (!company) {
      return res.status(404).json({ message: "Company not found." });
    }

    const employee = company.associatedPatients.find(p => p.empId === empId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found in this company." });
    }

    const familyExists = employee.familyMembers.find(m => m.mobile === mobile);
    if (familyExists) {
      return res.status(409).json({ message: "Family member already registered." });
    }

    // ✅ Register in Patients table
    const newPatient = new patientSchema({
      Name: name,
      Age: age,
      Gender: gender,
      Location: location,
      Mobile: mobile,
      Problem: problem
    });

    await newPatient.save();

    // ✅ Add family member to Corporate schema
    employee.familyMembers.push({ name, mobile, relation });

    await company.save();

    res.status(201).json({ message: "Family member registered successfully", patientId: newPatient._id });

  } catch (error) {
    console.error("Register family member error:", error.message);
    res.status(500).json({ message: "Server error. Try again." });
  }
});

module.exports = CorporateRoute;