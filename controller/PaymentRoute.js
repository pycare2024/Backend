const express = require("express");
const crypto = require("crypto");
const razorpay = require("../razorpay"); // Import Razorpay instance

const PaymentRoute = express.Router();

// 📌 Route to Create a Payment Order
PaymentRoute.post("/create-order", async (req, res) => {
    try {
        const { amount } = req.body;

        const options = {
            amount: amount * 100, // Convert to paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1, // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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
PaymentRoute.post('/webhook/razorpay', express.json(), (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const razorpaySignature = req.headers["x-razorpay-signature"];
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto.createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex");

    if (expectedSignature === razorpaySignature) {
        console.log("✅ Webhook Verified:", req.body);

        if (req.body.event === "payment.captured") {
            const paymentId = req.body.payload.payment.entity.id;
            console.log(`✅ Payment Captured! ID: ${paymentId}`);

            // TODO: Update database with payment success status
            return res.json({ success: true, message: "Payment processed" });
        }
        return res.json({ success: true, message: "Webhook received" });
    } else {
        console.error("❌ Invalid Webhook Signature");
        return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }
});

module.exports = PaymentRoute;