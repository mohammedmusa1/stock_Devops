import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { TradingService } from './trading.service';
import { PlaceOrderDto } from './dto/trading.dto';

@Controller('trading')
@UseGuards(AuthGuard('jwt'))
export class TradingController {
  constructor(private trading: TradingService) {}

  @Post(':symbol/order')
  async place(
    @Req() req: Request & { user: { id: string } },
    @Param('symbol') symbol: string,
    @Body() dto: PlaceOrderDto,
  ) {
    const data = await this.trading.placeOrder(req.user.id, symbol, dto);
    return { success: true, data };
  }

  @Get('orders')
  async orders(
    @Req() req: Request & { user: { id: string } },
    @Query('page') page?: string,
  ) {
    const result = await this.trading.getOrders(req.user.id, Number(page) || 1);
    return { success: true, ...result };
  }
}
