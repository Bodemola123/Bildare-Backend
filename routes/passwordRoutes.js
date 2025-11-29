const express = require("express");
const {
  requestPasswordReset,
  verifyResetToken,
  resetPassword
} = require("../controllers/passwordController");

const router = express.Router();

router.post("/request-password-reset", requestPasswordReset);
router.post("/verify-reset-token", verifyResetToken);
router.post("/reset-password", resetPassword);

module.exports = router;
