const express = require('express');
const router = express.Router();
const rateLimit = require('../middleware/rateLimit');
const { register, login, logout } = require('../controllers/authController');
const path = require('path');

router.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../views', 'login.html')));
router.get('/logout', logout);

router.post('/api/auth/register', rateLimit, register);
router.post('/api/auth/login',    rateLimit, login);

module.exports = router;