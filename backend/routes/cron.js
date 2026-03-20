const express = require('express');
const router = express.Router();
const { requireCronSecret } = require('../utils/auth');
const { handleCronReport } = require('../controllers/cronController');

router.get('/generate-report', requireCronSecret, handleCronReport);

module.exports = router;
