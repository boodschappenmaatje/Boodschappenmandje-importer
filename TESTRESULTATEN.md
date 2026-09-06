# Technische controle — Fase 3B uploadpakket

Datum: 6 september 2026

## Geslaagd

- Node-syntaxcontrole van alle importmodules.
- Zeven gerichte unit-tests.
- Harde bovengrens van tien producten.
- Strikte negen-cijferige SKU-controle.
- Alleen officiële Hoogvliet-product-URL's worden toegelaten.
- Prijs wordt alleen uit een expliciet bedrag gelezen.
- Gewicht wordt alleen bij een eenduidige gram-/kilogramverpakking afgeleid.
- Alleen een parseerbare eenvoudige aanbieding krijgt aanbiedingstatus en datums.
- Product-upsert gebruikt `supermarket,sku`.
- Prijs-upsert gebruikt het door Supabase teruggegeven `product_id`.
- Ontbrekende optionele waarden overschrijven geen bestaande betrouwbare productdata.
- Workflow-YAML is parseerbaar en kan alleen handmatig worden gestart.
- Geen sleutelwaarden in bronbestanden of workflow.

## Nog uit te voeren in GitHub Actions

De echte browserrun en Supabase-write kunnen pas binnen de private GitHub-repository plaatsvinden, omdat uitsluitend daar de vereiste secrets zijn ingesteld. De lokale Work-runtime kon de Chromium-binary niet downloaden: de externe download arriveerde afgebroken/ongeldig. Daarom wordt in dit checkpoint niet beweerd dat er al echte producten zijn geïmporteerd.

Start de meegeleverde workflow. Bij een succesvolle run vermeldt de log maximaal tien gevalideerde SKU/naam/prijs-combinaties. Bij een CAPTCHA of toegangsblokkade stopt de importer zonder omzeiling.
