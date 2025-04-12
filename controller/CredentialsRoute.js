const express = require("express");
const fetch = require("node-fetch"); // Ensure node-fetch is installed
const CredentialsRoute = express.Router();

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2NjcyMzZmMi1lY2Q1LTRkMDQtOWRlOC1lODZlMTFlZjg3ZDQiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDMvMDMvMjAyNSAwNTozNToyMCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.8TAxVvDwgrkAyy45ZxVyh-OUl5P2S6cJj9viTCtyBtA";

CredentialsRoute.post("/send-credentials", async (req, res) => {
    const { name, mobile, loginId, password } = req.body;

    if (!name || !mobile || !loginId || !password) {
        return res.status(400).json({ message: "All fields (name, mobile, loginId, password) are required." });
    }

    try {
        const response = await fetch(`${WATI_API_URL}?whatsappNumber=91${mobile}`, {
            method: "POST",
            headers: {
                "Authorization": WATI_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                template_name: "details", // Use your actual WATI template name
                broadcast_name: "REGS",
                parameters: [
                    { name: "name", value: name },
                    { name: "loginId", value: loginId },
                    { name: "password", value: password }
                ]
            }),
        });

        const data = await response.json();

        if (response.ok) {
            res.status(200).json({ success: true, message: "Credentials sent successfully via WhatsApp." });
        } else {
            res.status(500).json({ success: false, message: "Failed to send credentials.", error: data });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Error sending credentials.", error: error.message });
    }
});

module.exports = CredentialsRoute;