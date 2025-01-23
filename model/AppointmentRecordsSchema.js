
const mongoose=require('mongoose');
const {ObjectId} = mongoose.Schema.Types;

const AppointmentRecordsSchema=new mongoose.Schema({
    "patient_id":{type:ObjectId},
    "doctor_id":{type:ObjectId},
    "DateOfAppointment":{type:Date},
    "WeekDay":{type:String}
},{
    collection:"AppointmentRecords"
})

module.exports=mongoose.model("AppointmentRecordsSchema",AppointmentRecordsSchema);