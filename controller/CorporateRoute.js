const express = require("express");
const CompanyRoute = express.Router();
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

CompanyRoute.post("/register", async (req, res) => {
  try {
    const { companyName, contactPerson, email, phone, empIdFormat } = req.body;

    // ✅ Validate all required fields
    if (!companyName || !contactPerson || !email || !phone || !empIdFormat) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // ✅ Check for duplicates by email
    const existingCompany = await Corporate.findOne({ email });
    if (existingCompany) {
      return res.status(409).json({ message: "Company with this email already exists." });
    }

    // ✅ Generate company code from name
    const companyCode = generateCompanyCode(companyName);

    // ✅ Create new company record
    const newCompany = new Corporate({
      companyName,
      contactPerson,
      email,
      phone,
      empIdFormat,
      companyCode,
      associatedPatients: [] // always initialize
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

module.exports = CompanyRoute;