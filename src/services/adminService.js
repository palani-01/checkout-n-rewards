// @ts-check
import prisma from '../config/database.js';
import { BadRequestError } from '../utils/appError.js';

export const adminService = {
  /**
   * Generates a full sales report with revenue summaries in cents.
   * @returns {Promise<any>}
   */
  async getSalesReport() {
    const orders = await prisma.order.findMany({
      include: { items: { include: { product: true } } },
    });

    let totalGrossRevenueCents = 0;
    let totalDiscountsGivenCents = 0;
    let totalNetRevenueCents = 0;
    let totalItemsSold = 0;

    orders.forEach((order) => {
      totalGrossRevenueCents += order.grossAmountCents;
      totalDiscountsGivenCents += order.discountAmountCents;
      totalNetRevenueCents += order.netAmountCents;
      order.items.forEach((item) => {
        totalItemsSold += item.quantity;
      });
    });

    return {
      totalOrders: orders.length,
      totalItemsSold,
      revenue: {
        grossCents: totalGrossRevenueCents,
        discountsGivenCents: totalDiscountsGivenCents,
        netCents: totalNetRevenueCents,
      },
      orders,
    };
  },

  /**
   * Retrieves inventory levels sorted for low-stock monitoring.
   * @returns {Promise<import('@prisma/client').Product[]>}
   */
  async getInventoryReport() {
    const products = await prisma.product.findMany({
      orderBy: { inventory: 'asc' },
    });
    return products;
  },

  /**
   * Creates a new promotional or milestone discount coupon.
   * @param {string} code - Coupon code string
   * @param {number} discountPercent - Percentage discount (e.g., 15 for 15%)
   * @param {number | null} [milestoneOrderNumber] - Optional milestone tie-in
   * @returns {Promise<import('@prisma/client').Coupon>}
   */
  async createCoupon(code, discountPercent, milestoneOrderNumber = null) {
    if (!code || !discountPercent) {
      throw new BadRequestError('Coupon code and discount percent are required');
    }

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestError('Coupon code already exists');
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountPercent,
        milestoneOrderNumber,
        status: 'AVAILABLE',
      },
    });

    return coupon;
  },
};