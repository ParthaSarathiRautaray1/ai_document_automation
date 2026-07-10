/**
 * Root API router. Feature routers are mounted here as modules are built.
 */
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from '../features/auth/auth.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);

// Future mounts (built in subsequent tasks/modules):
// router.use('/users', userRoutes);

export default router;
