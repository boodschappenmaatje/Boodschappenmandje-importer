# Tomaten per stuk in Honig/Knorr-mixen — 30 september 2026

Schrijfvrije controle van de vijf actuele `meal_mix_profiles` en `recipe_readiness_cache`-varianten (personen 1–10) in project `pjcqxufvbkkjehituzxz`, vergeleken met de openbare Hoogvliet-productdetails. Dit is geen prijsupdate of cacheverversing.

| Receptmix-SKU | Recept | Eis volgens de exacte mixpagina | Status voor / na deze codewijziging |
|---|---|---|---|
| 718350000 | Honig Basis voor chili con carne | 4 tomaten | NOT_READY / NOT_READY |
| 731728000 | Honig Bakplaat mix broccoli & rundervink | 2 middelgrote tomaten | NOT_READY / NOT_READY |
| 731729000 | Honig Bakplaat mix courgette & kip | 2 middelgrote tomaten | NOT_READY / NOT_READY |
| 704882000 | Knorr Wereldgerechten Mexicaanse taco's | 2 tomaten | NOT_READY / NOT_READY |
| 730044000 | Knorr Maaltijdmix kip madras | 2 tomaten | NOT_READY / NOT_READY |

Mixbronnen: [chili](https://www.hoogvliet.com/product/honig-basis-voor-chili-con-carne), [broccoli/rundervink](https://www.hoogvliet.com/product/honig-bakplaat-mix-broccoli-rundervink), [courgette/kip](https://www.hoogvliet.com/product/honig-bakplaat-mix-courgette-kip), [taco's](https://www.hoogvliet.com/product/knorr-wereldgerechten-mexicaanse-taco-s), [kip madras](https://www.hoogvliet.com/product/knorr-maaltijdmix-kip-madras). Geen van deze exacte recepten geeft gram tomaat als alternatieve behoefte. De 42/36/36/136/80 gram op de mixpagina's is het *gewicht van de droge mix*, niet van de toe te voegen tomaten.

| Catalogus-SKU | Product | Koopverpakking | Laatst bekende positieve catalogusprijs bij controle | Exact stukaantal vermeld? |
|---|---|---|---:|---|
| 733141000 | [Mutti Gepelde tomaten](https://www.hoogvliet.com/product/mutti-gepelde-tomaten) | 400 gram blik | €1,99 | Nee, bovendien geen verse hele tomaat |
| 070476000 | [Cherry tomaten](https://www.hoogvliet.com/product/cherry-tomaten) | 250 gram | €0,98 | Nee |
| 060936000 | [Trostomaten](https://www.hoogvliet.com/product/trostomaten-verpakt) | 500 gram | €2,29 | Nee |
| 061918000 | [Bio+ Biologische trostomaten](https://www.hoogvliet.com/product/bio-biologische-trostomaten) | 500 gram | €2,49 | Nee |
| 723608000 | [Cocktail trostomaten](https://www.hoogvliet.com/product/cocktail-trostomaten) | 500 gram | €2,99 | Nee |
| 674644000 | [Snack tomaten](https://www.hoogvliet.com/product/snack-tomaten) | 250 gram | €1,79 | Nee |

De SKU's en laatst bekende prijzen zijn uit de bestaande producten- en product_prices-tabellen gelezen; de openbare productdetails bevestigen verpakking en waar zichtbaar een actuele positieve prijs. Catalogusprijzen zijn een momentopname, geen schrijf- of verversingsactie. De productdetails vermelden nettogewicht, maar geen vast aantal tomaten. Zelfs de [Hoogvliet-tomatensoepverspakketpagina](https://www.hoogvliet.com/product/verspakket-tomatensoep) vermeldt dat het aantal groenten per pakket afhankelijk van de grootte kan variëren. Het aantal per 250/500 gram is dus niet afleidbaar. De losse Madras-verspakketpagina heeft 180 g tomaten voor een *ander* recept en is geen bewijs voor de Knorr-mix.

De actuele cache koppelt alle vijf stuksbehoeften ten onrechte aan `733141000` als betrouwbare productmatch, maar markeert alle tien persoonsaantallen per recept terecht `package_unknown` / `NOT_READY`. De smalle codecorrectie verwerpt gepelde/blik/conserven tomaten voor een `mix-supplement-tomaten`-vraag in stuks, ook wanneer een blik zelf als `1 stuk` zou worden verkocht. Ook kleine cherry-/snackvarianten worden niet automatisch als de gevraagde hele (bij twee Honig-recepten expliciet middelgrote) tomaten gekozen. De alias `trostomaten` verwijst naar de verse 500 g-SKU `060936000`, waarvan Hoogvliet de productvorm expliciet als middelgroot beschrijft. Het bestaande verpakkingsmodel blijft het aantal eetbare tomaten vereisen: dit verse gewichtspak blijft zonder dat aantal onberekenbaar. De huidige persistente cache is bewust niet gemuteerd; na een reguliere gerichte herberekening moet de productreferentie opnieuw worden beoordeeld, maar readiness mag niet READY worden op grond van uitsluitend gram.

**Besluit:** Geen verdedigbare stuks- of massa-conversie voor de vijf exacte recepten. Nul recepten worden hierdoor READY. De oude 25/41 READY-inventaris is historisch en niet opnieuw als actuele totaaltelling geclaimd. Bij Madras meldde de audit van 21 september bovendien een lente-ui-probleem; de huidige cache meldt lente-ui als READY dankzij SKU 204803000 Bosuien. Het huidige enige gerapporteerde probleem voor deze vijf is de tomatenverpakking; een toekomstige cacheherberekening kan andere blokkades zichtbaar maken.

Voor een positieve conversie is per exacte koop-SKU een expliciet vast aantal eetbare tomaten per verpakking nodig, óf een massa-eis op de exacte mixbron. Een verpakking met alleen gewicht, een algemene gemiddelde tomaat of het gewicht van een ander recept voldoet niet. Verifieer bij nieuw bronbewijs eerst de productievariant en prijs, voeg de conversie in het bestaande verpakkings-/receptmodel toe, test personen 1–10, gehele verpakkingen, budget, lijstbijdragen en readiness, en ververs daarna pas gericht de cache.
