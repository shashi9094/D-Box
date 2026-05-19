/**
 * Rate Limiting Middleware
 * Prevents email flooding and brute force attacks
 */

const rateLimit = require('express-rate-limit');

// Global rate limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for OTP endpoints
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 OTP requests per minute
  message: 'Too many OTP requests, please wait before trying again.',
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 reset requests per minute
  message: 'Too many password reset attempts, please wait.',
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for invite sending
const inviteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 invites per minute
  message: 'Too many invites sent, please wait.',
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication attempt limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per window
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true, // Only count failed attempts
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  otpLimiter,
  passwordResetLimiter,
  inviteLimiter,
  authLimiter,
};
