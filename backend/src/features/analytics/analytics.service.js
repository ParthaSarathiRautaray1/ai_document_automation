/**
 * Analytics service (Module 15 — Dashboard & Analytics). Pure business logic
 * (no req/res).
 *
 * Read-only rollups over the data other modules already own — this module adds
 * no model of its own. Two responsibilities:
 *  1. `getSummary` — org-scoped headline counts (documents/customers/products/
 *     templates) plus status breakdowns and the count of pending approvals.
 *  2. `getRecentDocuments` — the most recently created documents, a compact
 *     "recent activity" feed for the dashboard.
 *
 * Everything is tenant-scoped via {@link orgScope}: a user sees only their own
 * organization's totals (`super_admin` is global). Each metric only counts
 * entities the whole org can already read, so `analytics:read` can safely be
 * granted to every role.
 */
import Document from '../documents/document.model.js';
import Customer from '../customers/customer.model.js';
import Product from '../products/product.model.js';
import Template from '../templates/template.model.js';
import ApprovalRequest from '../approvals/approval.model.js';
import { orgScope } from '../../utils/query.js';
import {
  DOCUMENT_STATUS_VALUES,
  CUSTOMER_STATUS_VALUES,
  APPROVAL_STATUS,
  ANALYTICS_RECENT_DEFAULT_LIMIT,
} from '../../config/constants.js';

/**
 * Total count and a per-status breakdown for a model, scoped to the actor's org.
 * The breakdown is seeded with a zero for every known status so the shape is
 * stable even when a status has no rows.
 *
 * @param {import('mongoose').Model} Model
 * @param {object} scope - a Mongo filter fragment (the org scope)
 * @param {readonly string[]} statusValues - the statuses to report
 * @returns {Promise<{ total: number, byStatus: Record<string, number> }>}
 */
async function statusBreakdown(Model, scope, statusValues) {
  const rows = await Model.aggregate([
    { $match: scope },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStatus = Object.fromEntries(statusValues.map((status) => [status, 0]));
  let total = 0;
  for (const { _id, count } of rows) {
    total += count;
    if (_id in byStatus) byStatus[_id] = count;
  }
  return { total, byStatus };
}

/**
 * Headline dashboard metrics for the actor's organization: document and customer
 * totals with status breakdowns, catalog and template totals, and the number of
 * approval requests currently pending.
 *
 * @param {object} actor - the authenticated user (for org scoping)
 * @returns {Promise<object>}
 */
export async function getSummary(actor) {
  const scope = orgScope(actor);

  const [documents, customers, products, templates, pendingApprovals] = await Promise.all([
    statusBreakdown(Document, scope, DOCUMENT_STATUS_VALUES),
    statusBreakdown(Customer, scope, CUSTOMER_STATUS_VALUES),
    Product.countDocuments(scope),
    Template.countDocuments(scope),
    ApprovalRequest.countDocuments({ ...scope, status: APPROVAL_STATUS.PENDING }),
  ]);

  return {
    documents,
    customers,
    products: { total: products },
    templates: { total: templates },
    approvals: { pending: pendingApprovals },
  };
}

/**
 * The most recently created documents for the actor's organization — a compact
 * activity feed for the dashboard. Returns lightweight rows (no rendered content
 * payload) newest-first.
 *
 * @param {object} actor - the authenticated user (for org scoping)
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ documents: object[] }>}
 */
export async function getRecentDocuments(actor, { limit = ANALYTICS_RECENT_DEFAULT_LIMIT } = {}) {
  const docs = await Document.find(orgScope(actor))
    .sort('-createdAt')
    .limit(limit)
    .select('title type status createdAt updatedAt');

  return { documents: docs.map((doc) => doc.toJSON()) };
}
