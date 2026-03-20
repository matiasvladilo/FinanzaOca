const { generateReport } = require('../services/anthropic');
const { sendEmail } = require('../services/resend');

async function handleCronReport(req, res) {
  try {
    // 1. Obtener datos del frontend si BASE_URL está configurada
    let reportData = { tipo: 'cron', fecha: new Date().toISOString() };

    if (process.env.BASE_URL) {
      try {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
          .toISOString().split('T')[0];
        const todayISO = today.toISOString().split('T')[0];

        const dataRes = await fetch(
          `${process.env.BASE_URL}/api/informes/generate?fechaDesde=${firstDay}&fechaHasta=${todayISO}&tipo=completo`
        );
        if (dataRes.ok) {
          const json = await dataRes.json();
          if (json.ok) reportData = json;
        }
      } catch (fetchErr) {
        console.warn('[cron] No se pudo obtener datos del frontend:', fetchErr.message);
      }
    }

    // 2. Generar informe con Claude
    const report = await generateReport(
      reportData,
      'Genera un resumen ejecutivo del informe mensual automático para FinanzasOca.'
    );

    // 3. Enviar por correo a los destinatarios configurados
    const recipients = (process.env.REPORT_RECIPIENTS ?? '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    if (recipients.length > 0) {
      await sendEmail({
        to: recipients,
        subject: `Informe automático FinanzasOca — ${new Date().toLocaleDateString('es-CL')}`,
        text: report,
      });
    }

    res.json({ ok: true, report, emailsSent: recipients.length });
  } catch (err) {
    console.error('[cronController]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { handleCronReport };
