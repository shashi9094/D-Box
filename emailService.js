const nodemailer = require('nodemailer');
const { SESClient } = require('@aws-sdk/client-ses');

// ENV variables
const awsAccessKeyId = String(process.env.AWS_ACCESS_KEY_ID || '').trim();
const awsSecretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || '').trim();
const awsRegion = String(process.env.AWS_REGION || '').trim();
const smtpHost = String(process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim();
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || '').trim();
const smtpFrom = String(process.env.SMTP_FROM || smtpUser || '').trim();
const smtpSecureSetting = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
const smtpSecure = smtpSecureSetting ? smtpSecureSetting === 'true' : smtpPort === 465;
const smtpConnectionTimeout = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 30000);
const smtpGreetingTimeout = Number(process.env.SMTP_GREETING_TIMEOUT_MS || 30000);
const smtpSocketTimeout = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30000);
const smtpSendTimeoutMs = Number(process.env.SMTP_SEND_TIMEOUT_MS || 30000);
const smtpMaxAttempts = Math.max(1, Number(process.env.SMTP_SEND_MAX_ATTEMPTS || 3));
const smtpRetryDelayMs = Math.max(0, Number(process.env.SMTP_SEND_RETRY_DELAY_MS || 1000));

const summarizeSesError = (error) => ({
  message: error?.message || 'SES send failed',
  code: error?.name || error?.code || null,
  requestId: error?.$metadata?.requestId || null,
  httpStatusCode: error?.$metadata?.httpStatusCode || null,
  stack: error?.stack || null,
});

const awsSesEnabled = process.env.ENABLE_AWS_SES === 'true';
let sesClient = null;

if (awsSesEnabled) {
  sesClient = new SESClient({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey
    }
  });

  console.log('AWS SES support configured (inactive sender)', {
    region: awsRegion || '(missing)',
    from: smtpFrom || '(missing)',
    hasAccessKey: Boolean(awsAccessKeyId),
    hasSecretKey: Boolean(awsSecretAccessKey),
  });
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  requireTLS: !smtpSecure,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
  connectionTimeout: smtpConnectionTimeout,
  greetingTimeout: smtpGreetingTimeout,
  socketTimeout: smtpSocketTimeout,
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
  },
});

console.log('Brevo SMTP email service initialized', {
  host: smtpHost,
  port: smtpPort,
  hasUser: Boolean(smtpUser),
  hasPass: Boolean(smtpPass),
  from: smtpFrom || '(missing)',
});

transporter.verify()
  .then(() => {
    console.log('Brevo SMTP transporter verified successfully');
  })
  .catch((error) => {
    console.error('Brevo SMTP transporter verify failed:', summarizeSesError(error));
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

function summarizeSendError(error, attempt, totalAttempts, recipient, subject, startedAt) {
  return {
    attempt,
    totalAttempts,
    recipient,
    subject,
    durationMs: Date.now() - startedAt,
    retryable: isRetryableSmtpError(error),
    message: error?.message || 'Failed to send email',
    code: error?.code || error?.name || null,
    response: error?.response || error?.responseCode || null,
    stack: error?.stack || null,
  };
}

function extractFirstUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s<>"')]+/i);
  return match ? match[0] : '';
}

function buildHtmlBody(subject, text) {
  const safeSubject = String(subject || '').trim();
  const safeText = String(text || '').trim();
  const verifyUrl = extractFirstUrl(safeText);

  const escapedText = safeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  if (!verifyUrl) {
    return `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;line-height:1.6">
        <h2 style="margin:0 0 16px 0">${safeSubject}</h2>
        <div>${escapedText}</div>
      </div>
    `;
  }

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;color:#111827;line-height:1.6">
      <h2 style="margin:0 0 16px 0">${safeSubject}</h2>
      <div style="margin:0 0 24px 0">${escapedText}</div>
      <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Verify Account</a>
      <div style="margin-top:20px;font-size:12px;color:#6b7280;word-break:break-all">
        If the button does not work, copy and paste this link:<br/>
        <a href="${verifyUrl}" style="color:#2563eb">${verifyUrl}</a>
      </div>
    </div>
  `;
}

// MAIN FUNCTION
async function sendEmail(to, subject, text) {
  const recipient = String(to || '').trim();
  const mailSubject = String(subject || '').trim();
  const bodyText = String(text || '').trim();

  // Debug logs
  console.log("FROM:", smtpFrom);
  console.log("TO:", recipient);

  // Validation
  if (!recipient) {
    return { success: false, error: 'Recipient email is required' };
  }

  if (!recipient.includes('@')) {
    return { success: false, error: 'Invalid recipient email' };
  }

  if (!smtpFrom || !smtpFrom.includes('@')) {
    return { success: false, error: 'Invalid SMTP_FROM email' };
  }

  if (!mailSubject) {
    return { success: false, error: 'Email subject is required' };
  }

  if (!bodyText) {
    return { success: false, error: 'Email text is required' };
  }

  // Check ENV config
  const missingConfig = [
    !smtpHost ? 'SMTP_HOST' : null,
    !smtpPort ? 'SMTP_PORT' : null,
    !smtpUser ? 'SMTP_USER' : null,
    !smtpPass ? 'SMTP_PASS' : null,
    !smtpFrom ? 'SMTP_FROM' : null
  ].filter(Boolean);

  if (missingConfig.length > 0) {
    return {
      success: false,
      error: `Missing env variables: ${missingConfig.join(', ')}`
    };
  }

  const totalAttempts = Math.max(1, smtpMaxAttempts);

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const startedAt = Date.now();

    try {
      console.log('SMTP send attempt started', {
        attempt,
        totalAttempts,
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        from: smtpFrom,
        to: recipient,
        subject: mailSubject,
        timeoutMs: smtpSendTimeoutMs,
      });

      const result = await withTimeout(
        transporter.sendMail({
          from: smtpFrom,
          to: recipient,
          subject: mailSubject,
          text: bodyText,
          html: buildHtmlBody(mailSubject, bodyText),
        }),
        smtpSendTimeoutMs,
        `SMTP send timed out after ${smtpSendTimeoutMs}ms`
      );

      console.log('SMTP send attempt succeeded', {
        attempt,
        totalAttempts,
        durationMs: Date.now() - startedAt,
        recipient,
        subject: mailSubject,
        messageId: result?.messageId || null,
      });

      return {
        success: true,
        messageId: result.messageId || null,
      };
    } catch (error) {
      const summary = summarizeSendError(error, attempt, totalAttempts, recipient, mailSubject, startedAt);
      console.error('SMTP send attempt failed', summary);

      const canRetry = attempt < totalAttempts && summary.retryable;
      if (canRetry) {
        const delayMs = smtpRetryDelayMs * attempt;
        if (delayMs > 0) {
          console.warn('SMTP send retry scheduled', {
            attempt,
            nextAttempt: attempt + 1,
            delayMs,
            recipient,
            subject: mailSubject,
          });
          await sleep(delayMs);
        }
        continue;
      }

      return {
        success: false,
        message: summary.message,
        error: summary.message,
        code: summary.code,
        response: summary.response,
        stack: summary.stack,
      };
    }
  }

  return {
    success: false,
    message: 'Failed to send email',
    error: 'Failed to send email',
    code: 'SMTP_RETRIES_EXHAUSTED',
    response: null,
    stack: null,
  };
}

module.exports = {
  sendEmail
};