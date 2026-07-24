const express = require("express");
const router = express.Router();
const ServiceReview = require("../models/ServiceReviews");
const Appointment = require("../models/Appointment");
const {auth,adminAuth} = require("../middleware/auth");
const { reviewSchemas } = require("../validation/schemas"); // adjust path
const Order = require("../models/Order"); // adjust path
const OrderReview=require("../models/OrderReview")

// GET /service-reviews -- public, for the Testimonials section
router.get("/service-reviews", async (req, res) => {
  try {
    const reviews = await ServiceReview.find().sort({ createdAt: -1 }).lean();

    const formatted = reviews.map((r) => ({
      id: r._id,
      review: r.review,
      rating: r.rating,
      userName: r.serviceName, // reused as the display name, no separate field for it
    }));

    res.status(200).json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /reviews -- list all service reviews, newest first
router.get("/reviews", auth, adminAuth, async (req, res) => {
  try {
    const reviews = await ServiceReview.find().sort({ createdAt: -1 });
    res.status(200).json({ reviews });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /reviews -- admin creates a service review directly
router.post("/reviews", auth, adminAuth, async (req, res) => {
  try {
    const { serviceName, rating, review } = req.body;

    if (!serviceName || !rating || !review) {
      return res.status(400).json({ message: "Service name, rating, and review are required" });
    }

    const newReview = new ServiceReview({ serviceName, rating, review });
    await newReview.save();

    res.status(201).json({ message: "Review created successfully", review: newReview });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /reviews/:id -- edit service name, rating, or review text
router.put("/reviews/:id", auth, adminAuth, async (req, res) => {
  try {
    const { serviceName, rating, review } = req.body;

    const existing = await ServiceReview.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Review not found" });

    if (serviceName !== undefined) existing.serviceName = serviceName;
    if (rating !== undefined) existing.rating = rating;
    if (review !== undefined) existing.review = review;

    await existing.save();
    res.status(200).json({ message: "Review updated successfully", review: existing });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /reviews/:id
router.delete("/reviews/:id", auth, adminAuth, async (req, res) => {
  try {
    const existing = await ServiceReview.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Review not found" });

    await existing.deleteOne();
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;