const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    whitePlayer: { type: String, required: true },
    blackPlayer: { type: String, required: true },
    winner: { type: String, enum: ['w', 'b', 'draw'], default: 'draw' },
    pgn: { type: String, required: true }, // The exact sequence of moves
    playedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);