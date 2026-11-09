// Povratak s prijave kod pružaoca. Google i Microsoft šalju GET, Apple šalje POST (form_post).
import { PROVIDERS, finishLogin } from '../../../../_lib/oidc.js';
import { sha256, createSession, findOrCreateUser, audit, randomToken, nowSec, rateLimit, clientIp } from '../../../../_lib/auth.js';

const back = (env, q, cookie, ret = '') => {
  const origin = new URL(env.SITE_URL).origin;
  const en = ret.startsWith('en:'), rest = en ? ret.slice(3) : ret; // engleska stranica vraća na engleske stranice
  let loc = `${origin}/${en ? 'racun-en' : 'racun'}.html${q}`;
  const m = /^c\|(ind|lounge|)\|(\d{4}-\d{2}-\d{2}|)$/.exec(rest);
  if (m && !q) { const par = [m[1] && 'zona=' + m[1], m[2] && 'datum=' + m[2]].filter(Boolean).join('&'); loc = `${origin}/${en ? 'coffice-en' : 'coffice'}.html${par ? '?' + par : ''}#rezervacija`; }
  return new Response(null, { status: 302, headers: { location: loc, 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) } });
};

async function handle({ request, env, params }, data) {
  const p = String(params.provider), P = PROVIDERS[p];
  if (!P || !P.enabled(env)) return new Response('Ova prijava nije uključena.', { status: 404 });
  if (!(await rateLimit(env, 'oauth-cb:' + clientIp(request), 40, 600))) return new Response('Previše pokušaja.', { status: 429 });
  // Jezik se čita prije provjere, da i poruka o grešci završi na pravoj stranici.
  let peek = ''; try { const r0 = await env.DB.prepare('SELECT ret FROM oauth_states WHERE state_hash = ?').bind(await sha256(String(data.get('state') || ''))).first(); peek = r0 && r0.ret && r0.ret.startsWith('en:') ? 'en:' : ''; } catch {}
  if (data.get('error') || !data.get('code') || !data.get('state')) return back(env, '?greska=prijava', null, peek);
  let id;
  try { id = await finishLogin(env, p, data.get('code'), data.get('state'), data.get('user')); }
  catch (e) { console.error('oauth', p, String(e.message || e)); return back(env, '?greska=prijava', null, peek); }

  const known = await env.DB.prepare('SELECT user_id FROM identities WHERE provider = ? AND subject = ?').bind(p, id.sub).first();
  let user;
  if (known) user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(known.user_id).first();
  else if (id.emailTrusted) {
    user = await findOrCreateUser(env, id.email, id.name);
    await env.DB.prepare('INSERT OR IGNORE INTO identities (provider, subject, user_id, created_at) VALUES (?,?,?,?)').bind(p, id.sub, user.id, new Date().toISOString()).run();
  } else {
    if (!id.email) return back(env, '?greska=email', null, peek);
    // Pružalac ne garantuje email: račun se veže tek kad korisnik potvrdi kod poslan na tu adresu.
    const pid = randomToken(18);
    await env.DB.prepare('INSERT INTO oauth_pending (id, provider, subject, email, name, created_at) VALUES (?,?,?,?,?,?)').bind(pid, p, id.sub, id.email, id.name || null, nowSec()).run();
    await env.DB.prepare('DELETE FROM oauth_pending WHERE created_at < ?').bind(nowSec() - 3600).run();
    return back(env, '?potvrda=' + pid, null, peek);
  }
  if (!user) return back(env, '?greska=prijava', null, peek);
  await audit(env, user.id, 'prijava_' + p);
  return back(env, '', await createSession(env, user.id), id.ret);
}
export const onRequestGet = (ctx) => handle(ctx, new URL(ctx.request.url).searchParams);
export async function onRequestPost(ctx) { return handle(ctx, await ctx.request.formData()); }
