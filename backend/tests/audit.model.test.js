/**
 * AuditLog model (Module 14 · Task 1): defaults, required fields, and the
 * entityType enum.
 */
import mongoose from 'mongoose';
import AuditLog from '../src/features/audit/audit.model.js';
import { AUDIT_ENTITY_TYPE, AUDIT_ACTION } from '../src/config/constants.js';

function base(overrides = {}) {
  return {
    organization: new mongoose.Types.ObjectId(),
    action: AUDIT_ACTION.DOCUMENT_GENERATE,
    entityType: AUDIT_ENTITY_TYPE.DOCUMENT,
    ...overrides,
  };
}

describe('AuditLog model', () => {
  it('applies sensible defaults', async () => {
    const log = await AuditLog.create(base());
    expect(log.actor).toBeNull();
    expect(log.actorName).toBeNull();
    expect(log.actorEmail).toBeNull();
    expect(log.entityId).toBeNull();
    expect(log.entityLabel).toBeNull();
    expect(log.metadata).toEqual({});
  });

  it('requires organization, action, and entityType', async () => {
    await expect(AuditLog.create(base({ organization: undefined }))).rejects.toThrow(/Organization/);
    await expect(AuditLog.create(base({ action: undefined }))).rejects.toThrow(/Action/);
    await expect(AuditLog.create(base({ entityType: undefined }))).rejects.toThrow(/Entity type/);
  });

  it('rejects an unknown entityType', async () => {
    await expect(AuditLog.create(base({ entityType: 'spaceship' }))).rejects.toThrow();
  });

  it('captures the actor snapshot, entity, and metadata', async () => {
    const log = await AuditLog.create(
      base({
        actor: new mongoose.Types.ObjectId(),
        actorName: 'Ada Lovelace',
        actorEmail: 'ada@example.com',
        entityId: new mongoose.Types.ObjectId(),
        entityLabel: 'Q3 Contract',
        metadata: { status: 'approved' },
      })
    );
    expect(log.actorName).toBe('Ada Lovelace');
    expect(log.actorEmail).toBe('ada@example.com');
    expect(log.entityLabel).toBe('Q3 Contract');
    expect(log.metadata).toEqual({ status: 'approved' });
  });

  it('drops __v in JSON output', async () => {
    const log = await AuditLog.create(base());
    const json = log.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBeDefined();
  });
});
