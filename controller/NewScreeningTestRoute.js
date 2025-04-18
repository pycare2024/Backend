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

        // Convert answers to numbers (1-5 input → 0-4 for scores)
        const responses = answers.map(ans => Number(ans) - 1);

        if (responses.length !== 53 || responses.some(val => isNaN(val) || val < 0 || val > 4)) {
            return res.status(400).json({
                message: "Invalid responses. Must be 53 answers, each between 1 and 5.",
                receivedResponses: answers,
                transformedResponses: responses
            });
        }

        console.log("✅ Parsed numerical responses:", responses);

        // Updated section ranges
        const sections = {
            depression: { start: 0, end: 8 },     // 9 questions
            anxiety: { start: 9, end: 15 },       // 7 questions
            ocd: { start: 43, end: 52 },          // 10 questions
            ptsd: { start: 23, end: 42 },         // 20 questions
            sleep: { start: 16, end: 22 }         // 7 questions
        };

        const calculateScore = (start, end) =>
            responses.slice(start, end + 1).reduce((sum, val) => sum + val, 0);

        const scores = {
            depression: calculateScore(sections.depression.start, sections.depression.end),
            anxiety: calculateScore(sections.anxiety.start, sections.anxiety.end),
            ocd: calculateScore(sections.ocd.start, sections.ocd.end),
            ptsd: calculateScore(sections.ptsd.start, sections.ptsd.end),
            sleep: calculateScore(sections.sleep.start, sections.sleep.end)
        };

        console.log("📝 Calculated scores:", scores);

        // 🔹 Generate report
        const reportResponse = await fetch(
            "https://backend-xhl4.onrender.com/GeminiRoute/generateReport",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(scores)
            }
        );

        const reportData = await reportResponse.json();
        const report = reportData?.report || "Error generating report.";

        console.log("📄 Generated Report:", report);

        // 🔹 Save results
        const assessment = new NewScreeningTestSchema({
            patient_id,
            ...scores,
            DateOfTest: new Date(),
            report
        });

        await assessment.save();

        res.status(201).json({
            message: "Assessment submitted successfully",
            scores,
            report
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
});

module.exports = NewScreeningTestRoute;