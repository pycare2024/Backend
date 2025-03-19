const express = require("express");
const crypto = require("crypto");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

const PaymentRoute = express.Router();

PaymentRoute.post("/webhook/razorpay", express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const razorpaySignature = req.headers["x-razorpay-signature"];

    if (!razorpaySignature) {
        console.error("❌ Missing Razorpay Signature");
        return res.status(400).json({ success: false, message: "Missing Razorpay Signature" });
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
            const { id: paymentId, order_id: orderId, payment_link_id, amount, status } = req.body.payload.payment.entity;

            console.log(`✅ Payment Captured! ID: ${paymentId}, Payment Link ID: ${payment_link_id}`);

            // 🔍 Find the appointment with this payment link ID
            const appointment = await AppointmentRecordsSchema.findOne({ razorpay_payment_link_id: payment_link_id });

            if (!appointment) {
                console.error(`❌ No appointment found for Payment Link ID: ${payment_link_id}`);
                return res.status(404).json({ success: false, message: "No appointment found for this payment" });
            }

            // ✅ Update the appointment with payment details
            appointment.payment_status = "paid";
            appointment.payment_id = paymentId;
            await appointment.save();

            console.log(`✅ Appointment Confirmed: ${appointment._id}`);

            // ✅ Send Confirmation Message (WATI or other notification service)
            // await sendWhatsAppMessage(appointment.patient_id, "Your appointment is confirmed!");

            return res.json({ success: true, message: "Payment verified and appointment confirmed" });
        } catch (error) {
            console.error("❌ Error processing webhook:", error);
            return res.status(500).json({ success: false, message: "Error processing payment verification" });
        }
    }

    return res.json({ success: true, message: "Webhook received" });
});

module.exports = PaymentRoute;