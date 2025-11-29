// server-setup.js (or paste at top of your existing index.js before routes)

// core
const express = require("express");

const cors = require("cors");
const userRoutes = require("./routes/userRoutes");

const passwordRoutes = require("./routes/passwordRoutes");
const adminRoutes = require("./routes/adminRoutes");
const sessionRoutes = require("./routes/sessionRoutes");

require("dotenv").config();




// sessions (load session BEFORE connect-pg-simple)
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session); // store class
// NOTE: connect-pg-simple requires 'pg' package installed (npm install pg connect-pg-simple)

// passport (OAuth)
const passport = require("passport");

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
app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || "sid",
    secret: process.env.SESSION_SECRET || "sessionsecret",
    resave: false,
    saveUninitialized: false,
    store: new pgSession({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false, // Required for Render/Postgres in production
        },
      },
      tableName: "session",
      schemaName: "auth",
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);


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



// Nodemailer transporter

/*
  Passport OAuth strategies using Prisma
  - We will: find user by email; if not present, create user in prisma.user
  - Prisma field names follow your schema: user_id, username, email, is_verified, role, refresh_token
*/

// Utility to generate tokens and persist refresh token in DB



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




app.use("/user", userRoutes);
app.use("/password", passwordRoutes);
app.use("/auth", require("./routes/authRoutes"));
app.use("/admin", adminRoutes);
app.use("/session", sessionRoutes);
app.use("/contact", require("./routes/contactRoutes"));
app.use("/analytics", require("./routes/analyticsRoutes"));
app.use("/oauth", require("./routes/oauthRoutes"));


// Root route (for testing)
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Bildare backend is running!",
    prismaFields: {
      username_last_changed: "DateTime?"
    }
  });
});



// Use PORT provided by Render or fallback for local dev
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

