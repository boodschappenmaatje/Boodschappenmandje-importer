# Home Optie C — implementatie en acceptatie

## Bron en scope
Gebruikersreferentie `IMG_0326(2).jpeg`, uitsluitend rechter telefoon **C — Speels & persoonlijk**. Remote uitgangspunt `31705dd90c1f6d4b6d705b24219958f0c7894c84`. Draft PR #30 / `feature/home-option-c`. Geen merge of Production-actie.

## Vooraf geanalyseerde compositie
- Kleine merkregel bovenaan; zachtblauwe achtergrond en donker marineblauwe, zware afgeronde letters.
- Hero ongeveer 180px hoog op een smalle telefoonkolom: tekst links circa 58%, karakter rechts circa 42%; “Hoi!” duidelijk groter dan de twee regels eronder.
- Los wit 3D-bonnetje met donkere contour en duimpjes, lichte blauwe halo en afzonderlijk blauw tekstwolkje; onderzijde karakter steekt een klein stuk over de kaart.
- Budgetbon is visueel zwaartepunt: circa 230–250px hoog, blauwe diagonaalgradient, witte grote restwaarde, twee compacte transparante regels, groene balken en kartelrand.
- Kleine gerechtfoto links, compacte tekst en chevron rechts. Geen extra omlijnde grote gerechtkaart.
- Donkerblauwe pilvormige lijstactie, ronde groene winkelwagen, witte titel en producttelling. Dun omlijnde kalenderactie eronder.
- Rustige witte vijfdelige bottom navigation. Hoofdfuncties blijven de bestaande routes.

## Implementatie
`HomeDashboard` gebruikt dezelfde budget-, actieve-lijst- en weekproviders en ongewijzigde `calculateWeekBudgetSummary`, `calculateDishCostSummary` en `recipeImageFor`. Maaltijden gebruikt de bestaande generation-samenvatting; losse lijstbijdragen blijven alleen in het weektotaal. Geen nieuwe datafetch, state, API of opslagformaat.

`AppHeader` wordt zoals eerder uitsluitend op Home getoond. Lokale CSS en nieuwe `--home-c-*` tokens hebben geen invloed op andere schermen. Nunito 900 Latin is lokaal opgeslagen uit @fontsource/nunito 5.3.0 onder OFL, met licentie. De rest van de app houdt zijn bestaande fonts/tokens.

## Mascotte
- Bron: bestaand officieel `apps/web/public/icons/maatje-v1-512.png`.
- Bewerking via ingebouwde imagegen; achtergrondextractie met identiteit, gezicht en duimpjes behouden.
- Productieasset: `apps/web/public/branding/maatje-home-c.webp` (640×640, alpha, circa 55 kB), geoptimaliseerd met Sharp. Het officiële app-icoon is niet gewijzigd.
- Prompt: “Use case: background-extraction. Edit target: the attached official BoodschappenMaatje app icon. Produce a transparent PNG asset for a website hero. Remove ONLY the entire blue square and blue circular background. Keep the same friendly white 3D receipt mascot, its navy scalloped outline, smiling face, eyes, light blue cheeks and receipt lines, two white thumbs up and white expression rays. Preserve character identity and proportions precisely. Entire character visible, isolated, clean alpha transparency including gaps beside hands, modest transparent margin. No text, no speech bubble, no extra objects, no replacement character. Transparent background, not a checkerboard drawn into the image.”

## Bewuste verschillen met de referentie
- Echte bedragen, aantallen, gerecht en bijbehorende bestaande afbeelding; nooit de referentievoorbeelddata.
- Zonder volledige week: “Je week begint hier.”, passende lege maaltijd en “Maak mijn week”.
- “Eerst op je menu” in plaats van “Vanavond”: de huidige week heeft volgordeposities, geen datum per gerecht of gegeten-markering. Eerste daadwerkelijk gekozen gerecht wordt getoond; vrije plaatsen worden overgeslagen.
- Bestaande weekinstellingen en Nieuwe week blijven in een compacte uitklapper bereikbaar. Bevestigingsflow ongewijzigd.
- Overschrijding heeft tekst en een amberkleurige balk; onbekende prijzen geven geen fictief restant.
- Geen exacte bronfont beschikbaar in rasterreferentie; lokale Nunito geeft de zware afgeronde lettervorm. Kartelrand is een robuuste CSS-benadering.

## Geautomatiseerde controle
Eerste volledige ronde: 745 webtests / 63 bestanden, kernset 248 / 14, lint, TypeScript en lokale Production-build groen. De 12 toegevoegde scenario's bewaken afzonderlijke budgetten/percentages, onbekende prijzen, overschrijding, eerste echte maaltijd, eigen-receptpersonen, lege week, lange naam, 1/2/4/10 personen, €1.000 en vijf navigatieroutes.

Bestaande echte provider-/UI-integratie uitgebreid: recept↔lijst plus onafhankelijke extra → Home toont €7,16 week, €5,37 maaltijden, €92,84 over en 2 producten; beide CTA's, cold reopen en annuleren Nieuwe week behouden de gemaakte keuzes.

Geen importerwijzigingen. De bestaande CI-releasegate voert verplicht zijn importerfixtures/seedchecks uit, zonder import of DB-actie.

## Preview en fysieke acceptatie
Preview: https://boodschappenmaatje-pwa-git-feature-ho-02f3d4-dennisverkaik-4661.vercel.app

Work-browser heeft geen telefoonviewport/resize-capability; gecontroleerd in een echte smalle Home-contentkolom van 390px binnen desktop. Dit is geen fysieke mobiele of Dynamic Type-acceptatie.

Live eindbewijs wordt na de laatste Preview-controle hieronder aangevuld. Fysieke iPhone-test blijft vereist vóór merge.
