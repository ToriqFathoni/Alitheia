import Redis from 'ioredis';

const QUEUE_KEY = 'alitheia:jobs';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redis;
}

export async function enqueueCheck(checkId: string): Promise<void> {
  await getRedis().lpush(QUEUE_KEY, checkId);
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
