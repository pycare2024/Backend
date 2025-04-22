const express = require("express");
const sendEmail = require("../Utility/emailSender");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");

const EmailRoute = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

EmailRoute.post(
  "/send-bulk",
  upload.fields([
    { name: "excelFile", maxCount: 1 },
    { name: "attachments", maxCount: 10 }, // ✅ multiple attachments
  ]),
  async (req, res) => {
    const { subject, template } = req.body;

    const excelFile = req.files?.["excelFile"]?.[0];
    const attachmentFiles = req.files?.["attachments"] || [];

    console.log("✅ Subject:", subject);
    console.log("✅ Template received:", template?.substring(0, 50), "...");
    console.log("📎 Excel File:", excelFile?.originalname);
    console.log("📎 Attachments:", attachmentFiles.map(f => f.originalname));

    if (!excelFile || !subject || !template) {
      return res.status(400).json({
        message: "Missing required fields (Excel, subject, or template)",
      });
    }

    try {
      const workbook = xlsx.readFile(excelFile.path);
      const sheetName = workbook.SheetNames[0];
      const recipients = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      console.log("📄 Total recipients loaded:", recipients.length);
      if (!recipients.length) {
        return res
          .status(400)
          .json({ message: "No recipients found in Excel." });
      }

      const attachments = attachmentFiles.map((file) => ({
        filename: file.originalname,
        path: path.resolve(file.path),
      }));

      const results = [];

      for (const recipient of recipients) {
        const { email } = recipient;
        if (!email) {
          console.warn("⚠️ Skipping entry with missing email:", recipient);
          continue;
        }

        let personalizedHtml = template;
        const placeholders = template.match(/{{(.*?)}}/g) || [];

        for (const placeholder of placeholders) {
          const key = placeholder.replace(/{{|}}/g, "").trim();
          personalizedHtml = personalizedHtml.replaceAll(
            placeholder,
            recipient[key] || ""
          );
        }

        try {
          const response = await sendEmail(
            email,
            subject,
            personalizedHtml,
            attachments
          );
          console.log(`✅ Email sent to ${email} [ID: ${response.messageId}]`);
          results.push({ email, status: "sent", messageId: response.messageId });
        } catch (err) {
          console.error(`❌ Failed to send to ${email}:`, err.message);
          results.push({ email, status: "failed", error: err.message });
        }
      }

      res.status(200).json({
        message:
          results.length > 0
            ? "Emails processed."
            : "No emails were sent. Please check your Excel file and placeholders.",
        results,
      });
    } catch (error) {
      console.error("❌ Bulk email error:", error);
      res
        .status(500)
        .json({ message: "Failed to send emails", error: error.message });
    }
  }
);

module.exports = EmailRoute;