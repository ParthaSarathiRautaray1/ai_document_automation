/**
 * Document controller — thin HTTP glue over the document service.
 */
import * as documentService from './document.service.js';
import { exportDocumentPdf } from './pdf.service.js';
import { sendDocument } from '../emails/email.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const list = asyncHandler(async (req, res) => {
  const { documents, meta } = await documentService.listDocuments(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { documents }, 'Documents retrieved', meta);
});

export const getById = asyncHandler(async (req, res) => {
  const document = await documentService.getDocumentById(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, { document }, 'Document retrieved');
});

export const generate = asyncHandler(async (req, res) => {
  const document = await documentService.generateDocument(req.user, req.body);
  ApiResponse.send(res, HTTP_STATUS.CREATED, { document }, 'Document generated');
});

export const regenerate = asyncHandler(async (req, res) => {
  const document = await documentService.regenerateDocument(req.user, req.params.id, req.body.values);
  ApiResponse.send(res, HTTP_STATUS.OK, { document }, 'Document regenerated');
});

export const update = asyncHandler(async (req, res) => {
  const document = await documentService.updateDocument(req.user, req.params.id, req.body);
  ApiResponse.send(res, HTTP_STATUS.OK, { document }, 'Document updated');
});

export const exportPdf = asyncHandler(async (req, res) => {
  const { filename, buffer } = await exportDocumentPdf(req.user, req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.status(HTTP_STATUS.OK).send(buffer);
});

export const send = asyncHandler(async (req, res) => {
  const email = await sendDocument(req.user, req.params.id, req.body);
  ApiResponse.send(res, HTTP_STATUS.CREATED, { email }, 'Document delivery queued');
});

export const remove = asyncHandler(async (req, res) => {
  await documentService.deleteDocument(req.user, req.params.id);
  ApiResponse.send(res, HTTP_STATUS.OK, null, 'Document deleted');
});
