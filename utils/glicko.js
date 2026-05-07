const glicko2 = require('glicko2');

// Standard Glicko-2 Settings
const settings = {
    tau: 0.5,
    rating: 1500,
    rd: 350,
    vol: 0.06
};

function calculateNewRatings(p1, p2, score) {
    const ranking = new glicko2.Glicko2(settings);

    // Initialize players with their exact DB stats
    const player1 = ranking.makePlayer(p1.rating, p1.rd, p1.vol);
    const player2 = ranking.makePlayer(p2.rating, p2.rd, p2.vol);

    // Run the match
    const matches = [];
    matches.push([player1, player2, score]);
    ranking.updateRatings(matches);

    // Return the pure mathematical results
    return {
        updatedP1: {
            rating: player1.getRating(),
            rd: player1.getRd(),
            vol: player1.getVol()
        },
        updatedP2: {
            rating: player2.getRating(),
            rd: player2.getRd(),
            vol: player2.getVol()
        }
    };
}

module.exports = { calculateNewRatings };