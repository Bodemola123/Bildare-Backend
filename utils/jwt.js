const jwt = require("jsonwebtoken");
import prisma from "../config/db.js";
import { JWT_REFRESH_SECRET, JWT_SECRET } from "../config/env.js";


async function createAndStoreTokensForUser(user) {
  const accessToken = jwt.sign(
    { email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const refreshToken = jwt.sign(
    { email: user.email },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  await prisma.user.update({
    where: { email: user.email },
    data: { refresh_token: refreshToken },
  });

  return { accessToken, refreshToken };
}

module.exports = { createAndStoreTokensForUser };
