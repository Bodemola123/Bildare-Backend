import prisma from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendOtpEmail } from "../utils/email.js";
import generateOtp from "../utils/generateOtp.js";

// ---------------------------------------------------------
// 1. SIGNUP
// ---------------------------------------------------------
export const signup = async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    email = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otp_expires = new Date(Date.now() + 10 * 60 * 1000);

    // USER EXISTS BUT NOT VERIFIED → resend OTP
    if (existingUser && !existingUser.is_verified) {
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          password_hash: hashedPassword,
          otp,
          otp_expires,
          otp_request_count: { increment: 1 },
          otp_request_date: new Date(),
        },
      });

      await sendOtpEmail(email, otp);

      return res.json({
        message: "OTP resent. Please verify your email.",
        email,
        username: updatedUser.username,
      });
    }

    // USER EXISTS AND VERIFIED → block
    if (existingUser && existingUser.is_verified) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // NEW USER → create
    const baseUsername = email.split("@")[0];
    const username = `${baseUsername}_${Math.floor(Math.random() * 10000)}`;

    const newUser = await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
        otp,
        otp_expires,
        is_verified: false,
        username,
        interests: null,
        otp_request_count: 1,
        otp_request_date: new Date(),
        profile: { create: {} },
      },
    });

    await sendOtpEmail(email, otp);

    return res.json({
      message: "OTP sent to email. Please verify within 10 minutes.",
      email,
      username: newUser.username,
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ---------------------------------------------------------
// 2. RESEND OTP
// ---------------------------------------------------------
export const resendOtp = async (req, res) => {
  try {
    let { email } = req.body;
    email = email.trim().toLowerCase();

    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (user.is_verified) return res.status(400).json({ error: "Already verified" });

    const today = new Date().toISOString().split("T")[0];
    const lastRequestDay = user.otp_request_date?.toISOString().split("T")[0];

    let requestCount = user.otp_request_count;
    if (today !== lastRequestDay) requestCount = 0;

    if (requestCount >= 5) {
      return res.status(429).json({
        error: "Maximum OTP requests reached. Try again tomorrow.",
      });
    }

    const otp = generateOtp();
    const otp_expires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: {
        otp,
        otp_expires,
        otp_request_count: requestCount + 1,
        otp_request_date: new Date(),
      },
    });

    await sendOtpEmail(email, otp);

    res.json({ message: "New OTP sent to email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ---------------------------------------------------------
// 3. VERIFY OTP
// ---------------------------------------------------------
export const verifyOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;
    email = email.trim().toLowerCase();

    if (!email || !otp)
      return res.status(400).json({ error: "Email and OTP are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (user.is_verified) return res.status(400).json({ error: "Already verified" });

    if (!user.otp || !user.otp_expires || new Date() > user.otp_expires)
      return res.status(400).json({ error: "OTP expired. Request a new one." });

    if (user.otp !== otp)
      return res.status(400).json({ error: "Invalid OTP" });

    await prisma.user.update({
      where: { email },
      data: { otp: null, otp_expires: null },
    });

    res.json({ message: "OTP verified. Now complete your profile." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// ---------------------------------------------------------
// 4. COMPLETE PROFILE
// ---------------------------------------------------------
export const completeProfile = async (req, res) => {
  try {
    let {
      email,
      username,
      role,
      first_name,
      last_name,
      bio,
      avatar_url,
      interests,
      social_links,
      referralCode
    } = req.body;

    email = email.trim().toLowerCase();

    if (!email || !username || !role)
      return res.status(400).json({ error: "Email, username, and role are required" });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser)
      return res.status(400).json({ error: "User not found" });

    const usernameTaken = await prisma.user.findUnique({ where: { username } });
    if (usernameTaken && usernameTaken.user_id !== existingUser.user_id)
      return res.status(400).json({ error: "Username already taken, Please Change" });

    // REFERRAL HANDLING
    let referredByUserId = null;

    if (referralCode) {
      const ref = await prisma.referralCode.findUnique({ where: { code: referralCode } });

      if (!ref)
        return res.status(400).json({ error: "Invalid referral code" });

      if (ref.user_id === existingUser.user_id)
        return res.status(400).json({ error: "You cannot use your own referral code" });

      if (existingUser.referred_by)
        return res.status(400).json({ error: "Referral code already used" });

      referredByUserId = ref.user_id;

      await prisma.referralCode.update({
        where: { code: referralCode },
        data: { uses: { increment: 1 } }
      });
    }

    const cleanedUsername = username.replace(/[^a-zA-Z0-9]/g, "");
    const myReferralCode =
      cleanedUsername.slice(0, 4).toUpperCase() +
      Math.floor(1000 + Math.random() * 9000);

    const updatedUser = await prisma.user.update({
      where: { user_id: existingUser.user_id },
      data: {
        username,
        role,
        is_verified: true,
        interests: interests || null,
        referred_by: referredByUserId,
        referralCode: myReferralCode,
        profile: {
          update: {
            first_name,
            last_name,
            bio,
            avatar_url,
            social_links,
          },
        },
      },
      include: { profile: true },
    });

    await prisma.referralCode.create({
      data: { code: myReferralCode, user_id: updatedUser.user_id },
    });

    const accessToken = jwt.sign(
      { email: updatedUser.email, role: updatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const refreshToken = jwt.sign(
      { email: updatedUser.email },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    req.session.user = {
      user_id: updatedUser.user_id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      accessToken,
      refreshToken,
      profile_id: updatedUser.profile.profile_id,
      referralCode: myReferralCode,
    };

    res.json({
      message: "Profile completed successfully!",
      user_id: updatedUser.user_id,
      username: updatedUser.username,
      role: updatedUser.role,
      referralCode: myReferralCode,
      profile: updatedUser.profile,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("COMPLETE PROFILE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= LOGIN =====================
export const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email.trim().toLowerCase();

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.is_verified)
      return res.status(400).json({ error: "Email not verified" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    // Generate tokens
    const accessToken = jwt.sign(
      { email: user.email, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const refreshToken = jwt.sign(
      { email: user.email },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { refresh_token: refreshToken },
      include: { profile: true },
    });

    // Save session
    req.session.user = {
      user_id: updatedUser.user_id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      accessToken,
      refreshToken,
      profile_id: updatedUser.profile?.profile_id,
      referralCode: updatedUser.referralCode || null,
      referred_by: updatedUser.referred_by || null,
    };

    res.json({
      message: "Login successful",
      ...req.session.user,
      profile: updatedUser.profile,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


// ================= LOGOUT =====================
export const logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Failed to destroy session:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie(process.env.SESSION_COOKIE_NAME || "sid");
    res.json({ message: "Logged out successfully" });
  });
};


// ================= REFRESH TOKEN =====================
export const refreshToken = async (req, res) => {
  try {
    const refreshToken =
      req.session?.user?.refreshToken || req.body.refreshToken;

    if (!refreshToken)
      return res.status(401).json({ error: "Refresh token required" });

    const user = await prisma.user.findFirst({
      where: { refresh_token: refreshToken },
    });

    if (!user)
      return res.status(403).json({ error: "Invalid refresh token" });

    jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET,
      (err) => {
        if (err)
          return res.status(403).json({ error: "Invalid refresh token" });

        const accessToken = jwt.sign(
          { email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        if (req.session?.user)
          req.session.user.accessToken = accessToken;

        res.json({ accessToken });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
