// src/lib/landing/reserve-client.ts
import * as m from '$lib/paraglide/messages';

// Fallback inbox used when the /api/reserve Function isn't reachable (e.g. the
// GitHub Pages static mirror, or before the Function is deployed). NEVER a personal
// address — defaults to a branded inbox and can be overridden at build time via
// VITE_FOUNDER_INBOX (set in CF Pages env / .env). Set up the mailbox before launch.
const FOUNDER_INBOX = import.meta.env.VITE_FOUNDER_INBOX ?? 'founders@lyricstudio.app';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function buildMailtoFallback(email: string, note: string): string {
  const body = `${m.reserve_mailto_email()}: ${email}\n${m.reserve_mailto_make()}: ${note || m.reserve_mailto_unspecified()}`;
  return `mailto:${FOUNDER_INBOX}?subject=${encodeURIComponent(m.reserve_mailto_subject())}&body=${encodeURIComponent(body)}`;
}

export interface ReserveInput {
  email: string;
  note: string;
  hp: string; // honeypot — must stay empty for real users
}

export interface ReserveResult {
  ok: boolean;
  invalid?: boolean;   // client-side validation failed (no request made)
  fallback?: string;   // a mailto: url to fall back to when the endpoint is unavailable
}

export async function submitReserve(
  input: ReserveInput,
  deps: { fetch?: typeof fetch } = {}
): Promise<ReserveResult> {
  const email = input.email.trim();
  const note = input.note.trim();
  if (!validateEmail(email)) return { ok: false, invalid: true };

  const doFetch = deps.fetch ?? fetch;
  try {
    const res = await doFetch('/api/reserve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, note, hp: input.hp })
    });
    if (!res.ok) return { ok: false, fallback: buildMailtoFallback(email, note) };
    const data = await res.json().catch(() => ({}));
    if (data && data.ok) return { ok: true };
    return { ok: false, fallback: buildMailtoFallback(email, note) };
  } catch {
    return { ok: false, fallback: buildMailtoFallback(email, note) };
  }
}
