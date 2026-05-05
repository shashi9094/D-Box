const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// ENV variables
const awsAccessKeyId = String(process.env.AWS_ACCESS_KEY_ID || '').trim();
const awsSecretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || '').trim();
const awsRegion = String(process.env.AWS_REGION || '').trim();
const smtpFrom = String(process.env.SMTP_FROM || '').trim();

// SES Client
const sesClient = new SESClient({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey
  }
});

console.log('AWS SES email service initialized', {
  region: awsRegion || '(missing)',
  from: smtpFrom || '(missing)'
});

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
    !awsAccessKeyId ? 'AWS_ACCESS_KEY_ID' : null,
    !awsSecretAccessKey ? 'AWS_SECRET_ACCESS_KEY' : null,
    !awsRegion ? 'AWS_REGION' : null,
    !smtpFrom ? 'SMTP_FROM' : null
  ].filter(Boolean);

  if (missingConfig.length > 0) {
    return {
      success: false,
      error: `Missing env variables: ${missingConfig.join(', ')}`
    };
  }

  try {
    const command = new SendEmailCommand({
      Source: smtpFrom,
      Destination: {
        ToAddresses: [recipient]
      },
      Message: {
        Subject: {
          Data: mailSubject,
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: bodyText,
            Charset: 'UTF-8'
          },
          Html: {
            Data: `<p>${bodyText}</p>`,
            Charset: 'UTF-8'
          }
        }
      }
    });

    const result = await sesClient.send(command);

    console.log("Email sent:", result);

    return {
      success: true,
      messageId: result.MessageId
    };

  } catch (error) {
    console.error("SES Error:", error);

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendEmail
};