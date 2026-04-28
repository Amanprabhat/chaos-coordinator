/**
 * Email Service
 * Uses nodemailer. In development (no SMTP configured) emails are logged to console.
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env for real delivery.
 */
const nodemailer = require('nodemailer');

const isDev = !process.env.SMTP_HOST;

// Lazy-init transporter so we don't crash at startup if nodemailer isn't ready
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (isDev) {
    // Dev: just log — no actual sending
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Send an email.
 * @param {Object} opts
 * @param {string|string[]} opts.to
 * @param {string[]} [opts.cc]
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text]
 */
async function sendEmail({ to, cc = [], subject, html, text }) {
  const from = process.env.SMTP_FROM || '"Chaos Coordinator" <no-reply@chaos-coordinator.app>';

  if (isDev) {
    // Pretty-print to console in development
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧  EMAIL (dev mode — not sent)');
    console.log(`   From:    ${from}`);
    console.log(`   To:      ${Array.isArray(to) ? to.join(', ') : to}`);
    if (cc.length) console.log(`   CC:      ${cc.join(', ')}`);
    console.log(`   Subject: ${subject}`);
    console.log('───────────────────────────────────────────────');
    console.log(text || html.replace(/<[^>]*>/g, ''));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { messageId: 'dev-mode' };
  }

  return getTransporter().sendMail({
    from,
    to: Array.isArray(to) ? to.join(', ') : to,
    cc: cc.length ? cc.join(', ') : undefined,
    subject,
    text: text || html.replace(/<[^>]*>/g, ''),
    html,
  });
}

module.exports = { sendEmail };
