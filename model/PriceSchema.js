const mongoose = require("mongoose");

const PriceSchema = new mongoose.Schema({
  label: { type: String, required: true }, // e.g. "Mindependence Event Price"
  amount: { type: Number, required: true }, // e.g. 400
  active: { type: Boolean, default: true }, // toggle instead of delete
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Price", PriceSchema);