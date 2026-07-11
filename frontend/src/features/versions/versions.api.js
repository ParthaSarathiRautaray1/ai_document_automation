/**
 * Version-history API calls (Module 12). Versions are nested under a document.
 * Each returns the unwrapped payload from the backend's
 * `{ success, message, data, meta }` envelope.
 *
 * Backend contracts:
 *  - GET  /documents/:id/versions                     → { versions } + meta
 *  - GET  /documents/:id/versions/:versionId          → { version }
 *  - GET  /documents/:id/versions/diff?from=&to=      → { from, to, diff }
 *  - POST /documents/:id/versions/:versionId/restore  → { document }
 */
import { api, cleanParams } from '@/lib/api';

export async function listVersions(documentId, params = {}) {
  const { data } = await api.get(`/documents/${documentId}/versions`, {
    params: cleanParams(params),
  });
  return { versions: data.data.versions, meta: data.meta };
}

export async function getVersion(documentId, versionId) {
  const { data } = await api.get(`/documents/${documentId}/versions/${versionId}`);
  return data.data.version;
}

export async function diffVersions(documentId, { from, to }) {
  const { data } = await api.get(`/documents/${documentId}/versions/diff`, {
    params: { from, to },
  });
  return data.data;
}

export async function restoreVersion(documentId, versionId) {
  const { data } = await api.post(`/documents/${documentId}/versions/${versionId}/restore`);
  return data.data.document;
}
