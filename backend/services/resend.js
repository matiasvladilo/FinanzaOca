const { Resend } = require('resend');

const client = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, text, html }) {
  const result = await client.emails.send({
    from: process.env.RESEND_FROM ?? 'informes@finanzasoca.cl',
    to,
    subject,
    ...(html ? { html } : { text }),
  });
  return result.data?.id;
}

module.exports = { sendEmail };
