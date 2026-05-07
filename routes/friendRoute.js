const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const { sendRequest, acceptRequest, getFriends } = require('../controllers/friendsController');

router.post('/api/friends/add',    requireAuth, sendRequest);
router.post('/api/friends/accept', requireAuth, acceptRequest);
router.get('/api/friends',         requireAuth, getFriends);

module.exports = router;