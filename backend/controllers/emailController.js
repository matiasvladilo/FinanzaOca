const { sendEmail } = require('../services/resend');

async function handleSendEmail(req, res) {
  const { to, subject, content, html } = req.body ?? {};

  if (!to || !subject || (!content && !html)) {
    return res.status(400).json({ ok: false, error: 'Faltan campos: to, subject, content' });
  }

  try {
    const id = await sendEmail({ to, subject, text: content, html });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('[emailController]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { handleSendEmail };
