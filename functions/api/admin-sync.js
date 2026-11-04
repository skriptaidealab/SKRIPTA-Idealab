import { NAMES } from '../_lib/rules.js';
import { createEvent, deleteEvent } from '../_lib/graph.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  const key = (request.headers.get('x-cron-secret') || '').trim(), want = String(env.CRON_SECRET || '').trim();
  if (!want || key.length !== want.length || [...key].some((c, i) => c !== want[i])) return new Response('Forbidden', { status: 403 });
  const body = await request.json().catch(() => ({}));
  const b = body.id && await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(String(body.id)).first();
  if (!b) return json({ ok: false, error: 'not found' }, 404);
  const real = b.event_id && b.event_id !== 'walkin';
  const endMin = b.start_min + b.dur_h * 60;
  try {
    if (b.status === 'cancelled') {
      if (real) await deleteEvent(env, b.event_id);
      return json({ ok: true, action: real ? 'deleted' : 'none' });
    }
    if (b.status !== 'confirmed') return json({ ok: true, action: 'skipped' });
    if (real) await deleteEvent(env, b.event_id);
    const id = await createEvent(env, {
      subject: 'Coffice: ' + NAMES[b.zone] + ', ' + b.persons + ' os. (' + b.name + ')',
      html: '<p>Termin uređen sa nadzorne ploče popunjenosti.</p>',
      date: b.date, startMin: b.start_min, endMin
    });
    await env.DB.prepare('UPDATE bookings SET event_id = ? WHERE id = ?').bind(id, b.id).run();
    return json({ ok: true, action: real ? 'replaced' : 'created' });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: String(e.message || e) }, 500);
  }
}
