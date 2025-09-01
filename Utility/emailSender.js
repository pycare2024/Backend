// emailSender.js
const nodemailer = require("nodemailer");

/**
 * Dynamically creates and sends an email using the provided credentials.
 * @param {Object} options - Email sending options
 * @param {string} options.fromEmail - Sender email
 * @param {string} options.fromPassword - Sender password
 * @param {string} options.fromName - Sender display name (optional)
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {Array} options.attachments - Attachments (optional)
 */
const sendEmail = async ({
  fromEmail,
  fromPassword,
  fromName,
  to,
  subject,
  html,
  attachments = [],
}) => {
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
    from: `"${fromName || fromEmail.split("@")[0]}" <${fromEmail}>`, // dynamic sender name
    to,
    subject,
    html,
    attachments,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = sendEmail;