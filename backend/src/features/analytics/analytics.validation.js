/**
 * Zod schemas for the analytics endpoints (Module 15). The recent-activity feed
 * accepts a bounded `limit`; the summary takes no input.
 */
import { z } from 'zod';
import {
  ANALYTICS_RECENT_DEFAULT_LIMIT,
  ANALYTICS_RECENT_MAX_LIMIT,
} from '../../config/constants.js';

export const recentActivityQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(ANALYTICS_RECENT_MAX_LIMIT)
      .default(ANALYTICS_RECENT_DEFAULT_LIMIT),
  })
  .strict();
