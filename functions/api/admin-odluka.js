import { makeToken } from '../_lib/util.js';
import { onRequestPost as odluka } from './odluka.js';

// Potvrda ili odbijanje zahtjeva s nadzorne ploče. Koristi istu logiku kao dugmad u mailu (api/odluka.js):
// provjera slobodnog termina, događaj u Outlooku, mail gostu. Ploča se potpisuje tajnom CRON_SECRET.
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const text = (h) => String(h).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export async function onRequestPost({ request, env }) {
  const key = (request.headers.get('x-cron-secret') || '').trim(), want = String(env.CRON_SECRET || '').trim();
  if (!want || key.length !== want.length || [...key].some((c, i) => c !== want[i])) return new Response('Forbidden', { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || ''), action = body.action;
  if (!id || !['potvrdi', 'odbij'].includes(action)) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  const form = new URLSearchParams({ t: await makeToken(env, id, action), razlog: String(body.razlog || ''), drugo: String(body.drugo || '') });
  const res = await odluka({ request: new Request(String(env.SITE_URL || 'https://www.skripta.ba').replace(/\/$/, '') + '/api/odluka', { method: 'POST', body: form }), env });
  const html = await res.text();
  const done = res.status === 200 && (html.includes('<h1>Potvrđeno</h1>') || html.includes('<h1>Zahtjev odbijen</h1>'));
  if (!done) return json({ ok: false, error: text(html).slice(0, 300) || 'Nije uspjelo.' }, res.status === 200 ? 409 : res.status);
  return json({ ok: true, calendar: !html.includes('Upozorenje') });
}
