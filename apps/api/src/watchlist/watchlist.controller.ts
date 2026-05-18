import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { WatchlistService } from './watchlist.service';

@Controller('watchlist')
@UseGuards(AuthGuard('jwt'))
export class WatchlistController {
  constructor(private watchlist: WatchlistService) {}

  @Get()
  async list(@Req() req: Request & { user: { id: string } }) {
    const data = await this.watchlist.get(req.user.id);
    return { success: true, data };
  }

  @Post(':symbol')
  async add(@Req() req: Request & { user: { id: string } }, @Param('symbol') symbol: string) {
    const data = await this.watchlist.add(req.user.id, symbol);
    return { success: true, data };
  }

  @Delete(':symbol')
  async remove(@Req() req: Request & { user: { id: string } }, @Param('symbol') symbol: string) {
    const data = await this.watchlist.remove(req.user.id, symbol);
    return { success: true, data };
  }
}
