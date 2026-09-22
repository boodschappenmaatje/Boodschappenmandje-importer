// Rebuild reviewed evidence bindings from the retained retailer snapshots.
// Facts below were checked against the linked exact product pages (2026-09-21).
import { readFileSync, writeFileSync } from 'node:fs';
import { mealMixPreparationFingerprint } from '../apps/web/src/server/meal-mix-source.ts';
const facts = [
  ['733174000',3,'https://www.ah.nl/producten/product/wi615444/0800%20-%20022%2030%2055','70 g; Aantal porties: 3. Fabrikant bevestigt 400 g kipfilet en 3 el olie.',[], '400 g kipfilet\n45 ml olie'],
  ['703080000',2,'https://www.ah.nl/producten/product/wi232612/knorr-spaghetteria-carbonara','154 g; Aantal porties: 2. Alleen 500 ml water toevoegen.',[], '500 ml water',true],
  ['703081000',2,'https://www.ah.nl/producten/product/wi232605/spaghetteria-al-pesto','155 g; Aantal porties: 2. Standaardbereiding met alleen 500 ml water; serveertips zijn optioneel.',[], '500 ml water',true],
  ['729332000',2,'https://www.ah.nl/producten/product/wi594806/knorr-risotteria-bospaddenstoelen','175 g; Aantal porties: 2. Standaardbereiding met alleen 500 ml water.',[], '500 ml water',true],
  ['729333000',2,'https://www.ah.nl/producten/product/wi594780/knorr-risotteria-truffel','175 g; Aantal porties: 2. Standaardbereiding met alleen 500 ml water.',[], '500 ml water',true],
  ['732786000',2,'https://www.knorr.com/nl/p/spaghetteria-pomodoro.html/08720182422248','Exacte Pomodoro mozzarella-variant (163 g op BE pagina met dezelfde GTIN). Maaltijd voor 1-2 personen, alleen 500 ml water.',[], '500 ml water',true],
  ['731727000',4,'https://www.ah.nl/producten/product/wi605440/honig-mix-aardappel-boontjes-gehaktballetjes','36 g; Voor 4 personen. Olie in de lijst is olijfolie.',[['olfolie','olijfolie']]],
  ['731728000',4,'https://www.ah.nl/producten/product/wi605445/honig-mix-aardappel-broccoli-en-rundervink','36 g; Voor 4 personen.'],
  ['731729000',4,'https://www.ah.nl/producten/product/wi605446/honig-mix-aardappel-courgette-en-kip','36 g; Voor 4 personen.'],
  ['718160000',4,'https://www.ah.nl/producten/product/wi3495/honig-basis-voor-bami-speciaal','37 g; Aantal porties: 4.'],
  ['718350000',4,'https://www.ah.nl/producten/product/wi123658/honig-basis-voor-chili-con-carne','42 g; Aantal porties: 4.'],
  ['718363000',4,'https://www.ah.nl/producten/product/wi37912/honig-mix-voor-italiaanse-kruidensaus','68 g; Aantal porties: 4. Basilicum blijft in eetlepels; geen verzonnen gewicht.'],
  ['181722000',4,'https://www.ah.nl/producten/product/wi37921/honig-basis-voor-spaghettisaus-bolognese','41 g; Aantal porties: 4.'],
  ['714983000',4,'https://www.ah.nl/producten/product/wi199022/honig-mix-voor-kapucijners','45 g; Aantal porties: 4.'],
  ['083039000',4,'https://www.ah.nl/producten/product/wi215238/honig-maaltijdsoep-erwten','137 g; Aantal porties: 4. Halve rookworst zonder gewicht; niet invullen.'],
  ['730051000',4,'https://www.plus.nl/product/knorr-maaltijdmix-kebab-stazak-30-g-417907','30 g; gerecht voor 3 tot 4 personen.'],
  ['730049000',4,'https://www.ah.nl/producten/product/wi594774/0800-022%2030%2055','64 g; Aantal porties: 4.'],
  ['709741000',4,'https://www.ah.nl/producten/product/wi173552/maaltijdmix-tagliatelle','62 g; Aantal porties: 4.'],
  ['709603000',null,'https://www.knorr.com/nl/p/mix-voor-nasi.html/08710522979549','Fabrikant specificeert 125 g taugé, Hoogvliet mist de unit.',[['Nasi groentepakket (450 g) 125 taugé','450 g Nasi groentepakket\n125 g taugé']]],
  ['709641000',4,'https://www.ah.nl/producten/product/wi164103/maaltijdmix-macaroni-carbonara','64 g; Aantal porties: 4. Toevoegingen uit productetiket, olie 2 el in bereiding.',[], '250 g champignons\n1 ui\n125 g hamblokjes\n500 ml magere melk\n300 g macaroni\n30 ml olie'],
  ['704882000',3,'https://www.jumbo.com/producten/knorr-wereldgerecht-mexicaanse-taco-s-136g-390317DS','136 g; verpakking bevat 3 porties.'],
];
const records={};
for(const [sku,servings,sourceUrl,evidence,replacements,supplementList,waterOnly] of facts){
  const source=JSON.parse(readFileSync(`apps/web/test-results/pwa13/mix-sources/${sku}.json`));
  records[sku]={preparationFingerprint:mealMixPreparationFingerprint(source),sourceUrl,evidence,...(servings?{servings}:{}),...(replacements?.length?{replacements}:{}),...(supplementList?{supplementList}:{}),...(waterOnly?{waterOnly:true}:{})};
}
writeFileSync('src/meal-mix-corroboration.json',JSON.stringify(records,null,2)+'\n');
