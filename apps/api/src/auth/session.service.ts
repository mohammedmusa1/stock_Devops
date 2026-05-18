import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';

/** Tracks active refresh-token sessions in Redis for revocation & audit */
@Injectable()
export class SessionService {
  constructor(
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  private sessionTtlSeconds(): number {
    const expires = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    if (expires.endsWith('d')) return parseInt(expires, 10) * 86400;
    if (expires.endsWith('h')) return parseInt(expires, 10) * 3600;
    return 7 * 86400;
  }

  async createSession(userId: string, refreshToken: string): Promise<string> {
    const sessionId = randomBytes(16).toString('hex');
    const client = this.redis.getClient();
    await client.setEx(
      `stockai:session:${sessionId}`,
      this.sessionTtlSeconds(),
      JSON.stringify({ userId, refreshToken }),
    );
    await client.sAdd(`stockai:user:sessions:${userId}`, sessionId);
    await client.expire(`stockai:user:sessions:${userId}`, this.sessionTtlSeconds());
    return sessionId;
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    const client = this.redis.getClient();
    const keys = await client.keys('stockai:session:*');
    for (const key of keys) {
      const raw = await client.get(key);
      if (!raw) continue;
      const data = JSON.parse(raw) as { refreshToken: string; userId: string };
      if (data.refreshToken === refreshToken) {
        await client.del(key);
        await client.sRem(`stockai:user:sessions:${data.userId}`, key.replace('stockai:session:', ''));
      }
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const client = this.redis.getClient();
    const sessionIds = await client.sMembers(`stockai:user:sessions:${userId}`);
    if (sessionIds.length) {
      await client.del(sessionIds.map((id) => `stockai:session:${id}`));
    }
    await client.del(`stockai:user:sessions:${userId}`);
  }
}
