import Redis from 'ioredis';

const QUEUE_KEY = 'alitheia:jobs';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
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
  try {
    const client = getRedis();
    await client.lpush(QUEUE_KEY, checkId);
  } catch (err: unknown) {
    console.warn('[Queue] Notice: Job queuing to Redis skipped (worker may be offline):', err instanceof Error ? err.message : String(err));
  }
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
