const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const awsAccessKeyId = String(process.env.AWS_ACCESS_KEY_ID || '').trim();
const awsSecretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || '').trim();
const awsRegion = String(process.env.AWS_REGION || '').trim();
const smtpFrom = String(process.env.SMTP_FROM || '').trim();

const sesClient = new SESClient({
  region: awsRegion || undefined,
  credentials: awsAccessKeyId && awsSecretAccessKey ? {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey
  } : undefined
});

console.log('AWS SES email service initialized', {
  region: awsRegion || '(missing)',
  from: smtpFrom || '(missing)'
});

async function sendEmail(to, subject, text) {
  const recipient = String(to || '').trim();
  const mailSubject = String(subject || '').trim();
  const bodyText = String(text || '').trim();

  if (!recipient) {
    console.error('sendEmail failed: missing recipient');
    return { success: false, error: 'Recipient email is required' };
  }

  if (!mailSubject) {
    console.error(`sendEmail failed for ${recipient}: missing subject`);
    return { success: false, error: 'Email subject is required' };
  }

  if (!bodyText) {
    console.error(`sendEmail failed for ${recipient}: missing text`);
    return { success: false, error: 'Email text is required' };
  }

  const missingConfig = [
    !awsAccessKeyId ? 'AWS_ACCESS_KEY_ID' : null,
    !awsSecretAccessKey ? 'AWS_SECRET_ACCESS_KEY' : null,
    !awsRegion ? 'AWS_REGION' : null,
    !smtpFrom ? 'SMTP_FROM' : null
  ].filter(Boolean);

  if (missingConfig.length > 0) {
    const message = `Missing required AWS SES environment variables: ${missingConfig.join(', ')}`;
    console.error(`sendEmail failed for ${recipient}: ${message}`);
    return { success: false, error: message };
  }

  try {
    console.log(`Sending SES email to ${recipient} from ${smtpFrom}`);

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

    console.log(`Email sent successfully to ${recipient}`, {
      messageId: result.MessageId,
      requestId: result.$metadata && result.$metadata.requestId
    });

    return {
      success: true,
      messageId: result.MessageId
    };
  } catch (error) {
    const detail = [error.name, error.Code, error.message].filter(Boolean).join(' | ');
    console.error(`sendEmail failed for ${recipient}:`, detail || error.toString());
    return {
      success: false,
      error: detail || 'Unknown SES send error'
    };
  }
}

module.exports = {
  sendEmail
};
