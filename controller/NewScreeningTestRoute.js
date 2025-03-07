const express = require("express");
const mongoose = require("mongoose");
const NewScreeningTestSchema = require("../model/NewScreeningTestSchema"); // Ensure correct path
const NewScreeningTestRoute = express.Router();

NewScreeningTestRoute.post("/submitAssessment", async (req, res) => {
    try {
        console.log("🔹 Received request body:", req.body); // Debugging log

        const { patient_id, responses } = req.body;

        // Validate patient_id
        if (!patient_id || !mongoose.Types.ObjectId.isValid(patient_id)) {
            return res.status(400).json({ message: "Invalid or missing patient_id" });
        }

        // Validate responses
        if (!Array.isArray(responses) || responses.length !== 31) {
            return res.status(400).json({ 
                message: "Invalid responses format. Must be an array of 31 values.",
                receivedResponses: responses
            });
        }

        // Convert placeholders into numerical values
        const parsedResponses = responses.map(value => {
            if (typeof value === "string" && value.startsWith("@stq")) {
                return 0; // Default placeholder value
            }
            return Number(value) || 0;
        });

        console.log("✅ Parsed responses:", parsedResponses); // Debugging log

        // Define section ranges
        const sections = {
            depression: { start: 0, end: 8 },
            anxiety: { start: 9, end: 15 },
            ocd: { start: 16, end: 20 },
            ptsd: { start: 21, end: 25 },
            sleep: { start: 26, end: 30 }
        };

        // Score Calculation
        const calculateScore = (start, end) => {
            return parsedResponses.slice(start, end + 1).reduce((sum, val) => sum + val, 0);
        };

        const scores = {
            depression: calculateScore(sections.depression.start, sections.depression.end),
            anxiety: calculateScore(sections.anxiety.start, sections.anxiety.end),
            ocd: calculateScore(sections.ocd.start, sections.ocd.end),
            ptsd: calculateScore(sections.ptsd.start, sections.ptsd.end),
            sleep: calculateScore(sections.sleep.start, sections.sleep.end)
        };

        console.log("📝 Calculated scores:", scores); // Debugging log

        // Save results in database
        const assessment = new NewScreeningTestSchema({
            patient_id,
            depression: scores.depression,
            anxiety: scores.anxiety,
            ocd: scores.ocd,
            ptsd: scores.ptsd,
            sleep: scores.sleep
        });

        await assessment.save();
        res.status(201).json({ message: "Assessment submitted successfully", scores });
    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
});

module.exports = NewScreeningTestRoute;