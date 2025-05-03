const express = require("express");
const CorporateRoute = express.Router();
const patientSchema = require("../model/patientSchema");
const Corporate = require("../model/CorporateSchema");
const razorpay = require("../razorpay");
const crypto = require("crypto");
const { DEFAULT_CIPHERS } = require("tls");

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token


// Utility to generate a unique company code from the company name
function generateCompanyCode(name) {
  const initials = name
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase(); // e.g., Tata Consultancy Services -> TCS

  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digit code
  return `${initials}${randomNum}`; // e.g., TCS2381
}

CorporateRoute.post("/register", async (req, res) => {
  try {
    const { companyName, contactPerson, email, phone, empIdFormat } = req.body;

    if (!companyName || !contactPerson || !email || !phone || !empIdFormat) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingCompany = await Corporate.findOne({ email });
    if (existingCompany) {
      return res.status(409).json({ message: "Company with this email already exists." });
    }

    const companyCode = generateCompanyCode(companyName);

    const newCompany = new Corporate({
      companyName,
      contactPerson,
      email,
      phone,
      empIdFormat,
      companyCode,
      associatedPatients: [], // ✅ empty initially
      rechargeHistory:[]
    });

    await newCompany.save();

    res.status(201).json({
      message: "Company registered successfully",
      companyCode
    });

  } catch (err) {
    console.error("❌ Company registration error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

CorporateRoute.post("/verifyCorporatePatient", async (req, res) => {
  try {
    const { companyCode, empId } = req.body;

    if (!companyCode || !empId) {
      return res.status(400).json({ message: "Company code and Employee ID are required." });
    }

    const company = await Corporate.findOne({ companyCode });

    if (!company) {
      return res.status(404).json({ message: "Company not registered with us." });
    }

    const employee = company.associatedPatients.find(p => p.empId === empId);

    if (employee) {
      return res.status(200).json({
        exists: true,
        message: "Employee exists in our records.",
        employee // ✅ Include the full employee object
      });
    } else {
      return res.status(200).json({
        exists: false,
        message: "Employee not found. Proceed to registration."
      });
    }

  } catch (error) {
    console.error("❌ Error verifying corporate patient:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
});

CorporateRoute.post("/registerCorporateEmployee", async (req, res) => {
  const { Name, Age, Gender, Location, Mobile, Problem, empId, companyCode, Department } = req.body;

  if (!Name || !Age || !Gender || !Location || !Mobile || !Problem || !empId || !companyCode || !Department) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // 1. Save the patient into the patient collection
    const newPatient = new patientSchema({
      Name,
      Age,
      Gender,
      Location,
      Mobile,
      Problem
    });

    await newPatient.save();

    // 2. Update the Corporate document to add this employee
    const updated = await Corporate.updateOne(
      { companyCode },
      {
        $push: {
          associatedPatients: {
            empId,
            employeePhone: Mobile,
            department: Department,    // ✅ add department
            familyMembers: [],
            visits: []                 // ✅ optional: initialize visits empty
          }
        }
      }
    );

    if (updated.modifiedCount === 0) {
      return res.status(404).json({ error: "Company not found." });
    }

    return res.status(201).json({
      message: "Corporate employee registered successfully",
      patientId: newPatient._id
    });

  } catch (err) {
    console.error("❌ Error registering corporate employee:", err.message);
    return res.status(500).json({ error: "Server error. Please try again later." });
  }
});

CorporateRoute.post("/registerFamilyMember", async (req, res) => {
  try {
    const {
      empId,
      companyCode,
      name,
      mobile,
      relation,
      age,
      gender,
      location,
      problem
    } = req.body;

    if (!empId || !companyCode || !name || !mobile || !relation || !age || !gender || !location || !problem) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const company = await Corporate.findOne({ companyCode });
    if (!company) {
      return res.status(404).json({ message: "Company not found." });
    }

    const employee = company.associatedPatients.find(p => p.empId === empId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found in this company." });
    }

    const familyExists = employee.familyMembers.find(m => m.mobile === mobile);
    if (familyExists) {
      return res.status(409).json({ message: "Family member already registered." });
    }

    // ✅ Register in Patients table
    const newPatient = new patientSchema({
      Name: name,
      Age: age,
      Gender: gender,
      Location: location,
      Mobile: mobile,
      Problem: problem
    });

    await newPatient.save();

    // ✅ Add family member to Corporate schema
    employee.familyMembers.push({ name, mobile, relation });

    await company.save();

    res.status(201).json({ message: "Family member registered successfully", patientId: newPatient._id });

  } catch (error) {
    console.error("Register family member error:", error.message);
    res.status(500).json({ message: "Server error. Try again." });
  }
});

CorporateRoute.post("/rechargeCredits", async (req, res) => {
  try {
    const { companyCode, credits, amount } = req.body;

    const company = await Corporate.findOne({ companyCode });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Generate Razorpay Payment Link
    const paymentLinkResponse = await razorpay.paymentLink.create({
      amount: amount * 100, // ₹ to paise
      currency: "INR",
      accept_partial: false,
      description: `${credits} Credit Recharge for ${company.companyName}`,
      notify: { sms: true, email: false },
      reference_id: `recharge_${companyCode}_${Date.now()}`,
      notes: {
        companyCode,
        credits
      }
    });

    const paymentLink = paymentLinkResponse.short_url;
    const paymentLinkId = paymentLinkResponse.id;

    // ✅ Send WhatsApp notification to company contact
    await fetch(`${WATI_API_URL}?whatsappNumber=91${company.phone}`, {
      method: "POST",
      headers: {
        Authorization: WATI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_name: "corporate_recharge",
        broadcast_name: "RechargeBroadcast",
        parameters: [
          { name: "1", value: company.contactPerson },
          { name: "2", value: credits.toString() },
          { name: "3", value: `₹${amount}` },
          { name: "4", value: paymentLink }
        ]
      })
    });

    res.status(200).json({
      message: "Payment link generated and sent",
      paymentLink,
      paymentLinkId
    });

  } catch (err) {
    console.error("Recharge error:", err.message);
    res.status(500).json({ message: "Recharge failed", error: err.message });
  }
});

CorporateRoute.post("/corporate-recharge-webhook", express.json(), async (req, res) => {
  try {
    const webhookSecret = "credits@2025PsyCare";
    const receivedSignature = req.headers["x-razorpay-signature"];
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== receivedSignature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const { event, payload } = req.body;

    if (event === "payment.captured") {
      const payment = payload.payment.entity;
      const notes = payment.notes;
      const { companyCode, credits } = notes;

      if (!companyCode || !credits) {
        return res.status(400).json({ message: "Missing company code or credit value" });
      }

      const company = await Corporate.findOne({ companyCode });
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // ✅ Update company credits and record recharge
      company.totalCredits += parseInt(credits);
      company.rechargeHistory.push({
        credits: parseInt(credits),
        amount: payment.amount / 100,
        paymentId: payment.id
      });

      await company.save();

      return res.status(200).json({ message: "Recharge recorded successfully" });
    }

    res.status(200).json({ message: "Webhook received" });
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(500).json({ message: "Webhook failed", error: err.message });
  }
});

module.exports = CorporateRoute;