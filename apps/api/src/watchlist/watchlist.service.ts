import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WatchlistService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    const items = await this.prisma.watchlistItem.findMany({
      where: { userId },
      include: { stock: true },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((i) => ({
      id: i.id,
      symbol: i.stock.symbol,
      name: i.stock.name,
      currentPrice: Number(i.stock.currentPrice),
      previousClose: Number(i.stock.previousClose),
    }));
  }

  async add(userId: string, symbol: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!stock) throw new NotFoundException('Stock not found');

    const exists = await this.prisma.watchlistItem.findUnique({
      where: { userId_stockId: { userId, stockId: stock.id } },
    });
    if (exists) throw new ConflictException('Already in watchlist');

    return this.prisma.watchlistItem.create({
      data: { userId, stockId: stock.id },
    });
  }

  async remove(userId: string, symbol: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!stock) throw new NotFoundException('Stock not found');

    await this.prisma.watchlistItem.deleteMany({
      where: { userId, stockId: stock.id },
    });
    return { removed: true };
  }
}
