# Persistente planner-cache

Deze PWA 12-performancefix voegt uitsluitend afgeleide, opnieuw opbouwbare data toe:

- `ingredient_product_matches` bewaart de centrale ingrediënt/productmatch;
- `recipe_readiness_cache` bewaart READY/NOT READY per recept en 1–12 personen;
- browserrollen hebben alleen `SELECT` via RLS;
- writes lopen via server-side `SUPABASE_SECRET_KEY`;
- recept-, ingrediënt-, product- en prijswijzigingen markeren alleen afhankelijke rijen als `pending`;
- de planner gebruikt geldige rijen zonder een volledige readiness-evaluatie of productzoekactie;
- ontbrekende of stale rijen vallen alleen voor de betrokken recepten terug;
- de gerichte fallback vult voor een nieuw of gewijzigd recept automatisch alleen
  ontbrekende/stale readiness voor 1–10 personen aan; andere recepten blijven ongemoeid;
- Data Health gebruikt dezelfde resolver en dezelfde READY-definitie.

## Veilige uitrol

De migratie staat in `supabase/migrations/20260919_persistent_planner_readiness_cache.sql`.
Pas haar niet vanuit een Preview op Production toe. Controleer eerst de SQL en RLS in een lokale of
afzonderlijke developmentdatabase. De PWA blijft zonder toegepaste migratie werken via de gerichte
fallback.

## Hervatbare backfill

De interne backfill verwerkt maximaal twintig recepten per request en retourneert `nextCursor`.
De meegeleverde runner hervat via `PLANNER_CACHE_CURSOR` en gebruikt idempotente upserts:

```bash
PLANNER_CACHE_BASE_URL=https://preview.example \
PLANNER_CACHE_ADMIN_TOKEN=... \
PLANNER_CACHE_PEOPLE=4 \
npm run cache:backfill
```

Herhaal dit later voor de gewenste aantallen personen 1–12. Start deze opdracht niet tegen
Production voordat de migratie apart is goedgekeurd. Een onderbroken run kan met de laatst geprinte
cursor worden hervat.

De backfill slaat reeds actuele readiness over. Productmatches blijven gedeeld: dezelfde match_key
wordt niet per personenaantal gekopieerd.

## Match Repair

`POST /api/internal/planner-readiness/repair` vereist dezelfde admin-token. De server valideert de
gekozen productmatch, invalideert via de match-key en herberekent uitsluitend reeds gecachete
personenvarianten van recepten die deze match gebruiken. Andere recepten blijven ongemoeid.
