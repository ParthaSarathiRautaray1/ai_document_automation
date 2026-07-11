/**
 * PDF export service (Module 8 — PDF Engine).
 *
 * Loads a document (tenant-scoped via the document service, so cross-org access
 * is reported as "not found"), builds a print-ready HTML page from it, and
 * renders that to a PDF buffer. Kept separate from the pure HTML builder and the
 * browser-backed renderer so each layer stays independently testable.
 */
import { getDocumentById } from './document.service.js';
import { buildDocumentHtml, pdfFilename } from './pdf.html.js';
import { renderHtmlToPdf } from './pdf.renderer.js';

/**
 * Export a document as a PDF.
 * @param {object} actor - the authenticated user (role + organization)
 * @param {string} id - document id
 * @returns {Promise<{ filename: string, buffer: Buffer }>}
 */
export async function exportDocumentPdf(actor, id) {
  const document = await getDocumentById(actor, id);
  const html = buildDocumentHtml(document);
  const buffer = await renderHtmlToPdf(html);
  return { filename: pdfFilename(document), buffer };
}
