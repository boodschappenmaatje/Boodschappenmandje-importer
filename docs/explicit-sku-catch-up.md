# Gerichte Hoogvliet-SKU-catch-up

De catch-up route verwerkt uitsluitend SKU's uit een expliciet CSV-bestand. Zij
start geen catalogusdiscovery en accepteert alleen HTTPS-productpagina's op
`hoogvliet.nl` of het bestaande `www.hoogvliet.com`-alias.

```sh
npm run import:skus -- --file hoogvliet-missing-production-2026-10-06.csv --max 400 --dry-run
```

`--dry-run` is de default. Alleen `--write` geeft expliciete schrijfintentie:

```sh
npm run import:skus -- --file hoogvliet-missing-production-2026-10-06.csv --max 400 --write
```

De route dedupliceert SKU's als strings (dus leading zero's blijven behouden),
doet vóór detailvalidatie een bestaande-SKU-check en hergebruikt daarna
`validateCandidate` en `upsertProducts`. Ongeldige prijzen/productdetails,
404's en tijdelijke bronfouten worden per SKU geclassificeerd; de batch gaat
door. `catalog_import_runs` registreert een echte write-run, terwijl dry-run
geen databasewrite doet.

Een write wordt geweigerd als een daily-job running is of als de gedeelde
`catalog_import_runs`-lock bezet is. De bestaande unieke server-side running
index blijft de arbiter tegen een race tussen twee importers. De batchlimiet is
hard 400; bij een runtimegrens worden resterende SKU's expliciet als skipped
gerapporteerd. Hervatten met hetzelfde bestand is idempotent door de
bestaande-SKU-check.
