const QUEUE_KEY = 'alitheia:jobs';

let redis: any = null;
const inMemoryQueue: string[] = [];

export async function getRedis(): Promise<any> {
  if (!redis) {
    try {
      const ioredisModule: any = await import('ioredis');
      const RedisCtor = ioredisModule.default || ioredisModule;
      redis = new RedisCtor(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      redis.on('error', (err: any) => {
        console.warn('[Redis] Connection notice:', err?.message || String(err));
      });
    } catch {
      redis = null;
    }
  }
  return redis;
}

export async function enqueueCheck(checkId: string): Promise<void> {
  try {
    const client = await getRedis();
    if (client) {
      await client.lpush(QUEUE_KEY, checkId);
      return;
    }
  } catch {
    // Abaikan jika Redis offline dan gunakan antrean memori
  }
  inMemoryQueue.push(checkId);
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
