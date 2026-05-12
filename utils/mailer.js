let axios = null;
try {
    axios = require('axios');
} catch (err) {
    axios = null;
}

const BREVO_API_KEY = String(process.env.BREVO_API_KEY || '').trim();
const BREVO_API_BASE_URL = String(process.env.BREVO_API_BASE_URL || 'https://api.brevo.com/v3').trim();
const senderEmail = String(
    process.env.BREVO_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@mydbox.local'
).trim();
const senderName = String(process.env.BREVO_FROM_NAME || process.env.SMTP_FROM_NAME || 'D-Box').trim();
const requestTimeoutMs = Number(process.env.BREVO_REQUEST_TIMEOUT_MS || 30000);
const maxAttempts = Math.max(1, Number(process.env.BREVO_MAX_ATTEMPTS || 3));
const retryDelayMs = Math.max(0, Number(process.env.BREVO_RETRY_DELAY_MS || 1000));
const minSendIntervalMs = Math.max(0, Number(process.env.BREVO_MIN_SEND_INTERVAL_MS || 1200));

const isEmail = (v) => /.+@.+\..+/.test(String(v || '').trim());

const summarizeError = (err) => ({
    message: err?.message || 'Failed to send OTP email',
    code: err?.code || err?.name || null,
    status: err?.response?.status || err?.response?.statusCode || null,
    response: err?.response?.data || err?.response || null,
    stack: err?.stack || null,
});

console.log('Brevo mailer initialized', {
    apiBaseUrl: BREVO_API_BASE_URL,
    hasApiKey: Boolean(BREVO_API_KEY),
    senderEmail,
    senderName,
    senderEmailValid: isEmail(senderEmail),
    usingAxios: Boolean(axios),
});

let lastSendStartedAt = 0;
let sendQueue = Promise.resolve();

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueue(task) {
    const next = sendQueue.then(task, task);
    sendQueue = next.catch(() => {});
    return next;
}

async function respectRateLimit() {
    const elapsed = Date.now() - lastSendStartedAt;
    const waitMs = Math.max(0, minSendIntervalMs - elapsed);
    if (waitMs > 0) {
        console.log('Brevo rate limit delay applied', { waitMs, minSendIntervalMs });
        await sleep(waitMs);
    }
    lastSendStartedAt = Date.now();
}

function isRetryableBrevoError(err) {
    const status = Number(err?.response?.status || err?.response?.statusCode || 0);
    const code = String(err?.code || err?.name || '').toUpperCase();
    if (status === 429 || (status >= 500 && status <= 599)) return true;
    return [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'EAI_AGAIN',
        'ESOCKET',
        'ECONNABORTED',
        'ERR_NETWORK',
    ].includes(code);
}

function buildOtpText(otp) {
    return `Your D-Box verification OTP is: ${otp}\n\nThis code is valid for 5 minutes.\n\nIf you did not request this OTP, please ignore this email.`;
}

function buildOtpHtml(otp) {
    return `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;line-height:1.6">
            <h2 style="margin:0 0 16px 0;color:#111827">Your verification code</h2>
            <p style="margin:0 0 16px 0;font-size:16px">Use the code below. It expires in 5 minutes.</p>
            <div style="font-size:28px;font-weight:700;letter-spacing:4px;margin:18px 0;background:#f3f4f6;padding:12px 20px;display:inline-block;border-radius:8px">${otp}</div>
            <p style="margin:16px 0 0 0;color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        </div>
    `;
}

async function postJson(url, data, headers, timeoutMs) {
    if (axios) {
        // axios returns {status,data,headers}
        try {
            const res = await axios.post(url, data, { headers, timeout: timeoutMs, validateStatus: () => true });
            return { status: res.status, data: res.data, headers: res.headers };
        } catch (err) {
            // axios throws on network errors; normalize
            return { status: err?.response?.status || 0, data: err?.response?.data || null, error: err };
        }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
            signal: controller.signal,
        });
        const text = await res.text();
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (e) { parsed = text; }
        return { status: res.status, data: parsed, headers: Object.fromEntries(res.headers.entries()) };
    } finally {
        clearTimeout(timeoutId);
    }
}

async function sendBrevoEmail(payload) {
    const url = `${BREVO_API_BASE_URL.replace(/\/$/, '')}/smtp/email`;
    const headers = {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
    };

    console.log('Brevo API request prepared', {
        url,
        to: payload?.to?.[0]?.email || null,
        subject: payload?.subject || null,
        senderEmail: payload?.sender?.email || null,
        timeoutMs: requestTimeoutMs,
    });

    return postJson(url, payload, headers, requestTimeoutMs);
}

async function sendOTPEmail(email, otp) {
    const recipient = String(email || '').trim().toLowerCase();
    const safeOtp = String(otp || '').trim();

    if (!recipient) return { success: false, error: 'Recipient email is required' };
    if (!isEmail(recipient)) return { success: false, error: 'Invalid recipient email' };
    if (!/^[0-9]{6}$/.test(safeOtp)) return { success: false, error: 'Invalid OTP format' };
    if (!BREVO_API_KEY) return { success: false, error: 'BREVO_API_KEY is missing' };
    if (!isEmail(senderEmail)) return { success: false, error: 'Invalid sender email configuration' };

    const subject = 'Your OTP Code';
    const text = buildOtpText(safeOtp);
    const html = buildOtpHtml(safeOtp);

    return enqueue(async () => {
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const startedAt = Date.now();
            try {
                await respectRateLimit();
                console.log('Brevo OTP send attempt started', { attempt, totalAttempts: maxAttempts, recipient, senderEmail, minSendIntervalMs, timeoutMs: requestTimeoutMs });

                const response = await sendBrevoEmail({ sender: { name: senderName, email: senderEmail }, to: [{ email: recipient }], subject, textContent: text, htmlContent: html });
                const status = Number(response?.status || 0);
                const data = response?.data || {};

                if (status >= 200 && status < 300) {
                    console.log('Brevo OTP send succeeded', { attempt, totalAttempts: maxAttempts, recipient, durationMs: Date.now() - startedAt, messageId: data?.messageId || null });
                    return { success: true, messageId: data?.messageId || null };
                }

                const err = new Error(data?.message || `Brevo API returned status ${status}`);
                err.response = { status, data };
                err.code = data?.code || null;
                throw err;
            } catch (err) {
                const summary = summarizeError(err);
                const retryable = isRetryableBrevoError(err);
                console.error('Brevo OTP send failed', { attempt, totalAttempts: maxAttempts, recipient, durationMs: Date.now() - startedAt, retryable, ...summary });
                if (attempt < maxAttempts && retryable) {
                    const delayMs = retryDelayMs * attempt;
                    if (delayMs > 0) { console.warn('Brevo OTP retry scheduled', { attempt, nextAttempt: attempt + 1, delayMs, recipient }); await sleep(delayMs); }
                    continue;
                }
                return { success: false, error: summary.message, code: summary.code, response: summary.status || summary.response, stack: summary.stack };
            }
        }
        return { success: false, error: 'Failed to send OTP email', code: 'BREVO_RETRIES_EXHAUSTED', response: null, stack: null };
    });
}

async function sendOTP(email, otp) {
    return sendOTPEmail(email, otp);
}

module.exports = { sendOTPEmail, sendOTP };