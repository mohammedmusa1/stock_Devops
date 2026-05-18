import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DepositDto } from './dto/wallet.dto';
import { MarketGateway } from '../market/market.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private marketGateway: MarketGateway,
    private notifications: NotificationsService,
  ) {}

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    return {
      balance: Number(wallet.balance),
      lockedBalance: Number(wallet.lockedBalance),
      available: Number(wallet.balance) - Number(wallet.lockedBalance),
      currency: wallet.currency,
      recentTransactions: wallet.transactions,
    };
  }

  async deposit(userId: string, dto: DepositDto) {
    if (dto.amount <= 0) throw new BadRequestException('Amount must be positive');

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          amount: dto.amount,
          provider: dto.provider ?? 'MANUAL',
          providerRefId: dto.referenceId,
        },
      });

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: dto.amount } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          transactionId: transaction.id,
          type: 'DEPOSIT',
          amount: dto.amount,
          balanceAfter: updated.balance,
          description: `Deposit via ${dto.provider ?? 'MANUAL'}`,
        },
      });

      return updated;
    });

    const payload = {
      balance: Number(result.balance),
      lockedBalance: Number(result.lockedBalance),
    };
    this.marketGateway.emitWalletUpdate(userId, payload);
    await this.notifications.create(
      userId,
      'Deposit successful',
      `₹${dto.amount.toLocaleString('en-IN')} added to your wallet.`,
      'wallet',
    );

    return payload;
  }

  async getLedger(userId: string, page = 1, limit = 30) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ledgerEntry.count({ where: { walletId: wallet.id } }),
    ]);

    return { data: entries, meta: { page, limit, total } };
  }
}
