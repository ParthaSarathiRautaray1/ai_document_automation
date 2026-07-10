import crypto from 'node:crypto';
import User from '../src/features/users/user.model.js';
import { ROLES, USER_STATUS } from '../src/config/constants.js';

const baseUser = () => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'Sup3rSecret!',
});

describe('User model', () => {
  it('hashes the password on save and never returns it by default', async () => {
    const user = await User.create(baseUser());
    expect(user.password).not.toBe('Sup3rSecret!');

    const found = await User.findById(user._id);
    expect(found.password).toBeUndefined(); // select: false
  });

  it('defaults role to MEMBER and status to ACTIVE', async () => {
    const user = await User.create(baseUser());
    expect(user.role).toBe(ROLES.MEMBER);
    expect(user.status).toBe(USER_STATUS.ACTIVE);
  });

  it('comparePassword returns true for the correct password only', async () => {
    await User.create(baseUser());
    const user = await User.findOne({ email: 'ada@example.com' }).select('+password');
    expect(await user.comparePassword('Sup3rSecret!')).toBe(true);
    expect(await user.comparePassword('wrong')).toBe(false);
  });

  it('enforces unique email', async () => {
    await User.create(baseUser());
    await expect(User.create(baseUser())).rejects.toMatchObject({ code: 11000 });
  });

  it('createPasswordResetToken stores a hash and returns the plaintext', async () => {
    const user = await User.create(baseUser());
    const raw = user.createPasswordResetToken();
    const expectedHash = crypto.createHash('sha256').update(raw).digest('hex');
    expect(user.passwordResetToken).toBe(expectedHash);
    expect(user.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
  });

  it('toJSON strips sensitive fields and exposes fullName', async () => {
    const user = await User.create(baseUser());
    const json = user.toJSON();
    expect(json.fullName).toBe('Ada Lovelace');
    expect(json.password).toBeUndefined();
    expect(json.refreshTokenHash).toBeUndefined();
  });
});
