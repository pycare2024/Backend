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
        const { patient_id, answers, problems, sectionCounts } = req.body;

        if (!patient_id || !Array.isArray(problems) || problems.length === 0) {
            return res.status(400).json({ message: "Missing patient_id or selected problems." });
        }

        if (!mongoose.Types.ObjectId.isValid(patient_id)) {
            return res.status(400).json({ message: "Invalid patient_id" });
        }

        // Convert answers to numbers (1-5 input → 0-4 for scores)
        const responses = answers.map(ans => Number(ans) - 1);

        // Validate that all answers are valid numbers between 0 and 4
        if (responses.length === 0 || responses.some(val => isNaN(val) || val < 0 || val > 4)) {
            return res.status(400).json({
                message: "Invalid responses. All answers must be between 1 and 5.",
                receivedResponses: answers,
                transformedResponses: responses
            });
        }

        console.log("✅ Parsed numerical responses:", responses);

        const questionCounts = {
            depression: 9,
            anxiety: 7,
            sleep: 7,
            ptsd: 20,
            ocd: 10
        };

        // const calculateScore = (start, end) => responses.slice(start, end + 1).reduce((sum, val) => sum + val, 0);

        // Only compute selected sections
        let currentIndex = 0;
        const scores = {};

        for (const key of problems) {
            const count = sectionCounts[key];
            const sectionResponses = responses.slice(currentIndex, currentIndex + count);
            scores[key] = sectionResponses.reduce((sum, val) => sum + val, 0);
            currentIndex += count;
        }

        console.log("📝 Calculated scores:", scores);

        // 🔹 Generate report
        const reportResponse = await fetch("http://localhost:4000/GeminiRoute/generateReport", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(scores) // Only selected scores will be sent
        });

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