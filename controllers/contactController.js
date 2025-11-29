const sendmailOptions = require("../utils/email");

module.exports = {
  sendContactMessage: async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;

      if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: "All fields are required." });
      }

      await sendmailOptions(name, email, subject, message);

      res.json({ message: "Your message has been sent successfully!" });
    } catch (err) {
      console.error("Error sending contact email:", err);
      res.status(500).json({ error: "Failed to send message." });
    }
  },
};
