
const express = require("express");
const AdminSchema = require("../model/AdminSchema");
const { json } = require("body-parser");
const AdminRoute = express.Router();

const AppointmentRecordsSchema = require("../model/AppointmentRecordsSchema");
const DoctorAccountsSchema = require("../model/DoctorAccountsSchema");
const DoctorTransactionsSchema = require("../model/DoctorTransactionsSchema");
const DoctorSchema = require("../model/DoctorSchema"); // assumed name
const PriceSchema = require("../model/PriceSchema");

AdminRoute.get("/companyAccountsSummary", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 1️⃣ Filter base for all date-bound queries
        const dateMatch = {};
        if (startDate) dateMatch.$gte = new Date(startDate);
        if (endDate) dateMatch.$lte = new Date(endDate);

        // 2️⃣ Fetch total appointments booked per doctor
        const totalAppointmentsStats = await AppointmentRecordsSchema.aggregate([
            {
                $match: {
                    ...(startDate || endDate ? { DateOfAppointment: dateMatch } : {})
                }
            },
            {
                $group: {
                    _id: "$doctor_id",
                    totalAppointments: { $sum: 1 }
                }
            }
        ]);

        // 3️⃣ Fetch sessions completed (session_started = true)
        // 3️⃣ Fetch sessions completed (only valid payable ones)

        const sessionStats = await AppointmentRecordsSchema.aggregate([
            {
                $match: {
                    session_started: true,
                    appointment_status: { $in: ["completed", "no_show"] },
                    ...(startDate || endDate ? { DateOfAppointment: dateMatch } : {})
                }
            },
            {
                $group: {
                    _id: "$doctor_id",
                    totalSessions: { $sum: 1 }
                }
            }
        ]);

        // 4️⃣ Fetch transactions grouped per doctor
        const txnMatch = { status: "completed" };
        if (startDate || endDate) {
            txnMatch.createdAt = dateMatch;
        }

        const transactionStats = await DoctorTransactionsSchema.aggregate([
            { $match: txnMatch },
            {
                $group: {
                    _id: "$doctorId",
                    totalCredits: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0]
                        }
                    },
                    totalDebits: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0]
                        }
                    }
                }
            }
        ]);

        const cancelledAppointmentsStats = await AppointmentRecordsSchema.aggregate([
            {
                $match: {
                    session_started: false,
                    appointment_status: { $in: ["cancelled", "no_show"] },
                    ...(startDate || endDate ? { DateOfAppointment: dateMatch } : {})
                }
            },
            {
                $group: {
                    _id: "$doctor_id",
                    totalCancelled: { $sum: 1 }
                }
            }
        ]);

        // 5️⃣ Combine all doctor IDs from all sources
        const doctorIds = [...new Set([
            ...totalAppointmentsStats.map(d => d._id.toString()),
            ...sessionStats.map(d => d._id.toString()),
            ...transactionStats.map(d => d._id.toString())
        ])];

        // 6️⃣ Fetch doctor accounts and basic info
        const [doctorAccounts, doctorDetails] = await Promise.all([
            DoctorAccountsSchema.find({ doctorId: { $in: doctorIds } }),
            DoctorSchema.find({ _id: { $in: doctorIds } })
        ]);

        // 7️⃣ Combine all data into final response
        let totalEarnings = 0;
        let totalWithdrawn = 0;
        let appointmentCount = 0;
        let sessionCount = 0;
        let cancelledCount = 0;

        const doctorBreakdown = doctorIds.map(doctorId => {
            const doctorIdStr = doctorId.toString();

            const appointmentsData = totalAppointmentsStats.find(a => a._id.toString() === doctorIdStr);
            const sessionData = sessionStats.find(s => s._id.toString() === doctorIdStr);
            const txnData = transactionStats.find(t => t._id.toString() === doctorIdStr);
            const acc = doctorAccounts.find(a => a.doctorId.toString() === doctorIdStr);
            const doc = doctorDetails.find(d => d._id.toString() === doctorIdStr);
            const cancelledData = cancelledAppointmentsStats.find(c => c._id.toString() === doctorIdStr);

            const earnings = txnData?.totalCredits || 0;
            const withdrawn = txnData?.totalDebits || 0;
            const sessionsCompleted = sessionData?.totalSessions || 0;
            const appointmentsBooked = appointmentsData?.totalAppointments || 0;
            const balance = earnings - withdrawn;
            const cancelledAppointments = cancelledData?.totalCancelled || 0;

            totalEarnings += earnings;
            totalWithdrawn += withdrawn;
            appointmentCount += appointmentsBooked;
            sessionCount += sessionsCompleted;
            cancelledCount += cancelledAppointments;

            return {
                doctorId: doctorIdStr,
                name: doc?.Name || "Unknown Doctor",
                appointmentsBooked,
                sessionsCompleted,
                cancelledAppointments,
                earnings,
                withdrawn,
                balance
            };
        });

        // ✅ Respond with final summary
        res.json({
            success: true,
            message: "Company accounts summary fetched",
            data: {
                totalEarnings,
                totalWithdrawn,
                appointmentCount,
                sessionCount,
                cancelledCount,
                doctorBreakdown
            }
        });

    } catch (error) {
        console.error("Company Accounts Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

AdminRoute.get("/", (req, res) => {
    AdminSchema.find((err, data) => {
        if (err) {
            return err;
        }
        else {
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
                admin: { name: admin.Name, emp_id: admin.emp_id }
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


// Add new price
AdminRoute.post("/add-price", async (req, res) => {
  try {
    const { label, amount } = req.body;
    const price = new PriceSchema({ label, amount });
    await price.save();
    res.json({ success: true, price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all active prices
AdminRoute.get("/prices", async (req, res) => {
  const prices = await PriceSchema.find({ active: true }).sort({ createdAt: -1 });
  res.json(prices);
});

// Update or deactivate price
AdminRoute.put("/update-price/:id", async (req, res) => {
  const { id } = req.params;
  const { label, amount, active } = req.body;
  const updated = await PriceSchema.findByIdAndUpdate(id, { label, amount, active }, { new: true });
  res.json(updated);
});

module.exports = AdminRoute;