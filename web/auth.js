import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { Users, Sessions, Credits } from './db.js';

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export function createSession(userId) {
  const token = uuid() + uuid();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  Sessions.create.run(uuid(), userId, token, expires);
  return token;
}

export function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = Sessions.findByToken.get(token);
  if (!session) return res.status(401).json({ error: 'Session expired' });

  req.user = {
    id: session.uid,
    email: session.email,
    name: session.name,
    plan: session.plan,
    credits: session.credits,
    apiKey: session.api_key,
  };
  next();
}

// Cost per operation in credits
export const CREDIT_COSTS = {
  build: 10,
  chat_message: 2,
  fix: 5,
  add_feature: 5,
  scaffold: 3,
};

export function deductCredits(userId, amount, description) {
  const user = Users.findById.get(userId);
  if (!user || user.credits < amount) return false;
  Users.updateCredits.run(-amount, userId);
  Credits.log.run(uuid(), userId, -amount, 'usage', description);
  return true;
}

export function addCredits(userId, amount, description) {
  Users.updateCredits.run(amount, userId);
  Credits.log.run(uuid(), userId, amount, 'topup', description);
}

// Plan credit limits
export const PLAN_CREDITS = {
  free: 100,
  starter: 500,
  pro: 2000,
  enterprise: 10000,
};

export const PLAN_PRICES = {
  free: 0,
  starter: 9,
  pro: 29,
  enterprise: 99,
};
