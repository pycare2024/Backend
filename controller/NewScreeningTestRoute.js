const express = require("express");
const mongoose = require("mongoose");
const NewScreeningTestSchema = require("../model/NewScreeningTestSchema"); // Ensure correct path
const NewScreeningTestRoute = express.Router();

NewScreeningTestRoute.get("/",(req,res)=>{
    NewScreeningTestSchema.find((err,data)=>{
        if(err)
            {
                return res.status(500).json({message:"Failed to extract records"});
            }
        res.json(data);    
    });
});

NewScreeningTestRoute.post(
  "/submitAssessment/:patient_id/:stq1/:stq2/:stq3/:stq4/:stq5/:stq6/:stq7/:stq8/:stq9/:stq10/:stq11/:stq12/:stq13/:stq14/:stq15/:stq16/:stq17/:stq18/:stq19/:stq20/:stq21/:stq22/:stq23/:stq24/:stq25/:stq26/:stq27/:stq28/:stq29/:stq30/:stq31",
  async (req, res) => {
    try {
      console.log("🔹 Received URL parameters:", req.params);

      const { patient_id } = req.params;
      const responses = Object.values(req.params).slice(1).map(Number); // Exclude patient_id & convert responses to numbers

      // Validate patient_id
      if (!mongoose.Types.ObjectId.isValid(patient_id)) {
        return res.status(400).json({ message: "Invalid patient_id" });
      }

      // Validate responses
      if (responses.length !== 31 || responses.some(isNaN)) {
        return res.status(400).json({
          message: "Invalid responses format. Must be 31 numerical values.",
          receivedResponses: responses,
        });
      }

      console.log("✅ Parsed responses:", responses);

      // Define section ranges
      const sections = {
        depression: { start: 0, end: 8 },
        anxiety: { start: 9, end: 15 },
        ocd: { start: 16, end: 20 },
        ptsd: { start: 21, end: 25 },
        sleep: { start: 26, end: 30 },
      };

      // Score Calculation
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

      // Save results in database
      const assessment = new NewScreeningTestSchema({
        patient_id,
        depression: scores.depression,
        anxiety: scores.anxiety,
        ocd: scores.ocd,
        ptsd: scores.ptsd,
        sleep: scores.sleep,
      });

      await assessment.save();
      res.status(201).json({ message: "Assessment submitted successfully", scores });
    } catch (error) {
      console.error("❌ Server Error:", error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

module.exports = NewScreeningTestRoute;