const express = require("express");
const crypto = require("crypto");
const fetch = require("node-fetch");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { user_id, user_name, events, page_path } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ success: false, error: "Events array required" });
    }

    // Get client IP (supporting proxies)
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;

    // Build payload for GA4 Measurement Protocol
    const payload = {
      client_id: user_id || crypto.randomUUID(),
      user_id,
      user_properties: {
        user_name: { value: user_name || "Guest" },
      },
      ip_override: clientIp,
      events: events.map((e) => ({
        name: e.name,
        params: {
          ...e.params,
          page_path: page_path || undefined,
        },
      })),
    };

    const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`;

    const gaResponse = await fetch(gaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!gaResponse.ok) {
      const text = await gaResponse.text();
      console.error("GA proxy error:", text);
      return res.status(500).json({ success: false, error: text });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("GA proxy exception:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
