const express = require("express");
const crypto = require("crypto");
const razorpay = require("../razorpay"); // Import Razorpay instance

const PaymentRoute = express.Router();

// 📌 Route to Create a Payment Order
PaymentRoute.post("/create-order", async (req, res) => {
    try {
        const { amount, currency, receipt } = req.body;

        const options = {
            amount: amount * 100, // Convert to paise
            currency: currency || "INR",
            receipt: receipt || `receipt_${Date.now()}`,
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
            // ✅ Payment verified, update in database (pseudo-code)
            // await updateDatabasePaymentStatus(razorpay_order_id, "Success");

            res.json({ success: true, message: "Payment verified successfully!" });
        } else {
            res.status(400).json({ success: false, message: "Invalid signature" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

PaymentRoute.post("/create-payment-link", async (req, res) => {
    try {
        const { amount, customerName, customerEmail, customerPhone } = req.body;

        const paymentLink = await razorpay.paymentLink.create({
            amount: amount * 100, // Convert to paise
            currency: "INR",
            description: "Doctor Appointment",
            customer: {
                name: customerName,
                email: customerEmail,
                contact: customerPhone
            },
            notify: {
                sms: true,
                email: true
            },
            callback_url: "https://your-website.com/payment-success",
            callback_method: "get"
        });

        res.json({ success: true, paymentLink: paymentLink.short_url });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;


PaymentRoute.post('/webhook/razorpay', express.json(), (req, res) => {
    console.log("Received Webhook Data:", req.body);
    res.json({ success: true, message: "Webhook received" });
});

module.exports = PaymentRoute;