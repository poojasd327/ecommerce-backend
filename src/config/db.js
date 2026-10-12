const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI || mongoURI.includes('<db_username>') || mongoURI.includes('<db_password>')) {
    console.warn('⚠️  [MONGODB WARNING] MONGODB_URI is not set or contains placeholder <db_username>/<db_password>. Database storage is in standby mode.');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`🌿 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
  }
};

module.exports = connectDB;
