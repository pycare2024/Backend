const mongoose = require("mongoose");

const QuerySchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phno: { type: Number, required: true },
        query: { type: String, required: true },
    },
    {
        collection: "Queries",
    }
);

module.exports = mongoose.model("QuerySchema", QuerySchema);