const express = require("express");
const {
  getMe,
  getProfile,
  updateUser
} = require("../controllers/userController");

const router = express.Router();

router.get("/me", getMe);
router.get("/profile", getProfile);
router.put("/update-user", updateUser); // <-- add this

module.exports = router;
