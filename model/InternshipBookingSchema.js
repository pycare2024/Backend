const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const InternshipBookingSchema = new mongoose.Schema({

    internship_id: { type: String, ref: "Internship", required: true }, // foreign key (string id from InternshipSchema)
    student_id: { type: ObjectId, ref: "DoctorSchema", required: true }, // student is a doctor enrolling as intern
    student_name: { type: String, required: true },

    bookingDate: { type: Date, default: Date.now },

    payment_status: {
        type: String,
        enum: ["pending", "confirmed", "failed", "refunded"],
        default: "pending"
    },
    payment_id: { type: String, default: null },
    refund_id: { type: String, default: null },
    payment_link_id: { type: String, default: null },

}, { timestamps: true, collection: "InternshipBookings" });

module.exports = mongoose.model("InternshipBooking", InternshipBookingSchema);
