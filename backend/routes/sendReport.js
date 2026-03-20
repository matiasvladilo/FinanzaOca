const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/resend');

router.post('/', async (req, res) => {
  try {
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({ ok: false, error: 'Falta HTML' });
    }

    const recipients = (process.env.REPORT_RECIPIENTS ?? '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      return res.status(500).json({ ok: false, error: 'No hay destinatarios configurados (REPORT_RECIPIENTS)' });
    }

    await sendEmail({
      to: recipients,
      subject: '📊 Informe de Gestión',
      html,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('[send-report]', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
