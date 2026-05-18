import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STOCKS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Energy', price: 2850 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', price: 4100 },
  { symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT', price: 1820 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Banking', price: 1680 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Banking', price: 1120 },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking', price: 820 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', sector: 'Telecom', price: 1580 },
  { symbol: 'ITC', name: 'ITC Ltd', sector: 'FMCG', price: 465 },
  { symbol: 'WIPRO', name: 'Wipro Ltd', sector: 'IT', price: 520 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Auto', price: 980 },
];

async function main() {
  console.log('Seeding Stock AI...');

  const adminHash = await bcrypt.hash('Admin@12345', 12);
  const userHash = await bcrypt.hash('Trader@12345', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@stockforge.local' },
    update: {},
    create: {
      email: 'admin@stockforge.local',
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      wallet: { create: { balance: 0 } },
    },
  });

  const trader = await prisma.user.upsert({
    where: { email: 'trader@stockforge.local' },
    update: {},
    create: {
      email: 'trader@stockforge.local',
      passwordHash: userHash,
      firstName: 'Demo',
      lastName: 'Trader',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      wallet: { create: { balance: 0 } },
    },
  });

  for (const s of STOCKS) {
    await prisma.stock.upsert({
      where: { symbol: s.symbol },
      update: {},
      create: {
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        currentPrice: s.price,
        previousClose: s.price * 0.99,
        dayHigh: s.price * 1.02,
        dayLow: s.price * 0.98,
        volume: BigInt(1000000),
        marketCap: s.price * 1000000,
      },
    });
  }

  console.log('Seed complete:');
  console.log('  Admin:', admin.email, '/ Admin@12345');
  console.log('  Trader:', trader.email, '/ Trader@12345');
  console.log('  Stocks:', STOCKS.length, 'NSE symbols');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
