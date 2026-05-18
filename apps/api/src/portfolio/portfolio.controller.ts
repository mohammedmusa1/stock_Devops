import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
@UseGuards(AuthGuard('jwt'))
export class PortfolioController {
  constructor(private portfolio: PortfolioService) {}

  @Get()
  async get(@Req() req: Request & { user: { id: string } }) {
    const data = await this.portfolio.getPortfolio(req.user.id);
    return { success: true, data };
  }
}
