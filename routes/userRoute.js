const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const { getDashboard, uploadAvatar, updateUsername, searchUsers } = require('../controllers/userController');

router.get('/dashboard',            requireAuth, getDashboard);
router.post('/api/user/avatar',     requireAuth, upload.single('avatar'), uploadAvatar);
router.post('/api/user/update-name', requireAuth, updateUsername);
router.get('/api/users/search',     requireAuth, searchUsers);

module.exports = router;