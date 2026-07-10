import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/features/users/user.model.js';
import { USER_STATUS, ROLES } from '../src/config/constants.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';

const validUser = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'Sup3rSecret',
};

describe('POST /auth/register', () => {
  it('creates an account and returns user + access token', async () => {
    const res = await request(app).post(`${PREFIX}/auth/register`).send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('ada@example.com');
    expect(res.body.data.user.role).toBe(ROLES.MEMBER);
    expect(res.body.data.user.password).toBeUndefined();
    expect(typeof res.body.data.accessToken).toBe('string');

    const decoded = jwt.decode(res.body.data.accessToken);
    expect(decoded.sub).toBe(res.body.data.user.id);
    expect(decoded.role).toBe(ROLES.MEMBER);
  });

  it('normalizes email to lowercase and sets lastLoginAt', async () => {
    await request(app)
      .post(`${PREFIX}/auth/register`)
      .send({ ...validUser, email: 'ADA@Example.com' });
    const user = await User.findOne({ email: 'ada@example.com' });
    expect(user).not.toBeNull();
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post(`${PREFIX}/auth/register`).send(validUser);
    const res = await request(app).post(`${PREFIX}/auth/register`).send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a weak password with 422 and field details', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/register`)
      .send({ ...validUser, password: 'weak' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.some((d) => d.field === 'password')).toBe(true);
  });

  it('rejects unknown fields (strict schema)', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/register`)
      .send({ ...validUser, isAdmin: true });
    expect(res.status).toBe(422);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post(`${PREFIX}/auth/register`).send(validUser);
  });

  it('logs in with correct credentials and returns a token', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(validUser.email);
  });

  it('rejects a wrong password with a generic 401', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: validUser.email, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects an unknown email with the same generic 401', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: 'nobody@example.com', password: 'Whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('forbids a suspended account with 403', async () => {
    await User.updateOne({ email: validUser.email }, { status: USER_STATUS.SUSPENDED });
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });
});
