import { Controller, Get, Param, Query } from '@nestjs/common';
import { StocksService } from './stocks.service';

@Controller('stocks')
export class StocksController {
  constructor(private stocks: StocksService) {}

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.stocks.findAll(
      search,
      Math.max(1, Number(page) || 1),
      Math.min(50, Number(limit) || 20),
    );
    return { success: true, ...result };
  }

  @Get(':symbol')
  async get(@Param('symbol') symbol: string) {
    const data = await this.stocks.findBySymbol(symbol);
    return { success: true, data };
  }
}
