import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketGateway } from './market.gateway';
import { StocksService } from '../stocks/stocks.service';

@Injectable()
export class MarketSimulatorService implements OnModuleInit, OnModuleDestroy {
  private interval?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private gateway: MarketGateway,
    private stocksService: StocksService,
  ) {}

  onModuleInit() {
    this.interval = setInterval(() => this.tick(), 3000);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private async tick() {
    const stocks = await this.prisma.stock.findMany({ where: { isActive: true } });
    if (!stocks.length) return;

    const updates = [];

    for (const stock of stocks) {
      const current = Number(stock.currentPrice);
      const volatility = 0.002 + Math.random() * 0.008;
      const direction = Math.random() > 0.5 ? 1 : -1;
      let newPrice = current * (1 + direction * volatility);
      newPrice = Math.max(0.01, Math.round(newPrice * 100) / 100);

      const prev = Number(stock.previousClose);
      const change = newPrice - prev;
      const changePercent = prev ? (change / prev) * 100 : 0;

      await this.prisma.stock.update({
        where: { id: stock.id },
        data: {
          currentPrice: newPrice,
          dayHigh: Math.max(Number(stock.dayHigh), newPrice),
          dayLow: Math.min(Number(stock.dayLow), newPrice),
          volume: stock.volume + BigInt(Math.floor(Math.random() * 10000)),
        },
      });

      await this.prisma.priceHistory.create({
        data: { stockId: stock.id, price: newPrice, volume: BigInt(1000) },
      });

      const formatted = {
        symbol: stock.symbol,
        price: newPrice,
        change,
        changePercent,
        volume: stock.volume.toString(),
      };

      updates.push(formatted);
      this.gateway.emitPriceUpdate(formatted);
    }

    const snapshot = await Promise.all(
      updates.map(async (u) => this.stocksService.findBySymbol(u.symbol)),
    );
    this.gateway.emitTickerSnapshot(snapshot);
  }
}
