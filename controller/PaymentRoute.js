const express = require("express");
const PaymentRoute = express.Router();
const crypto = require("crypto");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema"); // Import DB model

PaymentRoute.post("/webhook/razorpay", async (req, res) => {
    try {
        const webhookSecret = "Payments@Psycare2025"; // Ensure it's correct
        const razorpaySignature = req.headers["x-razorpay-signature"];
        const payload = JSON.stringify(req.body);

        // 🔹 Log incoming data for debugging
        console.log("🔹 Received Webhook Data:", payload);
        console.log("🔹 Received Signature:", razorpaySignature);

        // ✅ Generate the expected signature
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(payload, "utf-8") // Ensure encoding
            .digest("hex");

        console.log("🔹 Expected Signature:", expectedSignature);

        if (expectedSignature !== razorpaySignature) {
            console.error("❌ Invalid signature");
            return res.status(400).json({ message: "Invalid signature" });
        }

        console.log("✅ Webhook verified:", req.body.event);

        if (req.body.event === "payment.captured") {
            const paymentData = req.body.payload.payment.entity;
            const razorpayPaymentId = paymentData.id;
            const razorpayOrderId = paymentData.order_id;

            // ✅ Find the appointment in DB
            const appointment = await AppointmentRecordsSchema.findOne({
                razorpay_order_id: razorpayOrderId,
            });

            if (!appointment) {
                console.error("❌ Appointment not found for this payment.");
                return res.status(404).json({ message: "Appointment not found for this payment." });
            }

            // ✅ Update payment status in DB
            appointment.payment_status = "paid";
            appointment.payment_id = razorpayPaymentId;
            await appointment.save();

            console.log(`✅ Payment verified for Appointment ID: ${appointment._id}`);

            return res.status(200).json({ message: "Payment verified and appointment confirmed." });
        }

        return res.status(400).json({ message: "Unhandled event type." });

    } catch (error) {
        console.error("❌ Webhook Error:", error);
        return res.status(500).json({ message: "Webhook processing failed.", error: error.message });
    }
});

module.exports = PaymentRoute;