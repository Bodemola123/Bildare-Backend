// server-setup.js (or paste at top of your existing index.js before routes)

// core
import { Resend } from 'resend';
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();


const resend = new Resend(process.env.RESEND_API_KEY);

// Prisma
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient(); // instantiate Prisma Client

// sessions (load session BEFORE connect-pg-simple)
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session); // store class
// NOTE: connect-pg-simple requires 'pg' package installed (npm install pg connect-pg-simple)

// passport (OAuth)
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;

const crypto = require("crypto");

const app = express();
app.use(express.json());

// CORS config
const allowedOrigins = [
  "http://localhost:3000",       // local dev
  "https://bildare.vercel.app"   // production
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true, // allow cookies
}));

const isProduction = process.env.NODE_ENV === "production";
app.set("trust proxy", 1); // if behind a proxy (like Heroku/Render)

// Session middleware using Postgres (connect-pg-simple)
app.use(session({
  name: process.env.SESSION_COOKIE_NAME || "sid",
  secret: process.env.SESSION_SECRET || "sessionsecret",
  resave: false,
  saveUninitialized: false,
  store: new pgSession({
    // supply connection string (or a pool) for connect-pg-simple
    conString: process.env.DATABASE_URL,
    tableName: "session",
    schemaName: "auth",
  }),
  cookie: {
    httpOnly: true,
    secure: isProduction,                 // true in production (requires HTTPS)
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,     // 7 days
  },
}));

// Passport initialization (we are issuing JWTs so passport.session() is optional)
// If you plan to use sessions with passport, uncomment the line below:
// app.use(passport.session());
app.use(passport.initialize());

// Logger middleware
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// JWT settings
const SECRET_KEY = process.env.JWT_SECRET || "supersecret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "supersecret_refresh";

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


// Helper function: send OTP email (safe - catches errors)
const sendOtpEmail = async (email, otp) => {
  try {
    await resend.emails.send({
      from: `"Bildare team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Your Bildare Verification Code",
      text: `Hello,\n\nYour One-Time Password (OTP) is: ${otp}\n\nPlease use this code to verify your email. It will expire in 10 minutes.\n\nThank you,\nThe Bildare Team`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.5; color:#333;">
          <h2>Welcome to <span style="color:#ff510d;">Bildare</span> 🎉</h2>
          <p>We are excited to have you on board! To complete your sign up, please verify your email using the OTP below:</p>
          <div style="margin:20px 0; padding:15px; background:#f4f4f4; border-radius:8px; text-align:center;">
            <h1 style="color:#182a4e; letter-spacing:5px;">${otp}</h1>
          </div>
          <p>This code will expire in <b>10 minutes</b>. If you did not request this, please ignore this email.</p>
          <p style="margin-top:30px;">Cheers,<br><b>The Bildare Team</b></p>
        </div>
      `,
    });

    console.log("✅ OTP email sent to", email);
  } catch (err) {
    console.error("❌ Failed to send OTP email:", err.message || err);
    // Don't throw — signup/resend should continue
  }
};

/*
  Passport OAuth strategies using Prisma
  - We will: find user by email; if not present, create user in prisma.user
  - Prisma field names follow your schema: user_id, username, email, is_verified, role, refresh_token
*/

// Utility to generate tokens and persist refresh token in DB
async function createAndStoreTokensForUser(user) {
  const accessToken = jwt.sign(
    { email: user.email, role: user.role },
    SECRET_KEY,
    { expiresIn: "1h" }
  );

  const refreshToken = jwt.sign(
    { email: user.email },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  // store refresh token in DB (field name in schema is `refresh_token`)
  await prisma.user.update({
    where: { email: user.email },
    data: { refresh_token: refreshToken },
  });

  return { accessToken, refreshToken };
}

// GOOGLE STRATEGY
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.NODE_ENV === "production"
    ? "https://bildare-backend.onrender.com/auth/google/callback"
    : "http://localhost:5000/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile?.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (!email) return done(new Error("Google account has no email"), null);

    // Find user by email
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create user
      user = await prisma.user.create({
        data: {
          username: profile.displayName || profile.name?.givenName || email.split("@")[0],
          email,
          is_verified: true,
          role: "user",
        },
      });

      // Create minimal UserProfile
      await prisma.userProfile.create({
        data: {
          user_id: user.user_id,
          first_name: profile.name?.givenName || null,
          last_name: profile.name?.familyName || null,
          bio: null,
          avatar_url: profile.photos?.[0]?.value || null,
        },
      });
    }

    // Create and store JWT tokens
    const tokens = await createAndStoreTokensForUser(user);

    // Return normalized user object
    return done(null, {
      user_id: user.user_id,
      email: user.email,
      username: user.username,
      role: user.role,
      ...tokens,
    });
  } catch (err) {
    return done(err, null);
  }
}));


// GITHUB STRATEGY
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.NODE_ENV === "production"
    ? "https://bildare-backend.onrender.com/auth/github/callback"
    : "http://localhost:5000/auth/github/callback",
  scope: ["user:email"],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile?.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (!email) return done(new Error("GitHub email not available"), null);

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create user
      user = await prisma.user.create({
        data: {
          username: profile.displayName || profile.username || email.split("@")[0],
          email,
          is_verified: true,
          role: "user",
        },
      });

      // Create minimal UserProfile
      await prisma.userProfile.create({
        data: {
          user_id: user.user_id,
          first_name: profile.displayName || profile.username || null,
          last_name: null,
          bio: null,
          avatar_url: profile.photos?.[0]?.value || null,
        },
      });
    }

    const tokens = await createAndStoreTokensForUser(user);

    return done(null, {
      user_id: user.user_id,
      email: user.email,
      username: user.username,
      role: user.role,
      ...tokens,
    });
  } catch (err) {
    return done(err, null);
  }
}));


// (Optional) If you want to use passport sessions uncomment and implement these:
// passport.serializeUser((user, done) => done(null, user.user_id));
// passport.deserializeUser(async (id, done) => {
//   try {
//     const user = await prisma.user.findUnique({ where: { user_id: id }});
//     done(null, user);
//   } catch (err) {
//     done(err, null);
//   }
//});

// Export app and prisma (optional - if you split into modules)
// module.exports = { app, prisma };




// ---------- ROUTES ----------

// 1️⃣ Sign Up (request OTP)
// Request OTP
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otp_expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Generate username from email
    const baseUsername = email.split("@")[0];
    const username = `${baseUsername}_${Math.floor(Math.random() * 10000)}`;

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
        otp,
        otp_expires,
        is_verified: false,
        username,          // auto-generated
        interests: null,   // optional
        profile: { create: {} } // empty profile
      }
    });

    // Send OTP asynchronously

  sendOtpEmail(email, otp);

    res.json({
      message: "OTP sent to email. Please verify within 10 minutes.",
      otp, 
      email,
      username: user.username
    });

  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// 🔁 Resend OTP
app.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (user.is_verified) return res.status(400).json({ error: "Already verified" });

    const today = new Date().toISOString().split("T")[0];
    const lastRequestDay = user.otp_request_date?.toISOString().split("T")[0];

    // Reset counter if new day
    let requestCount = user.otp_request_count;
    if (today !== lastRequestDay) requestCount = 0;

    if (requestCount >= 5) {
      return res.status(429).json({
        error: "Maximum OTP requests reached. Try again tomorrow.",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
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

    sendOtpEmail(email, otp);

    res.json({ message: "New OTP sent to email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// 2️⃣ Verify OTP
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (user.is_verified) return res.status(400).json({ error: "Already verified" });

    if (!user.otp || !user.otp_expires || new Date() > user.otp_expires)
      return res.status(400).json({ error: "OTP expired. Request a new one." });

    if (user.otp !== otp) return res.status(400).json({ error: "Invalid OTP" });

    await prisma.user.update({
      where: { email },
      data: { is_verified: true, otp: null, otp_expires: null },
    });

    res.json({ message: "OTP verified. Now complete your profile." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// 3️⃣ Complete Profile (issues tokens, creates session, and profile)
// Verify OTP then complete profile
app.post("/complete-profile", async (req, res) => {
  try {
    const {
      email,
      password,          // required
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

    if (!email || !password || !username || !role) {
      return res.status(400).json({ error: "Email, password, username, and role are required" });
    }

    // Find existing user (from signup) who may not have completed profile yet
    let existingUser = await prisma.user.findUnique({ where: { email } });

    if (!existingUser) {
      return res.status(400).json({ error: "User not found. Please signup first." });
    }

    if (existingUser.is_verified === false) {
      return res.status(400).json({ error: "Please verify OTP before completing profile." });
    }

    // Check if username is already taken by another user
    const usernameTaken = await prisma.user.findUnique({ where: { username } });
    if (usernameTaken && usernameTaken.user_id !== existingUser.user_id) {
      return res.status(400).json({ error: "Username already taken" });
    }

    // Handle referral code
    let referredByUserId = null;
    if (referralCode) {
      const refRecord = await prisma.referralCode.findUnique({ where: { code: referralCode } });
      if (!refRecord) return res.status(400).json({ error: "Invalid referral code" });
      referredByUserId = refRecord.user_id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate this user's referral code
    const myReferralCode = `${username.slice(0, 4).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;

    // Update user and create profile atomically
    const updatedUser = await prisma.user.update({
      where: { user_id: existingUser.user_id },
      data: {
        username,
        role,
        password_hash: hashedPassword,
        interests: interests || null,
        referred_by: referredByUserId,
        referralCode: myReferralCode,
        profile: {
          create: {
            first_name,
            last_name,
            bio,
            avatar_url,
            social_links: social_links || null
          }
        }
      },
      include: { profile: true }
    });

    // Save referral code in ReferralCode model
    await prisma.referralCode.create({
      data: { code: myReferralCode, user_id: updatedUser.user_id }
    });

    // Generate JWT tokens
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

    // Save session
    req.session.user = {
      user_id: updatedUser.user_id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      accessToken,
      refreshToken,
      profile_id: updatedUser.profile.profile_id,
      referralCode: myReferralCode
    };

    res.json({
      message: "Profile completed successfully!",
      user_id: updatedUser.user_id,
      username: updatedUser.username,
      role: updatedUser.role,
      referralCode: myReferralCode,
      profile: updatedUser.profile,
      accessToken,
      refreshToken
    });

  } catch (err) {
    console.error("COMPLETE PROFILE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});




// 4️⃣ Login
// ======= /login =======
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    // Fetch user including profile
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.is_verified) return res.status(400).json({ error: "Email not verified" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    // Generate JWT tokens
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

    // Update refresh token in DB
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { refresh_token: refreshToken },
      include: { profile: true },
    });

    // Save session including referral code
    req.session.user = {
      user_id: updatedUser.user_id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      accessToken,
      refreshToken,
      profile_id: updatedUser.profile?.profile_id,
      referralCode: updatedUser.referralCode || null, // 👈 added
      referred_by: updatedUser.referred_by || null,   // 👈 added
    };

    res.json({
      message: "Login successful",
      user_id: updatedUser.user_id,
      username: updatedUser.username,
      role: updatedUser.role,
      referralCode: updatedUser.referralCode || null, // 👈 added
      referred_by: updatedUser.referred_by || null,   // 👈 added
      profile: updatedUser.profile || null,
      accessToken,
      refreshToken,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// ======= /me =======
app.get("/me", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });

    const user = await prisma.user.findUnique({
      where: { user_id: req.session.user.user_id },
      include: {
        profile: true,
        referredBy: { select: { user_id: true, username: true, email: true } }, // full referrer info
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      user_id: user.user_id,
      email: user.email,
      username: user.username,
      role: user.role,
      referralCode: user.referralCode || null,    // 👈 added
      referred_by: user.referred_by || null,      // 👈 added
      referredBy: user.referredBy || null,        // 👈 added full object
      accessToken: req.session.user.accessToken,
      refreshToken: req.session.user.refreshToken,
      profile: user.profile || null,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



// ======= Protected profile =======
app.get("/profile", async (req, res) => {
  try {
    if (!req.session.user) return res.sendStatus(401);

    const user = await prisma.user.findUnique({
      where: { user_id: req.session.user.user_id },
      include: { profile: true }, // include UserProfile
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      message: `Welcome ${user.email}`,
      role: user.role,
      user_id: user.user_id,
      username: user.username,
      profile: user.profile || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// ======= Logout =======
app.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Failed to destroy session:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie(process.env.SESSION_COOKIE_NAME || "sid");
    res.json({ message: "Logged out successfully" });
  });
});


// ======= Refresh access token =======
app.post("/token", async (req, res) => {
  try {
    const refreshToken = req.session?.user?.refreshToken || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token required" });

    const user = await prisma.user.findFirst({ where: { refresh_token: refreshToken } });
    if (!user) return res.status(403).json({ error: "Invalid refresh token" });

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, (err) => {
      if (err) return res.status(403).json({ error: "Invalid refresh token" });

      const accessToken = jwt.sign(
        { email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      if (req.session?.user) req.session.user.accessToken = accessToken;

      res.json({ accessToken });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======= Request password reset =======
app.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "User not found" });

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

    await transporter.sendMail({
      from: `"Bildare Auth" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      text: `Use this token to reset your password: ${token}\nExpires in 15 minutes.`,
    });

    res.json({ message: "Password reset token sent to email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// ======= Verify reset token =======
app.post("/verify-reset-token", async (req, res) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ error: "Email and token are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "User not found" });

    if (!user.reset_password_token || user.reset_password_token !== token || new Date() > user.reset_password_expires) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    res.json({ message: "Token is valid. You can now reset your password." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======= Reset password =======
app.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) return res.status(400).json({ error: "Email, token, and new password are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "User not found" });

    if (!user.reset_password_token || user.reset_password_token !== token || new Date() > user.reset_password_expires) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: {
        password_hash: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null
      }
    });

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======= Fetch all users with profiles =======
app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        user_id: true,
        email: true,
        username: true,
        role: true,
        is_verified: true,
        referralCode: true,  // 👈 added
        referred_by: true,   // 👈 added
        profile: true,
      },
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



// ======= Delete user =======
app.delete("/users", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "User ID is required" });

    await prisma.user.delete({ where: { user_id } });

    res.json({ message: "User deleted successfully", user_id });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "User not found" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// Get all active logged-in users
app.get("/active-users", (req, res) => {
  const store = req.sessionStore;

  store.all((err, sessions) => {
    if (err) {
      console.error("Error fetching sessions:", err);
      return res.status(500).json({ error: "Could not fetch active users" });
    }

    const users = [];
    for (const sid in sessions) {
      const session = sessions[sid];
      if (session.user) {
        users.push({
          user_id: session.user.user_id, // align with your session structure
          email: session.user.email,
          username: session.user.username, // was `name` before
          role: session.user.role,
        });
      }
    }

    res.json({
      activeCount: users.length,
      activeUsers: users,
    });
  });
});


// Start Google login
// ---- Google OAuth ----
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth", session: false }),
  async (req, res) => {
    try {
      const { user_id, email, username, role, accessToken, refreshToken } = req.user;

      // Fetch UserProfile (auto-created in strategy)
      const profile = await prisma.userProfile.findUnique({ where: { user_id } });

      // Normalize session
      req.session.user = { 
        user_id, 
        email, 
        username, 
        role, 
        accessToken, 
        refreshToken,
        profile_id: profile?.profile_id || null,
      };

      res.redirect("https://bildare.vercel.app/");
    } catch (err) {
      console.error("Google OAuth callback error:", err);
      res.redirect("/auth");
    }
  }
);

// Start GitHub login
app.get("/auth/github", passport.authenticate("github"));

// GitHub callback
app.get("/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/auth", session: false }),
  async (req, res) => {
    try {
      const { user_id, email, username, role, accessToken, refreshToken } = req.user;

      // Fetch UserProfile (auto-created in strategy)
      const profile = await prisma.userProfile.findUnique({ where: { user_id } });

      // Normalize session
      req.session.user = { 
        user_id, 
        email, 
        username, 
        role, 
        accessToken, 
        refreshToken,
        profile_id: profile?.profile_id || null,
      };

      res.redirect("https://bildare.vercel.app/");
    } catch (err) {
      console.error("GitHub OAuth callback error:", err);
      res.redirect("/auth");
    }
  }
);



// POST endpoint to receive form submissions
app.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Compose email content
    const mailOptions = {
      from: `"Bildare Website Contact" <${process.env.EMAIL_USER}>`,
      to: "bildare.auth@gmail.com",
      subject: `📩 New Contact Form Submission: ${subject}`,
      html: `
      <div style="margin:0; padding:0; font-family: 'Helvetica', Arial, sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#B9F500; text-align:center; padding:20px;">
              <h1 style="margin:0; font-size:24px; color:#000;">Bildare Contact Form</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px; color:#333;">
              <p style="margin:0 0 10px;"><strong>Name:</strong> ${name}</p>
              <p style="margin:0 0 10px;"><strong>Email:</strong> ${email}</p>
              <p style="margin:0 0 10px;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin:20px 0 5px;"><strong>Message:</strong></p>
              <div style="padding:15px; background:#f9f9f9; border-radius:8px; color:#555; line-height:1.5;">
                ${message.replace(/\n/g, "<br>")}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px; text-align:center; font-size:12px; color:#888;">
              This message was sent from the Bildare website contact form.
            </td>
          </tr>
        </table>
      </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Your message has been sent successfully!" });
  } catch (err) {
    console.error("Error sending contact email:", err);
    res.status(500).json({ error: "Failed to send message." });
  }
});


// Root route (for testing)
app.get("/", (req, res) => {
  res.send("🚀 Bildare backend is running!");
});

// --- GA Proxy Route ---
app.post("/analytics", async (req, res) => {
  try {
    const { user_id, user_name, events, page_path } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ success: false, error: "Events array required" });
    }

    // Get client IP (supporting proxies)
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;

    // Build payload for GA4 Measurement Protocol
    const payload = {
      client_id: user_id || crypto.randomUUID(), // required by GA4
      user_id,
      user_properties: {
        user_name: { value: user_name || "Guest" },
      },
      ip_override: clientIp, // send client IP for accurate geolocation
      events: events.map((e) => ({
        name: e.name,
        params: {
          ...e.params,
          page_path: page_path || undefined,
        },
      })),
    };

    // Send event to GA4
    const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`;

    const gaResponse = await fetch(gaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!gaResponse.ok) {
      const text = await gaResponse.text();
      console.error("GA proxy error:", text);
      return res.status(500).json({ success: false, error: text });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("GA proxy exception:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Use PORT provided by Render or fallback for local dev
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

