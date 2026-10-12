const express = require('express');
const cors = require('cors');
const path = require('path');
const rawBodySaver = require('./middleware/rawBody');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// 1. Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// 2. Body Parser setup with rawBody saver for webhook HMAC verification
app.use(express.json({ verify: rawBodySaver }));
app.use(express.urlencoded({ extended: true, verify: rawBodySaver }));

// 3. Serve static test interface from public directory
app.use(express.static(path.join(__dirname, '../public')));

// 4. API Routes
app.use('/api/payment', paymentRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Ecommerce Razorpay Payment Backend is running smooth!',
    timestamp: new Date().toISOString()
  });
});

// 5. 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route Not Found - ${req.originalUrl}`
  });
});

// 6. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : undefined
  });
});

module.exports = app;
