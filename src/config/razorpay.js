const Razorpay = require('razorpay');
const dotenv = require('dotenv');

dotenv.config();

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if (!key_id || key_id === 'rzp_test_YourKeyIdHere' || !key_secret || key_secret === 'YourKeySecretHere') {
  console.warn('⚠️  [WARNING] Razorpay API keys are using placeholder values. Please update your .env file with your actual test keys from https://dashboard.razorpay.com/app/keys');
}

const razorpayInstance = new Razorpay({
  key_id: key_id || 'rzp_test_YourKeyIdHere',
  key_secret: key_secret || 'YourKeySecretHere'
});

module.exports = razorpayInstance;
