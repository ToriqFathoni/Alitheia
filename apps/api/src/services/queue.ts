import Redis from 'ioredis';

const QUEUE_KEY = 'alitheia:jobs';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: false,
      enableOfflineQueue: false,
    });
    redis.on('error', (err) => {
      // Log connection error without crashing the process
      console.warn('[Redis] Connection notice:', err.message);
    });
  }
  return redis;
}

export async function enqueueCheck(checkId: string): Promise<void> {
  const client = getRedis();
  await client.lpush(QUEUE_KEY, checkId);
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      // Ignore cleanup error on shutdown
    }
    redis = null;
  }
}
