const express = require('express');
const router = express.Router();
const { handleSendEmail } = require('../controllers/emailController');

router.post('/', handleSendEmail);

module.exports = router;
