const express = require('express');
const router = express.Router();
const { handleGenerateReport } = require('../controllers/reportController');

router.post('/', handleGenerateReport);

module.exports = router;
