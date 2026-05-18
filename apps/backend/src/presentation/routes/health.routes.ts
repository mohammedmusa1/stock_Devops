import { Router } from 'express';
import { prisma } from '../../infrastructure/database/prisma.js';
import { getRedis } from '../../infrastructure/cache/redis.js';

const router = Router();

router.get('/', async (_req, res) => {
  const checks: Record<string, string> = {
    api: 'ok',
    database: 'unknown',
    redis: 'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    await getRedis().ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  const healthy = Object.values(checks).every((v) => v === 'ok');

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    service: 'cloudcart-pro-api',
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
