const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function getDashboard(req, res) {
    try {
        const user = await User.findById(req.user.id);
        const topPlayers = await User.find().sort({ rating: -1 }).limit(5);
        res.render('dashboard', {
            username:    user.username,
            rating:      user.rating,
            gamesPlayed: user.gamesPlayed,
            avatar:      user.avatar,
            topPlayers,
        });
    } catch (_) {
        res.status(500).send('Error loading dashboard');
    }
}

async function uploadAvatar(req, res) {
    try {
        if (!req.file) return res.status(400).json({ status: 'error', message: 'No image provided.' });
        await User.findByIdAndUpdate(req.user.id, { avatar: req.file.path });
        res.json({ status: 'success', avatarUrl: req.file.path });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ status: 'error', message: 'Failed to upload image.' });
    }
}

async function updateUsername(req, res) {
    const { newUsername } = req.body;
    if (!newUsername || newUsername.trim().length < 3)
        return res.json({ status: 'error', message: 'Name must be at least 3 characters.' });
    if (/[<>&"'\/]/.test(newUsername))
        return res.json({ status: 'error', message: 'Username contains invalid characters.' });

    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { username: newUsername.trim() },
            { new: true },
        );
        const token = jwt.sign(
            { id: user._id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
        );
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        });
        res.json({ status: 'success', message: 'Name updated successfully!' });
    } catch (_) {
        res.json({ status: 'error', message: 'Username might already be taken.' });
    }
}

async function searchUsers(req, res) {
    try {
        const query = req.query.q;
        if (!query || query.length < 3) return res.json({ users: [] });
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const users = await User.find({
            username: { $regex: safeQuery, $options: 'i' },
            _id: { $ne: req.user.id },
        }).limit(8).select('username rating');
        res.json({ users });
    } catch (_) {
        res.status(500).json({ error: 'Search failed' });
    }
}

module.exports = { getDashboard, uploadAvatar, updateUsername, searchUsers };