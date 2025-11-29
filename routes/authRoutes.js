const express = require("express");
const {
  signup,
  resendOtp,
  verifyOtp,
  completeProfile,
  login,
  logout,
  refreshToken,
} = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/resend-otp", resendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/complete-profile", completeProfile);
router.post("/login", login);
router.post("/logout", logout);
router.post("/token", refreshToken);

module.exports = router;
