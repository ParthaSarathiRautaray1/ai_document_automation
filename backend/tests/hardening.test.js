/**
 * HTTP hardening (Module 18 · Task 2): correlation ids, CORS allowlist,
 * security headers, and body limits.
 */
import request from 'supertest';
import app from '../src/app.js';
import env from '../src/config/env.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';

describe('request id', () => {
  it('assigns one and echoes it back', async () => {
    const res = await request(app).get(`${PREFIX}/health`);
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('preserves an id supplied by an upstream proxy', async () => {
    const res = await request(app).get(`${PREFIX}/health`).set('X-Request-Id', 'edge-abc-123');
    expect(res.headers['x-request-id']).toBe('edge-abc-123');
  });

  it('replaces a malformed inbound id rather than reflecting it', async () => {
    const res = await request(app)
      .get(`${PREFIX}/health`)
      .set('X-Request-Id', 'bad id\twith junk');
    expect(res.headers['x-request-id']).not.toBe('bad id\twith junk');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('includes the id on an error response for correlation', async () => {
    const res = await request(app).get(`${PREFIX}/definitely-not-a-route`);
    expect(res.status).toBe(404);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });
});

describe('CORS allowlist', () => {
  it('allows the configured client origin', async () => {
    const res = await request(app).get(`${PREFIX}/health`).set('Origin', env.CLIENT_URL);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(env.CLIENT_URL);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects an unlisted origin with 403 (not a 500)', async () => {
    const res = await request(app)
      .get(`${PREFIX}/health`)
      .set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CORS_ORIGIN_FORBIDDEN');
  });

  it('allows a non-browser caller that sends no Origin (health probes)', async () => {
    const res = await request(app).get(`${PREFIX}/health`);
    expect(res.status).toBe(200);
  });
});

describe('security headers', () => {
  it('sets a locked-down CSP and hides the framework', async () => {
    const res = await request(app).get(`${PREFIX}/health`);
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('omits HSTS when not served over HTTPS', async () => {
    const res = await request(app).get(`${PREFIX}/health`);
    // IS_HTTPS is false in the test env — advertising HSTS here would be wrong.
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('body limits', () => {
  it('rejects an oversized JSON body with 413', async () => {
    const huge = { content: 'x'.repeat(1_200_000) }; // > the 1mb default
    const res = await request(app).post(`${PREFIX}/auth/login`).send(huge);
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post(`${PREFIX}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });
});
