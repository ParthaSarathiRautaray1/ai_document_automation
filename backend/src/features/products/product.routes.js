/**
 * Product & service catalog routes (Module 5).
 *
 * All routes are tenant-scoped (resolved from `req.user.organization`); there is
 * no cross-org access. Order: authenticate → authorizePermission → validate →
 * controller.
 */
import { Router } from 'express';
import * as productController from './product.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  listProductsQuerySchema,
  productIdParamSchema,
  createProductSchema,
  updateProductSchema,
} from './product.validation.js';

const router = Router();

// Every catalog route requires authentication.
router.use(authenticate);

router.get(
  '/',
  authorizePermission(PERMISSIONS.PRODUCT_READ),
  validate({ query: listProductsQuerySchema }),
  productController.list
);

router.post(
  '/',
  authorizePermission(PERMISSIONS.PRODUCT_CREATE),
  validate({ body: createProductSchema }),
  productController.create
);

router.get(
  '/:id',
  authorizePermission(PERMISSIONS.PRODUCT_READ),
  validate({ params: productIdParamSchema }),
  productController.getById
);

router.patch(
  '/:id',
  authorizePermission(PERMISSIONS.PRODUCT_UPDATE),
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  productController.update
);

router.delete(
  '/:id',
  authorizePermission(PERMISSIONS.PRODUCT_DELETE),
  validate({ params: productIdParamSchema }),
  productController.remove
);

export default router;
