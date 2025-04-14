const crypto = require("crypto");

// ✅ Your Razorpay webhook secret
const secret = "credits@2025PsyCare";

// ✅ Payload string as sent in curl
const payload = JSON.stringify({
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "QIwfcnaFa614kp",
        amount: 100,
        currency: "INR",
        notes: {
          companyCode: "ME2104",
          credits: "30"
        }
      }
    }
  }
});

const signature = crypto
  .createHmac("sha256", secret)
  .update(payload)
  .digest("hex");

console.log("Generated Signature:", signature);