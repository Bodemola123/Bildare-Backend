const express = require("express");
const {
  getMe,
  getProfile
} = require("../controllers/userController");

const router = express.Router();

router.get("/me", getMe);
router.get("/profile", getProfile);

module.exports = router;
