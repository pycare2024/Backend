
const mongoose=require('mongoose');
const {ObjectId} = mongoose.Schema.Types;

const PatientRecordSchema=new mongoose.Schema({
    "patient_id":{type:ObjectId},
    "DOV":{type:Date},
    "diagnosis":{type:String},
    "prescription":{type:String},
    "notes":{type:String},
    "signed":{type:Boolean},
    "doctor_id":{type:ObjectId}
},{
    collection:"PatientRecords"
})

module.exports=mongoose.model("PatientRecordSchema",PatientRecordSchema);