const express = require("express");
const mongoose = require("mongoose");
const Internship = require("../model/InternshipSchema");
const Doctor = require("../model/DoctorSchema");
const razorpay = require("../razorpay");
const crypto = require("crypto");
const InternshipBooking = require("../model/InternshipBookingSchema");

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token

const InternshipRoute = express.Router();

// Get all internships
InternshipRoute.get("/", async (req, res) => {
  try {
    const internships = await Internship.find()
      .populate("mentor", "Name Qualification City")
      .populate("studentsEnrolled", "Name Mobile");
    return res.status(200).json({ internships });
  } catch (err) {
    console.error("Error fetching internships:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get internship by ID
InternshipRoute.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid internship ID." });
    }

    const internship = await Internship.findById(id)
      .populate("mentor", "Name Qualification City")
      .populate("studentsEnrolled", "Name Mobile");

    if (!internship) {
      return res.status(404).json({ message: "Internship not found." });
    }

    return res.status(200).json({ internship });
  } catch (err) {
    console.error("Error fetching internship:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Create new internship
InternshipRoute.post("/create", async (req, res) => {
  try {
    const {
      internship_id,
      title,
      description,
      mentor,
      duration,
      contactHours,
      startDate,
      endDate,
      category,
      price,
      maxSeats,
      thumbnailUrl,
      certificateTemplate,
    } = req.body;

    if (
      !internship_id ||
      !title ||
      !description ||
      !mentor ||
      !duration ||
      !contactHours ||
      !startDate ||
      !endDate
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    const internship = new Internship({
      internship_id,
      title,
      description,
      mentor,
      duration,
      contactHours,
      startDate,
      endDate,
      category,
      price,
      maxSeats,
      thumbnailUrl,
      certificateTemplate,
    });

    await internship.save();
    return res
      .status(201)
      .json({ message: "Internship created successfully.", internship });
  } catch (err) {
    console.error("Error creating internship:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Update internship
InternshipRoute.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid internship ID." });
    }

    const updatedInternship = await Internship.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updatedInternship) {
      return res.status(404).json({ message: "Internship not found." });
    }

    return res.status(200).json({
      message: "Internship updated successfully.",
      internship: updatedInternship,
    });
  } catch (err) {
    console.error("Error updating internship:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Delete internship
InternshipRoute.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid internship ID." });
    }

    const deletedInternship = await Internship.findByIdAndDelete(id);

    if (!deletedInternship) {
      return res.status(404).json({ message: "Internship not found." });
    }

    return res
      .status(200)
      .json({ message: "Internship deleted successfully." });
  } catch (err) {
    console.error("Error deleting internship:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Enroll student into internship
InternshipRoute.post("/enroll", async (req, res) => {
  try {
    const { internship_name, student_id } = req.body;

    if (!internship_name || !student_id) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Find internship by title
    const internship = await Internship.findOne({ title: internship_name });
    if (!internship) {
      return res.status(404).json({ message: "Internship not found." });
    }

    // Validate student
    const student = await Doctor.findById(student_id);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    // Check seat availability
    if (internship.studentsEnrolled.length >= internship.maxSeats) {
      return res
        .status(400)
        .json({ message: "No seats available for this internship." });
    }

    // Calculate final price (with 18% GST)
    const basePrice = internship.price || 0;
    const finalPrice = basePrice + Math.round(basePrice * 0.18);

    // Create booking in DB first with pending status
    const booking = await new InternshipBooking({
      internship_id: internship.internship_id,
      student_id,
      student_name: student.Name,
      payment_status: "pending",
    }).save();

    // Generate Razorpay payment link
    const paymentLink = await razorpay.paymentLink.create({
      amount: 1 * 100, // Razorpay expects paise
      currency: "INR",
      accept_partial: false,
      description: `Enrollment for internship: ${internship.title}`,
      reference_id: `internship_booking_${booking._id.toString().slice(-15)}`,
      notify: { sms: true },
      notes: {
        booking_id: booking._id.toString(),
        student_id: student._id.toString(),
        internship_id: internship.internship_id,
      },
    });

    // Save payment link ID in booking
    booking.payment_link_id = paymentLink.id;
    await booking.save();

    // ✅ Send WhatsApp notification with payment link
    if (student.Mobile) {
      const watiPayload = {
        template_name: "paymentlinks", // must match WATI approved template
        broadcast_name: "internship_payment_link",
        parameters: [
          { name: "name", value: student.Name },
          { name: "program_name", value: "Internship Program" },
          { name: "webinar_name", value: internship.title }, // reuse placeholder
          { name: "payment_link", value: paymentLink.short_url }
        ]
      };

      const whatsappResponse = await fetch(
        `${WATI_API_URL}?whatsappNumber=${student.Mobile}`,
        {
          method: "POST",
          headers: {
            Authorization: WATI_API_KEY, // no "Bearer"
            "Content-Type": "application/json",
          },
          body: JSON.stringify(watiPayload),
        }
      );

      console.log("📩 WhatsApp Payment Link Response:", await whatsappResponse.text());
    }

    return res.status(200).json({
      message: "Internship enrollment initiated. Payment link sent on WhatsApp.",
      bookingId: booking._id,
      paymentLink: paymentLink.short_url,
      internshipTitle: internship.title,
      internshipId: internship.internship_id,
    });
  } catch (err) {
    console.error("❌ Error enrolling student:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
});

const RAZORPAY_WEBHOOK_SECRET = "InternshipPayment@Psycare";

InternshipRoute.post("/razorpay-webhook", express.json(), async (req, res) => {
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

    // ✅ Step 2: Handle payment success
    if (event === "payment_link.paid") {
      const notes = payload.payment_link.entity.notes;
      const bookingId = notes.booking_id;
      const studentId = notes.student_id;
      const internshipId = notes.internship_id;

      const paymentId = req.body.payload.payment.entity.id;

      console.log("✅ Payment success for internship booking:", bookingId);

      // Update booking status
      const booking = await InternshipBooking.findByIdAndUpdate(
        bookingId,
        { payment_status: "paid", payment_id: paymentId },
        { new: true }
      );

      if (booking) {
        // Add student to internship
        await Internship.findOneAndUpdate(
          { internship_id: internshipId },
          { $addToSet: { studentsEnrolled: studentId } }
        );

        // Fetch student details for WhatsApp
        const student = await Doctor.findById(studentId);

        if (student && student.Mobile) {
          // ✅ WATI Template Payload
          const watiPayload = {
            template_name: "payment_successfull", // must be approved in WATI
            broadcast_name: "internship_payment",
            parameters: [
              { name: "name", value: student.Name },
              { name: "payment_id", value: paymentId }
            ]
          };

          // Send WhatsApp message
          const whatsappResponse = await fetch(
            `${WATI_API_URL}?whatsappNumber=${student.Mobile}`,
            {
              method: "POST",
              headers: {
                Authorization: WATI_API_KEY, // no "Bearer"
                "Content-Type": "application/json",
              },
              body: JSON.stringify(watiPayload),
            }
          );

          const text = await whatsappResponse.text();
          console.log("📩 WhatsApp Response:", text);
        }
      }
    }

    // ⚠️ Step 3: Handle failed / expired payment links
    if (event === "payment_link.expired" || event === "payment_link.cancelled") {
      const notes = req.body.payload.payment_link.entity.notes;
      const bookingId = notes.booking_id;

      console.log("⚠️ Payment expired/cancelled for internship booking:", bookingId);

      await InternshipBooking.findByIdAndUpdate(bookingId, {
        payment_status: "failed",
      });
    }

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error in internship webhook:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = InternshipRoute;