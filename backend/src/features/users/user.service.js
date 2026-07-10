/**
 * User-administration service (Module 2 — read side).
 *
 * Pure business logic (no req/res). Read access is gated by the `user:read`
 * permission at the route; contextual mutation rules arrive in Task 3.
 */
import crypto from 'node:crypto';
import User from './user.model.js';
import Organization from '../organizations/organization.model.js';
import ApiError from '../../utils/ApiError.js';
import { sendInvitationEmail } from '../../services/email.service.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { ROLES, ROLE_RANK, USER_STATUS } from '../../config/constants.js';

/** Escape user input before using it in a RegExp (prevents invalid/abusive patterns). */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tenant-isolation filter. Every user query is confined to the actor's own
 * organization, so an admin in one org can never see or touch users in another.
 * `super_admin` is a global/out-of-band role and operates across all tenants.
 * @param {{ role: string, organization: import('mongoose').Types.ObjectId | null }} actor
 * @returns {object}
 */
function orgScope(actor) {
  if (actor.role === ROLES.SUPER_ADMIN) return {};
  return { organization: actor.organization ?? null };
}

/**
 * List users with pagination, optional filtering (role/status) and free-text
 * search across name + email.
 *
 * Confined to the actor's organization (tenant isolation).
 *
 * @param {object} actor - the authenticated user making the request
 * @param {{ page:number, limit:number, sort:string, q?:string, role?:string, status?:string }} query
 * @returns {Promise<{ users: object[], meta: { page:number, limit:number, total:number, pages:number } }>}
 */
export async function listUsers(actor, { page, limit, sort, q, role, status }) {
  const filter = { ...orgScope(actor) };
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
  }

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    users: docs.map((doc) => doc.toJSON()),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/**
 * Fetch a single user by id, scoped to the actor's organization. A user in
 * another tenant is reported as not found (isolation — no cross-org existence leak).
 * @param {object} actor
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getUserById(actor, id) {
  const user = await User.findOne({ _id: id, ...orgScope(actor) });
  if (!user) {
    throw ApiError.notFound('User not found', { code: 'USER_NOT_FOUND' });
  }
  return user.toJSON();
}

/**
 * Load a mutation target and enforce the shared hierarchy guards:
 *  - not yourself (no self role/status changes here),
 *  - target must rank strictly below the actor (can't touch peers/superiors).
 * @returns {Promise<{ target: import('mongoose').Document, actorRank: number }>}
 */
async function loadManageableTarget(actor, targetId) {
  // Scoped find: a target outside the actor's organization is simply "not found".
  const target = await User.findOne({ _id: targetId, ...orgScope(actor) }).select(
    '+refreshTokenHash'
  );
  if (!target) {
    throw ApiError.notFound('User not found', { code: 'USER_NOT_FOUND' });
  }
  if (actor.id === target.id) {
    throw ApiError.forbidden('You cannot modify your own account from here', {
      code: 'CANNOT_MODIFY_SELF',
    });
  }
  const actorRank = ROLE_RANK[actor.role] ?? 0;
  const targetRank = ROLE_RANK[target.role] ?? 0;
  if (targetRank >= actorRank) {
    throw ApiError.forbidden('You cannot modify a user with an equal or higher role', {
      code: 'FORBIDDEN_TARGET',
    });
  }
  return { target, actorRank };
}

/**
 * Change a user's role. The new role must rank strictly below the actor, so a
 * user can never grant a role at or above their own level (no escalation).
 * @param {{ actor: object, targetId: string, role: string }} input
 * @returns {Promise<object>}
 */
export async function updateUserRole({ actor, targetId, role }) {
  const { target, actorRank } = await loadManageableTarget(actor, targetId);

  const newRank = ROLE_RANK[role] ?? 0;
  if (newRank >= actorRank) {
    throw ApiError.forbidden('You cannot assign a role at or above your own', {
      code: 'ROLE_ASSIGNMENT_FORBIDDEN',
    });
  }

  target.role = role;
  await target.save();
  return target.toJSON();
}

/**
 * Invite a new member into the actor's organization. Creates an `invited` user
 * (with a throwaway password they never learn) and emails them an invitation
 * link to set their real password and activate. The assigned role must rank
 * strictly below the actor's (no inviting a peer/superior).
 *
 * @param {{ actor: object, email: string, firstName: string, lastName: string, role?: string }} input
 * @returns {Promise<object>} the created (invited) user
 */
export async function inviteUser({ actor, email, firstName, lastName, role }) {
  if (!actor.organization) {
    throw ApiError.badRequest('You must belong to an organization to invite members', {
      code: 'NO_ORGANIZATION',
    });
  }

  const actorRank = ROLE_RANK[actor.role] ?? 0;
  const newRole = role || ROLES.MEMBER;
  const newRank = ROLE_RANK[newRole] ?? 0;
  if (newRank >= actorRank) {
    throw ApiError.forbidden('You cannot invite a member at or above your own role', {
      code: 'ROLE_ASSIGNMENT_FORBIDDEN',
    });
  }

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', {
      code: 'EMAIL_TAKEN',
      details: [{ field: 'email', message: 'already registered' }],
    });
  }

  // Random throwaway password: satisfies the model's `required`/min-length; the
  // invitee never uses it — they set their own password on accept.
  const tempPassword = `${crypto.randomBytes(24).toString('hex')}Aa1`;
  const user = await User.create({
    firstName,
    lastName,
    email,
    password: tempPassword,
    role: newRole,
    status: USER_STATUS.INVITED,
    organization: actor.organization,
  });

  const rawToken = user.createInviteToken();
  await user.save({ validateBeforeSave: false });

  const org = await Organization.findById(actor.organization);
  const inviteUrl = `${env.CLIENT_URL}/accept-invite?token=${rawToken}`;
  try {
    await sendInvitationEmail(user, inviteUrl, {
      inviterName: actor.fullName || actor.firstName,
      orgName: org?.name,
    });
  } catch (err) {
    // Roll back so a failed delivery doesn't leave a stranded invited account.
    await User.deleteOne({ _id: user._id });
    logger.error(`[users] invitation email failed for ${user.email}: ${err.message}`);
    throw ApiError.internal('Could not send the invitation email. Please try again later.', {
      code: 'EMAIL_SEND_FAILED',
    });
  }

  return user.toJSON();
}

/**
 * Remove a member from the actor's organization. Uses the same hierarchy guards
 * as role/status changes (not yourself, same org, strictly below you), then
 * deletes the user record (they belong to a single org in this model).
 * @param {{ actor: object, targetId: string }} input
 * @returns {Promise<void>}
 */
export async function removeUser({ actor, targetId }) {
  const { target } = await loadManageableTarget(actor, targetId);
  await User.deleteOne({ _id: target._id });
}

/**
 * Suspend or reactivate a user. Suspending also revokes their refresh session;
 * combined with the `authenticate` suspended-account check, access is cut off
 * immediately (not just on the next token expiry).
 * @param {{ actor: object, targetId: string, status: string }} input
 * @returns {Promise<object>}
 */
export async function updateUserStatus({ actor, targetId, status }) {
  const { target } = await loadManageableTarget(actor, targetId);

  target.status = status;
  if (status === USER_STATUS.SUSPENDED) {
    target.refreshTokenHash = null; // revoke the active refresh session
  }
  await target.save();
  return target.toJSON();
}
