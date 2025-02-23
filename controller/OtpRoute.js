const express = require("express");
const OtpRoute = express.Router();
const fetch = require("node-fetch");

const otpStore = {}; 

// ✅ Correct WATI API Endpoint
const WATI_API_URL = "https://live-mt-server.wati.io/api/v1/sendSessionMessage"; 
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0";

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ✅ Route to send OTP (phone number in URL)
OtpRoute.get("/send-otp/:phoneNumber", async (req, res) => {
    const { phoneNumber } = req.params; 

    if (!phoneNumber || phoneNumber.length !== 10) {
        return res.status(400).json({ message: "Invalid phone number. Please enter a valid 10-digit number." });
    }

    const otp = generateOTP();
    otpStore[phoneNumber] = otp; 

    try {
        const response = await fetch(WATI_API_URL, {
            method: "POST",
            headers: {
                "Authorization": WATI_API_KEY, // ✅ No need for "Bearer " prefix, it's already in the token
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                whatsappNumber: `91${phoneNumber}`, // ✅ Correct key (depends on WATI docs)
                messageText: `Your OTP for verification is: ${otp}`
            })
        });

        const data = await response.json();

        if (response.ok) {
            res.json({ message: "OTP sent successfully." });
        } else {
            res.status(500).json({ message: "Failed to send OTP.", error: data });
        }
    } catch (error) {
        res.status(500).json({ message: "Error sending OTP.", error: error.message });
    }
});

module.exports = OtpRoute;