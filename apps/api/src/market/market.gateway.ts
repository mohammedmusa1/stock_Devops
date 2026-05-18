import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true },
})
export class MarketGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  afterInit() {
    console.log('Stock AI WebSocket gateway initialized');
  }

  @SubscribeMessage('subscribe:ticker')
  handleTickerSubscribe() {
    return { event: 'subscribed', channel: 'ticker' };
  }

  @SubscribeMessage('subscribe:portfolio')
  handlePortfolioSubscribe(client: { join: (room: string) => void }, payload: { userId: string }) {
    if (payload?.userId) client.join(`user:${payload.userId}`);
    return { event: 'subscribed', channel: 'portfolio' };
  }

  emitPriceUpdate(data: {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: string;
  }) {
    this.server?.emit('price:update', data);
  }

  emitTickerSnapshot(stocks: unknown[]) {
    this.server?.emit('ticker:snapshot', stocks);
  }

  emitWalletUpdate(userId: string, wallet: { balance: number; lockedBalance: number }) {
    this.server?.to(`user:${userId}`).emit('wallet:update', wallet);
    this.server?.emit('wallet:update', { userId, ...wallet });
  }

  emitPortfolioUpdate(userId: string) {
    this.server?.to(`user:${userId}`).emit('portfolio:update', { userId });
  }

  emitNotification(
    userId: string,
    notification: {
      id: string;
      title: string;
      message: string;
      type: string;
      isRead: boolean;
      createdAt: string;
    },
  ) {
    this.server?.to(`user:${userId}`).emit('notification:new', notification);
  }
}
