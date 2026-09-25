import type { RequestHandler } from 'express';
import { verifyFidelSignature, type FidelConfig } from '../providers/fidel.js';

export function authenticateFidel(config: FidelConfig): RequestHandler {
  return (req, res, next) => {
    // Duplicate header values are ambiguous: reject instead of relying on proxy behavior.
    const count = (header: string) => req.rawHeaders.filter((value, i) => i % 2 === 0 && value.toLowerCase() === header).length;
    if (!Buffer.isBuffer(req.body) || count('x-fidel-signature') !== 1 || count('x-fidel-timestamp') !== 1 ||
      !verifyFidelSignature(req.body, req.get('x-fidel-signature'), req.get('x-fidel-timestamp'), config)) {
      res.status(401).json({ error: 'invalid_signature' });
      return;
    }
    next();
  };
}
