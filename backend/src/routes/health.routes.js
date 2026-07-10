/**
 * Health & readiness endpoints. Used by load balancers, uptime monitors, and
 * deployment smoke tests. `/health` is liveness; `/ready` reports DB status.
 */
import { Router } from 'express';
import mongoose from 'mongoose';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = Router();

router.get('/health', (_req, res) => {
  ApiResponse.send(res, HTTP_STATUS.OK, { status: 'ok', uptime: process.uptime() }, 'Service is healthy');
});

router.get('/ready', (_req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  const ready = dbState === 1;
  ApiResponse.send(
    res,
    ready ? HTTP_STATUS.OK : HTTP_STATUS.INTERNAL_SERVER_ERROR,
    { database: ready ? 'connected' : 'unavailable' },
    ready ? 'Service is ready' : 'Service is not ready'
  );
});

export default router;
