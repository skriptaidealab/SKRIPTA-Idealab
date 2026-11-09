// Preusmjerava na prijavu kod pružaoca (Google, Microsoft, Apple).
import { PROVIDERS, startUrl } from '../../../../_lib/oidc.js';
import { rateLimit, clientIp } from '../../../../_lib/auth.js';

export async function onRequestGet({ request, env, params }) {
  const p = String(params.provider), P = PROVIDERS[p];
  const site = new URL(env.SITE_URL);
  const here = new URL(request.url);
  if (!P || !P.enabled(env)) return new Response('Ova prijava nije uključena.', { status: 404 });
  // Kolač je vezan za jednu adresu: prijavu uvijek počinjemo na SITE_URL.
  if (here.host !== site.host) return Response.redirect(`${site.origin}${here.pathname}`, 302);
  if (!(await rateLimit(env, 'oauth-start:' + clientIp(request), 30, 600))) return new Response('Previše pokušaja.', { status: 429 });
  // Povratak u formu za rezervaciju: samo provjerene vrijednosti, nikad proizvoljan URL.
  const q = here.searchParams;
  let ret = '';
  if (q.get('nazad') === 'coffice') {
    const z = ['ind', 'lounge'].includes(q.get('zona')) ? q.get('zona') : '', d = /^\d{4}-\d{2}-\d{2}$/.test(q.get('datum') || '') ? q.get('datum') : '';
    ret = `c|${z}|${d}`;
  }
  return new Response(null, { status: 302, headers: { location: await startUrl(env, p, ret), 'cache-control': 'no-store' } });
}
