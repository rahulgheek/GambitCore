// seed.js

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

const seedUsers = [
    { username: 'MagnusC', email: 'magnus@chess.com', rating: 2882, gamesPlayed: 342 },
    { username: 'HikaruN', email: 'hikaru@chess.com', rating: 2789, gamesPlayed: 891 },
    { username: 'GothamChess', email: 'levy@chess.com', rating: 2322, gamesPlayed: 1024 },
    { username: 'BotezLive', email: 'alex@chess.com', rating: 2050, gamesPlayed: 450 },
    { username: 'ChessNoob99', email: 'noob@chess.com', rating: 850, gamesPlayed: 42 },
    { username: 'TacticsMaster', email: 'tactics@chess.com', rating: 1840, gamesPlayed: 210 },
    { username: 'EndgameExpert', email: 'endgame@chess.com', rating: 2100, gamesPlayed: 560 }
];

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB. Clearing old seed data...');
        
        // Optional: clear out users (Uncomment if you want a fresh DB)
        // await User.deleteMany({}); 

        const passwordHash = await bcrypt.hash('password123', 10);

        for (let u of seedUsers) {
            const exists = await User.findOne({ username: u.username });
            if (!exists) {
                await User.create({ ...u, password: passwordHash });
                console.log(`Seeded user: ${u.username}`);
            }
        }
        console.log('✅ Database Seeding Complete!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedDatabase();