/**
 * Product model (Module 5 · Task 1): schema defaults, validation, pricing
 * constraints, the per-org unique SKU index, and the JSON transform.
 */
import mongoose from 'mongoose';
import Product from '../src/features/products/product.model.js';
import { PRODUCT_TYPE, PRODUCT_STATUS, DEFAULT_CURRENCY } from '../src/config/constants.js';

const orgId = () => new mongoose.Types.ObjectId();

describe('Product model', () => {
  // Ensure the per-org unique SKU index is built before exercising duplicate-key behavior.
  beforeAll(async () => {
    await Product.init();
  });

  it('applies sensible defaults', async () => {
    const p = await Product.create({ organization: orgId(), name: 'Widget' });
    expect(p.type).toBe(PRODUCT_TYPE.PRODUCT);
    expect(p.status).toBe(PRODUCT_STATUS.ACTIVE);
    expect(p.price).toBe(0);
    expect(p.currency).toBe(DEFAULT_CURRENCY);
    expect(p.taxRate).toBe(0);
    expect(p.cost).toBeNull();
    expect(p.sku).toBeNull();
    expect(p.tags).toEqual([]);
  });

  it('requires organization and name', async () => {
    await expect(Product.create({ name: 'No Org' })).rejects.toThrow(/organization/i);
    await expect(Product.create({ organization: orgId() })).rejects.toThrow(/name/i);
  });

  it('rejects a negative price', async () => {
    await expect(
      Product.create({ organization: orgId(), name: 'Bad', price: -1 })
    ).rejects.toThrow(/price/i);
  });

  it('rejects a tax rate above 100', async () => {
    await expect(
      Product.create({ organization: orgId(), name: 'Bad', taxRate: 150 })
    ).rejects.toThrow(/tax rate/i);
  });

  it('upper-cases the currency code', async () => {
    const p = await Product.create({ organization: orgId(), name: 'Euro', currency: 'eur' });
    expect(p.currency).toBe('EUR');
  });

  it('stores a service with pricing and a unit', async () => {
    const p = await Product.create({
      organization: orgId(),
      name: 'Consulting',
      type: PRODUCT_TYPE.SERVICE,
      price: 120,
      unit: 'hour',
      taxRate: 8.25,
    });
    expect(p.type).toBe(PRODUCT_TYPE.SERVICE);
    expect(p.price).toBe(120);
    expect(p.unit).toBe('hour');
    expect(p.taxRate).toBe(8.25);
  });

  it('enforces a unique SKU within an organization', async () => {
    const org = orgId();
    await Product.create({ organization: org, name: 'A', sku: 'SKU-1' });
    await expect(
      Product.create({ organization: org, name: 'B', sku: 'SKU-1' })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('allows the same SKU in different organizations', async () => {
    await Product.create({ organization: orgId(), name: 'A', sku: 'SHARED' });
    const p = await Product.create({ organization: orgId(), name: 'B', sku: 'SHARED' });
    expect(p.sku).toBe('SHARED');
  });

  it('allows multiple items with no SKU (partial index)', async () => {
    const org = orgId();
    await Product.create({ organization: org, name: 'A' });
    const p = await Product.create({ organization: org, name: 'B' });
    expect(p.sku).toBeNull();
  });

  it('drops __v in JSON while keeping id', async () => {
    const p = await Product.create({ organization: orgId(), name: 'Json' });
    const json = p.toJSON();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBeDefined();
  });
});
