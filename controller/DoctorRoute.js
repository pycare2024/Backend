const express = require("express");
const multer = require("multer");
const path = require("path");
const DoctorSchema = require("../model/DoctorSchema");
const DoctorRoute = express.Router();

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/"); // Store files in 'uploads' folder
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); // Unique filename
    }
});
const upload = multer({ storage: storage });

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
        const doctor = await DoctorSchema.findOne({ loginId:loginId, password:password });

        // console.log(doctor.password);
        if (doctor)
            {
                return res.json({
                    message: "Login successful",
                    success: true,
                    doctor: { name: doctor.Name, id: doctor.id }
                });
            } else {
                return res.status(401).json({ message: "Invalid loginId or password", success: false });
            }
    } 
    catch(error)
    {
        return res.status(500).json({message:"Server error",success:false});
    }
});

DoctorRoute.post("/verifyCredentials",async(req,res)=>{
    const {loginId , Mobile, dob} = req.body;

    try{
        const doctor=await DoctorSchema.findOne({loginId,Mobile,dob});

        if(doctor)
            {
                return res.json({success : true, message: "Credentials verified successfully"});

            }
            else
            {
                return res.status(401).json({ success: false, message: "Invalid credentials, please check and try again." });
            }
    }
    catch(error)
    {
        return res.status(500).json({ success: false, message: "Server error, please try again." });
    }
});


// Reset password
DoctorRoute.post("/resetPassword", async (req, res) => {
    const { loginId, newPassword } = req.body;

    try {
        const doctor = await DoctorSchema.findOneAndUpdate(
            { loginId },
            { password: newPassword },
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

// Doctor registration route with file upload
DoctorRoute.post("/register", upload.array("certificates", 5), async (req, res) => {
    const { id, Name, Age, Pincode, City, Qualification, loginId, password, Gender, Mobile, dob } = req.body;

    if (!id || !Name || !Age || !Pincode || !City || !Qualification || !loginId || !password || !Gender || !Mobile || !dob) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    try {
        const existingDoctor = await DoctorSchema.findOne({ loginId });
        if (existingDoctor) {
            return res.status(400).json({ success: false, message: "Doctor with this login ID already exists" });
        }

        const certificateFiles = req.files.map(file => file.path); // Get file paths

        const newDoctor = new DoctorSchema({
            id,
            Name,
            Age,
            Pincode,
            City,
            Qualification,
            loginId,
            password,
            Gender,
            Mobile,
            dob,
            certificates: certificateFiles // Store file paths
        });

        await newDoctor.save();
        res.status(201).json({ success: true, message: "Doctor registered successfully" });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server error, please try again" });
    }
});

// Serve uploaded files
DoctorRoute.use("/uploads", express.static("uploads"));

// Delete a doctor by ID
DoctorRoute.delete("/delete/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const deletedDoctor = await DoctorSchema.findOneAndDelete({ id });

        if (!deletedDoctor) {
            return res.status(404).json({ success: false, message: "Doctor not found" });
        }

        res.json({ success: true, message: "Doctor deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error, please try again" });
    }
});

module.exports = DoctorRoute;