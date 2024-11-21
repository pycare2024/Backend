const express = require("express");
const bcrypt = require("bcrypt");
const DoctorSchema = require("../model/DoctorSchema");
const DoctorRoute = express.Router();
const { json } = require("body-parser");

DoctorRoute.get("/", (req, res) => {
    DoctorSchema.find((err, data) => {
        if (err) {
            return err;
        } else {
            return res.json(data);
        }
    });
});

DoctorRoute.get("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const doctor = await DoctorSchema.findById(id);

        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        // Send the doctor data as a response
        res.json(doctor);  // This sends the doctor object back to the client
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch doctor info" });
    }
});

// Doctor login with hashed password
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
                    doctor: { name: doctor.Name, id: doctor.id }
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

// Verify credentials before allowing password reset
DoctorRoute.post("/verifyCredentials", async (req, res) => {
    const { loginId, Mobile, dob } = req.body;

    try {
        const doctor = await DoctorSchema.findOne({ loginId, Mobile, dob });

        if (doctor) {
            return res.json({ success: true, message: "Credentials verified" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// Reset password for the doctor
DoctorRoute.post("/resetPassword", async (req, res) => {
    const { loginId, newPassword } = req.body;

    try {
        const doctor = await DoctorSchema.findOneAndUpdate({ loginId },{password:newPassword},{new:true });

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