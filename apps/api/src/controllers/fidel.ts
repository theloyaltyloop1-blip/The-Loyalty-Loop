import type { RequestHandler } from 'express';
import { parseFidelTransaction, type FidelConfig } from '../providers/fidel.js';
import type { StampRepository } from '../types/transaction.js';

export function fidelController(config: FidelConfig, repository: StampRepository): RequestHandler {
  return async (req, res) => {
    const transaction = parseFidelTransaction(req.body as Buffer, config);
    const result = await repository.credit(transaction);
    res.status(200).json({ status: 'provisional', ...result });
  };
}
