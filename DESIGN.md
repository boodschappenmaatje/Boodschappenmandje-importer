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
| Primair helder iconenblauw | `#1D87F7` |
| Helder blauw voor verloop | `#278EF7` |
| Lichtblauwe gloed | `#62BFFC` |
| Diepblauw | `#034ECD` |
| Donkerblauwe tekst/accenten | `#0448B3` |
| Lichte achtergrond | `#EFF7FE` |
| Succesgroen | `#22C55E` |

Deze uit het officiële app-icoon afgeleide kleuren zijn fysiek goedgekeurd en gelden projectbreed. Gebruik de centrale `--brand-*` en semantische CSS-tokens; de actievariant `#116DE4` bewaakt contrast voor witte knoptekst. Groen voor succes en rood voor fout/verwijderen behouden hun betekenis. Introduceer niet willekeurig nieuwe merkkleuren als bestaande tokens voldoen.

## Definitieve Home-slogan

De blauwe Home-header toont exact twee grote witte regels naast de officiële mascotte:

> Slim kopen.  
> Lekker eten.

Er staat geen kleine ondertitel onder de slogan. Andere schermen nemen de huisstijl over zonder hun goedgekeurde indeling te veranderen.

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

- Compact receptdetail en uitgeklapte bewerkingslijst tonen dezelfde actuele hoeveelheid per gerecht. Een expliciete verpakking wordt met betrouwbare inhoud omgerekend naar gram/ml/stuks; onbekende inhoud blijft als verpakking aangeduid. Normale receptbehoefte en te kopen verpakkingen blijven herkenbaar afzonderlijke begrippen.

## Laatst bekende prijzen
- Oudere betrouwbare positieve catalogusprijzen blijven bruikbaar; toon compact “Laatste bekende prijs” bij de ingrediëntrij. Label ze niet als vers.
- Een automatische prijsupdate verandert bedragen, geen expliciet gekozen verpakkingen of gerechten. Bestaande budgetbevestiging blijft gelden bij overschrijding.

## Recept ⇄ lijst
- Geplande receptingrediënten en hun boodschappenlijstbijdragen zijn tweerichtings gekoppeld. Een expliciete verpakkingswijziging vanuit recept of lijst synchroniseert naar de andere kant, terwijl onafhankelijke handmatige bijdragen beschermd blijven.
- Bij precies één geplande ingrediëntbijdrage zonder los deel bedient lijst −/+ direct dat ingrediënt; toon het betreffende gerecht.
- Bij meerdere ingrediënten/recepten of een los deel opent de totale lijstbediening een herkomstkeuze. Geef per gerecht de dag en het ingrediënt aan; wijzig alleen de gekozen bijdrage.
- “Losse verpakking toevoegen” maakt expliciet een onafhankelijke lijstbijdrage. Toon deze als “Los van recepten”, met eigen bediening tot 0.
- Min houdt actieve receptbijdragen op minimaal 1 verpakking. De aparte prullenmand verwijdert een eenduidige bijdrage direct via een expliciete “door gebruiker verwijderd”-keuze voor dat geplande ingrediënt; geen kunstmatige hoeveelheid 0. Recept en lijst worden samen bijgewerkt. Afvinken verandert geen hoeveelheid.
- Waar recepten automatisch verpakkingen delen, leg dat bij de herkomstkeuze uit. Het lijsttotaal blijft gebaseerd op de gezamenlijk te kopen verpakkingen.
- Beide richtingen gebruiken dezelfde berekening, budgetbevestiging en laadstatus. Bij gewijzigde week/lijst tijdens validatie moet opnieuw worden gecontroleerd.

## Compacte boodschappenlijst — PR #28, fysiek geaccepteerd
- De boodschappenlijst toont standaard compacte productregels binnen categorieblokken. Richtdoel: 4–5 normale producten in een telefoonscherm waar namen en schermhoogte dit toelaten; geen kleinere touch targets of onleesbare tekst om dit af te dwingen.
- Primair: checkbox, kleine productfoto, naam, verpakking/inhoud, gebruikte prijs, compact − aantal + en subtiele herkomst. Checkbox en −/+ behouden minimaal 44px raakvlak.
- Tik op product/chevron opent een mobiel detailpaneel. Volledige naam, prijsdatum, totaal, herkomstverdeling, losse verpakking en verwijderen staan daar. Sluiten/Escape keert terug naar dezelfde lijstpositie en bediening; achtergrond scrollt niet mee.
- Herkomst gebruikt bestaande lijniconen: maaltijdkom voor menu, koksmuts voor aantoonbaar eigen recept, plus met zacht groen voor los. Bij meerdere maaltijden een korte samenvatting; de details tonen de afzonderlijke gerechten/dagen/ingrediënten. Geen herkomst gokken uit naam/SKU.
- Bij gemengde herkomst opent algemene −/+ het detailpaneel met de bestaande veilige bijdragekeuze. Eén eenduidige receptbijdrage blijft direct bedienbaar. Recept ⇄ lijst-sync en handmatige bescherming blijven leidend.
- Alles/Maaltijden/Overig is een presentatiefilter. Een product met maaltijd én losse bijdrage hoort bij beide filters; het getoonde aantal blijft het volledige te kopen totaal. Nog te halen/Afgevinkt blijft beschikbaar.
- Behoud categoriegroepering, metallic-blauwe tokens en bottom navigation. Maak geen permanente grote actieknoppen of geneste kaarten per product.

## iPhone-feedback PR #28 — 25 september 2026
- “Meer alternatieven” en “Zelf zoeken” zijn compacte metallic-blauwe knoppen met minimaal 44px raakvlak, zichtbare focus, pressed- en disabled-state.
- Een expliciete productvervanging gebruikt de actuele consumentennaam van het gekozen catalogusproduct als ingrediëntkop. Alleen een expliciet bekende merkprefix mag worden weggelaten. De oorspronkelijke receptdefinitie en het exacte ingrediëntadres blijven intact.
- Iedere lijstcategorie is onafhankelijk inklapbaar met teller en chevron. Bewaar de presentatiekeuze lokaal; inklappen en filteren wijzigen geen product-, bijdrage-, afvink- of budgetgegevens.
- Het ingestelde maaltijdbudget is een harde grens voor automatische weekplanning. De planner zoekt actief naar een volledige geldige combinatie binnen deze grens. Alleen een expliciete handmatige gebruikerskeuze mag via de bestaande bevestigde override boven budget gaan.
- Neem behouden gerechten en expliciete verpakkingen mee tijdens het zoeken. Bij een onhaalbare poging blijven de bestaande week en lijst staan. Toon bruikbare instellingen-/handmatige-keuzeacties; onderscheid een bewezen minimum van de goedkoopste gevonden combinatie.
- Alleen na een bewuste actie om lege dagen zelf in te vullen worden die lege plaatsen vrije keuzes. Bestaande gerechten en lijstbijdragen blijven behouden.

- Budgetbevestigingen gebruiken dezelfde bijdrageverdeling als de uiteindelijke boodschappenlijst. Een losse extra van dezelfde SKU is een afzonderlijke aankoop, geen impliciete voorraad voor het recept.

## Directe prullenmand — PR #28, fysiek geaccepteerd
- Quantity >1 toont min; bij 1 toont alleen een veilig direct verwijderbare bijdrage de prullenmand, op dezelfde 44px-positie. Trash opent nooit Productdetails.
- Productnaam/chevron blijven de afzonderlijke detailactie. Quantity-knoppen handelen hun eigen click af zonder doorbubbelen.
- Bij meerdere/ongeldige koppelingen geen totale trash: eerst de bestaande herkomstkeuze. De prullenmand bij een specifieke bijdrage bedient alleen die bijdrage.
- Verwijderde geplande ingrediënten blijven zichtbaar als expliciete gebruikerskeuze in het recept, maar tellen niet meer mee als aankoop. De originele receptdefinitie blijft behouden. Een volledig leeggekocht gerecht wordt niet door de automatische planner als geldige gratis maaltijd gebruikt.
- Kostenverlagende handmatige mutaties worden nooit door een overschreden budget geblokkeerd. Kostenverhoging boven budget vereist expliciete bevestiging; automatische planning krijgt nooit een budgetoverride.
