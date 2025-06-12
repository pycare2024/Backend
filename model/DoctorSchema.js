
const mongoose = require("mongoose");
const { collection } = require("./AdminSchema");

const DoctorSchema = mongoose.Schema({
    "id": { type: String },
    "Name": { type: String },
    "City": { type: String },
    "Qualification": { type: String },
    "loginId": { type: String },
    "password": { type: String },
    "Gender": { type: String },
    "Mobile": { type: Number },
    "Role": {
        type: String,
        enum: ["Therapist", "Consultant"],
        required: true
    },
}, {
    collection: "Doctors"
})

module.exports = mongoose.model("DoctorSchema", DoctorSchema);