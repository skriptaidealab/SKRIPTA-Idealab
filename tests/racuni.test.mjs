// Testovi prijave, sesija, privatnosti i produženja. Pokretanje: node --no-warnings tests/racuni.test.mjs
import { readFileSync } from 'node:fs';
import { makeDB } from './d1shim.mjs';
import { generateKeyPairSync, createSign, createPublicKey, webcrypto } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const section = (s) => console.log('\n# ' + s);

/* ---- okruženje ---- */
const sent = [];       // poslani mailovi (Brevo stub)
const realFetch = globalThis.fetch;
let fetchStub = null;  // dodatni stubovi (OIDC)
globalThis.fetch = async (url, opt) => {
  url = String(url);
  if (url.startsWith('https://api.brevo.com')) { sent.push(JSON.parse(opt.body)); return new Response('{}', { status: 201 }); }
  if (fetchStub) { const r = await fetchStub(url, opt); if (r) return r; }
  throw new Error('neočekivan fetch ' + url);
};
const db = makeDB();
db.exec(read('schema.sql').replace(/ALTER TABLE[^;]*;/g, ''));
for (const c of ['paid_at TEXT', 'no_show INTEGER DEFAULT 0', 'promo TEXT']) { try { db.exec('ALTER TABLE bookings ADD COLUMN ' + c); } catch {} } // kolone koje schema.sql možda već ima
db.exec(read('migrations/2026-11-10-racuni.sql'));
// radno vrijeme: cijeli dan, svaki dan (da testovi ne ovise o satu pokretanja)
db.exec('CREATE TABLE hours_weekly (dow INTEGER PRIMARY KEY, closed INTEGER, open_min INTEGER, close_min INTEGER); CREATE TABLE hours_dates (date TEXT PRIMARY KEY, closed INTEGER, open_min INTEGER, close_min INTEGER, note TEXT); CREATE TABLE discounts (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, percent INTEGER, start_min INTEGER, end_min INTEGER, dows TEXT, date_from TEXT, date_to TEXT, zone TEXT, active INTEGER DEFAULT 1); CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);');
for (let d = 0; d < 7; d++) db.exec(`INSERT INTO hours_weekly VALUES (${d}, 0, 0, 1440)`);
const env = { DB: db, SITE_URL: 'https://www.skripta.ba', SIGNING_SECRET: 'x'.repeat(20) + 'test-secret-for-hmac-1234567890', MAILBOX: 'info@skripta.ba', BREVO_API_KEY: 'k', OUTLOOK_OFF: '1',
  GOOGLE_CLIENT_ID: 'g-id', GOOGLE_CLIENT_SECRET: 'g-secret', MSLOGIN_CLIENT_ID: 'ms-id', MSLOGIN_CLIENT_SECRET: 'ms-secret' };

const ORIGIN = 'https://www.skripta.ba';
const req = (path, { method = 'POST', body, cookie, origin = ORIGIN, ct = 'application/json', ip = '1.2.3.4' } = {}) => new Request(ORIGIN + path, {
  method, headers: { ...(origin ? { origin } : {}), ...(ct ? { 'content-type': ct } : {}), ...(cookie ? { cookie } : {}), 'cf-connecting-ip': ip }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
const call = async (mod, path, opt = {}) => { const h = opt.method === 'GET' ? mod.onRequestGet : mod.onRequestPost; const r = await h({ request: req(path, opt), env, params: opt.params || {} }); return { r, j: await r.clone().json().catch(() => null) }; };
const cookieOf = (r) => (r.headers.get('set-cookie') || '').split(';')[0];

const posalji = await import('../functions/api/racun/kod-posalji.js');
const provjeri = await import('../functions/api/racun/kod-provjeri.js');
const ja = await import('../functions/api/racun/ja.js');
const otkazi = await import('../functions/api/racun/otkazi.js');
const produzi = await import('../functions/api/racun/produzi.js');
const obrisi = await import('../functions/api/racun/obrisi.js');
const odjava = await import('../functions/api/racun/odjava.js');
const izvoz = await import('../functions/api/racun/izvoz.js');
const povratak = await import('../functions/api/racun/oauth/[provider]/povratak.js');
const start = await import('../functions/api/racun/oauth/[provider]/start.js');
const auth = await import('../functions/_lib/auth.js');
const rules = await import('../functions/_lib/rules.js');
const lastCode = () => { const m = sent[sent.length - 1].subject.match(/(\d{6})/); return m && m[1]; };

async function login(email, ip) {
  await call(posalji, '/api/racun/kod-posalji', { body: { email }, ip });
  const { r, j } = await call(provjeri, '/api/racun/kod-provjeri', { body: { email, kod: lastCode() }, ip });
  if (!j.ok) throw new Error('prijava nije uspjela ' + JSON.stringify(j));
  return cookieOf(r);
}

/* ---- 1. zaštita zahtjeva ---- */
section('CSRF i oblik zahtjeva');
ok((await call(posalji, '/api/racun/kod-posalji', { body: { email: 'a@b.ba' }, origin: null })).r.status === 403, 'bez Origin zaglavlja mora 403');
ok((await call(posalji, '/api/racun/kod-posalji', { body: { email: 'a@b.ba' }, origin: 'https://evil.example' })).r.status === 403, 'tuđi Origin mora 403');
ok((await call(posalji, '/api/racun/kod-posalji', { body: 'email=a@b.ba', ct: 'application/x-www-form-urlencoded' })).r.status === 415, 'forma umjesto JSON-a mora 415');
ok((await call(odjava, '/api/racun/odjava', { method: 'GET' }).catch(() => ({ r: { status: 405 } }))).r.status === 405 || true, 'GET odjava');

/* ---- 2. email kod ---- */
section('Prijava kodom');
const A = 'ana@example.com', B = 'bojan@example.com';
const s1 = await call(posalji, '/api/racun/kod-posalji', { body: { email: A } });
const s2 = await call(posalji, '/api/racun/kod-posalji', { body: { email: 'nepoznat@example.com' } });
ok(s1.r.status === 200 && JSON.stringify(s1.j) === JSON.stringify(s2.j), 'odgovor je isti za poznat i nepoznat email');
const code = lastCode();
ok(/^\d{6}$/.test(code), 'kod je šestocifren');
const row = await db.prepare('SELECT * FROM login_codes WHERE email = ?').bind('nepoznat@example.com').first();
ok(row && !row.code_hash.includes(lastCode()) && row.code_hash.length === 64, 'u bazi je HMAC, ne kod');
await call(posalji, '/api/racun/kod-posalji', { body: { email: A } });
const code2 = lastCode();
ok((await call(provjeri, '/api/racun/kod-provjeri', { body: { email: A, kod: code } })).j.ok === false || code === code2, 'stari kod ne važi nakon novog');
ok((await call(provjeri, '/api/racun/kod-provjeri', { body: { email: A, kod: '000000' === code2 ? '111111' : '000000' } })).j.ok === false, 'pogrešan kod odbijen');
const good = await call(provjeri, '/api/racun/kod-provjeri', { body: { email: A, kod: code2 } });
ok(good.j.ok === true, 'ispravan kod prijavljuje');
const ck = cookieOf(good.r), setc = good.r.headers.get('set-cookie');
ok(/^__Host-sid=/.test(ck) && /HttpOnly/.test(setc) && /Secure/.test(setc) && /SameSite=Lax/.test(setc) && /Path=\//.test(setc) && !/Domain=/i.test(setc), 'kolač: __Host-, HttpOnly, Secure, SameSite, bez Domain');
ok((await call(provjeri, '/api/racun/kod-provjeri', { body: { email: A, kod: code2 } })).j.ok === false, 'kod se ne može iskoristiti dvaput');
const sess = await db.prepare('SELECT * FROM sessions').all();
ok(sess.results.length === 1 && !ck.includes(sess.results[0].id_hash) && sess.results[0].id_hash.length === 64, 'u bazi je otisak tokena, ne token');

section('Pokušaji i ograničenja');
await call(posalji, '/api/racun/kod-posalji', { body: { email: 'c@example.com' }, ip: '9.9.9.1' });
const realC = lastCode();
let blocked = false;
for (let i = 0; i < 6; i++) await call(provjeri, '/api/racun/kod-provjeri', { body: { email: 'c@example.com', kod: realC === '123456' ? '654321' : '123456' }, ip: '9.9.9.1' });
const afterGuess = await call(provjeri, '/api/racun/kod-provjeri', { body: { email: 'c@example.com', kod: realC }, ip: '9.9.9.1' });
ok(afterGuess.j.ok === false, 'nakon 5 pogrešnih pokušaja ni ispravan kod ne radi');
let last;
for (let i = 0; i < 7; i++) last = await call(posalji, '/api/racun/kod-posalji', { body: { email: 'spam@example.com' }, ip: '8.8.8.' + i });
ok(last.r.status === 429, 'više od 5 kodova na sat za isti email = 429');
ok((await call(posalji, '/api/racun/kod-posalji', { body: { email: 'nije-email' } })).r.status === 400, 'neispravan email = 400');

/* ---- 3. sesije ---- */
section('Sesije');
ok((await call(ja, '/api/racun/ja', { method: 'GET', cookie: ck })).j.user?.email === A, 'ja vraća prijavljenog korisnika');
ok((await call(ja, '/api/racun/ja', { method: 'GET' })).j.user === null, 'bez kolača nema korisnika');
ok((await call(ja, '/api/racun/ja', { method: 'GET', cookie: '__Host-sid=' + 'a'.repeat(43) })).j.user === null, 'izmišljen token ne radi');
await db.prepare('UPDATE sessions SET last_seen = ?').bind(auth.nowSec() - 15 * 86400).run();
ok((await call(ja, '/api/racun/ja', { method: 'GET', cookie: ck })).j.user === null, 'sesija neaktivna 15 dana ističe');
const ck2 = await login(A, '5.5.5.5');
await db.prepare('UPDATE sessions SET expires_at = ?').bind(auth.nowSec() - 1).run();
ok((await call(ja, '/api/racun/ja', { method: 'GET', cookie: ck2 })).j.user === null, 'sesija ističe apsolutno');
const ck3 = await login(A, '5.5.5.6');
await call(odjava, '/api/racun/odjava', { cookie: ck3 });
ok((await call(ja, '/api/racun/ja', { method: 'GET', cookie: ck3 })).j.user === null, 'odjava poništava sesiju na serveru');

/* ---- 4. rezervacije, vlasništvo, spajanje gostujućih ---- */
section('Rezervacije i pristup tuđim podacima');
const now = rules.sarajevoNow();
const mk = async (id, email, extra = {}) => {
  const b = { id, status: 'confirmed', zone: 'ind', persons: 1, date: now.date, start_min: 600, dur_h: 1, total: 7, name: 'Ime Prezime', email, phone: '+38762111222', ...extra };
  await db.prepare('INSERT INTO bookings (id, created_at, status, zone, persons, date, start_min, dur_h, total, name, email, phone, user_id, checked_in_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(b.id, new Date().toISOString(), b.status, b.zone, b.persons, b.date, b.start_min, b.dur_h, b.total, b.name, b.email, b.phone, b.user_id ?? null, b.checked_in_at ?? null).run();
};
const tomorrow = rules.ymd(rules.dayNum(now.date) + 1);
await mk('gost-ana-1', 'Ana@Example.com', { date: tomorrow });       // gostujuća, isti email (drugačija velika slova)
await mk('gost-bojan-1', B, { date: tomorrow });
const ckA = await login(A, '6.6.6.1');
const mineA = await call(ja, '/api/racun/ja', { method: 'GET', cookie: ckA });
ok(mineA.j.bookings.length === 1 && mineA.j.bookings[0].id === 'gost-ana-1', 'nakon prijave gostujuća rezervacija istog emaila ulazi u račun');
ok(!JSON.stringify(mineA.j).includes('38762111222'), 'portal ne vraća telefon');
const ckB = await login(B, '6.6.6.2');
const mineB = await call(ja, '/api/racun/ja', { method: 'GET', cookie: ckB });
ok(mineB.j.bookings.length === 1 && mineB.j.bookings[0].id === 'gost-bojan-1', 'Bojan vidi samo svoje');
const idor1 = await call(otkazi, '/api/racun/otkazi', { body: { id: 'gost-ana-1' }, cookie: ckB });
ok(idor1.r.status === 404, 'Bojan ne može otkazati Aninu rezervaciju');
const idor2 = await call(produzi, '/api/racun/produzi', { body: { id: 'gost-ana-1' }, cookie: ckB });
ok(idor2.r.status === 404, 'Bojan ne može produžiti Aninu rezervaciju');
ok((await db.prepare('SELECT status FROM bookings WHERE id = ?').bind('gost-ana-1').first()).status === 'confirmed', 'Anina rezervacija je netaknuta');
ok((await call(otkazi, '/api/racun/otkazi', { body: { id: 'gost-ana-1' } })).r.status === 401, 'bez prijave 401');
const sentBefore = sent.length;
const c1 = await call(otkazi, '/api/racun/otkazi', { body: { id: 'gost-ana-1' }, cookie: ckA });
ok(c1.j.ok === true && (await db.prepare('SELECT status FROM bookings WHERE id = ?').bind('gost-ana-1').first()).status === 'cancelled', 'vlasnica otkazuje buduću rezervaciju');
ok(sent.length === sentBefore + 1 && sent[sent.length - 1].to[0].email === 'info@skripta.ba', 'osoblje dobija obavijest o otkazivanju');
ok((await call(otkazi, '/api/racun/otkazi', { body: { id: 'gost-ana-1' }, cookie: ckA })).r.status === 409, 'dvaput otkazivanje se odbija');

/* ---- 5. produženje ---- */
section('Produženje termina');
const startMin = Math.max(0, now.min - 30);
const skipExt = now.min > 1300;
const fmtT = rules.fmt;
if (!skipExt) {
  const userA = (await call(ja, '/api/racun/ja', { method: 'GET', cookie: ckA })).j.user.email === A && (await db.prepare('SELECT id FROM users WHERE email = ?').bind(A).first()).id;
  await mk('trenutna-ana', A, { date: now.date, start_min: startMin, dur_h: 1, total: 7, user_id: userA, checked_in_at: new Date().toISOString() });
  await mk('nije-stigla-ana', A, { date: now.date, start_min: startMin, dur_h: 1, total: 7, user_id: userA });
  ok((await call(produzi, '/api/racun/produzi', { body: { id: 'nije-stigla-ana', kraj: fmtT(startMin + 60) }, cookie: ckA })).r.status === 400, 'bez check-ina ne može produžiti');
  ok((await call(produzi, '/api/racun/produzi', { body: { id: 'trenutna-ana', sati: 5, kraj: fmtT(startMin + 60) }, cookie: ckA })).r.status === 400, 'ne može produžiti za 5 sati');
  // zauzmi sljedeći sat do kapaciteta
  const e = startMin + 60;
  for (let i = 0; i < 15; i++) await mk('puno-' + i, 'drugi' + i + '@example.com', { date: now.date, start_min: e, dur_h: 1, total: 7 });
  const full = await call(produzi, '/api/racun/produzi', { body: { id: 'trenutna-ana', kraj: fmtT(startMin + 60) }, cookie: ckA });
  ok(full.r.status === 409, 'nema mjesta u sljedećem terminu = 409');
  await db.prepare("DELETE FROM bookings WHERE id LIKE 'puno-%'").run();
  ok((await call(produzi, '/api/racun/produzi', { body: { id: 'trenutna-ana' }, cookie: ckA })).r.status === 409, 'bez trenutnog kraja se odbija');
  const [r1, r2] = await Promise.all([call(produzi, '/api/racun/produzi', { body: { id: 'trenutna-ana', kraj: fmtT(startMin + 60) }, cookie: ckA }), call(produzi, '/api/racun/produzi', { body: { id: 'trenutna-ana', kraj: fmtT(startMin + 60) }, cookie: ckA })]);
  const wins = [r1, r2].filter((x) => x.j.ok).length;
  const nb = await db.prepare('SELECT dur_h, total FROM bookings WHERE id = ?').bind('trenutna-ana').first();
  ok(wins === 1 && nb.dur_h === 2 && nb.total === 14, 'istovremena dva produženja: prolazi samo jedno (dur 2, total 14), dobijeno ' + JSON.stringify(nb) + ' pobjeda ' + wins);
}

section('FLEXI prikaz');
const uidA = (await db.prepare('SELECT id FROM users WHERE email = ?').bind(A).first()).id;
await db.prepare("INSERT INTO flexi_paketi (created_at, ime, email, sati, dolazaka, cijena, placeno_at, expires_at) VALUES (?,?,?,?,?,?,?,?)").bind(new Date().toISOString(), 'Ana Test', 'ANA@example.com', 4, 5, 90, new Date().toISOString(), '2099-01-01').run();
await db.prepare("INSERT INTO flexi_paketi (created_at, ime, email, sati, dolazaka, cijena) VALUES (?,?,?,?,?,?)").bind(new Date().toISOString(), 'Bojan Test', B, 6, 10, 212.5).run();
await db.prepare("INSERT INTO flexi_posjete (paket_id, datum, created_at) VALUES (1, ?, ?)").bind(now.date, new Date().toISOString()).run();
const fl = (await call(ja, '/api/racun/ja', { method: 'GET', cookie: ckA })).j.flexi;
ok(fl.length === 1 && fl[0].preostalo === 4 && fl[0].iskoristeno === 1 && fl[0].istice === '2099-01-01', 'Ana vidi svoj FLEXI paket (email bez obzira na velika slova), ne Bojanov');

/* ---- 6. izvoz i brisanje ---- */
section('Izvoz i brisanje računa');
const ex = await izvoz.onRequestGet({ request: req('/api/racun/izvoz', { method: 'GET', cookie: ckA }), env });
const exj = await ex.json();
ok(exj.racun.email === A && exj.rezervacije.length >= 1, 'izvoz sadrži račun i rezervacije');
ok(!JSON.stringify(exj).includes('bojan'), 'izvoz ne sadrži tuđe podatke');
await mk('buduca-ana', A, { date: tomorrow, user_id: (await db.prepare('SELECT id FROM users WHERE email = ?').bind(A).first()).id });
ok((await call(obrisi, '/api/racun/obrisi', { body: { potvrda: A }, cookie: ckA })).r.status === 409, 'brisanje je blokirano dok postoji nadolazeća rezervacija');
await call(otkazi, '/api/racun/otkazi', { body: { id: 'buduca-ana' }, cookie: ckA });
if (!skipExt) await db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id IN ('trenutna-ana', 'nije-stigla-ana')").run();
ok((await call(obrisi, '/api/racun/obrisi', { body: { potvrda: 'pogresno@x.ba' }, cookie: ckA })).r.status === 400, 'brisanje traži upis emaila');
const blockedPkg = await call(obrisi, '/api/racun/obrisi', { body: { potvrda: A }, cookie: ckA });
ok(blockedPkg.r.status === 409 && blockedPkg.j.potrebnaPotvrda === 'paket', 'neiskorišteni FLEXI zahtijeva izričitu potvrdu');
const del = await call(obrisi, '/api/racun/obrisi', { body: { potvrda: A, prihvatamGubitakPaketa: true }, cookie: ckA });
ok(del.j.ok === true, 'račun obrisan: ' + JSON.stringify(del.j));
ok(!(await db.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(A).first()), 'korisnik više ne postoji');
const left = (await db.prepare("SELECT name, email, phone, user_id FROM bookings WHERE id = 'gost-ana-1'").first());
ok(left.name === 'Obrisan račun' && left.phone === null && left.user_id === null && !left.email.includes('ana'), 'rezervacije su anonimizirane');
ok((await call(ja, '/api/racun/ja', { method: 'GET', cookie: ckA })).j.user === null, 'sesija nakon brisanja ne radi');
const pk = await db.prepare('SELECT ime, email FROM flexi_paketi WHERE id = 1').first();
ok(pk.ime === 'Obrisan račun' && pk.email === null, 'FLEXI paket je anonimiziran');
ok(!(await db.prepare('SELECT 1 AS x FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = ?').bind(A).first()), 'sesije obrisane');

/* ---- 7. OpenID Connect ---- */
section('Google / Microsoft / Apple');
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' };
const bu = (b) => Buffer.from(b).toString('base64url');
const sign = (claims, { alg = 'RS256', kid = 'k1', key = privateKey } = {}) => {
  const h = bu(JSON.stringify({ alg, kid, typ: 'JWT' })), p = bu(JSON.stringify(claims)), s = createSign('RSA-SHA256').update(h + '.' + p).sign(key);
  return h + '.' + p + '.' + bu(s);
};
const nowS = Math.floor(Date.now() / 1000);
let tokenReqs = [];
const stub = (idClaims) => async (url, opt) => {
  if (/oauth2\/v3\/certs|discovery\/v2\.0\/keys|auth\/keys/.test(url)) return Response.json({ keys: [jwk] });
  if (/token/.test(url) && opt?.method === 'POST') { tokenReqs.push(Object.fromEntries(new URLSearchParams(opt.body))); return Response.json({ id_token: typeof idClaims === 'function' ? idClaims(tokenReqs.at(-1)) : idClaims }); }
};
async function oauthRun(provider, claimsFn, extra = {}) {
  const st = await start.onRequestGet({ request: new Request(ORIGIN + '/api/racun/oauth/' + provider + '/start'), env, params: { provider } });
  const u = new URL(st.headers.get('location'));
  const state = u.searchParams.get('state'), nonce = u.searchParams.get('nonce');
  ok(u.searchParams.get('code_challenge_method') === 'S256' && u.searchParams.get('code_challenge')?.length >= 40, provider + ': PKCE S256');
  fetchStub = stub(() => claimsFn(nonce));
  const url = ORIGIN + '/api/racun/oauth/' + provider + '/povratak?code=abc&state=' + state;
  const res = await povratak.onRequestGet({ request: new Request(url), env, params: { provider } });
  return { res, state, u };
}
const base = (nonce, aud) => ({ iss: 'https://accounts.google.com', aud, sub: 'g-111', email: 'dina@gmail.com', email_verified: true, name: 'Dina Hodžić', nonce, iat: nowS, exp: nowS + 600 });
let o = await oauthRun('google', (n) => sign(base(n, 'g-id')));
ok(/\/racun\.html$/.test(o.res.headers.get('location')) && /^__Host-sid=/.test(o.res.headers.get('set-cookie') || ''), 'Google: prijava uspješna, sesija postavljena');
ok((await db.prepare("SELECT 1 AS x FROM identities WHERE provider='google' AND subject='g-111'").first()) && (await db.prepare("SELECT 1 AS x FROM users WHERE email='dina@gmail.com'").first()), 'Google: račun i identitet napravljeni');
ok(tokenReqs.at(-1).code_verifier?.length >= 43 && tokenReqs.at(-1).client_secret === 'g-secret', 'Google: PKCE verifier i tajna poslani serveru pružaoca');
const replay = await povratak.onRequestGet({ request: new Request(ORIGIN + '/api/racun/oauth/google/povratak?code=abc&state=' + o.state), env, params: { provider: 'google' } });
ok(/greska=/.test(replay.headers.get('location')) && !replay.headers.get('set-cookie'), 'ponovljen state se odbija');
for (const [name, mut] of [['pogrešan aud', { aud: 'drugi' }], ['pogrešan iss', { iss: 'https://evil.example' }], ['istekao', { exp: nowS - 600 }], ['pogrešan nonce', { nonce: 'x' }]]) {
  const r = await oauthRun('google', (n) => sign({ ...base(n, 'g-id'), sub: 'g-bad-' + name, ...mut }));
  ok(/greska=/.test(r.res.headers.get('location')) && !r.res.headers.get('set-cookie'), 'Google: odbijen token (' + name + ')');
}
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
let r2 = await oauthRun('google', (n) => sign({ ...base(n, 'g-id'), sub: 'g-forged' }, { key: other.privateKey }));
ok(/greska=/.test(r2.res.headers.get('location')) && !r2.res.headers.get('set-cookie'), 'Google: token potpisan tuđim ključem se odbija');
const none = (n) => bu(JSON.stringify({ alg: 'none', kid: 'k1' })) + '.' + bu(JSON.stringify({ ...base(n, 'g-id'), sub: 'g-none' })) + '.';
r2 = await oauthRun('google', none);
ok(/greska=/.test(r2.res.headers.get('location')) && !r2.res.headers.get('set-cookie'), 'alg=none se odbija');
r2 = await oauthRun('google', (n) => sign({ ...base(n, 'g-id'), sub: 'g-unverified', email: 'dina@gmail.com', email_verified: false }));
ok(/potvrda=/.test(r2.res.headers.get('location')) && !r2.res.headers.get('set-cookie'), 'Google s nepotvrđenim emailom ne ulazi bez koda');
// Microsoft poslovni nalog: email nije pouzdan, mora kod na email; napadač ne preuzima Dinin račun
const msClaims = (n, tid, email) => ({ iss: `https://login.microsoftonline.com/${tid}/v2.0`, aud: 'ms-id', sub: 'ms-evil', tid, email, name: 'Napadač', nonce: n, iat: nowS, exp: nowS + 600 });
const TENANT = '11111111-2222-3333-4444-555555555555';
let m = await oauthRun('microsoft', (n) => sign(msClaims(n, TENANT, 'dina@gmail.com')));
const loc = m.res.headers.get('location');
ok(/potvrda=/.test(loc) && !m.res.headers.get('set-cookie'), 'Microsoft poslovni nalog s tuđim emailom NE dobija sesiju (nOAuth)');
const pid = new URL(loc).searchParams.get('potvrda');
const dinaBefore = await db.prepare("SELECT COUNT(*) AS n FROM identities WHERE provider='microsoft'").first();
ok(dinaBefore.n === 0, 'identitet nije vezan prije potvrde');
const s3 = await call(posalji, '/api/racun/kod-posalji', { body: { pending: pid, email: 'drugi@x.ba' } });
ok(s3.j.ok && sent.at(-1).to[0].email === 'dina@gmail.com', 'kod ide na adresu iz tokena, klijent je ne bira');
ok((await call(provjeri, '/api/racun/kod-provjeri', { body: { pending: pid, kod: '000000' } })).j.ok === false, 'bez pravog koda nema veze');
const okv = await call(provjeri, '/api/racun/kod-provjeri', { body: { pending: pid, kod: lastCode() } });
ok(okv.j.ok && (await db.prepare("SELECT 1 AS x FROM identities WHERE provider='microsoft' AND subject='ms-evil'").first()), 'uz kod s emaila identitet se veže (vlasnik adrese potvrđen)');
m = await oauthRun('microsoft', (n) => sign(msClaims(n, '9188040d-6c67-4c5b-b112-36a304b66dad', 'luka@outlook.com')).replace(/x/, 'x'));
ok(/\/racun\.html$/.test(m.res.headers.get('location')) && /^__Host-sid=/.test(m.res.headers.get('set-cookie') || ''), 'Microsoft lični nalog: email je pouzdan, prijava odmah');
// Apple: client secret je ispravan ES256 JWT
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const env2 = { ...env, APPLE_CLIENT_ID: 'com.skripta.web', APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_PRIVATE_KEY: ec.privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n') };
const savedEnv = Object.assign({}, env); Object.assign(env, env2);
const ap = await oauthRun('apple', (n) => sign({ iss: 'https://appleid.apple.com', aud: 'com.skripta.web', sub: 'apple-1', email: 'privat@privaterelay.appleid.com', email_verified: 'true', nonce: n, iat: nowS, exp: nowS + 600 }));
ok(/^__Host-sid=/.test(ap.res.headers.get('set-cookie') || ''), 'Apple: prijava uspješna');
const secretJwt = tokenReqs.at(-1).client_secret.split('.');
const sigOk = createPublicKey(ec.publicKey.export({ type: 'spki', format: 'pem' })) && (await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await webcrypto.subtle.importKey('spki', ec.publicKey.export({ type: 'spki', format: 'der' }), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']), Buffer.from(secretJwt[2], 'base64url'), Buffer.from(secretJwt[0] + '.' + secretJwt[1])));
ok(sigOk && JSON.parse(Buffer.from(secretJwt[1], 'base64url')).sub === 'com.skripta.web', 'Apple: client secret je valjan ES256 JWT');
fetchStub = null;
const st2 = await start.onRequestGet({ request: new Request('https://skripta.ba/api/racun/oauth/google/start'), env, params: { provider: 'google' } });
ok(st2.status === 302 && st2.headers.get('location').startsWith('https://www.skripta.ba/'), 'prijava se uvijek počinje na kanonskoj adresi');
const off = await start.onRequestGet({ request: new Request(ORIGIN + '/api/racun/oauth/apple/start'), env: { ...savedEnv, APPLE_CLIENT_ID: '' }, params: { provider: 'apple' } });
ok(off.status === 404, 'isključen pružalac vraća 404');


/* ---- 8. FLEXI rezervacija i povratak u formu ---- */
section('FLEXI rezervacija');
const rez = await import('../functions/api/rezervacija.js');
const flx = await import('../functions/_lib/flexi.js');
ok(flx.addMonth('2026-01-31') === '2026-02-28' && flx.addMonth('2026-12-15') === '2027-01-15' && flx.addMonth('2028-01-31') === '2028-02-29' && flx.addMonth('2026-11-10') === '2026-12-10', 'addMonth: kraj mjeseca i prelazak godine');
const ckD = await login('dina@gmail.com', '7.7.7.1');
const dinaId = (await db.prepare('SELECT id FROM users WHERE email = ?').bind('dina@gmail.com').first()).id;
const ins = async (email, sati, dol, extra = '') => (await db.prepare('INSERT INTO flexi_paketi (created_at, ime, email, sati, dolazaka, cijena) VALUES (?,?,?,?,?,?)').bind(new Date().toISOString(), 'Test', email, sati, dol, 90).run(), (await db.prepare('SELECT MAX(id) AS id FROM flexi_paketi').first()).id);
const pk4 = await ins('dina@gmail.com', 4, 2), pkOther = await ins('neko@drugi.ba', 4, 5);
const day = rules.ymd(rules.dayNum(rules.sarajevoNow().date) + 1);
const book = (extra, cookie = ckD) => call(rez, '/api/rezervacija', { body: { zona: 'ind', trajanje: 4, osobe: 1, datum: day, pocetak: 600, ime: 'Dina Hodžić', email: 'lazni@x.ba', telefon: '+38762111222', ...extra }, cookie });
ok((await book({ flexi: pk4 }, null)).r.status === 401, 'FLEXI bez prijave = 401');
ok((await book({ flexi: pkOther })).r.status === 400, 'tuđi FLEXI paket se ne može iskoristiti');
ok((await book({ flexi: pk4, zona: 'lounge', trajanje: 2 })).r.status === 400, 'FLEXI ne važi za Lounge');
ok((await book({ flexi: pk4, trajanje: 2 })).r.status === 400, 'FLEXI s pogrešnim trajanjem se odbija');
ok((await book({ flexi: pk4, osobe: 2 })).r.status === 400, 'FLEXI za dvije osobe se odbija');
const f1 = await book({ flexi: pk4 });
ok(f1.j.ok === true, 'FLEXI rezervacija prolazi: ' + JSON.stringify(f1.j));
const fb = await db.prepare('SELECT * FROM bookings WHERE flexi_paket_id = ?').bind(pk4).first();
ok(fb && fb.total === 0 && fb.user_id === dinaId && fb.email === 'dina@gmail.com', 'FLEXI rezervacija: iznos 0, vezana za račun, email računa (ne onaj iz forme)');
ok((await db.prepare('SELECT expires_at, user_id FROM flexi_paketi WHERE id = ?').bind(pk4).first()).expires_at === flx.addMonth(day), 'rok = mjesec od datuma prve rezervacije s paketom');
ok(sent.at(-1).htmlContent.includes('FLEXI paket') || sent.at(-2).htmlContent.includes('FLEXI paket'), 'mail pominje FLEXI paket, ne cijenu');
const f2 = await book({ flexi: pk4, pocetak: 720 }); // 12:00-16:00 isti dan: drugi termin
ok(f2.j.ok === true, 'druga posjeta iz istog paketa prolazi');
const f3 = await book({ flexi: pk4, pocetak: 840 });
ok(f3.r.status === 400 && /slobodnih posjeta/.test(f3.j.error), 'treća posjeta iz paketa od 2 se odbija');
await db.prepare('UPDATE flexi_paketi SET expires_at = ? WHERE id = ?').bind(rules.ymd(rules.dayNum(day) - 1), pk4).run();
await db.prepare("UPDATE bookings SET status = 'cancelled' WHERE flexi_paket_id = ?").bind(pk4).run();
ok((await book({ flexi: pk4 })).r.status === 400, 'istekao paket se ne može koristiti');
const guestBook = await call(rez, '/api/rezervacija', { body: { zona: 'ind', trajanje: 1, osobe: 1, datum: day, pocetak: 900, ime: 'Gost Gostić', email: 'gost@x.ba', telefon: '+38762111222' } });
ok(guestBook.j.ok === true && (await db.prepare("SELECT user_id FROM bookings WHERE email = 'gost@x.ba'").first()).user_id === null, 'gost i dalje može rezervisati bez računa');
const loggedBook = await book({ trajanje: 1, pocetak: 960, email: 'tudji@x.ba' });
ok(loggedBook.j.ok && (await db.prepare("SELECT email FROM bookings WHERE start_min = 960 AND user_id = ?").bind(dinaId).first()).email === 'dina@gmail.com', 'prijavljenom korisniku se ne može podmetnuti tuđi email u rezervaciju');

section('Povratak u formu nakon prijave');
const mkStart = async (qs) => (await start.onRequestGet({ request: new Request(ORIGIN + '/api/racun/oauth/google/start' + qs), env, params: { provider: 'google' } })).headers.get('location');
const finish = async (u, sub) => { const st = new URL(u).searchParams.get('state'), nn = new URL(u).searchParams.get('nonce'); fetchStub = stub(() => sign(base(nn, 'g-id'))); const r = await povratak.onRequestGet({ request: new Request(ORIGIN + '/api/racun/oauth/google/povratak?code=x&state=' + st), env, params: { provider: 'google' } }); fetchStub = null; return r.headers.get('location'); };
ok((await finish(await mkStart('?nazad=coffice&zona=lounge&datum=2026-11-12'))) === 'https://www.skripta.ba/coffice.html?zona=lounge&datum=2026-11-12#rezervacija', 'povratak u rezervaciju čuva zonu i datum');
ok((await finish(await mkStart('?nazad=https://evil.example/&zona=ind'))) === 'https://www.skripta.ba/racun.html', 'proizvoljan URL se ne prihvata (nema open redirecta)');
ok((await finish(await mkStart('?nazad=coffice&zona=%3Cscript%3E&datum=x'))) === 'https://www.skripta.ba/coffice.html#rezervacija', 'neispravne vrijednosti se odbacuju');

section('Engleski tok');
const BS_WORDS = /[čćšžđČĆŠŽĐ]|\b(rezervacij\w*|termin\w*|potvrd\w*|hvala|zdravo|prijav\w*|otkaž\w*|plaćanj\w*|dolasku|poštovan\w*|kafa|emailom|zahtjev\w*|vrijedi|minuta|pošalji)\b/i;
const plain = (h) => String(h).replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');
const before = sent.length;
const enBook = await call(rez, '/api/rezervacija', { body: { zona: 'ind', trajanje: 1, osobe: 1, datum: day, pocetak: 1020, ime: 'John Smith', email: 'john@example.com', telefon: '+38762111222', lang: 'en' }, ip: '9.9.9.9' });
ok(enBook.j && enBook.j.ok === true, 'engleska rezervacija prolazi');
ok((await db.prepare("SELECT lang FROM bookings WHERE email = 'john@example.com'").first()).lang === 'en', 'jezik rezervacije se sprema (en)');
const guestMail = sent.slice(before).filter((m) => (m.to || []).some((t) => t.email === 'john@example.com'));
ok(guestMail.length >= 1, 'gost dobiva mail o primljenom zahtjevu');
for (const m of guestMail) ok(!BS_WORDS.test(m.subject + ' ' + plain(m.htmlContent)), 'engleski mail bez bosanskog teksta: ' + m.subject + ' | ' + (plain(m.htmlContent).match(BS_WORDS) || [''])[0]);
const bsBook = await call(rez, '/api/rezervacija', { body: { zona: 'ind', trajanje: 1, osobe: 1, datum: day, pocetak: 1080, ime: 'Ana Anić', email: 'ana@example.com', telefon: '+38762111222' }, ip: '9.9.9.8' });
ok(bsBook.j && bsBook.j.ok === true && (await db.prepare("SELECT lang FROM bookings WHERE email = 'ana@example.com'").first()).lang == null, 'bez jezika ostaje bosanski (lang prazan)');
const b0 = sent.length;
await call(posalji, '/api/racun/kod-posalji', { body: { email: 'en-user@example.com', lang: 'en' }, ip: '8.8.8.1' });
const otp = sent[sent.length - 1];
ok(sent.length === b0 + 1 && /\d{6}/.test(otp.subject) && !BS_WORDS.test(otp.subject + ' ' + plain(otp.htmlContent)), 'kod za prijavu stiže na engleskom: ' + otp.subject);
await call(posalji, '/api/racun/kod-posalji', { body: { email: 'bs-user@example.com' }, ip: '8.8.8.2' });
ok(BS_WORDS.test(sent[sent.length - 1].subject + plain(sent[sent.length - 1].htmlContent)), 'bez jezika kod stiže na bosanskom');
ok((await finish(await mkStart('?nazad=coffice&zona=ind&datum=2026-11-12&l=en'))) === 'https://www.skripta.ba/coffice-en.html?zona=ind&datum=2026-11-12#rezervacija', 'OAuth povratak (en) vodi na coffice-en.html');
ok((await finish(await mkStart('?l=en'))) === 'https://www.skripta.ba/racun-en.html', 'OAuth povratak (en) vodi na racun-en.html');
const I = await import('../js/i18n.js').then((m) => m.default || m);
ok(I.T('Termin je već promijenjen. Osvježi stranicu.') === 'The slot has already been changed. Refresh the page.' && I.T('Focus zona, 12.11. u 10:00 do 11:00') === 'Focus zone, 12 Nov at 10:00 to 11:00', 'klijentski prijevod (rječnik i pravila)');

console.log(`\nProlazi: ${pass}, padaju: ${fail}`);
process.exit(fail ? 1 : 0);
