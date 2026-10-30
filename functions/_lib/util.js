export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const page = (title, body, status = 200) => {
  // Same look as the e-mails: white page, big black type, flat colour bar. Accent follows the outcome.
  const accent = /potvrđeno/i.test(title) ? '#5A837B' : /odbijeno|otkazano|nije|prekasno|nemoguće|ne /i.test(title) || status >= 400 ? '#A95457' : '#DCA402';
  return new Response(`<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#1A1A1A;font:16px/1.55 "Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.bar{height:14px;background:${accent}}main{max-width:600px;margin:0 auto;padding:28px 24px 48px}
.brand{font-size:13px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin:0 0 22px}
h1{font-size:clamp(2rem,8vw,2.9rem);line-height:1.02;font-weight:900;letter-spacing:-.04em;margin:0 0 16px}
p{color:#414141;margin:0 0 14px}
dl{margin:24px 0;padding:10px 20px;background:#F4F3EF;border-left:6px solid ${accent}}
dt{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#414141;padding-top:12px}
dd{margin:2px 0 0;padding-bottom:12px;font-weight:700;font-size:17px;border-bottom:1px solid #DDDBD3}dd:last-child{border-bottom:0}
form{margin:26px 0 0}
button{font:inherit;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:14px 24px;border:2px solid #5B4E93;background:#5B4E93;color:#fff;cursor:pointer;min-height:46px}
button:hover{background:#463b78;border-color:#463b78}
footer{margin-top:40px;padding-top:16px;border-top:1px solid #DDDBD3;font-size:12px;color:#414141}footer a{color:inherit}
</style></head><body><div class="bar"></div><main><p class="brand">SKRIPTA Coffice</p>${body}<footer><b style="color:#1A1A1A">SKRIPTA</b> · Emerika Bluma 9, Sarajevo<br><a href="mailto:info@skripta.ba">info@skripta.ba</a> · +387 62 307 885</footer></main></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
};

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
