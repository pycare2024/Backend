const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");

mongoose.connect("mongodb+srv://vae0620:Amen123@cluster0.yagt9.mongodb.net/CompanyDb", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Models
const Patient = mongoose.model("Patient", new mongoose.Schema({}, { strict: false }), "Patients");
const ScreeningTest = mongoose.model("ScreeningTest", new mongoose.Schema({}, { strict: false }), "NewScreeningTestRecords");
const Appointment = mongoose.model("Appointment", new mongoose.Schema({}, { strict: false }), "AppointmentRecords");

function getRealisticNoteAndRecommendation() {
    const realisticNotes = [
        "Patient reported feeling less anxious this week and is sleeping slightly better.",
        "Discussed challenges at work; patient showed signs of stress but was receptive to coping strategies.",
        "Mood was stable overall; reported two minor panic episodes since the last session.",
        "Therapist introduced breathing exercises which patient practiced with moderate success.",
        "Patient missed one dose of medication and noticed increased irritability.",
        "Reported no major changes but mentioned difficulty staying focused.",
        "Patient appeared more hopeful and engaged in this session.",
        "Explored childhood triggers today—emotional response noted, but patient remained composed.",
        "Patient expressed frustration over lack of progress but acknowledged small improvements.",
        "Therapist encouraged journaling to help with thought clarity; patient agreed to try.",
        "Patient reported ongoing insomnia and increasing fatigue during the day.",
        "Reinforced mindfulness practice; patient reported using it during a recent conflict.",
        "Session was cut short due to external interruption; follow-up planned.",
        "Patient showed signs of relapse; increased anxiety and avoidance behaviors noted.",
        "No significant improvement; patient remains emotionally flat and disengaged.",
        "Patient arrived 15 minutes late but participated actively once session began.",
    ];

    const realisticRecommendations = [
        "Continue CBT focus and track mood daily.",
        "Increase session frequency to weekly.",
        "Start guided journaling exercise.",
        "Refer for psychiatric evaluation if symptoms persist.",
        "Practice daily mindfulness for 10 minutes.",
        "Maintain current medication and monitor side effects.",
        "Revisit childhood narrative work next session.",
        "Encouraged to engage in social activities this week.",
        "No change in treatment plan for now.",
        "Start sleep hygiene routine and track sleep diary.",
        "Discuss coping strategies with family members.",
        "Introduce progressive muscle relaxation technique.",
        "Monitor thought distortions using a daily log.",
        "Begin exposure tasks for phobia hierarchy.",
        "Work on emotional labeling through journaling.",
    ];

    return {
        notes: faker.helpers.arrayElement(realisticNotes),
        recommendations: faker.helpers.arrayElement(realisticRecommendations),
    };
}

const keywords = [
    "better", "calmer", "did not attend", "missed", "anxious",
    "worse", "no change", "disturbed", "improved", "tired",
    "hopeful", "irritable", "focused", "confused"
];

const trendPhrases = {
    positive: ["feeling better", "more relaxed", "improved", "calmer", "sleeping better"],
    neutral: ["no change", "same as last week"],
    negative: ["worse", "more anxious", "relapse", "more irritable"],
    missed: ["missed session", "did not attend", "absent"],
    medication: ["prescribed medication", "started new meds", "adjusted dosage"],
};

const getRandomKeywordsSentence = () => {
    const selected = faker.helpers.arrayElements(keywords, faker.number.int({ min: 2, max: 4 }));
    return `Patient reported feeling ${selected.join(", ")} during the week.`;
};

async function generateData() {
    const allPatients = await Patient.find({ companyCode: "ME8655" });

    if (allPatients.length < 30) {
        console.log("❌ Not enough patients. Found:", allPatients.length);
        return;
    }

    const doctorIds = [
        new mongoose.Types.ObjectId("5f3d6b55d3f0a2d3a0b89771"),
        new mongoose.Types.ObjectId("5f3d6b55d3f0a2d3a0b89773"),
    ];
    const scheduleIds = [
        new mongoose.Types.ObjectId("5f3d6b55d3f0a2d3a0b89772"),
        new mongoose.Types.ObjectId("5f3d6b55d3f0a2d3a0b89774"),
    ];

    // Shuffle and split for appointment grouping
    const shuffled = faker.helpers.shuffle(allPatients);
    const forAppointments = shuffled.slice(0, 25);
    const forBeforeScreening = forAppointments.slice(0, 5);
    // const forAfterScreening = forAppointments.slice();

    const screeningDateMap = new Map();

    for (const patient of allPatients) {
        const screeningDate = faker.date.between({ from: "2025-04-15", to: "2025-05-10" });
        screeningDateMap.set(patient._id.toString(), screeningDate);
        const { notes, recommendations } = getRealisticNoteAndRecommendation();

        const toolScoreRanges = {
            "PHQ-9": { min: 0, max: 27 },
            "BDI-II": { min: 0, max: 63 },
            "GAD-7": { min: 0, max: 21 },
            "BAI": { min: 0, max: 63 },
            "ISI": { min: 0, max: 28 },
            "PCL-5": { min: 0, max: 80 },
            "Y-BOCS-II": { min: 0, max: 40 },
        };

        const getRandomScores = () => {
            const selectedTools = faker.helpers.arrayElements(Object.keys(toolScoreRanges), faker.number.int({ min: 1, max: 4 }));
            const scores = {};
            for (const tool of selectedTools) {
                const range = toolScoreRanges[tool];
                scores[tool] = faker.number.int({ min: range.min, max: range.max });
            }
            return { scores, toolsUsed: selectedTools };
        };

        const { scores, toolsUsed } = getRandomScores();

        const screening = new ScreeningTest({
            patient_id: patient._id,
            scores,
            DateOfTest: screeningDate,
            report: `Assessment Summary:\n${getRandomKeywordsSentence()}\nTools Used: ${toolsUsed.join(", ")}\nFurther evaluation recommended.`,
            companyCode: patient.companyCode,
            department: faker.commerce.department(),
        });

        await screening.save();

        // Create appointments if this patient is in appointment list
        if (forAppointments.find(p => p._id.toString() === patient._id.toString())) {
            let appointmentDate;

            if (forBeforeScreening.find(p => p._id.toString() === patient._id.toString())) {
                appointmentDate = faker.date.between({ from: "2025-04-01", to: screeningDate });
            } else {
                appointmentDate = faker.date.between({ from: screeningDate, to: "2025-05-15" });
            }

            const weekday = appointmentDate.toLocaleString("en-US", { weekday: "long" });
            const startTime = faker.helpers.arrayElement(["10:00 AM", "11:30 AM", "2:00 PM"]);
            const endTime = "1 hour later"; // Simplified

            const doctorIdx = faker.number.int({ min: 0, max: 1 });

            const pickRandomTrendPhrase = (group) =>
                faker.helpers.arrayElement(trendPhrases[group]);

            const trendGroup = faker.helpers.arrayElement(Object.keys(trendPhrases));
            const note = `Patient reported ${pickRandomTrendPhrase(trendGroup)}.`;
            const recommendation = trendGroup === "medication"
                ? "Continue prescribed medication and monitor side effects."
                : "Suggested follow-up next week.";

            const appointment = new Appointment({
                patient_id: patient._id,
                patientName: patient.Name || "Anonymous",
                patientPhoneNumber: patient.Phone || faker.phone.number('9#########'),
                doctor_id: faker.helpers.arrayElement(doctorIds),
                doctorScheduleId: faker.helpers.arrayElement(scheduleIds),
                DateOfAppointment: appointmentDate,
                AppStartTime: faker.helpers.arrayElement(["10:00 AM", "11:30 AM", "2:00 PM"]),
                AppEndTime: "1 hour later", // Optional: You can calculate actual end time
                appointment_status: "completed",
                WeekDay: appointmentDate.toLocaleString("en-US", { weekday: "long" }),
                payment_status: "completed",
                payment_id: faker.string.uuid(),
                refund_id: "not applicable",
                cancellation_reason: "not applicable",
                payment_link_id: faker.string.uuid(),
                meeting_link: `https://meetinglink.com/${faker.string.uuid()}`,
                session_started: true,
                session_start_time: appointmentDate,
                isPaidToDoctor: true,
                notes,
                recommendations,
            });

            await appointment.save();
        }
    }

    console.log("✅ Screening tests and appointment records created!");
    mongoose.disconnect();
}

generateData();