const express = require("express");
const crypto = require("crypto");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

const PaymentRoute = express.Router();

PaymentRoute.post("/webhook/razorpay", 
    express.raw({ type: "application/json" }), // Ensure raw body is available
    async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const razorpaySignature = req.headers["x-razorpay-signature"];

        if (!razorpaySignature) {
            return res.status(400).json({ success: false, message: "Missing Razorpay Signature" });
        }

        // Convert raw body to string before using it in HMAC
        const rawBody = req.body.toString();  // Convert Buffer to String

        // Verify Razorpay Webhook Signature
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)  // Use raw string
            .digest("hex");

        if (expectedSignature !== razorpaySignature) {
            return res.status(400).json({ success: false, message: "Invalid Razorpay Signature" });
        }

        console.log("✅ Webhook Verified!");

        // Parse JSON after signature verification
        const eventData = JSON.parse(rawBody);

        if (eventData.event !== "payment.captured") {
            return res.json({ success: true, message: "Event received but not processed" });
        }

        const { id: paymentId, order_id: razorpayOrderId } = eventData.payload.payment.entity;

        // Find appointment using Razorpay Order ID
        const appointment = await AppointmentRecordsSchema.findOne({ razorpay_order_id: razorpayOrderId });

        if (!appointment) {
            console.error(`❌ No appointment found for Order ID: ${razorpayOrderId}`);
            return res.status(404).json({ success: false, message: "No appointment found for this payment" });
        }

        // Update payment status
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