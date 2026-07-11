/**
 * Version history service (Module 12 — Version History). Pure business logic
 * (no req/res).
 *
 * Maintains an append-only history of a document's content-defining state. The
 * capture entry point (`snapshotDocument`) is called by the document service
 * after each material change; the read paths list history and diff two versions;
 * `restoreVersion` copies a past snapshot back onto the live document and appends
 * a new "restored" version. Every operation is confined to the actor's
 * organization (tenant isolation): a document or version in another org is
 * reported as "not found", never leaked.
 */
import DocumentVersion from './version.model.js';
import Document from '../documents/document.model.js';
import ApiError from '../../utils/ApiError.js';
import { orgScope, listResources } from '../../utils/query.js';
import { diffLines } from './version.diff.js';
import { VERSION_CHANGE_TYPE } from '../../config/constants.js';

/** Load a document scoped to the actor's org, or throw 404. */
async function loadDocument(actor, id) {
  const document = await Document.findOne({ _id: id, ...orgScope(actor) });
  if (!document) {
    throw ApiError.notFound('Document not found', { code: 'DOCUMENT_NOT_FOUND' });
  }
  return document;
}

/** Load a single version of a document (scoped), or throw 404. */
async function loadVersion(actor, documentId, versionId) {
  const version = await DocumentVersion.findOne({
    _id: versionId,
    document: documentId,
    ...orgScope(actor),
  });
  if (!version) {
    throw ApiError.notFound('Version not found', { code: 'VERSION_NOT_FOUND' });
  }
  return version;
}

/**
 * Capture the current (already saved) state of a document as the next immutable
 * version in its history. Called by the document service after generate /
 * regenerate / content edit, and by `restoreVersion` here. Never throws for the
 * caller's flow beyond a genuine persistence error.
 * @param {import('mongoose').Document} document a saved Document
 * @param {{ changeType:string, actor?:{ id?:string } }} options
 * @returns {Promise<object>} the created version (plain JSON)
 */
export async function snapshotDocument(document, { changeType, actor } = {}) {
  // Next sequential version number for this document.
  const last = await DocumentVersion.findOne({ document: document._id })
    .sort({ version: -1 })
    .select('version');
  const version = (last?.version ?? 0) + 1;

  const created = await DocumentVersion.create({
    organization: document.organization,
    document: document._id,
    version,
    changeType,
    title: document.title,
    type: document.type,
    status: document.status,
    content: document.content,
    values: document.values,
    templateSnapshot: document.templateSnapshot,
    missingRequired: document.missingRequired,
    tags: document.tags,
    createdBy: actor?.id ?? null,
  });
  return created.toJSON();
}

/**
 * List a document's version history (newest version first by default), paginated.
 * Verifies the document is in the actor's org first (404 otherwise).
 */
export async function listVersions(actor, documentId, { page, limit, sort }) {
  await loadDocument(actor, documentId);
  return listResources(DocumentVersion, 'versions', {
    actor,
    page,
    limit,
    sort,
    filters: { document: documentId },
  });
}

/** A single version by id, scoped to the actor's org + the given document. */
export async function getVersionById(actor, documentId, versionId) {
  await loadDocument(actor, documentId);
  const version = await loadVersion(actor, documentId, versionId);
  return version.toJSON();
}

/**
 * Diff two versions of a document by their ids. Returns both version records plus
 * a line-level diff of their content (`from` → `to`).
 * @param {object} actor
 * @param {string} documentId
 * @param {{ from:string, to:string }} query the two version ids
 */
export async function diffVersions(actor, documentId, { from, to }) {
  await loadDocument(actor, documentId);
  const [fromVersion, toVersion] = await Promise.all([
    loadVersion(actor, documentId, from),
    loadVersion(actor, documentId, to),
  ]);
  const diff = diffLines(fromVersion.content ?? '', toVersion.content ?? '');
  return { from: fromVersion.toJSON(), to: toVersion.toJSON(), diff };
}

/**
 * Restore a document to a previous version: copy that version's content-defining
 * state back onto the live document, save it, and append a new "restored" version
 * so the history stays append-only.
 * @param {object} actor
 * @param {string} documentId
 * @param {string} versionId the version to restore
 * @returns {Promise<object>} the updated document (plain JSON)
 */
export async function restoreVersion(actor, documentId, versionId) {
  const document = await loadDocument(actor, documentId);
  const source = await loadVersion(actor, documentId, versionId);

  document.title = source.title;
  document.type = source.type;
  document.status = source.status;
  document.content = source.content;
  document.values = source.values;
  document.templateSnapshot = source.templateSnapshot;
  document.missingRequired = source.missingRequired;
  document.tags = source.tags;

  await document.save();
  await snapshotDocument(document, { changeType: VERSION_CHANGE_TYPE.RESTORED, actor });
  return document.toJSON();
}
