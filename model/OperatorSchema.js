
const mongoose = require("mongoose");

const OperatorSchema=new mongoose.Schema({
    "Name":{type:String},
    "loginId":{type:String},
    "password":{type:String},
    "mobileNo":{type:Number},
    "email":{type:String},
    "dob":{type:Date}
},{
    collection:"Operator"
})

module.exports=mongoose.model("OperatorSchema",OperatorSchema);


