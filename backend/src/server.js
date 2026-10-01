require('dotenv').config();
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

const PORT = 3000;
const HOST = '0.0.0.0';

let server;

async function startServer() {
  try {
    await connectDB();
  } catch (error) {
    console.warn('[Server Startup Notice] Database not connected at startup:', error.message);
  }

  try {
    server = app.listen(PORT, HOST, () => {
      console.log(`[NEC Faculty Backend] Server running in ${process.env.NODE_ENV || 'development'} mode on http://${HOST}:${PORT}`);
      console.log(`[NEC Faculty Backend] Health endpoint: http://${HOST}:${PORT}/api/health`);
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
