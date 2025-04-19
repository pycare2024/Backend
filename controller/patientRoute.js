const express = require("express");
const patientSchema = require("../model/patientSchema");
const doctorSchema = require("../model/DoctorSchema");
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

// Check if phone number exists and return patient ID
patientRoute.get("/check/:phoneNumber", async (req, res) => {
    const { phoneNumber } = req.params;

    try {
        const patient = await patientSchema.findOne({ Mobile: phoneNumber }); // Match `Mobile` field in schema
        if (patient) {
            // Patient found, return patient ID
            return res.status(200).json({ message: "Patient already registered", patientId: patient._id, patientName: patient.Name });
        } else {
            return res.status(404).json({ message: "Patient not registered" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error checking phone number" });
    }
});

patientRoute.post("/register", async (req, res) => {
    const { Name, Age, Gender, Location, Mobile, Problem } = req.body;
  
    if (!Name || !Age || !Gender || !Location || !Mobile || !Array.isArray(Problem) || Problem.length === 0) {
      return res.status(400).json({ error: "All fields are required, including at least one selected problem." });
    }
  
    try {
      const newPatient = new patientSchema({
        Name,
        Age,
        Gender,
        Location,
        Mobile,
        Problem
      });
  
      await newPatient.save();
      res.status(201).json({
        message: "Patient registered successfully",
        patientId: newPatient._id
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error registering patient" });
    }
  });

// Fetch all records for a specific patient by patient ID
patientRoute.get("/:id/records", async (req, res) => {
    const { id } = req.params;

    try {
        const records = await patientRecordSchema.find({ patient_id: id });

        if (records.length === 0) {
            return res.status(404).json({ message: "No records found for this patient" });
        }

        // Create response with flattened variables
        const response = {
            message: "Select Your Date of Visit to get Prescription"
        };

        records.forEach((record, index) => {
            response[`record${index + 1}_id`] = record._id;
            response[`record${index + 1}_title`] = record.DOV.toISOString().split("T")[0];
        });

        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch patient records" });
    }
});

// const PDFDocument = require("pdfkit"); // Install using npm install pdfkit

// patientRoute.get("/record/:recordId/pdf", async (req, res) => {
//     const { recordId } = req.params;

//     try {
//         const record = await patientRecordSchema.findById(recordId);

//         if (!record) {
//             return res.status(404).json({ message: "Record not found" });
//         }

//         // Create a PDF document
//         const doc = new PDFDocument();
//         res.setHeader("Content-Type", "application/pdf");
//         res.setHeader(
//             "Content-Disposition",
//             `attachment; filename=prescription-${recordId}.pdf`
//         );

//         // Add content to the PDF
//         doc.text("Prescription Details", { align: "center" });
//         doc.text(`Date of Visit: ${record.DOV}`);
//         doc.text(`Diagnosis: ${record.diagnosis}`);
//         doc.text(`Prescription: ${record.prescription}`);
//         doc.text(`Notes: ${record.notes}`);
//         doc.text(`Verified: ${record.signed ? "Yes" : "No"}`);

//         doc.end(); // Finalize the PDF
//         doc.pipe(res); // Send PDF to client
//     } catch (error) {
//         res.status(500).json({ error: "Failed to generate PDF" });
//     }
// });

const PDFDocument = require("pdfkit");

patientRoute.get("/record/:recordId/pdf", async (req, res) => {
    const { recordId } = req.params;

    try {
        // Fetch the patient record by recordId
        const record = await patientRecordSchema.findById(recordId);

        if (!record) {
            return res.status(404).json({ message: "Record not found" });
        }

        // Check if the prescription is signed
        if (!record.signed) {
            return res.status(400).send(`
                <html>
                    <head>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                background-color: #f7f7f7;
                                margin: 0;
                                padding: 0;
                                text-align: center;
                                padding-top: 50px;
                            }
                            .container {
                                background-color: #fff;
                                border-radius: 8px;
                                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                                width: 70%;
                                margin: 0 auto;
                                padding: 40px;
                            }
                            h1 {
                                color: #FF8096;
                                font-size: 28px;
                            }
                            p {
                                font-size: 16px;
                                color: #333;
                                line-height: 1.6;
                            }
                            .error-message {
                                color: #e74c3c;
                                font-weight: bold;
                                margin-bottom: 20px;
                            }
                            .call-to-action {
                                background-color: #FF8096;
                                color: white;
                                padding: 12px 20px;
                                font-size: 16px;
                                font-weight: bold;
                                border-radius: 5px;
                                text-decoration: none;
                                display: inline-block;
                            }
                            .call-to-action:hover {
                                background-color: #ff4960;
                            }
                            .footer {
                                font-size: 12px;
                                color: #aaa;
                                margin-top: 30px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>PsyCare - Prescription Download</h1>
                            <p class="error-message">Prescription Not Valid for Download</p>
                            <p>Unfortunately, the prescription cannot be downloaded as it has not been digitally signed by the doctor.</p>
                            <p>Don't worry we'll reach you soon !.</p>
                            <p class="footer">PsyCare: Your path to mental wellness !</p>
                        </div>
                    </body>
                </html>
            `);
        }

        // Fetch the patient and doctor information based on the references in the record
        const patient = await patientSchema.findById(record.patient_id);
        const doctor = await doctorSchema.findById(record.doctor_id);

        if (!patient || !doctor) {
            return res.status(404).json({ message: "Patient or Doctor not found" });
        }

        const doc = new PDFDocument({
            margins: { top: 50, left: 50, right: 50, bottom: 50 }
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=prescription-${recordId}.pdf`
        );

        // Header Section
        doc.fillColor("#FF8096")
            .fontSize(28)
            .font("Helvetica-Bold")
            .text("PsyCare", { align: "center" });

        doc.moveDown(0.5);

        doc.fillColor("#000000")
            .fontSize(12)
            .font("Helvetica")
            .text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });

        doc.moveDown(1.5);

        // Section Title
        doc.fillColor("#FF8096")
            .fontSize(20)
            .font("Helvetica-Bold")
            .text("Prescription Details", { align: "center" });

        doc.moveDown(1);

        // Add Row-Column Table
        const tableStartX = 60;
        const tableStartY = doc.y;
        const rowHeight = 30;
        const col1Width = 200;
        const col2Width = 300;

        const drawRow = (y, label, value) => {
            doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold");
            doc.text(label, tableStartX + 10, y + 10, { width: col1Width - 20 });

            doc.fillColor("#333333").fontSize(12).font("Helvetica");
            doc.text(value, tableStartX + col1Width + 10, y + 10, { width: col2Width - 20 });

            // Draw row borders
            doc.rect(tableStartX, y, col1Width + col2Width, rowHeight).stroke();
            doc.moveTo(tableStartX + col1Width, y).lineTo(tableStartX + col1Width, y + rowHeight).stroke();
        };

        // Data for the table
        const details = [
            ["Patient Name", patient.Name || "N/A"],
            ["Patient Age", patient.Age || "N/A"],
            ["Gender", patient.Gender || "N/A"],
            ["Consulting Doctor", doctor.Name || "N/A"],
            ["Date of Visit", new Date(record.DOV).toLocaleDateString()],
            ["Diagnosis", record.diagnosis || "N/A"],
            ["Prescription", record.prescription || "N/A"],
            ["Notes", record.notes || "No additional notes"]
        ];

        details.forEach((detail, index) => {
            drawRow(tableStartY + index * rowHeight, detail[0], detail[1]);
        });

        // Digital Signature Section
        const signatureBoxY = tableStartY + details.length * rowHeight + 30;

        doc.moveDown(1.5)
            .fillColor("black")
            .fontSize(16)
            .font("Helvetica-Bold")
            .text("Digital Signature", 60); // Aligns the title with the signature box

        // Draw the rectangle for the signature box
        doc.rect(60, signatureBoxY, 200, 50).stroke();

        // Add label inside the signature box
        doc.fontSize(12).font("Helvetica").text(doctor.Name, 70, signatureBoxY + 20);

        // Note Section
        doc.moveDown(4)
            .fillColor("#000000")
            .fontSize(10)
            .font("Helvetica")
            .text(
                "This prescription is valid only if digitally signed.",
                { align: "center" }
            );

        // Footer Section
        doc.moveDown(2)
            .fillColor("#AAAAAA")
            .fontSize(10)
            .font("Helvetica-Oblique")
            .text("PsyCare: Your path to mental wellness !", { align: "center" });

        doc.end();
        doc.pipe(res);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to generate PDF" });
    }
});

module.exports = patientRoute;