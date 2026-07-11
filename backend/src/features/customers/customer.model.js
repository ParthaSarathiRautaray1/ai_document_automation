/**
 * Customer model (Module 4).
 *
 * A Customer is a company or person an organization does business with. It is
 * strictly tenant-scoped: every customer belongs to exactly one `organization`,
 * and all queries are confined to the caller's org (see customer.service.js).
 *
 * Contacts and addresses are embedded subdocuments — a customer owns them, they
 * have no independent lifecycle, and they are always loaded/edited with the
 * parent. Each subdocument keeps its own `_id` so it can be addressed by the
 * `/customers/:id/contacts/:contactId` (and `/addresses/:addressId`) endpoints.
 */
import mongoose from 'mongoose';
import {
  CUSTOMER_TYPE,
  CUSTOMER_TYPE_VALUES,
  CUSTOMER_STATUS,
  CUSTOMER_STATUS_VALUES,
  ADDRESS_TYPE,
  ADDRESS_TYPE_VALUES,
} from '../../config/constants.js';

const { Schema } = mongoose;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip `__v` from embedded subdocuments while keeping the virtual `id`. */
const subdocJson = {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
};

/** A person to contact at the customer (name + optional channels). */
const contactSchema = new Schema(
  {
    name: { type: String, required: [true, 'Contact name is required'], trim: true, maxlength: 120 },
    title: { type: String, trim: true, maxlength: 120, default: null },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      match: [EMAIL_RE, 'Invalid contact email address'],
    },
    phone: { type: String, trim: true, maxlength: 40, default: null },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true, toJSON: subdocJson, toObject: { virtuals: true } }
);

/** A postal address for the customer (billing / shipping / other). */
const addressSchema = new Schema(
  {
    type: { type: String, enum: ADDRESS_TYPE_VALUES, default: ADDRESS_TYPE.OTHER },
    line1: { type: String, required: [true, 'Address line 1 is required'], trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200, default: null },
    city: { type: String, trim: true, maxlength: 120, default: null },
    state: { type: String, trim: true, maxlength: 120, default: null },
    postalCode: { type: String, trim: true, maxlength: 40, default: null },
    country: { type: String, trim: true, maxlength: 120, default: null },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true, toJSON: subdocJson, toObject: { virtuals: true } }
);

const customerSchema = new Schema(
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
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: CUSTOMER_TYPE_VALUES,
      default: CUSTOMER_TYPE.BUSINESS,
      index: true,
    },
    status: {
      type: String,
      enum: CUSTOMER_STATUS_VALUES,
      default: CUSTOMER_STATUS.ACTIVE,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      match: [EMAIL_RE, 'Invalid customer email address'],
    },
    phone: { type: String, trim: true, maxlength: 40, default: null },
    website: { type: String, trim: true, maxlength: 200, default: null },
    taxId: { type: String, trim: true, maxlength: 60, default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: null },
    tags: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
    contacts: { type: [contactSchema], default: [] },
    addresses: { type: [addressSchema], default: [] },
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
customerSchema.index({ organization: 1, createdAt: -1 });

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
