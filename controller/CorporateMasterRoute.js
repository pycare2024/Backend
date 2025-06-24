const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const CorporateEmployeeMaster = require("../model/CorporateEmployeeMasterSchema");

const CorporateMasterRoute = express.Router();

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /CorporateMaster/upload
CorporateMasterRoute.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { companyCode } = req.body;

    if (!companyCode) {
      return res.status(400).json({ message: "Company code is required." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Excel file is required." });
    }

    // Read Excel file
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const insertData = rows.map(row => ({
      companyCode,
      empId: String(row["Employee Code"]).trim(),
      name: String(row["Full name"]).trim(),
      registered: false
    }));

    await CorporateEmployeeMaster.insertMany(insertData, { ordered: false });

    res.status(200).json({ message: "Employee data uploaded successfully.", count: insertData.length });
  } catch (error) {
    console.error("Upload error:", error.message);
    res.status(500).json({ message: "Failed to upload data.", error: error.message });
  }
});

module.exports = CorporateMasterRoute;