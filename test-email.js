require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // use STARTTLS
  auth: {
    user: process.env.EMAIL_USER, // your full Gmail address
    pass: process.env.EMAIL_PASS, // your 16-character App Password
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Transporter verification failed:", error);
  } else {
    console.log("✅ Transporter is ready to send emails");

    // Optional: send a test email
    transporter.sendMail({
      from: `"Test Mail" <${process.env.EMAIL_USER}>`,
      to: "emolabodunrin@gmail.com", // replace with your email
      subject: "Test OTP Email",
      text: "Hello! This is a test email from Nodemailer using App Password.",
      html: "<b>Hello! This is a test email from Nodemailer using App Password.</b>",
    }, (err, info) => {
      if (err) console.error("❌ Failed to send test email:", err);
      else console.log("✅ Test email sent:", info.response);
    });
  }
});
