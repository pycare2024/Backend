const express = require("express");
const CorporateRoute = express.Router();
const patientSchema = require("../model/patientSchema");
const Corporate = require("../model/CorporateSchema");
const razorpay = require("../razorpay");
const crypto = require("crypto");
const { DEFAULT_CIPHERS } = require("tls");
const ScreeningTestSchema = require("../model/NewScreeningTestSchema");
const AppointmentRecords = require("../model/AppointmentRecordsSchema");
const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");
const NewScreeningTestSchema = require("../model/NewScreeningTestSchema");
const CorporateEmployeeMasterSchema = require("../model/CorporateEmployeeMasterSchema");

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token


function getSeverityLevel(tool, score) {
  if (tool === "PHQ-9") {
    if (score <= 4) return "Minimal";
    if (score <= 9) return "Mild";
    if (score <= 14) return "Moderate";
    if (score <= 19) return "ModeratelySevere";
    return "Severe";
  }
  if (tool === "BDI-II") {
    if (score <= 13) return "Minimal";
    if (score <= 19) return "Mild";
    if (score <= 28) return "Moderate";
    return "Severe";
  }
  if (tool === "GAD-7") {
    if (score <= 4) return "Minimal";
    if (score <= 9) return "Mild";
    if (score <= 14) return "Moderate";
    return "Severe";
  }
  if (tool === "BAI") {
    if (score <= 7) return "Minimal";
    if (score <= 15) return "Mild";
    if (score <= 25) return "Moderate";
    return "Severe";
  }
  if (tool === "ISI") {
    if (score <= 7) return "No Issues";
    if (score <= 14) return "Subthreshold";
    if (score <= 21) return "Moderate";
    return "Severe";
  }
  if (tool === "PCL-5") {
    return score >= 33 ? "Clinically Significant" : "Not Clinically Significant";
  }
  if (tool === "Y-BOCS-II") {
    if (score <= 7) return "Subclinical";
    if (score <= 15) return "Mild";
    if (score <= 23) return "Moderate";
    if (score <= 31) return "Severe";
    return "Extreme";
  }
  return "Unknown";
}

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

function generateEmployeeMessage(employee) {
  let message = `✅ Employee Details:\n\n`;
  message += `- Employee ID: ${employee.empId}\n`;
  message += `- Phone: ${employee.employeePhone}\n`;
  message += `- Department: ${employee.department}\n\n`;

  message += `👨‍👩‍👧‍👦 Family Members:\n`;

  employee.familyMembers.forEach((member, index) => {
    message += `${index + 1}. ${member.name} (${member.relation}) - ${member.mobile}\n`;
  });

  message += `\n✏️ Please enter the mobile number of the person you want to proceed with.`;

  return message;
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
      rechargeHistory: []
    });

    await newCompany.save();

    try {
      await fetch(`${WATI_API_URL}?whatsappNumber=91${phone}`, {
        method: "POST",
        headers: {
          "Authorization": WATI_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          template_name: "corporate_registration",
          broadcast_name: "Corporate Welcome",
          parameters: [
            { name: "Company_Name", value: companyName },
            { name: "Company_code", value: companyCode }
          ]
        })
      });
      console.log("✅ WhatsApp message sent successfully.");
    } catch (waError) {
      console.error("⚠️ Failed to send WhatsApp message:", waError.message);
    }

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

    // 1. Check in the master list first
    const masterRecord = await CorporateEmployeeMasterSchema.findOne({ companyCode, empId });
    if (!masterRecord) {
      return res.status(404).json({ message: "❌ You are not authorized to register under this company." });
    }

    // 2. Check if company exists in Corporate collection
    const company = await Corporate.findOne({ companyCode });
    if (!company) {
      return res.status(404).json({ message: "Company not registered in system." });
    }

    const employee = company.associatedPatients.find(p => p.empId === empId);
    if (employee) {
      return res.status(200).json({
        exists: true,
        message: "Employee already registered.",
        companyName: company?.companyName,
        employee
      });
    }

    return res.status(400).json({
      exists: false,
      message: "✅ Verified employee. Proceed to registration.",
      companyName: company?.companyName,
      masterRecord: {
        name: masterRecord.name,
        empId: masterRecord.empId
      }
    });

  } catch (error) {
    console.error("❌ Error verifying corporate patient:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
});

CorporateRoute.post("/registerCorporateEmployee", async (req, res) => {
  const { Age, Gender, Location, Mobile, Problem, empId, companyCode, Department } = req.body;

  // ✅ Validate essential fields (excluding name, which will be fetched from master)
  if (!Age || !Gender || !Location || !Mobile || !Problem || !empId || !companyCode || !Department) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // ✅ 1. Get name from master record
    const masterRecord = await CorporateEmployeeMasterSchema.findOne({ companyCode, empId });

    if (!masterRecord) {
      return res.status(403).json({ error: "❌ You are not in the authorized employee list for this company." });
    }

    const Name = masterRecord.name;

    // ✅ 2. Create new patient document
    const newPatient = new patientSchema({
      Name,
      Age,
      Gender,
      Location,
      Mobile,
      Problem,
      userType: "corporate",
      empId,
      companyCode
    });

    await newPatient.save();

    // ✅ 3. Push to Corporate collection
    const updateResult = await Corporate.updateOne(
      { companyCode },
      {
        $push: {
          associatedPatients: {
            empId,
            employeePhone: Mobile,
            department: Department,
            familyMembers: [],
            visits: []
          }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ error: "Company not found." });
    }

    // ✅ 4. Mark as registered in master list
    await CorporateEmployeeMasterSchema.updateOne(
      { companyCode, empId },
      { $set: { registered: true } }
    );

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

    // Check if family member is already registered
    const familyExists = employee.familyMembers.find(m => m.mobile === mobile);
    if (familyExists) {
      return res.status(409).json({ message: "Family member already registered." });
    }

    // ✅ Register family member in Patients table
    const newPatient = new patientSchema({
      Name: name,
      Age: age,
      Gender: gender,
      Location: location,
      Mobile: mobile,
      Problem: problem,
      userType: "corporate",   // family member under corporate patient
      empId: empId,            // linking to employee's empId
      companyCode: companyCode, // linking to company code
      isFamilyMember: true,
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

const instrumentMap = {
  depression: [{ name: "PHQ-9", count: 9 }, { name: "BDI-II", count: 21 }],
  anxiety: [{ name: "GAD-7", count: 7 }, { name: "BAI", count: 21 }],
  sleep: [{ name: "ISI", count: 7 }],
  ptsd: [{ name: "PCL-5", count: 20 }],
  ocd: [{ name: "Y-BOCS-II", count: 20 }]
};

CorporateRoute.get("/:companyCode/screening-summary", async (req, res) => {
  try {
    const { companyCode } = req.params;
    const { startDate, endDate } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999); // Include full day

    // 1. Fetch company
    const corporate = await Corporate.findOne({ companyCode });
    if (!corporate) {
      return res.status(404).json({ message: "Company not found" });
    }

    // 2. empId -> department mapping
    const empIdToDepartmentMap = {};
    corporate.associatedPatients.forEach(ap => {
      empIdToDepartmentMap[ap.empId] = ap.department || "Unknown";
    });

    // 3. Fetch patients (excluding family members)
    const patients = await patientSchema.find({
      empId: { $in: Object.keys(empIdToDepartmentMap) },
      companyCode,
      isFamilyMember: { $ne: true }  // Exclude family members
    });

    if (!patients.length) {
      return res.status(404).json({ message: "No employees found for this company." });
    }

    // 4. _id -> department mapping
    const patientIdToDepartment = {};
    patients.forEach(patient => {
      const department = empIdToDepartmentMap[patient.empId] || "Unknown";
      patientIdToDepartment[patient._id.toString()] = department;
    });

    // 5. Fetch screening tests
    const screenings = await ScreeningTestSchema.find({
      patient_id: { $in: patients.map(p => p._id) },
      companyCode,
      DateOfTest: { $gte: start, $lte: end }
    });

    if (!screenings.length) {
      return res.status(404).json({ message: "No screening tests found in this date range." });
    }

    console.log("Running Mental health screening summary test");

    // 6. Prepare instruments
    const instruments = [];
    for (const category in instrumentMap) {
      instrumentMap[category].forEach(inst => {
        instruments.push(inst.name);
      });
    }

    // 7. Thresholds
    const PHQ9_THRESHOLD = 10;
    const BDI2_THRESHOLD = 20;
    const GAD7_THRESHOLD = 10;
    const BAI_THRESHOLD = 16;
    const ISI_THRESHOLD = 15;
    const PCL5_THRESHOLD = 33;
    const YBOCS2_THRESHOLD = 16;

    // 8. Initialize
    const departmentScores = {}; // { dept: { PHQ-9: [], GAD-7: [], etc. } }
    let insomniaCount = 0;
    let anxietyCount = 0;
    let depressionCount = 0;
    let ptsdCount = 0;

    // 9. Process each screening
    screenings.forEach(screening => {
      console.log("Patient id->", screening.patient_id.toString());
      const department = patientIdToDepartment[screening.patient_id.toString()] || "Unknown";

      if (!departmentScores[department]) {
        departmentScores[department] = {
          "PHQ-9": [], "BDI-II": [],
          "GAD-7": [], "BAI": [],
          "ISI": [], "PCL-5": [],
          "Y-BOCS-II": []
        };
      }

      const scores = screening.scores || {};
      const plainScores = scores instanceof Map ? Object.fromEntries(scores) : scores;

      // Fill department scores
      instruments.forEach(instr => {
        if (plainScores[instr] !== undefined) {
          departmentScores[department][instr].push(plainScores[instr]);
        }
      });

      // Threshold-based counts
      let hasDepression = false;

      if (plainScores["PHQ-9"] !== undefined && plainScores["PHQ-9"] >= PHQ9_THRESHOLD) {
        hasDepression = true;
      };
      if (plainScores["BDI-II"] !== undefined && plainScores["BDI-II"] >= BDI2_THRESHOLD) {
        hasDepression = true;
      };

      if (hasDepression) {
        depressionCount++;
      }

      let hasAnxiety = false;

      if (plainScores["GAD-7"] !== undefined && plainScores["GAD-7"] >= GAD7_THRESHOLD) {
        hasAnxiety = true;
      }
      if (plainScores["BAI"] !== undefined && plainScores["BAI"] >= BAI_THRESHOLD) {
        hasAnxiety = true;
      }

      if (hasAnxiety) {
        anxietyCount++;
      }

      if (plainScores["ISI"] !== undefined && plainScores["ISI"] >= ISI_THRESHOLD) insomniaCount++;

      if (plainScores["PCL-5"] !== undefined && plainScores["PCL-5"] >= PCL5_THRESHOLD) ptsdCount++;
    });

    // 10. Response
    return res.json({
      companyName: corporate.companyName,
      totalScreenings: screenings.length,
      totalPatients: patients.length, // Count total patients (employees + family members)
      insomniaCases: insomniaCount,
      anxietyCases: anxietyCount,
      depressionCases: depressionCount,
      ptsdCases: ptsdCount,
      departmentScores
    });

  } catch (error) {
    console.error("Error generating screening summary:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

CorporateRoute.get('/demographic-insights/:companyCode', async (req, res) => {
  try {
    const { companyCode } = req.params;

    // 1. Fetch patients of this company
    const patients = await patientSchema.find({ companyCode });

    if (patients.length === 0) {
      return res.status(404).json({ message: "No patients found for this company." });
    }

    // 2. Age group breakdown
    const ageGroups = {
      "18-25": 0,
      "26-35": 0,
      "36-45": 0,
      "46-60": 0,
      "60+": 0,
      "Unknown": 0
    };

    patients.forEach(patient => {
      const age = patient.Age;
      if (typeof age !== 'number') {
        ageGroups["Unknown"] += 1;
      } else if (age >= 18 && age <= 25) {
        ageGroups["18-25"] += 1;
      } else if (age >= 26 && age <= 35) {
        ageGroups["26-35"] += 1;
      } else if (age >= 36 && age <= 45) {
        ageGroups["36-45"] += 1;
      } else if (age >= 46 && age <= 60) {
        ageGroups["46-60"] += 1;
      } else if (age > 60) {
        ageGroups["60+"] += 1;
      } else {
        ageGroups["Unknown"] += 1;
      }
    });

    // 3. Gender split
    const genderSplit = {
      Male: 0,
      Female: 0,
      Other: 0,
      Unknown: 0
    };

    patients.forEach(patient => {
      const gender = patient.Gender ? patient.Gender.toLowerCase() : "unknown";
      if (gender === "male") genderSplit.Male += 1;
      else if (gender === "female") genderSplit.Female += 1;
      else if (gender === "other") genderSplit.Other += 1;
      else genderSplit.Unknown += 1;
    });

    // 4. Location-wise participation
    const locationParticipation = {};

    patients.forEach(patient => {
      const loc = patient.Location || "Unknown";
      if (!locationParticipation[loc]) {
        locationParticipation[loc] = 1;
      } else {
        locationParticipation[loc]++;
      }
    });

    // 5. Final response
    res.json({
      companyCode,
      totalPatients: patients.length,
      ageGroups,
      genderSplit,
      locationParticipation
    });

  } catch (error) {
    console.error("Error generating Demographic Insights Report:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Route to generate message
CorporateRoute.post('/generate-message', (req, res) => {
  const { employee } = req.body;

  if (!employee) {
    return res.status(400).json({ error: 'Employee data is required.' });
  }

  // Step 1: Use the generateEmployeeMessage function
  const messageText = generateEmployeeMessage(employee);

  // Step 2: Final WATI message structure
  const response = {
    messages: [
      {
        type: "text",
        text: messageText
      }
    ]
  };

  // Step 3: Send the response
  res.json(response);
});

CorporateRoute.get("/:companyCode/clinical-impact", async (req, res) => {
  const { companyCode } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: "Start and end date are required." });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  end.setHours(23, 59, 59, 999);

  try {
    const screenings = await ScreeningTestSchema.find({
      companyCode,
      DateOfTest: { $gte: start, $lte: end }
    });

    console.log(`Total Screenings found -> ${screenings.length}`);

    const severityCounts = {
      mild: 0,
      moderate: 0,
      moderately_severe: 0,
      severe: 0,
    };

    const toolSeverity = (tool, score) => {
      if (tool === "PHQ-9") {
        if (score <= 4) return "mild";
        if (score <= 9) return "moderate";
        if (score <= 14) return "moderately_severe";
        return "severe";
      } else if (tool === "BDI-II") {
        if (score <= 13) return "mild";
        if (score <= 19) return "moderate";
        if (score <= 28) return "moderately_severe";
        return "severe";
      } else if (tool === "GAD-7") {
        if (score <= 4) return "mild";
        if (score <= 9) return "moderate";
        if (score <= 14) return "moderately_severe";
        return "severe";
      } else if (tool === "BAI") {
        if (score <= 7) return "mild";
        if (score <= 15) return "moderate";
        if (score <= 25) return "moderately_severe";
        return "severe";
      } else if (tool === "ISI") {
        if (score <= 7) return "mild"; // No issues
        if (score <= 14) return "moderate"; // Subthreshold
        if (score <= 21) return "moderately_severe";
        return "severe";
      } else if (tool === "PCL-5") {
        return score >= 33 ? "severe" : "mild"; // Rough mapping
      } else if (tool === "Y-BOCS-II") {
        if (score <= 7) return "mild"; // Subclinical
        if (score <= 15) return "moderate";
        if (score <= 23) return "moderately_severe";
        return "severe";
      }
      return null;
    };

    let trendSummary = "No summary available."; // ✅ camelCase

    const patientEngagementMap = new Map(); // track who booked appointments
    const patientTestDates = new Map(); // track test date by patient
    const patientRepeatTests = {}; // patient_id -> count

    for (const record of screenings) {
      const { scores, patient_id, DateOfTest } = record;

      // console.log("Logging Scores=>", scores);

      // If scores is a Map, convert it to a plain object or iterate over it
      if (scores && scores instanceof Map) {
        // Convert Map to a plain object
        const scoresObject = Object.fromEntries(scores);

        // console.log("Converted Scores=>", scoresObject);

        // Iterate through the keys in the plain object
        for (const tool in scoresObject) {
          // console.log("Logging tool=>", tool);
          const level = toolSeverity(tool, scoresObject[tool]);
          if (level) severityCounts[level]++;
        }
      } else {
        console.log("Scores is not in the expected format:", scores);
      }

      if (!patientTestDates.has(patient_id.toString())) {
        patientTestDates.set(patient_id.toString(), []);
      }
      patientTestDates.get(patient_id.toString()).push(new Date(DateOfTest));
      patientRepeatTests[patient_id.toString()] = (patientRepeatTests[patient_id.toString()] || 0) + 1;
    }

    // console.log("Logging patient repeat tests=>", patientRepeatTests);

    const patients = await patientSchema.find({ companyCode: companyCode }).select('_id');
    const patientIds = (await ScreeningTestSchema.find({ companyCode: companyCode }).select('patient_id')).map(p => p.patient_id);

    console.log(`Total Patients from the Company -> ${companyCode} is -> ${patients.length}\n`);
    console.log(`Patient's ids who took screening tests -> ${patientIds.length}\n`);
    console.log("Patients who took screening tests ->", patientIds);

    const appointments = await AppointmentRecordsSchema.find({
      patient_id: { $in: patientIds },
      DateOfAppointment: { $gte: start, $lte: end },
      // appointment_status: { $in: ["completed"] }
    });

    let completedCount = 0;
    let noShowCount = 0;
    let cancelledCount = 0;

    console.log(`appointments count -> ${appointments.length}`);

    for (const appointment of appointments) {
      const patientIdStr = appointment.patient_id?.toString();
      const tests = patientTestDates.get(patientIdStr) || [];

      // console.log("Logging tests=>", tests);

      // console.log("Patient Engagement Map=>", patientEngagementMap);

      for (const testDate of tests) {

        const appDate = new Date(appointment.DateOfAppointment).toISOString().split('T')[0];
        const testDateOnly = new Date(testDate).toISOString().split('T')[0];

        // console.log("Date of app=>", appDate);
        // console.log("Date of tests=>", testDateOnly);

        if (appDate >= testDateOnly) {
          patientEngagementMap.set(patientIdStr, true);

          const status = appointment.appointment_status?.toLowerCase().trim();

          console.log("Appointment Status ->", status);

          if (status === "completed") completedCount++;
          else if (status === "cancelled") cancelledCount += 1;
          else if (status === "no_show") noShowCount += 1;

          break;
        }
      }

      // console.log("Patient Engagement Map=>", patientEngagementMap);

      const followUpDetails = [];

      for (const [patientIdStr] of patientEngagementMap.entries()) {
        const followUps = await AppointmentRecordsSchema.find({
          patient_id: patientIdStr,
          DateOfAppointment: { $gte: start, $lte: end },
          appointment_status: "completed"
        }).select("patientName DateOfAppointment notes recommendations");

        // console.log("Follow Ups=>",followUps);

        const formattedEntries = followUps.map(app => ({
          name: app.patientName || "No name",
          date: app.DateOfAppointment.toISOString().split("T")[0],
          notes: app.notes || "No notes",
          recommendations: app.recommendations || "No recommendations"
        }));

        // console.log("Formatted Entries=>",formattedEntries);

        followUpDetails.push({
          patientId: patientIdStr,
          entries: formattedEntries
        });

        // console.log("Follow Up Details=>", JSON.stringify(followUpDetails, null, 2));
      }

      console.log("Follow Up Details=>", JSON.stringify(followUpDetails, null, 2));

      const geminiResponse = await fetch("https://backend-xhl4.onrender.com/GeminiRoute/analyze-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpDetails }),  // ← replace trendGroups with followUpDetails
      });

      const geminiData = await geminiResponse.json();
      trendSummary = geminiData.trendSummary || "No summary available.";
    }

    const result = {
      companyCode,
      startDate,
      endDate,
      totalScreenings: screenings.length,
      severityBreakdown: severityCounts,
      appointmentBreakdown: {
        Total_appointments: appointments.length,
        completed: completedCount,
        no_show: noShowCount,
        cancelled: cancelledCount,
        followups: appointments.length - (completedCount + noShowCount + cancelledCount),
      },
      followUpAppointments: patientEngagementMap.size,
      repeatScreenings: Object.values(patientRepeatTests).filter(c => c > 1).length,
      followUpTrends: trendSummary,
    };

    console.log("Appointment Breakdown -> ", result.appointmentBreakdown);

    res.json(result);
  } catch (error) {
    console.error("Clinical impact fetch error:", error);
    res.status(500).json({ message: "Failed to fetch clinical impact data", error: error.message });
  }
});

const categorizeScore = (tool, score) => {
  const categories = {
    "PHQ-9": [
      [0, 4, "Minimal"],
      [5, 9, "Mild"],
      [10, 14, "Moderate"],
      [15, 19, "Moderately Severe"],
      [20, 27, "Severe"]
    ],
    "BDI-II": [
      [0, 13, "Minimal"],
      [14, 19, "Mild"],
      [20, 28, "Moderate"],
      [29, 63, "Severe"]
    ],
    "GAD-7": [
      [0, 4, "Minimal"],
      [5, 9, "Mild"],
      [10, 14, "Moderate"],
      [15, 21, "Severe"]
    ],
    "BAI": [
      [0, 7, "Minimal"],
      [8, 15, "Mild"],
      [16, 25, "Moderate"],
      [26, 63, "Severe"]
    ],
    "ISI": [
      [0, 7, "No issues"],
      [8, 14, "Subthreshold"],
      [15, 21, "Moderate"],
      [22, 28, "Severe"]
    ],
    "PCL-5": [
      [0, 32, "Not Clinically Significant"],
      [33, 80, "Clinically Significant"]
    ]
    // Add Y-BOCS-II etc. as needed
  };

  const toolCategories = categories[tool];
  if (!toolCategories) return "Unknown";

  for (const [min, max, label] of toolCategories) {
    if (score >= min && score <= max) return label;
  }

  return "Unknown";
};

CorporateRoute.post("/summary-per-patient", async (req, res) => {
  const { companyCode, startDate, endDate } = req.body;

  if (!companyCode || !startDate || !endDate) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const records = await NewScreeningTestSchema.find({
      companyCode,
      DateOfTest: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    const patientMap = new Map();

    records.forEach(record => {
      const patientId = record.patient_id.toString();

      if (!patientMap.has(patientId)) {
        patientMap.set(patientId, { patient_id: patientId });
      }

      const patientData = patientMap.get(patientId);

      const rawScores = record.scores instanceof Map
        ? Object.fromEntries(record.scores)
        : record.scores;

      for (const [tool, score] of Object.entries(rawScores)) {
        if (typeof score !== 'number') continue;

        const category = categorizeScore(tool, score);
        if (!category) continue;

        if (!patientData[category]) {
          patientData[category] = 0;
        }

        patientData[category]++;
      }
    });

    const result = Array.from(patientMap.values());

    // ✅ ENRICH with patient details
    const enriched = await Promise.all(
      result.map(async entry => {
        const patient = await patientSchema.findById(entry.patient_id).lean();
        console.log("patient=>", patient);
        return {
          ...entry,
          name: patient?.Name || "Unknown",
          phone: patient?.Mobile || "",
        };
      })
    );

    // ✅ SORT by Severe count
    enriched.sort((a, b) => (b.Severe || 0) - (a.Severe || 0));

    // ✅ Format output for frontend (optional, if you want consistent keys)
    const allCategories = [
      'Severe', 'Moderate', 'Mild', 'Minimal', 'Subthreshold',
      'No issues', 'Unknown', 'Clinically Significant',
      'Not Clinically Significant', 'Moderately Severe'
    ];

    const formatted = enriched.map(entry => {
      const formattedEntry = {
        patient_id: entry.patient_id,
        name: entry.name,
        phone: entry.phone,
        email: entry.email
      };
      allCategories.forEach(cat => {
        formattedEntry[cat] = entry[cat] || 0;
      });
      return formattedEntry;
    });

    res.json({ data: formatted });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

CorporateRoute.post("/categorize-overall-severity", async (req, res) => {
  const { companyCode, startDate, endDate } = req.body;

  if (!companyCode || !startDate || !endDate) {
    return res.status(400).json({ message: "Missing companyCode or date range." });
  }

  try {
    const screenings = await NewScreeningTestSchema.find({
      company_code: companyCode,
      DateOfTest: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });

    const severityRanks = {
      "minimal": 0,
      "mild": 1,
      "moderate": 2,
      "moderately_severe": 3,
      "severe": 4,
      "extreme": 5
    };

    const toolSeverity = (tool, score) => {
      if (tool === "PHQ-9") {
        if (score <= 4) return "mild";
        if (score <= 9) return "moderate";
        if (score <= 14) return "moderately_severe";
        return "severe";
      } else if (tool === "BDI-II") {
        if (score <= 13) return "mild";
        if (score <= 19) return "moderate";
        if (score <= 28) return "moderately_severe";
        return "severe";
      } else if (tool === "GAD-7") {
        if (score <= 4) return "mild";
        if (score <= 9) return "moderate";
        if (score <= 14) return "moderately_severe";
        return "severe";
      } else if (tool === "BAI") {
        if (score <= 7) return "mild";
        if (score <= 15) return "moderate";
        if (score <= 25) return "moderately_severe";
        return "severe";
      } else if (tool === "ISI") {
        if (score <= 7) return "mild"; // No issues
        if (score <= 14) return "moderate"; // Subthreshold
        if (score <= 21) return "moderately_severe";
        return "severe";
      } else if (tool === "PCL-5") {
        return score >= 33 ? "severe" : "mild"; // Rough mapping
      } else if (tool === "Y-BOCS-II") {
        if (score <= 7) return "mild"; // Subclinical
        if (score <= 15) return "moderate";
        if (score <= 23) return "moderately_severe";
        return "severe";
      }
      return null;
    };

    // console.log("Screenings -> ",screenings);

    const rankToLabel = Object.keys(severityRanks).reduce((obj, key) => {
      obj[severityRanks[key]] = key;
      return obj;
    }, {});

    // console.log("Rank to label->", rankToLabel);

    // console.log("Severity Rank -> ",severityRanks[]);

    const result = [];

    for (const record of screenings) {
      const { scores, patient_id } = record;

      // console.log("scores->",scores,"patient_id->",patient_id);

      let maxSeverityRank = -1;

      if (scores && scores instanceof Map) {
        const scoresObject = Object.fromEntries(scores);

        // console.log("Scores object => ",scoresObject);

        for (const tool in scoresObject) {
          // console.log("tools->",tool);
          const level = toolSeverity(tool, scoresObject[tool]);
          // console.log("Level->", level, "severityRank of level->", severityRanks[level], "Max severity rank->", maxSeverityRank);
          if (level && severityRanks[level] > maxSeverityRank) {
            maxSeverityRank = severityRanks[level];
          }
        }
      }

      if (maxSeverityRank >= 0) {
        result.push({
          patient_id,
          overallSeverity: rankToLabel[maxSeverityRank].replace(/_/g, ' ')
        });
      }
    }

    res.json({
      evaluations: result,
      count: result.length // Add count if you want to use it on frontend
    });

  } catch (error) {
    console.error("Error categorizing severity:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// CorporateRoute.post("/categorize-overall-severity", async (req, res) => {
//   const { companyCode, startDate, endDate } = req.body;

//   if (!companyCode || !startDate || !endDate) {
//     return res.status(400).json({ message: "Missing companyCode or date range." });
//   }

//   try {
//     const screenings = await NewScreeningTestSchema.find({
//       company_code: companyCode,
//       DateOfTest: { $gte: new Date(startDate), $lte: new Date(endDate) }
//     });

//     // Group by patient_id and keep only the latest test
//     const latestScreeningsMap = new Map();

//     for (const screening of screenings) {
//       const pid = screening.patient_id.toString();
//       const current = latestScreeningsMap.get(pid);

//       if (!current || new Date(screening.DateOfTest) > new Date(current.DateOfTest)) {
//         latestScreeningsMap.set(pid, screening);
//       }
//     }

//     const severityRanks = {
//       "minimal": 0,
//       "mild": 1,
//       "moderate": 2,
//       "moderately_severe": 3,
//       "severe": 4,
//       "extreme": 5
//     };

//     const toolSeverity = (tool, score) => {
//       if (tool === "PHQ-9") return score <= 4 ? "mild" : score <= 9 ? "moderate" : score <= 14 ? "moderately_severe" : "severe";
//       if (tool === "BDI-II") return score <= 13 ? "mild" : score <= 19 ? "moderate" : score <= 28 ? "moderately_severe" : "severe";
//       if (tool === "GAD-7") return score <= 4 ? "mild" : score <= 9 ? "moderate" : score <= 14 ? "moderately_severe" : "severe";
//       if (tool === "BAI") return score <= 7 ? "mild" : score <= 15 ? "moderate" : score <= 25 ? "moderately_severe" : "severe";
//       if (tool === "ISI") return score <= 7 ? "mild" : score <= 14 ? "moderate" : score <= 21 ? "moderately_severe" : "severe";
//       if (tool === "PCL-5") return score >= 33 ? "severe" : "mild";
//       if (tool === "Y-BOCS-II") return score <= 7 ? "mild" : score <= 15 ? "moderate" : score <= 23 ? "moderately_severe" : "severe";
//       return null;
//     };

//     const result = [];

//     for (const [, record] of latestScreeningsMap.entries()) {
//       const { scores, patient_id } = record;

//       let maxSeverityRank = -1;

//       if (scores && scores instanceof Map) {
//         const scoresObject = Object.fromEntries(scores);

//         for (const tool in scoresObject) {
//           const level = toolSeverity(tool, scoresObject[tool]);
//           const rank = severityRanks[level];
//           if (level && rank > maxSeverityRank) {
//             maxSeverityRank = rank;
//           }
//         }
//       }

//       if (maxSeverityRank >= 0) {
//         result.push({
//           patient_id,
//           overallSeverity: Object.keys(severityRanks).find(key => severityRanks[key] === maxSeverityRank)
//         });
//       }
//     }

//     res.json({
//       evaluations: result,
//       count: result.length // Add count if you want to use it on frontend
//     });

//   } catch (error) {
//     console.error("Error in categorize-overall-severity:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// });

CorporateRoute.post("/bulk-insert", async (req, res) => {
  try {
    const { companyCode, employees } = req.body;

    if (!companyCode || !Array.isArray(employees)) {
      return res.status(400).json({ message: "Invalid input." });
    }

    const formatted = employees.map(emp => ({
      companyCode,
      empId: emp.empId,
      name: emp.name,
      registered: false
    }));

    const result = await CorporateEmployeeMasterSchema.insertMany(formatted, { ordered: false });
    res.status(200).json({ message: "Employees inserted", insertedCount: result.length });
  } catch (error) {
    console.error("Bulk insert error:", error.code === 11000 ? "Duplicate empId" : error);
    res.status(500).json({ message: "Failed to insert some or all employees", error: error.message });
  }
});

CorporateRoute.get("/corporate/:companyCode", async (req, res) => {
  try {
    const { companyCode } = req.params;

    if (!companyCode) {
      return res.status(400).json({ message: "Company code is required." });
    }

    // Find the corporate by companyCode
    const corporate = await Corporate.findOne({ companyCode }).lean();

    if (!corporate) {
      return res.status(404).json({ message: "Corporate not found." });
    }

    // Return the corporate data
    res.status(200).json(corporate);

  } catch (error) {
    console.error("Error fetching corporate:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = CorporateRoute;