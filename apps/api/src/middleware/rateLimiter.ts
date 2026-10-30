import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

// 10 requests per minute per IP for POST endpoints
export const postRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many POST requests, please try again later.',
  },
});

// 60 requests per minute per IP for GET endpoints
export const getRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many GET requests, please try again later.',
  },
});

// Method-aware rate limiter middleware
export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
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
