# BoodschappenMaatje PWA

Dit is het technische PWA-fundament uit PWA 2. De app staat bewust onder
`apps/web`, naast de bestaande server-side Hoogvliet-importer. PWA 2 bevat nog
geen migratie van de slimme lijst, recepten, weekmenu of browser-writes.

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

Gebruik nooit `SUPABASE_SECRET_KEY`, een `service_role`-key of een andere
server-side secret in deze app. De knop onder **Meer** voert uitsluitend een
read-only `select id from recipes limit 1`-controle uit. Browser-writes blijven
uitgeschakeld totdat RLS expliciet is gecontroleerd.

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

Dit voert ESLint, TypeScript, Vitest en een productiebuild uit.

## Deploymentvoorbereiding

Gebruik voor de tijdelijke testdeployment in PWA 3 een Node-platform dat Next.js
16 ondersteunt. Configureer daar de twee publieke environment variables. Er zijn
geen lokale absolute paden en geen Xcode- of macOS-afhankelijkheden.
