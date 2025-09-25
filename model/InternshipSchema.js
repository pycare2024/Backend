const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const InternshipSchema = new mongoose.Schema({
    internship_id: { type: String, unique: true, required: true }, // primary key

    title: { type: String, required: true },
    description: { type: String, required: true },

    mentor: { type: ObjectId, ref: "DoctorSchema", required: true }, // Internship mentor/doctor
    duration: { type: String, required: true }, // e.g., "3 months"
    contactHours: { type: Number, required: true }, // total hours of learning/training

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    category: { type: String }, 
    price: { type: Number, required: true, default: 0 },

    // Enrollments
    maxSeats: { type: Number, default: 50 },
    studentsEnrolled: [{ type: ObjectId, ref: "DoctorSchema" }], // interns (students)

    // Resources
    thumbnailUrl: { type: String, default: null },
    certificateTemplate: { type: String, default: null }, // optional certificate template link

    // Payment tracking
    // payment_status: { type: String, enum: ["free", "paid"], default: "free" },
    payment_id: { type: String, default: null },
    refund_id: { type: String, default: null },
},
{ timestamps: true, collection: "Internships" });

module.exports = mongoose.model("Internship", InternshipSchema);
