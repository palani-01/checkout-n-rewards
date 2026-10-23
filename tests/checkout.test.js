import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/index.js';

const prisma = new PrismaClient();

describe('Checkout & Rewards System Integration Tests', () => {
  let testCartId;
  let testProductId;

  beforeEach(async () => {
    // Clean database before each test
    await prisma.idempotencyRecord.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.coupon.deleteMany();
    await prisma.product.deleteMany();

    // Seed test product
    const product = await prisma.product.create({
      data: { name: 'Test Helmet', unitPriceCents: 5000, inventory: 10 }
    });
    testProductId = product.id;

    // Seed test cart
    const cart = await prisma.cart.create({
      data: {
        items: {
          create: [{ productId: testProductId, quantity: 2 }]
        }
      }
    });
    testCartId = cart.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('1. Successful checkout with inventory decrement and total calculation', async () => {
    const res = await request(app)
      .post('/api/checkout')
      .set('Idempotency-Key', 'test-key-001')
      .send({ cartId: testCartId });

    expect(res.status).toBe(201);
    expect(res.body.data.totalCents).toBe(10000); // 2 * 5000 cents

    // Verify inventory decreased
    const product = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(product.inventory).toBe(8);
  });

  test('2. Idempotent checkout replay returns cached response without duplicate processing', async () => {
    const key = 'idempotent-key-repeat';
    
    const firstRes = await request(app)
      .post('/api/checkout')
      .set('Idempotency-Key', key)
      .send({ cartId: testCartId });

    expect(firstRes.status).toBe(201);

    // Second request with same key (repeated operation)
    const secondRes = await request(app)
      .post('/api/checkout')
      .set('Idempotency-Key', key)
      .send({ cartId: testCartId });

    expect(secondRes.status).toBe(201);
    expect(secondRes.body).toEqual(firstRes.body);

    // Verify inventory only deducted ONCE (decremented by 2, not 4)
    const product = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(product.inventory).toBe(8);
  });

  test('3. Concurrent coupon redemption race condition protection', async () => {
    // Create a single-use coupon
    await prisma.coupon.create({
      data: { code: 'SAVE50', discountPercent: 50, usesRemaining: 1, status: 'AVAILABLE' }
    });

    // Create a second cart for competing concurrent test
    const cart2 = await prisma.cart.create({
      data: { items: { create: [{ productId: testProductId, quantity: 1 }] } }
    });

    // Fire two checkouts simultaneously with the exact same single-use coupon (competing operations)
    const [res1, res2] = await Promise.all([
      request(app).post('/api/checkout').set('Idempotency-Key', 'concurrent-1').send({ cartId: testCartId, couponCode: 'SAVE50' }),
      request(app).post('/api/checkout').set('Idempotency-Key', 'concurrent-2').send({ cartId: cart2.id, couponCode: 'SAVE50' })
    ]);

    // Exactly one must succeed (201) and one must fail (400) due to coupon conflict
    const successCount = [res1.status, res2.status].filter(s => s === 201).length;
    const failCount = [res1.status, res2.status].filter(s => s === 400).length;

    expect(successCount).toBe(1);
    expect(failCount).toBe(1);

    // Verify coupon is fully redeemed
    const coupon = await prisma.coupon.findUnique({ where: { code: 'SAVE50' } });
    expect(coupon.usesRemaining).toBe(0);
    expect(coupon.status).toBe('REDEEMED');
  });

  test('4. Coupon preview and discount calculation endpoint', async () => {
    // Create a 20% discount coupon
    await prisma.coupon.create({
      data: { code: 'PROMO20', discountPercent: 20, usesRemaining: 5, status: 'AVAILABLE' }
    });

    const res = await request(app)
      .post('/api/cart/apply-coupon')
      .send({ cartId: testCartId, couponCode: 'PROMO20' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subtotalCents).toBe(10000); // 2 * 5000
    expect(res.body.data.discountCents).toBe(2000);  // 20% of 10000
    expect(res.body.data.totalCents).toBe(8000);     // 10000 - 2000
  });
});