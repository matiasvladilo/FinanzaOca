const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

router.get('/generate-report', async (req, res) => {
  const secret = req.query.secret;

  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: "No autorizado" });
  }

  const reportText = `Reporte diario:
Ventas: 1.000.000
Costos: 600.000
Merma: 80.000`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const recipients = process.env.REPORT_RECIPIENTS.split(',').map(e => e.trim());

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM,
    to: recipients,
    subject: 'Reporte diario FinanzaOca',
    text: reportText,
  });

  if (error) {
    console.error('Error enviando email:', error);
    return res.status(500).json({ ok: false, error: 'Error enviando email', detail: error });
  }

  return res.json({ ok: true, message: 'Reporte enviado correctamente' });
});

module.exports = router;
