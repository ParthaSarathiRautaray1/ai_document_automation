import { describe, it, expect, afterEach } from 'vitest';
import { setAccessToken, getAccessToken, getApiError, cleanParams } from '@/lib/api';

afterEach(() => setAccessToken(null));

describe('in-memory access token', () => {
  it('stores and returns the current token', () => {
    setAccessToken('abc.def.ghi');
    expect(getAccessToken()).toBe('abc.def.ghi');
  });

  it('clears when set to a falsy value', () => {
    setAccessToken('token');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

describe('getApiError', () => {
  it('extracts message/code/details/status from the API error envelope', () => {
    const axiosError = {
      response: {
        status: 422,
        data: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'email', message: 'Invalid email address' }],
        },
      },
    };
    expect(getApiError(axiosError)).toEqual({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: [{ field: 'email', message: 'Invalid email address' }],
      status: 422,
    });
  });

  it('falls back to a generic message when there is no response (network error)', () => {
    const result = getApiError(new Error('Network Error'));
    expect(result.message).toBe('Network Error');
    expect(result.status).toBeNull();
    expect(result.code).toBeNull();
  });
});

describe('cleanParams', () => {
  it('drops undefined, null, and empty-string values', () => {
    expect(
      cleanParams({ page: 1, q: '', type: undefined, status: null, category: 'a' })
    ).toEqual({ page: 1, category: 'a' });
  });

  it('keeps falsey-but-meaningful values like 0 and false', () => {
    expect(cleanParams({ page: 0, flag: false, name: 'x' })).toEqual({
      page: 0,
      flag: false,
      name: 'x',
    });
  });

  it('returns an empty object for no params', () => {
    expect(cleanParams()).toEqual({});
  });
});
