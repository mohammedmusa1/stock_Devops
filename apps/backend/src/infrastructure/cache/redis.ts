import { createClient, type RedisClientType } from 'redis';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

let redisClient: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType> {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  redisClient = createClient({ url: env.REDIS_URL });

  redisClient.on('error', (err) => {
    logger.error('Redis client error', { err });
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected');
  });

  await redisClient.connect();
  return redisClient;
}

export function getRedis(): RedisClientType {
  if (!redisClient?.isOpen) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
}
