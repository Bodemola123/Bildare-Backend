const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
import prisma from "../config/db.js";
const { createAndStoreTokensForUser } = require("../utils/jwt");

module.exports = function initializePassport() {

  // GOOGLE STRATEGY
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.NODE_ENV === "production"
        ? "https://bildare-backend.onrender.com/auth/google/callback"
        : "http://localhost:5000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let email = profile?.emails?.[0]?.value?.toLowerCase();
        if (!email) return done(new Error("Google no email"), null);

        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          user = await prisma.user.create({
            data: {
              username: profile.displayName || email.split("@")[0],
              email,
              is_verified: true,
              role: "user",
            },
          });

          await prisma.userProfile.create({
            data: {
              user_id: user.user_id,
              first_name: profile.name?.givenName,
              last_name: profile.name?.familyName,
              avatar_url: profile.photos?.[0]?.value || null
            }
          });
        }

        const tokens = await createAndStoreTokensForUser(user);

        done(null, {
          user_id: user.user_id,
          email,
          username: user.username,
          role: user.role,
          ...tokens
        });

      } catch (err) {
        done(err, null);
      }
    }
  ));


  // GITHUB STRATEGY
  passport.use(new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.NODE_ENV === "production"
        ? "https://bildare-backend.onrender.com/auth/github/callback"
        : "http://localhost:5000/auth/github/callback",
      scope: ["user:email"]
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let email = profile?.emails?.[0]?.value?.toLowerCase();
        if (!email) return done(new Error("GitHub no email"), null);

        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          user = await prisma.user.create({
            data: {
              username: profile.displayName || profile.username,
              email,
              is_verified: true,
              role: "user",
            },
          });

          await prisma.userProfile.create({
            data: {
              user_id: user.user_id,
              first_name: profile.displayName || profile.username,
              avatar_url: profile.photos?.[0]?.value || null
            }
          });
        }

        const tokens = await createAndStoreTokensForUser(user);

        done(null, {
          user_id: user.user_id,
          email,
          username: user.username,
          role: user.role,
          ...tokens
        });

      } catch (err) {
        done(err, null);
      }
    }
  ));

  return passport;
};
