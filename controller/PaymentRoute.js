const crypto = require("crypto");
const express = require("express");
const PaymentRoute = express.Router();
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");

PaymentRoute.post("/webhook/razorpay", async (req, res) => {
    try {
        const { event, payload } = req.body;

        // ✅ Check if it's a payment success event
        if (event === "payment.captured") {
            const paymentData = payload.payment.entity;
            const razorpayPaymentId = paymentData.id;
            const razorpayOrderId = paymentData.order_id;

            // ✅ Find the appointment by Razorpay Order ID
            const appointment = await AppointmentRecordsSchema.findOne({
                razorpay_order_id: razorpayOrderId,
            });

            if (!appointment) {
                return res.status(404).json({ message: "Appointment not found for this payment." });
            }

            // ✅ Update appointment status
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