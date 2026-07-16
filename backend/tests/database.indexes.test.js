/**
 * Index synchronization (Module 18 · Task 1).
 *
 * Production runs with `autoIndex: false`, so `syncIndexes()` at boot is the ONLY
 * thing that creates the indexes several correctness invariants depend on. This
 * asserts it builds them for real (and that the uniqueness actually bites).
 */
import mongoose from 'mongoose';
import { syncIndexes } from '../src/config/database.js';
import User from '../src/features/users/user.model.js';
import Organization from '../src/features/organizations/organization.model.js';
import Product from '../src/features/products/product.model.js';
import ApprovalRequest from '../src/features/approvals/approval.model.js';

/** Index names present on a model's collection. */
async function indexNames(Model) {
  const indexes = await Model.collection.indexes();
  return indexes.map((index) => index.name);
}

describe('syncIndexes()', () => {
  it('reports every registered model', async () => {
    const synced = await syncIndexes();
    expect(synced).toEqual(expect.arrayContaining(['User', 'Organization', 'Product']));
    expect(synced).toEqual(mongoose.modelNames());
  });

  it('builds the unique + partial indexes the data model relies on', async () => {
    await syncIndexes();

    expect(await indexNames(User)).toEqual(expect.arrayContaining(['email_1']));
    expect(await indexNames(Organization)).toEqual(expect.arrayContaining(['slug_1']));
    // Per-org unique SKU (partial) and one-pending-approval-per-document.
    expect(await indexNames(Product)).toEqual(
      expect.arrayContaining(['organization_1_sku_1'])
    );
    expect(await indexNames(ApprovalRequest)).toEqual(
      expect.arrayContaining(['document_pending_unique'])
    );
  });

  it('makes the unique constraint enforceable (duplicate email rejected)', async () => {
    await syncIndexes();

    const base = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'dupe@example.com',
      password: 'Sup3rSecret',
    };
    await User.create(base);
    await expect(User.create(base)).rejects.toMatchObject({ code: 11000 });
  });
});
