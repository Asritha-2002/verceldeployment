const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    petCategory: {
      type: String,
      required: true,
    },

    service: {
      type: String,
      required: true,
    },

    dateOfAppointment: {
      type: Date,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["booked","rescheduled","completed","cancelled"],
      default: "booked",
    },
    rescheduleReason:{
      type: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);