const express = require("express");
const ScreeningTestQuestionSchema = require("../model/ScreeningTestQuestionSchema");

const ScreeningTestRoute = express.Router();

// GET Route to fetch all screening test questions
ScreeningTestRoute.get("/", (req, res) => {
    ScreeningTestQuestionSchema.find((err, data) => {
        if (err) {
            return res.status(500).json({ message: "Failed to fetch questions" });
        }
        res.json(data);
    });
});

// GET Route to fetch a specific question by number
ScreeningTestRoute.get("/:no", (req, res) => {
    const questionNumber = req.params.no;

    // Find the question by the 'no' field (question number)
    ScreeningTestQuestionSchema.findOne({ no: questionNumber }, (err, data) => {
        if (err) {
            return res.status(500).json({ message: "Error fetching the question" });
        }

        if (!data) {
            return res.status(404).json({ message: `Question number ${questionNumber} not found` });
        }

        // Return the question (in English, Hindi, or both)
        res.json(data);
    });
});

// POST Route to add a new question
ScreeningTestRoute.post("/add", (req, res) => {
    const { no, eng, hin } = req.body;

    // Check if all required fields are provided
    if (!no || !eng || !hin) {
        return res.status(400).json({ message: "All fields (no, eng, hin) are required." });
    }

    const newQuestion = new ScreeningTestQuestionSchema({
        no,
        eng,
        hin,
    });

    newQuestion.save((err, savedQuestion) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Failed to add question" });
        }
        res.status(201).json(savedQuestion); // Return the saved question
    });
});

module.exports = ScreeningTestRoute;