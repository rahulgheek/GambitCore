const User = require('../models/User');
const Game = require('../models/Game');
const { calculateNewRatings } = require('./glicko');

/**
 * Save a completed game to DB and update both players' Glicko ratings.
 * @param {string} whiteUsername
 * @param {string} blackUsername
 * @param {string|null} winnerColor - 'w', 'b', or null for draw
 * @param {string} pgnData
 */
async function updatePlayerRatingsAfterGame(whiteUsername, blackUsername, winnerColor, pgnData) {
    try {
        // 1. Save the game record
        const newGame = new Game({
            whitePlayer: whiteUsername,
            blackPlayer: blackUsername,
            winner: winnerColor === null ? 'draw' : winnerColor,
            pgn: pgnData || '',
        });
        await newGame.save();
        console.log(`[History] Saved match: ${whiteUsername} vs ${blackUsername}`);

        // 2. Update Glicko ratings
        const whitePlayer = await User.findOne({ username: whiteUsername });
        const blackPlayer = await User.findOne({ username: blackUsername });
        if (!whitePlayer || !blackPlayer) return;

        let whiteScore = 0.5;
        if (winnerColor === 'w') whiteScore = 1;
        if (winnerColor === 'b') whiteScore = 0;

        const newStats = calculateNewRatings(
            { rating: whitePlayer.rating, rd: whitePlayer.rd, vol: whitePlayer.vol },
            { rating: blackPlayer.rating, rd: blackPlayer.rd, vol: blackPlayer.vol },
            whiteScore,
        );

        whitePlayer.rating    = Math.round(newStats.updatedP1.rating);
        whitePlayer.rd        = Math.round(newStats.updatedP1.rd);
        whitePlayer.vol       = newStats.updatedP1.vol;
        whitePlayer.gamesPlayed += 1;

        blackPlayer.rating    = Math.round(newStats.updatedP2.rating);
        blackPlayer.rd        = Math.round(newStats.updatedP2.rd);
        blackPlayer.vol       = newStats.updatedP2.vol;
        blackPlayer.gamesPlayed += 1;

        await whitePlayer.save();
        await blackPlayer.save();

        console.log(`[Ratings] White: ${whitePlayer.rating} | Black: ${blackPlayer.rating}`);
    } catch (err) {
        console.error('Error updating Glicko ratings or saving game:', err);
    }
}

module.exports = { updatePlayerRatingsAfterGame };