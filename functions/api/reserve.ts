// functions/api/reserve.ts
import { decideReserve } from '../../src/lib/server/reserve-logic';

interface Env {
  FOUNDERS: KVNamespace;
  RESEND_API_KEY?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

// Single handler — method-checked inline. (Avoids the onRequest + onRequestPost
// + next() combo, whose ordering/precedence is ambiguous.)
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method not allowed' }, 405);
  }

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const ua = request.headers.get('user-agent') ?? '';
  const decision = decideReserve(payload as Record<string, string>, ua, Date.now());

  if (decision.status === 'invalid') return json({ ok: false, error: decision.error }, 400);
  if (decision.status === 'spam') return json({ ok: true }); // silently drop bots

  // Guard the KV path so a missing/misconfigured FOUNDERS binding returns a clean
  // 503 JSON (distinguishable from a gateway 502/504 in logs) instead of a raw 500.
  // The client treats any non-OK response identically and falls back to mailto.
  try {
    const existing = await env.FOUNDERS.get(decision.key);
    if (!existing) {
      await env.FOUNDERS.put(decision.key, JSON.stringify(decision.record));
      if (env.RESEND_API_KEY) {
        // best-effort confirmation; fire-and-forget so the response isn't blocked
        // on email delivery. (Slice-2 hardening: wrap in context.waitUntil(...) so
        // CF doesn't cancel it on worker teardown — acceptable to drop occasionally in MVP.)
        sendConfirmation(env.RESEND_API_KEY, decision.key).catch(() => {});
      }
    }
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: 'service unavailable' }, 503);
  }
};

async function sendConfirmation(apiKey: string, email: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      // Resend behind Cloudflare blocks default UAs with error 1010 — send a browser UA.
      'user-agent': 'Mozilla/5.0 (LyricStudio reserve)'
    },
    body: JSON.stringify({
      from: 'Lyric Studio <founders@lyricstudio.app>',
      to: email,
      subject: "You're on the Founder list — Lyric Studio",
      text: "Thanks for reserving the $24 founder price. No charge today — we'll email you a checkout link when Founder access opens."
    })
  });
}
