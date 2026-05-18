import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: RedisClientType;

  constructor(private config: ConfigService) {
    this.client = createClient({
      url: this.config.get<string>('REDIS_URL', 'redis://localhost:6379'),
    });
    this.client.connect().catch(console.error);
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) await this.client.quit();
  }
}
