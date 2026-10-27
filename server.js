require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const { initializeGenesisBlock } = require('./services/blockchain');

const batchRoutes = require('./routes/batchRoutes');
const blockchainRoutes = require('./routes/blockchainRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and body parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/batches', batchRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/public', publicRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Honey Chain Traceability MVP',
    timestamp: new Date().toISOString(),
  });
});

// Friendly redirect for root to dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler for unmatched API requests
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Requested API endpoint not found',
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start application and connect database
async function startServer() {
  try {
    await connectDB();
    // Ensure genesis block is initialized in the ledger
    await initializeGenesisBlock();

    app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`🍯 HONEY CHAIN SERVER IS LIVE ON PORT ${PORT}`);
      console.log(`📡 Beekeeper Dashboard: http://localhost:${PORT}`);
      console.log(`🔍 Chain Explorer:      http://localhost:${PORT}/blockchain.html`);
      console.log(`📱 Public Verify Demo:   http://localhost:${PORT}/verify.html`);
      console.log('====================================================');
    });
  } catch (error) {
    console.error('Failed to bootstrap server:', error.message);
    process.exit(1);
  }
}

// Start if executed directly
if (require.main === module) {
  startServer();
}

module.exports = app;
