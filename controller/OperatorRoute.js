const express = require("express");
const OperatorRoute = express.Router();
const Operator = require("../model/OperatorSchema"); // Ensure correct path
const bcrypt = require("bcrypt");
const fetch = require("node-fetch");

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token

const OTP_API_BASE_URL = "https://backend-xhl4.onrender.com/OtpRoute";

OperatorRoute.get("/get-operators", async (req, res) => {
    try {
        const operators = await Operator.find();
        res.status(200).json({ operators });
    } catch (error) {
        console.error("Error fetching operators:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// POST route to add a new operator
OperatorRoute.post("/add-operator", async (req, res) => {
    try {
        const { Name, loginId, password, mobileNo, email, dob } = req.body;

        // Validate required fields
        if (!Name || !loginId || !password || !mobileNo || !email || !dob) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if the loginId already exists
        const existingOperator = await Operator.findOne({ loginId });
        if (existingOperator) {
            return res.status(400).json({ message: "Login ID already exists" });
        }

        // Create a new operator
        const newOperator = new Operator({
            Name,
            loginId,
            password, // Ideally, hash the password before storing
            mobileNo,
            email,
            dob
        });

        // Save to the database
        await newOperator.save();
        res.status(201).json({ message: "Operator added successfully", operator: newOperator });

        if (mobileNo) {
            const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${mobileNo}`, {
                method: "POST",
                headers: {
                    "Authorization": WATI_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    template_name: "operator_details",
                    broadcast_name: "operatorDetailsBroadcast",
                    parameters: [
                        {
                            name: "name",
                            value: Name  // ✅ Patient's name for {{1}}
                        },
                        {
                            name: "loginId",
                            value: loginId  // ✅ Unique payment link or ID for {{2}}
                        },
                        {
                            name: "password",
                            value: password  // ✅ Patient's name for {{1}}
                        }
                    ]
                })
            });

            const whatsappData = await whatsappResponse.json();
            if (!whatsappResponse.ok) {
                console.error("Failed to send WhatsApp message:", whatsappData);
            }
        }
    } catch (error) {
        console.error("Error adding operator:", error);
        res.status(500).json({ message: "Server error" });
    }
});

OperatorRoute.post("/operator-login", async (req, res) => {
    try {
        const { loginId, password } = req.body;
        console.log("🔹 Login Attempt:", loginId);

        // Check if operator exists
        const operator = await Operator.findOne({ loginId });
        if (!operator) {
            console.log("❌ Operator not found:", loginId);
            return res.status(404).json({ message: "Operator not found" });
        }

        // **Direct Password Comparison (No bcrypt)**
        if (operator.password !== password) {
            console.log("❌ Invalid credentials for:", loginId);
            return res.status(400).json({ message: "Invalid credentials" });
        }

        console.log("✅ Credentials verified, sending OTP...");

        // Send OTP using existing OTP service
        const otpResponse = await fetch(`${OTP_API_BASE_URL}/send-otp/${operator.mobileNo}`);
        const otpData = await otpResponse.json();

        if (!otpResponse.ok) {
            console.error("❌ OTP Sending Failed:", otpData);
            return res.status(500).json({ message: "Failed to send OTP", error: otpData });
        }

        console.log("✅ OTP sent successfully to:", operator.mobileNo);

        res.status(200).json({ 
            message: "OTP sent to WhatsApp", 
            operatorId: operator._id,
            phoneNumber: operator.mobileNo
        });

    } catch (error) {
        console.error("❌ Error in operator login:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Operator Login - Step 2 (Verify OTP)
OperatorRoute.post("/verify-operator-otp", async (req, res) => {
    try {
        const { operatorId, otp } = req.body;

        // Find the operator
        const operator = await Operator.findById(operatorId);
        if (!operator) {
            return res.status(404).json({ message: "Operator not found" });
        }

        // Verify OTP using your existing OTP service
        const verifyResponse = await fetch(`${OTP_API_BASE_URL}/verify-otp/${operator.mobileNo}/${otp}`);
        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok) {
            return res.status(400).json({ message: "Invalid OTP", error: verifyData });
        }

        res.status(200).json({ message: "Login successful", operator });
    } catch (error) {
        console.error("Error in OTP verification:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = OperatorRoute;