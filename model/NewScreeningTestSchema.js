const mongoose = require("mongoose");
const {ObjectId} = mongoose.Schema.Types;

const NewScreeningTestSchema=new mongoose.Schema({
    "patient_id":{type:ObjectId},
    "depression":{type:Number},
    "anxiety":{type:Number},
    "ocd":{type:Number},
    "ptsd":{type:Number},
    "sleep":{type:Number},
    "DateOfTest":{type:Date},
    "report":{type:String}
},{
    collection:"NewScreeningTestRecords"
})

module.exports=mongoose.model("NewScreeningTestSchema",NewScreeningTestSchema);