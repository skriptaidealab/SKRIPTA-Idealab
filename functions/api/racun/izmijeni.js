// Izmjena vlastite rezervacije iz računa. Samo ako je termin još slobodan (ista pravila kao nova rezervacija).
// Potvrđena rezervacija ostaje potvrđena, a ona koja čeka odluku ostaje na čekanju i ide nova poruka na odlučivanje.
import { json, clean, esc, makeToken } from '../../_lib/util.js';
import { guardPost, readJson, getUser, audit } from '../../_lib/auth.js';
import { NAMES, fmt, zoneLabel, priceText } from '../../_lib/rules.js';
import { tr, langOf } from '../../_lib/i18n.js';
import { mail, C } from '../../_lib/mail.js';
import { sendMail, createEvent, deleteEvent } from '../../_lib/graph.js';
import { googleUrl } from '../../_lib/cal.js';
import { aktivna, pocela, upit, slobodno, cijena, pctZa, sarajevoNow } from '../../_lib/izmjena.js';

const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;

export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  const user = await getUser(env, request); if (!user) return json({ ok: false, error: 'Prijavi se.' }, 401);
  const body = await readJson(request); if (!body) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  const b = await env.DB.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').bind(clean(body.id, 60), user.id).first();
  if (!b || !aktivna(b)) return json({ ok: false, error: 'Rezervacija nije pronađena ili nije aktivna.' }, 404);
  if (pocela(b, sarajevoNow())) return json({ ok: false, error: 'Termin je već počeo. Javi nam se na info@skripta.ba.' }, 400);

  const { q } = upit(b, body), start = +body.pocetak;
  if (!Number.isInteger(start)) return json({ ok: false, error: 'Odaberi vrijeme početka.' }, 400);
  if (q.date === b.date && start === b.start_min && q.dur === b.dur_h && q.zone === b.zone && q.persons === b.persons) return json({ ok: false, error: 'Nema promjene: termin je isti.' }, 400);
  const r = await slobodno(env, b, q);
  if (!r.ok) return json({ ok: false, error: r.error }, r.status);
  if (!r.starts.includes(start)) return json({ ok: false, conflict: true, error: 'Taj termin nije slobodan. Odaberi drugi.' }, 409);

  const { promo } = pctZa(b, q), sum = cijena(b, q, start, r.sch);
  const u = await env.DB.prepare("UPDATE bookings SET date = ?, start_min = ?, dur_h = ?, zone = ?, persons = ?, total = ?, promo = ?, reminded = 0 WHERE id = ? AND user_id = ? AND status IN ('pending','confirmed') AND checked_in_at IS NULL AND date = ? AND start_min = ? AND dur_h = ? AND zone = ? AND persons = ?")
    .bind(q.date, start, q.dur, q.zone, q.persons, sum, promo, b.id, user.id, b.date, b.start_min, b.dur_h, b.zone, b.persons).run();
  if (!u.meta || !u.meta.changes) return json({ ok: false, error: 'Rezervacija je u međuvremenu promijenjena. Osvježi stranicu.' }, 409);
  const n = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(b.id).first();
  await audit(env, user.id, 'rezervacija_izmijenjena', b.id);

  const potvrdjena = n.status === 'confirmed', lang = langOf(n);
  if (potvrdjena && n.event_id && n.event_id !== 'walkin') {
    try {
      await deleteEvent(env, n.event_id);
      const cancelUs = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, n.id, 'otkazi-mi')}`;
      const eventId = await createEvent(env, { subject: `Coffice: ${NAMES[n.zone]}, ${n.persons} os. (${n.name})`, html: `<p>${esc(n.name)}, ${esc(n.email)}${n.phone ? ', ' + esc(n.phone) : ''}<br>${priceText(n.total)}</p><p>Termin izmijenjen iz računa gosta.</p><p><a href="${cancelUs}">Otkaži ovu rezervaciju (mi otkazujemo)</a></p>`, date: n.date, startMin: n.start_min, endMin: n.start_min + n.dur_h * 60 });
      await env.DB.prepare('UPDATE bookings SET event_id = ? WHERE id = ?').bind(eventId, n.id).run();
    } catch (e) { console.error(e); }
  }
  const rows = [['Zona', zoneLabel(n)], ['Prije', whenOf(b)], ['Novi termin', whenOf(n)], ['Ukupno', n.flexi_paket_id ? 'FLEXI paket, bez doplate' : priceText(n.total)]];
  try {
    const guest = [['Ime', n.name], ['Email', n.email]];
    if (potvrdjena) {
      await sendMail(env, { to: env.MAILBOX, subject: `Gost izmijenio termin: ${NAMES[n.zone]}, ${whenOf(n)}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: 'Izmijenjeno', tone: 'ok', accent: C.teal, title: 'Gost je izmijenio termin iz računa.', lead: 'Termin je bio slobodan, pa je izmjena odmah potvrđena. Kalendar je ažuriran.', rows: [...rows, ...guest] }) });
    } else {
      const yes = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, n.id, 'potvrdi')}`, no = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, n.id, 'odbij')}`;
      await sendMail(env, { to: env.MAILBOX, replyTo: n.email, subject: `Izmijenjen zahtjev za rezervaciju: ${NAMES[n.zone]}, ${whenOf(n)}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: 'Čeka odluku', tone: 'wait', title: 'Gost je izmijenio zahtjev.', lead: 'Raniji zahtjev je zamijenjen ovim terminom. Termin je zauzet tek kad potvrdiš.', rows: [...rows, ...guest], buttons: [{ href: yes, label: 'Potvrdi i dodaj u kalendar' }, { href: no, label: 'Odbij', kind: 'ghost' }] }) });
    }
    if (n.email) {
      const cancel = `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, n.id, 'otkazi')}`;
      if (potvrdjena) {
        const icsUrl = `${env.SITE_URL}/api/kalendar?t=${await makeToken(env, n.id, 'kalendar')}`;
        await sendMail(env, { to: n.email, subject: tr(lang, 'Rezervacija izmijenjena: SKRIPTA Coffice'), html: mail({ lang, chip: 'Izmijenjeno', tone: 'ok', accent: C.teal, title: 'Termin je promijenjen.', lead: `${esc(n.name)}, tvoja rezervacija je izmijenjena. Novi termin je ispod. Ako ti ne odgovara, otkaži je ili nam se javi na info@skripta.ba.`, rows, buttons: [{ href: googleUrl(n), label: 'Dodaj u Google kalendar' }, { href: icsUrl, label: 'Apple / Outlook', kind: 'ghost' }, { href: cancel, label: 'Otkaži rezervaciju', kind: 'ghost' }] }) });
      } else {
        await sendMail(env, { to: n.email, subject: tr(lang, 'Zahtjev za rezervaciju izmijenjen'), html: mail({ lang, chip: 'Još nije potvrđeno', tone: 'wait', title: 'Zahtjev je izmijenjen.', lead: 'Tvoj zahtjev je izmijenjen. Termin je tvoj tek kad ti potvrdimo emailom.', rows, buttons: [{ href: cancel, label: 'Otkaži zahtjev', kind: 'ghost' }] }) });
      }
    }
  } catch (e) { console.error(e); }
  return json({ ok: true, potvrdjena, datum: n.date, od: fmt(n.start_min), do: fmt(n.start_min + n.dur_h * 60) });
}
