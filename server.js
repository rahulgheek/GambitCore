require('dotenv').config();

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Chess } = require('chess.js');

const User = require('./models/User');
const requireAuth = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const crypto = require('crypto');

// ==========================================
// THE AUTHORITATIVE SERVER MEMORY
// ==========================================
const activeGames = {}; 
const matchmakingQueue = []; // Array of socket objects waiting for a game

const reservedRooms = {};

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Successfully connected to MongoDB Database: GambitCore'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- MIDDLEWARE ---
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// EVALUATION II: REST API & ROUTING
// ==========================================

// 1. PUBLIC FRONT PAGE (Smart Auth Check)
app.get('/', (req, res) => {
    let username = null;
    const token = req.cookies.token;
    
    // Quietly check if they are logged in without blocking them if they aren't
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            username = decoded.username;
        } catch (err) {
            // Token is invalid/expired, just remain a guest
        }
    }
    
    // Pass the username to the homepage (will be null if not logged in)
    res.render('index', { username }); 
});

// 2. MATCHMAKING HUB (Requires Auth)
app.get('/matchmaking', requireAuth, (req, res) => {
    // We are still rendering 'landing.ejs', just on a new URL!
    res.render('landing', { username: req.user.username });
});


app.get('/play/:partyCode', requireAuth, (req, res) => {
    res.render('board', { 
        username: req.user.username,
        partyCode: req.params.partyCode 
    });
});

// --- UPDATE USERNAME ROUTE ---
app.post('/api/user/update-name', requireAuth, async (req, res) => {
    const { newUsername } = req.body;
    const userId = req.user.id; // From your auth middleware

    if (!newUsername || newUsername.length < 3) {
        return res.json({ status: 'error', message: 'Name must be at least 3 characters.' });
    }

    try {
        // 1. Update the name in MongoDB
        const user = await User.findByIdAndUpdate(userId, { username: newUsername }, { new: true });

        // 2. Generate a NEW token with the updated username
        const token = jwt.sign(
            { id: user._id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 3. Overwrite the old cookie
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        
        res.json({ status: 'success', message: 'Name updated successfully!' });
    } catch (err) {
        res.json({ status: 'error', message: 'Username might already be taken.' });
    }
});

app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        // Fetch Top 5 players sorted by rating in descending order
        const topPlayers = await User.find().sort({ rating: -1 }).limit(5);
        
        res.render('dashboard', { 
            username: user.username,
            rating: user.rating,
            gamesPlayed: user.gamesPlayed,
            topPlayers: topPlayers // Pass the array to EJS
        });
    } catch (error) {
        res.status(500).send("Error loading dashboard");
    }
});

// Authentication Routes...
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ status: 'error', message: 'Required fields missing.' });
        
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) return res.status(409).json({ status: 'error', message: 'User exists.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        const savedUser = await newUser.save();

        res.status(201).json({ status: 'success', data: { id: savedUser._id, username: savedUser.username }});
    } catch (error) { res.status(500).json({ status: 'error' }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ status: 'error', message: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 86400000 });
        res.json({ status: 'success', data: { username: user.username }});
    } catch (error) { res.status(500).json({ status: 'error' }); }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/logout', (req, res) => {
    // Destroy the JWT cookie to end the session
    res.clearCookie('token');
    // Send them back to the stunning new landing page
    res.redirect('/');
});

// ==========================================
// EVALUATION II: AUTHORITATIVE GAME ENGINE
// ==========================================

// Helper Function: Update Database Elo
async function updateElo(winnerName, loserName, isDraw = false) {
    try {
        if (isDraw || winnerName === loserName) return;

        // Add 25 to the winner
        await User.findOneAndUpdate({ username: winnerName }, { $inc: { rating: 25, gamesPlayed: 1 } });
        
        // Fetch the loser, calculate their new rating, and prevent it from dropping below 0
        const loser = await User.findOne({ username: loserName });
        if (loser) {
            loser.rating = Math.max(0, loser.rating - 25); // Math.max keeps it at 0 or above
            loser.gamesPlayed += 1;
            await loser.save();
        }
        
        console.log(`🏆 DB UPDATED: ${winnerName} won. ${loserName} rating dropped to ${loser ? loser.rating : 0}`);
    } catch (err) { console.error("Elo Update Error:", err); }
}

io.on('connection', (socket) => {

    // --- 1. THE MATCHMAKING QUEUE ---
    // --- 1. SECURE MATCHMAKING QUEUE ---
    socket.on('find_match', (data) => {
        // Data now contains the time limit they chose!
        const { username, timeControl } = data; 

        const alreadyInQueue = matchmakingQueue.find(s => s.username === username);
        if (alreadyInQueue) return;

        socket.username = username;
        socket.timeControl = timeControl; // Save their time preference to their socket
        matchmakingQueue.push(socket);
        console.log(`[Queue] ${username} joined searching for ${timeControl} min game.`);

        // 🚨 NEW LOGIC: Only match them with someone looking for the EXACT same time control!
        const p1Index = matchmakingQueue.findIndex(s => s.timeControl === timeControl);
        const p2Index = matchmakingQueue.findIndex((s, idx) => s.timeControl === timeControl && idx !== p1Index);

        if (p1Index !== -1 && p2Index !== -1) {
            // We found a perfect match!
            const player1 = matchmakingQueue[p1Index];
            const player2 = matchmakingQueue[p2Index];
            
            // Remove them from the queue safely
            matchmakingQueue.splice(Math.max(p1Index, p2Index), 1);
            matchmakingQueue.splice(Math.min(p1Index, p2Index), 1);

            const secureRoomId = crypto.randomUUID();
            
            reservedRooms[secureRoomId] = {
                allowedPlayers: [player1.username, player2.username],
                timeControl: timeControl, // Lock in the agreed time!
                createdAt: Date.now()
            };

            player1.emit('match_found', secureRoomId);
            player2.emit('match_found', secureRoomId);
        }
    });

    socket.on('cancel_matchmaking', () => {
        // Find this specific socket in the queue array
        const qIndex = matchmakingQueue.findIndex(s => s.id === socket.id);
        
        // If they are in the queue, remove them!
        if (qIndex !== -1) {
            matchmakingQueue.splice(qIndex, 1);
            console.log(`[Queue Cancelled] ${socket.username} left the queue. Total waiting: ${matchmakingQueue.length}`);
        }
    });

    // --- 2. JOINING A SECURE ROOM ---
    socket.on('join_party', (data) => {
        // We now extract the 'timeControl' passed from the frontend!
        const { code, username, timeControl } = data; 
        
        if (reservedRooms[code]) {
            const isVip = reservedRooms[code].allowedPlayers.includes(username);
            if (!isVip) {
                socket.emit('error', 'You are not authorized to join this matchmaking room.');
                socket.disconnect();
                return;
            }
        }

        socket.username = username;
        socket.roomCode = code; 
        socket.join(code);
        
        if (!activeGames[code]) {
            // 🚨 NEW: Calculate milliseconds based on whatever the host requested!
            // Default to 10 minutes (600,000 ms) if something goes wrong.
            const totalMs = (timeControl || 10) * 60 * 1000;

            activeGames[code] = {
                game: new Chess(),
                historyFens: [new Chess().fen()], 
                players: {
                    w: { name: username, socketId: socket.id, connected: true, disconnectTimer: null },
                    b: { name: null, socketId: null, connected: false, disconnectTimer: null }
                },
                timers: { w: totalMs, b: totalMs }, // Set dynamic clocks!
                lastMoveTime: null,
                isStarted: false,
                gameOver: false
            };
            
            if (reservedRooms[code]) delete reservedRooms[code];

            socket.color = 'w';
            socket.emit('role_assigned', 'w');
            console.log(`[Game Created] Room ${code} - Host: ${username} - Time: ${timeControl}m`);
            
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
            } else {
                socket.emit('role_assigned', 'spectator');
            }

            if (session.isStarted) {
                const elapsed = session.lastMoveTime ? (Date.now() - session.lastMoveTime) : 0;
                io.to(code).emit('game_sync', {
                    fen: session.game.fen(),
                    turn: session.game.turn(),
                    timers: session.timers,
                    elapsed: elapsed,
                    whiteName: session.players.w.name,
                    blackName: session.players.b.name,
                    gameOver: session.gameOver,
                    // 🚨 NEW: Send the history arrays!
                    history: session.game.history(),
                    fens: session.historyFens 
                });
            }
        }
    });

    // --- 3. ASK SERVER FOR LEGAL MOVES ---
    socket.on('request_legal_moves', (square) => {
        const session = activeGames[socket.roomCode];
        if (session && !session.gameOver) {
            const moves = session.game.moves({ square: square, verbose: true });
            socket.emit('legal_moves_reply', moves);
        }
    });

    // --- 4. AUTHORITATIVE MOVE EXECUTION ---
    socket.on('attempt_move', (moveData) => {
        const session = activeGames[socket.roomCode];
        if (!session || session.gameOver || !session.isStarted) return;
        if (session.game.turn() !== socket.color) return; 

        try {
            const result = session.game.move({
                from: moveData.from,
                to: moveData.to,
                promotion: moveData.promo || 'q'
            });

            if (result) {
                const timeTaken = Date.now() - session.lastMoveTime;
                session.timers[socket.color] -= timeTaken;
                session.lastMoveTime = Date.now(); 

                // 🚨 NEW: Save the new board state to the memory album
                session.historyFens.push(session.game.fen());

                if (session.game.isGameOver() || session.timers[socket.color] <= 0) {
                    session.gameOver = true;
                    let reason = "checkmate";
                    let winner = session.game.turn() === 'w' ? session.players.b.name : session.players.w.name;
                    let loser = session.game.turn() === 'w' ? session.players.w.name : session.players.b.name;

                    if (session.timers[socket.color] <= 0) reason = "timeout";
                    if (session.game.isDraw()) { reason = "draw"; winner = null; }

                    io.to(socket.roomCode).emit('game_over', { reason, winnerName: winner });
                    if (winner) updateElo(winner, loser, false);
                }

                io.to(socket.roomCode).emit('game_sync', {
                    fen: session.game.fen(),
                    turn: session.game.turn(),
                    timers: session.timers,
                    elapsed: 0,
                    whiteName: session.players.w.name,
                    blackName: session.players.b.name,
                    gameOver: session.gameOver,
                    // 🚨 NEW: Send updated history!
                    history: session.game.history(),
                    fens: session.historyFens 
                });
            }
        } catch (err) {}
    });

    // --- 8. IN-GAME CHAT ---
    socket.on('send_chat', (message) => {
        // Broadcast the message to everyone in the room, including the sender
        io.to(socket.roomCode).emit('receive_chat', {
            sender: socket.username,
            text: message,
            color: socket.color // 'w', 'b', or null
        });
    });

    socket.on('resign_game', () => {
        const session = activeGames[socket.roomCode];
        
        // Make sure the game is actually running and they are a player
        if (session && !session.gameOver && session.isStarted && socket.color) {
            session.gameOver = true;
            
            const winnerColor = socket.color === 'w' ? 'b' : 'w';
            const winnerName = session.players[winnerColor].name;
            const loserName = session.players[socket.color].name;

            // Broadcast the win to both players
            io.to(socket.roomCode).emit('game_over', { 
                reason: 'resignation', 
                winnerName: winnerName 
            });
            
            // Update the MongoDB Database!
            updateElo(winnerName, loserName, false);
        }
    });

    socket.on('request_rematch', () => {
        // Forward the request to the opponent
        socket.to(socket.roomCode).emit('rematch_requested');
    });

    socket.on('accept_rematch', () => {
        const session = activeGames[socket.roomCode];
        if (session) {
            // 1. Reset the authoritative game state completely!
            session.game = new Chess();
            session.historyFens = [session.game.fen()];
            session.timers = { w: 600000, b: 600000 }; // Reset to 10 mins
            session.lastMoveTime = Date.now();
            session.gameOver = false;
            
            // 2. Tell both frontends to hide the win screen
            io.to(socket.roomCode).emit('rematch_accepted');
            
            // 3. Blast the fresh board state to both players
            io.to(socket.roomCode).emit('game_sync', {
                fen: session.game.fen(),
                turn: session.game.turn(),
                timers: session.timers,
                elapsed: 0,
                whiteName: session.players.w.name,
                blackName: session.players.b.name,
                gameOver: session.gameOver,
                history: session.game.history(),
                fens: session.historyFens 
            });
        }
    });

    // --- 5. DISCONNECT POLICY ---
    socket.on('disconnect', () => {
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
                        const winnerName = session.players[winnerColor].name;
                        io.to(socket.roomCode).emit('game_over', { reason: 'abandonment', winnerName });
                        updateElo(winnerName, socket.username, false);
                    }
                }, 60000); 
            }
        }
        const qIndex = matchmakingQueue.findIndex(s => s.id === socket.id);
        if (qIndex !== -1) matchmakingQueue.splice(qIndex, 1);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});