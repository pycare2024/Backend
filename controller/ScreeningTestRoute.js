const express = require("express");
const ScreeningTestQuestionSchema = require("../model/ScreeningTestQuestionSchema");
const ScreeningTestSchema = require("../model/ScreeningTestSchema");

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

// POST Route to add a new screening test record
ScreeningTestRoute.post("/addScreenTestData", (req, res) => {
    const { patient_id, answers } = req.body;

    if (!patient_id || !answers) {
        return res.status(400).json({ message: "Patient ID and answers are required." });
    }

    const updateData = {};
    answers.forEach((answer, index) => {
        updateData[index + 1] = answer;  // Mapping answers to question numbers
    });

    // Create a new test record each time
    const newTestRecord = new ScreeningTestSchema({
        patient_id,
        DateOfTest: new Date(),
        ...updateData
    });

    newTestRecord.save((err, savedRecord) => {
        if (err) {
            return res.status(500).json({ message: "Failed to save screening test record" });
        }
        res.status(201).json(savedRecord);  // Respond with the saved record
    });
});

ScreeningTestRoute.post("/submitScreeningTest", async (req, res) => {
    const { patient_id, answers } = req.body;

    if (!patient_id || !answers) {
        return res.status(400).json({ message: "Patient ID and answers are required." });
    }

    try {
        let scoreDepression = 0, scoreAnxiety = 0, scoreOCD = 0, scorePTSD = 0, scoreSleep = 0;

        // Loop through all 31 questions and calculate scores
        for (let i = 1; i <= 31; i++) {
            let response = answers[`stq${i}`];

            if (!response) response = "0"; // Default to 0 if missing

            // Section 1: Depression Screening (Q1-Q9)
            if (i >= 1 && i <= 9) {
                if (i <= 2) {
                    scoreDepression += parseInt(response) - 1; // Mapping (1,2,3,4) → (0,1,2,3)
                } else {
                    scoreDepression += response.toLowerCase() === "yes" ? 3 : 0; // Yes = 3, No = 0
                }
            }

            // Section 2: Anxiety Screening (Q10-Q16) (Yes = 3, No = 0)
            if (i >= 10 && i <= 16) {
                scoreAnxiety += response.toLowerCase() === "yes" ? 3 : 0;
            }

            // Section 3: OCD Screening (Q17-Q21)
            if (i >= 17 && i <= 21) {
                if (i <= 20) {
                    scoreOCD += response.toLowerCase() === "yes" ? 6 : 0; // Yes = 6, No = 0
                }
            }

            // Section 4: PTSD Screening (Q22-Q26) (Mapping 1,2,3,4,5 → 0,1,2,3,4)
            if (i >= 22 && i <= 26) {
                scorePTSD += parseInt(response) - 1;
            }

            // Section 5: Sleep Issues (Q27-Q31) (Mapping 1,2,3,4,5 → 0,1,2,3,4)
            if (i >= 27 && i <= 31) {
                scoreSleep += parseInt(response) - 1;
            }
        }

        // Store categorized data
        const newTestRecord = new ScreeningTestSchema({
            patient_id,
            DateOfTest: new Date(),
            answers,  // Store raw responses
            scores: {
                depression: scoreDepression,
                anxiety: scoreAnxiety,
                ocd: scoreOCD,
                ptsd: scorePTSD,
                sleep: scoreSleep
            }
        });

        // Save to database
        const savedRecord = await newTestRecord.save();
        res.status(201).json(savedRecord);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to save screening test record" });
    }
});

module.exports = ScreeningTestRoute;