// @ts-check
import prisma from '../config/database.js';
import { NotFoundError } from '../utils/appError.js';

export const cartService = {
  /**
   * Retrieves cart details along with items and nested product information.
   * @param {string} cartId - The UUID of the cart
   * @returns {Promise<import('@prisma/client').Cart & { items: (import('@prisma/client').CartItem & { product: import('@prisma/client').Product })[] }>}
   */
  async getCart(cartId) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    return cart;
  },

  /**
   * Removes a specific item from an active cart.
   * @param {string} cartId - The UUID of the cart
   * @param {number | string} cartItemId - The ID of the cart item to remove
   * @returns {Promise<{ message: string }>}
   */
  async removeCartItem(cartId, cartItemId) {
    const item = await prisma.cartItem.findFirst({
      where: { id: Number(cartItemId), cartId },
    });

    if (!item) {
      throw new NotFoundError('Cart item not found');
    }

    await prisma.cartItem.delete({
      where: { id: Number(cartItemId) },
    });

    return { message: 'Item removed successfully' };
  },
};