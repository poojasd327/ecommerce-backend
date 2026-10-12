# 💳 Node.js Razorpay Payment Gateway Backend

A production-ready, beginner-friendly Node.js Express backend service for integrating Razorpay Payment Gateway into an e-commerce platform.

---

## 📁 Project Structure

```
ecommerce-backend/
├── .env                  # Environment variables (PORT, Razorpay Keys)
├── .env.example          # Environment key template
├── package.json          # Dependencies & scripts
├── public/
│   └── index.html        # Interactive frontend dashboard for testing
├── src/
│   ├── app.js            # Express application setup
│   ├── server.js         # HTTP server entry point
│   ├── config/
│   │   └── razorpay.js   # Razorpay SDK initialization
│   ├── controllers/
│   │   └── paymentController.js # Order creation, verification, webhooks, refunds
│   ├── middleware/
│   │   └── rawBody.js    # Raw request body saver for webhook HMAC verification
│   └── routes/
│       └── paymentRoutes.js # Route definitions
└── README.md             # Project documentation
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` or edit `.env` directly:
```env
PORT=5000
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourKeySecretHere
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere
```

> 💡 **Where do I get Razorpay Keys?**
> 1. Sign up / Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/).
> 2. Switch to **Test Mode** (toggle on top right).
> 3. Go to **Settings** -> **API Keys** -> **Generate Key**.
> 4. Copy `Key ID` and `Key Secret` into your `.env` file.

### 3. Run the Server
- **Development Mode (with auto-reload)**:
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

### 4. Test in Browser
Open [http://localhost:5000](http://localhost:5000) to open the interactive test client dashboard.

---

## 📡 API Endpoints Documentation

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `GET /api/health` | `GET` | Health check route |
| `GET /api/payment/key` | `GET` | Returns public Razorpay Key ID |
| `POST /api/payment/create-order` | `POST` | Creates a new Razorpay Order |
| `POST /api/payment/verify` | `POST` | Verifies HMAC-SHA256 signature returned by client |
| `POST /api/payment/webhook` | `POST` | Webhook listener for Razorpay events |
| `GET /api/payment/order/:orderId` | `GET` | Fetches Razorpay Order details |
| `GET /api/payment/payment-details/:paymentId` | `GET` | Fetches payment status details |
| `POST /api/payment/refund` | `POST` | Initiates full or partial refund |

---

### Request & Response Examples

#### 1. Create Order (`POST /api/payment/create-order`)
```json
// Request Body:
{
  "amount": 1499,
  "currency": "INR",
  "receipt": "rcpt_1001",
  "notes": { "customer_email": "pooja@example.com" }
}

// Response:
{
  "success": true,
  "message": "Razorpay order created successfully",
  "order": {
    "id": "order_M1234567890",
    "amount": 149900,
    "currency": "INR",
    "status": "created"
  }
}
```

#### 2. Verify Payment (`POST /api/payment/verify`)
```json
// Request Body:
{
  "razorpay_order_id": "order_M1234567890",
  "razorpay_payment_id": "pay_M1234567890",
  "razorpay_signature": "a1b2c3d4e5f6..."
}

// Response:
{
  "success": true,
  "message": "Payment verified successfully! Signature is valid."
}
```

---

## 🛡️ Webhook Integration Guide
To receive automatic payment status notifications (e.g. when payment succeeds or fails):
1. Use [ngrok](https://ngrok.com/) to expose your local port:
   ```bash
   ngrok http 5000
   ```
2. In Razorpay Dashboard -> **Settings** -> **Webhooks**, add URL:
   `https://<your-ngrok-subdomain>.ngrok-free.app/api/payment/webhook`
3. Add events: `payment.captured`, `payment.failed`, `refund.processed`.
4. Copy Webhook Secret to `RAZORPAY_WEBHOOK_SECRET` in `.env`.
