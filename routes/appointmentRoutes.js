const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const {auth} = require("../middleware/auth");
const { appointmentSchemas } =require('../validation/schemas');
const {sendAppointmentConfirmationEmail}=require('../config/email')
// ✅ Correct POST route
router.post("/appointments", auth, async (req, res) => {
  try {
    // 🔥 Joi validation here
    const { error } = appointmentSchemas.create.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const appointment = new Appointment({
      userId: req.user.id,
      ...req.body,
    });

    await appointment.save();
    try {
  await sendAppointmentConfirmationEmail(appointment.email, appointment);
} catch (error) {
  console.error("Appointment email failed:", error);
}

    res.status(201).json({
      message: "Appointment booked successfully",
      appointment,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// get appointments
router.get("/my", auth, async (req, res) => {
  try {
    const appointments = await Appointment.find({ userId: req.user.id })
      .sort({ createdAt: -1 }); // ✅ newest first

    const updatedAppointments = await Promise.all(
      appointments.map(async (appt) => {
        const today = new Date();
        const apptDate = new Date(appt.dateOfAppointment);

        // ✅ if booked & date passed → update to completed
        if (appt.status === "booked" && apptDate < today) {
          appt.status = "completed";
          await appt.save();
        }

        return appt;
      })
    );

    res.json(updatedAppointments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/appointments/:id", auth, async (req, res) => {
  try {
    const appointmentId = req.params.id;

    // find appointment
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found",
      });
    }

    // 🔐 ensure user owns this appointment
    if (appointment.userId.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    // ❌ already cancelled
    if (appointment.status === "cancelled") {
      return res.status(400).json({
        message: "Appointment already cancelled",
      });
    }

    // ❌ already completed
    if (appointment.status === "completed") {
      return res.status(400).json({
        message: "Completed appointment cannot be cancelled",
      });
    }

    // ✅ update status
    appointment.status = "cancelled";

    await appointment.save();

    res.status(200).json({
      message: "Appointment cancelled successfully",
      appointment,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

router.put("/appointments/reschedule/:id", auth, async (req, res) => {
  try {
    const { date, time, reason } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: "Not found" });
    }

    appointment.dateOfAppointment = date;
    appointment.time = time;
    appointment.rescheduleReason = reason;

    await appointment.save();

    res.json({
      message: "Rescheduled successfully",
      appointment,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;