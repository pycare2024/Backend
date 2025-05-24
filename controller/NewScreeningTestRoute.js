const express = require("express");
const mongoose = require("mongoose");
const NewScreeningTestSchema = require("../model/NewScreeningTestSchema"); // Ensure correct path
const ScreeningTestQuestionSchema = require("../model/ScreeningTestQuestionSchema");
const NewScreeningTestRoute = express.Router();
const patientSchema = require("../model/patientSchema");
const CorporateSchema = require("../model/CorporateSchema");
const fetch = require("node-fetch");

NewScreeningTestRoute.get("/getQuestions", async (req, res) => {
    try {
        const questions = await ScreeningTestQuestionSchema.find().sort({ order: 1 });
        res.status(200).json({ success: true, questions });
    } catch (error) {
        console.error("Error fetching screening test questions:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

NewScreeningTestRoute.get("/", (req, res) => {
    NewScreeningTestSchema.find((err, data) => {
        if (err) {
            return res.status(500).json({ message: "Failed to extract records" });
        }
        res.json(data);
    });
});

// 🔹 Get all screening tests for a patient by ID
NewScreeningTestRoute.get("/:id", async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: "Missing patient ID" });
    }

    try {
        const records = await NewScreeningTestSchema.find({ patient_id: id }).sort({ DateOfTest: -1 });

        if (records.length === 0) {
            return res.status(404).json({ message: "No screening test records found for this patient." });
        }

        res.status(200).json(records);
    } catch (error) {
        console.error("❌ Error fetching screening tests:", error);
        res.status(500).json({ message: "Server error", error });
    }
});

NewScreeningTestRoute.post("/submitAssessment", async (req, res) => {
  try {
    console.log("🔹 Received request body:", req.body);
    const { patient_id, answers, problems, sectionCounts, patientName, responses } = req.body;

    // Validate required fields
    if (!patient_id || !Array.isArray(problems) || problems.length === 0 || !responses) {
      return res.status(400).json({ message: "Missing required fields (patient_id, problems, or responses)." });
    }

    if (!mongoose.Types.ObjectId.isValid(patient_id)) {
      return res.status(400).json({ message: "Invalid patient_id" });
    }

    // Validate numeric answers
    const numericAnswers = answers.map(ans => Number(ans) - 1);
    if (numericAnswers.length === 0 || numericAnswers.some(val => isNaN(val) || val < 0 || val > 4)) {
      return res.status(400).json({ message: "Invalid answers." });
    }

    console.log("✅ Parsed numerical responses:", numericAnswers);

    // Scoring logic
    const instrumentMap = {
      depression: [{ name: "PHQ-9", count: 9 }, { name: "BDI-II", count: 21 }],
      anxiety: [{ name: "GAD-7", count: 7 }, { name: "BAI", count: 21 }],
      sleep: [{ name: "ISI", count: 7 }],
      ptsd: [{ name: "PCL-5", count: 20 }],
      ocd: [{ name: "Y-BOCS-II", count: 20 }]
    };

    let currentIndex = 0;
    const scores = {};

    for (const section of problems) {
      const instruments = instrumentMap[section];
      for (const inst of instruments) {
        const sectionResponses = numericAnswers.slice(currentIndex, currentIndex + inst.count);
        scores[inst.name] = sectionResponses.reduce((sum, val) => sum + val, 0);
        currentIndex += inst.count;
      }
    }

    console.log("📝 Per-instrument scores:", scores);

    // Generate report using Gemini API
    const reportResponse = await fetch("https://backend-xhl4.onrender.com/GeminiRoute/generateReport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores, patientName })
    });

    const reportData = await reportResponse.json();
    const report = reportData?.report || "Error generating report.";

    console.log("📄 Generated Report:", report);

    // Patient & corporate data handling
    const patient = await patientSchema.findById(patient_id);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    let companyCode = null;
    let department = null;
    let companyName = null;

    if (patient.userType === "corporate") {
      companyCode = patient.companyCode;
      const corporate = await CorporateSchema.findOne({ companyCode });

      if (corporate) {
        const associatedEmployee = corporate.associatedPatients.find(emp => emp.empId === patient.empId);
        companyName = corporate.companyName;
        if (associatedEmployee) {
          department = associatedEmployee.department || null;
        }
      }
    }

    // ✅ Save the assessment including `responses`
    const assessment = new NewScreeningTestSchema({
      patient_id,
      scores,
      responses, // ✅ store structured questions/answers grouped by instrument
      DateOfTest: new Date(),
      report,
      companyCode,
      department
    });

    await assessment.save();

    res.status(201).json({
      message: "Assessment submitted successfully",
      assessment_id: assessment._id,
      userType: patient.userType,
      empId: patient.userType === "corporate" ? patient.empId : null,
      companyName: patient.userType === "corporate" ? companyName : null,
      scores,
      report
    });

  } catch (error) {
    console.error("❌ Server Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = NewScreeningTestRoute;