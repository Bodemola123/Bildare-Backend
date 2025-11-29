const express = require("express");
const { getActiveUsers } = require("../controllers/sessionController");

const router = express.Router();

router.get("/active-users", getActiveUsers);

module.exports = router;
