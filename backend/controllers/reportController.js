const { generateReport } = require('../services/anthropic');

async function handleGenerateReport(req, res) {
  const { data, prompt } = req.body ?? {};

  if (!data) {
    return res.status(400).json({ ok: false, error: 'Falta el campo "data"' });
  }

  try {
    const report = await generateReport(data, prompt);
    res.json({ ok: true, report });
  } catch (err) {
    console.error('[reportController]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { handleGenerateReport };
