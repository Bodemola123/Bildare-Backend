const nodemailer = require("nodemailer");
const Brevo = require("@getbrevo/brevo");
const { BREVO_USER, BREVO_SMTP_KEY, BREVO_API_KEY, EMAIL_USER } = require("../config/env");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: BREVO_USER,
    pass: BREVO_SMTP_KEY,
  },
});

transporter.verify((err) => {
  if (err) console.log("SMTP error:", err);
  else console.log("SMTP connected!");
});

// Brevo API instance
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  BREVO_API_KEY
);

// OTP email
async function sendOtpEmail(email, otp) {
  const emailData = {
    sender: { name: "Bildare Auth", email: EMAIL_USER },
    to: [{ email }],
    subject: "🔐 Your Bildare Verification Code",
      htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#333;">
        <h2>Welcome to <span style="color:#ff510d;">Bildare</span> 🎉</h2>
        <p>We are excited to have you on board! To complete your sign up, please verify your email using the OTP below:</p>
        <div style="margin:20px 0; padding:15px; background:#f4f4f4; border-radius:8px; text-align:center;">
          <h1 style="color:#182a4e; letter-spacing:5px;">${otp}</h1>
        </div>
        <p>This code will expire in <b>10 minutes</b>. If you did not request this, please ignore this email.</p>
        <p style="margin-top:30px;">Cheers,<br><b>The Bildare Team</b></p>
      </div>
    `,
    };
  await apiInstance.sendTransacEmail(emailData);
}

// Password reset token email
async function sendTokenEmail(email, token) {
  const emailData = {
    sender: { name: "Bildare Auth", email: EMAIL_USER },
    to: [{ email }],
    subject: "Your Password Reset Token",
      htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#333;">
        <h2>Hello User, Here is your Password Reset Token 🎉</h2>

        <div style="margin:20px 0; padding:15px; background:#f4f4f4; border-radius:8px; text-align:center;">
          <h1 style="color:#182a4e; letter-spacing:5px;">${token}</h1>
        </div>
        <p>This code will expire in <b>10 minutes</b>. If you did not request this, please ignore this email.</p>
        <p style="margin-top:30px;">Cheers,<br><b>The Bildare Team</b></p>
      </div>
    `,
    };
  await apiInstance.sendTransacEmail(emailData);
}

// Contact form email
async function sendContactEmail(name, email, subject, message) {
  const emailData = {
    sender: { name: "Bildare Contact", email: EMAIL_USER },
    to: [{ email: EMAIL_USER }],
    subject: `Contact Form: ${subject}`,
      htmlContent:  `
      <div style="margin:0; padding:0; font-family: 'Helvetica', Arial, sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#B9F500; text-align:center; padding:20px;">
              <h1 style="margin:0; font-size:24px; color:#000;">Bildare Contact Form</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px; color:#333;">
              <p style="margin:0 0 10px;"><strong>Name:</strong> ${name}</p>
              <p style="margin:0 0 10px;"><strong>Email:</strong> ${email}</p>
              <p style="margin:0 0 10px;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin:20px 0 5px;"><strong>Message:</strong></p>
              <div style="padding:15px; background:#f9f9f9; border-radius:8px; color:#555; line-height:1.5;">
                ${message.replace(/\n/g, "<br>")}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px; text-align:center; font-size:12px; color:#888;">
              This message was sent from the Bildare website contact form.
            </td>
          </tr>
        </table>
      </div>
      `,
    };
  await apiInstance.sendTransacEmail(emailData);
  
}

module.exports = {
  sendOtpEmail,
  sendTokenEmail,
  sendContactEmail
};
