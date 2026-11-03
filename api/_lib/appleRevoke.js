// ============================================================================
// Sign in with Apple — token revocation (App Store guideline 5.1.1(v))
// ----------------------------------------------------------------------------
// Apple's REST API: POST https://appleid.apple.com/auth/revoke with a
// client_secret JWT (ES256, signed with the Sign in with Apple .p8 key).
// https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
//
// Env vars:
//   APPLE_PRIVATE_KEY  (required) contents of AuthKey_<KEYID>.p8, including the
//                      BEGIN/END lines. Literal "\n" sequences are accepted.
//   APPLE_KEY_ID       default 794HU6VJF5
//   APPLE_TEAM_ID      default 32S8LFT6HD
//   APPLE_CLIENT_ID    default com.henalytics.app.signin (the Services ID the
//                      Supabase Apple provider signs users in with)
// ============================================================================

import crypto from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export function appleConfig(env = process.env) {
  const raw = env.APPLE_PRIVATE_KEY || '';
  return {
    privateKey: raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw,
    keyId: env.APPLE_KEY_ID || '794HU6VJF5',
    teamId: env.APPLE_TEAM_ID || '32S8LFT6HD',
    clientId: env.APPLE_CLIENT_ID || 'com.henalytics.app.signin',
  };
}

export function makeAppleClientSecret({ privateKey, keyId, teamId, clientId }, nowSec = Math.floor(Date.now() / 1000)) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = { iss: teamId, iat: nowSec, exp: nowSec + 300, aud: 'https://appleid.apple.com', sub: clientId };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.sign('sha256', Buffer.from(input), {
    key: crypto.createPrivateKey(privateKey),
    dsaEncoding: 'ieee-p1363', // JOSE wants raw r||s, not DER
  });
  return `${input}.${b64url(sig)}`;
}

// Returns { ok: true } or { ok: false, error }. Never throws.
export async function revokeAppleToken(refreshToken, { env = process.env, fetchImpl = fetch } = {}) {
  try {
    const cfg = appleConfig(env);
    if (!cfg.privateKey) return { ok: false, error: 'APPLE_PRIVATE_KEY not set' };
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: makeAppleClientSecret(cfg),
      token: refreshToken,
      token_type_hint: 'refresh_token',
    });
    const r = await fetchImpl('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (r.ok) return { ok: true };
    let detail = '';
    try { detail = await r.text(); } catch (_) {}
    return { ok: false, error: `Apple revoke HTTP ${r.status} ${detail.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}
