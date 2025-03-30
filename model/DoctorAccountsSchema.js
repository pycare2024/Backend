
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const DoctorAccountsSchema = new mongoose.Schema({
    doctorId: {
        type: ObjectId,
        ref: 'Doctor',
        required: true,
        unique: true, // One account per doctor
    },
    totalEarnings: {
        type: Number,
        default: 0,
    },
    totalWithdrawn: {
        type: Number,
        default: 0,
    },
    currentBalance: {
        type: Number,
        default: 0,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
}, {
    collection:"DoctorAccounts"
});

module.exports = mongoose.model("DoctorAccountsSchema", DoctorAccountsSchema);