/**
 * Product controller — thin HTTP glue over the product service.
 */
import * as productService from './product.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { products, meta } = await productService.listProducts(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { products }, 'Products retrieved', meta);
});

export const getById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { product }, 'Product retrieved');
});

export const create = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.user, req.body);
  ApiResponse.send(res, HTTP_STATUS.CREATED, { product }, 'Product created');
});

export const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.user, req.params.id, req.body);
  ApiResponse.send(res, HTTP_STATUS.OK, { product }, 'Product updated');
});

export const remove = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, null, 'Product deleted');
});
