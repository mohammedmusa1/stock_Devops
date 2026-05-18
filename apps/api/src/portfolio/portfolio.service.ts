import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async getPortfolio(userId: string) {
    const holdings = await this.prisma.holding.findMany({
      where: { userId },
      include: { stock: true },
    });

    let totalInvested = 0;
    let totalCurrent = 0;

    const positions = holdings.map((h) => {
      const qty = Number(h.quantity);
      const avg = Number(h.avgBuyPrice);
      const current = Number(h.stock.currentPrice);
      const invested = avg * qty;
      const currentValue = current * qty;
      const pnl = currentValue - invested;
      const pnlPercent = invested ? (pnl / invested) * 100 : 0;

      totalInvested += invested;
      totalCurrent += currentValue;

      return {
        stockId: h.stockId,
        symbol: h.stock.symbol,
        name: h.stock.name,
        quantity: qty,
        avgBuyPrice: avg,
        currentPrice: current,
        invested,
        currentValue,
        pnl,
        pnlPercent,
      };
    });

    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPercent = totalInvested ? (totalPnl / totalInvested) * 100 : 0;

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });

    return {
      positions,
      summary: {
        totalInvested,
        totalCurrent,
        totalPnl,
        totalPnlPercent,
        walletBalance: wallet ? Number(wallet.balance) : 0,
        netWorth: (wallet ? Number(wallet.balance) : 0) + totalCurrent,
      },
    };
  }
}
