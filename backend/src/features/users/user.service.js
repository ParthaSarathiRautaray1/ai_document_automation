/**
 * User-administration service (Module 2 — read side).
 *
 * Pure business logic (no req/res). Read access is gated by the `user:read`
 * permission at the route; contextual mutation rules arrive in Task 3.
 */
import User from './user.model.js';
import ApiError from '../../utils/ApiError.js';

/** Escape user input before using it in a RegExp (prevents invalid/abusive patterns). */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * List users with pagination, optional filtering (role/status) and free-text
 * search across name + email.
 *
 * @param {{ page:number, limit:number, sort:string, q?:string, role?:string, status?:string }} query
 * @returns {Promise<{ users: object[], meta: { page:number, limit:number, total:number, pages:number } }>}
 */
export async function listUsers({ page, limit, sort, q, role, status }) {
  const filter = {};
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
 * Fetch a single user by id.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getUserById(id) {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found', { code: 'USER_NOT_FOUND' });
  }
  return user.toJSON();
}
