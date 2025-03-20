const crypto = require("crypto");

const webhookSecret = "Agarwal@2020"; // Use your actual Razorpay webhook secret
const payload = JSON.stringify({
    "event": "payment.captured",
    "payload": {
        "payment": {
            "entity": {
                "id": "pay_Q8xewUSaBzebaa",
                "amount": 100,
                "currency": "INR",
                "notes": {
                    "payment_link_id": "plink_Q8xeVK8YYeVQpg"
                }
            }
        }
    }
});

const generatedSignature = crypto.createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

console.log("Generated Signature:", generatedSignature);