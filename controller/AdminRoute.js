
const express=require("express");
const AdminSchema=require("../model/AdminSchema");
const { json } = require("body-parser");
const AdminRoute=express.Router();

AdminRoute.get("/",(req,res)=>{
    AdminSchema.find((err,data)=>{
        if(err)
            {
                return err;
            }
            else
            {
                return res.json(data);
            }
    })
});

AdminRoute.post("/login", async (req, res) => {
    const { loginId, password } = req.body;

    try {
        const admin = await AdminSchema.findOne({ loginId: loginId, password: password });
        
        if (admin) {
            return res.json({ 
                message: "Login successful", 
                success: true,
                admin:{name:admin.Name,emp_id:admin.emp_id}
            });
        } else {
            return res.status(401).json({ message: "Invalid login ID or password", success: false });
        }
    } catch (error) {
        return res.status(500).json({ message: "Server error", success: false });
    }
});

// Verify Credentials (Login ID, Mobile No, Date of Birth)
AdminRoute.post("/verifyCredentials", async (req, res) => {
    const { loginId, mobileNo, dob } = req.body;

    try {
        // Find the admin user based on loginId, mobileNo, and dob
        const admin = await AdminSchema.findOne({ loginId, mobileNo, dob });

        if (admin) {
            // If credentials match, return success
            return res.json({ success: true, message: "Credentials verified successfully" });
        } else {
            // If credentials don't match, return failure
            return res.status(401).json({ success: false, message: "Invalid credentials, please check and try again." });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error, please try again." });
    }
});

// Reset Password
AdminRoute.post("/resetPassword", async (req, res) => {
    const { loginId, newPassword } = req.body;

    try {
        // Find admin by loginId and update the password
        const admin = await AdminSchema.findOneAndUpdate({ loginId }, { password: newPassword }, { new: true });

        if (admin) {
            return res.json({ success: true, message: "Password reset successfully" });
        } else {
            return res.status(404).json({ success: false, message: "Admin not found with the given login ID" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error, please try again." });
    }
});


module.exports=AdminRoute;