/**
 * Middleware to store raw request body as a Buffer on req.rawBody.
 * Required for cryptographic HMAC signature verification on Webhooks.
 */
function rawBodySaver(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}

module.exports = rawBodySaver;
