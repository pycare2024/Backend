const express = require("express");
const mongoose = require("mongoose");
const WebinarSchema = require("../model/WebinarSchema");
const patientSchema = require("../model/patientSchema");
const razorpay = require("../razorpay");
const WebinarBooking = require("../model/WebinarBooking");
const crypto = require("crypto");
const WebinarRoute = express.Router();


const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token


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

// Create a new webinar
WebinarRoute.post("/create", async (req, res) => {
  try {
    const {
      webinar_id,
      title,
      description,
      speaker,
      date,
      startTime,
      endTime,
      meeting_link,
      price,
      category,
      thumbnailUrl,
      maxSeats,
    } = req.body;

    if (!webinar_id || !title || !description || !speaker || !date || !startTime || !endTime) {
      return res.status(400).json({ message: "All required fields must be provided." });
    }

    const webinar = new WebinarSchema({
      webinar_id,
      title,
      description,
      speaker,
      date,
      startTime,
      endTime,
      meeting_link,
      price,
      category,
      thumbnailUrl,
      maxSeats,
    });

    await webinar.save();

    return res.status(201).json({ message: "Webinar created successfully.", webinar });
  } catch (err) {
    console.error("Error creating webinar:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Update a webinar
WebinarRoute.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid webinar ID." });
    }

    const updatedWebinar = await WebinarSchema.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedWebinar) {
      return res.status(404).json({ message: "Webinar not found." });
    }

    return res.status(200).json({ message: "Webinar updated successfully.", webinar: updatedWebinar });
  } catch (err) {
    console.error("Error updating webinar:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Delete a webinar
WebinarRoute.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid webinar ID." });
    }

    const deletedWebinar = await WebinarSchema.findByIdAndDelete(id);

    if (!deletedWebinar) {
      return res.status(404).json({ message: "Webinar not found." });
    }

    return res.status(200).json({ message: "Webinar deleted successfully." });
  } catch (err) {
    console.error("Error deleting webinar:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Enroll into a Webinar
WebinarRoute.post("/enroll", async (req, res) => {
  try {
    const { webinar_name, patient_id } = req.body;

    if (!webinar_name || !patient_id) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Find webinar by name (title)
    const webinar = await WebinarSchema.findOne({ title: webinar_name });
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
      webinar_id: webinar.webinar_id,
      patient_id,
      pateint_name: patient.Name,
      payment_status: "pending",
    }).save();

    // Generate Razorpay payment link
    const paymentLink = await razorpay.paymentLink.create({
      amount: 1 * 100,
      currency: "INR",
      accept_partial: false,
      description: `Enrollment for webinar: ${webinar.title}`,
      reference_id: `webinar_booking_${booking._id}`,
      notify: { sms: true },
      notes: {
        booking_id: booking._id.toString(),
        patient_id: patient._id.toString(),
        webinar_id: webinar.webinar_id,
      },
    });

    // Save payment link ID in booking
    booking.payment_link_id = paymentLink.id;
    await booking.save();

    // ✅ Trigger WhatsApp message via WATI
    const payload = {
      template_name: "paymentlinks", // your approved template
      broadcast_name: "webinar_payment",
      parameters: [
        { name: "name", value: patient.Name },
        { name: "program_name", value: "Webinar" },
        { name: "webinar_name", value: webinar.title },
        { name: "payment_link", value: paymentLink.short_url }
      ]
    };

    const whatsappResponse = await fetch(
      `${WATI_API_URL}?whatsappNumber=${patient.Mobile}`, // <-- patient phone field
      {
        method: "POST",
        headers: {
          "Authorization": WATI_API_KEY, // no Bearer prefix
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    let waResp;
    try {
      const text = await whatsappResponse.text();
      waResp = text ? JSON.parse(text) : null;
    } catch (e) {
      waResp = { raw: await whatsappResponse.text() };
    }

    if (!whatsappResponse.ok) {
      console.error("❌ Failed to send WhatsApp payment link:", waResp);
    } else {
      console.log("✅ WhatsApp payment link sent:", waResp);
    }

    return res.status(200).json({
      message: "Webinar booking initiated. Payment link sent via WhatsApp.",
      bookingId: booking._id,
      paymentLink: paymentLink.short_url,
      webinarTitle: webinar.title,
      webinarId: webinar.webinar_id
    });
  } catch (err) {
    console.error("❌ Error enrolling in webinar:", err);
    return res.status(500).json({ message: "Internal server error.", error: err.message });
  }
});

const RAZORPAY_WEBHOOK_SECRET = "PsyCare@WebinarPayments"; // set same in Razorpay dashboard

// Razorpay Webhook for Payment Verification
WebinarRoute.post("/razorpay-webhook", express.json(), async (req, res) => {
  try {
    const receivedSignature = req.headers["x-razorpay-signature"];
    const body = JSON.stringify(req.body);

    // Step 1: Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (receivedSignature !== expectedSignature) {
      console.error("❌ Invalid webhook signature");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    // Step 2: Handle payment link paid event
    if (event === "payment_link.paid") {
      const notes = payload.payment_link.entity.notes;
      const bookingId = notes.booking_id;
      const patientId = notes.patient_id;
      const webinarId = notes.webinar_id;

      const paymentId = req.body.payload.payment.entity.id;

      console.log("✅ Payment success for booking:", bookingId);

      // Update booking status
      const booking = await WebinarBooking.findByIdAndUpdate(
        bookingId,
        { payment_status: "paid", payment_id: paymentId },
        { new: true }
      );

      if (booking) {
        // Add patient to webinar attendees
        await WebinarSchema.findOneAndUpdate(
          { webinar_id: webinarId },
          { $addToSet: { attendees: patientId } }
        );

        // Fetch patient details for WhatsApp
        const patient = await patientSchema.findById(patientId);

        if (patient && patient.Mobile) {
          // ✅ WATI Template Payload
          const payload = {
            template_name: "payment_successfull", // must be approved in WATI
            broadcast_name: "webinar_payment",
            parameters: [
              { name: "name", value: patient.Name },
              { name: "payment_id", value: paymentId }
            ]
          };

          // Send WhatsApp message
          const whatsappResponse = await fetch(
            `${WATI_API_URL}?whatsappNumber=${patient.Mobile}`,
            {
              method: "POST",
              headers: {
                Authorization: WATI_API_KEY, // no Bearer
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }
          );

          const text = await whatsappResponse.text();
          console.log("📩 WhatsApp Response:", text);
        }
      }
    }

    // Step 3: Handle failed / expired cases
    if (event === "payment_link.expired" || event === "payment_link.cancelled") {
      const notes = req.body.payload.payment_link.entity.notes;
      const bookingId = notes.booking_id;

      console.log("⚠️ Payment expired/cancelled for booking:", bookingId);

      await WebinarBooking.findByIdAndUpdate(bookingId, {
        payment_status: "failed",
      });
    }

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error in webhook:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = WebinarRoute;