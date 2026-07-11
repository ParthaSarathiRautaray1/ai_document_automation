/**
 * Generated document API calls (Module 7). Each returns the unwrapped payload
 * from the backend's `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET    /documents               → { documents } + meta
 *  - POST   /documents/generate      → { document }
 *  - GET    /documents/:id            → { document }
 *  - PATCH  /documents/:id            → { document }
 *  - POST   /documents/:id/regenerate → { document }
 *  - DELETE /documents/:id            → null
 *  - GET    /documents/:id/pdf        → application/pdf (binary)
 *  - POST   /documents/:id/send       → { email }
 */
import { api } from '@/lib/api';

/** Parse the download filename from a Content-Disposition header, or fall back. */
function filenameFromDisposition(disposition, fallback) {
  const match = /filename="?([^"]+)"?/i.exec(disposition || '');
  return match ? match[1] : fallback;
}

/** Drop empty/undefined params so the strict backend query schema stays happy. */
function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

export async function listDocuments(params = {}) {
  const { data } = await api.get('/documents', { params: cleanParams(params) });
  return { documents: data.data.documents, meta: data.meta };
}

export async function getDocument(id) {
  const { data } = await api.get(`/documents/${id}`);
  return data.data.document;
}

export async function generateDocument(payload) {
  const { data } = await api.post('/documents/generate', payload);
  return data.data.document;
}

export async function updateDocument(id, payload) {
  const { data } = await api.patch(`/documents/${id}`, payload);
  return data.data.document;
}

export async function regenerateDocument(id, values = {}) {
  const { data } = await api.post(`/documents/${id}/regenerate`, { values });
  return data.data.document;
}

export async function deleteDocument(id) {
  const { data } = await api.delete(`/documents/${id}`);
  return data;
}

/** Deliver a document by email; returns the queued email message. */
export async function sendDocument(id, payload = {}) {
  const { data } = await api.post(`/documents/${id}/send`, payload);
  return data.data.email;
}

/**
 * Download a document as a PDF: fetch the binary, then trigger a browser save.
 * Returns the filename used so callers can surface it.
 */
export async function downloadDocumentPdf(id) {
  const response = await api.get(`/documents/${id}/pdf`, { responseType: 'blob' });
  const filename = filenameFromDisposition(
    response.headers?.['content-disposition'],
    `document-${id}.pdf`
  );

  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return filename;
}
