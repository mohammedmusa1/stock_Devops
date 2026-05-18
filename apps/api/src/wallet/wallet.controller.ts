import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/wallet.dto';

@Controller('wallet')
@UseGuards(AuthGuard('jwt'))
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get()
  async get(@Req() req: Request & { user: { id: string } }) {
    const data = await this.wallet.getWallet(req.user.id);
    return { success: true, data };
  }

  @Post('deposit')
  async deposit(@Req() req: Request & { user: { id: string } }, @Body() dto: DepositDto) {
    const data = await this.wallet.deposit(req.user.id, dto);
    return { success: true, data };
  }

  @Get('ledger')
  async ledger(
    @Req() req: Request & { user: { id: string } },
    @Query('page') page?: string,
  ) {
    const result = await this.wallet.getLedger(req.user.id, Number(page) || 1);
    return { success: true, ...result };
  }
}
