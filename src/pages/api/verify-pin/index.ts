import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

// Simple in-memory rate limiting for Next.js API Routes
type RateLimitStore = {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
};

const rateLimitStore: RateLimitStore = {};
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 5; // 5 requests per window

const isRateLimited = (ip: string): boolean => {
  const now = Date.now();
  
  // Clean up expired entries
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
  
  // Check if IP exists in store
  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    };
    return false;
  }
  
  // Check if limit exceeded
  if (rateLimitStore[ip].count >= MAX_REQUESTS) {
    return true;
  }
  
  // Increment counter
  rateLimitStore[ip].count += 1;
  return false;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client IP
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const clientIp = Array.isArray(ip) ? ip[0] : ip;
  
  // Check rate limit
  if (isRateLimited(clientIp.toString())) {
    return res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes before trying again.' });
  }

  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  // Get the correct PIN from environment variables
  const correctPin = process.env.PIN_LOCK;

  if (!correctPin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify the PIN
  if (pin === correctPin) {
    // Generate a token
    const token = uuidv4();
    
    // Set expiration time to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    return res.status(200).json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  } else {
    return res.status(401).json({ error: 'Invalid PIN' });
  }
}
