const express = require("express");
const {
  getMe,
  getProfile,
  updateUser,
  changePassword
} = require("../controllers/userController");

const router = express.Router();

router.get("/me", getMe);
router.get("/profile", getProfile);
router.put("/update-user", updateUser); // <-- add this
router.put("/change-password", changePassword ); // <-- add this

module.exports = router;
