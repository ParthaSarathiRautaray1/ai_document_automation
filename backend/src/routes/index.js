/**
 * Root API router. Feature routers are mounted here as modules are built.
 */
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from '../features/auth/auth.routes.js';
import userRoutes from '../features/users/user.routes.js';
import organizationRoutes from '../features/organizations/organization.routes.js';
import customerRoutes from '../features/customers/customer.routes.js';
import productRoutes from '../features/products/product.routes.js';
import templateRoutes from '../features/templates/template.routes.js';
import documentRoutes from '../features/documents/document.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/organizations', organizationRoutes);
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/templates', templateRoutes);
router.use('/documents', documentRoutes);

export default router;
