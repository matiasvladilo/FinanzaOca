const express = require('express');
const router = express.Router();

router.get('/generate-report', (req, res) => {
  const secret = req.query.secret;

  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: "No autorizado" });
  }

  return res.json({ ok: true, message: "Autorizado correctamente" });
});

module.exports = router;
