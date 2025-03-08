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
    const { depression, anxiety, ocd, ptsd, sleep } = req.body;

    if (depression === undefined || anxiety === undefined || ocd === undefined || ptsd === undefined || sleep === undefined) {
        return res.status(400).json({ message: "All test scores are required." });
    }

    const prompt = `
    Generate a **brief** (8-10 lines) structured mental health report based on the patient's screening scores. Use **bold formatting** with asterisks (*) to highlight key points since this report will be sent as a WhatsApp message.
    
    **Patient's Screening Test Scores:**
    - *Depression (PHQ-9):* ${depression}
    - *Anxiety (GAD-7):* ${anxiety}
    - *Obsessive-Compulsive Disorder (Y-BOCS):* ${ocd}
    - *Post-Traumatic Stress Disorder (PCL-5):* ${ptsd}
    - *Sleep Issues (ISI):* ${sleep}
    
    **Scoring Guidelines:**
    - *Depression:* 0-4 (Minimal), 5-9 (Mild), 10-14 (Moderate), 15-19 (Moderately Severe), 20-27 (Severe)
    - *Anxiety:* 0-4 (Minimal), 5-9 (Mild), 10-14 (Moderate), 15-21 (Severe)
    - *OCD:* 0-4 (Mild), 4-8 (Moderate), 9-11 (Severe), 12-15 (Extreme)
    - *PTSD:* 11+ (Probable PTSD), 15+ (Confirmed PTSD)
    - *Sleep Issues:* 0-6 (No issues), 7-10 (Mild), 11-14 (Moderate), 15-20 (Severe)
    
    **Report Format:**
    - *Summary:* (Brief overview of the patient's mental health based on their scores)
    - *Findings:* (Highlight key concerns based on severity)
    - *Recommendations:* (Personalized next steps, treatment suggestions, and self-care tips)
    
    Keep the report short, professional,include emojis and easy to understand with important points bolded,also suggest the
    patient at last that whether he/she should consult a psychatrist or not.

    please remember to not include unessacary asterisks in your response. 
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