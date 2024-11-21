
const mongoose=require("mongoose");
const {ObjectId}=mongoose.Schema.Types;

const ScreeningTestSchema=new mongoose.Schema({
    "1":{type:String},
    "2":{type:String},
    "3":{type:String},
    "4":{type:String},
    "5":{type:String},
    "6":{type:String},
    "7":{type:String},
    "8":{type:String},
    "9":{type:String},
    "10":{type:String},
    "11":{type:String},
    "12":{type:String},
    "13":{type:String},
    "14":{type:String},
    "15":{type:String},
    "16":{type:String},
    "17":{type:String},
    "18":{type:String},
    "patient_id":{type:ObjectId},
    "DateOfTest":{type:Date}
},{
    collection:"ScreeningTestRecords"
})

module.exports=mongoose.model("ScreeningTestSchema",ScreeningTestSchema);