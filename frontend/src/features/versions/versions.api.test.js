import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  listVersions,
  getVersion,
  diffVersions,
  restoreVersion,
} from '@/features/versions/versions.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listVersions', () => {
  it('unwraps versions + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: { data: { versions: [{ id: 'v1', version: 1 }] }, meta: { page: 1, limit: 50, total: 1, pages: 1 } },
    });
    const result = await listVersions('d1', { limit: 50, sort: undefined });
    expect(api.get).toHaveBeenCalledWith('/documents/d1/versions', { params: { limit: 50 } });
    expect(result).toEqual({
      versions: [{ id: 'v1', version: 1 }],
      meta: { page: 1, limit: 50, total: 1, pages: 1 },
    });
  });
});

describe('getVersion', () => {
  it('unwraps a single version', async () => {
    api.get.mockResolvedValue({ data: { data: { version: { id: 'v1', version: 1 } } } });
    const version = await getVersion('d1', 'v1');
    expect(api.get).toHaveBeenCalledWith('/documents/d1/versions/v1');
    expect(version).toEqual({ id: 'v1', version: 1 });
  });
});

describe('diffVersions', () => {
  it('GETs /diff with from/to and returns the diff payload', async () => {
    const payload = { from: { id: 'v1' }, to: { id: 'v2' }, diff: { changes: [], stats: { added: 0, removed: 0, unchanged: 0 } } };
    api.get.mockResolvedValue({ data: { data: payload } });
    const result = await diffVersions('d1', { from: 'v1', to: 'v2' });
    expect(api.get).toHaveBeenCalledWith('/documents/d1/versions/diff', { params: { from: 'v1', to: 'v2' } });
    expect(result).toEqual(payload);
  });
});

describe('restoreVersion', () => {
  it('POSTs to /restore and unwraps the document', async () => {
    api.post.mockResolvedValue({ data: { data: { document: { id: 'd1', content: 'Hello Ada' } } } });
    const document = await restoreVersion('d1', 'v1');
    expect(api.post).toHaveBeenCalledWith('/documents/d1/versions/v1/restore');
    expect(document).toEqual({ id: 'd1', content: 'Hello Ada' });
  });
});
