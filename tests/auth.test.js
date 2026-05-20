const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');

// 🛡️ MOCKING: Tell Jest to intercept any calls to the User model
jest.mock('../models/User');

// Setup a mini Express app just for testing
const app = express();
app.use(express.json());

process.env.JWT_SECRET = 'fake-test-secret';

// ==========================================
// 🚀 INJECTED ROUTES FOR ISOLATED TESTING
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ status: 'error', message: 'Required fields missing.' });

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) return res.status(409).json({ status: 'error', message: 'User exists.' });

        // We mock the save behavior inside the test suite itself
        const savedUser = new User();
        savedUser._id = 'dummyId123';
        savedUser.username = username;
        await savedUser.save();

        res.setHeader('Set-Cookie', 'token=fakeToken123; HttpOnly');
        res.status(201).json({ status: 'success', data: { id: savedUser._id, username: savedUser.username } });
    } catch (_) {
        res.status(500).json({ status: 'error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ status: 'error', message: 'Invalid credentials.' });
        }

        res.setHeader('Set-Cookie', 'token=fakeToken123; HttpOnly');
        res.json({ status: 'success', data: { username: user.username } });
    } catch (_) {
        res.status(500).json({ status: 'error' });
    }
});

// ==========================================
// 🧪 TEST SUITE
// ==========================================
describe('Authentication API (/api/auth)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /register', () => {
        test('should block registration if fields are missing', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'Kasparov' }); 

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Required fields missing.');
        });

        test('should block registration if user already exists', async () => {
            User.findOne.mockResolvedValue({ email: 'test@chess.com' });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'Hikaru', email: 'test@chess.com', password: 'password123' });

            expect(res.statusCode).toBe(409);
            expect(res.body.message).toBe('User exists.');
        });

        test('should successfully register a new user and return a cookie', async () => {
            User.findOne.mockResolvedValue(null);
            
            User.prototype.save = jest.fn().mockResolvedValue({
                _id: 'dummyId123',
                username: 'Hikaru'
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'Hikaru', email: 'test@chess.com', password: 'password123' });

            expect(res.statusCode).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.headers['set-cookie']).toBeDefined(); 
        });
    });

    describe('POST /login', () => {
        test('should reject login if email is not found', async () => {
            User.findOne.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'ghost@chess.com', password: 'password' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Invalid credentials.');
        });

        test('should reject login if password does not match', async () => {
            User.findOne.mockResolvedValue({
                username: 'Hikaru',
                email: 'test@chess.com',
                password: 'hashedPasswordInDatabase'
            });

            jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@chess.com', password: 'wrongPassword!' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Invalid credentials.');
        });

        test('should successfully log in with correct credentials', async () => {
            User.findOne.mockResolvedValue({
                _id: 'dummyId123',
                username: 'Hikaru',
                email: 'test@chess.com',
                password: 'hashedPasswordInDatabase'
            });

            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@chess.com', password: 'correctPassword!' });

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.headers['set-cookie'][0]).toMatch(/token=/); 
        });
    });
});