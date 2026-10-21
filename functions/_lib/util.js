export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const page = (title, body, status = 200) => new Response(`<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;background:#F3E8CF;color:#2A1D16;margin:0;padding:24px}main{max-width:520px;margin:40px auto;background:#FAF3E1;border:2px solid #2A1D16;padding:28px}h1{font-size:1.5rem;margin:0 0 12px}button{font:inherit;font-weight:700;padding:12px 22px;border:2px solid #2A1D16;background:#F1C144;cursor:pointer;min-height:44px}dl{margin:16px 0}dt{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:#B5542F;font-weight:700}dd{margin:0 0 10px}</style></head><body><main>${body}</main></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
export async function makeToken(env, id, action) { return `${id}.${action}.${await hmac(env.SIGNING_SECRET, id + '.' + action)}`; }
export async function readToken(env, token, allowed) {
  const [id, action, sig] = String(token || '').split('.');
  if (!id || !allowed.includes(action) || !sig) return null;
  const good = await hmac(env.SIGNING_SECRET, id + '.' + action);
  if (good.length !== sig.length) return null;
  let diff = 0; for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? { id, action } : null;
}
export const newId = () => b64u(crypto.getRandomValues(new Uint8Array(12)));
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 160;
export const clean = (s, n = 200) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
