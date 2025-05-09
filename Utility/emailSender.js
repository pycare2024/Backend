// emailSender.js
const nodemailer = require("nodemailer");

/**
 * Dynamically creates and sends an email using the provided credentials.
 * @param {Object} options - Email sending options
 * @param {string} options.fromEmail - Sender email
 * @param {string} options.fromPassword - Sender password
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {Array} options.attachments - Attachments (optional)
 */
const sendEmail = async ({ fromEmail, fromPassword, to, subject, html, attachments = [] }) => {
  const transporter = nodemailer.createTransport({
    host: "smtpout.secureserver.net",
    port: 587,
    secure: false,
    auth: {
      user: fromEmail,
      pass: fromPassword,
    },
  });

  const mailOptions = {
    from: `"PsyCare" <${fromEmail}>`,
    to,
    subject,
    html,
    attachments,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = sendEmail;