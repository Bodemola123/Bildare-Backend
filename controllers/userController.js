import prisma from "../config/db.js";
import bcrypt from "bcrypt";

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

// =================== UPDATE USER ===================
export const updateUser = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.session.user.user_id;
    const { username, interests, avatar_url } = req.body;

    // Fetch current user
    const user = await prisma.user.findUnique({
      where: { user_id: userId }
    });

    // ============================
    // 📌 USERNAME CHANGE COOL-DOWN
    // ============================
    if (username && username !== user.username) {
      
      // Check if username already exists for another user
      const existing = await prisma.user.findFirst({
        where: {
          username,
          NOT: { user_id: userId }
        }
      });

      if (existing) {
        return res.status(400).json({ error: "Username already taken" });
      }

      // Check cooldown: 30 days (1 month)
      if (user.username_last_changed) {
        const lastChange = new Date(user.username_last_changed);
        const now = new Date();
        const diffDays = (now - lastChange) / (1000 * 60 * 60 * 24);

        if (diffDays < 30) {
          const remaining = Math.ceil(30 - diffDays);
          return res.status(400).json({
            error: `Username can only be changed once every 30 days. Try again in ${remaining} day(s).`
          });
        }
      }
    }

    // ============================
    // UPDATE USER
    // ============================
    const updatedUser = await prisma.user.update({
      where: { user_id: userId },
      data: {
        username: username ?? undefined,
        interests: interests ?? undefined,
        // Update timestamp ONLY if username changed
        username_last_changed:
          username && username !== user.username
            ? new Date()
            : undefined,
      }
    });

    // ============================
    // UPDATE PROFILE
    // ============================
    const updatedProfile = await prisma.userProfile.update({
      where: { user_id: userId },
      data: {
        avatar_url: avatar_url ?? undefined,
      }
    });

    return res.json({
      success: true,
      message: "User updated successfully",
      user: {
        ...updatedUser,
        profile: updatedProfile
      }
    });

  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    // Must be logged in
    if (!req.session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.session.user.user_id;
    const { old_password, new_password, confirm_password } = req.body;

    // Validate input
    if (!old_password || !new_password || !confirm_password) {
      return res.status(400).json({ error: "All password fields are required" });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: "New passwords do not match" });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user || !user.password_hash) {
      return res.status(400).json({ error: "Password change not allowed" });
    }

    // Verify old password
    const isMatch = await bcrypt.compare(old_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Old password is incorrect" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(new_password, 10);

    // Update password in DB
    await prisma.user.update({
      where: { user_id: userId },
      data: { password_hash: hashedNewPassword },
    });

    return res.json({
      success: true,
      message: "Password updated successfully",
    });

  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
};