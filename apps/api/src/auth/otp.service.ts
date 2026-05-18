import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { RedisService } from '../redis/redis.service';

const PREFIX = 'stockai:otp:verify';
const ATTEMPTS_PREFIX = 'stockai:otp:attempts';
const RESEND_PREFIX = 'stockai:otp:resend';

@Injectable()
export class OtpService {
  constructor(
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  private get ttlSeconds(): number {
    const minutes =
      this.config.get<number>('OTP_EXPIRY_MINUTES') ??
      this.config.get<number>('OTP_EXPIRES_MINUTES') ??
      10;

    return minutes * 60;
  }

  private get resendCooldownSeconds(): number {
    return this.config.get<number>('OTP_RESEND_COOLDOWN_SECONDS', 60) ?? 60;
  }

  private get maxAttempts(): number {
    return this.config.get<number>('OTP_MAX_ATTEMPTS', 5) ?? 5;
  }

  async issueEmailVerificationOtp(email: string, userId: string): Promise<string> {
    const normalized = email.toLowerCase();
    await this.assertResendAllowed(normalized);

    const otp = randomInt(100000, 1000000).toString();
    const hash = await bcrypt.hash(otp, 10);
    const client = this.redis.getClient();

    const payload = JSON.stringify({ hash, userId });
    await client.setEx(`${PREFIX}:${normalized}`, this.ttlSeconds, payload);
    await client.setEx(`${ATTEMPTS_PREFIX}:${normalized}`, this.ttlSeconds, '0');
    await client.setEx(
      `${RESEND_PREFIX}:${normalized}`,
      this.resendCooldownSeconds,
      '1',
    );

    return otp;
  }

  async verifyEmailOtp(email: string, otp: string): Promise<string> {
    const normalized = email.toLowerCase();
    const client = this.redis.getClient();
    const key = `${PREFIX}:${normalized}`;
    const raw = await client.get(key);

    if (!raw) {
      throw new BadRequestException('OTP expired or not found. Request a new code.');
    }

    const attemptsKey = `${ATTEMPTS_PREFIX}:${normalized}`;
    const attempts = parseInt((await client.get(attemptsKey)) ?? '0', 10);
    if (attempts >= this.maxAttempts) {
      await client.del(key);
      throw new BadRequestException('Too many failed attempts. Request a new OTP.');
    }

    const { hash, userId } = JSON.parse(raw) as { hash: string; userId: string };
    const valid = await bcrypt.compare(otp, hash);

    if (!valid) {
      await client.incr(attemptsKey);
      throw new BadRequestException('Invalid OTP code');
    }

    await client.del(key);
    await client.del(attemptsKey);
    await client.del(`${RESEND_PREFIX}:${normalized}`);

    return userId;
  }

  async clearEmailVerificationState(email: string): Promise<void> {
    const normalized = email.toLowerCase();
    const client = this.redis.getClient();

    await Promise.all([
      client.del(`${PREFIX}:${normalized}`),
      client.del(`${ATTEMPTS_PREFIX}:${normalized}`),
      client.del(`${RESEND_PREFIX}:${normalized}`),
    ]);
  }

  async getResendCooldownRemaining(email: string): Promise<number> {
    const normalized = email.toLowerCase();
    const ttl = await this.redis.getClient().ttl(`${RESEND_PREFIX}:${normalized}`);
    return ttl > 0 ? ttl : 0;
  }

  private async assertResendAllowed(email: string): Promise<void> {
    const remaining = await this.getResendCooldownRemaining(email);
    if (remaining > 0) {
      throw new HttpException(
        `Please wait ${remaining} seconds before requesting another OTP`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
