const mongoose = require("mongoose");

const partnerSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    public_id: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String, // Optional: useful since your frontend tracks file.name
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Partner", partnerSchema);