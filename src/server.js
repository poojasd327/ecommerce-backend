const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
🚀 =================================================== 🚀
   Razorpay Payment Gateway Backend is Live!
   - Local URL:   http://localhost:${PORT}
   - Health Check: http://localhost:${PORT}/api/health
   - Test UI:     http://localhost:${PORT}/
🚀 =================================================== 🚀
  `);
});

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});
