const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB: GambitCore');
    } catch (err) {
        console.error('❌ MongoDB error:', err);
        process.exit(1);
    }
};

module.exports = connectDB;