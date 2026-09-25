# PR #28 — iPhone-feedbackronde 25 september 2026

## Uitgangspunt
De afgekeurde compacte Preview is hervat op dezelfde branch/Draft PR vanaf remote `7faf0ffd`. De lokale uitgangsboom is gecontroleerd tegen remote `9576a229eba845793b9f982f55d679556b6e75ce`. Bestaande functionaliteit, documentatie en funderingsroadmap zijn behouden.

## Oorzaken en wijzigingen
- Alternatieven/zelf zoeken waren `text-action` knoppen zonder voldoende visueel gewicht. Nu gedeelde compacte knopstijl met officiële tokens, minimaal 44px, pressed/disabled/focus.
- `applyManualProductToRequirement` behield de naam van het oorspronkelijke ingrediënt. Nu volgt die de expliciete productkeuze; alleen de catalogusmerkprefix wordt generiek verwijderd. Receptdefinities en exacte contribution-adressen veranderen niet. Opnieuw toepassen van opgeslagen expliciet bevestigde alternatieven gebruikt dezelfde route. Dagbijdragen met hetzelfde vervangende product blijven afzonderlijk.
- Alle categoriekoppen zijn disclosure-buttons met teller, chevron, aria-expanded/controls en afzonderlijk lokaal opgeslagen presentatiestand. Inhoud blijft gemount zodat afvinken/details/hoeveelheden niet opnieuw worden aangemaakt door inklappen.
- De bestaande planner zocht al verschillende geldige combinaties, maar behield gerechten buiten de budgetzoektocht en telde die pas achteraf op. Ook een categorie-update plande alleen de ene dag en synchroniseerde zonder volledige harde eindgrens. Beide routes rekenen nu met alle behouden gerechten en hun echte gezamenlijke aankoopverpakkingen tijdens de zoekactie.
- Een automatische generatie gebruikt nooit een opgeslagen handmatige override als toestemming om boven budget te plannen. Alleen een expliciete handmatige bevestiging blijft toegestaan via de bestaande flow.
- Een mislukte generatie vervangt geen bestaande opgeslagen week door een leeg resultaat. Tijdens zoeken blijft de vorige opgeslagen week intact; de bestaande lijst blijft ongewijzigd. Een herstelpaneel biedt budget/dagen/verdeling en zelf kiezen. De knop om lege plaatsen zelf in te vullen zet alleen die lege plaatsen om naar Vrije keuze.

## Zoekmethode en betrouwbaarheid
De bestaande READY-selectie per gekozen categorie blijft leidend. De planner zoekt via voorkeur-, variatie- en kostenroutes, probeert goedkopere geldige kandidaten en staat waar nodig herhaling toe. Iedere complete kandidaat wordt opnieuw beoordeeld op gezamenlijk te kopen verpakkingen en integer-centprijzen. Voor maximaal 25.000 combinaties wordt het minimum exhaustief bepaald. Bij grotere zoekruimten worden meerdere startcombinaties en lokale verbeteringen onderzocht; de UI noemt dan uitsluitend de goedkoopste **gevonden** combinatie, niet een bewezen minimum. Categorievoorkeuren worden niet stil veranderd. Nieuwe productmatches of prijzen worden niet verzonnen.

## Regressiebewijs
- 676/676 webtests, 57 testbestanden; lint, TypeScript en lokale Production-build geslaagd.
- 189/189 importerfixtures geslaagd; geen import uitgevoerd.
- Echte UI: kipfilet→boomstammetjes (600g), spaghetti→rijst (1kg), melk→havermelk (1l). Naam/product/foto/verpakking, maaltijd €4,28, lijst €6,07 inclusief beschermde losse oude verpakking, heropenen, lijst-plus→recept en recept-min→lijst gecontroleerd.
- Echte UI: Meer alternatieven toont 3→4 resultaten; Zelf zoeken opent de werkende zoekflow.
- Vier categorieën onafhankelijk dicht/open; teller, Alles/Maaltijden/Overig en afgevinkt-filter; heropenen bewaart stand; lijstgegevens/totaal exact gelijk.
- €100 week / €70 maaltijd: €70,00 automatisch toegestaan, €70,01 afgewezen. Behouden €60-gerecht + nieuw €10-gerecht wordt gevonden; €60 + €10,01 wordt geweigerd met betrouwbaar minimum €70,01.
- 24 combinaties: personen 1/2/4/6/10/12 × dagen 1/3/5/7, correcte hoeveelheden/verpakkingen en automatische maaltijdkosten ≤€70.
- Objectief onhaalbare fixture: bestaande week/lijst blijven gelijk; instellingenactie werkt, recepten blijven zichtbaar. Lege week→handmatig kiezen toont READY recept, vraagt expliciet bovenbudgetbevestiging en commit pas na die klik.
- Bestaande prijsfallback/automatische nieuwe prijs, Honig/Knorr, eigen recepten, package/minimum, beide syncrichtingen, meerdere oorsprongen, handmatige extra's, cache/readiness/planner en PWA-tests zijn behouden.

## Preview
Codecommit: `9dea73ae190185079de551ffe385b7a2f7b0dd8e`. Preview-validatie staat hieronder; fysieke iPhone-acceptatie staat los van de browsercontrole.

Aanvullend tijdens Preview ontdekt en veilig gecorrigeerd: gewone zoete aardappel was automatisch aan babyvoeding gekoppeld. De generieke categoriecontrole weigert babyvoeding voor automatische ingrediënten, zonder verse babyspinazie op naam te blokkeren. Matcher/evaluator-cacheversies 4 maken oude matches ongeldig. Geen data gewijzigd; expliciete handmatige keuzes blijven intact. Nieuwe code `93d0e8a6`. Volledige webcheck opnieuw groen (674 tests, lint, TypeScript, build).


### Aanvullende behoudcontrole
Code `450bde1133b64eb710a6009bf3e955036b04c010` bewaart ook expliciete keuzes in normale gerechten bij de voorbereiding van een budgetherpoging. Die keuzes werden voordien vóór de zoekservice weggefilterd, terwijl Vrije keuze wel behouden bleef. Een regressietest bewaart de vervangende SKU en 2 expliciete verpakkingen bij een lager budget. De alternatievencomponent wordt bij een nieuwe product-ID opnieuw opgebouwd; oude alternatieven/prijsverschillen blijven niet onder de nieuwe productnaam staan. Volledige check: 674 tests, lint, TypeScript en build groen.

### Live browserbewijs
- Meer alternatieven: 3→5 werkelijke kipnuggetalternatieven; Zelf zoeken opent cataloguszoekveld en bevestigingsflow.
- Kipfilet 400g/€5,99 → Hoogvliet Boomstammetjes 200g/€2,49: actuele kop Boomstammetjes, nieuwe foto/inhoud/prijs; gerecht €8,60→€5,10.
- Basmatirijst → Lassie Biologische couscous: actuele kop Biologische couscous, 275g/€1,35; maïskorrels → Broccoli 400g/€2,29. Beide bewaard na navigatie en volledige reload.
- Acht aanwezige categorieën onafhankelijk dichtgeklapt; internationale keuken afzonderlijk geopend, teller/checkbox en maaltijd-/afvinktfilter gecontroleerd. Lokale stand blijft bij navigatie en reload bestaan; bedragen veranderen niet door inklappen.
- Werkelijke vijfdaagse 4p/€100/€70-week na veilige matchcorrectie: €35,58. Expliciete inhoudelijke vervangingen geven daarna €34,47.
- Broccoli: losse verpakking toevoegen geeft lijst €36,76 terwijl maaltijden €34,47 blijven. Gerichte lijst-plus op recept geeft 2 receptverpakkingen/800g + los 1, lijst €39,05 en maaltijden €36,76. Volledige reload behoudt die verdeling.
- Recept-min zet broccoli 800→400g, maaltijden €36,76→€34,47 en lijst €39,05→€36,76; losse bijdrage blijft 1.
- Goedkopere zoekactie in echte Preview: bestaande week €34,47, expliciet budget naar €30 gezet. Planner vindt vijf geldige maaltijden voor **€25,97**, lijst **€28,26** inclusief ongewijzigde losse broccoli €2,29. Couscous, broccoli en boomstammetjes blijven bewaard; overige automatische gerechten veranderen naar goedkopere combinaties. Geen automatische budgetverhoging.

- Onhaalbare live proef: €1 maaltijdbudget. Geen automatische commit; bestaande vijf maaltijden €25,97 en lijst €28,26 blijven exact staan. Herstel noemt €19,85 als goedkoopste **gevonden** complete combinatie (geen bewezen minimum), biedt instellingen/verdeling en handmatige aanpassing.
- Bij gedeelde penne opent algemene lijst-plus uitsluitend herkomstkeuze voor twee gerechten; geen hoeveelheid of totaal wijzigt. Overig toont alleen de gemengde broccoli; afvinken + categorie dicht/open behoudt 2 verpakkingen en totaal €28,26.

### Laatste correcties uit de doorklikcontrole
Code `5e76572d5ce534b6d68d44052026e43151e423e1`: bij een volledig bestaand menu verwijst de handmatige herstelactie naar de behouden gerechten in Menu, met uitleg hoe je een gerecht/ingrediënt vervangt. Een lege week houdt de route naar Vrije keuze. Zo leidt de herstelactie niet naar een scherm zonder vrije plaatsen.
De weekprijs in een handmatige budgetbevestiging gebruikte nog een voorraadverrekening voor een losse extra van dezelfde SKU. De impactberekening projecteert nu exact dezelfde contributions als de uiteindelijke lijstsync. Nieuwe fixture: recept €2 + los €2 wordt na verhoging recept €4 + los €2 = week €6; bij weekbudget €5 is expliciete bevestiging vereist. Volledige check opnieuw groen: **675 tests, lint, TypeScript, Production-build**.


## iPhone-hertest
1. Open een gerecht, tik Vervang; controleer de herkenbare knoppen Meer alternatieven en Zelf zoeken.
2. Vervang kipfilet door boomstammetjes en twee andere ingrediënten. Controleer kop, foto, inhoud, prijs en heropenen.
3. Klap verschillende lijstcategorieën los van elkaar dicht/open. Controleer tellers, Alles/Maaltijden/Overig en Nog te halen/Afgevinkt.
4. Recept 1→2 verpakkingen, lijst terug 2→1; hoeveelheid en bedragen moeten volgen. Voeg los 1 toe; wijzig alleen de receptbijdrage. Bij gedeelde producten eerst herkomst kiezen.
5. Plan 4 personen/5 dagen/€100/€70. Verlaag daarna bewust het maaltijdbudget: zoekactie moet binnen die grens blijven, of oude week/lijst behouden met herstelacties. Handmatig boven budget mag uitsluitend na bevestiging.
6. Sluit/heropen de PWA en controleer keuzes, losse bijdrage en inklapstanden.

Work bood geen telefoonviewport; functionele desktopbrowsercontrole is uitgevoerd. Fysieke iPhone-touch/layout/PWA-hervatten blijft de acceptatiestap. Geen merge, Production-deployment, databasewijziging, migratie of import.

- Laatste Preview `5e76572d`: herstelactie Zelf gerechten aanpassen klikt direct naar de behouden week. Daar werkt de afzonderlijke handmatige waarschuwing: €28,46 maaltijden en **€30,75 week**, inclusief los €2,29; vóór Toch gebruiken blijft het oorspronkelijke totaal €25,97/€28,26 staan.

**Stoppunt: KLAAR VOOR FYSIEKE IPHONE-HERTEST.** Laatste functionele code `d4b29d153da6ee475c6e0378b26b07a56e6bb85b`, Preview success/Ready. Aansluitende docscommit verandert de geteste code niet.

- Handmatige bevestiging daadwerkelijk uitgevoerd: 2 verpakkingen boomstammetjes/400g, maaltijden €28,46, lijst €30,75. Daarna instellingen teruggezet op 4p/5d/€100/€70; keuzes en losse bijdrage behouden.
- Slotfix `d4b29d15`: een catalogusrefresh zonder inhoudelijke wijziging vervangt niet langer de lijst door alleen een nieuw updatedAt. Dat veroorzaakte een vals gelijktijdigheidsconflict tijdens bevestiging. De echte wijzigingscontrole blijft hard; nieuwe prijs €2,50→€2,75 wordt nog steeds toegepast met behoud van hoeveelheid. **Eindregressie 676/676 webtests, lint, TypeScript, build; importerfixtures 189/189.**
