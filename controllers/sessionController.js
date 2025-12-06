import pkg from "pg";
const { Pool } = pkg;
import prisma from "../config/db.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const getActiveUsers = async (req, res) => {
  try {
    const result = await pool.query(`SELECT sess FROM auth.session`);
    const users = [];

    for (const row of result.rows) {
      const session = row.sess;

      if (session?.user) {
        // Check user still exists in DB
        const userExists = await prisma.user.findUnique({
          where: { user_id: session.user.user_id },
          select: { user_id: true },
        });
        if (!userExists) continue;

        users.push({
          user_id: session.user.user_id,
          email: session.user.email,
          username: session.user.username,
          role: session.user.role,
        });
      }
    }

    return res.json({
      activeCount: users.length,
      activeUsers: users,
    });
  } catch (err) {
    console.error("Error getting active users:", err);
    return res.status(500).json({ error: "Could not fetch active users" });
  }
};

