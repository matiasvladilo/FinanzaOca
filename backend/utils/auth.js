function requireCronSecret(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  next();
}

module.exports = { requireCronSecret };
