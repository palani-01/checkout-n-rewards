import { checkoutService } from '../services/checkoutService.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const checkoutController = {
  processCheckout: async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, error: 'Idempotency-Key header is required' });
    }

    const { cartId, couponCode } = req.body;
    if (!cartId) {
      return res.status(400).json({ success: false, error: 'cartId is required' });
    }

    try {
      const { statusCode, body } = await checkoutService(cartId, couponCode, idempotencyKey);
      return res.status(statusCode).json(body);
    } catch (err) {
      console.error("Checkout error:", err.message);
      const errorPayload = { success: false, error: err.message || 'Checkout failed' };

      if (idempotencyKey) {
        try {
          await prisma.idempotencyRecord.create({
            data: {
              key: idempotencyKey,
              responseCode: 400,
              responseBody: JSON.stringify(errorPayload)
            }
          });
        } catch (e) {
          // Ignore duplicate key collisions
        }
      }

      return res.status(400).json(errorPayload);
    }
  }
};