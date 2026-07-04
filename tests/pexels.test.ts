import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchImage } from '@/lib/pexels';

describe('searchImage', () => {
  beforeEach(() => {
    vi.stubEnv('PEXELS_API_KEY', 'test-key');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns the first photo url and alt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          photos: [{ src: { medium: 'https://img.test/1.jpg' }, alt: 'a walk' }],
        }),
      }),
    );
    expect(await searchImage('walk the dog')).toEqual({
      url: 'https://img.test/1.jpg',
      alt: 'a walk',
    });
  });

  it('falls back to the query for a missing alt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ photos: [{ src: { medium: 'https://img.test/2.jpg' }, alt: '' }] }),
      }),
    );
    expect(await searchImage('mow the lawn')).toEqual({
      url: 'https://img.test/2.jpg',
      alt: 'mow the lawn',
    });
  });

  it('returns null when there are no results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ photos: [] }) }),
    );
    expect(await searchImage('zzzz')).toBeNull();
  });

  it('returns null on API error responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    expect(await searchImage('rate limited')).toBeNull();
  });

  it('returns null when the key is missing', async () => {
    vi.stubEnv('PEXELS_API_KEY', '');
    expect(await searchImage('anything')).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await searchImage('boom')).toBeNull();
  });
});
