const express = require("express");
const crypto = require("crypto");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

const PaymentRoute = express.Router();

PaymentRoute.post("/webhook/razorpay",
    express.raw({ type: "application/json" }),  
    async (req, res) => {
    try {
        console.log("🔹 Webhook hit! Raw body received:", req.body.toString()); // Log raw request body
        console.log("🔹 Headers:", req.headers); // Log request headers
        console.log("🔹 Signature:", req.headers["x-razorpay-signature"]); // Log Razorpay signature

        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const razorpaySignature = req.headers["x-razorpay-signature"];

        if (!razorpaySignature) {
            console.log("❌ Missing Razorpay Signature");
            return res.status(400).json({ success: false, message: "Missing Razorpay Signature" });
        }

        const rawBody = req.body.toString();  

        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");

        console.log(`🔹 Expected Signature: ${expectedSignature}`);
        console.log(`🔹 Received Signature: ${razorpaySignature}`);

        if (expectedSignature !== razorpaySignature) {
            console.log("❌ Invalid Razorpay Signature");
            return res.status(400).json({ success: false, message: "Invalid Razorpay Signature" });
        }

        console.log("✅ Webhook Verified!");

        const eventData = JSON.parse(rawBody);
        console.log("🔹 Event Data:", eventData);

        if (eventData.event !== "payment.captured") {
            console.log("ℹ️ Not a 'payment.captured' event. Ignoring...");
            return res.json({ success: true, message: "Event received but not processed" });
        }

        const { id: paymentId, order_id: razorpayOrderId } = eventData.payload.payment.entity;

        console.log(`🔹 Payment Captured! Payment ID: ${paymentId}, Order ID: ${razorpayOrderId}`);

        const appointment = await AppointmentRecordsSchema.findOne({ razorpay_order_id: razorpayOrderId });

        if (!appointment) {
            console.error(`❌ No appointment found for Order ID: ${razorpayOrderId}`);
            return res.status(404).json({ success: false, message: "No appointment found for this payment" });
        }

        appointment.payment_status = "paid";
        appointment.payment_id = paymentId;
        await appointment.save();

        console.log(`✅ Appointment Updated: ${appointment._id}`);

        return res.json({ success: true, message: "Payment verified, appointment confirmed" });

    } catch (error) {
        console.error("❌ Error processing webhook:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = PaymentRoute;