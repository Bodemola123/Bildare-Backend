export const getActiveUsers = (req, res) => {
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
          user_id: session.user.user_id,
          email: session.user.email,
          username: session.user.username,
          role: session.user.role,
        });
      }
    }

    res.json({
      activeCount: users.length,
      activeUsers: users,
    });
  });
};
