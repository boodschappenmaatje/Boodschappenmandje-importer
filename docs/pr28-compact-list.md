# PR #28 — compacte boodschappenlijst

Hervat vanaf remote `3609823c70bc010a4134483a81aed368e2b73467`. Bestaande branch, Draft PR en tweerichtingssync behouden. Aanvullende fysieke feedback vraagt minder scrollen en details op aanvraag; de meegestuurde conceptafbeelding is de visuele referentie.

## Implementatie
- ShoppingListItemCard toont checkbox, 40px foto, naam (maximaal twee regels, volledig in details), verpakking/gebruikte positieve prijs, herkomst en 44px −/+.
- LinkedShoppingListItem houdt dezelfde usePackageMutation en contribution-resolutie. Geen wijziging aan prijs-, planner-, budget-, opslag- of quantity-services.
- ShoppingListQuantity is uitsluitend gedeelde presentatie voor bestaande callbacks.
- ShoppingListDetails volgt het bestaande paneelpatroon, met focus bij openen/terugkeer, Escape/sluiten, scrollblokkade, volledig product, totale aankoopprijs, prijsdatum, afzonderlijke herkomstkeuzes, losse extra en veilig verwijderen.
- ShoppingListOrigins gebruikt gevalideerde koppelingen en customDish; geen afleiding uit naam/SKU. Menu = maaltijdkom; eigen recept = koksmuts; los = plus/groen. Meerdere maaltijden krijgen een teller. Suggestie/recurring blijven herkenbaar.
- Alles/Maaltijden/Overig is een filter op bestaande bijdragen. Gemengde items horen bij beide relevante filters en tonen het volledige aankoopaantal. Nog te halen/Afgevinkt blijft beschikbaar.
- Categorieën behouden hun catalogusnamen, compacte kop en aantal. Geen grote permanente actieknoppen per rij.

## Geautomatiseerde validatie
636/636 webtests, 189/189 importerfixtures, lint, TypeScript en Production-build geslaagd. Bestaande PR #28-dekking is behouden; tests openen nu eerst details voor secundaire acties. Toegevoegd: details/focus/Escape, filters met gemengde bijdragen, afvinken en heropenen, eigen recept in rij/detail, manual detailbediening/verwijderen/undo, suggestie/recurring en geen verzonnen eigen-receptlabel.

De volledige suite bevat recipe/package/quantity, contribution/origin, lijstsync, pricing, budget, planner, readiness/cache en PWA. De bestaande prijsupdatefixtures bewijzen behoud van expliciete aantallen bij een nieuwe prijs.

## Preview
Eerste codecommit `1fcc3086`; visuele scopefix `794d250f` voorkomt dat categoriekoppen en de oude quantity-grid het detailpaneel beïnvloeden. Beide Preview-builds Ready. Na de scopefix opnieuw 636 tests, lint, TypeScript en build groen.

Beschikbare browser gecontroleerd op 1363 × 936 en een smalle weergave van 500 × 856; geen fysieke iPhone-emulatie. Gemeten normale rijhoogte **100–101px**, tegen **227,9px** vóór deze wijziging: circa **56% lager**. Vier volledige normale producten met categoriekoppen en een vijfde deels zichtbaar in de eerste weergave. Vijf aaneengesloten normale regels vragen circa 505px; het iPhone-aantal hangt van viewport, namen en categoriekoppen af. Geen horizontale overflow in beide gemeten breedtes; detailpaneel 485px client- én scrollbreedte in de smalle weergave. Alle gemeten −/+-knoppen 44 × 44px. Lange Knorr-naam circa 114px rijhoogte op 500px breedte. Fysieke iPhone-touch/layout/PWA-hervatten blijft de acceptatiestap.

## Functionele browserbewijzen

| Controle | Resultaat |
| --- | --- |
| Compacte categorie | Internationale keuken/pasta/rijst met vijf producten; rustige gezamenlijke regels en categorieteller. |
| Menu en los | Italiaans roerbakproduct toont maaltijdicoon, receptnaam en afzonderlijk plus/Los. Details tonen Honig per dag/ingrediënt en het losse deel. |
| Lijst → recept | Directe lijst-min 2→1 geeft Honig 400g, €13,06 totaal en €6,53 p.p.; maaltijdruimte €30,23. |
| Recept → lijst | Honig-plus 1→2 geeft 800g, €14,95 totaal en €7,48 p.p.; compacte lijst toont 2. |
| Losse extra | Toevoegen vanuit details geeft 3 = recept 2 + los 1. Gericht recept naar 1 geeft 2 = recept 1 + los 1. Algemene plus opent details zonder extra mutatie. |
| Meerdere recepten | Spinazie toont “2 maaltijden”. Algemene plus opent herkomst. Gerichte min voor dag 2 geeft 800g/1 verpakking; dag 4 blijft 300g/1 verpakking. Lijst koopt samen 2. Een eerdere validatiepoging werd veilig afgewezen en hield beide aantallen gelijk; opnieuw uitvoeren na herladen slaagde. |
| Eigen recept | Via bestaande editor “Previewtest eigen groente” met echte Broccoli 400g à €2,29 gemaakt en op vrije plek dag 3 toegevoegd. Rij toont koksmuts/Eigen recept; details volledige naam/dag. Lijst-plus geeft 800g/€4,58 in Menu; min in Vrije keuze geeft opnieuw 400g/€2,29 en lijst 1. |
| Filters/afvinken | Overig toont de twee bestaande gemengde producten met een los deel; Maaltijden toont de gekoppelde producten. Afvinken Italiaanse roerbak + Afgevinkt toont alleen dat product; totaal blijft gelijk. |
| Details/sluiten/verwijderen | Openen/sluiten werkt; volledige prijsdatum en herkomst zichtbaar. Verwijder bij gekoppeld item geeft veilige uitleg en wijzigt niets. Manual-only verwijderen/undo aanvullend via echte DOM-regressie getest. |
| Opslag/navigatie | Volledige browserrefresh behoudt afvinken, eigen recept en Honig 1 + los 1. Menu ↔ Lijst ↔ Vrije keuze en heropenen geslaagd. |
| Eindbudget | Maaltijden €41,11; losse courgette €0,79 + losse roerbak €1,89; lijst €43,79, weekruimte €56,21. Geen verschil tussen de schermen. |

**KLAAR VOOR FYSIEKE IPHONE-HERTEST.** Code `794d250f2b5dce774f6bf7bb23b3add797092882`, Vercel Ready; aansluitende checkpointcommit bevat alleen documentatie. Geen merge, Production-deployment, databasewijziging, migratie of productimport. Nog geen fysieke acceptatie.

iPhone: controleer 4–5 normale regels tijdens scrollen, leesbaarheid en touch; open details van menu/eigen/los; lijst en recept 1→2→1; voeg een losse extra toe en behoud die; kies bij twee recepten de juiste bron; vink af, sluit/heropen en hervat de PWA.
