// Produženje trenutnog termina iz portala. Dozvoljeno samo gostu kojeg je osoblje označilo kao stigao,
// samo za današnji termin, samo ako je sljedeći sat slobodan i unutar radnog vremena.
import { json, clean, esc, newId } from '../../_lib/util.js';
import { tr, langOf, cofficePage } from '../../_lib/i18n.js';
import { guardPost, readJson, getUser, audit, rateLimit } from '../../_lib/auth.js';
import { NAMES, PRICES, fmt, sarajevoNow, loadDay, loadSchedule, hoursOf, tableFor, total, kmNum, BUFFER_MIN, zoneLabel } from '../../_lib/rules.js';
import { listBlocks, sendMail, createEvent, deleteEvent } from '../../_lib/graph.js';
import { mail, C } from '../../_lib/mail.js';
import { OPCIJE, ocijeni } from '../../_lib/produzenje.js';

export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  const user = await getUser(env, request); if (!user) return json({ ok: false, error: 'Prijavi se.' }, 401);
  if (!(await rateLimit(env, 'produzi:' + user.id, 20, 3600))) return json({ ok: false, error: 'Previše pokušaja.' }, 429);
  const body = await readJson(request); if (!body) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  const lang = body.lang === 'en' ? 'en' : 'bs';
  const zona = body.zona === 'ind' || body.zona === 'lounge' ? body.zona : null;
  const add = Number(body.sati || 1);
  if (!OPCIJE.includes(add)) return json({ ok: false, error: 'Možeš produžiti za 1, 2, 4 ili 6 sati.' }, 400);

  const b = await env.DB.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').bind(clean(body.id, 60), user.id).first();
  if (!b || b.status !== 'confirmed') return json({ ok: false, error: 'Rezervacija nije pronađena.' }, 404);
  const now = sarajevoNow(), oldEnd = b.start_min + b.dur_h * 60, newEnd = oldEnd + add * 60;
  // Klijent šalje kraj koji vidi na ekranu: dupli klik ili drugi uređaj ne mogu produžiti dvaput.
  if (String(body.kraj || '') !== fmt(oldEnd)) return json({ ok: false, error: 'Termin je već promijenjen. Osvježi stranicu.' }, 409);
  if (!b.checked_in_at || b.left_at || b.no_show) return json({ ok: false, error: 'Produženje je moguće kad te osoblje označi kao stigao/la.' }, 400);
  if (b.date !== now.date || oldEnd <= now.min) return json({ ok: false, error: 'Moguće je produžiti samo termin koji je u toku.' }, 400);
  if (!PRICES[zona || b.zone] || PRICES[zona || b.zone][add] === undefined) return json({ ok: false, error: 'Produženje za ovu zonu nije moguće.' }, 400);

  const sch = await loadSchedule(env);
  let day;
  try { day = await loadDay(env, b.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Termini trenutno nisu dostupni. Javi se osoblju.' }, 503); }
  const o = ocijeni(b, add, sch, day, zona || b.zone);
  if (!o.ok) return json({ ok: false, ...(o.conflict ? { conflict: true } : {}), error: o.error }, o.status);
  const extra = o.extra;
  if (zona && zona !== b.zone) return nastavakUDrugojZoni({ env, user, b, add, o, lang });
  // Uvjet na staro trajanje: dva istovremena zahtjeva ne mogu oba proći.
  const r = await env.DB.prepare("UPDATE bookings SET dur_h = dur_h + ?, total = total + ?, end_reminded = 0 WHERE id = ? AND user_id = ? AND status = 'confirmed' AND dur_h = ?").bind(add, extra, b.id, user.id, b.dur_h).run();
  if (!r.meta || !r.meta.changes) return json({ ok: false, error: 'Termin je u međuvremenu promijenjen. Osvježi stranicu.' }, 409);
  await audit(env, user.id, 'rezervacija_produzena', b.id + ' +' + add + 'h');

  const nb = { ...b, dur_h: b.dur_h + add, total: b.total + extra };
  try {
    if (b.event_id && b.event_id !== 'walkin' && !env.OUTLOOK_OFF) {
      await deleteEvent(env, b.event_id);
      const id = await createEvent(env, { subject: `Coffice: ${NAMES[b.zone]}, ${b.persons} os. (${b.name})`, html: `<p>${esc(b.name)}, ${esc(b.email)}<br>Produženo iz računa.</p>`, date: b.date, startMin: b.start_min, endMin: newEnd });
      await env.DB.prepare('UPDATE bookings SET event_id = ? WHERE id = ?').bind(id, b.id).run();
    }
  } catch (e) { console.error(e); }
  const nowEnd = fmt(newEnd), pay = extra === 0 ? 'Besplatno.' : `${kmNum(extra)} KM, plaćanje po dolasku.`;
  const rows = [['Zona', zoneLabel(b)], ['Novi kraj', nowEnd], ['Dodatno', pay]];
  try {
    await sendMail(env, { to: env.MAILBOX, subject: `Gost produžio: ${NAMES[b.zone]}, do ${nowEnd}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: 'Produženo', tone: 'info', title: 'Gost je produžio termin.', rows: [['Ime', b.name], ...rows, ['Ukupno', `${kmNum(nb.total)} KM`]] }) });
    await sendMail(env, { to: user.email, subject: tr(lang, 'Termin produžen: SKRIPTA Coffice'), html: mail({ lang: lang, chip: 'Produženo', tone: 'ok', accent: C.teal, title: `Ostaješ do ${nowEnd}.`, rows }) });
  } catch (e) { console.error(e); }
  return json({ ok: true, do: nowEnd, dodatno: extra });
}

// Nastavak u drugoj zoni: originalni termin ostaje do svog kraja, a od tog trenutka počinje nova potvrđena rezervacija u drugoj zoni.
async function nastavakUDrugojZoni({ env, user, b, add, o, lang }) {
  const id = newId(), from = o.oldEnd, now = new Date().toISOString();
  const dup = await env.DB.prepare("SELECT id FROM bookings WHERE user_id = ? AND date = ? AND start_min = ? AND zone = ? AND status = 'confirmed'").bind(user.id, b.date, from, o.zona).first();
  if (dup) return json({ ok: false, error: 'Termin je već promijenjen. Osvježi stranicu.' }, 409);
  await env.DB.prepare("INSERT INTO bookings (id, created_at, status, zone, persons, date, start_min, dur_h, total, name, email, phone, user_id, checked_in_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, now, 'confirmed', o.zona, b.persons, b.date, from, add, o.extra, b.name, b.email, b.phone || null, user.id, now).run();
  // Dva istovremena zahtjeva: ostaje samo prva.
  const all = (await env.DB.prepare("SELECT id FROM bookings WHERE user_id = ? AND date = ? AND start_min = ? AND zone = ? AND status = 'confirmed' ORDER BY id").bind(user.id, b.date, from, o.zona).all()).results || [];
  if (all.length > 1 && all[0].id !== id) { await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run(); return json({ ok: false, error: 'Termin je već promijenjen. Osvježi stranicu.' }, 409); }
  if (all.length > 1) await env.DB.prepare('DELETE FROM bookings WHERE id IN (' + all.slice(1).map(() => '?').join(',') + ')').bind(...all.slice(1).map((x) => x.id)).run();
  if (lang === 'en') { try { await env.DB.prepare("UPDATE bookings SET lang = 'en' WHERE id = ?").bind(id).run(); } catch (e) { console.error('lang', e); } }
  await audit(env, user.id, 'nastavak_druga_zona', b.id + ' -> ' + id + ' ' + o.zona + ' +' + add + 'h');
  try {
    if (!env.OUTLOOK_OFF) {
      const ev = await createEvent(env, { subject: `Coffice: ${NAMES[o.zona]}, ${b.persons} os. (${b.name})`, html: `<p>${esc(b.name)}, ${esc(b.email)}<br>Nastavak iz računa (prije: ${esc(NAMES[b.zone])}).</p>`, date: b.date, startMin: from, endMin: o.newEnd });
      await env.DB.prepare('UPDATE bookings SET event_id = ? WHERE id = ?').bind(ev, id).run();
    }
  } catch (e) { console.error(e); }
  const pay = o.extra === 0 ? 'Besplatno.' : `${kmNum(o.extra)} KM, plaćanje po dolasku.`;
  const rows = [['Zona', zoneLabel({ zone: o.zona, persons: b.persons })], ['Termin', `${fmt(from)} do ${fmt(o.newEnd)}`], ['Dodatno', pay]];
  try {
    await sendMail(env, { to: env.MAILBOX, subject: `Gost prelazi u ${NAMES[o.zona]}, ${fmt(from)} do ${fmt(o.newEnd)}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: 'Produženo', tone: 'info', title: 'Gost nastavlja u drugoj zoni.', rows: [['Ime', b.name], ['Prije', zoneLabel(b)], ...rows] }) });
    await sendMail(env, { to: user.email, subject: tr(lang, 'Nastavak u drugoj zoni: SKRIPTA Coffice'), html: mail({ lang, chip: 'Produženo', tone: 'ok', accent: C.teal, title: `Od ${fmt(from)} nastavljaš u: ${NAMES[o.zona]}.`, rows }) });
  } catch (e) { console.error(e); }
  return json({ ok: true, do: fmt(o.newEnd), zona: o.zona, dodatno: o.extra });
}
