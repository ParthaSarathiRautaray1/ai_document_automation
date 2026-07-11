import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance so we assert on request shape without a network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplate,
} from '@/features/templates/templates.api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listTemplates', () => {
  it('unwraps templates + meta and strips empty params', async () => {
    api.get.mockResolvedValue({
      data: { data: { templates: [{ id: 't1' }] }, meta: { page: 1, limit: 20, total: 1, pages: 1 } },
    });
    const result = await listTemplates({ page: 1, q: '', type: undefined });
    expect(api.get).toHaveBeenCalledWith('/templates', { params: { page: 1 } });
    expect(result).toEqual({ templates: [{ id: 't1' }], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
  });
});

describe('getTemplate', () => {
  it('unwraps a single template', async () => {
    api.get.mockResolvedValue({ data: { data: { template: { id: 't1', name: 'Letter' } } } });
    const template = await getTemplate('t1');
    expect(api.get).toHaveBeenCalledWith('/templates/t1');
    expect(template).toEqual({ id: 't1', name: 'Letter' });
  });
});

describe('createTemplate', () => {
  it('POSTs and returns the created template', async () => {
    api.post.mockResolvedValue({ data: { data: { template: { id: 't1', name: 'Letter' } } } });
    const template = await createTemplate({ name: 'Letter', content: 'x' });
    expect(api.post).toHaveBeenCalledWith('/templates', { name: 'Letter', content: 'x' });
    expect(template).toEqual({ id: 't1', name: 'Letter' });
  });
});

describe('updateTemplate', () => {
  it('PATCHes by id', async () => {
    api.patch.mockResolvedValue({ data: { data: { template: { id: 't1', status: 'active' } } } });
    const template = await updateTemplate('t1', { status: 'active' });
    expect(api.patch).toHaveBeenCalledWith('/templates/t1', { status: 'active' });
    expect(template).toEqual({ id: 't1', status: 'active' });
  });
});

describe('deleteTemplate', () => {
  it('DELETEs by id', async () => {
    api.delete.mockResolvedValue({ data: { success: true } });
    await deleteTemplate('t1');
    expect(api.delete).toHaveBeenCalledWith('/templates/t1');
  });
});

describe('renderTemplate', () => {
  it('POSTs values and unwraps the render result', async () => {
    api.post.mockResolvedValue({
      data: { data: { render: { content: 'Hi Ada', missingRequired: [] } } },
    });
    const render = await renderTemplate('t1', { name: 'Ada' });
    expect(api.post).toHaveBeenCalledWith('/templates/t1/render', { values: { name: 'Ada' } });
    expect(render).toEqual({ content: 'Hi Ada', missingRequired: [] });
  });
});
