# PWA 14 Fix 1 — mockup-uitwerking

Voortgezet vanaf remote `d820e09ba1254acf51505e2b7e8f3e2a3bee5d77`, dezelfde featurebranch en Draft PR #27.

## Schermen

- Vrije keuze: voortgang bovenaan, vier directe actiekaarten in een 2×2-raster, daarna gekozen maaltijden met foto, dag, personen en prijs. Bestaande slotlimiet blijft leidend. Bij maximum expliciet vervangen; Mijn recepten en Zelf maken blijven beschikbaar zonder extra weekplek te creëren.
- Nieuw/Bewerk recept: eigen schermkop, compacte invoervelden en productregels; hoeveelheden, secundaire vervang/verwijderacties, verpakkingsinput bij onbekende inhoud en actuele prijzen blijven werken. Het dubbele ingrediëntenoverzicht onder de editor is verwijderd. Bewaren staat als primaire actie onderaan.
- Receptdetail: foto naast kerngegevens, budgetstatus, vijf compacte ingrediëntenregels met hoeveelheid apart, overige ingrediënten inline uitklapbaar. Bewerk recept en Voeg toe aan lijst staan naast elkaar. Opslaan keert terug naar detail; heropenen controleert prijzen opnieuw.
- Menu: dezelfde compacte ingrediëntenregels in bestaande accordions; openen blijft binnen Menu. Bottom navigation houdt Menu actief binnen Vrije keuze.

De mockup bepaalt de structuur. Bestaande blauwe stijltokens en echte Hoogvliet-producten blijven behouden. Geen fictieve foto of beschrijving toegevoegd aan eigen recepten; bestaande neutrale fallback blijft gelden.

## Behoud

Geen wijziging aan matching-, hoeveelheid-, budget- of lijstsyncservices. Bestaande herberekening, expliciete budgetoverride, conceptopslag, persoonlijke recepten en bescherming handmatige lijstwijzigingen behouden. Geen opslaglimiet gekoppeld aan weekplekken. Geen databasewijziging, import, merge of Production-deploy.

## Lokale controle

- Lint en TypeScript geslaagd.
- 539 webtests / 50 bestanden geslaagd, inclusief PWA 13/14 en acht aanvullende scherm-/navigatiechecks.
- 189 importerregressies geslaagd; uitsluitend fixtures, geen productimport.
- Production-build lokaal geslaagd (18 pagina's).

Previewcontrole volgt op de featurebranch. Fysieke iPhone-controle blijft de gebruikersacceptatietest.

Preview-vinding: expliciet geopend receptdetail krijgt voorrang op een ouder concept voor dezelfde weekdag. Hierdoor blijft de gekozen personenbasis bij vervangen behouden. Reguliere editor blijft concepten herstellen; extra regressietest toegevoegd. De gekozen weekplek blijft vaststaan tijdens bevestigen.
