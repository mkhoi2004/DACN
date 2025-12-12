// mailer.js
const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;
// có thể đặt email nhận cảnh báo riêng, nếu không có thì dùng luôn GMAIL_USER
const ALERT_RECEIVER_EMAIL = process.env.ALERT_RECEIVER_EMAIL || GMAIL_USER;

if (!GMAIL_USER || !GMAIL_PASS) {
  console.warn(
    '⚠️ GMAIL_USER hoặc GMAIL_PASS chưa được cấu hình trong .env – gửi email sẽ bị lỗi.'
  );
}

/**
 * Gửi email cảnh báo.
 * index.js đang gọi: sendAlertEmail(alertType, message)
 */
async function sendAlertEmail(alertType, message) {
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.error('Không có GMAIL_USER/GMAIL_PASS, bỏ qua gửi email cảnh báo.');
    return null;
  }

  // Tạo transporter dùng Gmail + App Password
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Smart Parking" <${GMAIL_USER}>`,
    to: ALERT_RECEIVER_EMAIL,
    subject: `[Smart Parking] Cảnh báo: ${alertType}`,
    text: message,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Alert email sent:', info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      to: ALERT_RECEIVER_EMAIL,
      subject: mailOptions.subject,
      body: mailOptions.text,
      error: null,
    };
  } catch (err) {
    console.error('❌ sendAlertEmail error:', err.message);
    return {
      success: false,
      messageId: null,
      to: ALERT_RECEIVER_EMAIL,
      subject: mailOptions.subject,
      body: mailOptions.text,
      error: err.message,
    };
  }
}

module.exports = { sendAlertEmail };
