# Postavljanje rezervacija i upita (Cloudflare + Microsoft 365)

Ovaj folder (`functions/`) radi samo na Cloudflare Pages. Na GitHub Pages ne radi, a stranica tada ostaje u demo načinu.

## 1. Microsoft 365 (admin račun)
1. Entra admin centar, App registrations, nova aplikacija "SKRIPTA website".
2. API permissions, Microsoft Graph, Application permissions: `Mail.Send` i `Calendars.ReadWrite`. Zatim Grant admin consent.
3. Certificates & secrets: novi client secret. Zapišite Tenant ID, Client ID i secret.
4. Preporučeno: ograničite aplikaciju samo na sandučić info@skripta.ba (Exchange Application Access Policy), da ne vidi tuđe kalendare i poštu.

## 2. Cloudflare
1. Pages projekat povezan s ovim repozitorijem, domen skripta.ba aktivan.
2. D1: napravite bazu `skripta`, pokrenite sadržaj `schema.sql` u konzoli baze.
3. Pages, Settings, Bindings: D1 binding naziva `DB` na tu bazu.
4. Pages, Settings, Variables and Secrets:
   - `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` (secret)
   - `MAILBOX` = info@skripta.ba (kalendar)
   - `BREVO_API_KEY` (secret), `BREVO_FROM` = info@skripta.ba: slanje mailova preko Brevo-a umjesto sandučića. Ako nije postavljeno, šalje se preko Microsofta.
   - `BREVO_LIST_ID` = broj liste u Brevo-u za newsletter pretplatnike (uz `BREVO_API_KEY`). Dok nije postavljeno, koristi se MailerLite (`MAILERLITE_API_KEY`).
   - `SITE_URL` = https://www.skripta.ba
   - `SIGNING_SECRET` = dugačak nasumičan niz (secret)
5. Nakon objave provjerite da `/functions/` izvorni kod nije dostupan kao statički fajl i da `_to_delete/` nije objavljen.

## 2b. Test bez objave
Dok ne idete live: koristite Cloudflare preview adresu (pages.dev), ne skripta.ba. Dodajte varijable `TEST_MODE` = 1 i `TEST_RECIPIENT` = vaš email. Tada svi emailovi (i gostu) idu samo na taj email s oznakom [TEST], a događaji u kalendaru dobijaju prefiks [TEST]. Da bi se testiralo bez dodira s pravim kalendarom, napravite `MAILBOX` = testni sandučić ako ga imate. Za live: uklonite `TEST_MODE`.

## 3. Kako vi upravljate dostupnošću (admin)
Kalendar info@skripta.ba je izvor istine.

- **Najam cijelog prostora, zatvoreno, praznik, održavanje:** na ploči (`coffice-popunjenost-live`), tab Blokade: datum ili period, cijeli dan ili sati, razlog. Upisuje se u tabelu `blocks` i web stranica odmah prestaje nuditi taj termin. Stariji način (događaj `BLOK: ...` u Outlooku) radi dok varijabla `OUTLOOK_OFF` nije postavljena.
- **Rezervacije Coffice:** dolaze emailom sa linkovima "Potvrdi i dodaj u kalendar" i "Odbij". Potvrda upisuje događaj `Coffice: ...` u kalendar i šalje gostu potvrdu s linkom za otkazivanje. Zahtjev koji ne potvrdite ne blokira termin.
- **Ručno poništiti potvrđenu rezervaciju:** gost je može otkazati linkom iz emaila. Ako vi otkazujete, javite mu se emailom. Briše se i događaj iz kalendara, ali status u bazi mijenja link za otkazivanje ili dugme „Otkaži” na ploči `coffice-popunjenost-live` (tab Rezervacije).
- **Radno vrijeme, kapaciteti, tarife, pripremno vrijeme:** `functions/_lib/rules.js`. Brojevi označeni TODO čekaju potvrdu vlasnice: broj lounge mjesta (0 znači da je lounge isključen) i raspored café stolova.

**Isključivanje Outlook kalendara:** kad su sve blokade prepisane u tab Blokade, u Pages Settings, Variables dodaj `OUTLOOK_OFF` = 1. Tada sajt ne čita `BLOK` događaje i ne piše niti briše događaje `Coffice: ...`. Mailovi i dalje idu preko Microsofta.

## 4. Testiranje prije lansiranja
1. Pošaljite zahtjev za sebe: stiže li email vama i gostu?
2. Kliknite Potvrdi: nastaje li događaj u kalendaru, stiže li potvrda?
3. Otkažite linkom: nestaje li događaj?
4. Napravite `BLOK` događaj: nestaju li termini?
5. Pošaljite upit za cijeli prostor.
6. Isključite Graph pristup (pogrešan secret): stranica mora reći da termini nisu dostupni, ne smije prikazati sve slobodno.

Kod je pisan bez pristupa vašem Cloudflare i Microsoft računu i nije testiran uživo. Logika pravila i potpisani linkovi testirani su lokalno.

## 5. QR check-in, letci i podsjetnik pred kraj termina
Novo: `api/checkin.js`, `api/kraj.js`, `api/letci.js`, `api/jutro.js`, `_lib/qr.js`, `workers/kraj-cron/`, `migrations/2026-11-03-checkin.sql`.

1. **Baza (prvo, prije objave koda):** u D1 konzoli baze `skripta` pokrenite `migrations/2026-11-03-checkin.sql` (dvije kolone: `checked_in_at`, `end_reminded`).
2. **Pages varijable:** `WIFI_PASS` (šifra gost mreže), `LETCI_TO` (email koji prima jutarnji link), po želji `WIFI_SSID` (zadano SKRIPTA GUEST). `CRON_SECRET` i `SIGNING_SECRET` već postoje.
3. **Objava:** push na GitHub, Pages objavi funkcije.
4. **Worker za raspored:** Workers & Pages, Create, Worker `skripta-cron`, zalijepite `workers/kraj-cron/index.js`. Settings, Variables: `SITE_URL` (isti kao u `wrangler.toml`), secret `CRON_SECRET` (ista vrijednost kao u Pages). Settings, Triggers, Cron Triggers: `0 6 * * MON-SAT` i `*/5 6-20 * * MON-SAT`. (UTC: 06:00 je 07:00 u Sarajevu zimi, a 08:00 ljeti.)
5. **Test:** `POST /api/kraj?test=vas@email` (header `x-cron-secret`) šalje testni "Još 15 minuta". `POST /api/jutro?d=YYYY-MM-DD` šalje jutarnji mail za taj datum. Link iz maila otvara letke za printanje.

Pravila: podsjetnik pred kraj dobijaju samo gosti koji su skenirali QR kod, i to samo ako su skenirali prije zadnjih 15 minuta termina. Check-in radi od 30 minuta prije početka do kraja termina. Dolasci su u koloni `checked_in_at`. Gosti bez skeniranja: `checked_in_at IS NULL` nakon kraja termina.
