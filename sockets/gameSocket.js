const { Chess } = require('chess.js');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sanitizeText, scheduleRoomCleanup } = require('../utils/helpers');
const { updatePlayerRatingsAfterGame } = require('../utils/ratings');

/**
 * Attach Socket.IO game engine to the given `io` instance.
 * @param {import('socket.io').Server} io
 * @param {object} sharedState - { activeGames, matchmakingQueue, reservedRooms, connectedUsers }
 */
function initSocket(io, sharedState) {
    const { activeGames, matchmakingQueue, reservedRooms, connectedUsers } = sharedState;

    // ── AUTH MIDDLEWARE ──────────────────────────────────────
    io.use((socket, next) => {
        try {
            const cookieHeader = socket.handshake.headers.cookie || '';
            const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
            if (!tokenMatch) return next(new Error('No auth token'));
            const decoded = jwt.verify(tokenMatch[1], process.env.JWT_SECRET);
            socket.verifiedUsername = decoded.username;
            next();
        } catch (_) {
            next(new Error('Invalid auth token'));
        }
    });

    io.on('connection', (socket) => {
        const username = socket.verifiedUsername;

        // ── ONLINE PRESENCE ──────────────────────────────────
        socket.on('user_online', () => {
            socket.username = username;
            if (!connectedUsers[username]) connectedUsers[username] = new Set();
            connectedUsers[username].add(socket.id);
            console.log(`[Online] ${username} (${socket.id})`);
        });

        // ── MATCHMAKING ──────────────────────────────────────
        socket.on('find_match', (data) => {
            const { timeControl } = data;
            socket.username = username;
            socket.timeControl = timeControl;

            const alreadyInQueue = matchmakingQueue.find(s => s.username === username);
            if (alreadyInQueue) return;

            matchmakingQueue.push(socket);

            const p1Index = matchmakingQueue.findIndex(s => s.timeControl === timeControl);
            const p2Index = matchmakingQueue.findIndex((s, idx) => s.timeControl === timeControl && idx !== p1Index);

            if (p1Index !== -1 && p2Index !== -1) {
                const player1 = matchmakingQueue[p1Index];
                const player2 = matchmakingQueue[p2Index];
                matchmakingQueue.splice(Math.max(p1Index, p2Index), 1);
                matchmakingQueue.splice(Math.min(p1Index, p2Index), 1);

                const roomId = crypto.randomUUID();
                reservedRooms[roomId] = {
                    allowedPlayers: [player1.username, player2.username],
                    timeControl,
                    createdAt: Date.now(),
                };

                player1.emit('match_found', roomId);
                player2.emit('match_found', roomId);
            }
        });

        socket.on('cancel_matchmaking', () => {
            const qIndex = matchmakingQueue.findIndex(s => s.id === socket.id);
            if (qIndex !== -1) matchmakingQueue.splice(qIndex, 1);
        });

        // ── FRIEND CHALLENGE ────────────────────────────────
        socket.on('challenge_friend', async (data) => {
            const { targetUsername, timeControl } = data;
            socket.username = username;

            const targetSockets = connectedUsers[targetUsername];
            const targetSocketId = targetSockets?.size > 0 ? [...targetSockets][0] : null;

            if (targetSocketId) {
                const roomCode = crypto.randomUUID();
                reservedRooms[roomCode] = {
                    allowedPlayers: [username, targetUsername],
                    timeControl,
                    createdAt: Date.now(),
                };
                setTimeout(() => {
                    if (reservedRooms[roomCode]) {
                        delete reservedRooms[roomCode];
                        console.log(`[Cleanup] Expired challenge room ${roomCode}`);
                    }
                }, 60 * 1000);

                io.to(targetSocketId).emit('incoming_challenge', { from: username, timeControl, roomCode });
                socket.emit('challenge_sent', { roomCode });
            } else {
                try {
                    const receiver = await User.findOne({ username: targetUsername });
                    if (receiver) {
                        receiver.notifications.push({
                            message: `${username} tried to challenge you to a ${timeControl}-minute game while you were offline.`,
                            type: 'challenge',
                        });
                        await receiver.save();
                        socket.emit('error', `${targetUsername} is offline. We left them a notification!`);
                    }
                } catch (err) {
                    console.error('Offline Notification Error:', err);
                }
            }
        });

        // ── JOIN GAME ROOM ───────────────────────────────────
        socket.on('join_party', (data) => {
            const { code, timeControl } = data;
            socket.username = username;

            const reservation = reservedRooms[code];

            if (reservation && !reservation.isPrivate) {
                if (!reservation.allowedPlayers.includes(username)) {
                    socket.emit('error', 'You are not authorized to join this room.');
                    socket.disconnect();
                    return;
                }
            }

            socket.roomCode = code;
            socket.join(code);

            if (!activeGames[code]) {
                const resolvedTime = reservation ? reservation.timeControl : (parseInt(timeControl) || 10);
                const totalMs = resolvedTime * 60 * 1000;

                activeGames[code] = {
                    game: new Chess(),
                    historyFens: [new Chess().fen()],
                    players: {
                        w: { name: username, socketId: socket.id, connected: true,  disconnectTimer: null },
                        b: { name: null,     socketId: null,      connected: false, disconnectTimer: null },
                    },
                    timers: { w: totalMs, b: totalMs },
                    originalTimeMs: totalMs,
                    lastMoveTime: null,
                    isStarted: false,
                    gameOver: false,
                };

                socket.color = 'w';
                socket.emit('role_assigned', 'w');
                console.log(`[Game Created] Room ${code} | Host: ${username} | ${resolvedTime}m`);

            } else {
                const session = activeGames[code];

                if (session.players.w.name === username) {
                    socket.color = 'w';
                    session.players.w.socketId = socket.id;
                    session.players.w.connected = true;
                    clearTimeout(session.players.w.disconnectTimer);
                    socket.emit('role_assigned', 'w');

                } else if (session.players.b.name === username) {
                    socket.color = 'b';
                    session.players.b.socketId = socket.id;
                    session.players.b.connected = true;
                    clearTimeout(session.players.b.disconnectTimer);
                    socket.emit('role_assigned', 'b');

                } else if (!session.players.b.name) {
                    socket.color = 'b';
                    session.players.b.name = username;
                    session.players.b.socketId = socket.id;
                    session.players.b.connected = true;
                    session.isStarted = true;
                    session.lastMoveTime = Date.now();
                    socket.emit('role_assigned', 'b');

                    if (reservedRooms[code]) delete reservedRooms[code];
                } else {
                    socket.emit('role_assigned', 'spectator');
                }

                if (session.isStarted) {
                    const elapsed = session.lastMoveTime ? (Date.now() - session.lastMoveTime) : 0;
                    io.to(code).emit('game_sync', {
                        fen:       session.game.fen(),
                        turn:      session.game.turn(),
                        timers:    session.timers,
                        elapsed,
                        whiteName: session.players.w.name,
                        blackName: session.players.b.name,
                        gameOver:  session.gameOver,
                        history:   session.game.history(),
                        fens:      session.historyFens,
                    });
                }
            }
        });

        // ── LEGAL MOVES ──────────────────────────────────────
        socket.on('request_legal_moves', (square) => {
            const session = activeGames[socket.roomCode];
            if (session && !session.gameOver)
                socket.emit('legal_moves_reply', session.game.moves({ square, verbose: true }));
        });

        // ── MOVE EXECUTION ───────────────────────────────────
        socket.on('attempt_move', (moveData) => {
            const session = activeGames[socket.roomCode];
            if (!session || session.gameOver || !session.isStarted) return;
            if (session.game.turn() !== socket.color) return;

            try {
                const result = session.game.move({
                    from:      moveData.from,
                    to:        moveData.to,
                    promotion: moveData.promo || 'q',
                });
                if (!result) return;

                const timeTaken = Date.now() - session.lastMoveTime;
                session.timers[socket.color] -= timeTaken;
                session.lastMoveTime = Date.now();
                session.historyFens.push(session.game.fen());

                if (session.game.isGameOver() || session.timers[socket.color] <= 0) {
                    session.gameOver = true;

                    let reason      = 'checkmate';
                    let winnerColor = session.game.turn() === 'w' ? 'b' : 'w';
                    let winnerName  = session.players[winnerColor].name;

                    if (session.timers[socket.color] <= 0) reason = 'timeout';
                    if (session.game.isStalemate() || session.game.isInsufficientMaterial() || session.game.isDraw()) {
                        reason = 'draw'; winnerColor = 'draw'; winnerName = null;
                    }

                    io.to(socket.roomCode).emit('game_over', { reason, winnerName, winnerColor });
                    updatePlayerRatingsAfterGame(session.players.w.name, session.players.b.name, winnerColor, session.game.pgn());
                    scheduleRoomCleanup(socket.roomCode, activeGames);
                }

                io.to(socket.roomCode).emit('game_sync', {
                    fen:       session.game.fen(),
                    turn:      session.game.turn(),
                    timers:    session.timers,
                    elapsed:   0,
                    whiteName: session.players.w.name,
                    blackName: session.players.b.name,
                    gameOver:  session.gameOver,
                    history:   session.game.history(),
                    fens:      session.historyFens,
                });
            } catch (_) {}
        });

        // ── TIMEOUT ──────────────────────────────────────────
        socket.on('timeout', () => {
            const session = activeGames[socket.roomCode];
            if (!session || session.gameOver || !session.isStarted) return;
            if (session.game.turn() !== socket.color) return;

            session.gameOver = true;
            const winnerColor = socket.color === 'w' ? 'b' : 'w';
            const winnerName  = session.players[winnerColor].name;

            io.to(socket.roomCode).emit('game_over', { reason: 'timeout', winnerName, winnerColor });
            updatePlayerRatingsAfterGame(session.players.w.name, session.players.b.name, winnerColor, session.game.pgn());
            scheduleRoomCleanup(socket.roomCode, activeGames);
        });

        // ── CHAT ────────────────────────────────────────────
        socket.on('send_chat', (message) => {
            if (typeof message !== 'string') return;
            const cleaned = sanitizeText(message.trim()).slice(0, 200);
            if (!cleaned) return;
            io.to(socket.roomCode).emit('receive_chat', {
                sender: sanitizeText(socket.username || 'Unknown'),
                text:   cleaned,
                color:  socket.color,
            });
        });

        // ── RESIGN ──────────────────────────────────────────
        socket.on('resign_game', () => {
            const session = activeGames[socket.roomCode];
            if (!session || !session.isStarted || session.gameOver || !socket.color) return;
            session.gameOver = true;
            const winnerColor = socket.color === 'w' ? 'b' : 'w';
            const winnerName  = session.players[winnerColor].name;
            io.to(socket.roomCode).emit('game_over', { reason: 'resignation', winnerName, winnerColor });
            updatePlayerRatingsAfterGame(session.players.w.name, session.players.b.name, winnerColor, session.game.pgn());
            scheduleRoomCleanup(socket.roomCode, activeGames);
        });

        // ── REMATCH ─────────────────────────────────────────
        socket.on('request_rematch', () => socket.to(socket.roomCode).emit('rematch_requested'));

        socket.on('accept_rematch', () => {
            const session = activeGames[socket.roomCode];
            if (!session) return;
            session.game         = new Chess();
            session.historyFens  = [session.game.fen()];
            session.timers       = { w: session.originalTimeMs, b: session.originalTimeMs };
            session.lastMoveTime = Date.now();
            session.gameOver     = false;

            io.to(socket.roomCode).emit('rematch_accepted');
            io.to(socket.roomCode).emit('game_sync', {
                fen:       session.game.fen(),
                turn:      session.game.turn(),
                timers:    session.timers,
                elapsed:   0,
                whiteName: session.players.w.name,
                blackName: session.players.b.name,
                gameOver:  false,
                history:   session.game.history(),
                fens:      session.historyFens,
            });
        });

        // ── DISCONNECT ──────────────────────────────────────
        socket.on('disconnect', () => {
            if (username && connectedUsers[username]) {
                connectedUsers[username].delete(socket.id);
                if (connectedUsers[username].size === 0) delete connectedUsers[username];
            }

            const session = activeGames[socket.roomCode];
            if (session && !session.gameOver) {
                const player = session.players[socket.color];
                if (player) {
                    player.connected = false;
                    socket.to(socket.roomCode).emit('opponent_disconnected', 60);
                    player.disconnectTimer = setTimeout(() => {
                        if (!player.connected && !session.gameOver) {
                            session.gameOver = true;
                            const winnerColor = socket.color === 'w' ? 'b' : 'w';
                            const winnerName  = session.players[winnerColor].name;
                            io.to(socket.roomCode).emit('game_over', { reason: 'abandonment', winnerName, winnerColor });
                            updatePlayerRatingsAfterGame(session.players.w.name, session.players.b.name, winnerColor, session.game.pgn());
                            scheduleRoomCleanup(socket.roomCode, activeGames);
                        }
                    }, 60000);
                }
            }

            const qIndex = matchmakingQueue.findIndex(s => s.id === socket.id);
            if (qIndex !== -1) matchmakingQueue.splice(qIndex, 1);
        });
    });
}

module.exports = initSocket;