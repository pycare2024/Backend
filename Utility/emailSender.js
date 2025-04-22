// emailSender.js
require("dotenv").config(); // Load environment variables
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtpout.secureserver.net",  // GoDaddy SMTP
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,   // Now pulled from .env
        pass: process.env.SMTP_PASS
    }
});

const sendEmail = async (to, subject, html, attachments = []) => {
    const mailOptions = {
        from: `"PsyCare" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        attachments  // 👈 Include attachments here
    };

    return transporter.sendMail(mailOptions);
};

module.exports = sendEmail;