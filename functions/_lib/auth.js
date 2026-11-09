// Prijava i sesije za korisničke račune. Bez lozinki. Sve tajne su u Cloudflare varijablama, ništa u kodu.
// Sesija: nasumičan token u kolaču __Host-sid (HttpOnly, Secure, SameSite=Lax). U bazi je samo SHA-256 otisak tokena.
import { json } from './util.js';

const enc = new TextEncoder();
export const COOKIE = '__Host-sid';
export const IDLE_SEC = 14 * 86400;   // sesija ističe nakon 14 dana bez korištenja
export const ABS_SEC = 60 * 86400;    // i najkasnije nakon 60 dana
export const nowSec = () => Math.floor(Date.now() / 1000);

const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomToken = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
export const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

function secretOf(env) {
  if (!env.SIGNING_SECRET || String(env.SIGNING_SECRET).length < 32) throw new Error('SIGNING_SECRET nije postavljen ili je prekratak (najmanje 32 znaka).');
  return String(env.SIGNING_SECRET);
}
// HMAC s tajnom i oznakom namjene: isti ulaz za različite namjene daje različit rezultat.
export async function hmac(env, purpose, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secretOf(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(purpose + '\0' + msg)));
}
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export const normEmail = (s) => String(s ?? '').trim().toLowerCase();
export const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 160;

// Šestocifren kod bez pristrasnosti (4294000000 je djeljiv s 1000000).
export function otpCode() {
  const a = new Uint32Array(1); let n;
  do { crypto.getRandomValues(a); n = a[0]; } while (n >= 4294000000);
  return String(n % 1000000).padStart(6, '0');
}

/* ---------- kolači i sesije ---------- */
export function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
const cookieStr = (v, maxAge) => `${COOKIE}=${v}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
export const clearCookie = () => cookieStr('', 0);

export async function createSession(env, userId) {
  const token = randomToken(32), now = nowSec();
  await env.DB.prepare('INSERT INTO sessions (id_hash, user_id, created_at, last_seen, expires_at) VALUES (?,?,?,?,?)')
    .bind(await sha256(token), userId, now, now, now + ABS_SEC).run();
  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(new Date().toISOString(), userId).run();
  return cookieStr(token, ABS_SEC);
}

// Vraća korisnika iz kolača ili null. Istekla sesija se briše.
export async function getUser(env, request) {
  const tok = parseCookies(request)[COOKIE];
  if (!tok || tok.length < 20 || tok.length > 100 || !/^[\w-]+$/.test(tok)) return null;
  const h = await sha256(tok), now = nowSec();
  const r = await env.DB.prepare('SELECT u.id AS id, u.email AS email, u.name AS name, u.phone AS phone, u.created_at AS created_at, s.last_seen AS last_seen, s.expires_at AS expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?').bind(h).first();
  if (!r) return null;
  if (now > r.expires_at || now - r.last_seen > IDLE_SEC) { await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(h).run(); return null; }
  if (now - r.last_seen > 300) await env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE id_hash = ?').bind(now, h).run();
  return { id: r.id, email: r.email, name: r.name, phone: r.phone, created_at: r.created_at, sessionHash: h };
}
export async function destroySession(env, request) {
  const tok = parseCookies(request)[COOKIE];
  if (tok) await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256(tok)).run();
}

/* ---------- zaštita zahtjeva ---------- */
// Svaka radnja koja nešto mijenja: samo POST, samo s našeg sajta (Origin), samo JSON. Uz SameSite=Lax to zatvara CSRF.
export function guardPost(request) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Samo POST.' }, 405);
  const o = request.headers.get('origin');
  let ok = false;
  try { ok = !!o && new URL(o).host === new URL(request.url).host; } catch {}
  if (!ok) return json({ ok: false, error: 'Zabranjeno.' }, 403);
  if (!/^application\/json/i.test(request.headers.get('content-type') || '')) return json({ ok: false, error: 'Neispravan zahtjev.' }, 415);
  return null;
}
export async function readJson(request) {
  try { const t = await request.text(); if (t.length > 8000) return null; const j = JSON.parse(t); return j && typeof j === 'object' ? j : null; } catch { return null; }
}

// Broji pokušaje u prozoru. Ključ se sprema kao HMAC. Vraća true dok je pokušaj dozvoljen.
export async function rateLimit(env, key, max, windowSec) {
  const now = nowSec(), k = await hmac(env, 'rl', key);
  await env.DB.prepare('INSERT INTO rate_limits (k, n, reset_at) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset_at <= ? THEN 1 ELSE n + 1 END, reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END')
    .bind(k, now + windowSec, now, now, now + windowSec).run();
  const r = await env.DB.prepare('SELECT n FROM rate_limits WHERE k = ?').bind(k).first();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rate_limits WHERE reset_at < ?').bind(now - 3600).run();
  return !!r && r.n <= max;
}
export const clientIp = (request) => request.headers.get('cf-connecting-ip') || 'nepoznato';

export async function audit(env, userId, action, detail = '') {
  try { await env.DB.prepare('INSERT INTO audit_log (at, user_id, action, detail) VALUES (?,?,?,?)').bind(new Date().toISOString(), userId || null, action, String(detail).slice(0, 200)).run(); } catch (e) { console.error('audit', e); }
}

/* ---------- računi ---------- */
export const newUserId = () => randomToken(16);

// Gostujuće rezervacije s istim (potvrđenim) emailom postaju dio računa.
export async function attachBookings(env, user) {
  await env.DB.prepare('UPDATE bookings SET user_id = ? WHERE user_id IS NULL AND lower(email) = ?').bind(user.id, user.email).run();
  // Ime i prezime iz zadnje rezervacije, samo ako račun još nema ime.
  if (!user.name) {
    const b = await env.DB.prepare("SELECT name FROM bookings WHERE user_id = ? AND name IS NOT NULL AND trim(name) <> '' ORDER BY created_at DESC LIMIT 1").bind(user.id).first();
    if (b && b.name) {
      const ime = String(b.name).trim().slice(0, 100);
      await env.DB.prepare('UPDATE users SET name = ? WHERE id = ? AND (name IS NULL OR name = ?)').bind(ime, user.id, '').run();
      user.name = ime;
    }
  }
}
export async function findOrCreateUser(env, email, name) {
  let u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!u) {
    const id = newUserId();
    await env.DB.prepare('INSERT INTO users (id, email, name, created_at) VALUES (?,?,?,?)').bind(id, email, name || null, new Date().toISOString()).run();
    u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    await audit(env, id, 'racun_napravljen');
  } else if (!u.name && name) {
    await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, u.id).run();
  }
  await attachBookings(env, u);
  return u;
}
