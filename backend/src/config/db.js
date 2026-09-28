const mongoose = require('mongoose');

/**
 * Connect to MongoDB instance with robust error handling and event logging.
 */
async function connectDB(uri) {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nec_faculty_db';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[MongoDB] Connected successfully to ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Connection Error] ${error.message}`);
    throw error;
  }
}

async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error(`[MongoDB Disconnect Error] ${error.message}`);
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};
