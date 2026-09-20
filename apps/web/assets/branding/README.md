# Officieel BoodschappenMaatje app-icoon

Bron: de door de eigenaar aangeleverde JPEG, ongewijzigd bewaard als
`boodschappenmaatje-original.jpeg`. SHA-256:
`c77530d67cd5d19a7251672d4dcc0a4fae0909aed3f5490ad1f7d001b31e648f`.

Reproduceren vanuit `apps/web`: `node scripts/generate-app-icons.mjs`.
Het script gebruikt Sharp uit de bestaande Next.js-installatie. Geen AI-generatie,
nieuwe mascotte, tekst, vervorming of kleurcorrectie van het logo.

- Vierkante crop: x=72, y=60, 1112×1112 uit de 1254×1254-bron.
- Alleen resterende witte buitenhoeken worden gevuld met aangrenzend bronblauw.
- PNG's: Apple 180, PWA 192/512, favicon 16/32; Lanczos3-resampling, volledig dekkend.
- ICO: 16/32/48 PNG-frames.
- Maskable 512: logo op 390 pixels, 61 pixels bronblauwe veiligheidsmarge rondom;
  voorgrond binnen de 40%-radiuscirkel. De blauwe buitenhoeken krijgen een masker,
  niet het bonnetje of de duimen.
- Nieuwe `maatje-v1-*`-namen voorkomen hergebruik van oude icoonresponses.

De bestaande metadata-configuratie blijft het enige icoonregister voor HTML.
Het bestaande manifest houdt alle niet-icooninstellingen. De shell-cacheversie en
registrar worden samen vernieuwd volgens het bestaande updatebeleid; er wordt
geen IndexedDB, boodschappenlijst, planner-cache of andere gebruikersdata gewist.
Oude bestanden blijven beschikbaar voor oudere installaties, maar zijn niet meer
geregistreerd in metadata, manifest of nieuwe precache.

Fysieke test: open de branding-Preview in Safari op iPhone/iPad, meld indien nodig
aan bij Vercel, kies Deel → Zet op beginscherm en controleer het icoon en starten.
Een reeds geïnstalleerd icoon kan door iOS behouden blijven; gebruik eerst een
nieuwe Preview-installatie. Verwijder niet onnodig de bestaande Production-PWA
met lokale gegevens. Deze wijziging is pas na goedkeuring voor Production bedoeld.
