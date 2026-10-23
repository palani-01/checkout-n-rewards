import { cartService } from '../services/cartService.js';

export const cartController = {
  async getCart(req, res, next) {
    try {
      const { cartId } = req.params;
      const cart = await cartService.getCart(cartId);
      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      next(error);
    }
  },

  async removeItem(req, res, next) {
    try {
      const { cartId, itemId } = req.params;
      const result = await cartService.removeCartItem(cartId, itemId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};