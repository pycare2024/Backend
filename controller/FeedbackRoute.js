const express = require("express");
const mongoose = require("mongoose");

const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");
const SRS = require("../model/SRS");
const ORSSchema = require("../model/ORSSchema");

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

module.exports = FeedbackRoute;