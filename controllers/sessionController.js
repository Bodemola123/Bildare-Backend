import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const getActiveUsers = async (req, res) => {
  try {
    // Query all sessions from the Postgres session table
    const result = await pool.query(`SELECT sess FROM auth.session`);

    const users = [];

    for (const row of result.rows) {
      const session = row.sess; // JSONB from Postgres (no need to JSON.parse)

      if (session && session.user) {
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
