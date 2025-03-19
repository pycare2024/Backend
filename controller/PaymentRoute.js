const express = require("express");
const crypto = require("crypto");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

const PaymentRoute = express.Router();

// Middleware to ensure raw request body is available
PaymentRoute.post("/webhook/razorpay",
    express.raw({ type: "application/json" }), 
    async (req, res) => {

    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const razorpaySignature = req.headers["x-razorpay-signature"];

        // 🔴 If signature is missing, reject request
        if (!razorpaySignature) {
            return res.status(400).json({ success: false, message: "Missing Razorpay Signature" });
        }

        // 🔹 Verify Razorpay Webhook Signature
        const expectedSignature = crypto.createHmac("sha256", webhookSecret)
            .update(req.body)  // Use raw body for HMAC verification
            .digest("hex");

        if (expectedSignature !== razorpaySignature) {
            return res.status(400).json({ success: false, message: "Invalid Razorpay Signature" });
        }

        console.log("✅ Webhook Verified!");

        // Convert raw body to JSON
        const eventData = JSON.parse(req.body.toString());

        // ✅ Only process 'payment.captured' events
        if (eventData.event !== "payment.captured") {
            return res.json({ success: true, message: "Event received but not processed" });
        }

        const { id: paymentId, order_id: razorpayOrderId } = eventData.payload.payment.entity;

        // 🔹 Find appointment using Razorpay Order ID
        const appointment = await AppointmentRecordsSchema.findOne({ razorpay_order_id: razorpayOrderId });

        if (!appointment) {
            console.error(`❌ No appointment found for Order ID: ${razorpayOrderId}`);
            return res.status(404).json({ success: false, message: "No appointment found for this payment" });
        }

        // 🔹 Update payment status in the database
        appointment.payment_status = "paid";
        appointment.payment_id = paymentId;
        await appointment.save();

        console.log(`✅ Appointment Confirmed: ${appointment._id}`);

        return res.json({ success: true, message: "Payment verified, appointment confirmed" });

    } catch (error) {
        console.error("❌ Error processing webhook:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = PaymentRoute;