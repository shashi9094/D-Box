const nodemailer = require('nodemailer');

const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const FROM_EMAIL = String(process.env.FROM_EMAIL || process.env.SMTP_FROM || 'no-reply@example.com').trim();
const SMTP_SECURE_SETTING = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
const SMTP_SECURE = SMTP_SECURE_SETTING ? SMTP_SECURE_SETTING === 'true' : SMTP_PORT === 465;
const SMTP_CONNECTION_TIMEOUT_MS = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 30000);
const SMTP_GREETING_TIMEOUT_MS = Number(process.env.SMTP_GREETING_TIMEOUT_MS || 30000);
const SMTP_SOCKET_TIMEOUT_MS = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30000);
const SMTP_SEND_TIMEOUT_MS = Number(process.env.SMTP_SEND_TIMEOUT_MS || 30000);
const SMTP_SEND_MAX_ATTEMPTS = Math.max(1, Number(process.env.SMTP_SEND_MAX_ATTEMPTS || 3));
const SMTP_SEND_RETRY_DELAY_MS = Math.max(0, Number(process.env.SMTP_SEND_RETRY_DELAY_MS || 1000));

console.log('Brevo mailer initializing', {
  host: SMTP_HOST || '(missing)',
  port: SMTP_PORT,
  user: SMTP_USER ? SMTP_USER.replace(/.(?=.{2,}@)/g, '*') : '(missing)',
  from: FROM_EMAIL || '(missing)'
});

const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'smtp-relay.brevo.com',
  port: SMTP_PORT || 587,
  secure: SMTP_SECURE,
  requireTLS: !SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
  greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
  socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
  },
});

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSmtpError(error) {
  const code = String(error?.code || error?.name || '').toUpperCase();
  const responseCode = Number(error?.responseCode || error?.response?.code || 0);

  if (
    code === 'ETIMEDOUT' ||
    code === 'ESOCKET' ||
    code === 'ECONNECTION' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED'
  ) {
    return true;
  }

  return responseCode >= 400 && responseCode < 500;
}

function summarizeSmtpError(error) {
  return {
    message: error?.message || 'Failed to send email',
    code: error?.code || error?.name || null,
    response: error?.response || error?.responseCode || null,
    stack: error?.stack || null,
  };
}

async function sendEmail(to, subject, html, text) {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Invalid recipient' };
  }

  if (!FROM_EMAIL || !FROM_EMAIL.includes('@')) {
    console.error('Missing FROM_EMAIL env variable');
    return { success: false, error: 'Missing FROM_EMAIL configuration' };
  }

  try {
    for (let attempt = 1; attempt <= SMTP_SEND_MAX_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();

      try {
        console.log('Brevo send attempt started', {
          attempt,
          totalAttempts: SMTP_SEND_MAX_ATTEMPTS,
          host: SMTP_HOST || 'smtp-relay.brevo.com',
          port: SMTP_PORT || 587,
          secure: SMTP_SECURE,
          from: FROM_EMAIL,
          to,
          subject,
          timeoutMs: SMTP_SEND_TIMEOUT_MS,
        });

        const info = await withTimeout(
          transporter.sendMail({
            from: FROM_EMAIL,
            to,
            subject,
            text: text || undefined,
            html: html || undefined
          }),
          SMTP_SEND_TIMEOUT_MS,
          `Brevo send timed out after ${SMTP_SEND_TIMEOUT_MS}ms`
        );

        console.log('Brevo sendMail success', {
          to,
          subject,
          messageId: info.messageId,
          attempt,
          durationMs: Date.now() - startedAt,
        });

        return { success: true, messageId: info.messageId };
      } catch (err) {
        const summary = summarizeSmtpError(err);
        const retryable = isRetryableSmtpError(err);

        console.error('Brevo sendMail error', {
          attempt,
          totalAttempts: SMTP_SEND_MAX_ATTEMPTS,
          to,
          subject,
          durationMs: Date.now() - startedAt,
          retryable,
          ...summary,
        });

        if (attempt < SMTP_SEND_MAX_ATTEMPTS && retryable) {
          const delayMs = SMTP_SEND_RETRY_DELAY_MS * attempt;
          if (delayMs > 0) {
            await sleep(delayMs);
          }
          continue;
        }

        return { success: false, error: summary.message, code: summary.code, response: summary.response, stack: summary.stack };
      }
    }

    return { success: false, error: 'Failed to send email', code: 'SMTP_RETRIES_EXHAUSTED' };
  } catch (err) {
    console.error('Brevo sendMail error', err && (err.message || err));
    return { success: false, error: err && (err.message || String(err)) };
  }
}

function buildOtpHtml(otp, purpose) {
  const safePurpose = String(purpose || 'verification');
  return `
    <div style="font-family: Arial, sans-serif; max-width:640px; margin:0 auto; color:#111;">
      <h2 style="color:#1f2937">Your ${safePurpose} code</h2>
      <p style="font-size:18px;">Use the code below. It expires in 10 minutes.</p>
      <div style="font-size:28px; font-weight:700; letter-spacing:4px; margin:18px 0; background:#f3f4f6; padding:12px 20px; display:inline-block; border-radius:8px">${otp}</div>
      <p style="color:#6b7280; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

function buildInviteHtml(inviterName, inviteLink) {
  return `
    <div style="font-family: Arial, sans-serif; max-width:640px; margin:0 auto; color:#111;">
      <h2 style="color:#1f2937">You're invited to D-Box</h2>
      <p>${inviterName || 'Someone'} has invited you to join D-Box. Click the button below to accept the invite.</p>
      <a href="${inviteLink}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#6d28d9;color:#fff;text-decoration:none">Accept Invite</a>
    </div>
  `;
}

module.exports = {
  sendEmail,
  buildOtpHtml,
  buildInviteHtml
};
