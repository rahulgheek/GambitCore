const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Mock the Database
jest.mock('../models/User');

// 1. Setup the Express App & Middleware
const app = express();
app.use(express.json());
app.use(require('cookie-parser')());

process.env.JWT_SECRET = 'super-secret-test-key';

// Reusable Auth Middleware (Mocking your actual middleware/auth.js)
const requireAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Mocking your Friend Route Logic directly for isolated testing
app.post('/api/friends/add', requireAuth, async (req, res) => {
    try {
        const { targetUsername } = req.body;
        const sender = await User.findById(req.user.id);
        const receiver = await User.findOne({ username: targetUsername });

        if (!receiver) return res.status(404).json({ status: 'error', message: 'User not found.' });
        if (sender.username === targetUsername) return res.status(400).json({ status: 'error', message: 'You cannot add yourself!' });
        
        // Success logic (simplified for test)
        res.json({ status: 'success', message: `Friend request sent to ${receiver.username}!` });
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// ==========================================
// 🧪 THE TEST SUITE
// ==========================================
describe('POST /api/friends/add (Protected Route)', () => {
    
    let validCookie;

    // Before all tests, generate a fake JWT token so we can bypass the `requireAuth` barrier
    beforeAll(() => {
        const fakeToken = jwt.sign({ id: 'sender123', username: 'Magnus' }, process.env.JWT_SECRET);
        validCookie = `token=${fakeToken}`;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should reject request if user tries to add themselves', async () => {
        // Mock DB: The sender is Magnus
        User.findById.mockResolvedValue({ _id: 'sender123', username: 'Magnus' });
        User.findOne.mockResolvedValue({ _id: 'sender123', username: 'Magnus' });

        const res = await request(app)
            .post('/api/friends/add')
            .set('Cookie', validCookie) // 👈 INJECTING THE LOGIN TOKEN
            .send({ targetUsername: 'Magnus' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('You cannot add yourself!');
    });

    test('should reject request if target user does not exist in the database', async () => {
        // Mock DB: Sender exists, but receiver lookup returns null
        User.findById.mockResolvedValue({ _id: 'sender123', username: 'Magnus' });
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/friends/add')
            .set('Cookie', validCookie)
            .send({ targetUsername: 'GhostPlayer99' });

        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe('User not found.');
    });

    test('should successfully send request if target is valid', async () => {
        // Mock DB: Both sender and receiver exist
        User.findById.mockResolvedValue({ _id: 'sender123', username: 'Magnus', sentRequests: [] });
        User.findOne.mockResolvedValue({ _id: 'receiver456', username: 'Hikaru', receivedRequests: [] });

        const res = await request(app)
            .post('/api/friends/add')
            .set('Cookie', validCookie)
            .send({ targetUsername: 'Hikaru' });

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.message).toBe('Friend request sent to Hikaru!');
    });

    test('should block access entirely if no auth cookie is provided', async () => {
        const res = await request(app)
            .post('/api/friends/add')
            .send({ targetUsername: 'Hikaru' });
            // Notice we did NOT use .set('Cookie', validCookie) here!

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });
});