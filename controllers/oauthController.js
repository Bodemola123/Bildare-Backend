import prisma from "../config/db.js";

export const googleCallback = async (req, res) => {
  try {
    const { user_id, email, username, role, accessToken, refreshToken } = req.user;

    const normalEmail = email.trim().toLowerCase();

    const profile = await prisma.userProfile.findUnique({
      where: { user_id },
    });

    req.session.user = {
      user_id,
      email: normalEmail,
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
};

export const githubCallback = async (req, res) => {
  try {
    const { user_id, email, username, role, accessToken, refreshToken } = req.user;

    const normalEmail = email.trim().toLowerCase();

    const profile = await prisma.userProfile.findUnique({
      where: { user_id },
    });

    req.session.user = {
      user_id,
      email: normalEmail,
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
};
