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
   - `MAILBOX` = info@skripta.ba
   - `SITE_URL` = https://www.skripta.ba
   - `SIGNING_SECRET` = dugačak nasumičan niz (secret)
5. Nakon objave provjerite da `/functions/` izvorni kod nije dostupan kao statički fajl i da `_to_delete/` nije objavljen.

## 2b. Test bez objave
Dok ne idete live: koristite Cloudflare preview adresu (pages.dev), ne skripta.ba. Dodajte varijable `TEST_MODE` = 1 i `TEST_RECIPIENT` = vaš email. Tada svi emailovi (i gostu) idu samo na taj email s oznakom [TEST], a događaji u kalendaru dobijaju prefiks [TEST]. Da bi se testiralo bez dodira s pravim kalendarom, napravite `MAILBOX` = testni sandučić ako ga imate. Za live: uklonite `TEST_MODE`.

## 3. Kako vi upravljate dostupnošću (admin)
Kalendar info@skripta.ba je izvor istine.

- **Najam cijelog prostora, zatvoreno, praznik, održavanje:** u Outlooku napravite događaj čiji naslov počinje sa `BLOK`, npr. `BLOK: radionica FES`. Cijeli dan: označite "All day". Taj termin (plus 30 min pripreme prije i poslije) nestaje s websitea u roku od oko minute. Brisanjem ili skraćivanjem događaja termin se vraća.
- **Rezervacije Coffice:** dolaze emailom sa linkovima "Potvrdi i dodaj u kalendar" i "Odbij". Potvrda upisuje događaj `Coffice: ...` u kalendar i šalje gostu potvrdu s linkom za otkazivanje. Zahtjev koji ne potvrdite ne blokira termin.
- **Ručno poništiti potvrđenu rezervaciju:** gost je može otkazati linkom iz emaila. Ako vi otkazujete, javite mu se emailom. Briše se i događaj iz kalendara, ali status u bazi mijenja samo link za otkazivanje (admin stranica nije napravljena).
- **Radno vrijeme, kapaciteti, tarife, pripremno vrijeme:** `functions/_lib/rules.js`. Brojevi označeni TODO čekaju potvrdu vlasnice: broj lounge mjesta (0 znači da je lounge isključen) i raspored café stolova.

## 4. Testiranje prije lansiranja
1. Pošaljite zahtjev za sebe: stiže li email vama i gostu?
2. Kliknite Potvrdi: nastaje li događaj u kalendaru, stiže li potvrda?
3. Otkažite linkom: nestaje li događaj?
4. Napravite `BLOK` događaj: nestaju li termini?
5. Pošaljite upit za cijeli prostor.
6. Isključite Graph pristup (pogrešan secret): stranica mora reći da termini nisu dostupni, ne smije prikazati sve slobodno.

Kod je pisan bez pristupa vašem Cloudflare i Microsoft računu i nije testiran uživo. Logika pravila i potpisani linkovi testirani su lokalno.
