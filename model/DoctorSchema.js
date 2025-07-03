const mongoose = require("mongoose");

const DoctorSchema = new mongoose.Schema({
    id: { type: String },
    photo: { type: String, default: "" },
    Name: { type: String },
    City: { type: String },

    // ✅ Updated to allow multiple degrees
    Qualification: {
        type: [String],
        default: []
    },

    loginId: { type: String },
    password: { type: String },
    Gender: { type: String },
    Mobile: { type: String },
    Role: {
        type: String,
        enum: ["Therapist", "Consultant"],
        required: true
    },
    platformType: {
        type: String,
        enum: ["marketplace", "school", "corporate"],
        required: true
    },
    consultsStudents: {
        type: Boolean,
        default: false
    },
    languagesSpoken: {
        type: [String],
        default: []
    },
    experienceYears: {
        type: Number,
        default: 0
    },
    areaOfExpertise: {
        type: [String],
        default: []
    },
    certifications: {
        type: [String],
        default: []
    }
}, {
    collection: "Doctors",
    timestamps: true
});

DoctorSchema.pre("save", function (next) {
    if (this.platformType !== "marketplace") {
        this.consultsStudents = undefined;
    }
    next();
});

module.exports = mongoose.model("DoctorSchema", DoctorSchema);