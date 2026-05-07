const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const { getHistory, getAnalysis, createRoom } = require('../controllers/gameController');

// Page views
router.get('/matchmaking', requireAuth, (req, res) =>
    res.render('landing', { username: req.user.username }),
);
router.get('/play/:partyCode', requireAuth, (req, res) =>
    res.render('board', { username: req.user.username, partyCode: req.params.partyCode }),
);

// API
router.post('/api/rooms/create',  requireAuth, createRoom);
router.get('/api/games/history',  requireAuth, getHistory);
router.get('/analyze/:gameId',    requireAuth, getAnalysis);

module.exports = router;