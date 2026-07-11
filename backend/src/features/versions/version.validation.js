/**
 * Zod schemas for the version-history endpoints (Module 12). These routes are
 * nested under a document (`/documents/:id/versions`), so params carry the parent
 * document `id` (and, where addressed, a `versionId`).
 */
import { z } from 'zod';
import { objectId, listQuery, sortParam } from '../../utils/validation.js';

// `/documents/:id/versions` and `/documents/:id/versions/diff` — parent id only.
export const versionListParamsSchema = z.object({ id: objectId('document id') }).strict();

// `/documents/:id/versions/:versionId[...]` — parent id + version id.
export const versionParamsSchema = z
  .object({ id: objectId('document id'), versionId: objectId('version id') })
  .strict();

export const listVersionsQuerySchema = listQuery({
  sort: sortParam(['-version', 'version', '-createdAt', 'createdAt']),
});

// Diff two versions of the document, addressed by their ids.
export const diffVersionsQuerySchema = z
  .object({ from: objectId('from version id'), to: objectId('to version id') })
  .strict();
