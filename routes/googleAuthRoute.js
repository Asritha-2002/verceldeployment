const passport      = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt           = require("jsonwebtoken");
const User          = require("../models/User");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const express = require("express");
const router = express.Router();
const {sendVerificationEmail, sendPasswordResetEmail, sendContactEmail}=require('../config/email')

// ── Configure Google Strategy ──────────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(null, false, { message: "No email from Google" });

      let user = await User.findOne({ email });

      if (!user) {
        // ── NEW USER via Google ──────────────────────────────────────────
        const verificationToken = crypto.randomBytes(32).toString("hex");

        user = await User.create({
          name:               profile.displayName,
          email,
          phone:              "",
          password:           crypto.randomBytes(16).toString("hex"), // random, unusable
          googleId:           profile.id,
          profilePic:         profile.photos?.[0]?.value || "",
          isVerified:         false,   // ← not verified yet
          isAdmin:            false,   // ← always false for Google
          verificationToken,
        });

        // Send verification email — same as register route
        try {
          await sendVerificationEmail(user.email, verificationToken);
        } catch (emailErr) {
          console.error("Google auth verification email failed:", emailErr.message);
        }

        // Pass a flag so the callback route knows this is a new unverified user
        user._isNewGoogleUser = true;
        return done(null, user);

      } else {
        // ── EXISTING USER via Google ─────────────────────────────────────
        if (!user.googleId) {
          user.googleId   = profile.id;
          user.profilePic = user.profilePic || profile.photos?.[0]?.value || "";
          await user.save();
        }
        return done(null, user);
      }

    } catch (err) {
      return done(err, null);
    }
  }
));

// ── Step 1: Redirect to Google ─────────────────────────────────────────────
router.get("/auth/google",
  passport.authenticate("google", {
    scope:   ["profile", "email"],
    session: false,
  })
);

// ── Step 2: Google callback ────────────────────────────────────────────────
router.get("/auth/google/callback",
    
  passport.authenticate("google", {
    session:         false,
    failureRedirect: `${process.env.BASE_URL}/sign-in?error=google_failed`,
  }),
  async (req, res) => {
    const user = req.user;

    // ── New unverified user — redirect to sign-in with verify notice ──────
    if (user._isNewGoogleUser || !user.isVerified) {
      return res.redirect(
        `${process.env.BASE_URL}/sign-in?status=verify_email&email=${encodeURIComponent(user.email)}`
      );
    }

    // ── Verified existing user — issue token ──────────────────────────────
    const token = jwt.sign(
      { id: user._id, email: user.email, isAdmin: false },  // ← isAdmin hardcoded false
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    

    res.redirect(
      `${process.env.BASE_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}&isAdmin=false`
      
    );
  }
);


module.exports = router;