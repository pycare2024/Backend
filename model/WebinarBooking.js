const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const WebinarBookingSchema = new mongoose.Schema({

    webinar_id: { type: String, ref: "Webinar", required: true }, // foreign key
    patient_id: { type: ObjectId, ref: "Patient", required: true },
    pateint_name : {type: String , required:true},

    bookingDate: { type: Date, default: Date.now },

    payment_status: {
        type: String,
        enum: ["pending", "confirmed", "failed", "refunded"],
        default: "pending"
    },
    payment_id: { type: String, default: null },
    refund_id: { type: String, default: null },
    payment_link_id: { type: String, default: null },

    // booking_status: {
    //     type: String,
    //     enum: ["active", "cancelled"],
    //     default: "active"
    // }
},
{ timestamps: true, collection: "WebinarBookings" });

module.exports = mongoose.model("WebinarBooking", WebinarBookingSchema);
