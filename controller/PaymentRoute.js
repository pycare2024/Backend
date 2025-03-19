const express = require("express");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

const PaymentRoute = express.Router();

PaymentRoute.post("/webhook/razorpay",
    bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf.toString(); } }), 
    async (req, res) => {
    
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const razorpaySignature = req.headers["x-razorpay-signature"];

    if (!razorpaySignature) {
        console.error("❌ Missing Razorpay Signature");
        return res.status(400).json({ success: false, message: "Missing Razorpay Signature" });
    }

    if (!req.rawBody) {
        console.error("❌ Raw Body is undefined");
        return res.status(400).json({ success: false, message: "Invalid request body" });
    }

    const expectedSignature = crypto.createHmac("sha256", webhookSecret)
        .update(req.rawBody)
        .digest("hex");

    if (expectedSignature !== razorpaySignature) {
        console.error("❌ Invalid Webhook Signature");
        return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    console.log("✅ Webhook Verified:", req.body);

    if (req.body.event === "payment.captured") {
        try {
            const { id: paymentId, payment_link_id } = req.body.payload.payment.entity;

            console.log(`✅ Payment Captured! ID: ${paymentId}, Payment Link ID: ${payment_link_id}`);

            const appointment = await AppointmentRecordsSchema.findOne({ razorpay_payment_link_id: payment_link_id });

            if (!appointment) {
                console.error(`❌ No appointment found for Payment Link ID: ${payment_link_id}`);
                return res.status(404).json({ success: false, message: "No appointment found for this payment" });
            }

            appointment.payment_status = "paid";
            appointment.payment_id = paymentId;
            await appointment.save();

            console.log(`✅ Appointment Confirmed: ${appointment._id}`);

            return res.json({ success: true, message: "Payment verified and appointment confirmed" });
        } catch (error) {
            console.error("❌ Error processing webhook:", error);
            return res.status(500).json({ success: false, message: "Error processing payment verification" });
        }
    }

    return res.json({ success: true, message: "Webhook received" });
});

module.exports = PaymentRoute;