const express = require("express");
const CorporateRoute = express.Router();
const patientSchema = require("../model/patientSchema");
const Corporate = require("../model/CorporateSchema");
const razorpay = require("../razorpay");
const crypto = require("crypto");
const { DEFAULT_CIPHERS } = require("tls");
const ScreeningTestSchema = require("../model/NewScreeningTestSchema");
const AppointmentRecords = require("../model/AppointmentRecordsSchema");

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
        companyName: company?.companyName,
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
    // 1. Save the patient into the Patients collection
    const newPatient = new patientSchema({
      Name,
      Age,
      Gender,
      Location,
      Mobile,
      Problem,
      userType: "corporate",    // 👈 Corporate user type
      empId: empId,              // 👈 Employee ID
      companyCode: companyCode   // 👈 Company code
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
            department: Department,
            familyMembers: [],
            visits: []
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
          console.log("Patient id->",screening.patient_id.toString());
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

          if (plainScores["PHQ-9"] !== undefined && plainScores["PHQ-9"] >= PHQ9_THRESHOLD)
            {
              hasDepression=true;
            };
          if (plainScores["BDI-II"] !== undefined && plainScores["BDI-II"] >= BDI2_THRESHOLD)
            {
              hasDepression=true;
            };

          if(hasDepression)
            {
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
          companyName : corporate.companyName,
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

module.exports = CorporateRoute;