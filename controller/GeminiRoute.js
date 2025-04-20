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
    const { scores, patientName } = req.body;

    if (!scores || typeof scores !== "object" || Object.keys(scores).length === 0) {
        return res.status(400).json({ message: "At least one score is required to generate a report." });
    }

    let scoreSummary = "";
    let scoringGuide = "";

    // Depression
    if (scores["PHQ-9"] !== undefined) {
        scoreSummary += `- PHQ-9 (Depression): ${scores["PHQ-9"]}\n`;
        scoringGuide += "- PHQ-9: 0–4 (Minimal), 5–9 (Mild), 10–14 (Moderate), 15–19 (Moderately Severe), 20–27 (Severe)\n";
    }
    if (scores["BDI-II"] !== undefined) {
        scoreSummary += `- BDI-II (Depression): ${scores["BDI-II"]}\n`;
        scoringGuide += "- BDI-II: 0–13 (Minimal), 14–19 (Mild), 20–28 (Moderate), 29–63 (Severe)\n";
    }

    // Anxiety
    if (scores["GAD-7"] !== undefined) {
        scoreSummary += `- GAD-7 (Anxiety): ${scores["GAD-7"]}\n`;
        scoringGuide += "- GAD-7: 0–4 (Minimal), 5–9 (Mild), 10–14 (Moderate), 15–21 (Severe)\n";
    }
    if (scores["BAI"] !== undefined) {
        scoreSummary += `- BAI (Anxiety): ${scores["BAI"]}\n`;
        scoringGuide += "- BAI: 0–7 (Minimal), 8–15 (Mild), 16–25 (Moderate), 26–63 (Severe)\n";
    }

    // Sleep
    if (scores["ISI"] !== undefined) {
        scoreSummary += `- ISI (Sleep): ${scores["ISI"]}\n`;
        scoringGuide += "- ISI: 0–7 (No issues), 8–14 (Subthreshold), 15–21 (Moderate), 22–28 (Severe)\n";
    }

    // PTSD
    if (scores["PCL-5"] !== undefined) {
        scoreSummary += `- PCL-5 (PTSD): ${scores["PCL-5"]}\n`;
        scoringGuide += "- PCL-5: 0–32 (Not Clinically Significant), 33+ (Clinically Significant)\n";
    }

    // OCD
    if (scores["Y-BOCS-II"] !== undefined) {
        scoreSummary += `- Y-BOCS-II (OCD): ${scores["Y-BOCS-II"]}\n`;
        scoringGuide += "- Y-BOCS-II: 0–7 (Subclinical), 8–15 (Mild), 16–23 (Moderate), 24–31 (Severe), 32–40+ (Extreme)\n";
    }

    const prompt = `
  Write a personalized, structured mental health report (about 8–10 lines) for a user named ${patientName}, based on the screening scores below.
  
  ✅ Use second-person language — talk directly to the user (say "you", not "the patient").
  ✅ Begin the report with: "${patientName}, based on your responses..."
  ✅ Divide the report clearly into 3 sections:
  - Summary
  - Findings
  - Recommendations
  
  Each section heading should be plain text (e.g., "Summary:") — do NOT use asterisks (*), bold, or markdown.
  
  Keep the tone supportive, warm, and professional. Include emojis where appropriate.
  
  **Screening Test Scores:**
  ${scoreSummary}
  
  **Scoring Guidelines:**
  ${scoringGuide}
  
  Rules:
  - Don't refer to the user in third-person.
  - Keep language short, clear, and easy to read on WhatsApp.
  - Mention if PTSD < 33: "your PTSD score is not clinically significant."
  - Recommendations should sound kind and actionable — like "You might benefit from talking to a therapist 🧑‍⚕️, practicing meditation 🧘‍♂️, and prioritizing rest 😴."
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