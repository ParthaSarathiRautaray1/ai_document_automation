import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  listDocuments,
  getDocument,
  generateDocument,
  updateDocument,
  regenerateDocument,
  deleteDocument,
  downloadDocumentPdf,
} from '@/features/documents/documents.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listDocuments', () => {
  it('unwraps documents + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: { data: { documents: [{ id: 'd1' }] }, meta: { page: 1, limit: 20, total: 1, pages: 1 } },
    });
    const result = await listDocuments({ page: 1, q: '', status: undefined });
    expect(api.get).toHaveBeenCalledWith('/documents', { params: { page: 1 } });
    expect(result).toEqual({ documents: [{ id: 'd1' }], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
  });
});

describe('getDocument', () => {
  it('unwraps a single document', async () => {
    api.get.mockResolvedValue({ data: { data: { document: { id: 'd1', title: 'Invoice' } } } });
    const document = await getDocument('d1');
    expect(api.get).toHaveBeenCalledWith('/documents/d1');
    expect(document).toEqual({ id: 'd1', title: 'Invoice' });
  });
});

describe('generateDocument', () => {
  it('POSTs to /generate and returns the created document', async () => {
    api.post.mockResolvedValue({ data: { data: { document: { id: 'd1', title: 'Invoice' } } } });
    const document = await generateDocument({ templateId: 't1', values: { name: 'Ada' } });
    expect(api.post).toHaveBeenCalledWith('/documents/generate', { templateId: 't1', values: { name: 'Ada' } });
    expect(document).toEqual({ id: 'd1', title: 'Invoice' });
  });
});

describe('updateDocument', () => {
  it('PATCHes by id', async () => {
    api.patch.mockResolvedValue({ data: { data: { document: { id: 'd1', status: 'final' } } } });
    const document = await updateDocument('d1', { status: 'final' });
    expect(api.patch).toHaveBeenCalledWith('/documents/d1', { status: 'final' });
    expect(document).toEqual({ id: 'd1', status: 'final' });
  });
});

describe('regenerateDocument', () => {
  it('POSTs values to /regenerate and unwraps the document', async () => {
    api.post.mockResolvedValue({ data: { data: { document: { id: 'd1', content: 'Hi Grace' } } } });
    const document = await regenerateDocument('d1', { name: 'Grace' });
    expect(api.post).toHaveBeenCalledWith('/documents/d1/regenerate', { values: { name: 'Grace' } });
    expect(document).toEqual({ id: 'd1', content: 'Hi Grace' });
  });
});

describe('deleteDocument', () => {
  it('DELETEs by id', async () => {
    api.delete.mockResolvedValue({ data: { success: true } });
    await deleteDocument('d1');
    expect(api.delete).toHaveBeenCalledWith('/documents/d1');
  });
});

describe('downloadDocumentPdf', () => {
  // These tests run in the node environment (no DOM), so the few browser globals
  // the download uses are stubbed and restored around each case.
  let anchor;
  let originals;

  beforeEach(() => {
    anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    originals = { document: global.document, createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
    global.document = {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    };
    URL.createObjectURL = vi.fn(() => 'blob:pdf');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    global.document = originals.document;
    URL.createObjectURL = originals.createObjectURL;
    URL.revokeObjectURL = originals.revokeObjectURL;
  });

  it('requests the PDF as a blob and triggers a download with the server filename', async () => {
    api.get.mockResolvedValue({
      data: { type: 'application/pdf' },
      headers: { 'content-disposition': 'attachment; filename="march-invoice.pdf"' },
    });

    const filename = await downloadDocumentPdf('d1');

    expect(api.get).toHaveBeenCalledWith('/documents/d1/pdf', { responseType: 'blob' });
    expect(filename).toBe('march-invoice.pdf');
    expect(anchor.download).toBe('march-invoice.pdf');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf');
  });

  it('falls back to a default filename when no Content-Disposition is present', async () => {
    api.get.mockResolvedValue({ data: {}, headers: {} });
    const filename = await downloadDocumentPdf('d9');
    expect(filename).toBe('document-d9.pdf');
    expect(anchor.download).toBe('document-d9.pdf');
  });
});
