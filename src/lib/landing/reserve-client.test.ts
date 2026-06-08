import { describe, it, expect, vi } from 'vitest';
import { validateEmail, buildMailtoFallback, submitReserve } from './reserve-client';

describe('validateEmail', () => {
  it('accepts a normal address', () => expect(validateEmail('a@b.co')).toBe(true));
  it('rejects missing @', () => expect(validateEmail('ab.co')).toBe(false));
  it('rejects empty', () => expect(validateEmail('   ')).toBe(false));
});

describe('buildMailtoFallback', () => {
  it('encodes email + note into a mailto url', () => {
    const url = buildMailtoFallback('me@x.com', 'a reggae video');
    expect(url.startsWith('mailto:')).toBe(true);
    expect(url).toContain('subject=');
    expect(decodeURIComponent(url)).toContain('me@x.com');
    expect(decodeURIComponent(url)).toContain('a reggae video');
    expect(url).toContain('founders@lyricstudio.app'); // pins the branded default inbox
  });
});

describe('submitReserve', () => {
  it('returns invalid for a bad email without calling fetch', async () => {
    const fetchSpy = vi.fn();
    const r = await submitReserve({ email: 'nope', note: '', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(false);
    expect(r.invalid).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns ok when the endpoint returns ok:true', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const r = await submitReserve({ email: 'me@x.com', note: 'hi', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(true);
    expect(r.fallback).toBeUndefined(); // success must not carry a fallback
  });

  it('falls back to mailto when the endpoint is missing (non-OK)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    const r = await submitReserve({ email: 'me@x.com', note: 'hi', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(false);
    expect(r.fallback?.startsWith('mailto:')).toBe(true);
  });

  it('falls back to mailto when the endpoint returns 200 but non-JSON (SPA fallback HTML)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token <'); }
    });
    const r = await submitReserve({ email: 'me@x.com', note: 'hi', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(false);
    expect(r.fallback?.startsWith('mailto:')).toBe(true);
  });

  it('falls back to mailto when fetch throws', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network'));
    const r = await submitReserve({ email: 'me@x.com', note: '', hp: '' }, { fetch: fetchSpy as any });
    expect(r.ok).toBe(false);
    expect(r.fallback?.startsWith('mailto:')).toBe(true);
  });
});
