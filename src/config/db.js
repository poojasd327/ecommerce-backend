const mongoose = require('mongoose');

const connectDB = async (retries = 5, delay = 5000) => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI || mongoURI.includes('<db_username>') || mongoURI.includes('<db_password>')) {
    console.warn('⚠️  [MONGODB WARNING] MONGODB_URI is not set or contains placeholders. Database storage is in standby mode.');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`🌿 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    if (retries > 0) {
      console.log(`🔄 Retrying MongoDB connection in ${delay / 1000}s... (${retries} retries remaining)`);
      setTimeout(() => connectDB(retries - 1, delay), delay);
    }
  }
};

module.exports = connectDB;
