const express = require("express");
const passport = require("passport");
const oauthController = require("../controllers/oauthController");

const router = express.Router();

// Google OAuth
router.get("/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth", session: false }),
  oauthController.googleCallback
);

// GitHub OAuth
router.get("/github",
  passport.authenticate("github")
);

router.get("/github/callback",
  passport.authenticate("github", { failureRedirect: "/auth", session: false }),
  oauthController.githubCallback
);

module.exports = router;
