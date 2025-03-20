const crypto = require("crypto");

const webhookSecret = "Agarwal@2019"; // Use your actual Razorpay webhook secret
const payload = JSON.stringify({
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_Q8v1RkIZe7VtfI",
        "order_id": "order_Q8v0nRaAGh3TS4",
        "status": "captured"
      }
    }
  }
});

const generatedSignature = crypto.createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

console.log("Generated Signature:", generatedSignature);