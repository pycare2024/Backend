const mongoose = require("mongoose");

const DoctorSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    Name: { type: String, required: true },
    Age: { type: Number, required: true },
    Pincode: { type: Number, required: true },
    City: { type: String, required: true },
    Qualification: { type: String, required: true },
    loginId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    Gender: { type: String, required: true },
    Mobile: { type: Number, required: true },
    dob: { type: Date, required: true },
    certificates: [{ type: String }] // Array to store file paths or base64 strings
}, {
    collection: "Doctors"
});

module.exports = mongoose.model("DoctorSchema", DoctorSchema);