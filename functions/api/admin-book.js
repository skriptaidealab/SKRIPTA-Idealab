import { checkQuery, tableFor, loadDay, loadSchedule, total, priceText, applyPromo, roundHalf, promoLine, NAMES, fmt, zoneLabel, sarajevoNow, BUFFER_MIN } from '../_lib/rules.js';
import { tr, langOf, cofficePage } from '../_lib/i18n.js';
import { esc, makeToken, newId, isEmail, clean } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { listBlocks, sendMail, createEvent } from '../_lib/graph.js';
import { googleUrl } from '../_lib/cal.js';
import { markOptIn, subscribeIfOptedIn } from '../_lib/newsletter.js';

// Ručno dodavanje rezervacije s nadzorne ploče popunjenosti. Rezervacija je odmah potvrđena (nema koraka odobravanja),
// termin ide u Outlook, a gost dobija isti mail potvrde kao nakon klika na „Potvrdi” u mailu zahtjeva.
// Pravila kao na sajtu: kapacitet zone, cijelo-prostorni najmi, trajanja 1/2/4/6/8 h, do 4 osobe, cijena po datumu.
// Radno vrijeme, rok unaprijed i raspon datuma se ne provjeravaju (osoblje odlučuje). Preklapanje se uvijek odbija (409), bez izuzetka.
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;

// Cijena s popustom: ili promo kod (ista pravila kao na sajtu), ili ručni popust u %, ili ručno upisana konačna cijena. Samo jedno od tri.
// Vraća { sum, base, promo } (promo = oznaka za kolonu promo, ili null ako popust ništa ne mijenja) ili { error }.
async function priced(env, b, q, start, email, phone) {
  const sch = await loadSchedule(env), base = total(q.zone, q.dur, q.persons, q.date, 0, start, sch);
  const kod = clean(b.kod, 30), pct = b.popust === '' || b.popust == null ? null : Number(b.popust), fix = b.cijena === '' || b.cijena == null ? null : Number(b.cijena);
  if ([kod, pct !== null, fix !== null].filter(Boolean).length > 1) return { error: 'Upiši samo jedno: promo kod, popust u % ili konačnu cijenu.' };
  if (kod) {
    const ap = await applyPromo(env, kod, { ...q, email, phone });
    if (!ap.ok) return { error: ap.error };
    const sum = total(q.zone, q.dur, q.persons, q.date, ap.pct, start, sch);
    return { sum, base, promo: sum < base ? ap.code : null };
  }
  if (pct !== null) {
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return { error: 'Popust mora biti između 0 i 100 %.' };
    const sum = Math.max(0, roundHalf(base * (1 - pct / 100)));
    return { sum, base, promo: sum < base ? 'RUČNO' : null };
  }
  if (fix !== null) {
    if (!Number.isFinite(fix) || fix < 0) return { error: 'Cijena mora biti 0 ili veća.' };
    const sum = roundHalf(fix);
    return { sum, base, promo: sum < base ? 'RUČNO' : null };
  }
  return { sum: base, base, promo: null };
}

export async function onRequestPost({ request, env }) {
  const key = (request.headers.get('x-cron-secret') || '').trim(), want = String(env.CRON_SECRET || '').trim();
  if (!want || key.length !== want.length || [...key].some((c, i) => c !== want[i])) return new Response('Forbidden', { status: 403 });
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }

  const q = { zone: clean(b.zona, 10), dur: +b.trajanje, persons: +b.osobe || 1, date: clean(b.datum, 10) };
  if (b.cijena_provjera) { // pregled cijene za formu (bez upisa)
    const st = Number.isInteger(+b.pocetak) && b.pocetak !== '' && b.pocetak != null ? +b.pocetak : null;
    if (checkQuery({ ...q, date: sarajevoNow().date }) && /^(Nepoznata zona|Nepoznato trajanje|Neispravan broj osoba)/.test(checkQuery({ ...q, date: sarajevoNow().date }))) return json({ ok: false, error: 'Neispravan upit.' }, 400);
    try { const r = await priced(env, b, q, st, clean(b.email, 160).toLowerCase(), clean(b.telefon, 40)); return r.error ? json({ ok: false, error: r.error }) : json({ ok: true, base: r.base, total: r.sum }); } catch (e) { console.error(e); return json({ ok: false, error: 'Provjera nije uspjela.' }, 503); }
  }
  if (b.provjera) { // slobodni počeci za formu (08:00 do 21:00, korak 30 min), isti kriterij kao pri upisu
    const bad = checkQuery({ ...q, date: sarajevoNow().date });
    if ((bad && /^(Nepoznata zona|Nepoznato trajanje|Neispravan broj osoba)/.test(bad)) || !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return json({ ok: false, error: 'Neispravan upit.', starts: [] }, 400);
    let d; try { d = await loadDay(env, q.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Kalendar trenutno nije dostupan.', starts: [] }, 503); }
    const n = sarajevoNow(), starts = [];
    if (q.date >= n.date) for (let s = 8 * 60; s + q.dur * 60 <= 21 * 60; s += 30) {
      const e = s + q.dur * 60;
      if (q.date === n.date && s + 30 <= n.min) continue;
      if (tableFor(q, s, d.bookings) < 0) continue;
      if (d.blocks.some((x) => s < x.end_min + BUFFER_MIN && e > x.start_min - BUFFER_MIN)) continue;
      starts.push(s);
    }
    return json({ ok: true, starts });
  }
  const start = +b.pocetak, name = clean(b.ime, 100), email = clean(b.email, 160).toLowerCase(), phone = clean(b.telefon, 40);
  const now = sarajevoNow();
  let err = null;
  if (!name) err = 'Upiši ime.';
  else if (!isEmail(email)) err = 'Upiši ispravan e-mail.';
  else if (phone && (!/^\+?[\d\s().\/-]{6,}$/.test(phone) || phone.replace(/\D/g, '').length < 8 || phone.replace(/\D/g, '').length > 15)) err = 'Telefon nije ispravan.';
  else if (!Number.isInteger(start) || start < 0 || start >= 24 * 60 || start % 15) err = 'Neispravno vrijeme početka.';
  else {
    // Isto što i na sajtu (zona, trajanje, broj osoba, datum), ali bez ograničenja radnog vremena i raspona datuma.
    // checkQuery vraća i greške o datumu (nedjelja, raspon): za datum se zato provjeravaju samo zona, trajanje i broj osoba, a preko današnjeg datuma.
    err = checkQuery({ ...q, date: now.date });
    if (err && !/^(Nepoznata zona|Nepoznato trajanje|Neispravan broj osoba)/.test(err)) err = null;
    if (!err && !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) err = 'Neispravan datum.';
    if (!err && (q.date < now.date || (q.date === now.date && start + q.dur * 60 <= now.min))) err = 'Termin je već prošao.';
  }
  if (err) return json({ ok: false, error: err }, 400);

  let day;
  try { day = await loadDay(env, q.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Kalendar trenutno nije dostupan. Pokušaj ponovo.' }, 503); }
  const end = start + q.dur * 60, issues = [];
  if (tableFor(q, start, day.bookings) < 0) issues.push(`${NAMES[q.zone]} nema dovoljno slobodnih mjesta u tom terminu`);
  if (day.blocks.some((x) => start < x.end_min + BUFFER_MIN && end > x.start_min - BUFFER_MIN)) issues.push('cijeli prostor je zauzet (najam)');
  if (issues.length) return json({ ok: false, conflict: true, error: issues.join('; ') }, 409);

  let pr; try { pr = await priced(env, b, q, start, email, phone); } catch (e) { console.error(e); return json({ ok: false, error: 'Provjera cijene nije uspjela. Pokušaj ponovo.' }, 503); }
  if (pr.error) return json({ ok: false, error: pr.error }, 400);
  const id = newId(), sum = pr.sum; // rasporedni popusti važe i za ručne rezervacije
  // Kolona promo dolazi iz migrations/2026-11-06-promo.sql; bez popusta ide stari upis.
  if (pr.promo) await env.DB.prepare("INSERT INTO bookings (id, created_at, status, zone, persons, date, start_min, dur_h, total, name, email, phone, promo) VALUES (?,?,'confirmed',?,?,?,?,?,?,?,?,?,?)")
    .bind(id, new Date().toISOString(), q.zone, q.persons, q.date, start, q.dur, sum, name, email, phone || null, pr.promo).run();
  else await env.DB.prepare("INSERT INTO bookings (id, created_at, status, zone, persons, date, start_min, dur_h, total, name, email, phone) VALUES (?,?,'confirmed',?,?,?,?,?,?,?,?,?)")
    .bind(id, new Date().toISOString(), q.zone, q.persons, q.date, start, q.dur, sum, name, email, phone || null).run();
  const r = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
  if (b.newsletter === true) { await markOptIn(env, id); await subscribeIfOptedIn(env, r); } // samo ako je osoblje označilo da je gost pristao

  let calendar = true, mailed = true, eventId = null;
  const cancelUs = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, id, 'otkazi-mi')}`;
  try {
    eventId = await createEvent(env, { subject: `Coffice: ${NAMES[r.zone]}, ${r.persons} os. (${r.name})`, html: `<p>${esc(r.name)}, ${esc(r.email)}${r.phone ? ', ' + esc(r.phone) : ''}<br>${priceText(r.total)}${pr.promo ? ' (' + promoLine(r) + ')' : ''}</p><p>Dodano ručno sa nadzorne ploče.</p><p><a href="${cancelUs}">Otkaži ovu rezervaciju (mi otkazujemo)</a></p>`, date: r.date, startMin: r.start_min, endMin: r.start_min + r.dur_h * 60 });
    await env.DB.prepare('UPDATE bookings SET event_id = ? WHERE id = ?').bind(eventId, id).run();
  } catch (e) { console.error(e); calendar = String(e.message || e); }

  try {
    const cancel = `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, id, 'otkazi')}`;
    const icsUrl = `${env.SITE_URL}/api/kalendar?t=${await makeToken(env, id, 'kalendar')}`;
    await sendMail(env, { to: r.email, subject: tr(langOf(r), 'Rezervacija potvrđena: SKRIPTA Coffice'), html: mail({ lang: langOf(r), chip: 'Potvrđeno', tone: 'ok', accent: C.teal, title: 'Vidimo se.', lead: `Tvoja rezervacija je potvrđena, ${esc(r.name)}.`, rows: [['Zona', zoneLabel(r)], ['Termin', whenOf(r)], ...(pr.promo ? [['Popust', promoLine(r)]] : []), ['Ukupno', priceText(r.total)]], buttons: [{ href: googleUrl(r), label: 'Dodaj u Google kalendar' }, { href: icsUrl, label: 'Apple / Outlook', kind: 'ghost' }, { href: cancel, label: 'Otkaži rezervaciju', kind: 'ghost' }], note: r.total === 0 ? 'Kafa ili čaj su besplatni.' : 'Plaćanje je po dolasku, gotovinom ili karticom. Kafa ili čaj su besplatni.' }) });
  } catch (e) { console.error(e); mailed = String(e.message || e); }
  return json({ ok: true, id, calendar, mail: mailed });
}
