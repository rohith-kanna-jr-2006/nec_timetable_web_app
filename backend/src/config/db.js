const mongoose = require('mongoose');

/**
 * Connect to MongoDB instance with robust error handling and event logging.
 */
async function connectDB(uri) {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nec_faculty_db';

  // CRITICAL per AI Studio web migration guidelines: fail fast, don't hang
  mongoose.set('bufferCommands', false);

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2000,
    });

    console.log(`[MongoDB] Connected successfully to ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.warn(`[MongoDB Connection Warning] ${error.message} (offline fallback active)`);
    if (process.env.NODE_ENV === 'test') {
      throw error;
    }
    return null;
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
