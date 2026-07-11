/**
 * Product model (Module 5 — Product & Service Catalog).
 *
 * A catalog item is something an organization sells: a physical `product` or a
 * `service`. It is strictly tenant-scoped — every item belongs to exactly one
 * `organization`, and all queries are confined to the caller's org (see
 * product.service.js).
 *
 * Pricing is stored as a plain number in the item's `currency` (major units,
 * e.g. dollars) alongside an optional per-unit label and a tax rate (percent).
 * `sku` is an optional stock-keeping code that is unique **within** an org.
 */
import mongoose from 'mongoose';
import {
  PRODUCT_TYPE,
  PRODUCT_TYPE_VALUES,
  PRODUCT_STATUS,
  PRODUCT_STATUS_VALUES,
  DEFAULT_CURRENCY,
} from '../../config/constants.js';

const { Schema } = mongoose;

const productSchema = new Schema(
  {
    // Tenant scope — required and indexed so per-org queries stay fast.
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 200,
    },
    // Optional stock-keeping code, unique within an organization (see index below).
    sku: { type: String, trim: true, maxlength: 60, default: null },
    type: {
      type: String,
      enum: PRODUCT_TYPE_VALUES,
      default: PRODUCT_TYPE.PRODUCT,
      index: true,
    },
    status: {
      type: String,
      enum: PRODUCT_STATUS_VALUES,
      default: PRODUCT_STATUS.ACTIVE,
      index: true,
    },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    // Sale price in `currency` major units (e.g. 19.99). Never negative.
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: DEFAULT_CURRENCY,
    },
    // Optional internal cost (for margin), in the same currency. Never negative.
    cost: {
      type: Number,
      default: null,
      min: [0, 'Cost cannot be negative'],
    },
    // Tax rate as a percentage (0–100), e.g. 8.25 for 8.25%.
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100'],
    },
    // Optional unit of sale label, e.g. "each", "hour", "kg".
    unit: { type: String, trim: true, maxlength: 40, default: null },
    category: { type: String, trim: true, maxlength: 120, default: null },
    tags: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Common access pattern: list/search within one org.
productSchema.index({ organization: 1, createdAt: -1 });

// SKU is unique per organization, but only when present (partial index skips
// items with no SKU so multiple items may leave it blank).
productSchema.index(
  { organization: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: 'string' } } }
);

const Product = mongoose.model('Product', productSchema);

export default Product;
