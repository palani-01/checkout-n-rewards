import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { adminController } from './controllers/adminController.js';
import { cartController } from './controllers/cartController.js';
import { checkoutController } from './controllers/checkoutController.js';
import { errorHandler } from './middleware/errorHandler.js';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

await prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`);

const COUPON_MILESTONE_N = 5;
const COUPON_DISCOUNT_PERCENT = 10;

// Checkout and Cart Routes
// Cart Items Management Route (Handles new UUID cart initialization)
app.post('/api/cart/items', async (req, res) => {
  let { cartId, productId, quantity } = req.body;
  const requestedQty = Number(quantity) || 1;

  try {
    const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    let cart = null;
    if (cartId) {
      cart = await prisma.cart.findUnique({ 
        where: { id: cartId },
        include: { items: true }
      });
    }

    let existingItemQty = 0;
    if (cart && cart.items) {
      const existingItem = cart.items.find(i => i.productId === Number(productId));
      if (existingItem) {
        existingItemQty = existingItem.quantity;
      }
    }

    const totalRequestedQty = existingItemQty + requestedQty;

    // Guard: Ensure total quantity in cart does not exceed stock
    if (totalRequestedQty > product.inventory) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot add more. Only ${product.inventory} left in stock!` 
      });
    }

    // If cart doesn't exist in DB (e.g., brand new frontend UUID), create it using that exact ID
    if (!cart) {
      cart = await prisma.cart.create({ 
        data: { 
          ...(cartId ? { id: cartId } : {}), 
          status: 'ACTIVE' 
        } 
      });
      cartId = cart.id;
    }

    await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cartId,
          productId: Number(productId)
        }
      },
      update: {
        quantity: { increment: requestedQty }
      },
      create: {
        cartId: cartId,
        productId: Number(productId),
        quantity: requestedQty
      }
    });

    const fullCart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    const subtotalCents = fullCart.items.reduce(
      (sum, item) => sum + (item.product.unitPriceCents * item.quantity), 0
    );

    return res.status(200).json({
      success: true,
      cartId: cartId,
      cart: {
        ...fullCart,
        subtotalCents
      }
    });

  } catch (err) {
    console.error("Add to cart error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/checkout', checkoutController.processCheckout);

app.get('/api/cart/:cartId', async (req, res) => {
  const { cartId } = req.params;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const subtotalCents = cart.items.reduce(
      (sum, item) => sum + item.product.unitPriceCents * item.quantity, 
      0
    );

    return res.json({
      success: true,
      cart: {
        ...cart,
        subtotalCents
      }
    });
  } catch (err) {
    console.error("Fetch cart error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/carts/:cartId/items/:itemId', cartController.removeItem);

// Admin & Reporting Routes
app.get('/api/admin/inventory', adminController.getInventoryReport);

app.post('/api/admin/coupons', async (req, res) => {
  const { code, discountPercent, usesRemaining, expiresAt } = req.body;

  try {
    if (!code || !discountPercent) {
      return res.status(400).json({ success: false, error: 'Code and discountPercent are required.' });
    }

    const formattedCode = code.toUpperCase();
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code: formattedCode }
    });

    if (existingCoupon) {
      return res.status(400).json({ success: false, error: `Coupon code "${formattedCode}" already exists.` });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: formattedCode,
        discountPercent: Number(discountPercent),
        usesRemaining: usesRemaining ? Number(usesRemaining) : 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: 'AVAILABLE'
      }
    });

    return res.status(201).json({ success: true, coupon });
  } catch (err) {
    console.error("Error creating coupon:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/coupons/available', async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      where: {
        OR: [
          { usesRemaining: { gt: 0 } },
          { status: 'AVAILABLE' }
        ]
      }
    });
    return res.json({ success: true, coupons });
  } catch (err) {
    console.error("Error fetching available coupons:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/coupons/generate', async (req, res) => {
  try {
    const totalOrders = await prisma.order.count();
    const eligibleMilestones = Math.floor(totalOrders / COUPON_MILESTONE_N);

    const existingMilestoneCouponsCount = await prisma.coupon.count({
      where: { code: { startsWith: 'MILESTONE-' } }
    });

    if (eligibleMilestones <= existingMilestoneCouponsCount) {
      return res.status(400).json({ 
        success: false, 
        error: `Milestone not reached. Total completed orders: ${totalOrders}. Required for next milestone: ${(existingMilestoneCouponsCount + 1) * COUPON_MILESTONE_N}` 
      });
    }

    const milestoneCode = `MILESTONE-${totalOrders}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const newCoupon = await prisma.coupon.create({
      data: {
        code: milestoneCode.toUpperCase(),
        discountPercent: COUPON_DISCOUNT_PERCENT,
        usesRemaining: 1,
        status: 'AVAILABLE'
      }
    });

    return res.status(201).json({ success: true, message: 'Milestone coupon generated successfully', coupon: newCoupon });
  } catch (err) {
    console.error("Milestone generation error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/report', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: { include: { product: true } } }
    });

    const coupons = await prisma.coupon.findMany();

    const purchasedQuantityByProduct = {};
    let grossRevenueCents = 0;
    let totalDiscountsGrantedCents = 0;

    for (const order of orders) {
      grossRevenueCents += order.subtotalCents || order.totalCents || order.grossRevenueCents || 0;
      totalDiscountsGrantedCents += order.discountCents || 0;

      for (const item of order.items) {
        const prodName = item.product?.name || `Product #${item.productId}`;
        if (!purchasedQuantityByProduct[item.productId]) {
          purchasedQuantityByProduct[item.productId] = {
            productId: item.productId,
            productName: prodName,
            quantitySold: 0,
            revenueCents: 0
          };
        }
        purchasedQuantityByProduct[item.productId].quantitySold += item.quantity;
        purchasedQuantityByProduct[item.productId].revenueCents += ((item.unitPriceCents || item.product?.unitPriceCents || 0) * item.quantity);
      }
    }

    const netRevenueCents = grossRevenueCents - totalDiscountsGrantedCents;

    const couponsGenerated = coupons.length;
    const couponsAvailable = coupons.filter(c => (c.usesRemaining ?? 0) > 0 && c.status !== 'REDEEMED').length;
    const couponsRedeemed = coupons.filter(c => (c.usesRemaining ?? 1) === 0 || c.status === 'REDEEMED').length;

    return res.json({
      success: true,
      summary: {
        purchasedQuantityByProduct,
        grossRevenueCents,
        totalDiscountsGrantedCents,
        netRevenueCents,
        coupons: {
          generated: couponsGenerated,
          available: couponsAvailable,
          redeemed: couponsRedeemed
        },
        totalSuccessfullyPlacedOrders: orders.length
      }
    });
  } catch (err) {
    console.error("Admin report error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, orders });
  } catch (err) {
    console.error("Error fetching orders:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/cart/apply-coupon', async (req, res) => {
  const { cartId, couponCode } = req.body;
  if (!cartId || !couponCode) {
    return res.status(400).json({ success: false, error: 'cartId and couponCode are required' });
  }

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } }
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    const subtotalCents = cart.items.reduce(
      (sum, item) => sum + (item.product.unitPriceCents * item.quantity), 0
    );

    const formattedCode = couponCode.trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({
      where: { code: formattedCode }
    });

    if (!coupon) {
      return res.status(400).json({ success: false, error: `Coupon "${formattedCode}" does not exist.` });
    }
    if (coupon.usesRemaining <= 0 || coupon.status === 'REDEEMED') {
      return res.status(400).json({ success: false, error: `Coupon "${formattedCode}" has already been redeemed.` });
    }

    let discountCents = Math.round((subtotalCents * coupon.discountPercent) / 100);
    if (discountCents > subtotalCents) {
      discountCents = subtotalCents;
    }
    const totalCents = Math.max(0, subtotalCents - discountCents);

    return res.json({
      success: true,
      data: {
        couponCode: formattedCode,
        discountPercent: coupon.discountPercent,
        subtotalCents,
        discountCents,
        totalCents
      }
    });
  } catch (err) {
    console.error("Apply coupon error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Global Error Handler
app.use(errorHandler);

export default app;

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}