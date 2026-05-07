const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Game = require('../models/Game');

// Shared in-memory state is passed in via init()
let reservedRooms = {};

function init(rooms) {
    reservedRooms = rooms;
}

async function getHistory(req, res) {
    try {
        const games = await Game.find({
            $or: [{ whitePlayer: req.user.username }, { blackPlayer: req.user.username }],
        })
            .sort({ playedAt: -1 })
            .limit(15);
        res.json({ status: 'success', games });
    } catch (err) {
        console.error('History fetch error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to load history' });
    }
}

async function getAnalysis(req, res) {
    try {
        const game = await Game.findById(req.params.gameId);
        if (!game) return res.status(404).send('Game not found.');
        res.render('analyze', { username: req.user.username, gameData: game });
    } catch (_) {
        res.status(500).send('Error loading analysis board.');
    }
}

function createRoom(req, res) {
    const mins = parseInt(req.body.timeControl) || 10;
    const code = crypto.randomUUID();

    reservedRooms[code] = {
        allowedPlayers: [req.user.username],
        isPrivate: true,
        timeControl: mins,
        createdAt: Date.now(),
    };

    setTimeout(() => {
        if (reservedRooms[code]) {
            delete reservedRooms[code];
            console.log(`[Cleanup] Expired private room ${code}`);
        }
    }, 10 * 60 * 1000);

    res.json({ status: 'success', code });
}

module.exports = { init, getHistory, getAnalysis, createRoom };