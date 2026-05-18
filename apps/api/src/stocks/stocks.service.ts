import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StocksService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.StockWhereInput = {
      isActive: true,
      ...(search
        ? {
            OR: [
              { symbol: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [stocks, total] = await Promise.all([
      this.prisma.stock.findMany({ where, skip, take: limit, orderBy: { symbol: 'asc' } }),
      this.prisma.stock.count({ where }),
    ]);

    return {
      data: stocks.map((s) => this.formatStock(s)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBySymbol(symbol: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!stock) throw new NotFoundException('Stock not found');
    return this.formatStock(stock);
  }

  formatStock(stock: {
    id: string;
    symbol: string;
    name: string;
    exchange: string;
    sector: string | null;
    currentPrice: Prisma.Decimal;
    previousClose: Prisma.Decimal;
    dayHigh: Prisma.Decimal;
    dayLow: Prisma.Decimal;
    volume: bigint;
    marketCap: Prisma.Decimal | null;
    updatedAt: Date;
  }) {
    const price = Number(stock.currentPrice);
    const prev = Number(stock.previousClose);
    const change = price - prev;
    const changePercent = prev ? (change / prev) * 100 : 0;

    return {
      ...stock,
      volume: stock.volume.toString(),
      currentPrice: price,
      previousClose: prev,
      dayHigh: Number(stock.dayHigh),
      dayLow: Number(stock.dayLow),
      marketCap: stock.marketCap ? Number(stock.marketCap) : null,
      change,
      changePercent,
    };
  }
}
