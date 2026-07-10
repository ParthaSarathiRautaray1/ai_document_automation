/**
 * User model.
 *
 * Represents an authenticated principal in DocFlow AI. Holds credentials
 * (hashed), profile fields, role, status, and password-reset / refresh-token
 * bookkeeping used by the Authentication module.
 *
 * Security notes:
 *  - `password`, `passwordResetToken`, and `refreshTokenHash` use `select: false`
 *    so they are never returned by default queries.
 *  - Password hashing is handled by a pre-save hook (bcrypt).
 *  - Reset tokens are stored HASHED; the plaintext is only ever sent by email.
 */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  ROLES,
  ROLE_VALUES,
  USER_STATUS,
  USER_STATUS_VALUES,
  BCRYPT_SALT_ROUNDS,
  INVITE_TOKEN_EXPIRES_MIN,
} from '../../config/constants.js';
import env from '../../config/env.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 60,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.MEMBER,
      index: true,
    },
    status: {
      type: String,
      enum: USER_STATUS_VALUES,
      default: USER_STATUS.ACTIVE,
      index: true,
    },
    // Organization link is added in Module 3; kept optional here for forward-compat.
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
    lastLoginAt: { type: Date, default: null },

    // Password reset (Task 4)
    passwordResetToken: { type: String, select: false, default: null },
    passwordResetExpires: { type: Date, select: false, default: null },
    passwordChangedAt: { type: Date, select: false, default: null },

    // Refresh token rotation (Task 3) - store only the hash of the current token
    refreshTokenHash: { type: String, select: false, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.passwordChangedAt;
        delete ret.refreshTokenHash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

/** Hash password whenever it is set/changed. */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
  // Backdate by 1s so tokens issued right after a change are still valid.
  this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

/** Compare a plaintext candidate against the stored hash. */
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/**
 * Returns true if the password was changed after the given JWT "iat" timestamp
 * (seconds). Used to invalidate access tokens issued before a password change.
 */
userSchema.methods.passwordChangedAfter = function passwordChangedAfter(jwtIatSeconds) {
  if (!this.passwordChangedAt) return false;
  const changedAtSeconds = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return jwtIatSeconds < changedAtSeconds;
};

/**
 * Generate a password-reset token. Stores the SHA-256 hash + expiry on the
 * document and returns the PLAINTEXT token (to be emailed to the user).
 */
userSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + env.RESET_TOKEN_EXPIRES_MIN * 60 * 1000);
  return rawToken;
};

/**
 * Generate a member-invitation token. Reuses the reset-token fields (an
 * invitation is a "set your password" flow) but with a longer expiry. Stores the
 * SHA-256 hash and returns the PLAINTEXT token (to be emailed as an invite link).
 */
userSchema.methods.createInviteToken = function createInviteToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + INVITE_TOKEN_EXPIRES_MIN * 60 * 1000);
  return rawToken;
};

const User = mongoose.model('User', userSchema);

export default User;
