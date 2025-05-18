const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");

mongoose.connect("mongodb+srv://vae0620:Amen123@cluster0.yagt9.mongodb.net/CompanyDb", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const patientSchema = new mongoose.Schema({}, { strict: false });
const corporateSchema = new mongoose.Schema({}, { strict: false });

const Patient = mongoose.model("Patient", patientSchema, "Patients");
const Corporate = mongoose.model("Corporate", corporateSchema, "Corporates");

const COMPANY_CODE = "ME8655";
const EMP_PREFIX = "ME";

const cities = [
    "Bangalore",
    "Mumbai",
    "Delhi",
    "Hyderabad",
    "Chennai",
    "Pune",
    "Ahmedabad",
    "Kolkata",
    "Jaipur",
    "Lucknow"
  ];

async function generateDummyPatients() {
    console.log("Looking for corporate with code ME8655...");
    const corporate = await Corporate.findOne({ companyCode: COMPANY_CODE });
    if (!corporate) {
        console.log("Corporate not found");
        return;
    }

    console.log("Corporate found:", corporate.companyName);

    const associatedPatients = [];

    for (let i = 1; i <= 30; i++) {
        const empId = `${EMP_PREFIX}${100 + i}`;
        const phone = faker.phone.number('##########');
        const name = faker.person.fullName();
        const department = faker.commerce.department();
        const location = faker.helpers.arrayElement(cities);
        const gender = faker.person.sex(); // returns 'male' or 'female'

        const patient = new Patient({
            Name: name,
            Age: faker.number.int({ min: 22, max: 55 }),
            Gender: gender.charAt(0).toUpperCase() + gender.slice(1), // Capitalize first letter
            Location: location,
            Mobile: phone,
            Problem: [faker.lorem.word()],
            userType: "corporate",
            empId,
            companyCode: COMPANY_CODE,
            isFamilyMember: false,
        });

        const saved = await patient.save();

        associatedPatients.push({
            empId,
            employeePhone: phone,
            department,
            familyMembers: [],
            visits: [],
            _id: saved._id,
        });
    }

    const result = await Corporate.updateOne(
        { companyCode: COMPANY_CODE },
        {
            $push: {
                associatedPatients: { $each: associatedPatients }
            }
        }
    );

    console.log("Corporate updated using $push. Matched:", result.matchedCount, "Modified:", result.modifiedCount);

    console.log("✔️ 50 Dummy patients inserted and linked to corporate.");
    mongoose.disconnect();
}

generateDummyPatients();