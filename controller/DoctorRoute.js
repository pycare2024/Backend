const express = require("express");
const DoctorSchema = require("../model/DoctorSchema");
const DoctorRoute = express.Router();
const DoctorAccountsSchema = require("../model/DoctorAccountsSchema");
const DoctorTransactionsSchema = require("../model/DoctorTransactionsSchema");

const WATI_API_URL = "https://live-mt-server.wati.io/387357/api/v2/sendTemplateMessage";
const WATI_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZmY3OWIzZC0wY2FjLTRlMjEtOThmZC1hNTExNGQyYzBlOTEiLCJ1bmlxdWVfbmFtZSI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsIm5hbWVpZCI6ImNvbnRhY3R1c0Bwc3ktY2FyZS5pbiIsImVtYWlsIjoiY29udGFjdHVzQHBzeS1jYXJlLmluIiwiYXV0aF90aW1lIjoiMDEvMDEvMjAyNSAwNTo0NzoxOCIsInRlbmFudF9pZCI6IjM4NzM1NyIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.e4BgIPZN_WI1RU4VkLoyBAndhzW8uKntWnhr4K-J9K0"; // Replace with actual token

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
                    doctor: { name: doctor.Name, id: doctor.id , doctor_id: doctor._id }
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

DoctorRoute.post("/resetPassword", async (req, res) => {
    const { loginId, newPassword } = req.body;

    try {
        const doctor = await DoctorSchema.findOneAndUpdate(
            { loginId },
            { password: newPassword },
            { new: true }
        );

        if (!doctor) {
            return res.status(404).json({ success: false, message: "Doctor not found" });
        }

        // ✅ Send WhatsApp Notification via WATI
        const patientPhone = doctor.Mobile;
        const patientName = doctor.Name;

        if (patientPhone && patientName) {
            const payload = {
                template_name: "resetpassworddoc",
                broadcast_name: "Doctor_Reset_Password",
                parameters: [
                    { name: "name", value: patientName }
                ]
            };

            const whatsappResponse = await fetch(`${WATI_API_URL}?whatsappNumber=91${patientPhone}`, {
                method: "POST",
                headers: {
                    "Authorization": WATI_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await whatsappResponse.json();
            if (!whatsappResponse.ok) {
                console.error("❌ Failed to send WhatsApp message:", data);
            }
        }

        return res.json({ success: true, message: "Password reset successfully" });

    } catch (error) {
        console.error("❌ Error resetting password:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

DoctorRoute.post("/register", async (req, res) => 
    {

    const { id, Name, City, Qualification, loginId, password, Gender, Mobile} = req.body;

    // Check if all required fields are provided
    if (!id || !Name ||  !City || !Qualification || !loginId || !password || !Gender || !Mobile) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    try {
        // Check if doctor already exists
        const existingDoctor = await DoctorSchema.findOne({ loginId });
        if (existingDoctor) {
            return res.status(400).json({ success: false, message: "Doctor with this login ID already exists" });
        }

        // Create new doctor entry
        const newDoctor = new DoctorSchema({
            id,
            Name,
            City,
            Qualification,
            loginId,
            password, // Save hashed password
            Gender,
            Mobile,
        });

        await newDoctor.save();
        res.status(201).json({ success: true, message: "Doctor registered successfully" });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server error, please try again" });
    }
});

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

DoctorRoute.get("/getDoctorAccountSummary/:doctorId", async (req, res) => {
    const { doctorId } = req.params;

    try {
        const account = await DoctorAccountsSchema.findOne({ doctorId });

        if (!account) {
            return res.status(404).json({ success: false, message: "Account not found for this doctor" });
        }

        return res.json({
            success: true,
            message: "Doctor account summary fetched successfully",
            data: {
                totalEarnings: account.totalEarnings,
                totalWithdrawn: account.totalWithdrawn,
                currentBalance: account.currentBalance,
                lastUpdated: account.lastUpdated,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

DoctorRoute.get("/getDoctorTransactions/:doctorId", async (req, res) => {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;

    try {
        const filter = { doctorId };

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const transactions = await DoctorTransactionsSchema.find(filter).sort({ createdAt: -1 });

        // Transform data into professional format
        const formattedTransactions = transactions.map((txn, index) => {
            let description = "";

            if (txn.type === "credit") {
                if (txn.note?.toLowerCase().includes("no-show")) {
                    description = "No-Show by patient (Payable)";
                } else if (txn.source === "appointment") {
                    description = "Session completed (Payable)";
                } else {
                    description = "Credit Adjustment";
                }
            } else if (txn.type === "debit") {
                description = "Withdrawal";
            }

            return {
                sno: index + 1,
                date: new Date(txn.createdAt).toLocaleDateString(),
                type: txn.type,
                amount: txn.amount,
                description,
                referenceId: txn.type === "credit" ? txn.referenceId || null : null
            };
        });

        return res.json({
            success: true,
            message: "Transactions fetched successfully",
            data: formattedTransactions,
        });

    } catch (error) {
        console.error("Transaction Fetch Error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

module.exports = DoctorRoute;