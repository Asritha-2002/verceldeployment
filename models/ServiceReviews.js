const mongoose = require("mongoose");

// Admin-entered service reviews/testimonials -- not linked to a real user
// or appointment, just a service name + review text + rating.
const serviceReviewSchema = new mongoose.Schema(
  {
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    review: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceReview", serviceReviewSchema);