/* English layer for the guest flow. Pages with <html lang="en"> are translated here:
   text nodes and a few attributes are mapped from Bosnian to English (dictionary and rules), the language is
   sent with API calls, and account links stay on the English pages. Bosnian pages are untouched.
   Also loadable from Node (tests, static page build): module.exports = { T, EXACT, RULES }. */
(function (root) {
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dm(d, m) { return (+d) + ' ' + MON[(+m) - 1]; }
  function dmy(d, m, y) { return (+d) + ' ' + MON[(+m) - 1] + ' ' + y; }
  function plur(n, one, many) { return n + ' ' + (+n === 1 ? one : many); }

  var EXACT = {
    /* nav, shared */
    'Meni': 'Menu', 'Coffice': 'Coffice', 'Najam cijelog prostora': 'Whole-space rental', 'O nama': 'About us', 'Kontakt': 'Contact',
    'Rezerviši mjesto': 'Book a spot', 'Stranice': 'Pages', 'O nama: IdeaLab': 'About us: IdeaLab', 'Naši projekti': 'Our projects',
    'Sva prava zadržana.': 'All rights reserved.', 'Privatnost': 'Privacy', 'Uslovi korištenja': 'Terms', 'Moj račun': 'My account',
    'Učitavam...': 'Loading...', 'Za prijavu je potreban JavaScript.': 'JavaScript is required to sign in.',
    /* sign in */
    'Prijavi se ili napravi račun': 'Sign in or create an account',
    'Bez lozinke. Prvi put? Račun se napravi sam kad potvrdiš email.': 'No password. First time? Your account is created when you confirm your email.',
    'ili emailom': 'or by email', 'Email': 'Email', 'Pošalji kod': 'Send code', 'Šaljem...': 'Sending...',
    'Upiši ispravan email.': 'Enter a valid email.', 'Slanje nije uspjelo.': 'Sending failed.',
    'Koristimo samo kolač potreban za prijavu. Ništa ne pratimo.': 'We only use the cookie needed to sign you in. We track nothing.',
    'Upiši kod': 'Enter code', 'Kod': 'Code', 'Prijavi se': 'Sign in', 'Provjeravam...': 'Checking...',
    'Kod ima šest cifara.': 'The code has six digits.', 'Kod nije ispravan.': 'The code is not valid.',
    'Poslali smo šestocifreni kod na email iz tvog naloga. Vrijedi 10 minuta.': 'We sent a six-digit code to the email on your account. It is valid for 10 minutes.',
    'Dobrodošao/la': 'Welcome', 'Račun je napravljen. Upiši ime i prezime da rezervacije budu na pravo ime. Telefon je neobavezan.': 'Your account is ready. Enter your full name so bookings are under the right name. Phone is optional.', 'Telefon (neobavezno)': 'Phone (optional)', 'Nastavi': 'Continue', 'Preskoči': 'Skip', 'Spremanje nije uspjelo.': 'Saving failed.',
    'Pošalji novi kod': 'Send a new code', 'Promijeni email': 'Change email', 'Poslali smo novi kod.': 'We sent a new code.',
    'Prijava je istekla. Pokušaj ponovo.': 'Sign-in expired. Please try again.',
    'Prijava je izborna. Račun ti daje pregled rezervacija, produženje termina i FLEXI pakete.': 'Signing in is optional. An account gives you your bookings, slot extensions and FLEXI packages.',
    'Prijavi se / napravi račun': 'Sign in / create an account', 'Ili samo popuni podatke ispod kao gost.': 'Or just fill in your details below as a guest.',
    'Odjavi se': 'Sign out',
    /* account page */
    'Pružalac prijave nam nije dao email adresu. Prijavi se kodom s emaila.': 'The sign-in provider did not share an email address. Sign in with an emailed code.',
    'Prijava nije uspjela. Pokušaj ponovo ili koristi kod s emaila.': 'Sign-in failed. Try again or use an emailed code.',
    'Ne možemo učitati podatke. Pokušaj ponovo.': 'We cannot load your data. Please try again.',
    'Čeka potvrdu': 'Awaiting confirmation', 'Potvrđeno': 'Confirmed', 'Otkazano': 'Cancelled', 'Odbijeno': 'Declined', 'U toku': 'In progress',
    'FLEXI paket': 'FLEXI package', 'Besplatno': 'Free', 'besplatno': 'free',
    'Produženje se plaća po dolasku, kao i ostalo.': 'Extensions are paid on arrival, like everything else.',
    'Produženje nije uspjelo.': 'The extension failed.', 'Otkaži': 'Cancel', 'Sigurno otkazati?': 'Cancel for sure?', 'Da, otkaži': 'Yes, cancel', 'Ne': 'No',
    'Otkazivanje nije uspjelo.': 'Cancelling failed.',
    'FLEXI paketi': 'FLEXI packages', 'Rok od 30 dana počinje prvom rezervacijom.': 'The 30-day period starts with your first booking.',
    'Rezerviši posjetu': 'Book a visit', 'Ime Prezime': 'Full name', 'Ime i prezime': 'Full name', 'Telefon': 'Phone', 'Spremi': 'Save',
    'Spremljeno.': 'Saved.', 'Nije spremljeno.': 'Not saved.', 'Kod s emaila': 'Emailed code', 'Profil': 'Profile',
    'Ime i telefon koristimo samo za tvoje rezervacije.': 'We only use your name and phone for your bookings.',
    'Privatnost': 'Privacy', 'Preuzmi moje podatke': 'Download my data', 'Trajno obriši račun': 'Delete account permanently',
    'Briše se račun i prijava. Rezervacije ostaju samo kao anonimna evidencija, bez imena, emaila i telefona. Ovo se ne može poništiti.': 'Your account and sign-in are deleted. Bookings remain only as an anonymous record, without name, email or phone. This cannot be undone.',
    'Za potvrdu upiši svoj email': 'To confirm, enter your email', 'Brisanje nije uspjelo.': 'Deleting failed.', 'Obriši račun': 'Delete account',
    'Račun je obrisan.': 'Your account has been deleted.', 'Hvala što si bio/la s nama.': 'Thank you for being with us.',
    'Trenutni termin': 'Current slot', 'Nadolazeće rezervacije': 'Upcoming bookings', 'Nemaš nadolazećih rezervacija.': 'You have no upcoming bookings.',
    'Prošle rezervacije': 'Past bookings', 'Još nema prošlih rezervacija.': 'No past bookings yet.',
    'Moj račun: rezervacije, produženje termina i FLEXI paketi.': 'My account: bookings, slot extensions and FLEXI packages.',
    'Moj račun | COFFICE by Skripta': 'My account | COFFICE by Skripta',
    /* booking widget */
    'Focus zona': 'Focus zone', 'Lounge zona': 'Lounge zone', 'Focus': 'Focus', 'Lounge': 'Lounge', 'od 7 KM': 'from 7 KM', 'od 5 KM': 'from 5 KM',
    'Nema dovoljno vremena do zatvaranja': 'Not enough time before closing',
    'Prikazani su slobodni termini. Precrtani su zauzeti ili prekasni.': 'Free slots are shown. Crossed-out slots are taken or too late.',
    'Oznaka -% znači popust u tom terminu.': 'A -% label means a discount for that slot.',
    'Nema slobodnih termina za ovaj izbor. Probajte drugi datum ili kraće trajanje.': 'No free slots for this choice. Try another date or a shorter duration.',
    'Trenutno nema dana otvorenih za rezervaciju. Piši nam na info@skripta.ba.': 'No days are open for booking right now. Write to us at info@skripta.ba.',
    'Nedjeljom ne radimo.': 'We are closed on Sundays.', 'Taj dan ne radimo. Odaberi drugi dan.': 'We are closed that day. Choose another day.',
    'Rezervacije za taj datum još nisu otvorene.': 'Bookings for that date are not open yet.',
    'Taj dan je cijeli prostor rezervisan za grupu (primjer povezanosti s najmom cijelog prostora).': 'The whole space is reserved for a group that day (example of the link with whole-space rental).',
    'Učitavam termine...': 'Loading slots...', 'Termini trenutno nisu dostupni.': 'Slots are not available right now.',
    'Taj dan je prostor zauzet. Probajte drugi datum.': 'The space is taken that day. Try another date.',
    'Ne možemo učitati termine. Pokušaj ponovo ili nam piši na info@skripta.ba.': 'We cannot load slots. Try again or write to us at info@skripta.ba.',
    'Upiši ime i prezime.': 'Enter your full name.', 'Upiši ispravan email, na njega šaljemo potvrdu.': 'Enter a valid email. We send the confirmation there.',
    'Upiši broj telefona, npr. +387 62 123 456.': 'Enter a phone number, e.g. +387 62 123 456.',
    'vrijeme početka': 'start time', 'ime i prezime': 'full name', 'email': 'email', 'telefon': 'phone',
    'Odaberi termin': 'Choose a slot', 'Dopuni označena polja.': 'Complete the highlighted fields.',
    'Pošalji zahtjev': 'Send request', 'Prikaži primjer': 'Show example', 'Primijeni': 'Apply',
    'Upiši promo kod.': 'Enter a promo code.', 'Promo kod nije ispravan.': 'The promo code is not valid.',
    'Provjera nije uspjela. Pokušaj opet.': 'The check failed. Please try again.', 'Provjeri promo kod.': 'Check the promo code.',
    'Jedva čekamo da dođeš!': 'We cannot wait to see you!',
    'PDV uključen. Kafa ili čaj su besplatni. Plaćanje po dolasku.': 'VAT included. Coffee or tea is free. Pay on arrival.',
    'Rezervacija je potvrđena tek kad ti potvrdimo emailom.': 'Your booking is confirmed only when we confirm by email.',
    'Slanje nije uspjelo. Piši nam na info@skripta.ba.': 'Sending failed. Write to us at info@skripta.ba.',
    'Zahtjev je poslan.': 'Request sent.', 'Primjer': 'Example', 'DEMO · NIJE STVARNA REZERVACIJA': 'DEMO · NOT A REAL BOOKING',
    'Ništa nije poslano niti spremljeno.': 'Nothing was sent or saved.',
    'Provjeri i spam.': 'Check your spam folder too.',
    'Rezervacija': 'Your booking', 'nije potvrđena': 'is not confirmed', 'Misliš li': 'Did you mean', 'PDV uključen.': 'VAT included.', 'Kafa ili čaj su besplatni.': 'Coffee or tea is free.', 'Plaćanje po dolasku.': 'Pay on arrival.',
    'Rezervacija nije pronađena ili nije aktivna.': 'The booking was not found or is not active.', 'Datum je u prošlosti.': 'The date is in the past.', 'Datum je van raspona.': 'The date is out of range.',
    'Baza trenutno nije dostupna. Pokušaj ponovo.': 'The system is not available right now. Please try again.', 'Neispravno vrijeme početka.': 'Invalid start time.', 'Termin je već prošao.': 'The slot has already passed.',
    'Spremanje nije uspjelo. Piši nam na info@skripta.ba.': 'Saving failed. Write to us at info@skripta.ba.', 'Paket nije ispravan.': 'The package is not valid.', 'Paket nije pronađen na tvom računu.': 'The package was not found on your account.',
    'FLEXI paketi važe samo za Focus zonu.': 'FLEXI packages are valid for the Focus zone only.', 'FLEXI posjeta važi za jednu osobu.': 'A FLEXI visit is valid for one person.',
    'Lounge zona još nije dostupna za online rezervaciju.': 'The lounge zone is not available for online booking yet.', 'Taj dan ne radimo.': 'We are closed that day.', 'Promo kod ne važi za taj datum.': 'The promo code is not valid for that date.',
    'Kalendar trenutno nije dostupan.': 'The calendar is not available right now.', 'Kalendar trenutno nije dostupan. Pokušaj ponovo.': 'The calendar is not available right now. Please try again.',
    'SKRIPTA Coffice': 'SKRIPTA Coffice', 'Rezervacije, produženje termina i FLEXI paketi na jednom mjestu.': 'Bookings, slot extensions and FLEXI packages in one place.',
    'Sve rezervacije na jednom mjestu': 'All your bookings in one place', 'Nadolazeće i prošle, s jasnim statusom.': 'Upcoming and past, with a clear status.',
    'Produži termin jednim klikom': 'Extend your slot in one click', 'Kad ti treba još sat vremena, ako je mjesto slobodno.': 'When you need one more hour, if the spot is free.',
    'Prati FLEXI posjete': 'Track your FLEXI visits', 'Vidiš koliko ti je posjeta ostalo i do kad važe.': 'See how many visits are left and until when they are valid.',
    'Produži termin': 'Extend slot', 'Za koliko želiš produžiti?': 'How long do you want to extend by?', 'Provjeravam dostupnost...': 'Checking availability...', 'Nije slobodno': 'Not available',
    'Opcije koje nisu slobodne su zauzete drugim terminom ili prelaze radno vrijeme.': 'Unavailable options are taken by another booking or go past closing time.', 'Potvrdi produženje': 'Confirm extension',
    'Možeš produžiti za 1, 2, 4 ili 6 sati.': 'You can extend by 1, 2, 4 or 6 hours.',
    'Izmijeni': 'Change', 'Slobodni počeci': 'Available start times', 'Spremi izmjenu': 'Save change', 'FLEXI rezervaciji se mijenja samo datum i vrijeme početka.': 'Only the date and start time of a FLEXI booking can be changed.', 'Za ovaj izbor nema slobodnih termina. Probaj drugi datum ili kraće trajanje.': 'No slots are free for this choice. Try another date or a shorter duration.', 'Izmjena važi samo ako je izabrani termin slobodan. Cijena se računa za novi termin.': 'A change only goes through if the chosen slot is free. The price is calculated for the new slot.', 'Izmjena nije uspjela.': 'The change did not go through.', 'Taj termin nije slobodan. Odaberi drugi.': 'That slot is not free. Pick another one.', 'Nema promjene: termin je isti.': 'No change: it is the same slot.', 'Odaberi vrijeme početka.': 'Choose a start time.', 'Rezervacija je u međuvremenu promijenjena. Osvježi stranicu.': 'The booking has changed in the meantime. Refresh the page.', 'Rezervacija nije pronađena ili nije aktivna.': 'Booking not found or not active.', 'Zona': 'Zone', 'trenutna zona': 'current zone', 'preći u ovu zonu': 'switch to this zone', 'Za ovu zonu nema dostupnih opcija.': 'No options are available for this zone.',
    'Ned': 'Sun', 'Pon': 'Mon', 'Uto': 'Tue', 'Sri': 'Wed', 'Čet': 'Thu', 'Pet': 'Fri', 'Sub': 'Sat', 'uskoro': 'soon', 'popust': 'discount',
    'Upit je poslan. Poslali smo potvrdu primitka na tvoj email. Ovo nije potvrđena rezervacija, javljamo ti se s ponudom.': 'Inquiry sent. We emailed you a receipt. This is not a confirmed booking, we will get back to you with an offer.',
    'Slanje preko websitea nije uspjelo. Otvaramo ti email s pripremljenim upitom, ili nam piši na info@skripta.ba.': 'Sending through the website failed. We are opening an email with your inquiry ready, or write to us at info@skripta.ba.',
    'Hvala! Javit ćemo ti čim otvorimo rezervacije.': 'Thank you! We will let you know as soon as bookings open.',
    'Obavijesti me': 'Notify me',
    /* server messages */
    'Promo kod je iskorišten.': 'The promo code has already been used.',
    'Promo kod važi za jednu rezervaciju po gostu, a već je iskorišten s tim emailom ili telefonom.': 'The promo code is valid for one booking per guest, and it has already been used with that email or phone.',
    'Tog dana je rezervacija besplatna, promo kod nije potreban.': 'Booking is free that day, no promo code needed.',
    'Nema slobodnih mjesta u sljedećem terminu. Javi se osoblju.': 'There are no free places in the next slot. Please ask the staff.',
    'Sljedeći termin je zauzet (događaj ili najam).': 'The next slot is taken (event or rental).',
    'Kod nije ispravan ili je istekao.': 'The code is not valid or has expired.',
    'Moguće je produžiti samo termin koji je u toku.': 'Only a slot in progress can be extended.',
    'Možeš produžiti za 1 ili 2 sata.': 'You can extend by 1 or 2 hours.',
    'Neispravan zahtjev.': 'Invalid request.', 'Nema slobodnih posjeta u paketu.': 'No free visits left in the package.',
    'Previše pokušaja. Pokušaj opet za sat vremena.': 'Too many attempts. Try again in an hour.',
    'Previše pokušaja. Pričekaj 15 minuta.': 'Too many attempts. Wait 15 minutes.', 'Previše pokušaja.': 'Too many attempts.',
    'Prijavi se.': 'Please sign in.', 'Produženje je moguće kad te osoblje označi kao stigao/la.': 'Extending is possible once the staff marks you as arrived.',
    'Produženje za ovu zonu nije moguće.': 'Extending is not possible for this zone.',
    'Provjera paketa nije uspjela. Pokušaj opet.': 'The package check failed. Please try again.',
    'Provjera promo koda nije uspjela. Pokušaj opet.': 'The promo code check failed. Please try again.',
    'Provjeri email, domena izgleda pogrešno.': 'Check your email, the domain looks wrong.',
    'Prvo otkaži nadolazeće rezervacije, ili nam piši na info@skripta.ba.': 'Cancel your upcoming bookings first, or write to us at info@skripta.ba.',
    'Rezervacija nije aktivna.': 'The booking is not active.', 'Rezervacija nije pronađena.': 'Booking not found.', 'Samo POST.': 'POST only.',
    'Slanje nije uspjelo. Pokušaj ponovo ili nam piši na info@skripta.ba.': 'Sending failed. Try again or write to us at info@skripta.ba.',
    'Slanje nije uspjelo. Pošaljite nam email na info@skripta.ba.': 'Sending failed. Email us at info@skripta.ba.',
    'Taj termin više nije slobodan. Odaberite drugi.': 'That slot is no longer free. Please choose another.',
    'Termin je u međuvremenu promijenjen. Osvježi stranicu.': 'The slot has changed in the meantime. Refresh the page.',
    'Termin je već počeo. Javi nam se na info@skripta.ba.': 'The slot has already started. Contact us at info@skripta.ba.',
    'Termin je već promijenjen. Osvježi stranicu.': 'The slot has already been changed. Refresh the page.',
    'Termini trenutno nisu dostupni. Javi se osoblju.': 'Slots are not available right now. Please ask the staff.',
    'Termini trenutno nisu dostupni. Pišite nam na info@skripta.ba.': 'Slots are not available right now. Write to us at info@skripta.ba.',
    'Upiši ispravan broj telefona.': 'Enter a valid phone number.', 'Za FLEXI posjetu se prijavi.': 'Sign in to use a FLEXI visit.',
    'Za potvrdu upiši email računa.': 'To confirm, enter the account email.', 'Zabranjeno.': 'Forbidden.',
    'Greška. Pokušaj ponovo.': 'Error. Please try again.', 'Nema veze. Pokušaj ponovo.': 'No connection. Please try again.',
    /* coffice page */
    'Coworking bez članarine u Sarajevu | SKRIPTA Coffice': 'Coworking without membership in Sarajevo | SKRIPTA Coffice',
    'Prostor za rad u Sarajevu na sat: radni sto ili lounge. Kafa ili čaj besplatni, bez članarine i pretplate, plaćanje po dolasku.': 'Work space in Sarajevo by the hour: a desk or the lounge. Free coffee or tea, no membership or subscription, pay on arrival.',
    'Radni sto na sat.': 'A desk by the hour.', 'Kafa ili čaj besplatni.': 'Free coffee or tea.',
    'Fleksibilna alternativa radu od kuće, radu iz običnog kafića i članstvu u coworkingu. Biraš okruženje i trajanje, plaćaš korištenje mjesta. Bez članarine, pretplate i obaveznog umrežavanja.': 'A flexible alternative to working from home, working from an ordinary café and a coworking membership. You choose the setting and the duration, and pay for using the spot. No membership, no subscription, no compulsory networking.',
    'Pogledaj cijene': 'See prices', 'Open day 4. do 6. novembra': 'Open day, 4 to 6 November', 'Besplatno · 10 do 18:30h · rezerviši svoje mjesto': 'Free · 10:00 to 18:30 · book your spot',
    'DVIJE ZONE': 'TWO ZONES', 'Odaberi način rada': 'Choose how you work', 'Jedan prostor. Dva različita načina rada. Razlika je u sjedenju i cijeni.': 'One space. Two different ways of working. The difference is the seating and the price.',
    'Radni stolovi uz prozor u Focus zoni Coffice-a': 'Desks by the window in the Coffice Focus zone', 'Lounge zona Coffice-a s kožnim kaučem i policama': 'Coffice lounge zone with a leather sofa and shelves',
    'Zasebno radno mjesto.': 'A private workspace.', 'Zona za individualni rad ili rad u manjim grupama.': 'A zone for individual work or work in small groups.',
    'CJENOVNIK': 'PRICES', 'Cijene po osobi, sve uključeno': 'Prices per person, all included',
    'Cijene po osobi za dvije zone i četiri trajanja': 'Prices per person for two zones and four durations',
    'Zona': 'Zone', '1 sat': '1 hour', '2 sata': '2 hours', '4 sata': '4 hours', '6 sati': '6 hours', 'KM': 'KM',
    'Po osobi': 'Per person', 'Cijene su po osobi i uključuju PDV. Kafa ili čaj su besplatni.': 'Prices are per person and include VAT. Coffee or tea is free.',
    'Lounge zona se rezerviše do 4 sata.': 'The lounge zone can be booked for up to 4 hours.', 'Plaćanje': 'Payment',
    'Rezervacija online, plaćanje po dolasku gotovinom ili karticom. Bez članarine i pretplate.': 'Book online, pay on arrival by cash or card. No membership or subscription.',
    'REZERVACIJA': 'BOOKING', 'Odaberi termin i vidi cijenu': 'Choose a slot and see the price',
    'Biraš zonu, datum, trajanje i vrijeme početka. Ukupan iznos vidiš odmah, a zahtjev potvrđujemo emailom.': 'You choose the zone, date, duration and start time. You see the total straight away, and we confirm your request by email.',
    'Besplatno 4., 5., 6. i 7. novembra.': 'Free on 4, 5, 6 and 7 November.',
    'Do petka 6.11. radimo od 10 do 18:30h, a u subotu 7.11. od 10 do 15h. Odaberi datum ispod.': 'Until Friday 6 Nov we are open from 10:00 to 18:30, and on Saturday 7 Nov from 10:00 to 15:00. Choose a date below.',
    'DEMO': 'DEMO', 'Demonstracijski kalendar. Termini su simulirani i zahtjev se ne šalje dok se ne poveže pravi sistem.': 'Demo calendar. Slots are simulated and no request is sent until the real system is connected.',
    'Zona i broj osoba': 'Zone and number of people', 'Broj osoba': 'Number of people', 'Manje osoba': 'Fewer people', 'Više osoba': 'More people',
    'Cijena je po osobi. Cijela grupa sjedi u istoj zoni. Najviše 4 osobe.': 'The price is per person. The whole group sits in the same zone. Up to 4 people.',
    'Kada dolaziš': 'When are you coming', 'Datum': 'Date',
    'Dani označeni sa "uskoro" još nisu otvoreni za rezervacije.': 'Days marked "soon" are not open for booking yet.', 'Ostavi email i javit ćemo ti čim ih otvorimo.': 'Leave your email and we will let you know as soon as we open them.',
    'ime@primjer.ba': 'name@example.com', 'Email za obavijest': 'Email for the notification', 'Trajanje': 'Duration', 'Vrijeme početka': 'Start time',
    'Tvoji podaci': 'Your details', 'Sva tri polja su obavezna. Email koristimo za potvrdu, a telefon samo ako zatreba.': 'All three fields are required. We use your email for the confirmation, and your phone only if needed.',
    'Promo kod': 'Promo code', '(nije obavezno)': '(optional)', 'Upiši kod': 'Enter code',
    'Šalji mi novosti SKRIPTE emailom. Možeš odznačiti ovo polje, a odjaviti se možeš i u svakoj poruci.': 'Send me SKRIPTA news by email. You can untick this box, and you can unsubscribe in every message.',
    'Tvoja rezervacija': 'Your booking', 'Termin': 'Slot', 'Osobe': 'People',
    'ZA REDOVNE GOSTE': 'FOR REGULARS', 'Samo za Focus zonu': 'Focus zone only',
    'FLEXI paketi vrijede samo za Focus zonu.': 'FLEXI packages are valid for the Focus zone only.',
    'Unaprijed plaćene posjete uz popust. Nudimo ograničenu količinu paketa. Cijene su s PDV-om, a kafa ili čaj su besplatni. Za pakete se javi na': 'Prepaid visits at a discount. We offer a limited number of packages. Prices include VAT, and coffee or tea is free. For packages, get in touch at',
    'Posjete od 4 sata · Focus zona': 'Visits of 4 hours · Focus zone', 'Posjete od 6 sati · Focus zona': 'Visits of 6 hours · Focus zone',
    '16 KM po posjeti': '16 KM per visit', '15 KM po posjeti': '15 KM per visit', '14 KM po posjeti': '14 KM per visit', '20 KM po posjeti': '20 KM per visit', '18 KM po posjeti': '18 KM per visit', 'Naruči paket': 'Order package',
    'KAKO FUNKCIONIŠE': 'HOW IT WORKS', 'Rezervacije u tri koraka': 'Booking in three steps', 'Odaberi zonu i termin': 'Choose a zone and a slot',
    'Odaberi svoje mjesto za rad i odluči koliko ćeš ostati.': 'Pick your place to work and decide how long you will stay.', 'Pošalji zahtjev': 'Send request',
    'Unos email adrese i potvrda putem emaila.': 'Enter your email address and confirm by email.', 'Dođi u zakazanom terminu': 'Come at your booked time',
    'Smjesti se i završi posao. Plaćanje po dolasku, gotovinom ili karticom.': 'Settle in and get your work done. Pay on arrival, by cash or card.',
    'GALERIJA': 'GALLERY', 'Pogledaj prostor': 'Take a look at the space',
    'Radni stolovi uz velike prozore i zid sa starim telefonima': 'Desks by large windows and a wall of old telephones', 'Stolovi i zelene biljke u Coffice-u': 'Tables and green plants in Coffice',
    'Lounge s kožnim kaučem i policama': 'Lounge with a leather sofa and shelves', 'Stolovi uz velike prozore u Coffice-u': 'Tables by large windows in Coffice',
    'Dugi radni sto za grupe': 'Long desk for groups', 'Pogled odozgo na lounge i radni dio': 'View from above of the lounge and work area',
    'PRAKTIČNE INFORMACIJE': 'PRACTICAL INFORMATION', 'Kako do nas': 'Getting here', 'Lokacija': 'Location',
    'Emerika Bluma 9, Sarajevo, 100 m od OHR-a.': 'Emerika Bluma 9, Sarajevo, 100 m from the OHR.', 'Otvori mapu': 'Open map',
    'Radno vrijeme': 'Opening hours', 'Od ponedjeljka do petka, 09:00 do 18:30': 'Monday to Friday, 09:00 to 18:30', 'Pristup': 'Access',
    'Prilagođen teže pokretljivim osobama': 'Adapted for people with reduced mobility', 'Sadržaji': 'Facilities',
    'Brz internet, prezentacijski ekrani, staklene table za pisanje, kuhinja': 'Fast internet, presentation screens, glass writing boards, kitchen',
    'PITANJA': 'FAQ', 'Prije nego rezervišeš': 'Before you book',
    'Je li ovo kafić u kojem je dovoljno naručiti piće?': 'Is this a café where it is enough to order a drink?',
    'Ne. Plaća se odabrana tarifa korištenja mjesta za rad, a u cijenu je uključen PDV. Kafa ili čaj su besplatni.': 'No. You pay the chosen tariff for using a workspace, and VAT is included in the price. Coffee or tea is free.',
    'Šta se rezerviše u lounge zoni?': 'What do you book in the lounge zone?',
    'Lounge je za grupe od 2 do 4 osobe. Nema zaseban radni sto, pa je cijena niža.': 'The lounge is for groups of 2 to 4 people. There is no separate desk, so the price is lower.',
    'Je li rezervacija odmah potvrđena?': 'Is the booking confirmed straight away?',
    'Ne. Zahtjev stiže nama, a rezervacija je potvrđena tek kad ti pošaljemo potvrdu emailom. Do tada termin nije garantovan.': 'No. Your request reaches us, and the booking is confirmed only when we email you a confirmation. Until then the slot is not guaranteed.',
    'Kako i kada plaćam?': 'How and when do I pay?',
    'Po dolasku, gotovinom ili karticom. Ne tražimo plaćanje unaprijed, podatke o kartici ni korisnički profil.': 'On arrival, by cash or card. We do not ask for payment in advance, card details or a user profile.',
    'Treba li mi članarina?': 'Do I need a membership?',
    'Ne. Nema članarine ni dugoročnog zakupa. Rezervišeš samo termin koji ti treba, a za redovne goste postoje FLEXI paketi.': 'No. There is no membership or long-term lease. You book only the slot you need, and FLEXI packages exist for regular guests.',
    'Želim cijeli prostor za tim ili događaj. Šta radim?': 'I want the whole space for a team or event. What do I do?',
    'Pošalji upit na stranici': 'Send an inquiry on the', 's datumom, trajanjem, brojem učesnika i vrstom korištenja.': 'page with the date, duration, number of participants and type of use.',
    'Pošalji upit na stranici Najam cijelog prostora s datumom, trajanjem, brojem učesnika i vrstom korištenja.': 'Send an inquiry on the Whole-space rental page with the date, duration, number of participants and type of use.',
    'Timu treba': 'Does your team need', 'cijeli prostor?': 'the whole space?',
    'Radionice, obuke, sastanci, strateško planiranje i timski radni dani. Pošalji upit s datumom i brojem učesnika.': 'Workshops, trainings, meetings, strategic planning and team work days. Send an inquiry with the date and number of participants.',
    'Upit za cijeli prostor': 'Inquiry for the whole space',
    'Radni prostor u Sarajevu na sat ili dan. Focus i Lounge zona, kafa ili čaj besplatni, bez članarine.': 'A workspace in Sarajevo by the hour or day. Focus and Lounge zones, free coffee or tea, no membership.',
    'Cjenovnik po osobi': 'Price list per person', 'Focus zona, 1 sat': 'Focus zone, 1 hour', 'Focus zona, 2 sata': 'Focus zone, 2 hours', 'Focus zona, 4 sata': 'Focus zone, 4 hours', 'Focus zona, 6 sati': 'Focus zone, 6 hours',
    'Lounge zona, 1 sat': 'Lounge zone, 1 hour', 'Lounge zona, 2 sata': 'Lounge zone, 2 hours', 'Lounge zona, 4 sata': 'Lounge zone, 4 hours',
    'Emerika Bluma 9, Sarajevo, BiH': 'Emerika Bluma 9, Sarajevo, Bosnia and Herzegovina',
    '1 osoba': '1 person', 'Radni sto na sat. Kafa ili čaj besplatni.': 'A desk by the hour. Free coffee or tea.'
  };

  var RULES = [
    [/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, function (m) { return dmy(m[1], m[2], m[3]); }],
    [/^(\d{1,2})\.(\d{1,2})\.$/, function (m) { return dm(m[1], m[2]); }],
    [/^(\d{1,2})\.(\d{1,2})\.(\d{4}), (\d{2}:\d{2}) do (\d{2}:\d{2})$/, function (m) { return dmy(m[1], m[2], m[3]) + ', ' + m[4] + ' to ' + m[5]; }],
    [/^(\d{2})\.(\d{2})\. u (\d{2}:\d{2}) do (\d{2}:\d{2})$/, function (m) { return dm(m[1], m[2]) + ' at ' + m[3] + ' to ' + m[4]; }],
    [/^(\d{2}:\d{2}) do (\d{2}:\d{2})$/, function (m) { return m[1] + ' to ' + m[2]; }],
    [/^(\d+) osob(?:a|e)$/, function (m) { return +m[1] === 1 ? '1 person' : m[1] + ' people'; }],
    [/^(\d+) sat(?:a|i)?$/, function (m) { return plur(m[1], 'hour', 'hours'); }],
    [/^(\d+) × (\d+) KM po osobi\.$/, function (m) { return m[1] + ' × ' + m[2] + ' KM per person.'; }],
    [/^(\d+) dolazaka$/, function (m) { return m[1] + ' visits'; }],
    [/^(\d+) posjeta po (\d+) h$/, function (m) { return m[1] + ' visits of ' + m[2] + ' h'; }],
    [/^(\d+) od (\d+) preostalo$/, function (m) { return m[1] + ' of ' + m[2] + ' left'; }],
    [/^(\d+) već rezervisano\.$/, function (m) { return m[1] + ' already booked.'; }],
    [/^Važi do (\d{1,2})\.(\d{1,2})\.(\d{4})\.$/, function (m) { return 'Valid until ' + dmy(m[1], m[2], m[3]) + '.'; }],
    [/^Promo kod važi za rezervacije od (\d{1,2})\.(\d{1,2})\. do (\d{1,2})\.(\d{1,2})\.$/, function (m) { return 'The promo code is valid for bookings from ' + dm(m[1], m[2]) + ' to ' + dm(m[3], m[4]) + '.'; }],
    [/^Paket važi do (\d{1,2})\.(\d{1,2})\.(\d{4})\.$/, function (m) { return 'The package is valid until ' + dmy(m[1], m[2], m[3]) + '.'; }],
    [/^Posjeta se skida kad te osoblje označi kao stigao\/la\.$/, function () { return 'A visit is deducted when the staff marks you as arrived.'; }],
    [/^Produži za 1 sat(?: \((.+)\))?$/, function (m) { return 'Extend by 1 hour' + (m[1] ? ' (' + T(m[1]) + ')' : ''); }],
    [/^Do (\d{2}:\d{2}) ostaješ u (Focus|Lounge) zona, a od (\d{2}:\d{2}) prelaziš u (Focus|Lounge) zona\.$/, function (m) { return 'Until ' + m[1] + ' you stay in the ' + m[2] + ' zone, and from ' + m[3] + ' you move to the ' + m[4] + ' zone.'; }],
    [/^Od (\d{2}:\d{2}) si u (Focus|Lounge) zona, do (\d{2}:\d{2})\.$/, function (m) { return 'From ' + m[1] + ' you are in the ' + m[2] + ' zone, until ' + m[3] + '.'; }],
    [/^Potvrdi: (Focus|Lounge) zona do (\d{2}:\d{2})$/, function (m) { return 'Confirm: ' + m[1] + ' zone until ' + m[2]; }],
    [/^Spremi: (\d{2}\.\d{2}\.\d{4}), (\d{2}:\d{2}) do (\d{2}:\d{2})$/, function (m) { return 'Save: ' + m[1] + ', ' + m[2] + ' to ' + m[3]; }],
    [/^do (\d{2}:\d{2}) · (.+)$/, function (m) { return 'until ' + m[1] + ' · ' + (m[2] === 'besplatno' ? 'free' : m[2]); }],
    [/^Izmjena je spremljena: (\d{2}\.\d{2}\.\d{4}), (\d{2}:\d{2}) do (\d{2}:\d{2})\.( Čeka potvrdu\.)?$/, function (m) { return 'Change saved: ' + m[1] + ', ' + m[2] + ' to ' + m[3] + '.' + (m[4] ? ' Awaiting confirmation.' : ''); }],
    [/^Potvrdi: do (\d{2}:\d{2})$/, function (m) { return 'Confirm: until ' + m[1]; }],
    [/^Ostaješ do (\d{2}:\d{2})\.$/, function (m) { return 'You stay until ' + m[1] + '.'; }],
    [/^Prostor se zatvara u (\d{2}:\d{2})\.$/, function (m) { return 'The space closes at ' + m[1] + '.'; }],
    [/^Email: (.+)\. Načini prijave: (.+)\.$/, function (m) { return 'Email: ' + m[1] + '. Sign-in methods: ' + m[2].split(', ').map(T).join(', ') + '.'; }],
    [/^Možeš preuzeti sve što imamo o tebi ili obrisati račun\. Politika privatnosti: ?$/, function () { return 'You can download everything we hold about you or delete your account. Privacy policy: '; }],
    [/^ ?Razumijem da gubim (\d+) neiskorištenih FLEXI posjeta\.$/, function (m) { return ' I understand that I lose ' + m[1] + ' unused FLEXI visits.'; }],
    [/^Imaš (\d+) neiskorištenih FLEXI posjeta\. Brisanjem računa gube se veza s paketom\.$/, function (m) { return 'You have ' + m[1] + ' unused FLEXI visits. Deleting your account loses the link to the package.'; }],
    [/^Nastavi s (.+)$/, function (m) { return 'Continue with ' + m[1]; }],
    [/^Poslali smo šestocifreni kod na (.+)\. Vrijedi 10 minuta\. Provjeri i neželjenu poštu\.$/, function (m) { return 'We sent a six-digit code to ' + m[1] + '. It is valid for 10 minutes. Check your junk mail too.'; }],
    [/^Prijavljen\/a kao (.+)\. ?$/, function (m) { return 'Signed in as ' + m[1] + '. '; }],
    [/^Još fali: (.+)\.$/, function (m) { return 'Still missing: ' + m[1].split(', ').map(T).join(', ') + '.'; }],
    [/^Iskoristi FLEXI paket \((\d+) slobodno\)\. Bez doplate\.$/, function (m) { return 'Use a FLEXI package (' + m[1] + ' free). No extra charge.'; }],
    [/^Kod primijenjen: (.+)$/, function (m) { return 'Code applied: ' + m[1]; }],
    [/^Ukupno (\d+(?:,\d+)?) KM, plaćanje po dolasku(\.?)$/, function (m) { return 'Total ' + m[1] + ' KM, pay on arrival' + m[2]; }],
    [/^ukupno (\d+(?:,\d+)?) KM\.$/, function (m) { return 'total ' + m[1] + ' KM.'; }],
    [/^besplatno\. Jedva čekamo da dođeš!$/, function () { return 'free. We cannot wait to see you!'; }],
    [/^Rezervacija je potvrđena tek kad ti potvrdimo emailom\.$/, function () { return 'Your booking is confirmed only when we confirm by email.'; }],
    [/^Popust (.+)% (\(.+\) )?je uračunat, redovna cijena je (.+) KM\.$/, function (m) { return 'Discount of ' + m[1] + '% ' + (m[2] || '') + 'is included, the regular price is ' + m[3] + ' KM.'; }],
    [/^Promo kod (.+): (.+)% popusta\.$/, function (m) { return 'Promo code ' + m[1] + ': ' + m[2] + '% off.'; }],
    [/^Kod primijenjen: (.+)% popusta\.$/, function (m) { return 'Code applied: ' + m[1] + '% off.'; }],
    [/^Promo kod važi za rezervacije do (\d+) sata\.$/, function (m) { return 'The promo code is valid for bookings of up to ' + m[1] + ' hours.'; }],
    [/^Promo kod važi samo za (.+)\.$/, function (m) { return 'The promo code is valid only for ' + m[1].split(' i ').map(T).join(' and ') + '.'; }],
    [/^Ovaj paket je za posjete od (\d+) sata\.$/, function (m) { return 'This package is for visits of ' + m[1] + ' hours.'; }],
    [/^dok ti ne potvrdimo emailom na (.+)\. Provjeri i spam\.$/, function (m) { return 'until we confirm by email at ' + m[1] + '. Check your spam folder too.'; }],
    [/^FLEXI paket: (.+)$/, function (m) { return 'FLEXI package: ' + m[1]; }]
  ];

  var BS_HINT = /[čćšžđČĆŠŽĐ]|\b(je|nije|ili|ste|smo|nam|vam|ti|na|za|od|do|po|se|ne|da|kod|koji|rezerv\w*|termin\w*|prostor\w*|poslali|piši|pokušaj\w*)\b/i;
  function lookup(s) {
    if (Object.prototype.hasOwnProperty.call(EXACT, s)) return EXACT[s];
    for (var i = 0; i < RULES.length; i++) { var m = RULES[i][0].exec(s); if (m) return RULES[i][1](m); }
    return null;
  }
  function T(str) {
    if (str == null) return str;
    var s = String(str);
    var lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0], core = s.slice(lead.length, s.length - trail.length);
    if (!core) return s;
    var r = lookup(core);
    if (r == null && core.indexOf(' · ') > 0) { r = core.split(' · ').map(T).join(' · '); }
    if (r == null && /[.!?]\s+[A-ZČĆŠŽĐ]/.test(core)) {
      var parts = core.split(/(?<=[.!?])\s+(?=[A-ZČĆŠŽĐ])/);
      if (parts.length > 1) r = parts.map(T).join(' ');
    }
    if (r == null && core.indexOf(', ') > 0) { var segs = core.split(', '); var out = segs.map(T); if (out.join('') !== segs.join('')) r = out.join(', '); }
    return lead + (r == null ? core : r) + trail;
  }
  /* true when a string still looks Bosnian after translation (used by tests) */
  function looksBosnian(s) { return BS_HINT.test(s); }

  var api = { T: T, EXACT: EXACT, RULES: RULES, looksBosnian: looksBosnian };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---------- browser part ---------- */
  var doc = root.document;
  if (!doc || doc.documentElement.lang !== 'en') return;
  root.SkriptaI18n = api;

  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var BUSY = false;
  function fixNode(n) {
    if (n.nodeType === 3) {
      var p = n.parentNode && n.parentNode.nodeName;
      if (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA') return;
      var t = T(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t;
    } else if (n.nodeType === 1) {
      if (n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE') return;
      ATTRS.forEach(function (a) { if (n.hasAttribute(a)) { var v = n.getAttribute(a), t = T(v); if (t !== v) n.setAttribute(a, t); } });
      if (n.nodeName === 'A') {
        var h = n.getAttribute('href') || '';
        var m = /^\/api\/racun\/oauth\/([a-z]+)\/start(\?.*)?$/.exec(h);
        if (m && !/[?&]l=en/.test(h)) n.setAttribute('href', '/api/racun/oauth/' + m[1] + '/start' + (m[2] ? m[2] + '&l=en' : '?l=en'));
        var map = { 'coffice.html': 'coffice-en.html', 'racun.html': 'racun-en.html', 'privatnost.html': 'privacy-en.html' };
        var mm = /^(coffice\.html|racun\.html|privatnost\.html)(#.*)?$/.exec(h);
        if (mm) n.setAttribute('href', map[mm[1]] + (mm[2] || ''));
        if (n.hasAttribute('download') && n.getAttribute('download') === 'moji-podaci-skripta.json') n.setAttribute('download', 'my-skripta-data.json');
      }
      for (var c = n.firstChild; c; c = c.nextSibling) fixNode(c);
    }
  }
  function run() {
    if (BUSY) return; BUSY = true;
    try { fixNode(doc.body); if (doc.title) { var t = T(doc.title); if (t !== doc.title) doc.title = t; } } finally { BUSY = false; }
  }
  /* language travels with API calls that create mail */
  var LANG_PATHS = /^\/api\/(rezervacija|racun\/kod-posalji|racun\/produzi|upit|obavijest)$/;
  var realFetch = root.fetch;
  if (realFetch) root.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      if (LANG_PATHS.test(path) && init && typeof init.body === 'string' && init.body.charAt(0) === '{') {
        var o = JSON.parse(init.body); o.lang = 'en'; init = Object.assign({}, init, { body: JSON.stringify(o) });
      }
    } catch (e) { /* send unchanged */ }
    return realFetch.call(this, input, init);
  };
  function start() {
    run();
    new MutationObserver(function () { run(); }).observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['href']) });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
