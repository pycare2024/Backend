
const mongoose=require("mongoose");
const { collection } = require("./AdminSchema");

const DoctorSchema=mongoose.Schema({
    "id":{type:String},
    "Name":{type:String},
    "Age":{type:Number},
    "Address":{type:String},
    "Qualification":{type:String},
    "loginId":{type:String},
    "password":{type:String},
    "Gender":{type:String},
    "Mobile":{type:Number},
    "dob":{type:Date}
},{
    collection:"Doctors"
})

module.exports=mongoose.model("DoctorSchema",DoctorSchema);