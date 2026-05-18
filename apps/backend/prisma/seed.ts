import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CloudCart Pro database...');

  const adminPassword = await bcrypt.hash('Admin@12345', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cloudcart.local' },
    update: {},
    create: {
      email: 'admin@cloudcart.local',
      passwordHash: adminPassword,
      firstName: 'CloudCart',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      cart: { create: {} },
    },
  });

  const category = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Electronic devices and accessories',
    },
  });

  const product = await prisma.product.upsert({
    where: { slug: 'wireless-headphones-pro' },
    update: {},
    create: {
      name: 'Wireless Headphones Pro',
      slug: 'wireless-headphones-pro',
      description: 'Premium noise-cancelling wireless headphones with 40h battery.',
      basePrice: 4999.0,
      compareAtPrice: 6999.0,
      sku: 'WH-PRO-001',
      categoryId: category.id,
      isFeatured: true,
      images: {
        create: {
          url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
          alt: 'Wireless Headphones',
          isPrimary: true,
          sortOrder: 0,
        },
      },
      inventory: {
        create: {
          quantity: 100,
          lowStockThreshold: 10,
          warehouseLocation: 'WH-MAIN-01',
        },
      },
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: 'PERCENTAGE',
      scope: 'GLOBAL',
      value: 10,
      minOrderAmount: 500,
      maxDiscount: 1000,
      usageLimit: 1000,
      isActive: true,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seed complete:');
  console.log('  Admin:', admin.email, '(password: Admin@12345)');
  console.log('  Product:', product.slug);
  console.log('  Coupon: WELCOME10 (10% off)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
