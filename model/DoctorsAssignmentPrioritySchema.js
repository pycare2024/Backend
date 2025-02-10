
const mongoose = require("mongoose");
const {ObjectId} = mongoose.Schema.Types;

const DoctorAssignmentPrioritySchema=new mongoose.Schema({
    "Date":{type:Date},
    "LastDoctorAssigned":{type:ObjectId}
},{
    collection:"DoctorsAssignmentPriority"
})

module.exports=mongoose.model("DoctorsAssignmentPrioritySchema",DoctorAssignmentPrioritySchema);