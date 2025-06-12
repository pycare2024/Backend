const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const DoctorAssignmentPrioritySchema = new mongoose.Schema({
  Date: { type: Date },
  
  // NEW FIELDS
  LastPhDTherapistAssigned: { type: ObjectId },  // for corporate
  LastMAConsultantAssigned: { type: ObjectId }   // for retail
}, {
  collection: "DoctorsAssignmentPriority"
});

module.exports = mongoose.model("DoctorsAssignmentPrioritySchema", DoctorAssignmentPrioritySchema);