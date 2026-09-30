const path = require('path');
try {
  require('dotenv').config();
} catch (e) {
  try {
    require(path.resolve(__dirname, 'backend/node_modules/dotenv')).config({
      path: path.resolve(__dirname, 'backend/.env'),
    });
  } catch (err) {}
}
const fs = require('fs');
const { execSync } = require('child_process');
const app = require('./backend/src/app');
const { connectDB, disconnectDB } = require('./backend/src/config/db');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Ensure frontend assets are built if missing
const distIndex = path.resolve(__dirname, 'web/dist/index.html');
if (!fs.existsSync(distIndex)) {
  console.log('[Root Server] web/dist/index.html not found. Building frontend...');
  try {
    execSync('npm run build --workspace=web', { stdio: 'inherit' });
    console.log('[Root Server] Frontend build completed.');
  } catch (buildErr) {
    console.warn('[Root Server] Note: Frontend build returned code:', buildErr.message);
  }
}

let server;

async function startServer() {
  try {
    await connectDB();
  } catch (dbErr) {
    console.warn('[Root Server] Note on DB startup:', dbErr.message);
  }

  server = app.listen(PORT, HOST, () => {
    console.log(`[NEC Faculty Timetable] Server running on http://${HOST}:${PORT}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (server) {
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  }
});

process.on('SIGINT', async () => {
  if (server) {
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  }
});

startServer();

module.exports = { app, startServer };
