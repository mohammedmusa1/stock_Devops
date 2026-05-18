import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlaceOrderDto } from './dto/trading.dto';
import { MarketGateway } from '../market/market.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const TRADING_FEE_RATE = 0.001;

@Injectable()
export class TradingService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => MarketGateway))
    private marketGateway: MarketGateway,
    @Inject(forwardRef(() => NotificationsService))
    private notifications: NotificationsService,
  ) {}

  async placeOrder(userId: string, symbol: string, dto: PlaceOrderDto) {
    const stock = await this.prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!stock) throw new NotFoundException('Stock not found');

    const price =
      dto.type === 'LIMIT' && dto.limitPrice
        ? dto.limitPrice
        : Number(stock.currentPrice);

    if (dto.type === 'LIMIT' && !dto.limitPrice) {
      throw new BadRequestException('Limit price required for limit orders');
    }

    const totalAmount = price * dto.quantity;
    const fee = totalAmount * TRADING_FEE_RATE;

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const available = Number(wallet.balance) - Number(wallet.lockedBalance);

    if (dto.side === 'BUY' && available < totalAmount + fee) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    if (dto.side === 'SELL') {
      const holding = await this.prisma.holding.findUnique({
        where: { userId_stockId: { userId, stockId: stock.id } },
      });
      if (!holding || Number(holding.quantity) < dto.quantity) {
        throw new BadRequestException('Insufficient holdings');
      }
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          stockId: stock.id,
          side: dto.side,
          type: dto.type,
          status: 'PENDING',
          quantity: dto.quantity,
          limitPrice: dto.limitPrice,
        },
      });

      if (dto.side === 'BUY') {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { lockedBalance: { increment: totalAmount + fee } },
        });
      }

      const filled = await this.executeFill(tx, created.id, userId, stock.id, dto.side, dto.quantity, price, fee, wallet.id);

      return filled;
    });

    this.marketGateway.emitPortfolioUpdate(userId);
    this.marketGateway.emitWalletUpdate(userId, await this.getWalletSnapshot(userId));
    await this.notifications.create(
      userId,
      `Order ${dto.side === 'BUY' ? 'filled' : 'sold'}`,
      `${dto.quantity} shares of ${symbol} at market price.`,
      'trade',
    );

    return order;
  }

  private async executeFill(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string,
    stockId: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    fee: number,
    walletId: string,
  ) {
    const totalAmount = price * quantity;

    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'FILLED',
        filledPrice: price,
        filledQty: quantity,
        totalAmount,
        fee,
      },
      include: { stock: true },
    });

    if (side === 'BUY') {
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: { decrement: totalAmount + fee },
          lockedBalance: { decrement: totalAmount + fee },
        },
      });

      const existing = await tx.holding.findUnique({
        where: { userId_stockId: { userId, stockId } },
      });

      if (existing) {
        const oldQty = Number(existing.quantity);
        const newQty = oldQty + quantity;
        const avgPrice =
          (Number(existing.avgBuyPrice) * oldQty + price * quantity) / newQty;
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgBuyPrice: avgPrice },
        });
      } else {
        await tx.holding.create({
          data: { userId, stockId, quantity, avgBuyPrice: price },
        });
      }

      await tx.transaction.create({
        data: {
          walletId,
          type: 'BUY',
          status: 'COMPLETED',
          amount: totalAmount + fee,
        },
      });
    } else {
      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: totalAmount - fee } },
      });

      const holding = await tx.holding.findUnique({
        where: { userId_stockId: { userId, stockId } },
      });
      if (!holding) throw new BadRequestException('No holdings');

      const newQty = Number(holding.quantity) - quantity;
      if (newQty <= 0) {
        await tx.holding.delete({ where: { id: holding.id } });
      } else {
        await tx.holding.update({
          where: { id: holding.id },
          data: { quantity: newQty },
        });
      }

      await tx.transaction.create({
        data: {
          walletId,
          type: 'SELL',
          status: 'COMPLETED',
          amount: totalAmount - fee,
        },
      });
    }

    return order;
  }

  private async getWalletSnapshot(userId: string) {
    const w = await this.prisma.wallet.findUnique({ where: { userId } });
    return {
      balance: Number(w!.balance),
      lockedBalance: Number(w!.lockedBalance),
    };
  }

  async getOrders(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: { stock: { select: { symbol: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return { data: orders, meta: { page, limit, total } };
  }
}
