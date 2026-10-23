import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data to prevent unique constraint errors on re-seed
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.product.deleteMany();

  // Seed 5 products individually for SQLite compatibility
  const products = [
    {
      name: 'Ergonomic Desk Mat',
      description: 'Large waterproof PU leather desk mat',
      unitPriceCents: 2499, // $24.99
      inventory: 2, // Low stock item for concurrency testing
    },
    {
      name: 'Mechanical Keyboard',
      description: 'Hot-swappable RGB wireless mechanical keyboard',
      unitPriceCents: 8999, // $89.99
      inventory: 15,
    },
    {
      name: 'Wireless Mouse',
      description: 'Ergonomic vertical wireless mouse',
      unitPriceCents: 3999, // $39.99
      inventory: 25,
    },
    {
      name: 'USB-C Hub Multiport Adapter',
      description: '7-in-1 USB-C adapter with 4K HDMI and Power Delivery',
      unitPriceCents: 4550, // $45.50
      inventory: 30,
    },
    {
      name: 'Laptop Stand',
      description: 'Adjustable aluminum ergonomic laptop riser',
      unitPriceCents: 2999, // $29.99
      inventory: 20,
    },
  ];

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log('Database seeded successfully with 5 products.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });