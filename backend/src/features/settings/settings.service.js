/**
 * Settings service (Module 17). Pure business logic (no req/res) for the two
 * settings surfaces:
 *
 *  - Account settings — the caller's OWN profile + `preferences` subdoc, plus a
 *    self-service password change. Always self-scoped (a user manages only their
 *    own account), so these are gated by authentication alone.
 *  - Organization preferences — the org-wide `settings` bag. Gated by the
 *    existing `org:read` / `org:update` permissions (admin+); everything is
 *    tenant-scoped to the caller's own organization.
 */
import User from '../users/user.model.js';
import Organization from '../organizations/organization.model.js';
import ApiError from '../../utils/ApiError.js';

/** Load the caller's own user document (with password when needed). */
async function loadSelf(actor, { withPassword = false } = {}) {
  const query = User.findById(actor.id);
  if (withPassword) query.select('+password');
  const user = await query;
  if (!user) {
    throw ApiError.notFound('User not found', { code: 'USER_NOT_FOUND' });
  }
  return user;
}

/** Load the caller's own organization document, or throw a scoped 404. */
async function loadOrganization(actor) {
  if (!actor.organization) {
    throw ApiError.notFound('You do not belong to an organization', {
      code: 'NO_ORGANIZATION',
    });
  }
  const org = await Organization.findById(actor.organization);
  if (!org) {
    throw ApiError.notFound('Organization not found', { code: 'ORG_NOT_FOUND' });
  }
  return org;
}

/** Merge the provided (already-validated) preference keys onto the user doc. */
function applyPreferences(user, prefs) {
  if (prefs.theme !== undefined) user.preferences.theme = prefs.theme;
  if (prefs.locale !== undefined) user.preferences.locale = prefs.locale;
  if (prefs.dateFormat !== undefined) user.preferences.dateFormat = prefs.dateFormat;
  if (prefs.timezone !== undefined) user.preferences.timezone = prefs.timezone;
  if (prefs.notifications?.email !== undefined) {
    user.preferences.notifications.email = prefs.notifications.email;
  }
  if (prefs.notifications?.approvals !== undefined) {
    user.preferences.notifications.approvals = prefs.notifications.approvals;
  }
}

/** Merge the provided (already-validated) settings keys onto the org doc. */
function applyOrgSettings(org, settings) {
  if (settings.timezone !== undefined) org.settings.timezone = settings.timezone;
  if (settings.dateFormat !== undefined) org.settings.dateFormat = settings.dateFormat;
  if (settings.defaultCurrency !== undefined) org.settings.defaultCurrency = settings.defaultCurrency;
  if (settings.defaultDocumentType !== undefined) {
    org.settings.defaultDocumentType = settings.defaultDocumentType;
  }
  if (settings.branding?.primaryColor !== undefined) {
    org.settings.branding.primaryColor = settings.branding.primaryColor;
  }
  if (settings.branding?.accentColor !== undefined) {
    org.settings.branding.accentColor = settings.branding.accentColor;
  }
  if (settings.notifications?.approvalEmails !== undefined) {
    org.settings.notifications.approvalEmails = settings.notifications.approvalEmails;
  }
}

/**
 * The caller's own account settings (profile + preferences).
 * @param {object} actor
 * @returns {Promise<{ user: object }>}
 */
export async function getMySettings(actor) {
  const user = await loadSelf(actor);
  return { user: user.toJSON() };
}

/**
 * Update the caller's own profile name and/or preferences. Only the provided
 * keys change; the schema guarantees at least one field is present.
 * @param {object} actor
 * @param {{ firstName?: string, lastName?: string, preferences?: object }} updates
 * @returns {Promise<{ user: object }>}
 */
export async function updateMySettings(actor, updates) {
  const user = await loadSelf(actor);
  if (updates.firstName !== undefined) user.firstName = updates.firstName;
  if (updates.lastName !== undefined) user.lastName = updates.lastName;
  if (updates.preferences) applyPreferences(user, updates.preferences);
  await user.save();
  return { user: user.toJSON() };
}

/**
 * Change the caller's own password. Verifies the current password, rejects a
 * no-op change, then sets the new one (the model's pre-save hook rehashes and
 * bumps `passwordChangedAt`) and revokes ALL sessions — the refresh hash is
 * cleared and existing access tokens are invalidated via `passwordChangedAt`, so
 * the client must log in again with the new password.
 * @param {object} actor
 * @param {{ currentPassword: string, newPassword: string }} input
 * @returns {Promise<{ user: object }>}
 */
export async function changeMyPassword(actor, { currentPassword, newPassword }) {
  const user = await loadSelf(actor, { withPassword: true });

  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect', {
      code: 'INVALID_CURRENT_PASSWORD',
      details: [{ field: 'currentPassword', message: 'incorrect' }],
    });
  }
  if (await user.comparePassword(newPassword)) {
    throw ApiError.badRequest('New password must be different from the current password', {
      code: 'PASSWORD_UNCHANGED',
      details: [{ field: 'newPassword', message: 'must differ from the current password' }],
    });
  }

  user.password = newPassword; // pre-save hook hashes + backdates passwordChangedAt
  user.refreshTokenHash = null; // revoke any active refresh session
  await user.save();
  return { user: user.toJSON() };
}

/**
 * The caller's organization-wide preferences (the `settings` bag).
 * @param {object} actor
 * @returns {Promise<{ settings: object }>}
 */
export async function getOrgSettings(actor) {
  const org = await loadOrganization(actor);
  return { settings: org.toJSON().settings };
}

/**
 * Update the caller's organization-wide preferences. Only the provided keys
 * change; the org identity (name/slug/billing) is managed by the Module 3
 * organization endpoint, not here.
 * @param {object} actor
 * @param {object} updates - validated `settings` keys
 * @returns {Promise<{ settings: object }>}
 */
export async function updateOrgSettings(actor, updates) {
  const org = await loadOrganization(actor);
  applyOrgSettings(org, updates);
  await org.save();
  return { settings: org.toJSON().settings };
}
