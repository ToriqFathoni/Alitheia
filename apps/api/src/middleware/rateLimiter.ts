import type { Request, Response, NextFunction, RequestHandler } from 'express';

interface RateLimitConfig {
  windowMs: number;
  limit: number;
  message: { error: string };
}

function createMemoryRateLimiter(config: RateLimitConfig): RequestHandler {
  const hits = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetTime) {
      hits.set(ip, { count: 1, resetTime: now + config.windowMs });
      next();
      return;
    }

    if (entry.count >= config.limit) {
      res.status(429).json(config.message);
      return;
    }

    entry.count++;
    next();
  };
}

// 10 requests per minute per IP for POST endpoints
export const postRateLimiter: RequestHandler = createMemoryRateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  message: {
    error: 'Too many POST requests, please try again later.',
  },
});

// 60 requests per minute per IP for GET endpoints
export const getRateLimiter: RequestHandler = createMemoryRateLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message: {
    error: 'Too many GET requests, please try again later.',
  },
});

// Method-aware rate limiter middleware
export const rateLimiter: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'POST') {
    postRateLimiter(req, res, next);
    return;
  }
  if (req.method === 'GET') {
    getRateLimiter(req, res, next);
    return;
  }
  next();
};

export default rateLimiter;
