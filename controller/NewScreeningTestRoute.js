const express = require("express");
const mongoose = require("mongoose");
const NewScreeningTestSchema = require("../model/NewScreeningTestSchema"); // Ensure correct path
const ScreeningTestQuestionSchema = require("../model/ScreeningTestQuestionSchema");
const NewScreeningTestRoute = express.Router();
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

NewScreeningTestRoute.post("/submitAssessment", async (req, res) => {
    try {
        console.log("🔹 Received request body:", req.body);
        const { patient_id, answers } = req.body;

        if (!mongoose.Types.ObjectId.isValid(patient_id)) {
            return res.status(400).json({ message: "Invalid patient_id" });
        }

        // Convert answers to numbers
        const responses = answers.map(Number);
        if (responses.length !== 31 || responses.some(isNaN)) {
            return res.status(400).json({
                message: "Invalid responses format. Must be 31 numerical values.",
                receivedResponses: responses,
            });
        }

        console.log("✅ Parsed numerical responses:", responses);

        // Define section ranges
        const sections = {
            depression: { start: 0, end: 8 },
            anxiety: { start: 9, end: 15 },
            ocd: { start: 16, end: 20 },
            ptsd: { start: 21, end: 25 },
            sleep: { start: 26, end: 30 },
        };

        // Calculate scores
        const calculateScore = (start, end) =>
            responses.slice(start, end + 1).reduce((sum, val) => sum + val, 0);

        const scores = {
            depression: calculateScore(sections.depression.start, sections.depression.end),
            anxiety: calculateScore(sections.anxiety.start, sections.anxiety.end),
            ocd: calculateScore(sections.ocd.start, sections.ocd.end),
            ptsd: calculateScore(sections.ptsd.start, sections.ptsd.end),
            sleep: calculateScore(sections.sleep.start, sections.sleep.end),
        };

        console.log("📝 Calculated scores:", scores);

        // 🔹 **Call /generateReport Route**
        const reportResponse = await fetch(
            "https://backend-xhl4.onrender.com/GeminiRoute/generateReport",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(scores),
            }
        );

        const reportData = await reportResponse.json();
        const report = reportData?.report || "Error generating report.";

        console.log("📄 Generated Report:", report);

        // 🔹 **Save results in the database with DateOfTest and Report**
        const assessment = new NewScreeningTestSchema({
            patient_id,
            depression: scores.depression,
            anxiety: scores.anxiety,
            ocd: scores.ocd,
            ptsd: scores.ptsd,
            sleep: scores.sleep,
            DateOfTest: new Date(), // Auto-generated date
            report: report, // Store the AI-generated report
        });

        await assessment.save();

        // Send response with scores and generated report
        res.status(201).json({
            message: "Assessment submitted successfully",
            scores,
            report, // 🔹 Report included in response
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
});

module.exports = NewScreeningTestRoute;