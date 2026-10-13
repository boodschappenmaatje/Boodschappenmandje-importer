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
| **1** | Verbinding met de iPhone, OpenAI-sleutel, vliegende cursor, tekstballon, sneltoetsen, tray-menu | ✅ deze versie |
| 2 | Naar het scherm kijken (schermafbeelding + tekstherkenning) en dingen aanwijzen, web-onderzoek | volgende |
| 3 | Klikken, typen, toetsen, scrollen, slepen, apps/websites openen (met dezelfde veiligheidsregels) | later |
| 4 | Vergadernotities (transcriptie met sprekers) | later |

In stap 1 kun je dus al met Bluey praten. Zijn antwoorden verschijnen als tekstballon boven de plek waar je telefoon staat, en zijn ogen op de iPhone volgen je muis. Vraag je hem iets over je scherm, dan zegt hij nog dat hij dat (nog) niet kan.

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
