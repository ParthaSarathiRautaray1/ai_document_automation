/**
 * DocumentVersion model (Module 12 · Task 1): defaults, required fields, the
 * changeType enum, and the (document, version) unique index.
 */
import mongoose from 'mongoose';
import DocumentVersion from '../src/features/versions/version.model.js';
import { VERSION_CHANGE_TYPE } from '../src/config/constants.js';

function base(overrides = {}) {
  return {
    organization: new mongoose.Types.ObjectId(),
    document: new mongoose.Types.ObjectId(),
    version: 1,
    content: 'body',
    ...overrides,
  };
}

describe('DocumentVersion model', () => {
  // The unique index must be built before the duplicate-version test.
  beforeAll(async () => {
    await DocumentVersion.init();
  });

  it('applies sensible defaults', async () => {
    const version = await DocumentVersion.create(base());
    expect(version.changeType).toBe(VERSION_CHANGE_TYPE.GENERATED);
    expect(version.values).toEqual({});
    expect(version.templateSnapshot).toBeNull();
    expect(version.missingRequired).toEqual([]);
    expect(version.tags).toEqual([]);
    expect(version.createdBy).toBeNull();
  });

  it('requires organization, document, and version', async () => {
    await expect(DocumentVersion.create(base({ organization: undefined }))).rejects.toThrow(/Organization/);
    await expect(DocumentVersion.create(base({ document: undefined }))).rejects.toThrow(/Document/);
    await expect(DocumentVersion.create(base({ version: undefined }))).rejects.toThrow(/Version number/);
  });

  it('rejects an unknown changeType', async () => {
    await expect(DocumentVersion.create(base({ changeType: 'teleported' }))).rejects.toThrow();
  });

  it('strips __v and exposes id in JSON', async () => {
    const version = await DocumentVersion.create(base());
    const json = version.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBe(version.id);
  });

  it('enforces one row per (document, version)', async () => {
    const document = new mongoose.Types.ObjectId();
    const org = new mongoose.Types.ObjectId();
    await DocumentVersion.create(base({ organization: org, document, version: 1 }));
    await expect(
      DocumentVersion.create(base({ organization: org, document, version: 1 }))
    ).rejects.toThrow();
    // A different version number for the same document is fine.
    await expect(
      DocumentVersion.create(base({ organization: org, document, version: 2 }))
    ).resolves.toBeDefined();
  });
});
