const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const WebinarSchema = new mongoose.Schema({
    webinar_id: { type: String, unique: true, required: true }, // primary key

    title: { type: String, required: true },
    description: { type: String, required: true },

    speaker: { type: ObjectId, ref: "DoctorSchema", required: true }, // or Instructor/Doctor
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },

    meeting_link: { type: String, default: null },

    price: { type: Number, required: true, default: 0 },
    category: { type: String },

    thumbnailUrl: { type: String, default: null }, // Cloudinary URL if we want to show webinar in website
    maxSeats: { type: Number, default: 100 },

    // track registered patients
    attendees: [{ type: ObjectId, ref: "patientSchema" }],
}, 
{ timestamps: true, collection: "Webinars" });

module.exports = mongoose.model("Webinar", WebinarSchema);
