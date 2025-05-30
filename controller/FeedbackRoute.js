const express = require("express");
const mongoose = require("mongoose");

const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");
const SRS = require("../model/SRS");
const ORSSchema = require("../model/ORSSchema");
const CorporateSchema = require("../model/CorporateSchema");
const PatientSchema = require("../model/patientSchema");

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token

const FeedbackRoute = express.Router();

FeedbackRoute.get("/appointments-without-feedback/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required." });
    }

    const appointments = await AppointmentRecordsSchema.find({
      patient_id: patientId,
      appointment_status: "completed",
      feedbackGiven: false
    }).sort({ date: -1 }); // most recent first

    if (!appointments.length) {
      return res.status(404).json({ message: "No pending feedback appointments found." });
    }

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Error fetching appointments without feedback:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

FeedbackRoute.post("/submit", async (req, res) => {
  try {
    const { patient_id, session_id, ratings, comments } = req.body;

    if (!mongoose.Types.ObjectId.isValid(patient_id) || !mongoose.Types.ObjectId.isValid(session_id)) {
      return res.status(400).json({ message: "Invalid patient or session ID." });
    }

    // Validate ratings
    const requiredFields = ["relationship", "goalsTopics", "approachFit", "overall"];
    for (const field of requiredFields) {
      if (
        typeof ratings[field] !== "number" ||
        ratings[field] < 0 ||
        ratings[field] > 10
      ) {
        return res.status(400).json({ message: `Invalid or missing rating for ${field}.` });
      }
    }

    // Check if appointment exists and matches
    const appointment = await AppointmentRecordsSchema.findOne({ _id: session_id, patient_id });

    if (!appointment || appointment.feedbackGiven) {
      return res.status(404).json({ message: "Feedback already submitted or appointment not found." });
    }

    // Save feedback
    const srs = new SRS({
      patient_id,
      session_id,
      ratings,
      comments: comments || ""
    });

    await srs.save();

    // Update appointment
    appointment.feedbackGiven = true;
    await appointment.save();

    res.status(201).json({ message: "Feedback submitted successfully." });

  } catch (error) {
    console.error("❌ Feedback submission failed:", error);
    res.status(500).json({ message: "Server error while submitting feedback." });
  }
});

FeedbackRoute.post("/submit-ors", async (req, res) => {
  try {
    const {
      patientId,
      therapistId,
      sessionId,
      filledBy,
      relationshipIfOther,
      ratings,
      notes
    } = req.body;

    console.log("Received Body:->",req.body);

    // Validate required fields
    if (
      !patientId || 
      !therapistId || 
      !sessionId || 
      !filledBy || 
      !ratings ||
      typeof ratings.individual !== "number" ||
      typeof ratings.interpersonal !== "number" ||
      typeof ratings.social !== "number" ||
      typeof ratings.overall !== "number"
    ) {
      return res.status(400).json({ success: false, message: "Missing or invalid required fields." });
    }

    const appointment = await AppointmentRecordsSchema.findOne({ _id: sessionId });

    if (!appointment || appointment.ORSGiven) {
      return res.status(404).json({ message: "Feedback already submitted or appointment not found." });
    }

    const feedback = new ORSSchema({
      patientId,
      therapistId,
      sessionId,
      filledBy,
      relationshipIfOther: filledBy === "Other" ? relationshipIfOther : null,
      ratings,
      notes
    });

    await feedback.save();

    appointment.ORSGiven = true;
    await appointment.save();

    

    res.status(201).json({ success: true, message: "ORS feedback submitted successfully." });
  } catch (error) {
    console.error("Error submitting ORS feedback:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

FeedbackRoute.get("/appointments-without-ORS/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required." });
    }

    const appointments = await AppointmentRecordsSchema.find({
      patient_id: patientId,
      appointment_status: "completed",
      ORSGiven: false
    }).sort({ date: -1 }); // most recent first

    if (!appointments.length) {
      return res.status(404).json({ message: "No pending feedback appointments found." });
    }

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Error fetching appointments without feedback:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

FeedbackRoute.get('/getCorporates', async (req, res) => {
  try {
    const corporates = await CorporateSchema.find({}, 'companyName'); // Adjust fields as needed
    res.json(corporates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch corporates' });
  }
});

FeedbackRoute.get('/getCorporatePatients/:id', async (req, res) => {
  try {
    const corporate = await CorporateSchema.findById(req.params.id);
    if (!corporate) return res.status(404).json({ error: 'Corporate not found' });

    const companyCode = corporate.companyCode;

    const corporatePatients = await PatientSchema.find({companyCode: companyCode});
    res.json(corporatePatients);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch corporate patients' });
  }
});

FeedbackRoute.get('/getRetailPatients', async (req, res) => {
  try {
    const retailPatients = await PatientSchema.find({ userType: 'retail' });
    res.json(retailPatients);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch retail patients' });
  }
});

FeedbackRoute.post('/sendFeedbackForms', async (req, res) => {
  try {
    const { formType, patients } = req.body;

    if (!formType || !Array.isArray(patients)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const templateName = formType === 'SRS' ? 'srs_feedback_form' :
                         formType === 'ORS' ? 'ors_feedback_form2' : null;

    if (!templateName) {
      return res.status(400).json({ error: 'Invalid form type' });
    }

    const results = [];

    await Promise.all(patients.map(async ({ name, phone }) => {
      const payload = {
        template_name: templateName,
        broadcast_name: 'sending_feedback_forms',
        parameters: [{ name: 'name', value: name }]
      };

      try {
        const response = await fetch(`${WATI_API_URL}?whatsappNumber=91${phone}`, {
          method: 'POST',
          headers: {
            Authorization: WATI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          results.push({ phone, status: 'success' });
        } else {
          const errorText = await response.text();
          results.push({ phone, status: 'failed', error: errorText });
        }
      } catch (err) {
        results.push({ phone, status: 'failed', error: err.message });
      }
    }));

    res.json({ message: 'Feedback messages processed', results });

  } catch (err) {
    console.error('Error in sending feedback forms:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = FeedbackRoute;