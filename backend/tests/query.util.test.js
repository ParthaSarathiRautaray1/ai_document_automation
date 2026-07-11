/**
 * Shared list/query utility (Module 10 · Task 1): the pure helpers
 * (escapeRegExp / orgScope / requireOrganization / searchFilter /
 * definedFilters / paginationMeta) plus the DB-backed paginate/listResources
 * against a throwaway org-scoped model.
 */
import mongoose from 'mongoose';
import {
  escapeRegExp,
  orgScope,
  requireOrganization,
  searchFilter,
  definedFilters,
  paginationMeta,
  paginate,
  listResources,
} from '../src/utils/query.js';
import { ROLES } from '../src/config/constants.js';

const orgId = () => new mongoose.Types.ObjectId();

// A minimal org-scoped model just for exercising paginate/listResources.
const Thing =
  mongoose.models.Thing ||
  mongoose.model(
    'Thing',
    new mongoose.Schema(
      {
        organization: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: String,
        status: String,
      },
      {
        timestamps: true,
        toJSON: {
          virtuals: true,
          versionKey: false,
          transform(_doc, ret) {
            ret.id = ret._id?.toString();
            delete ret._id;
            return ret;
          },
        },
      }
    )
  );

describe('query util — pure helpers', () => {
  it('escapes RegExp metacharacters', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
    expect(escapeRegExp('(x)[y]')).toBe('\\(x\\)\\[y\\]');
  });

  it('scopes non-super_admin actors to their organization', () => {
    const org = orgId();
    expect(orgScope({ role: ROLES.ADMIN, organization: org })).toEqual({ organization: org });
    expect(orgScope({ role: ROLES.MEMBER, organization: null })).toEqual({ organization: null });
  });

  it('gives super_admin a global (empty) scope', () => {
    expect(orgScope({ role: ROLES.SUPER_ADMIN, organization: orgId() })).toEqual({});
  });

  it('requireOrganization throws NO_ORGANIZATION without an org', () => {
    expect(() => requireOrganization({ organization: null }, 'manage things')).toThrow(
      /belong to an organization to manage things/i
    );
    try {
      requireOrganization({ organization: null });
    } catch (err) {
      expect(err.code).toBe('NO_ORGANIZATION');
      expect(err.statusCode).toBe(400);
    }
  });

  it('requireOrganization passes when an org is present', () => {
    expect(() => requireOrganization({ organization: orgId() })).not.toThrow();
  });

  it('builds an escaped $or search fragment across fields', () => {
    const frag = searchFilter('a.b', ['name', 'email']);
    expect(frag.$or).toHaveLength(2);
    expect(frag.$or[0].name).toBeInstanceOf(RegExp);
    expect(frag.$or[0].name.source).toBe('a\\.b');
    expect(frag.$or[0].name.flags).toContain('i');
  });

  it('returns an empty fragment when there is nothing to search', () => {
    expect(searchFilter('', ['name'])).toEqual({});
    expect(searchFilter('x', [])).toEqual({});
    expect(searchFilter(undefined, ['name'])).toEqual({});
  });

  it('drops undefined filters but keeps null/falsey values', () => {
    expect(definedFilters({ a: 1, b: undefined, c: null, d: '' })).toEqual({ a: 1, c: null, d: '' });
  });

  it('computes pagination meta with at least one page', () => {
    expect(paginationMeta({ page: 2, limit: 20, total: 45 })).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      pages: 3,
    });
    expect(paginationMeta({ page: 1, limit: 20, total: 0 }).pages).toBe(1);
  });
});

describe('query util — paginate / listResources', () => {
  const org = orgId();
  const otherOrg = orgId();
  const actor = { role: ROLES.MEMBER, organization: org };

  beforeEach(async () => {
    await Thing.create([
      { organization: org, name: 'Alpha', status: 'active' },
      { organization: org, name: 'Beta', status: 'active' },
      { organization: org, name: 'Gamma.1', status: 'inactive' },
      { organization: otherOrg, name: 'Alpha', status: 'active' }, // other tenant
    ]);
  });

  it('scopes results to the actor org and paginates with meta', async () => {
    const { docs, meta } = await paginate(Thing, {
      actor,
      page: 1,
      limit: 2,
      sort: 'name',
    });
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.name)).toEqual(['Alpha', 'Beta']);
    expect(meta).toEqual({ page: 1, limit: 2, total: 3, pages: 2 });
  });

  it('applies exact-match filters (undefined dropped)', async () => {
    const { docs, meta } = await paginate(Thing, {
      actor,
      page: 1,
      limit: 20,
      sort: 'name',
      filters: { status: 'active', name: undefined },
    });
    expect(meta.total).toBe(2);
    expect(docs.every((d) => d.status === 'active')).toBe(true);
  });

  it('applies an escaped free-text search across fields', async () => {
    const { docs, meta } = await paginate(Thing, {
      actor,
      page: 1,
      limit: 20,
      sort: 'name',
      q: 'Gamma.1',
      searchFields: ['name'],
    });
    expect(meta.total).toBe(1);
    expect(docs[0].name).toBe('Gamma.1');
  });

  it('listResources serializes the page under a named key', async () => {
    const result = await listResources(Thing, 'things', {
      actor,
      page: 1,
      limit: 20,
      sort: 'name',
    });
    expect(result.things).toHaveLength(3);
    expect(result.things[0].id).toBeDefined();
    expect(result.things[0]._id).toBeUndefined();
    expect(result.meta.total).toBe(3);
  });
});
