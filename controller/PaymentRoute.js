const express = require("express");
const crypto = require("crypto");

const PaymentRoute = express.Router();

// ✅ Apply express.raw() to receive raw Buffer data
PaymentRoute.post("/webhook/razorpay", express.raw({ type: "application/json" }), (req, res) => {
    try {
        const WEBHOOK_SECRET = "Payments@Psycare2025"; // Your Razorpay webhook secret
        const razorpaySignature = req.headers["x-razorpay-signature"];

        if (!razorpaySignature) {
            console.error("❌ Missing Razorpay signature");
            return res.status(400).json({ message: "Missing Razorpay signature" });
        }

        const payload = req.body; // ✅ This will be a Buffer
        console.log("🔹 Received Webhook Data:", payload.toString()); // Convert Buffer to string
        console.log("🔹 Received Signature:", razorpaySignature);

        // ✅ Compute expected signature using raw Buffer
        const expectedSignature = crypto
            .createHmac("sha256", WEBHOOK_SECRET)
            .update(payload) // ✅ Use raw Buffer directly
            .digest("hex");

        console.log("🔹 Expected Signature:", expectedSignature);

        if (expectedSignature !== razorpaySignature) {
            console.error("❌ Invalid signature! Possible security breach.");
            return res.status(400).json({ message: "Invalid signature" });
        }

        console.log("✅ Webhook verified successfully!");
        return res.status(200).json({ message: "Webhook processed successfully." });

    } catch (error) {
        console.error("❌ Webhook Processing Error:", error);
        return res.status(500).json({ message: "Webhook processing failed.", error: error.message });
    }
});

// ✅ Export the router
module.exports = PaymentRoute;