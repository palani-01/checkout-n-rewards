import prisma from '../config/database';
import { AppError } from '../errors/AppError';

export class CartService {
  static async createCart() {
    return prisma.cart.create({
      data: { status: 'ACTIVE' },
      include: { items: { include: { product: true } } }
    });
  }

  static async getCart(cartId: string) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } }
    });

    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    let grossAmountCents = 0;
    const formattedItems = cart.items.map(item => {
      const itemTotal = item.quantity * item.product.unitPriceCents;
      grossAmountCents += itemTotal;
      return {
        productId: item.productId,
        name: item.product.name,
        unitPriceCents: item.product.unitPriceCents,
        quantity: item.quantity,
        totalCents: itemTotal
      };
    });

    return {
      cartId: cart.id,
      status: cart.status,
      items: formattedItems,
      grossAmountCents,
      createdAt: cart.createdAt
    };
  }

  static async addItem(cartId: string, productId: number, quantity: number) {
    if (quantity <= 0) {
      throw new AppError('Quantity must be greater than zero', 400);
    }

    const cart = await prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart) throw new AppError('Cart not found', 404);
    if (cart.status !== 'ACTIVE') throw new AppError('Cart is already checked out', 400);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Product not found', 404);

    if (product.inventory < quantity) {
      throw new AppError(`Insufficient inventory. Available: ${product.inventory}`, 422);
    }

    // Upsert item in cart (increment quantity if already exists)
    return prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      update: { quantity: { increment: quantity } },
      create: { cartId, productId, quantity }
    });
  }

  static async removeItem(cartId: string, productId: number) {
    const cart = await prisma.cart.findUnique({ where: { id: cartId } });
    if (!cart) throw new AppError('Cart not found', 404);
    if (cart.status !== 'ACTIVE') throw new AppError('Cart is already checked out', 400);

    try {
      return await prisma.cartItem.delete({
        where: { cartId_productId: { cartId, productId } }
      });
    } catch {
      throw new AppError('Item not found in cart', 404);
    }
  }
}