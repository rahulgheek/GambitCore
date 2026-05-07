/**
 * Strip all HTML-dangerous characters for safe client display.
 */
function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"'\/]/g, (c) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;',
        '"': '&quot;', "'": '&#39;', '/': '&#x2F;',
    }[c]));
}

/**
 * Schedule game room cleanup from memory after a game ends.
 * @param {string} code - Room code
 * @param {object} activeGames - Shared in-memory game store
 */
function scheduleRoomCleanup(code, activeGames) {
    setTimeout(() => {
        if (activeGames[code]) {
            delete activeGames[code];
            console.log(`[Cleanup] Room ${code} freed from memory.`);
        }
    }, 5 * 60 * 1000);
}

module.exports = { sanitizeText, scheduleRoomCleanup };