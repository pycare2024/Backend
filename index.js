
const express=require("express");
const mongoose=require("mongoose");
const patientRoute=require("./controller/patientRoute");
const AdminRoute=require("./controller/AdminRoute");
const DoctorRoute=require("./controller/DoctorRoute");
const QueryRoute=require("./controller/QueryRoute");
const ScreeningTestRoute=require("./controller/ScreeningTestRoute");
const AppointmentRoute=require("./controller/AppointmentRoute");
const DoctorScheduleRoute=require("./controller/DoctorScheduleRoute");
const bodyParser=require("body-parser");
const cors=require("cors");
const OtpRoute = require("./controller/OtpRoute");
const CredentialsRoute = require("./controller/CredentialsRoute");
const path = require("path");

const app=express();
app.use(express.json());

mongoose.set("strictQuery",true); //To Supress the depriciation waring(-- for my help !)
mongoose.connect("mongodb+srv://vae0620:Amen123@cluster0.yagt9.mongodb.net/CompanyDb");
const db=mongoose.connection;
db.on("open",()=>console.log("Connected to DataBase"));
db.on("error",(error)=>console.log("Error Occurred"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(cors());
app.use("/patientRoute",patientRoute);
app.use("/DoctorRoute",DoctorRoute);
app.use("/AdminRoute",AdminRoute);
app.use("/QueryRoute",QueryRoute);
app.use("/ScreeningTestRoute",ScreeningTestRoute);
app.use("/AppointmentRoute",AppointmentRoute);
app.use("/DoctorScheduleRoute",DoctorScheduleRoute);
app.use("/OtpRoute",OtpRoute);
app.use("/CredentialsRoute",CredentialsRoute);
app.use("/Uploads",express.static(path.join(__dirname,"Uploads")));

app.listen(4000,()=>{
    console.log("Server started at 4000");
});