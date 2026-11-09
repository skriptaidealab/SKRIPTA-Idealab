// Povratak s prijave kod pružaoca. Google i Microsoft šalju GET, Apple šalje POST (form_post).
import { PROVIDERS, finishLogin } from '../../../../_lib/oidc.js';
import { createSession, findOrCreateUser, audit, randomToken, nowSec, rateLimit, clientIp } from '../../../../_lib/auth.js';

const back = (env, q, cookie) => new Response(null, { status: 302, headers: { location: `${new URL(env.SITE_URL).origin}/racun.html${q}`, 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) } });

async function handle({ request, env, params }, data) {
  const p = String(params.provider), P = PROVIDERS[p];
  if (!P || !P.enabled(env)) return new Response('Ova prijava nije uključena.', { status: 404 });
  if (!(await rateLimit(env, 'oauth-cb:' + clientIp(request), 40, 600))) return new Response('Previše pokušaja.', { status: 429 });
  if (data.get('error') || !data.get('code') || !data.get('state')) return back(env, '?greska=prijava');
  let id;
  try { id = await finishLogin(env, p, data.get('code'), data.get('state'), data.get('user')); }
  catch (e) { console.error('oauth', p, String(e.message || e)); return back(env, '?greska=prijava'); }

  const known = await env.DB.prepare('SELECT user_id FROM identities WHERE provider = ? AND subject = ?').bind(p, id.sub).first();
  let user;
  if (known) user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(known.user_id).first();
  else if (id.emailTrusted) {
    user = await findOrCreateUser(env, id.email, id.name);
    await env.DB.prepare('INSERT OR IGNORE INTO identities (provider, subject, user_id, created_at) VALUES (?,?,?,?)').bind(p, id.sub, user.id, new Date().toISOString()).run();
  } else {
    if (!id.email) return back(env, '?greska=email');
    // Pružalac ne garantuje email: račun se veže tek kad korisnik potvrdi kod poslan na tu adresu.
    const pid = randomToken(18);
    await env.DB.prepare('INSERT INTO oauth_pending (id, provider, subject, email, name, created_at) VALUES (?,?,?,?,?,?)').bind(pid, p, id.sub, id.email, id.name || null, nowSec()).run();
    await env.DB.prepare('DELETE FROM oauth_pending WHERE created_at < ?').bind(nowSec() - 3600).run();
    return back(env, '?potvrda=' + pid);
  }
  if (!user) return back(env, '?greska=prijava');
  await audit(env, user.id, 'prijava_' + p);
  return back(env, '', await createSession(env, user.id));
}
export const onRequestGet = (ctx) => handle(ctx, new URL(ctx.request.url).searchParams);
export async function onRequestPost(ctx) { return handle(ctx, await ctx.request.formData()); }
