import prisma from "../config/db.js";

// ================= GET ALL USERS =====================
export const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        user_id: true,
        email: true,
        username: true,
        role: true,
        is_verified: true,
        referralCode: true,
        referred_by: true,
        profile: true,
      },
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};


// ================= DELETE USER =====================
export const deleteUser = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id)
      return res.status(400).json({ error: "User ID is required" });

    await prisma.referralCode.deleteMany({ where: { user_id } });

    await prisma.user.delete({ where: { user_id } });

    res.json({ message: "User deleted successfully", user_id });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "User not found" });

    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
