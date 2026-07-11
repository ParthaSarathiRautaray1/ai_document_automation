/**
 * Document model (Module 7 · Task 1): schema defaults, required fields, the
 * embedded template snapshot, and the JSON transform.
 */
import mongoose from 'mongoose';
import Document from '../src/features/documents/document.model.js';
import { DOCUMENT_TYPE, DOCUMENT_STATUS } from '../src/config/constants.js';

const orgId = () => new mongoose.Types.ObjectId();

describe('Document model', () => {
  it('applies sensible defaults', async () => {
    const d = await Document.create({ organization: orgId(), title: 'Invoice #1', content: 'Hi Ada' });
    expect(d.type).toBe(DOCUMENT_TYPE.OTHER);
    expect(d.status).toBe(DOCUMENT_STATUS.DRAFT);
    expect(d.template).toBeNull();
    expect(d.customer).toBeNull();
    expect(d.missingRequired).toEqual([]);
    expect(d.tags).toEqual([]);
    expect(d.values).toEqual({});
  });

  it('requires organization, title, and content', async () => {
    await expect(Document.create({ title: 'No Org', content: 'x' })).rejects.toThrow(/organization/i);
    await expect(Document.create({ organization: orgId(), content: 'x' })).rejects.toThrow(/title/i);
    await expect(Document.create({ organization: orgId(), title: 'No Body' })).rejects.toThrow(/content/i);
  });

  it('stores an embedded template snapshot (no own _id)', async () => {
    const d = await Document.create({
      organization: orgId(),
      title: 'Snap',
      content: 'Total 10',
      template: orgId(),
      templateSnapshot: {
        name: 'Invoice',
        type: DOCUMENT_TYPE.INVOICE,
        content: 'Total {{total}}',
        variables: [{ key: 'total', required: true, defaultValue: null }],
      },
    });
    expect(d.templateSnapshot.name).toBe('Invoice');
    expect(d.templateSnapshot.content).toBe('Total {{total}}');
    expect(d.templateSnapshot.variables).toHaveLength(1);
    expect(d.templateSnapshot._id).toBeUndefined();
  });

  it('rejects an unknown type or status', async () => {
    await expect(
      Document.create({ organization: orgId(), title: 'X', content: 'x', type: 'spaceship' })
    ).rejects.toThrow(/type/i);
    await expect(
      Document.create({ organization: orgId(), title: 'X', content: 'x', status: 'nope' })
    ).rejects.toThrow(/status/i);
  });

  it('preserves supplied values (mixed types) and missingRequired', async () => {
    const d = await Document.create({
      organization: orgId(),
      title: 'Vals',
      content: 'x',
      values: { name: 'Ada', count: 3, active: true },
      missingRequired: ['total'],
    });
    expect(d.values).toEqual({ name: 'Ada', count: 3, active: true });
    expect(d.missingRequired).toEqual(['total']);
  });

  it('drops __v in JSON while keeping id', async () => {
    const d = await Document.create({ organization: orgId(), title: 'Json', content: 'x' });
    const json = d.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBeDefined();
  });
});
