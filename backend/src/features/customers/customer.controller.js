/**
 * Customer controller — thin HTTP glue over the customer service.
 */
import * as customerService from './customer.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { customers, meta } = await customerService.listCustomers(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { customers }, 'Customers retrieved', meta);
});

export const getById = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { customer }, 'Customer retrieved');
});

export const create = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.user, req.body);
  ApiResponse.send(res, HTTP_STATUS.CREATED, { customer }, 'Customer created');
});

export const update = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.user, req.params.id, req.body);
  ApiResponse.send(res, HTTP_STATUS.OK, { customer }, 'Customer updated');
});

export const remove = asyncHandler(async (req, res) => {
  await customerService.deleteCustomer(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, null, 'Customer deleted');
});

// --- Contacts ---------------------------------------------------------------

export const addContact = asyncHandler(async (req, res) => {
  const customer = await customerService.addContact(req.user, req.params.id, req.body);
  ApiResponse.send(res, HTTP_STATUS.CREATED, { customer }, 'Contact added');
});

export const updateContact = asyncHandler(async (req, res) => {
  const customer = await customerService.updateContact(
    req.user,
    req.params.id,
    req.params.contactId,
    req.body
  );
  ApiResponse.send(res, HTTP_STATUS.OK, { customer }, 'Contact updated');
});

export const removeContact = asyncHandler(async (req, res) => {
  const customer = await customerService.removeContact(req.user, req.params.id, req.params.contactId);
  ApiResponse.send(res, HTTP_STATUS.OK, { customer }, 'Contact removed');
});

// --- Addresses --------------------------------------------------------------

export const addAddress = asyncHandler(async (req, res) => {
  const customer = await customerService.addAddress(req.user, req.params.id, req.body);
  ApiResponse.send(res, HTTP_STATUS.CREATED, { customer }, 'Address added');
});

export const updateAddress = asyncHandler(async (req, res) => {
  const customer = await customerService.updateAddress(
    req.user,
    req.params.id,
    req.params.addressId,
    req.body
  );
  ApiResponse.send(res, HTTP_STATUS.OK, { customer }, 'Address updated');
});

export const removeAddress = asyncHandler(async (req, res) => {
  const customer = await customerService.removeAddress(req.user, req.params.id, req.params.addressId);
  ApiResponse.send(res, HTTP_STATUS.OK, { customer }, 'Address removed');
});
