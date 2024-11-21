
const mongoose = require("mongoose");

const AdminSchema=new mongoose.Schema({
    "Name":{type:String},
    "emp_id":{type:String},
    "loginId":{type:String},
    "password":{type:String},
    "mobileNo":{type:Number},
    "email":{type:String},
    "dob":{type:Date}
},{
    collection:"Admin"
})

module.exports=mongoose.model("AdminSchema",AdminSchema);


