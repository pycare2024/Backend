const express = require("express");
const bcrypt = require("bcrypt");
const DoctorSchema = require("../model/DoctorSchema");
const DoctorRoute = express.Router();

// Fetch all doctors
DoctorRoute.get("/", (req, res) => {
    DoctorSchema.find((err, data) => {
        if (err) {
            return res.status(500).json({ message: "Failed to fetch doctors" });
        }
        res.json(data);
    });
});

// Fetch a specific doctor by ID
DoctorRoute.get("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const doctor = await DoctorSchema.findById(id);

        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        res.json(doctor);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch doctor info" });
    }
});

// Doctor login
DoctorRoute.post("/doctorlogin", async (req, res) => {
    const { loginId, password } = req.body;

    try {
        const doctor = await DoctorSchema.findOne({ loginId });

        if (doctor) {
            const passwordMatch = await bcrypt.compare(password, doctor.password);
            if (passwordMatch) {
                return res.json({
                    message: "Login successful",
                    success: true,
                    doctor: { name: doctor.Name, id: doctor.id },
                });
            } else {
                return res.status(401).json({ message: "Invalid password", success: false });
            }
        } else {
            return res.status(401).json({ message: "Invalid login ID", success: false });
        }
    } catch (error) {
        return res.status(500).json({ message: "Server error", success: false });
    }
});

// Reset password
DoctorRoute.post("/resetPassword", async (req, res) => {
    const { loginId, newPassword } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const doctor = await DoctorSchema.findOneAndUpdate(
            { loginId },
            { password: hashedPassword },
            { new: true }
        );

        if (doctor) {
            return res.json({ success: true, message: "Password reset successfully" });
        } else {
            return res.status(404).json({ success: false, message: "Doctor not found" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = DoctorRoute;