const User = require('../models/User');

async function sendRequest(req, res) {
    try {
        const { targetUsername } = req.body;
        const sender = await User.findById(req.user.id);
        const receiver = await User.findOne({ username: new RegExp(`^${targetUsername.trim()}$`, 'i') });

        if (!receiver) return res.status(404).json({ status: 'error', message: 'User not found.' });
        if (sender.username.toLowerCase() === targetUsername.toLowerCase())
            return res.status(400).json({ status: 'error', message: 'You cannot add yourself!' });
        if (sender.friends.includes(receiver._id))
            return res.status(400).json({ status: 'error', message: 'Already friends.' });
        if (receiver.receivedRequests.includes(sender._id))
            return res.status(400).json({ status: 'error', message: 'Request already sent.' });

        sender.sentRequests.push(receiver._id);
        receiver.receivedRequests.push(sender._id);
        await sender.save();
        await receiver.save();
        res.json({ status: 'success', message: `Friend request sent to ${receiver.username}!` });
    } catch (err) {
        console.error('Add Friend Error:', err);
        res.status(500).json({ status: 'error', message: 'Server error.' });
    }
}

async function acceptRequest(req, res) {
    try {
        const { senderUsername } = req.body;
        const receiver = await User.findById(req.user.id);
        const sender = await User.findOne({ username: senderUsername });

        if (!sender || !receiver.receivedRequests.includes(sender._id))
            return res.status(400).json({ status: 'error', message: 'No valid request found' });

        receiver.receivedRequests = receiver.receivedRequests.filter(id => !id.equals(sender._id));
        sender.sentRequests       = sender.sentRequests.filter(id => !id.equals(receiver._id));
        receiver.friends.push(sender._id);
        sender.friends.push(receiver._id);
        await receiver.save();
        await sender.save();
        res.json({ status: 'success', message: 'Friend request accepted!' });
    } catch (_) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
}

async function getFriends(req, res) {
    try {
        const user = await User.findById(req.user.id)
            .populate('friends', 'username rating')
            .populate('receivedRequests', 'username rating');
        res.json({ status: 'success', friends: user.friends, requests: user.receivedRequests });
    } catch (_) {
        res.status(500).json({ status: 'error' });
    }
}

module.exports = { sendRequest, acceptRequest, getFriends };