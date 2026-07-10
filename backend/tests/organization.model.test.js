/**
 * Organization model (Module 3 · Task 1).
 * Slug generation, required fields, unique-slug enforcement, defaults, and the
 * toJSON shape.
 */
import mongoose from 'mongoose';
import Organization, { slugify } from '../src/features/organizations/organization.model.js';
import User from '../src/features/users/user.model.js';
import { ORG_STATUS } from '../src/config/constants.js';

async function makeOwner(email = 'owner@example.com') {
  return User.create({
    firstName: 'Owner',
    lastName: 'User',
    email,
    password: 'Sup3rSecret',
  });
}

describe('slugify()', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Acme Corp')).toBe('acme-corp');
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify('  Hello,   World!!  ')).toBe('hello-world');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Déjà')).toBe('cafe-deja');
  });

  it('drops apostrophes rather than hyphenating them', () => {
    expect(slugify("Ada's Organization")).toBe('adas-organization');
  });

  it('returns empty string when there are no alphanumerics', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('Organization model', () => {
  // Ensure the unique slug index is built before exercising duplicate-key behavior.
  beforeAll(async () => {
    await Organization.init();
  });

  it('generates a slug from the name and applies defaults', async () => {
    const owner = await makeOwner();
    const org = await Organization.create({ name: 'Acme Corp', owner: owner._id });

    expect(org.slug).toBe('acme-corp');
    expect(org.status).toBe(ORG_STATUS.ACTIVE);
    expect(org.settings.timezone).toBe('UTC');
    expect(org.owner.toString()).toBe(owner.id);
  });

  it('falls back to a generated handle when the name has no alphanumerics', async () => {
    const owner = await makeOwner();
    const org = await Organization.create({ name: '!!!', owner: owner._id });
    expect(org.slug).toMatch(/^org-/);
  });

  it('requires a name', async () => {
    const owner = await makeOwner();
    await expect(Organization.create({ owner: owner._id })).rejects.toThrow(
      mongoose.Error.ValidationError
    );
  });

  it('requires an owner', async () => {
    await expect(Organization.create({ name: 'No Owner Inc' })).rejects.toThrow(
      mongoose.Error.ValidationError
    );
  });

  it('rejects an invalid billing email', async () => {
    const owner = await makeOwner();
    await expect(
      Organization.create({ name: 'Bad Billing', owner: owner._id, billingEmail: 'not-an-email' })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('enforces a unique slug', async () => {
    const owner = await makeOwner();
    await Organization.create({ name: 'Acme', owner: owner._id, slug: 'acme' });
    // A second org with the same explicit slug violates the unique index.
    let err;
    try {
      await Organization.create({ name: 'Acme Two', owner: owner._id, slug: 'acme' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe(11000); // Mongo duplicate-key error
  });

  it('strips __v and exposes an id via toJSON', async () => {
    const owner = await makeOwner();
    const org = await Organization.create({ name: 'JSON Co', owner: owner._id });
    const json = org.toJSON();
    expect(json.id).toBe(org.id);
    expect(json.__v).toBeUndefined();
    expect(json.name).toBe('JSON Co');
  });
});
