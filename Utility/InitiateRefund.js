// utils/initiateRefund.js (or similar)
const razorpay = require("../razorpay.js"); // ✅ this is already configured

async function InitiateRefund(paymentId) {
  try {
    const refund = await razorpay.payments.refund(paymentId);
    return refund;
  } catch (err) {
    console.error("Refund Failed:", err);
    throw err;
  }
}

module.exports = InitiateRefund;