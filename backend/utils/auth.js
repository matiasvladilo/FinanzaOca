function requireCronSecret(req, res, next) {
  const token = req.query.secret;
  console.log("QUERY SECRET:", req.query.secret);
  console.log("ENV SECRET:", process.env.CRON_SECRET);
  if (!token || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  next();
}

module.exports = { requireCronSecret };
