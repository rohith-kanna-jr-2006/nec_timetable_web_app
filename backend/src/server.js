require('dotenv').config();
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

let server;

async function startServer() {
  try {
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(`[NEC Faculty Backend] Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`[NEC Faculty Backend] Health endpoint: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('[Server Startup Error]', error.message);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Closing HTTP server.');
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received. Closing HTTP server.');
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });
  }
});

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
