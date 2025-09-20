const express = require("express");
const mongoose = require("mongoose");
const WebinarSchema = require("../model/WebinarSchema");
const patientSchema = require("../model/patientSchema");
const razorpay = require("../razorpay");
const WebinarBooking = require("../model/WebinarBooking");

const WebinarRoute = express.Router();


// Get all webinars
WebinarRoute.get("/", async (req, res) => {
  try {
    const webinars = await WebinarSchema.find()
      .populate("speaker", "Name Qualification City") // populate doctor info
      .populate("attendees", "Name Mobile"); // populate patients
    return res.status(200).json({ webinars });
  } catch (err) {
    console.error("Error fetching webinars:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get a single webinar by ID
WebinarRoute.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid webinar ID." });
    }

    const webinar = await WebinarSchema.findById(id)
      .populate("speaker", "Name Qualification City")
      .populate("attendees", "Name Mobile");

    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found." });
    }

    return res.status(200).json({ webinar });
  } catch (err) {
    console.error("Error fetching webinar:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Enroll a patient into a webinar
WebinarRoute.post("/enroll", async (req, res) => {
  try {
    const { webinar_id, patient_id } = req.body;

    if (!webinar_id || !patient_id) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Validate Webinar using string webinar_id
    const webinar = await WebinarSchema.findOne({ webinar_id });
    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found." });
    }

    // Validate Patient
    const patient = await patientSchema.findById(patient_id);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    // Check seat availability
    if (webinar.attendees.length >= webinar.maxSeats) {
      return res.status(400).json({ message: "No seats available for this webinar." });
    }

    // Calculate price with 18% GST
    const basePrice = webinar.price || 0;
    const finalPrice = basePrice + Math.round(basePrice * 0.18);

    // Create booking (pending payment)
    const booking = await new WebinarBooking({
      webinar_id, // string ID
      patient_id,
      pateint_name: patient.Name,
      payment_status: "pending",
    }).save();

    // Generate Razorpay payment link
    const paymentLink = await razorpay.paymentLink.create({
      amount: finalPrice * 100, // Razorpay expects paise
      currency: "INR",
      accept_partial: false,
      description: `Enrollment for webinar: ${webinar.title}`,
      reference_id: `webinar_booking_${booking._id}`,
      notify: { sms: true },
      notes: {
        booking_id: booking._id.toString(),  // use booking MongoDB _id for webhook
        patient_id: patient._id.toString(),
        webinar_id: webinar_id, 
      },
    });

    // Save payment link ID in booking
    booking.payment_link_id = paymentLink.id;
    await booking.save();

    return res.status(200).json({
      message: "Webinar booking initiated. Awaiting payment.",
      bookingId: booking._id,
      paymentLink: paymentLink.short_url,
      webinarTitle: webinar.title,
    });
  } catch (err) {
    console.error("❌ Error enrolling in webinar:", err);
    return res.status(500).json({ message: "Internal server error.", error: err.message });
  }
});

module.exports = WebinarRoute;






