import { Module } from '@nestjs/common';
import { MarketGateway } from './market.gateway';
import { MarketSimulatorService } from './market-simulator.service';
import { StocksModule } from '../stocks/stocks.module';

@Module({
  imports: [StocksModule],
  providers: [MarketGateway, MarketSimulatorService],
  exports: [MarketGateway],
})
export class MarketModule {}
