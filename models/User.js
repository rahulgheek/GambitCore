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
    avatar: { type: String, default: null },
    rating: { type: Number, default: 1500 ,set: (v) => Math.round(v)}, // Standard default
    rd: { type: Number, default: 350 },      // High uncertainty for new players
    vol: { type: Number, default: 0.06 },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    receivedRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    gamesPlayed: {
        type: Number,
        default: 0
    },
    notifications: [{ 
        message: String, 
        type: { type: String, default: 'info' }, // 'challenge', 'system', 'friend'
        createdAt: { type: Date, default: Date.now } 
    }],
}, { timestamps: true }); // Automatically adds createdAt and updatedAt dates

// In MongoDB, this will automatically create a collection called "users" inside GambitCore
module.exports = mongoose.model('User', userSchema);