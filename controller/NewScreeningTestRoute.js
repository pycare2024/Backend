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
        const { patient_id, answers, problems, sectionCounts, patientName } = req.body;

        if (!patient_id || !Array.isArray(problems) || problems.length === 0) {
            return res.status(400).json({ message: "Missing patient_id or selected problems." });
        }

        if (!mongoose.Types.ObjectId.isValid(patient_id)) {
            return res.status(400).json({ message: "Invalid patient_id" });
        }

        const responses = answers.map(ans => Number(ans) - 1);
        if (responses.length === 0 || responses.some(val => isNaN(val) || val < 0 || val > 4)) {
            return res.status(400).json({ message: "Invalid responses." });
        }

        console.log("✅ Parsed numerical responses:", responses);

        // Map of instruments by category
        const instrumentMap = {
            depression: [
                { name: "PHQ-9", count: 9 },
                { name: "BDI-II", count: 21 }
            ],
            anxiety: [
                { name: "GAD-7", count: 7 },
                { name: "BAI", count: 21 }
            ],
            sleep: [
                { name: "ISI", count: 7 }
            ],
            ptsd: [
                { name: "PCL-5", count: 20 }
            ],
            ocd: [
                { name: "Y-BOCS-II", count: 20 }
            ]
        };

        let currentIndex = 0;
        const scores = {};

        for (const section of problems) {
            const instruments = instrumentMap[section];
            for (const inst of instruments) {
                const sectionResponses = responses.slice(currentIndex, currentIndex + inst.count);
                scores[inst.name] = sectionResponses.reduce((sum, val) => sum + val, 0);
                currentIndex += inst.count;
            }
        }

        console.log("📝 Per-instrument scores:", scores);

        const reportResponse = await fetch("http://localhost:4000/GeminiRoute/generateReport", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scores, patientName })
        });

        const reportData = await reportResponse.json();
        const report = reportData?.report || "Error generating report.";

        console.log("📄 Generated Report:", report);

        const assessment = new NewScreeningTestSchema({
            patient_id,
            scores,
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