const express = require("express");
const {
  getAllUsers,
  deleteUser
} = require("../controllers/adminController");

const router = express.Router();

router.get("/users", getAllUsers);
router.delete("/users", deleteUser);

module.exports = router;
