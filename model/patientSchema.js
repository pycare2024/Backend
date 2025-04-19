
const mongoose=require("mongoose");

const patientSchema=new mongoose.Schema({
    "Name":{type:String},
    "Age":{type:Number},
    "Gender":{type:String},
    "Location":{type:String},
    "Mobile":{type:Number},
    "Problem":{type:[String]}
},{
    collection: "Patients"
})

module.exports=mongoose.model("patientSchema",patientSchema);