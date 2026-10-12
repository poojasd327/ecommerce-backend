const crypto = require('crypto');
const mongoose = require('mongoose');
const razorpayInstance = require('../config/razorpay');
const Order = require('../models/Order');
const whatsappService = require('../services/whatsappService');

/**
 * 1. GET PUBLIC RAZORPAY KEY ID
 * Allows the frontend client to securely retrieve the public Key ID.
 */
exports.getRazorpayKey = (req, res) => {
  res.status(200).json({
    success: true,
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YourKeyIdHere'
  });
};

/**
 * 2. CREATE A RAZORPAY ORDER
 * Endpoint: POST /api/payment/create-order
 * Request Body: { amount: 500, currency: "INR", receipt: "receipt#101", notes: {}, items: [] }
 */
exports.createOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes, items } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Amount must be a positive number in INR.'
      });
    }

    // Razorpay requires amount in the smallest currency sub-unit (Paise for INR).
    // e.g. ₹500 = 50000 paise
    const amountInPaise = Math.round(Number(amount) * 100);

    const options = {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt: receipt || `receipt_${Date.now()}`,
      notes: notes || { source: 'ecommerce_checkout' }
    };

    // If credentials are live/test from Razorpay, call SDK
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId || keyId === 'rzp_test_YourKeyIdHere') {
      // Demo Fallback Mode: Generate a mock order object if user hasn't added real test keys yet
      const mockOrder = {
        id: `order_mock_${Date.now()}`,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: options.currency,
        receipt: options.receipt,
        status: 'created',
        attempts: 0,
        notes: options.notes,
        created_at: Math.floor(Date.now() / 1000),
        is_mock: true
      };

      // Save mock order to MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        try {
          await Order.create({
            orderId: mockOrder.id,
            amount: Number(amount),
            currency: mockOrder.currency,
            status: 'created',
            receipt: mockOrder.receipt,
            customer: {
              name: notes?.customer_name || '',
              email: notes?.customer_email || '',
              phone: notes?.customer_phone || '',
              shippingAddress: notes?.shipping_address || ''
            },
            items: items || [],
            notes: options.notes,
            isMock: true
          });
        } catch (dbErr) {
          console.error('Failed to save mock order in MongoDB:', dbErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Order created in Demo Mode. (Add valid Razorpay API keys in .env for live test payments)',
        order: mockOrder,
        key_id: keyId
      });
    }

    const order = await razorpayInstance.orders.create(options);

    // Persist real order in MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await Order.create({
          orderId: order.id,
          amount: Number(amount),
          currency: order.currency,
          status: 'created',
          receipt: order.receipt,
          customer: {
            name: notes?.customer_name || '',
            email: notes?.customer_email || '',
            phone: notes?.customer_phone || '',
            shippingAddress: notes?.shipping_address || ''
          },
          items: items || [],
          notes: options.notes,
          isMock: false
        });
      } catch (dbErr) {
        console.error('Failed to save order to MongoDB:', dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      order,
      key_id: keyId
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      error: error.message || error
    });
  }
};

/**
 * 3. VERIFY PAYMENT SIGNATURE
 * Endpoint: POST /api/payment/verify
 * Request Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: razorpay_order_id, razorpay_payment_id, or razorpay_signature.'
      });
    }

    // Handle Mock Orders in Demo Mode
    if (razorpay_order_id.startsWith('order_mock_')) {
      let mockDbOrder = null;
      if (mongoose.connection.readyState === 1) {
        try {
          mockDbOrder = await Order.findOneAndUpdate(
            { orderId: razorpay_order_id },
            { $set: { status: 'paid', paymentId: razorpay_payment_id, signature: razorpay_signature } },
            { returnDocument: 'after', upsert: true }
          );
        } catch (dbErr) {
          console.error('Failed to update mock order status in MongoDB:', dbErr.message);
        }
      }

      let whatsappRes = null;
      if (mockDbOrder) {
        whatsappRes = await whatsappService.sendOrderConfirmation(mockDbOrder);
      }

      return res.status(200).json({
        success: true,
        message: 'Mock payment verified successfully (Demo Mode)',
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        whatsapp: whatsappRes,
        is_mock: true
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    // Cryptographic HMAC SHA-256 calculation
    const bodyData = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyData.toString())
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (isSignatureValid) {
      // Update database status to 'paid' and fetch the updated order document
      let dbOrder = null;
      if (mongoose.connection.readyState === 1) {
        try {
          dbOrder = await Order.findOneAndUpdate(
            { orderId: razorpay_order_id },
            {
              $set: {
                status: 'paid',
                paymentId: razorpay_payment_id,
                signature: razorpay_signature
              }
            },
            { returnDocument: 'after', upsert: true }
          );
        } catch (dbErr) {
          console.error('Failed to update order status in MongoDB:', dbErr.message);
        }
      }

      // Automatically dispatch WhatsApp confirmation message to customer phone from database
      let whatsappResult = null;
      if (dbOrder) {
        whatsappResult = await whatsappService.sendOrderConfirmation(dbOrder);
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully! Signature is valid.',
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        whatsapp: whatsappResult
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed! Invalid signature.',
        error: 'SIGNATURE_MISMATCH'
      });
    }
  } catch (error) {
    console.error('Error verifying payment signature:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during payment verification',
      error: error.message || error
    });
  }
};

/**
 * 4. WEBHOOK HANDLER FOR ASYNCHRONOUS NOTIFICATIONS
 * Endpoint: POST /api/payment/webhook
 * Headers: x-razorpay-signature
 */
exports.handleWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSignature) {
      return res.status(400).json({ success: false, message: 'Missing x-razorpay-signature header' });
    }

    if (!webhookSecret || webhookSecret === 'YourWebhookSecretHere') {
      console.warn('⚠️ Webhook secret not configured in .env. Skipping strict signature check for testing.');
    } else {
      // Raw request body is captured by rawBodySaver middleware
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.rawBody || JSON.stringify(req.body))
        .digest('hex');

      if (expectedSignature !== webhookSignature) {
        console.error('❌ Webhook signature validation failed.');
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`🔔 Received Razorpay Webhook Event: ${event}`);

    switch (event) {
      case 'payment.captured': {
        const paymentEntity = payload.payment.entity;
        console.log(`✅ Payment Captured! Payment ID: ${paymentEntity.id}, Order ID: ${paymentEntity.order_id}, Amount: ₹${paymentEntity.amount / 100}`);
        if (mongoose.connection.readyState === 1) {
          const updatedOrder = await Order.findOneAndUpdate(
            { orderId: paymentEntity.order_id },
            { $set: { status: 'paid', paymentId: paymentEntity.id } },
            { returnDocument: 'after' }
          );
          if (updatedOrder && updatedOrder.status === 'paid') {
            await whatsappService.sendOrderConfirmation(updatedOrder);
          }
        }
        break;
      }
      case 'payment.failed': {
        const paymentEntity = payload.payment.entity;
        console.log(`❌ Payment Failed! Payment ID: ${paymentEntity.id}, Reason: ${paymentEntity.error_description}`);
        if (mongoose.connection.readyState === 1) {
          await Order.findOneAndUpdate(
            { orderId: paymentEntity.order_id },
            { $set: { status: 'failed' } }
          );
        }
        break;
      }
      case 'refund.processed': {
        const refundEntity = payload.refund.entity;
        console.log(`💸 Refund Processed! Refund ID: ${refundEntity.id}, Amount: ₹${refundEntity.amount / 100}`);
        if (mongoose.connection.readyState === 1) {
          await Order.findOneAndUpdate(
            { paymentId: refundEntity.payment_id },
            { $set: { status: 'refunded' } }
          );
        }
        break;
      }
      default:
        console.log(`ℹ️ Unhandled Webhook Event: ${event}`);
    }

    // Always acknowledge receipt to Razorpay with a 200 status code
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing error', error: error.message });
  }
};

/**
 * 5. FETCH ORDER DETAILS
 * Endpoint: GET /api/payment/order/:orderId
 */
exports.fetchOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    let dbRecord = null;
    if (mongoose.connection.readyState === 1) {
      dbRecord = await Order.findOne({ orderId });
    }

    if (orderId.startsWith('order_mock_')) {
      return res.status(200).json({
        success: true,
        order: dbRecord || { id: orderId, status: 'created', note: 'Mock Order' }
      });
    }

    const order = await razorpayInstance.orders.fetch(orderId);
    return res.status(200).json({ success: true, order, databaseRecord: dbRecord });
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch order details', error: error.message });
  }
};

/**
 * 6. FETCH PAYMENT DETAILS
 * Endpoint: GET /api/payment/payment-details/:paymentId
 */
exports.fetchPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return res.status(200).json({ success: true, payment });
  } catch (error) {
    console.error('Error fetching payment:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment details', error: error.message });
  }
};

/**
 * 7. INITIATE A REFUND
 * Endpoint: POST /api/payment/refund
 * Request Body: { paymentId, amount (optional in INR), notes }
 */
exports.initiateRefund = async (req, res) => {
  try {
    const { paymentId, amount, notes } = req.body;

    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'Payment ID is required for initiating a refund.' });
    }

    const refundOptions = {
      notes: notes || { reason: 'Customer cancellation' }
    };

    if (amount) {
      refundOptions.amount = Math.round(Number(amount) * 100);
    }

    const refund = await razorpayInstance.payments.refund(paymentId, refundOptions);

    if (mongoose.connection.readyState === 1) {
      await Order.findOneAndUpdate(
        { paymentId },
        { $set: { status: 'refunded' } }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      refund
    });
  } catch (error) {
    console.error('Error initiating refund:', error);
    return res.status(500).json({ success: false, message: 'Failed to initiate refund', error: error.message });
  }
};

/**
 * 8. GET ALL ORDERS STORED IN DATABASE
 * Endpoint: GET /api/payment/orders
 */
exports.getAllOrders = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({
        success: true,
        message: 'Database is in standby or not connected yet.',
        orders: []
      });
    }

    const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
    return res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Error fetching orders from database:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 9. RESEND / TRIGGER WHATSAPP NOTIFICATION
 * Endpoint: POST /api/payment/send-whatsapp/:orderId
 */
exports.resendWhatsApp = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: `Order not found with ID: ${orderId}` });
    }

    const result = await whatsappService.sendOrderConfirmation(order);
    return res.status(200).json({
      success: true,
      message: 'WhatsApp notification dispatched',
      result
    });
  } catch (error) {
    console.error('Error resending WhatsApp notification:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
