
const express=require("express");
const mongoose=require("mongoose");
const patientRoute = require("./controller/patientRoute");
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
const NewScreeningTestRoute = require("./controller/NewScreeningTestRoute");
const dotenv = require("dotenv");
const PaymentRoute = require("./controller/PaymentRoute");
const OperatorRoute = require("./controller/OperatorRoute");
const autoCancelAppointment = require("./Utility/autoCancelAppointment");
const CorporateRoute = require("./controller/CorporateRoute");
const EmailRoute = require("./controller/EmailRoute");
const FeedbackRoute = require("./controller/FeedbackRoute");
const StudentPatientRoute = require("./controller/StudentPatientRoute");
const CorporateMasterRoute = require("./controller/CorporateMasterRoute");
const AppointmentReminderCronJob = require("./Utility/appointmentReminderCron");
const WhatsappRoute = require("./controller/WhatsappRoute");
const WebinarRoute = require("./controller/WebinarRoutes");
const InternshipRoute = require("./controller/InternshipRoutes");


dotenv.config();

const app=express();
app.use(express.json());

const GeminiRoute = require("./controller/GeminiRoute");

mongoose.set("strictQuery",true); //To Supress the depriciation waring(-- for my help !)
mongoose.connect("mongodb+srv://vae0620:Amen123@cluster0.yagt9.mongodb.net/CompanyDb");
const db=mongoose.connection;
db.on("open",()=>console.log("Connected to DataBase"));
db.on("error",(error)=>console.log("Error Occurred"));

autoCancelAppointment();

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
app.use("/NewScreeningTestRoute",NewScreeningTestRoute);
app.use("/GeminiRoute",GeminiRoute);
app.use("/PaymentRoute",PaymentRoute);
app.use("/OperatorRoute",OperatorRoute);
app.use("/CorporateRoute",CorporateRoute);
app.use("/EmailRoute",EmailRoute);
app.use("/FeedbackRoute",FeedbackRoute);
app.use("/StudentPatientRoute",StudentPatientRoute);
app.use("/CorporateMasterRoute",CorporateMasterRoute);
AppointmentReminderCronJob();
app.use("/WhatsappRoute",WhatsappRoute);
app.use("/WebinarRoute",WebinarRoute);
app.use("/InternshipRoute",InternshipRoute);

app.listen(4000,()=>{
    console.log("Server started at 4000");
});