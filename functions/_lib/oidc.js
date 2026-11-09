// Prijava preko Google, Microsoft i Apple (OpenID Connect, tok s kodom + PKCE).
// Bez vanjskih biblioteka: potpis ID tokena provjeravamo WebCrypto-om prema javnim ključevima pružaoca.
import { randomToken, sha256, nowSec, b64u } from './auth.js';

const enc = new TextEncoder();
const MS_CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'; // lični Microsoft nalozi (outlook.com, hotmail.com...)

export const PROVIDERS = {
  google: {
    label: 'Google',
    auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: (iss) => iss === 'https://accounts.google.com' || iss === 'accounts.google.com',
    scope: 'openid email profile', params: { prompt: 'select_account' },
    clientId: (e) => e.GOOGLE_CLIENT_ID, enabled: (e) => !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET)
  },
  microsoft: {
    label: 'Microsoft',
    auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', jwks: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    issuer: (iss, c) => /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0$/.test(iss) && iss.includes('/' + c.tid + '/'),
    scope: 'openid email profile', params: { prompt: 'select_account' },
    clientId: (e) => e.MSLOGIN_CLIENT_ID, enabled: (e) => !!(e.MSLOGIN_CLIENT_ID && e.MSLOGIN_CLIENT_SECRET)
  },
  apple: {
    label: 'Apple',
    auth: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', jwks: 'https://appleid.apple.com/auth/keys',
    issuer: (iss) => iss === 'https://appleid.apple.com',
    scope: 'name email', params: { response_mode: 'form_post' },
    clientId: (e) => e.APPLE_CLIENT_ID, enabled: (e) => !!(e.APPLE_CLIENT_ID && e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY)
  }
};
export const enabledProviders = (env) => Object.keys(PROVIDERS).filter((p) => PROVIDERS[p].enabled(env));
export const redirectUri = (env, p) => `${String(env.SITE_URL).replace(/\/$/, '')}/api/racun/oauth/${p}/povratak`;

const b64uBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const b64uJson = (s) => JSON.parse(new TextDecoder().decode(b64uBytes(s)));

/* ---------- početak prijave ---------- */
export async function startUrl(env, provider) {
  const P = PROVIDERS[provider];
  const state = randomToken(24), nonce = randomToken(16), verifier = randomToken(48);
  const challenge = b64u(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
  await env.DB.prepare('INSERT INTO oauth_states (state_hash, provider, nonce, verifier, created_at) VALUES (?,?,?,?,?)').bind(await sha256(state), provider, nonce, verifier, nowSec()).run();
  await env.DB.prepare('DELETE FROM oauth_states WHERE created_at < ?').bind(nowSec() - 3600).run();
  const u = new URL(P.auth);
  const q = { client_id: P.clientId(env), redirect_uri: redirectUri(env, provider), response_type: 'code', scope: P.scope, state, nonce, code_challenge: challenge, code_challenge_method: 'S256', ...P.params };
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  return u.toString();
}

/* ---------- Apple client secret (ES256 JWT) ---------- */
async function appleSecret(env) {
  const pem = String(env.APPLE_PRIVATE_KEY).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = nowSec();
  const head = b64u(enc.encode(JSON.stringify({ alg: 'ES256', kid: env.APPLE_KEY_ID, typ: 'JWT' })));
  const body = b64u(enc.encode(JSON.stringify({ iss: env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: env.APPLE_CLIENT_ID })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}

/* ---------- provjera ID tokena ---------- */
const jwksCache = new Map();
async function jwksFor(p, force) {
  const hit = jwksCache.get(p.jwks);
  if (hit && !force && hit.exp > Date.now()) return hit.keys;
  const r = await fetch(p.jwks, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('JWKS ' + r.status);
  const keys = (await r.json()).keys || [];
  jwksCache.set(p.jwks, { keys, exp: Date.now() + 3600000 });
  return keys;
}
export async function verifyIdToken(env, provider, idToken, nonce) {
  const P = PROVIDERS[provider];
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('token');
  const head = b64uJson(parts[0]), c = b64uJson(parts[1]);
  if (head.alg !== 'RS256' || !head.kid) throw new Error('alg');
  let jwk = (await jwksFor(P, false)).find((k) => k.kid === head.kid);
  if (!jwk) jwk = (await jwksFor(P, true)).find((k) => k.kid === head.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uBytes(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('potpis');
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  const now = nowSec();
  if (!P.issuer(String(c.iss || ''), c)) throw new Error('iss');
  if (!aud.includes(P.clientId(env))) throw new Error('aud');
  if (!c.exp || c.exp < now - 60) throw new Error('exp');
  if (c.iat && c.iat > now + 300) throw new Error('iat');
  if (!c.nonce || c.nonce !== nonce) throw new Error('nonce');
  if (!c.sub) throw new Error('sub');
  return c;
}

// Zamjena koda za token + provjera. Vraća { sub, email, emailTrusted, name }.
export async function finishLogin(env, provider, code, state, userJson) {
  const P = PROVIDERS[provider];
  const st = await env.DB.prepare('SELECT * FROM oauth_states WHERE state_hash = ?').bind(await sha256(String(state || ''))).first();
  if (!st) throw new Error('state');
  await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash = ?').bind(st.state_hash).run(); // jednokratno
  if (st.provider !== provider || nowSec() - st.created_at > 600) throw new Error('state istekao');
  const body = new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri(env, provider), client_id: P.clientId(env), code_verifier: st.verifier });
  body.set('client_secret', provider === 'apple' ? await appleSecret(env) : provider === 'google' ? env.GOOGLE_CLIENT_SECRET : env.MSLOGIN_CLIENT_SECRET);
  const r = await fetch(P.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('token ' + r.status);
  const t = await r.json();
  const c = await verifyIdToken(env, provider, t.id_token, st.nonce);
  const email = String(c.email || (provider === 'microsoft' ? c.preferred_username : '') || '').trim().toLowerCase();
  const verified = c.email_verified === true || c.email_verified === 'true';
  // Google i Apple jamče da je email potvrđen. Microsoft to jamči samo za lične naloge: za poslovne email može biti proizvoljan.
  const emailTrusted = !!email && (provider === 'microsoft' ? c.tid === MS_CONSUMER_TENANT : verified);
  let name = String(c.name || '').trim();
  if (provider === 'apple' && userJson) { try { const u = JSON.parse(userJson); name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ') || name; } catch {} }
  return { sub: String(c.sub), email, emailTrusted, name: name.slice(0, 100) };
}
