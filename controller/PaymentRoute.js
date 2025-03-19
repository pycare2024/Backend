const express = require("express");
const crypto = require("crypto");
const razorpay = require("../razorpay"); // Import Razorpay instance

const PaymentRoute = express.Router();

// 📌 Route to Verify Payment Signature
PaymentRoute.post("/verify-payment", async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generated_signature = hmac.digest("hex");

        if (generated_signature === razorpay_signature) {
            console.log("✅ Payment Verified:", razorpay_payment_id);

            // TODO: Update database with payment success status
            return res.json({ success: true, message: "Payment verified successfully!" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 Razorpay Webhook for Auto Payment Verification
PaymentRoute.post('/webhook/razorpay', express.json(), async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const razorpaySignature = req.headers["x-razorpay-signature"];
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto.createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex");

    if (expectedSignature !== razorpaySignature) {
        console.error("❌ Invalid Webhook Signature");
        return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    console.log("✅ Webhook Verified:", req.body);

    if (req.body.event === "payment.captured") {
        try {
            const { id: paymentId, order_id: orderId, amount, status } = req.body.payload.payment.entity;

            console.log(`✅ Payment Captured! ID: ${paymentId}, Order ID: ${orderId}`);

            // 🔍 Find the appointment with this order ID
            const appointment = await AppointmentRecordsSchema.findOne({ razorpay_order_id: orderId });

            if (!appointment) {
                console.error(`❌ No appointment found for Order ID: ${orderId}`);
                return res.status(404).json({ success: false, message: "No appointment found for this payment" });
            }

            // ✅ Update the appointment with payment details
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