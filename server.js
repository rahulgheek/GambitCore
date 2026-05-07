require('dotenv').config();

// ── STARTUP GUARDS ────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET is not set. Refusing to start.');
    process.exit(1);
}
if (!process.env.MONGODB_URI) {
    console.error('❌ FATAL: MONGODB_URI is not set. Refusing to start.');
    process.exit(1);
}

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const path         = require('path');
const cookieParser = require('cookie-parser');
const jwt          = require('jsonwebtoken');

const connectDB     = require('./config/db');
const User          = require('./models/User');
const initSocket    = require('./sockets/gameSocket');
const gameCtrl      = require('./controllers/gameController');

const authRoutes    = require('./routes/authRoute');
const userRoutes    = require('./routes/userRoute');
const friendsRoutes = require('./routes/friendRoute');
const gameRoutes    = require('./routes/gameRoute');

// ── SHARED IN-MEMORY STATE ───────────────────────────────────
const activeGames    = {};
const matchmakingQueue = [];
const reservedRooms  = {};
const connectedUsers = {};

// ── APP SETUP ────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── LANDING PAGE ─────────────────────────────────────────────
app.get('/', async (req, res) => {
    let username = null;
    const token = req.cookies.token;
    if (token) {
        try { username = jwt.verify(token, process.env.JWT_SECRET).username; } catch (_) {}
    }
    let highestElo = 1500;
    try {
        const top = await User.findOne().sort({ rating: -1 }).select('rating');
        if (top) highestElo = Math.round(top.rating);
    } catch (_) {}
    res.render('index', { username, highestElo });
});

// ── ROUTES ───────────────────────────────────────────────────
app.use(authRoutes);
app.use(userRoutes);
app.use(friendsRoutes);

// Give the game controller access to the shared reservedRooms object
gameCtrl.init(reservedRooms);
app.use(gameRoutes);

// ── SOCKET.IO ────────────────────────────────────────────────
initSocket(io, { activeGames, matchmakingQueue, reservedRooms, connectedUsers });

// ── START ────────────────────────────────────────────────────
connectDB();
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));