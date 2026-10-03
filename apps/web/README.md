# BoodschappenMaatje PWA

Dit is het technische PWA-fundament uit PWA 2. De app staat bewust onder
`apps/web`, naast de bestaande server-side Hoogvliet-importer. PWA 4 voegt een
getypeerde, read-only cataloguspreview toe. De slimme lijst, recepten-UI,
weekmenu en browser-writes zijn nog niet gemigreerd.

## Vereisten

- Node.js 22.12 of nieuwer
- npm

## Lokaal starten

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Open daarna `http://localhost:3000`.

## Publieke Supabase-configuratie

Stel lokaal en bij deployment alleen deze publieke variabelen in:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Een bestaande publieke anon-JWT mag als alternatief via
`NEXT_PUBLIC_SUPABASE_ANON_KEY` worden ingesteld. Gebruik precies één van beide
sleutelvariabelen.

Gebruik nooit `SUPABASE_SECRET_KEY`, een `service_role`-key of een andere
server-side secret in deze app. De knop onder **Meer** voert uitsluitend een
read-only `select id from recipes limit 1`-controle uit. **Producten** leest
maximaal tien bestaande `products` en hun exact via `product_id` gekoppelde
`product_prices`. Browser-writes zijn nergens geactiveerd.

De tabel- en RLS-inventarisatie staat in
[`docs/PWA4_SUPABASE_READ.md`](docs/PWA4_SUPABASE_READ.md). Pas vóór publieke
catalogustoegang de meegeleverde beveiligingsmigratie
`supabase/migrations/20260914193340_secure_catalog_browser_read.sql` toe en verifieer
de policies in het Supabase Dashboard.

## PWA-keuze

De basis volgt de officiële Next.js App Router-conventies:

- `src/app/manifest.ts` voor het web app manifest;
- een kleine standards-based service worker in `public/sw.js`;
- registratie alleen in productie;
- app-shell/offline-fallback zonder database- of gebruikersdata te cachen.

Dit houdt de dependencyset klein en voorkomt koppeling aan een buildplugin. De
service worker is bewust alleen een basis; IndexedDB en volledige offline sync
horen bij een latere PWA-stap.

## Kwaliteitscontrole

```bash
npm run check
```

Dit genereert eerst de Next.js-routetypen en voert daarna ESLint, TypeScript,
Vitest en een productiebuild uit. Daardoor werkt de controle ook in een verse
checkout zonder bestaande `.next`-map.

## Deploymentvoorbereiding

Gebruik voor de tijdelijke testdeployment in PWA 3 een Node-platform dat Next.js
16 ondersteunt. Configureer daar de twee publieke environment variables. Er zijn
geen lokale absolute paden en geen Xcode- of macOS-afhankelijkheden.
