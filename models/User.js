// Inside models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    rating: { 
        type: Number, 
        default: 0 // Default starting Elo rating for chess
    },
    gamesPlayed: {
        type: Number,
        default: 0
    }
}, { timestamps: true }); // Automatically adds createdAt and updatedAt dates

// In MongoDB, this will automatically create a collection called "users" inside GambitCore
module.exports = mongoose.model('User', userSchema);