import request from 'supertest';
import app from '../src/app.js';

const PREFIX = process.env.API_PREFIX || '/api/v1';

describe('Health endpoints', () => {
  it('GET /health returns 200 and healthy status', async () => {
    const res = await request(app).get(`${PREFIX}/health`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /ready returns 200 when DB is connected', async () => {
    const res = await request(app).get(`${PREFIX}/ready`);
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe('connected');
  });

  it('unknown route returns a 404 in the standard error envelope', async () => {
    const res = await request(app).get(`${PREFIX}/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Route not found/);
  });
});
