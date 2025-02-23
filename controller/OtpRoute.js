const express = require("express");
const OtpRoute = express.Router();

const otpStore = {}; // Temporary storage for OTPs (use a database in production)
const WATI_API_URL = "https://live-mt-server.wati.io/387357";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with your actual API key

// Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Route to send OTP
OtpRoute.post("/send-otp", async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber || phoneNumber.length !== 10) {
        return res.status(400).json({ message: "Invalid phone number. Please enter a valid 10-digit number." });
    }

    const otp = generateOTP();
    otpStore[phoneNumber] = otp; // Store OTP temporarily

    try {
        const response = await fetch(WATI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${WATI_API_KEY}`
            },
            body: JSON.stringify({
                number: phoneNumber,
                messageText: `Your OTP for verification is: ${otp}`
            })
        });

        if (!response.ok) {
            throw new Error("Failed to send OTP via WATI");
        }

        res.json({ message: "OTP sent successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to send OTP.", error: error.message });
    }
});

// Route to verify OTP
OtpRoute.post("/verify-otp", (req, res) => {
    const { phoneNumber, otp } = req.body;
    if (otpStore[phoneNumber] && otpStore[phoneNumber] === otp) {
        delete otpStore[phoneNumber]; // OTP verified, remove from store
        return res.json({ message: "OTP verified successfully." });
    }
    res.status(400).json({ message: "Invalid or expired OTP." });
});

module.exports = OtpRoute;