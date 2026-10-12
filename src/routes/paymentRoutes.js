const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// 1. Get Public Razorpay Key ID
router.get('/key', paymentController.getRazorpayKey);

// 2. Create Razorpay Order
router.post('/create-order', paymentController.createOrder);

// 3. Verify Payment Signature (HMAC SHA-256)
router.post('/verify', paymentController.verifyPayment);

// 4. Razorpay Webhook Handler
router.post('/webhook', paymentController.handleWebhook);

// 5. Fetch Order Details by Order ID
router.get('/order/:orderId', paymentController.fetchOrderDetails);

// 6. Fetch Payment Details by Payment ID
router.get('/payment-details/:paymentId', paymentController.fetchPaymentDetails);

// 7. Initiate Refund
router.post('/refund', paymentController.initiateRefund);

// 8. Get All Orders Stored in Database
router.get('/orders', paymentController.getAllOrders);

module.exports = router;
