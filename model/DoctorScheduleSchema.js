
const mongoose=require('mongoose');
const {ObjectId} = mongoose.Schema.Types;

const DoctorScheduleSchema=new mongoose.Schema({
    "doctor_id":{type:ObjectId},
    "Date":{type:Date},
    "SlotsAvailable":{type:Number},
    "WeekDay":{type:String},
    "Slots":[
        {
            startTime:{type:String, required : true},
            endTime:{type:String, required : true},
            isBooked:{type:Boolean, default : false},
            bookedBy: {type:ObjectId , ref:"Patient", default:null}
        }
    ]
},{
    collection:"DoctorSchedule"
})



module.exports=mongoose.model("DoctorScheduleSchema",DoctorScheduleSchema);

//Sample record 

/*
{
    "_id": "65f93d4a4e...",
    "doctor_id": "65f8ab123...",
    "Date": "2025-03-26T00:00:00.000Z",
    "WeekDay": "Tuesday",
    "SlotsAvailable": 4,
    "Slots": [
        { "startTime": "10:00 AM", "endTime": "10:30 AM", "isBooked": false, "bookedBy": null },
        { "startTime": "10:30 AM", "endTime": "11:00 AM", "isBooked": true, "bookedBy": "65f91234..." }
    ]
}
*/ 