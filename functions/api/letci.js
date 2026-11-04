// Print-ready welcome sheets for one day: A4 landscape, two A5 sheets per page, price list on the back.
// Link is signed (see jutro.js) because the page lists guest names. Open it, press Ctrl/Cmd+P, choose A4 + double-sided.
import { NAMES, fmt, PRICES } from '../_lib/rules.js';
import { esc, readToken, niceName } from '../_lib/util.js';
import { makeToken } from '../_lib/util.js';
import qrcode from '../_lib/qr.js';

const COL = { ind: '#5A837B', lounge: '#DCA402' };
const km = (n) => `${n} KM`;
const qrSvg = (url) => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 1, margin: 0, scalable: true }); };

const CSS = `@page{size:297mm 210mm;margin:0}*{box-sizing:border-box;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Helvetica,"Helvetica Neue",Arial,"Liberation Sans",sans-serif;color:#1A1A1A;background:#ddd}
.bar{position:sticky;top:0;z-index:9;background:#1A1A1A;color:#fff;padding:10px 16px;font-size:14px;display:flex;gap:16px;align-items:center}
.bar button{font:inherit;padding:6px 14px;border:0;background:#DCA402;font-weight:700;cursor:pointer}
section{width:297mm;height:210mm;display:flex;page-break-after:always;margin:8mm auto;background:#fff}
.a5{width:148mm;height:210mm;position:relative;overflow:hidden;padding:15mm 14mm;background:#fff}
.cut{width:1mm;border-left:.3mm dashed #aaa;height:210mm}
.circ{position:absolute;width:104mm;height:104mm;border-radius:50%;right:-46mm;top:-52mm;opacity:.92}
.a5 .circ.b{top:158mm;right:-46mm;background:#DCA402}
.top{display:flex;justify-content:space-between;font-size:8.5pt;letter-spacing:.2pt;padding-bottom:3mm;border-bottom:.3mm solid #1A1A1A;position:relative;z-index:2}.top span{color:#414141}
.eyebrow{margin-top:14mm;font-size:9pt;text-transform:uppercase;letter-spacing:2pt;color:#414141;position:relative}
h1{font-size:40pt;line-height:.98;letter-spacing:-1.8pt;font-weight:700;margin-top:4mm;position:relative}
.time{margin-top:9mm;font-size:56pt;line-height:.9;letter-spacing:-3.5pt;font-weight:700;position:relative}
.time span{display:block}.time .do{font-size:22pt;letter-spacing:-.6pt;font-weight:400;margin-top:3mm;color:#414141}
.grid{margin-top:12mm;display:grid;grid-template-columns:1.1fr 1.1fr .9fr .9fr;gap:3mm;border-top:.3mm solid #1A1A1A;padding-top:3mm;position:relative}
i{display:block;font-style:normal;font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5pt;color:#414141;margin-bottom:1.2mm}
.grid b,.wifi b{font-size:11.5pt;font-weight:700}
.wifi{margin-top:7mm;display:grid;grid-template-columns:1fr 1fr;gap:4mm;border-top:.3mm solid #1A1A1A;padding-top:3mm;position:relative}
.qr{position:absolute;right:14mm;bottom:27mm;width:33mm;text-align:center;font-size:7pt;letter-spacing:1pt;text-transform:uppercase;color:#414141}
.qr svg{display:block;width:33mm;height:33mm;margin-bottom:1.5mm}
.qrtxt{position:absolute;left:14mm;bottom:31mm;width:70mm;font-size:9pt;line-height:1.45;color:#1A1A1A}.qrtxt b{display:block;font-size:11pt;margin-bottom:1mm}
.foot{display:flex;justify-content:space-between;font-size:7.5pt;position:absolute;bottom:13mm;left:14mm;right:14mm;border-top:.3mm solid #1A1A1A;padding-top:3mm;color:#414141}
.sl{font-size:13pt;font-weight:700;letter-spacing:-.4pt;color:#1A1A1A}
h2{font-size:30pt;letter-spacing:-1.2pt;line-height:1;margin-top:14mm;position:relative}h2.f{margin-top:12mm}
.sub{font-size:9pt;color:#414141;margin-top:2mm;position:relative}.sub.flex{margin-top:4mm;color:#1A1A1A}
.pt{width:100%;border-collapse:collapse;margin-top:6mm;font-size:11pt;position:relative}.pt th{font-weight:400;text-align:right;color:#414141;font-size:7.5pt;letter-spacing:1pt;text-transform:uppercase}
.pt td{padding:2mm 0;text-align:right;font-weight:700;border-bottom:.3mm solid #ddd}.pt td:first-child,.pt th:first-child{text-align:left;font-weight:400;width:42%}
.pt small{display:block;font-size:7.5pt;color:#414141}.pt tr.pop td{border-bottom:0}
.back .foot{flex-direction:column;gap:1mm}
@media print{body{background:#fff}.bar{display:none}section{margin:0}}`;

const BACK = `<div class="a5 back"><div class="circ b"></div>
<div class="top"><b>SKRIPTA Coffice</b><span>skripta.ba</span></div>
<h2>Cjenovnik</h2>
<table class="pt"><tr><th></th><th>1 h</th><th>2 h</th><th>4 h</th><th>8 h</th></tr>
<tr><td>Quiet zona</td>${[1, 2, 4, 8].map((h) => `<td>${km(PRICES.ind[h])}</td>`).join('')}</tr>
<tr><td>Lounge zona<small>po osobi</small></td>${[1, 2, 4, 8].map((h) => `<td>${km(PRICES.lounge[h])}</td>`).join('')}</tr></table>
<h2 class="f">FLEX paketi</h2>
<p class="sub">Unaprijed plaćene posjete za Quiet zonu.</p>
<table class="pt"><tr><th>Broj dolazaka</th><th>5</th><th>10</th><th>20</th></tr>
<tr><td>Posjete od 2 h</td><td>51 KM</td><td>96 KM</td><td>168 KM</td></tr>
<tr><td>Posjete od 8 h</td><td>119 KM</td><td>224 KM</td><td>392 KM</td></tr>
<tr class="pop"><td>Popust</td><td>15%</td><td>20%</td><td>30%</td></tr></table>
<p class="sub flex">Za FLEX pakete piši nam na <b>info@skripta.ba</b></p>
<div class="foot"><span>Sve cijene su u KM i uključuju PDV. Kafa ili čaj su uključeni.</span></div></div>`;

function front(env, b, qr, date) {
  const end = b.start_min + b.dur_h * 60;
  return `<div class="a5"><div class="circ" style="background:${COL[b.zone] || COL.ind}"></div>
<div class="top"><b>SKRIPTA Coffice</b><span>skripta.ba</span></div>
<div class="eyebrow">Dobrodošao/la</div>
<h1>${esc(niceName(b.name))}</h1>
<div class="time"><span>${fmt(b.start_min)}</span><span class="do">do ${fmt(end)}</span></div>
<div class="grid"><div><i>Zona</i><b>${esc(NAMES[b.zone])}</b></div><div><i>Datum</i><b>${date}</b></div><div><i>Trajanje</i><b>${b.dur_h} h</b></div><div><i>Za platiti</i><b>${b.total === 0 ? 'Besplatno' : km(b.total)}</b></div></div>
<div class="wifi"><div><i>Wi-Fi mreža</i><b>${esc(env.WIFI_SSID || 'SKRIPTA GUEST')}</b></div><div><i>Šifra</i><b>${esc(env.WIFI_PASS)}</b></div></div>
<div class="qrtxt"><b>Skeniraj kad stigneš.</b>Tako potvrđuješ dolazak, a nakon termina ti šaljemo kratku zahvalu.</div>
<div class="qr">${qr}Check-in</div>
<div class="foot"><span class="sl">Kafa. Laptop. COFFICE.</span><span>Cjenovnik na poleđini</span></div></div>`;
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), d = u.searchParams.get('d') || '';
  const k = await readToken(env, u.searchParams.get('t'), ['letci']);
  const hdr = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
  if (!k || k.id !== 'letci-' + d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Response('Link nije ispravan', { status: 400, headers: hdr });
  if (!env.WIFI_PASS) return new Response('Nedostaje varijabla WIFI_PASS u Cloudflare postavkama.', { status: 500, headers: hdr });

  let rows = (await env.DB.prepare("SELECT * FROM bookings WHERE date = ? AND status = 'confirmed' ORDER BY start_min, name").bind(d).all()).results || [];
  const ime = (u.searchParams.get('ime') || '').trim().toLocaleLowerCase('bs');
  if (ime) rows = rows.filter((b) => String(b.name).toLocaleLowerCase('bs').includes(ime));
  const date = d.split('-').reverse().join('.');
  const cards = [];
  for (const b of rows) cards.push(front(env, b, qrSvg(`${env.SITE_URL}/api/checkin?t=${await makeToken(env, b.id, 'checkin')}`), date));
  const pages = [];
  for (let i = 0; i < cards.length; i += 2) {
    pages.push(`<section>${cards[i]}<div class="cut"></div>${cards[i + 1] || '<div class="a5"></div>'}</section>`);
    pages.push(`<section>${BACK}<div class="cut"></div>${BACK}</section>`);
  }
  const bar = `<div class="bar"><b>Letci ${date}: ${rows.length} gostiju</b><span>Printaj dvostrano, A4, bez margina. Izreži po isprekidanoj liniji.</span><button onclick="print()">Printaj</button></div>`;
  const body = rows.length ? pages.join('') : '<p style="padding:40px;font:16px sans-serif">Nema potvrđenih rezervacija za ovaj dan.</p>';
  return new Response(`<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Letci ${date}</title><style>${CSS}</style></head><body>${bar}${body}</body></html>`, { headers: hdr });
}
