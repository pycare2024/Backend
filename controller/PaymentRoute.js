const crypto = require("crypto");
const express = require("express");
const PaymentRoute = express.Router();
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

// Ensure raw body parsing for Razorpay signature verification
PaymentRoute.post("/webhook/razorpay", express.raw({ type: "application/json" }), async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const razorpaySignature = req.headers["x-razorpay-signature"];

        if (!razorpaySignature) return res.status(400).json({ success: false, message: "Missing Razorpay Signature" });

        // Verify signature
        const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(req.body).digest("hex");
        if (expectedSignature !== razorpaySignature) {
            console.error("❌ Invalid Razorpay Signature");
            return res.status(400).json({ success: false, message: "Invalid Razorpay Signature" });
        }

        console.log("✅ Webhook Verified!");

        const eventData = JSON.parse(req.body); // Convert raw body to JSON

        // Process only "payment.captured" event
        if (eventData.event !== "payment.captured") return res.json({ success: true, message: "Event ignored" });

        const { id: paymentId, order_id: razorpayOrderId } = eventData.payload.payment.entity;

        // Find and update appointment
        const appointment = await AppointmentRecordsSchema.findOneAndUpdate(
            { razorpay_order_id: razorpayOrderId },
            { payment_status: "paid", payment_id: paymentId },
            { new: true }
        );

        if (!appointment) {
            console.error("❌ No matching appointment found for order_id:", razorpayOrderId);
            return res.status(404).json({ success: false, message: "No matching appointment found" });
        }

        console.log(`✅ Appointment Updated: ${appointment._id}`);
        return res.json({ success: true, message: "Payment verified, appointment confirmed" });

    } catch (error) {
        console.error("❌ Webhook Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = PaymentRoute;