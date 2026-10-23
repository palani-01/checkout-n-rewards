import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const checkoutService = async (cartId, couponCode, idempotencyKey) => {
  // 1. Check Idempotency Cache FIRST
  const existingRecord = await prisma.idempotencyRecord.findUnique({
    where: { key: idempotencyKey }
  });
  if (existingRecord) {
    return {
      statusCode: existingRecord.responseCode,
      body: JSON.parse(existingRecord.responseBody),
      isReplay: true
    };
  }

  // 2. Fetch Cart and validate items exist
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { product: true } } }
  });

  if (!cart || !cart.items || cart.items.length === 0) {
    throw new Error('Cart is empty or not found');
  }

  // 3. Execute ACID Transaction
  const result = await prisma.$transaction(async (tx) => {
    let discountCents = 0;
    let validatedCouponCode = null;

    let subtotalCents = 0;
    for (const item of cart.items) {
      if (!item.product) {
        throw new Error('Product not found for cart item');
      }
      if (item.quantity > item.product.inventory) {
        throw new Error(`Insufficient inventory for ${item.product.name}. Available: ${item.product.inventory}`);
      }
      subtotalCents += item.product.unitPriceCents * item.quantity;
    }

    if (couponCode && typeof couponCode === 'string' && couponCode.trim() !== '') {
      const formattedCode = couponCode.trim().toUpperCase();
      
      const coupon = await tx.coupon.findUnique({
        where: { code: formattedCode }
      });

      if (!coupon) {
        throw new Error(`Coupon "${formattedCode}" does not exist.`);
      }
      if (coupon.usesRemaining <= 0 || coupon.status === 'REDEEMED') {
        throw new Error(`Coupon "${formattedCode}" has already been redeemed.`);
      }

      const updateResult = await tx.coupon.updateMany({
        where: { 
          code: formattedCode, 
          usesRemaining: { gt: 0 }, 
          status: { not: 'REDEEMED' } 
        },
        data: { 
          usesRemaining: 0, 
          status: 'REDEEMED' 
        }
      });

      if (updateResult.count === 0) {
        throw new Error(`Coupon "${formattedCode}" has already been redeemed.`);
      }

      discountCents = Math.round((subtotalCents * coupon.discountPercent) / 100);
      if (discountCents > subtotalCents) {
        discountCents = subtotalCents;
      }
      validatedCouponCode = formattedCode;
    }

    const totalCents = Math.max(0, subtotalCents - discountCents);

    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { inventory: { decrement: item.quantity } }
      });
    }

    const order = await tx.order.create({
      data: {
        subtotalCents,
        discountCents,
        totalCents,
        couponCodeUsed: validatedCouponCode,
        items: {
          create: cart.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.product.unitPriceCents
          }))
        }
      },
      include: { items: { include: { product: true } } }
    });

    await tx.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    return order;
  });

  // 4. Post-transaction milestone check
  const totalCompletedOrders = await prisma.order.count();
  const milestoneN = Number(process.env.COUPON_MILESTONE_N) || 5;
  const discountPct = Number(process.env.COUPON_DISCOUNT_PERCENT) || 10;

  if (totalCompletedOrders > 0 && totalCompletedOrders % milestoneN === 0) {
    const existingMilestone = await prisma.coupon.findFirst({
      where: { code: { startsWith: `MILESTONE-${totalCompletedOrders}` } }
    });
    if (!existingMilestone) {
      await prisma.coupon.create({
        data: {
          code: `MILESTONE-${totalCompletedOrders}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          discountPercent: discountPct,
          usesRemaining: 1,
          status: 'AVAILABLE'
        }
      });
    }
  }

  const responsePayload = { success: true, data: result };

  await prisma.idempotencyRecord.create({
    data: {
      key: idempotencyKey,
      responseCode: 201,
      responseBody: JSON.stringify(responsePayload)
    }
  });

  return { statusCode: 201, body: responsePayload, isReplay: false };
};