/**
 * Customer routes (Module 4).
 *
 * All routes are tenant-scoped (resolved from `req.user.organization`); there is
 * no cross-org access. Contacts and addresses are managed as sub-resources of a
 * customer. Order: authenticate → authorizePermission → validate → controller.
 */
import { Router } from 'express';
import * as customerController from './customer.controller.js';
import validate from '../../middlewares/validate.js';
import authenticate from '../../middlewares/authenticate.js';
import { authorizePermission } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  listCustomersQuerySchema,
  customerIdParamSchema,
  contactParamSchema,
  addressParamSchema,
  createCustomerSchema,
  updateCustomerSchema,
  createContactSchema,
  updateContactSchema,
  createAddressSchema,
  updateAddressSchema,
} from './customer.validation.js';

const router = Router();

// Every customer route requires authentication.
router.use(authenticate);

router.get(
  '/',
  authorizePermission(PERMISSIONS.CUSTOMER_READ),
  validate({ query: listCustomersQuerySchema }),
  customerController.list
);

router.post(
  '/',
  authorizePermission(PERMISSIONS.CUSTOMER_CREATE),
  validate({ body: createCustomerSchema }),
  customerController.create
);

router.get(
  '/:id',
  authorizePermission(PERMISSIONS.CUSTOMER_READ),
  validate({ params: customerIdParamSchema }),
  customerController.getById
);

router.patch(
  '/:id',
  authorizePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ params: customerIdParamSchema, body: updateCustomerSchema }),
  customerController.update
);

router.delete(
  '/:id',
  authorizePermission(PERMISSIONS.CUSTOMER_DELETE),
  validate({ params: customerIdParamSchema }),
  customerController.remove
);

// --- Contacts (sub-resource; edit permission) -------------------------------

router.post(
  '/:id/contacts',
  authorizePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ params: customerIdParamSchema, body: createContactSchema }),
  customerController.addContact
);

router.patch(
  '/:id/contacts/:contactId',
  authorizePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ params: contactParamSchema, body: updateContactSchema }),
  customerController.updateContact
);

router.delete(
  '/:id/contacts/:contactId',
  authorizePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ params: contactParamSchema }),
  customerController.removeContact
);

// --- Addresses (sub-resource; edit permission) ------------------------------

router.post(
  '/:id/addresses',
  authorizePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ params: customerIdParamSchema, body: createAddressSchema }),
  customerController.addAddress
);

router.patch(
  '/:id/addresses/:addressId',
  authorizePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ params: addressParamSchema, body: updateAddressSchema }),
  customerController.updateAddress
);

router.delete(
  '/:id/addresses/:addressId',
  authorizePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate({ params: addressParamSchema }),
  customerController.removeAddress
);

export default router;
