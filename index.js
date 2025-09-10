const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();
const mongoose = require("mongoose");

// session
const session = require("express-session");
const MongoStore = require("connect-mongo");

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;

const app = express();
app.use(express.json());

// CORS middleware
const allowedOrigins = [
  "http://localhost:3000",       // local dev
  "https://bildare.vercel.app"   // production
];

// --- CORS middleware ---
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true, // important for cookies
}));



const SECRET_KEY = process.env.JWT_SECRET || "supersecret";

// 📧 Setup email transporter (TLS on port 587)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // false for TLS (STARTTLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

// Session middleware (store sessions in MongoDB)
app.set("trust proxy", 1); // keep this

const isProduction = process.env.NODE_ENV === "production";

// ---- Session middleware (single cookie manager) ----
app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || "sid",
    secret: process.env.SESSION_SECRET || "sessionsecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,                 // ✅ true in prod
      sameSite: isProduction ? "none" : "lax", // ✅ allows cross-site OAuth
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// ---- Passport (only initialize, no session) ----
app.use(passport.initialize());

// User schema
const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  role: { type: String },
  otp: { type: String },
  otpExpires: { type: Date },
  verified: { type: Boolean, default: false },
  refreshToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
});

const User = mongoose.model("User", userSchema);

const crypto = require("crypto");

// Helper function: send OTP email (safe - catches errors)
const sendOtpEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `"Bildare Auth" <${process.env.EMAIL_USER}>`,
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
    // do not throw — signup should still succeed; frontend can show notice
  }
};

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.NODE_ENV === "production"
          ? "https://bildare-backend.onrender.com/auth/google/callback"
          : "http://localhost:5000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });
        if (!user) {
          user = await User.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            verified: true,
            role: "user",
          });
        }

        const access = jwt.sign(
          { email: user.email, role: user.role },
          process.env.JWT_SECRET || "supersecret",
          { expiresIn: "1h" }
        );

        const refresh = jwt.sign(
          { email: user.email },
          process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET || "supersecret"),
          { expiresIn: "7d" }
        );

        user.refreshToken = refresh;
        await user.save();

        done(null, {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          accessToken: access,
          refreshToken: refresh,
        });
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:
        process.env.NODE_ENV === "production"
          ? "https://bildare-backend.onrender.com/auth/github/callback"
          : "http://localhost:5000/auth/github/callback",
      scope: ["user:email"], // request user's email
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // GitHub may not return email in profile.emails[0], so handle carefully
        const email =
          profile.emails && profile.emails[0] ? profile.emails[0].value : null;

        if (!email) {
          return done(new Error("GitHub email not available"), null);
        }

        // Find or create user
        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            name: profile.displayName || profile.username,
            email,
            verified: true,
            role: "user",
          });
        }

        // Generate JWT tokens
        const access = jwt.sign(
          { email: user.email, role: user.role },
          process.env.JWT_SECRET || "supersecret",
          { expiresIn: "1h" }
        );

        const refresh = jwt.sign(
          { email: user.email },
          process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET || "supersecret"),
          { expiresIn: "7d" }
        );

        user.refreshToken = refresh;
        await user.save();

        done(null, {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          accessToken: access,
          refreshToken: refresh,
        });
      } catch (err) {
        done(err, null);
      }
    }
  )
);


// ---------- ROUTES ----------

// 1️⃣ Sign Up (request OTP)
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = await User.create({
      email,
      password: hashedPassword,
      otp,
      otpExpires,
      verified: false,
    });

    // send OTP but don't block signup if email fails
    sendOtpEmail(email, otp);

    res.json({ message: "OTP sent to email. Please verify within 10 minutes.", email: newUser.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔁 Resend OTP
app.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (user.verified) return res.status(400).json({ error: "Already verified" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    sendOtpEmail(email, otp);

    res.json({ message: "New OTP sent to email. Please verify within 10 minutes." });
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

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (user.verified) return res.status(400).json({ error: "Already verified" });

    if (!user.otp || !user.otpExpires || new Date() > user.otpExpires) {
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    if (user.otp === otp) {
      user.verified = true;
      user.otp = undefined;
      user.otpExpires = undefined;
      await user.save();
      res.json({ message: "OTP verified. Now complete your profile." });
    } else {
      res.status(400).json({ error: "Invalid OTP" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 3️⃣ Complete Profile (now issues tokens and creates session)
app.post("/complete-profile", async (req, res) => { 
  try {
    const { email, name, role } = req.body;
    if (!email || !name || !role) return res.status(400).json({ error: "Email, name, and role are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.verified) return res.status(400).json({ error: "Email not verified" });

    user.name = name;
    user.role = role;

    const accessToken = jwt.sign({ email: user.email, role: role }, process.env.JWT_SECRET || SECRET_KEY, { expiresIn: "1h" });
    const refreshToken = jwt.sign({ email: user.email }, process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET || SECRET_KEY), { expiresIn: "7d" });

    user.refreshToken = refreshToken;
    await user.save();

    // include user id in session
    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken,
    };

    res.json({ 
      message: "Profile completed successfully!", 
      id: user._id,
      name: user.name, 
      role: user.role 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// 4️⃣ Login (creates session)
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.verified) return res.status(400).json({ error: "Email not verified" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    const accessToken = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET || SECRET_KEY, { expiresIn: "1h" });
    const refreshToken = jwt.sign({ email: user.email }, process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET || SECRET_KEY), { expiresIn: "7d" });

    user.refreshToken = refreshToken;
    await user.save();

    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken,
    };

    res.json({ 
      message: "Login successful", 
      id: user._id,
      name: user.name, 
      role: user.role 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// ---- Unified /me route ----
app.get("/me", (req, res) => {
  if (req.session.user) {
    const { id, email, name, role, accessToken, refreshToken } = req.session.user;
    return res.json({ id, email, name, role, accessToken, refreshToken });
  }
  res.status(401).json({ error: "Not authenticated" });
});




// Logout
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

// 5️⃣ Protected route example using session
app.get("/profile", async (req, res) => {
  try {
    if (!req.session.user) return res.sendStatus(401);
    const user = await User.findOne({ email: req.session.user.email });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: `Welcome ${user.email}`, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Refresh access token endpoint (uses stored refresh tokens)
app.post("/token", async (req, res) => {
  try {
    // read refresh token either from session (preferred) or request body
    const refreshToken = req.session?.user?.refreshToken || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token required" });

    const user = await User.findOne({ refreshToken });
    if (!user) return res.status(403).json({ error: "Invalid refresh token" });

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET || SECRET_KEY), (err, decoded) => {
      if (err) return res.status(403).json({ error: "Invalid refresh token" });
      const accessToken = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET || SECRET_KEY, { expiresIn: "1h" });

      // update session accessToken if exists
      if (req.session && req.session.user) req.session.user.accessToken = accessToken;

      res.json({ accessToken });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Password reset token
app.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    await transporter.sendMail({
      from: `"Bildare Auth" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      text: `You requested a password reset. Use this token to reset your password: ${token}\nThis token expires in 15 minutes.`,
    });

    res.json({ message: "Password reset token sent to email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Verify Reset Token
app.post("/verify-reset-token", async (req, res) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ error: "Email and token are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    if (user.resetPasswordToken !== token || new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    res.json({ message: "Token is valid. You can now reset your password." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Reset Password
app.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) return res.status(400).json({ error: "Email, token, and new password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    if (user.resetPasswordToken !== token || new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Fetch all users (PUBLIC, no authorization required)
app.get("/users", async (req, res) => {
  console.log("GET /users route hit"); // For debugging
  try {
    const users = await User.find(
      {},
      "-password -otp -otpExpires -resetPasswordToken -refreshToken -__v"
    );

    if (!users || users.length === 0) {
      return res.json([]); // return empty array if no verified users
    }

    const formattedUsers = users.map(user => ({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      verified: user.verified
    }));

    res.json(formattedUsers);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete user by id
app.delete("/users", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "User ID is required in the request body" });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully", id });
  } catch (err) {
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

    // Collect users from all sessions
    const users = [];
    for (const sid in sessions) {
      const session = sessions[sid];
      if (session.user) {
        users.push({
          email: session.user.email,
          name: session.user.name,
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

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth", session: false }),
  (req, res) => {
    const { id, email, name, role, accessToken, refreshToken } = req.user;

    req.session.user = { id, email, name, role, accessToken, refreshToken };

    res.redirect("https://bildare.vercel.app/");
  }
);

// Start GitHub login
app.get("/auth/github", passport.authenticate("github"));

// GitHub callback
app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/auth", session: false }),
  (req, res) => {
    const { id, email, name, role, accessToken, refreshToken } = req.user;

    // Save to same session as normal login
    req.session.user = { id, email, name, role, accessToken, refreshToken };

    res.redirect("https://bildare.vercel.app/");
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

