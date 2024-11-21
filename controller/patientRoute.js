const express = require("express");
const patientSchema = require("../model/patientSchema");
const patientRecordSchema = require("../model/PatientRecordSchema"); // Import PatientRecord schema
const ScreeningTestSchema = require("../model/ScreeningTestSchema");
const patientRoute = express.Router();

// Fetch all patients
patientRoute.get("/", (req, res) => {
    patientSchema.find((err, data) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch patients" });
        }
        res.json(data);
    });
});

// Fetch patient by ID along with their visit records
patientRoute.get("/:id", async (req, res) => {
    const { id } = req.params;
    
    try {
        const patient = await patientSchema.findById(id);
        
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }

        const records = await patientRecordSchema.find({ patient_id: id });

        res.json({
            patient,
            records,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch patient info" });
    }
});

// Add new patient record
patientRoute.post("/:id/addRecord", async (req, res) => {
    const { id } = req.params;
    const { DOV, diagnosis, prescription, notes } = req.body;

    try {
        const newRecord = new patientRecordSchema({
            patient_id: id,
            DOV,
            diagnosis,
            prescription,
            notes,
        });

        await newRecord.save();
        res.status(201).json(newRecord);
    } catch (error) {
        res.status(500).json({ error: "Failed to add patient record" });
    }
});

// Fetch screening test details for a specific patient
patientRoute.get("/:id/screeningTests", async (req, res) => {
    const { id } = req.params;
    
    try {
        const screeningTests = await ScreeningTestSchema.find({ patient_id: id });

        if (!screeningTests || screeningTests.length === 0) {
            return res.status(404).json({ message: "No screening tests found for this patient" });
        }

        res.json(screeningTests);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch screening test details" });
    }
});

// Fetch specific patient record (prescription) by record ID
patientRoute.get("/record/:recordId", async (req, res) => {
    const { recordId } = req.params;

    try {
        const record = await patientRecordSchema.findById(recordId);

        if (!record) {
            return res.status(404).json({ message: "Record not found" });
        }

        res.json(record);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch patient record" });
    }
});

// Verify prescription
patientRoute.patch("/verifyPrescription/:recordId", async (req, res) => {
    const { recordId } = req.params;

    try {
        const record = await patientRecordSchema.findById(recordId);
        
        if (!record) return res.status(404).json({ message: "Record not found" });
        
        if (record.signed) {
            return res.status(200).json({ message: "Prescription already verified", signed: true });
        }

        record.signed = true;
        await record.save();
        res.status(200).json({ message: "Prescription verified successfully", signed: record.signed });
    } catch (error) {
        res.status(500).json({ error: "Failed to verify prescription" });
    }
});

module.exports = patientRoute;