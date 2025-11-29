import prisma from "../config/db.js";
import bcrypt from "bcrypt";
import { sendTokenEmail } from "../utils/email.js";


// ================= REQUEST PASSWORD RESET =====================
export const requestPasswordReset = async (req, res) => {
  try {
    let { email } = req.body;
    email = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(400).json({ error: "User not found" });

    const today = new Date().toISOString().split("T")[0];
    const lastRequestDay = user.otp_request_date?.toISOString().split("T")[0];

    let requestCount = user.otp_request_count;
    if (today !== lastRequestDay) requestCount = 0;

    if (requestCount >= 5) {
      return res.status(429).json({
        error: "Maximum password reset requests reached. Try again tomorrow.",
      });
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: {
        reset_password_token: token,
        reset_password_expires: expires,
        otp_request_count: requestCount + 1,
        otp_request_date: new Date(),
      },
    });

    await sendTokenEmail(email, token);

    res.json({ message: "Password reset token sent to email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


// ================= VERIFY RESET TOKEN =====================
export const verifyResetToken = async (req, res) => {
  try {
    let { email, token } = req.body;
    email = email.trim().toLowerCase();

    if (!email || !token)
      return res.status(400).json({ error: "Email and token are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(400).json({ error: "User not found" });

    if (
      !user.reset_password_token ||
      user.reset_password_token !== token ||
      new Date() > user.reset_password_expires
    ) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    res.json({ message: "Token is valid. You can now reset your password." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


// ================= RESET PASSWORD =====================
export const resetPassword = async (req, res) => {
  try {
    let { email, token, newPassword } = req.body;
    email = email.trim().toLowerCase();

    if (!email || !token || !newPassword)
      return res.status(400).json({ error: "Email, token, and new password required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(400).json({ error: "User not found" });

    if (
      !user.reset_password_token ||
      user.reset_password_token !== token ||
      new Date() > user.reset_password_expires
    ) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: {
        password_hash: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null,
      },
    });

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
