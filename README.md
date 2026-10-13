# Bluey voor Windows

Een Windows-versie van de computer-kant van [Bluey](https://github.com/rbrown101010/bluey-by-riley): de blauwe bes die op je iPhone woont, onder je scherm, en met zijn eigen grote cursor dingen aanwijst.

Bluey bestaat uit twee delen:

1. **De iPhone-app**: het gezicht. Die praat met OpenAI en blijft hetzelfde.
2. **De computer-app**: zijn cursor, zijn tekstballonnen en (later) zijn ogen en handen op je scherm. Die bestond alleen voor de Mac. Deze repo-branch is dezelfde app, maar dan voor Windows.

De iPhone ziet het verschil niet: de Windows-app spreekt hetzelfde protocol als de Mac-app (Bonjour `_googly._tcp` en regels JSON over TCP).

## Gemini (gratis) of OpenAI (betaald)

Bluey's "brein" kan **Google Gemini** zijn (standaard, gratis laag voor eigen gebruik) of **OpenAI** (betaald per gebruik). Kies het in het menu onder **AI**.

| | Gemini | OpenAI |
| --- | --- | --- |
| Kosten | gratis laag (met limieten) | tegoed op platform.openai.com |
| Sleutel | aistudio.google.com/apikey | platform.openai.com/api-keys |
| Praten | **push-to-talk**: hij hoort je alleen terwijl je het scherm vasthoudt | hij luistert de hele sessie mee en antwoordt als je het scherm vasthoudt |
| iPhone-app | de aangepaste app uit `ios-app/` (zie hieronder) | de originele app of die uit `ios-app/` |

Voor Gemini is de **aangepaste iPhone-app** nodig: de code staat in `ios-app/` (een kopie van de originele Bluey, met alleen een Gemini-modus erbij in `ios-app/iOS/Sources/LiveVoice.swift`). GitHub bouwt hem via **Actions → Build Bluey iPhone app** (artifact *Bluey-iPhone-unsigned-ipa*); onderteken hem daarna bijvoorbeeld met Sideloadly.

Privacy: in Nederland (EER) gelden volgens Google's voorwaarden de privacyregels van de betaalde versie, ook voor gratis gebruik. Gratis gebruik is alleen voor jezelf; wie Bluey aan anderen in de EER aanbiedt, moet de betaalde versie gebruiken.

## We bouwen het in stappen

| Stap | Wat | Status |
| --- | --- | --- |
| **1** | Verbinding met de iPhone, sleutel, vliegende cursor, tekstballon, sneltoetsen, tray-menu | ✅ klaar |
| **2** | Naar het scherm kijken (schermafbeelding + tekstherkenning van Windows), dingen aanwijzen, web-onderzoek met verslagkaartje | ✅ deze versie |
| 3 | Klikken, typen, toetsen, scrollen, slepen, apps/websites openen | in de wacht (zie *Koppelen*) |
| 4 | Vergadernotities | vervallen: de iPhone neemt niets meer op buiten het vasthouden om |

Vraag bijvoorbeeld (terwijl je het iPhone-scherm vasthoudt): *"wat is dit?"* terwijl je muis ergens op staat, *"waar moet ik klikken om op te slaan?"*, of *"zoek eens op wat dit kost"*. Hij kijkt dan naar je scherm, vliegt met zijn cursor naar het juiste woord en antwoordt in een tekstballon. Voor onderzoek verschijnt rechtsboven een kaartje met het verslag en de bronnen (sluiten met ×). Klikken en typen kan hij nog niet; dat is stap 3.

Tekstherkenning gebruikt de taal van je Windows (Nederlands op een Nederlandse Windows). Web-onderzoek met Gemini gebruikt Google Zoeken; daarvan zijn (volgens Google, oktober 2026) 5.000 zoekopdrachten per maand gratis.

## Installeren

1. Ga naar **Actions → Build Bluey for Windows**, open de laatste groene run en download onderaan het artifact **Bluey-Windows** (zip).
2. Pak de zip uit en start `Bluey.exe`. Er is geen installatie nodig.
   - Windows SmartScreen zegt misschien "Windows heeft uw pc beschermd", omdat de app niet ondertekend is. Klik op **Meer informatie → Toch uitvoeren**.
   - Windows Firewall vraagt of Bluey het netwerk mag gebruiken. Sta het toe voor **particuliere netwerken**, anders kan de iPhone de pc niet vinden.
3. Bluey vraagt de eerste keer om je **Gemini API-sleutel** (maak er gratis een op https://aistudio.google.com/apikey met je Google-account). Die wordt versleuteld met je Windows-account opgeslagen in `%APPDATA%\Bluey\keys.json`. De iPhone krijgt alleen kortlevende sleutels die één keer werken.
4. Controleer of het werkt: menu **AI → Test Gemini Connection**. Bluey maakt dan vanaf de pc zelf verbinding met Gemini en laat zijn antwoord zien.
5. Zet de aangepaste Bluey-app op je iPhone (zie *Gemini of OpenAI* hierboven; hij moet nog ondertekend worden, bijvoorbeeld met Sideloadly of AltStore).
6. Zorg dat de iPhone en de pc op **hetzelfde wifi-netwerk** zitten. De iPhone vindt de pc dan vanzelf. In de iPhone-app kies je de pc via het luidsprekerknopje rechtsboven.

Bluey zit in het systeemvak (rechtsonder, bij de klok). Klik op het blauwe besje voor het menu.

## Opnemen

Bluey hoort alleen wat je zegt **terwijl je het iPhone-scherm vasthoudt**. Er wordt niets op de achtergrond opgenomen en er worden geen gesprekken bewaard of uitgeschreven. In de iPhone-app zie je alleen je eigen vragen en zijn antwoorden terug.

## Koppelen (beveiliging)

De pc doet alleen iets voor telefoons die jij hebt **toegestaan**. Als een telefoon voor het eerst verbindt, vraagt Bluey op de pc: *"Een telefoon wil verbinden met Bluey… Is dit jouw iPhone?"* Klik alleen op **Ja** voor je eigen telefoon. Een telefoon die niet is toegestaan krijgt niets: geen sleutels, geen schermafbeeldingen, geen commando's.

Een toegestane telefoon krijgt een geheime sleutel (op de iPhone in de iOS-sleutelhanger, op de pc alleen een vingerafdruk ervan in `%APPDATA%\Bluey\phones.json`). Daarna hoeft het niet opnieuw. De oudere iPhone-app kent die sleutel niet; die vraagt dan bij elke verbinding opnieuw om toestemming. Via het menu **Forget Paired Phones** maak je alles ongedaan.

## Taal

Bluey praat standaard **Nederlands** en verstaat je ook in het Nederlands. Wissel via het menu **Language / Taal** naar Engels. De nieuwe taal geldt vanaf zijn volgende gesprek (als hij wakker is, start hij vanzelf opnieuw). Heb je zelf een persoonlijkheid ingesteld, dan blijft die staan, maar hij antwoordt wel in de gekozen taal.

## Sneltoetsen

Op de Mac zijn dit ⌃⌥-toetsen; op Windows **Ctrl+Alt**:

| Toetsen | Wat het doet |
| --- | --- |
| Ctrl+Alt+Space | Bluey wakker maken om te praten / terug naar volgmodus (op de Mac ⌥Space) |
| Ctrl+Alt+P | Vlieg naar de muis en wijs daar (blijft staan) |
| Ctrl+Alt+F | Ogen volgen de muis aan/uit |
| Ctrl+Alt+D | Stop met wijzen, terug naar huis boven de telefoon |
| Ctrl+Alt+T | Praattest (de telefoon stuitert 3 seconden) |
| Ctrl+Alt+H | Cursor verbergen / tonen |

Als een andere app een sneltoets al gebruikt, staat dat onderaan in het menu.

## Werkt het niet?

- **"Waiting for the phone app…" blijft staan**: controleer of iPhone en pc op hetzelfde wifi zitten (geen gastnetwerk) en of de firewall Bluey toestaat op particuliere netwerken. Op een netwerk dat Windows als "Openbaar" ziet, blokkeert de firewall dit standaard.
- **Bluey zegt dat hij geen sessie kan starten**: probeer **AI → Test Gemini Connection**; de melding zegt wat er misgaat. Bij OpenAI: kijk of je sleutel klopt en of je account tegoed heeft.
- **Gemini zegt dat het model niet bestaat**: Google hernoemt soms modellen. Zet in `%APPDATA%\Bluey\settings.json` een regel `"geminiModel": "<nieuwe naam>"` (huidige namen staan op ai.google.dev/gemini-api/docs/live-guide) en start Bluey opnieuw. De iPhone-app hoeft daarvoor niet opnieuw.
- Instellingen staan in `%APPDATA%\Bluey\settings.json`. Verwijder dat bestand om alles terug te zetten.

## Zelf bouwen

Met de .NET 8 SDK:

```
dotnet publish src/BlueyWindows/BlueyWindows.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
```

## Code

- `Link.cs`: het protocol met de iPhone (zelfde als `Shared/GooglyLink.swift`)
- `PhoneServer.cs`: Bonjour-advertentie en TCP-verbindingen (`PhoneServer.swift`)
- `RealtimeHost.cs`: kortlevende OpenAI-sleutels, tools, tekstballonnen (`RealtimeHost.swift`)
- `CursorEngine.cs`: hoe de cursor vliegt en waar zijn ogen kijken (`CursorEngine` in `CursorOverlay.swift`)
- `Overlay.cs`: de doorzichtige vensters voor cursor en tekstballon (`CursorView`/`CursorOverlay`)
- `TrayApp.cs`, `HotKeys.cs`, `Dialogs.cs`, `Storage.cs`: menu, sneltoetsen, vensters, opslag

Gebaseerd op Bluey door rbrown101010, public domain onder de Unlicense (`LICENSE-original-bluey`). Lettertype Fredoka onder de SIL Open Font License (`src/BlueyWindows/Fonts/OFL-Fredoka.txt`).
