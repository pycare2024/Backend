const express = require("express");
const fetch = require("node-fetch");
const dotenv = require("dotenv");

dotenv.config();

const GeminiRoute = express.Router();
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

GeminiRoute.post("/ask", async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ message: "Question is required" });
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-001:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: question }] }]
                })
            }
        );

        const data = await response.json();

        console.log("Google Gemini API Response:", JSON.stringify(data, null, 2)); // ✅ Log the response

        // Check if response contains valid text
        const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiResponse) {
            return res.status(500).json({ message: "Invalid response from Gemini API", data });
        }

        res.json({ response: aiResponse });
    } catch (error) {
        console.error("Error fetching response:", error);
        res.status(500).json({ message: "Error fetching response", error: error.message });
    }
});

GeminiRoute.post("/generateReport", async (req, res) => {
    const scores = req.body;

    if (!scores || typeof scores !== "object" || Object.keys(scores).length === 0) {
        return res.status(400).json({ message: "At least one score is required to generate a report." });
    }

    let scoreSummary = "";
    let scoringGuide = "";

    if (scores.depression !== undefined) {
        scoreSummary += `- *Depression (PHQ-9):* ${scores.depression}\n`;
        scoringGuide += "- *Depression:* 0-4 (Minimal), 5-9 (Mild), 10-14 (Moderate), 15-19 (Moderately Severe), 20-27 (Severe)\n";
    }
    if (scores.anxiety !== undefined) {
        scoreSummary += `- *Anxiety (GAD-7):* ${scores.anxiety}\n`;
        scoringGuide += "- *Anxiety:* 0-4 (Minimal), 5-9 (Mild), 10-14 (Moderate), 15-21 (Severe)\n";
    }
    if (scores.ocd !== undefined) {
        scoreSummary += `- *Obsessive-Compulsive Disorder (Y-BOCS):* ${scores.ocd}\n`;
        scoringGuide += "- *OCD:* 0-7 (Subclinical), 8-15 (Mild), 16-23 (Moderate), 24-31 (Severe), 32-40 (Extreme)\n";
    }
    if (scores.ptsd !== undefined) {
        scoreSummary += `- *Post-Traumatic Stress Disorder (PCL-5):* ${scores.ptsd}\n`;
        scoringGuide += "- *PTSD:* 0-32 (Not Clinically Significant), 33+ (Clinically Significant)\n";
    }
    if (scores.sleep !== undefined) {
        scoreSummary += `- *Sleep Issues (ISI):* ${scores.sleep}\n`;
        scoringGuide += "- *Sleep Issues:* 0-7 (No issues), 8-14 (Subthreshold), 15-21 (Moderate), 22-28 (Severe)\n";
    }

    const prompt = `
Generate a **brief** (8-10 lines) structured mental health report based on the patient's screening scores. Use **bold formatting** with asterisks (*) to highlight key points since this report will be sent as a WhatsApp message.

**Patient's Screening Test Scores:**
${scoreSummary}

**Scoring Guidelines:**
${scoringGuide}

**Report Format:**
- *Summary:* (Brief overview of the patient's mental health based on their scores)
- *Findings:* (Highlight key concerns based on severity)
- *Recommendations:* (Personalized next steps, treatment suggestions, and self-care tips)

Be strict about score interpretation. If PTSD is <33, state it clearly as “not clinically significant.” Include emojis and suggest whether the patient should consult a psychiatrist.
`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            }
        );

        const data = await response.json();
        const generatedReport = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No report generated.";

        res.json({ report: generatedReport });
    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({ message: "Error generating report", error: error.message });
    }
});

module.exports = GeminiRoute; 