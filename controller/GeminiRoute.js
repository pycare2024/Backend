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

    console.log("I am gemini putting scores -> ",scores);

    if (!scores || typeof scores !== "object" || Object.keys(scores).length === 0) {
        return res.status(400).json({ message: "At least one score is required to generate a report." });
    }

    let scoreSummary = "";
    let scoringGuide = "";
    let toolsUsed = [];

    // Depression
    if (scores["PHQ-9"] !== undefined) {
        toolsUsed.push("PHQ-9");
        scoreSummary += `- PHQ-9 (Depression): ${scores["PHQ-9"]}\n`;
        scoringGuide += "- PHQ-9: 0–4 (Minimal), 5–9 (Mild), 10–14 (Moderate), 15–19 (Moderately Severe), 20–27 (Severe)\n";
    }
    if (scores["BDI-II"] !== undefined) {
        toolsUsed.push("BDI-II");
        scoreSummary += `- BDI-II (Depression): ${scores["BDI-II"]}\n`;
        scoringGuide += "- BDI-II: 0–13 (Minimal), 14–19 (Mild), 20–28 (Moderate), 29–63 (Severe)\n";
    }

    // Anxiety
    if (scores["GAD-7"] !== undefined) {
        toolsUsed.push("GAD-7");
        scoreSummary += `- GAD-7 (Anxiety): ${scores["GAD-7"]}\n`;
        scoringGuide += "- GAD-7: 0–4 (Minimal), 5–9 (Mild), 10–14 (Moderate), 15–21 (Severe)\n";
    }
    if (scores["BAI"] !== undefined) {
        toolsUsed.push("BAI");
        scoreSummary += `- BAI (Anxiety): ${scores["BAI"]}\n`;
        scoringGuide += "- BAI: 0–7 (Minimal), 8–15 (Mild), 16–25 (Moderate), 26–63 (Severe)\n";
    }

    // Sleep
    if (scores["ISI"] !== undefined) {
        toolsUsed.push("ISI");
        scoreSummary += `- ISI (Sleep): ${scores["ISI"]}\n`;
        scoringGuide += "- ISI: 0–7 (No issues), 8–14 (Subthreshold), 15–21 (Moderate), 22–28 (Severe)\n";
    }

    // PTSD
    if (scores["PCL-5"] !== undefined) {
        toolsUsed.push("PCL-5");
        scoreSummary += `- PCL-5 (PTSD): ${scores["PCL-5"]}\n`;
        scoringGuide += "- PCL-5: 0–32 (Not Clinically Significant), 33+ (Clinically Significant)\n";
    }

    // OCD
    if (scores["Y-BOCS"] !== undefined) {
        toolsUsed.push("Y-BOCS");
        scoreSummary += `- Y-BOCS (OCD): ${scores["Y-BOCS"]}\n`;
        scoringGuide += "- Y-BOCS: 0–7 (Subclinical), 8–15 (Mild), 16–23 (Moderate), 24–31 (Severe), 32–40 (Extreme)\n";
    }

    const prompt = `
    STRICT INSTRUCTIONS: Follow the structure exactly as mentioned below. Do NOT skip or rearrange sections.
    
    Write a structured psychometric assessment report for ${patientName} based on the following scores.
    
    Top Details:
    - Date: 06-May-2025
    - Assessment_ID: Your official Assessment ID will appear on the printed report.
    - Assessment_Mode: Online
    - Assessment_Type: Initial Psychometric Evaluation
    - Tools_Used: ${toolsUsed.join(", ")}
    
    Then divide the report into these EXACT sections:
    
    1. Test Summary:
    - Create a plain text table with 3 columns: Tool Used | Score | Risk Level.
    - Risk Level must be interpreted using the scoring guides provided below.
    - Align table columns neatly for WhatsApp readability.
    
    2. AI Generated Observations:
    - Write a short, warm paragraph explaining overall mental health findings.
    - Speak directly to the user ("you").
    
    3. Risk Classification:
    - Summarize whether overall concern is Minimal, Mild, Moderate, or Severe.
    - If PTSD score is less than 33, clearly mention: "your PTSD score is not clinically significant."
    
    4. Recommended Next Steps:
    - Suggest supportive, actionable steps (e.g., therapy 🧑‍⚕️, meditation 🧘‍♂️, better sleep 🛌).
    
    5. Confidentiality Note:
    - Write: "This report is confidential and intended solely for the recipient."
    
    Rules:
    - Use second-person tone ("you", not "the patient").
    - Keep sentences short, positive, WhatsApp-friendly.
    - NO markdown, no asterisks, no bold.
    - Be warm, supportive, and easy to understand.
    
    Screening Test Scores:
    ${scoreSummary}
    
    Scoring Guidelines:
    ${scoringGuide}
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
        console.log("Tools used->", toolsUsed);
        // console.log(data);
        const generatedReport = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No report generated.";

        res.json({ report: generatedReport });
    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({ message: "Error generating report", error: error.message });
    }
});

GeminiRoute.post("/summarizeDemographics", async (req, res) => {
    const { demographicData } = req.body;

    if (!demographicData) {
        return res.status(400).json({ message: "Demographic data is required" });
    }

    try {
        const prompt = `
You are an expert in corporate HR analytics and workforce intelligence.

Below is anonymized demographic data for employees of a company. Your task is to generate a **detailed, point-wise executive summary** for inclusion in an HR insights report.

Please follow these guidelines:
- Use a **professional and neutral tone** (avoid personal or judgmental statements).
- Be **constructive and insight-driven**, highlighting patterns and possible strategic opportunities.
- Provide **in-depth elaboration** (3–4 sentences per point), not just brief comments.
- Include **light emoji use** for engagement (e.g., 📊, 👥, 🌍, 💡), but keep it polished and appropriate.
- Avoid directly stating absence (e.g., “no females”) — instead, use phrases like “currently skewed toward…”

Include insights on:
1. **Age Group Distribution** – trends, implications, and workforce maturity.
2. **Gender Split** – Gently highlight any existing imbalances, and frame them as opportunities to improve diversity and foster inclusion. Avoid negative language; instead, focus on potential growth areas. Use an encouraging, optimistic tone with constructive suggestions.
3. **Geographic Participation** – representation and regional reach.

Here is the data:

${JSON.stringify(demographicData, null, 2)}
`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-001:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const data = await response.json();

        console.log("Gemini Summary Response:", JSON.stringify(data, null, 2)); // ✅ Debug log

        const summaryText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!summaryText) {
            return res.status(500).json({ message: "Invalid response from Gemini", data });
        }

        res.json({ summary: summaryText });
    } catch (error) {
        console.error("Error generating summary:", error);
        res.status(500).json({ message: "Error generating summary", error: error.message });
    }
});

GeminiRoute.post("/summarizeScreeningSummary", async (req, res) => {
    const { screeningData } = req.body;

    if (!screeningData) {
        return res.status(400).json({ message: "Screening data is required" });
    }

    try {
        // Constructing the prompt for Gemini AI with clinical psychologist perspective
        const prompt = `
You are a team of clinical psychologists from PsyCare. The following is a summary of employee mental health screening data.

Your task is to generate a **detailed, point-wise executive summary** that provides professional, compassionate insights based on the provided data. Your report will be used to guide organizational wellbeing strategies.

Please adhere to the following guidelines:
- Use a **clinical, empathetic, and professional tone**.
- Provide **insights** into the mental health status of employees, identifying areas that may need attention and offering suggestions for support.
- Avoid using harsh or negative language; focus on the opportunity for improvement and support.
- Include **light emojis** where appropriate to enhance the readability and engagement of the report (e.g., 🌱, 💪, 📊, 👥).
- Frame findings in a **constructive manner** and suggest actionable steps for the organization.

Focus on the following aspects:
1. **Total Screenings & Participation** – Overview of the overall engagement in screenings.
2. **Mental Health Cases** – Address any cases of insomnia, anxiety, depression, and PTSD, providing insights into possible next steps.
3. **Departmental Insights** – Look at department-wise scores and offer tailored suggestions for further support.

Here is the data:

${JSON.stringify(screeningData, null, 2)}
`;

        // Sending the request to Gemini AI for content generation
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-001:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const data = await response.json();

        // Logging the raw response for debugging
        console.log("Gemini Summary Response:", JSON.stringify(data, null, 2));

        // Extracting the summary content from the Gemini API response
        const summaryText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!summaryText) {
            return res.status(500).json({ message: "Invalid response from Gemini", data });
        }

        // Returning the generated summary as a response
        res.json({ summary: summaryText });
    } catch (error) {
        console.error("Error generating summary:", error);
        res.status(500).json({ message: "Error generating summary", error: error.message });
    }
});

GeminiRoute.post("/analyze-trends", async (req, res) => {
    const { followUpDetails } = req.body;

    if (!followUpDetails) {
        return res.status(400).json({ message: "followUpDetails is required." });
    }

    const formatted = followUpDetails.map(patient => {
        return patient.entries.map(entry => {
            return `• Date: ${entry.date}\n  Notes: ${entry.notes}\n  Recommendations: ${entry.recommendations}`;
        }).join("\n");
    }).join("\n\n");

    const prompt = `
You are a professional, warm, and insightful mental health assistant.

Below are follow-up therapy session notes from various patients. Please review the content and provide a **concise, insightful summary** that:

- Identifies **common emotional or behavioral trends**,
- Notes any **shifts in mood, treatment progress, or recurring challenges**,
- Offers a brief **clinical-level overview** of themes like engagement, medication, missed sessions, or recovery,
- Highlights **positive outcomes or concerns** clearly,
- Uses a supportive and empathetic tone with **relevant emojis** like 🌱📉💊📈⚠️,
- Format the output with **clear bullet points**.

Here are the entries:

${formatted}
`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-001:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const data = await response.json();
        const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";

        res.json({ trendSummary: geminiText });
    } catch (error) {
        console.error("Gemini API error:", error);
        res.status(500).json({ message: "Failed to generate summary." });
    }
});

module.exports = GeminiRoute; 