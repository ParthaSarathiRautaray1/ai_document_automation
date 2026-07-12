/**
 * AiCompletion model (Module 16 — AI Assistant).
 *
 * A stored AI suggestion. Serves two purposes at once:
 *  1. A per-organization **cache**: `promptHash` is a deterministic digest of the
 *     inputs that determine the output (model + operation + tone + text), so an
 *     identical request within the org reuses a stored result instead of paying
 *     for another provider call (ADR-0010 — AI results are cached).
 *  2. A lightweight **history** of AI usage in the org (the recent-suggestions
 *     feed), read via the AI feature's list endpoint.
 *
 * Everything is tenant-scoped (`organization`). Entries are only ever created
 * and read — never mutated — so a suggestion stays a faithful record of what the
 * model returned.
 */
import mongoose from 'mongoose';
import { AI_OPERATION_VALUES, AI_TONE_VALUES, AI_MAX_INPUT_CHARS } from '../../config/constants.js';

const { Schema } = mongoose;

const aiCompletionSchema = new Schema(
  {
    // Tenant scope — required and indexed so per-org queries/cache lookups stay fast.
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
      index: true,
    },
    // The text operation performed.
    operation: {
      type: String,
      enum: AI_OPERATION_VALUES,
      required: [true, 'Operation is required'],
      index: true,
    },
    // The model that produced the output (captured for reproducibility/audit).
    model: { type: String, trim: true, maxlength: 200, default: null },
    // Deterministic cache key over the inputs that determine the output.
    promptHash: {
      type: String,
      required: [true, 'Prompt hash is required'],
      index: true,
    },
    // The source text the operation ran on.
    input: {
      type: String,
      required: [true, 'Input text is required'],
      maxlength: AI_MAX_INPUT_CHARS,
    },
    // The requested tone (only meaningful for `change_tone`).
    tone: { type: String, enum: [...AI_TONE_VALUES, null], default: null },
    // The suggestion returned by the model.
    output: { type: String, required: [true, 'Output text is required'] },
    // Who requested it (nullable for out-of-band callers).
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

// Cache lookup: an org's stored result for a given prompt.
aiCompletionSchema.index({ organization: 1, promptHash: 1 });
// History feed: an org's recent suggestions, newest first.
aiCompletionSchema.index({ organization: 1, createdAt: -1 });

const AiCompletion = mongoose.model('AiCompletion', aiCompletionSchema);

export default AiCompletion;
