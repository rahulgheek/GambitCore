const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_OPTS = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86400000,
});

async function register(req, res) {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password)
            return res.status(400).json({ status: 'error', message: 'Required fields missing.' });
        if (/[<>&"'\/]/.test(username))
            return res.status(400).json({ status: 'error', message: 'Username contains invalid characters.' });

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser)
            return res.status(409).json({ status: 'error', message: 'User exists.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username: username.trim(), email, password: hashedPassword });
        const savedUser = await newUser.save();

        const token = jwt.sign(
            { id: savedUser._id, username: savedUser.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
        );
        res.cookie('token', token, COOKIE_OPTS());
        res.status(201).json({ status: 'success', data: { id: savedUser._id, username: savedUser.username } });
    } catch (_) {
        res.status(500).json({ status: 'error' });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password)))
            return res.status(400).json({ status: 'error', message: 'Invalid credentials.' });

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
        );
        res.cookie('token', token, COOKIE_OPTS());
        res.json({ status: 'success', data: { username: user.username } });
    } catch (_) {
        res.status(500).json({ status: 'error' });
    }
}

function logout(req, res) {
    res.clearCookie('token');
    res.redirect('/');
}

module.exports = { register, login, logout };