/**
 * Template service (Module 6). Pure business logic (no req/res).
 *
 * Every operation is confined to the actor's organization (tenant isolation):
 * a template in another org is reported as "not found", never leaked. Rendering
 * is delegated to the pure engine in template.engine.js.
 */
import Template from './template.model.js';
import { renderContent } from './template.engine.js';
import ApiError from '../../utils/ApiError.js';
import { ROLES } from '../../config/constants.js';

/** Escape user input before using it in a RegExp. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tenant-isolation filter. Confines every template query to the actor's own
 * organization. `super_admin` is a global role and operates across all tenants.
 * @param {{ role: string, organization: import('mongoose').Types.ObjectId | null }} actor
 * @returns {object}
 */
function orgScope(actor) {
  if (actor.role === ROLES.SUPER_ADMIN) return {};
  return { organization: actor.organization ?? null };
}

/** Require the actor to belong to an organization (templates are org-scoped). */
function requireOrganization(actor) {
  if (!actor.organization) {
    throw ApiError.badRequest('You must belong to an organization to manage templates', {
      code: 'NO_ORGANIZATION',
    });
  }
}

/**
 * Load a template document scoped to the actor's org, or throw 404. Shared by
 * every read/mutation path so isolation is enforced in one place.
 * @returns {Promise<import('mongoose').Document>}
 */
async function loadTemplate(actor, id) {
  const template = await Template.findOne({ _id: id, ...orgScope(actor) });
  if (!template) {
    throw ApiError.notFound('Template not found', { code: 'TEMPLATE_NOT_FOUND' });
  }
  return template;
}

/**
 * List templates with pagination, optional filtering (type/status/tag) and
 * free-text search across name + description. Scoped to the actor's org.
 * @param {object} actor
 * @param {{ page:number, limit:number, sort:string, q?:string, type?:string, status?:string, tag?:string }} query
 */
export async function listTemplates(actor, { page, limit, sort, q, type, status, tag }) {
  const filter = { ...orgScope(actor) };
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (tag) filter.tags = tag;
  if (q) {
    const rx = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ name: rx }, { description: rx }];
  }

  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    Template.find(filter).sort(sort).skip(skip).limit(limit),
    Template.countDocuments(filter),
  ]);

  return {
    templates: docs.map((doc) => doc.toJSON()),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** A single template by id, scoped to the actor's org. */
export async function getTemplateById(actor, id) {
  const template = await loadTemplate(actor, id);
  return template.toJSON();
}

/**
 * Create a template in the actor's organization.
 * @param {object} actor
 * @param {object} data - validated create payload
 */
export async function createTemplate(actor, data) {
  requireOrganization(actor);

  const template = new Template({
    ...data,
    organization: actor.organization,
    createdBy: actor.id,
  });

  await template.save();
  return template.toJSON();
}

/** Update template fields (including the full variables array), scoped to the org. */
export async function updateTemplate(actor, id, updates) {
  const template = await loadTemplate(actor, id);
  Object.assign(template, updates);
  await template.save();
  return template.toJSON();
}

/** Permanently delete a template. */
export async function deleteTemplate(actor, id) {
  const template = await loadTemplate(actor, id);
  await template.deleteOne();
}

/**
 * Render a preview of a template by substituting `values` into its content.
 * Read-only (nothing is persisted); scoped to the actor's org.
 * @param {object} actor
 * @param {string} id
 * @param {Record<string, unknown>} values
 * @returns {Promise<{ content:string, missingRequired:string[], usedVariables:string[], unknownPlaceholders:string[] }>}
 */
export async function renderTemplate(actor, id, values = {}) {
  const template = await loadTemplate(actor, id);
  return renderContent(template.content, template.variables, values);
}
