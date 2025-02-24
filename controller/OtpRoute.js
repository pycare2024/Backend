const express = require("express");
const fetch = require("node-fetch"); // Ensure node-fetch is installed
const OtpRoute = express.Router();

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token

const otpStore = {}; 
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Route to send OTP
OtpRoute.get("/send-otp/:phoneNumber", async (req, res) => {
    const { phoneNumber } = req.params;

    if (!phoneNumber || phoneNumber.length !== 10) {
        return res.status(400).json({ message: "Invalid phone number. Please enter a valid 10-digit number." });
    }

    const otp = generateOTP();
    otpStore[phoneNumber] = otp; 

    try {
        const response = await fetch(`${WATI_API_URL}?whatsappNumber=91${phoneNumber}`, {
            method: "POST",
            headers: {
                "Authorization": WATI_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                template_name: "otpverification",  // Your custom template name
                broadcast_name: "OTP_Broadcast",
                parameters: [
                    {
                        name: "1",
                        value: otp  // Sending the generated OTP
                    }
                ]
            })
        });

        const data = await response.json();

        if (response.ok) {
            res.status(200).json({ message: "OTP sent successfully.", otp });
        } else {
            res.status(500).json({ message: "Failed to send OTP.", error: data });
        }
    } catch (error) {
        res.status(500).json({ message: "Error sending OTP.", error: error.message });
    }
});

OtpRoute.get("/verify-otp/:phoneNumber/:otp", (req, res) => {
    const { phoneNumber, otp } = req.params;

    if (!phoneNumber || phoneNumber.length !== 10) {
        return res.status(400).json({ message: "Invalid phone number. Please enter a valid 10-digit number." });
    }

    if (!otp) {
        return res.status(400).json({ message: "OTP is required for verification." });
    }

    // Check if the OTP matches
    if (otpStore[phoneNumber] && otpStore[phoneNumber] === otp) {
        delete otpStore[phoneNumber]; // OTP verified, remove from store
        return res.status(200).json({ message: "OTP verified successfully." });
    } else {
        return res.status(400).json({ message: "Entered OTP is incorrect. Please try again!" });
    }
});

module.exports = OtpRoute;