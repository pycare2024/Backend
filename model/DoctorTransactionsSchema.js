
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const DoctorTransactionsSchema = new mongoose.Schema({
  doctorId: {
    type: ObjectId,
    ref: 'Doctor',
    required: true,
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  source: {
    type: String,
    enum: ['appointment', 'withdrawal', 'adjustment'],
    required: true,
  },
  referenceId: {
    type: String,
    default: null, // Optional link to appointment, payout etc.
  },
  note: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
}, {
  collection:"DoctorTransactions"
});

module.exports = mongoose.model('DoctorTransactionsSchema', DoctorTransactionsSchema);