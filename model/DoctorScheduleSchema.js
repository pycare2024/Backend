
const mongoose=require('mongoose');
const {ObjectId} = mongoose.Schema.Types;

const DoctorScheduleSchema=new mongoose.Schema({
    "doctor_id":{type:ObjectId},
    "Date":{type:Date},
    "SlotsAvailable":{type:String},
    "WeekDay":{type:String}
},{
    collection:"DoctorSchedule"
})

module.exports=mongoose.model("DoctorScheduleSchema",DoctorScheduleSchema);