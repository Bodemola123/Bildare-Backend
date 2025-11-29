import prisma from "../config/db.js";

// ================= /me =====================
export const getMe = async (req, res) => {
  try {
    if (!req.session.user)
      return res.status(401).json({ error: "Not authenticated" });

    const userId = req.session.user.user_id;

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        profile: true,
        referredBy: {
          select: { user_id: true, username: true, email: true },
        },
      },
    });

    if (!user)
      return res.status(404).json({ error: "User not found" });

    const referralCount = await prisma.user.count({
      where: { referred_by: userId },
    });

    res.json({
      user_id: user.user_id,
      email: user.email,
      username: user.username,
      role: user.role,
      interests: user.interests || null,
      referralCode: user.referralCode || null,
      referred_by: user.referred_by || null,
      referredBy: user.referredBy || null,
      referralCount,
      accessToken: req.session.user.accessToken,
      refreshToken: req.session.user.refreshToken,
      profile: user.profile,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


// ================= /profile =====================
export const getProfile = async (req, res) => {
  try {
    if (!req.session.user) return res.sendStatus(401);

    const user = await prisma.user.findUnique({
      where: { user_id: req.session.user.user_id },
      include: { profile: true },
    });

    if (!user)
      return res.status(404).json({ error: "User not found" });

    res.json({
      message: `Welcome ${user.email}`,
      role: user.role,
      user_id: user.user_id,
      username: user.username,
      profile: user.profile,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
