/**
 * Organization service (Module 3). Pure business logic (no req/res).
 *
 * Task 2 introduces creation (self-serve at registration) and the slug
 * collision handling the model deliberately leaves to the service.
 */
import Organization, { slugify } from './organization.model.js';
import ApiError from '../../utils/ApiError.js';

/**
 * Produce a slug that does not collide with an existing organization. Starts
 * from the base slug of `name`; on collision, appends `-2`, `-3`, … The unique
 * index remains the final backstop against a race between check and insert.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function generateUniqueSlug(name) {
  const base = (slugify(name) || `org-${Date.now().toString(36)}`).slice(0, 50);
  let candidate = base;
  let n = 1;
  // Bounded loop: extremely unlikely to iterate more than a handful of times.
  while (await Organization.exists({ slug: candidate })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/**
 * Create an organization owned by the given user, assigning a unique slug.
 * @param {{ name: string, ownerId: import('mongoose').Types.ObjectId | string }} input
 * @returns {Promise<import('mongoose').Document>}
 */
export async function createForOwner({ name, ownerId }) {
  const slug = await generateUniqueSlug(name);
  return Organization.create({ name, slug, owner: ownerId });
}

/**
 * Return an organization by id as a plain JSON object, or null if the id is
 * empty / the org no longer exists.
 * @param {import('mongoose').Types.ObjectId | string | null} id
 * @returns {Promise<object | null>}
 */
export async function getPublicById(id) {
  if (!id) return null;
  const org = await Organization.findById(id);
  return org ? org.toJSON() : null;
}

/**
 * Load the organization document a user belongs to, or throw 404. Shared by the
 * read/update handlers so both enforce "you can only touch your own org".
 * @param {{ organization: import('mongoose').Types.ObjectId | null }} user
 * @returns {Promise<import('mongoose').Document>}
 */
async function loadUserOrganization(user) {
  if (!user.organization) {
    throw ApiError.notFound('You do not belong to an organization', {
      code: 'NO_ORGANIZATION',
    });
  }
  const org = await Organization.findById(user.organization);
  if (!org) {
    throw ApiError.notFound('Organization not found', { code: 'ORG_NOT_FOUND' });
  }
  return org;
}

/**
 * The caller's own organization as plain JSON.
 * @param {object} user
 * @returns {Promise<object>}
 */
export async function getForUser(user) {
  const org = await loadUserOrganization(user);
  return org.toJSON();
}

/**
 * Update the caller's own organization. Only `name`, `billingEmail`, and
 * `settings.timezone` are mutable here; the `slug` intentionally stays stable on
 * rename (it is an identity handle, changing it would break existing references).
 * @param {object} user
 * @param {{ name?: string, billingEmail?: string|null, settings?: { timezone?: string } }} updates
 * @returns {Promise<object>}
 */
export async function updateForUser(user, updates) {
  const org = await loadUserOrganization(user);

  if (updates.name !== undefined) org.name = updates.name;
  if (updates.billingEmail !== undefined) org.billingEmail = updates.billingEmail;
  if (updates.settings?.timezone !== undefined) org.settings.timezone = updates.settings.timezone;

  await org.save();
  return org.toJSON();
}
