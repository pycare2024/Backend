const express = require("express");
const sendEmail = require("../Utility/emailSender");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const EmailRoute = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

EmailRoute.post("/send-single", upload.fields([
  { name: "attachments", maxCount: 10 }
]), async (req, res) => {
  const { fromEmail, fromPassword, subject, template, recipient } = req.body;

  console.log("🔐 Sender:", fromEmail);
  console.log("📧 Subject Template:", subject?.substring(0, 80));
  console.log("📝 Body Template:", template?.substring(0, 80));
  console.log("📦 Attachments:", req.files?.attachments?.map(f => f.originalname));

  if (!fromEmail || !fromPassword || !subject || !template || !recipient) {
    console.error("❌ Missing required fields.");
    return res.status(400).json({ message: "Missing required fields." });
  }

  let parsedRecipient;
  try {
    parsedRecipient = JSON.parse(recipient);
    console.log("👤 Parsed Recipient:", parsedRecipient);
  } catch (err) {
    console.error("❌ Failed to parse recipient JSON:", err.message);
    return res.status(400).json({ message: "Invalid recipient data format." });
  }

  const attachments = (req.files?.attachments || []).map(file => ({
    filename: file.originalname,
    path: path.resolve(file.path),
  }));

  try {
    let personalizedSubject = subject;
    let personalizedTemplate = template;

    const placeholders = [...(subject.match(/{{(.*?)}}/g) || []), ...(template.match(/{{(.*?)}}/g) || [])];
    const usedPlaceholders = new Set();

    for (const placeholder of placeholders) {
      const key = placeholder.replace(/{{|}}/g, "").trim();
      personalizedSubject = personalizedSubject.replaceAll(placeholder, parsedRecipient[key] || "");
      personalizedTemplate = personalizedTemplate.replaceAll(placeholder, parsedRecipient[key] || "");
      usedPlaceholders.add(key);
    }

    console.log("🔍 Replaced Placeholders:", [...usedPlaceholders]);
    console.log("📨 Sending email to:", parsedRecipient.email);

    const response = await sendEmail({
      fromEmail,
      fromPassword,
      to: parsedRecipient.email,
      subject: personalizedSubject,
      html: personalizedTemplate,
      attachments
    });

    console.log(`✅ Email sent to ${parsedRecipient.email} [ID: ${response.messageId}]`);
    res.status(200).json({
      email: parsedRecipient.email,
      status: "sent",
      messageId: response.messageId,
    });
  } catch (err) {
    console.error(`❌ Failed to send to ${parsedRecipient.email}:`, err.message);
    res.status(500).json({
      email: parsedRecipient.email,
      status: "failed",
      error: err.message,
    });
  }
});

module.exports = EmailRoute;