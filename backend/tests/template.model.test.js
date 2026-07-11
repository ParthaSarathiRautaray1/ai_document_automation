/**
 * Template model (Module 6 · Task 1): schema defaults, required fields, the
 * embedded variables (key format + unique-key guard), and the JSON transform.
 */
import mongoose from 'mongoose';
import Template from '../src/features/templates/template.model.js';
import { TEMPLATE_TYPE, TEMPLATE_STATUS, TEMPLATE_VARIABLE_TYPE } from '../src/config/constants.js';

const orgId = () => new mongoose.Types.ObjectId();

describe('Template model', () => {
  it('applies sensible defaults', async () => {
    const t = await Template.create({ organization: orgId(), name: 'Welcome', content: 'Hi {{name}}' });
    expect(t.type).toBe(TEMPLATE_TYPE.OTHER);
    expect(t.status).toBe(TEMPLATE_STATUS.DRAFT);
    expect(t.description).toBeNull();
    expect(t.variables).toEqual([]);
    expect(t.tags).toEqual([]);
  });

  it('requires organization, name, and content', async () => {
    await expect(Template.create({ name: 'No Org', content: 'x' })).rejects.toThrow(/organization/i);
    await expect(Template.create({ organization: orgId(), content: 'x' })).rejects.toThrow(/name/i);
    await expect(Template.create({ organization: orgId(), name: 'No Body' })).rejects.toThrow(/content/i);
  });

  it('stores embedded variables with defaults and their own _id', async () => {
    const t = await Template.create({
      organization: orgId(),
      name: 'Invoice',
      content: 'Total: {{total}}',
      variables: [{ key: 'total', label: 'Total due', required: true }],
    });
    expect(t.variables).toHaveLength(1);
    expect(t.variables[0].key).toBe('total');
    expect(t.variables[0].type).toBe(TEMPLATE_VARIABLE_TYPE.TEXT);
    expect(t.variables[0].required).toBe(true);
    expect(t.variables[0].defaultValue).toBeNull();
    expect(t.variables[0]._id).toBeDefined();
  });

  it('rejects an invalid variable key', async () => {
    await expect(
      Template.create({
        organization: orgId(),
        name: 'Bad',
        content: '{{x}}',
        variables: [{ key: '1nvalid key' }],
      })
    ).rejects.toThrow(/key/i);
  });

  it('rejects duplicate variable keys within one template', async () => {
    await expect(
      Template.create({
        organization: orgId(),
        name: 'Dupe',
        content: '{{a}}',
        variables: [{ key: 'a' }, { key: 'a' }],
      })
    ).rejects.toThrow(/duplicate variable key/i);
  });

  it('rejects an unknown type', async () => {
    await expect(
      Template.create({ organization: orgId(), name: 'X', content: 'x', type: 'spaceship' })
    ).rejects.toThrow(/type/i);
  });

  it('drops __v in JSON while keeping id', async () => {
    const t = await Template.create({ organization: orgId(), name: 'Json', content: 'x' });
    const json = t.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBeDefined();
  });
});
