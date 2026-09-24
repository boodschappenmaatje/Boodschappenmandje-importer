# BoodschappenMaatje — Design System & UX Rules

Dit document bewaakt de visuele en UX-consistentie van de PWA. Bestaande goedgekeurde schermen en actuele code zijn leidend wanneer dit document nog niet ieder detail beschrijft.

## Merkgevoel
BoodschappenMaatje moet:
- modern;
- vriendelijk;
- rustig;
- toegankelijk;
- herkenbaar;
- niet te zakelijk;
- praktisch en eenvoudig aanvoelen.

De app moet eruitzien als een behulpzame consumentenapp, niet als een technisch dashboard.

## Kernpalet

| Rol | Kleur |
|---|---|
| Primary metallic blue | `#4A7399` |
| Dark metallic blue | `#385D7C` |
| Steel blue | `#AFC3D4` |
| Light background | `#F2F6F9` |
| Accent / success green | `#36B37E` |

Gebruik semantische statuskleuren zorgvuldig. Introduceer niet willekeurig nieuwe merkkleuren als bestaande tokens voldoen.

## Logo en app-icoon
Het officiële concept blijft:
- blauw afgerond vierkant;
- vriendelijk wit bonnetje;
- gezicht;
- twee duimpjes omhoog.

Gebruik het bestaande officiële projectasset. Maak geen nieuw logo of vervangend app-icoon tenzij expliciet gevraagd.

## Mobile-first
De primaire UX wordt ontworpen en getest voor telefoonformaat, met fysieke iPhone-test als belangrijke acceptatiestap.

Regels:
- geen horizontale overflow;
- voldoende grote touch targets;
- primaire acties duidelijk en makkelijk bereikbaar;
- compacte kaarten en informatiehiërarchie;
- geen desktopachtige tabellen als een mobiele kaart/list beter werkt;
- belangrijke informatie zichtbaar zonder onnodig diep navigeren.

## UX-principes
1. **Eén duidelijke hoofdactie.** Een scherm mag secundaire acties hebben, maar de volgende logische stap moet direct herkenbaar zijn.
2. **Rust boven volledigheid.** Toon eerst wat de gebruiker nodig heeft; details mogen uitklappen.
3. **Mensentaal.** Vermijd technische database-, cache- of matchingtaal in de consumenten-UI.
4. **Behoud context.** Menu blijft Menu; openen van een gerecht mag de gebruiker niet onnodig uit de flow trekken.
5. **Kijken en bewerken zijn verschillend.** Receptdetail is compact; structureel bewerken gebeurt via een expliciete editoractie. Het verpakkingsaantal mag direct bij het ingrediënt met −/+ worden aangepast.
6. **Bescherm gebruikerskeuzes.** Handmatige lijstwijzigingen, gekozen gerechten en expliciete overrides mogen niet stilzwijgend verdwijnen.
7. **Geen fictieve zekerheid.** Geen €0-prijzen of geforceerde productmatches als betrouwbare data ontbreekt.
8. **Budget moet begrijpelijk zijn.** Maaltijdbudget en totaal weekbudget zijn afzonderlijke concepten en moeten zo worden gepresenteerd.
9. **Altijd een bruikbare route vooruit.** Lege staten en ontbrekende matches bieden een duidelijke vervolgstap.

## Vrije keuze / recepten
- Vrije keuze gebruikt een duidelijke voortgang voor beschikbare maaltijdplekken.
- Acties mogen als compacte 2×2-kaarten worden gepresenteerd wanneer dit op mobiel goed past.
- Een volle week maakt duidelijk dat een bestaande plek vervangen moet worden; creëer niet stil extra capaciteit.
- Eigen recepten mogen los van de weekcapaciteit opgeslagen blijven.
- Compact receptdetail toont kerninformatie eerst.
- Lange ingrediënten/productlijsten worden compact gehouden en inline uitklapbaar gemaakt.
- Personen wijzigen herberekent hoeveelheden, verpakkingen en prijs via de bestaande betrouwbare logica. Expliciet gekozen verpakkingsaantallen blijven vast.

## Navigatie
- Bottom navigation behoudt de actieve context.
- Vermijd dubbele navigatiepaden voor dezelfde hoofdtaak.
- “Verder met mijn lijst” en “Maak mijn lijst compleet” zijn verschillende acties en mogen niet semantisch samenvallen.
- Een nieuwe week starten is een aparte, expliciete lifecycle-actie.

## Afbeeldingen
- Afbeelding moet bij het gerecht/product passen.
- Gebruik geen misleidende afbeelding alleen om een lege plek op te vullen.
- Een consistente fallback is beter dan een inhoudelijk verkeerde foto.
- Toekomstige AI/rechtenvrije beelden moeten visueel aansluiten bij de daadwerkelijke ingrediënten.

## Toegankelijkheid
- Tekstcontrast moet leesbaar blijven op de metallic blauwe stijl.
- Status mag niet uitsluitend via kleur worden gecommuniceerd.
- Interactieve elementen moeten herkenbaar en voldoende groot zijn.
- Focus-, disabled- en foutstatussen moeten duidelijk zijn.

## Ontwerpwijzigingen
Bij nieuwe UI:
1. controleer bestaande componenten en patronen;
2. hergebruik die waar mogelijk;
3. volg dit document;
4. behoud bestaande functionaliteit;
5. valideer mobiel;
6. pas dit document alleen aan wanneer een nieuwe ontwerpbeslissing echt een vaste projectregel wordt.


## Verpakkingen per ingrediënt
- Ingrediënt −/+ bedient het verpakkingsaantal; recepthoeveelheid volgt automatisch uit de betrouwbare verpakkingsinhoud.
- Toon − [1 verpakking / 2 verpakkingen] +. Iedere stap verandert precies één verpakking, minimum 1; de minknop verwijdert geen ingrediënt.
- Toon bij dezelfde rij de productinhoud, actuele totale recepthoeveelheid en volledige aankoopprijs. Zonder betrouwbare inhoud geen misleidende bediening of fictieve hoeveelheid.
- Plaats de bediening binnen dezelfde ingrediëntenrij; bij beperkte breedte direct onder de productinformatie, rechts uitgelijnd. Behoud de compacte kaart en voorkom horizontale overflow.
- − en + hebben elk minimaal 44 × 44 px raakvlak en een toegankelijke naam met het ingrediënt. Gebruik bestaande metallic-blauwe tokens, zichtbare focus en disabled-status.
- Blokkeer dubbele acties tijdens herberekening. Vraag expliciete bevestiging bij budgetoverschrijding en behoud bij fouten de vorige keuze.
- Expliciet gekozen verpakkingen blijven vast bij personen wijzigen, heropenen en normale synchronisatie. Andere ingrediënten blijven volgens de bestaande personenlogica schalen.

## Laatst bekende prijzen
- Oudere betrouwbare positieve catalogusprijzen blijven bruikbaar; toon compact “Laatste bekende prijs” bij de ingrediëntrij. Label ze niet als vers.
- Een automatische prijsupdate verandert bedragen, geen expliciet gekozen verpakkingen of gerechten. Bestaande budgetbevestiging blijft gelden bij overschrijding.
