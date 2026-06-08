// src/lib/server/reserve-logic.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NOTE = 500;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export interface ReservePayload {
  email?: string;
  note?: string;
  hp?: string;
}

export type ReserveDecision =
  | { status: 'ok'; key: string; record: { note: string; ts: number; ua: string } }
  | { status: 'spam' }
  | { status: 'invalid'; error: string };

export function decideReserve(payload: ReservePayload, ua: string, now: number): ReserveDecision {
  if (payload.hp && payload.hp.trim() !== '') return { status: 'spam' };
  const email = (payload.email ?? '').trim();
  if (!email || !isValidEmail(email)) return { status: 'invalid', error: 'invalid email' };
  const note = (payload.note ?? '').trim().slice(0, MAX_NOTE);
  return { status: 'ok', key: normalizeEmail(email), record: { note, ts: now, ua } };
}
