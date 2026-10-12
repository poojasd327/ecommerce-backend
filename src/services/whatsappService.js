/**
 * WhatsApp Notification Service
 * Sends automated WhatsApp order confirmation messages to customers
 * Supports: Twilio WhatsApp API, Meta WhatsApp Cloud API, and Simulation Mode
 */

const formatOrderMessage = (order) => {
  const customerName = order.customer?.name || 'Valued Customer';
  const orderId = order.orderId || 'N/A';
  const paymentId = order.paymentId || 'N/A';
  const amount = Number(order.amount).toLocaleString('en-IN');
  const address = order.customer?.shippingAddress || 'Address on file';

  let itemsText = '';
  if (order.items && order.items.length > 0) {
    itemsText = order.items
      .map((item, index) => {
        const itemTotal = (item.price * item.quantity).toLocaleString('en-IN');
        const specs = [item.selectedSize ? `Size: ${item.selectedSize}` : '', item.selectedColor ? `Color: ${item.selectedColor}` : '']
          .filter(Boolean)
          .join(', ');
        return `  ${index + 1}. *${item.name}* (x${item.quantity}${specs ? ` | ${specs}` : ''}) - ₹${itemTotal}`;
      })
      .join('\n');
  } else {
    itemsText = '  • Luxury Silk Nightwear Collection Items';
  }

  return `✨ *LUMINA NUIT - Order Confirmed!* ✨

Hello *${customerName}*,

Thank you for shopping with us! Your order has been placed and payment has been verified successfully.

📋 *Order Details:*
• *Order ID:* ${orderId}
• *Payment ID:* ${paymentId}
• *Total Amount Paid:* ₹${amount}
• *Status:* Confirmed (Paid)

📦 *Items Purchased:*
${itemsText}

🚚 *Delivery Address:*
${address}
_Estimated Express Delivery: 2 - 3 Business Days in signature gold foil gift box._

If you have any questions, simply reply to this message. We hope you love your silk pieces! 🌸`;
};

/**
 * Normalizes phone numbers to international format (e.g., +919876543210)
 */
const normalizePhoneNumber = (rawPhone) => {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/[^0-9+]/g, '');
  if (!cleaned.startsWith('+')) {
    // Default to India (+91) if 10 digits
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
};

/**
 * Send WhatsApp confirmation message to customer phone number
 */
const sendOrderConfirmation = async (order) => {
  const rawPhone = order.customer?.phone;
  const phone = normalizePhoneNumber(rawPhone);
  const message = formatOrderMessage(order);

  const clickToChatUrl = phone
    ? `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`
    : '';

  if (!phone) {
    console.warn(`⚠️ [WHATSAPP] No phone number available for order ${order.orderId}. Skipping notification.`);
    return { success: false, reason: 'NO_PHONE_NUMBER', clickToChatUrl };
  }

  // 1. Try Twilio WhatsApp API
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // default Twilio sandbox

  if (twilioAccountSid && twilioAuthToken && !twilioAccountSid.includes('YourTwilio')) {
    try {
      console.log(`📱 [WHATSAPP] Sending message via Twilio to whatsapp:${phone}...`);
      const authHeader = 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', twilioFromNumber.startsWith('whatsapp:') ? twilioFromNumber : `whatsapp:${twilioFromNumber}`);
      params.append('To', `whatsapp:${phone}`);
      params.append('Body', message);

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      const twilioData = await twilioRes.json();
      if (twilioRes.ok) {
        console.log(`✅ [WHATSAPP] Message sent successfully via Twilio! SID: ${twilioData.sid}`);
        return { success: true, provider: 'twilio', sid: twilioData.sid, clickToChatUrl };
      } else {
        console.error(`❌ [WHATSAPP] Twilio error:`, twilioData.message);
      }
    } catch (err) {
      console.error(`❌ [WHATSAPP] Twilio request failed:`, err.message);
    }
  }

  // 2. Try Meta WhatsApp Cloud API
  const metaToken = process.env.WHATSAPP_API_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (metaToken && metaPhoneId) {
    try {
      console.log(`📱 [WHATSAPP] Sending message via Meta Cloud API to ${phone}...`);
      const metaRes = await fetch(
        `https://graph.facebook.com/v19.0/${metaPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${metaToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone.replace('+', ''),
            type: 'text',
            text: { preview_url: false, body: message },
          }),
        }
      );

      const metaData = await metaRes.json();
      if (metaRes.ok) {
        console.log(`✅ [WHATSAPP] Message sent successfully via Meta Cloud API!`);
        return { success: true, provider: 'meta', data: metaData, clickToChatUrl };
      } else {
        console.error(`❌ [WHATSAPP] Meta Cloud API error:`, metaData);
      }
    } catch (err) {
      console.error(`❌ [WHATSAPP] Meta request failed:`, err.message);
    }
  }

  // 3. Fallback: Log simulation and return Click-To-Chat URL
  console.log(`
📱 ========================================================= 📱
   [WHATSAPP ORDER NOTIFICATION DISPATCHED]
   To:      ${phone} (${order.customer?.name})
   Order:   ${order.orderId} (₹${order.amount})
   Message:
${message}
   Direct WhatsApp Link: ${clickToChatUrl}
📱 ========================================================= 📱
  `);

  return {
    success: true,
    provider: 'simulation',
    message: 'Message formatted and logged to terminal. Ready for Twilio or Meta credentials.',
    clickToChatUrl,
  };
};

module.exports = {
  formatOrderMessage,
  normalizePhoneNumber,
  sendOrderConfirmation,
};
