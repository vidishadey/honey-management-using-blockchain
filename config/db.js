const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the connection string from environment variables.
 * Designed to provide clear, actionable console logging for beginners and viva demos.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/honeychain';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB at ${uri}`);
    console.error(`Reason: ${error.message}`);
    console.error('Tip: Ensure MongoDB server is running on port 27017 (e.g. "mongod --dbpath ./data/db").');
    throw error;
  }
}

module.exports = connectDB;
