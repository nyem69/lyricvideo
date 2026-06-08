// src/lib/server/reserve-logic.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidEmail, decideReserve } from './reserve-logic';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => expect(normalizeEmail('  Me@X.COM ')).toBe('me@x.com'));
});

describe('isValidEmail', () => {
  it('accepts valid', () => expect(isValidEmail('a@b.co')).toBe(true));
  it('rejects invalid', () => expect(isValidEmail('a@b')).toBe(false));
});

describe('decideReserve', () => {
  it('flags spam when honeypot is filled', () => {
    const d = decideReserve({ email: 'a@b.co', hp: 'bot' }, 'UA', 1000);
    expect(d.status).toBe('spam');
  });
  it('rejects an invalid email', () => {
    const d = decideReserve({ email: 'nope' }, 'UA', 1000);
    expect(d.status).toBe('invalid');
  });
  it('rejects a missing email', () => {
    const d = decideReserve({}, 'UA', 1000);
    expect(d.status).toBe('invalid');
  });
  it('accepts a valid reservation and builds a record', () => {
    const d = decideReserve({ email: ' A@B.co ', note: ' reggae ' }, 'UA/1', 1700);
    expect(d.status).toBe('ok');
    if (d.status === 'ok') {
      expect(d.key).toBe('a@b.co');
      expect(d.record).toEqual({ note: 'reggae', ts: 1700, ua: 'UA/1' });
    }
  });
  it('truncates an overlong note', () => {
    const d = decideReserve({ email: 'a@b.co', note: 'x'.repeat(2000) }, 'UA', 1);
    if (d.status === 'ok') expect(d.record.note.length).toBe(500);
  });
});
