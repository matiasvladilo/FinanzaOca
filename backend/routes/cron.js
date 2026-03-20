const express = require('express');
const router = express.Router();

router.get('/generate-report', (req, res) => {
  return res.json({ ok: true, message: "endpoint funcionando" });
});

module.exports = router;
