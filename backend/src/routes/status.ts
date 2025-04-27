import express, { Request, Response } from 'express';
import { getQueueStatus } from '../services/queueService';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  const status = getQueueStatus();
  res.json(status);
});

export default router; 