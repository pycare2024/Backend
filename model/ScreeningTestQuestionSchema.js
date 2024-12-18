
const mongoose=require("mongoose");
const {ObjectId}=mongoose.Schema.Types;

const ScreeningTestQuestionSchema=new mongoose.Schema({
    "no":{type:Number},
    "eng":{type:String},
    "hin":{type:String}
},{
    collection:"ScreeningTestQuestions"
})

module.exports=mongoose.model("ScreeningTestQuestionSchema",ScreeningTestQuestionSchema);