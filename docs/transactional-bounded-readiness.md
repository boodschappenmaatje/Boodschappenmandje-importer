# Checkpoint 6 — transactionele bounded readiness

Deze wijziging hoort bij Draft PR #39, branch `feature/meal-mix-supplement-matches`.
Technische basis: remote `e1a68def66f580e9fdf2a4b1326e1545ff172066`, main
`0c57d03ecd0428f293b91bef067a3e7baa176764`; eerdere functionele candidate
`cce023e68797689d84abe2c95933d7db5a5134a6` blijft in de geschiedenis.
Bij de eindfetch was main doorgeschoven naar
`7446d411e9d9cdf48b52df2a6edb2cc4eff34723`; uitsluitend ROADMAP-documentatie
veranderde ten opzichte van de technische basis. De PR-branch is niet gereset.
Geen live migratie, databasewrite, replay, merge of Production-deployment in dit checkpoint.

## Werkelijk schema en probleem

- `20260919154657_persistent_planner_readiness_cache.sql`: `ingredient_product_matches`
  heeft PK `match_key`, product-/ingredient-FK's, match-/refreshstatus, versies en
  tijdstempels. `recipe_readiness_cache` heeft PK `(recipe_id, people_count)`,
  `readiness_payload`, `dependency_match_keys text[]`, evaluatorversie en status.
  Subscribers zijn de cachevarianten waarvan de array een matchkey bevat; er is
  geen aparte subscribertabel. De oude `updated_at = now()`-trigger is geen CAS:
  meerdere veranderingen binnen één transactie kunnen hetzelfde tijdstip hebben.
- `20260920213421_meal_mix_profiles_and_candidate_cache.sql` voegt
  `candidate_product_ids`, profielen en kandidaat-/prijsinvalidatie toe.
  `20260920220220_invalidate_readiness_on_candidate_change.sql` is de actuele
  matchtriggerfunctie, inclusief kandidaatwijzigingen. De water-only-constraint
  uit `20260921104333_meal_mix_verified_water_only.sql` blijft intact.
- `ingredient_product_matches_invalidate_readiness` blijft actief en markeert
  **alle** bestaande subscribers van de gewijzigde matchkey als pending.
  Recepten, relaties, ingrediënten, aliassen, producten, prijzen en profielen
  hebben daarnaast hun bestaande invalidatietriggers.
- Cachetabellen: RLS, publiek alleen SELECT, server `service_role` DML.
  Bestaande RPC's en importerclaim-/discoveryflows worden niet vervangen.

De oude finale match-upsert en readiness-upsert waren twee PostgREST-transacties.
Een fout in de tweede liet de eerste staan. Nieuwe subscribers konden na de
app-controle ontstaan; parallelle writers konden de evaluatie verouderen of een
READY-payload over een nieuwe invalidatie schrijven.

## Additive migratie en RPC-contract

Bestand: `supabase/migrations/20261002220202_transactional_bounded_readiness.sql`.
Het voegt één private revisietabel, functies en guards toe. Het reset geen tabel,
herschrijft geen bestaande cachedata en verwijdert geen bestaande trigger.

```sql
bounded_readiness_source_revision() returns text

bounded_readiness_plan(
  p_recipe_ids uuid[], p_match_keys text[], p_dependency_keys text[]
) returns jsonb

commit_bounded_readiness(
  p_recipe_ids uuid[],
  p_match_keys text[],
  p_dependency_keys text[],
  p_expected_plan_token text,
  p_match_rows jsonb,
  p_readiness_rows jsonb
) returns jsonb
```

De eerste twee RPC's lezen uitsluitend. De plan-RPC levert `planToken`,
`sourceRevision`, `validatedScope` en de onderliggende revisiestaat. De laatste
RPC is **de enige finale write-call**. PostgREST commit de functieaanroep als één
transactie. Een uitzondering wordt niet ingeslikt: alle matchwrites,
invalidaties, readinesswrites, revisies en beschermingsvlaggen rollen terug.

Grenzen: 1–10 unieke recepten, 1–10 unieke te schrijven matchkeys, personen 1–10,
maximaal 1000 gelezen dependencykeys. Er moeten exact één matchrij per toegestane
key en tien unieke readinessvarianten per recept zijn. Iedere variant bevat een
toegestane matchkey; overige dependencykeys mogen alleen gelezen worden. De
evaluator bepaalt de inhoud; de database controleert scope, CAS en integriteit.

Succesresultaat: `blocked=false`, `matchWrites`, `readinessWrites`,
`validatedScope`, `finalPlanToken`, `outsideScopeEffects=0`. De server valideert
die bevestiging. Conflicten (`bounded_*`, SQLSTATE 40001/40P01/55P03) worden HTTP
409. Database-/schema-/infrastructuurfouten worden 503, zonder oude twee-request
fallback. Een verloren netwerkantwoord kan een volledig gecommitteerde transactie
verbergen; 503 bewijst dan niet dat nul is gecommit. Lees opnieuw en herstel met
een nieuw plan. Er kan geen half gecommitteerde cache ontstaan door deze RPC.

## Locks, CAS en triggergrens

1. De server leest de bronrevisie vóór catalogusladen. Na het laden vergelijkt
   hij die met de plan-RPC. Recept-/profielwijzigingen tijdens het laden leveren
   een conflict, zodat oude dependencies geen nieuw geldig token krijgen.
2. De planhash is SHA-256 van canonieke PostgreSQL-JSONB: recipe-ID's, writekeys,
   readdependencies, subscriberidentiteiten, bronrevisie en monotone revisies
   van keys/recepten. Ook ontbrekende matchrijen hebben via hun key een identiteit.
   Een insert/delete, subscriberwijziging, no-op cachewrite of cataloguswijziging
   maakt een oud plan ongeldig. Tijdstempels zijn niet de concurrencygarantie.
3. De commit neemt een gedeelde transactionele advisory lock op de catalogus.
   Productmatching zoekt in de hele catalogus en kan een nieuw, eerder onbekend
   product kiezen. Alleen locks op bekende product-ID's sluiten die phantom niet.
   Daarom nemen bronwriters vóór hun statement een exclusieve cataloguslock en
   verhogen ze de bronrevisie. Zij wachten zo nodig op de korte commitfase.
   **Onafhankelijke bounded requests delen de cataloguslock en kunnen parallel**;
   de app-evaluator houdt geen database-/cataloguslock vast. Dit serialiseert
   bronmutaties; de operationele wachttijd moet bij release gemonitord worden.
4. Vervolgens worden alle betrokken `k:<matchkey>` en `r:<recipe-id>`-resources
   gesorteerd gelockt, inclusief bestaande én geplande readdependencies van de
   doelrecepten. `pg_try_advisory_xact_lock` voorkomt wachten met omgekeerde
   tuple-/advisory-lockvolgorde in legacy row-triggers. Een botsing is een
   fail-closed conflict; hashcollisies kunnen hoogstens extra conflicten geven.
5. BEFORE-row guards op **alle** match-/readiness-DML nemen dezelfde locks en
   verhogen de revisies, ook bij oudere writers. Een nieuwe subscriber voor
   een gelockte key wordt geweigerd; een reeds lopende cachewriter houdt de key
   vast en laat de RPC conflicteren. Er is geen stil parallel commit op overlap.
6. Na locking leest de RPC scope en token opnieuw onder READ COMMITTED. Andere
   isolatieniveaus worden geweigerd om een oude transactiesnapshot te voorkomen.
7. Een transactionele scopecontext begrenst iedere match-/readinesswijziging,
   inclusief bestaande AFTER-triggers. Die triggers blijven normaal lopen.
   Iedere buiten-scope readinessrij of matchkey veroorzaakt een uitzondering en
   volledige rollback. Scope wordt na matchfase én na readinessfase opnieuw
   gecontroleerd. Context wordt bij succes gewist en bij fouten teruggerold.

De bestaande `updated_at`-/invalidatielogica blijft bruikbaar. De guards voegen
de ontbrekende synchronisatie voor legacy DML toe. Een tijdelijke concurrentiefout
bij een oude cachewriter kan via diens bestaande foutpad zichtbaar worden; herstel
vereist herlezen/herproberen, nooit een onbeveiligde writefallback.

## Legacy READY en backward compatibility

Alleen schema-installatie verandert geen bestaande cachestatus; legacy writes op
nog niet bounded behandelde keys blijven werken. Een **geslaagde bounded commit**
markeert zijn writekeys én recipe-ID's als `bounded_only` in de private metadata.
Daarna kan uitsluitend de RPC die varianten als current publiceren. Een oude
writer zonder CAS mag zijn payload opslaan, maar een aangeboden `current` wordt
`pending / transactional_refresh_required`. Bestaande pending-/failed-status en
normale invalidatieredenen worden niet overschreven door die bescherming.

Dit sluit ook de late writer die vóór onze transactie evalueerde maar erna schrijft,
en delete/reinsert met een oudere dependencylijst. Voor behandelde recepten blijft
de gewone schrijfvrije evaluatorfallback beschikbaar; legacy lazy maintenance kan
hun persistent cache niet zelfstandig weer current maken. Gebruik de bounded
route voor verdere verversing tot andere writers eveneens CAS ondersteunen.
Die bewuste beperking hoort bij operationele acceptatie in Work checkpoint 7.

## Autorisatie

De nieuwe functies hebben `SECURITY DEFINER`, vaste `search_path=pg_catalog` en
volledig gekwalificeerde applicatietabellen/functies. Alleen de drie publieke
RPC-signatures krijgen EXECUTE voor `service_role`. PUBLIC, anon en authenticated
krijgen geen EXECUTE; de revisietabel en interne helpers krijgen ook voor
service_role geen directe mutatierechten. Bestaande RLS en admin-tokencontrole
blijven intact. Er is geen nieuwe browserwrite.

Preview-GET blijft alleen een publieke, schrijfvrije scope-inspectie. Het geeft
`transactional=false`, `planToken=null`; een uitvoerbaar token komt uitsluitend
uit de server/admin-dry-run. Preview-write wordt vóór databasegebruik geweigerd.
De grenzen gelden voor applicatie-DML met actieve triggers; een databasebeheerder
die triggers uitschakelt of eigenaarrechten gebruikt valt buiten dit protocol.

## Echte PostgreSQL-bewijzen

`npm run test:postgres` maakt altijd een eigen tijdelijke `postgres:17`-container,
zonder hostpoort, Production-URL of secret. De cache-, recipe-, ingredient-,
profile-, permission- en triggerdefinities worden uit de **echte migrations**
geladen. De oorspronkelijke products/product_prices-DDL staat niet in de repo;
`test/postgres/catalog-bootstrap.sql` maakt alleen daarvoor een lokale fixture
volgens `src/supabase.mjs` en de beschreven unieke sleutels in README. Dit is geen
claim dat niet-opgeslagen Production-DDL is geïnspecteerd.

De suite controleert steeds de daadwerkelijke eindstaat; foutproeven vergelijken
ook invalidaties, revisies en beschermingsvlaggen vóór/na. Geen mock-DB.

| Bewijs | Verwacht en getest |
|---|---|
| Matchconstraint faalt | volledige rollback, nul blijvende cachewrites |
| Laatste readinessvariant faalt | eerdere matchfase en alle invalidaties teruggerold |
| Trigger probeert outside-scope effect | volledige rollback |
| Subscriber-update of echte INSERT tussen plan/RPC | scopeconflict, nul writes |
| Match verandert vóór RPC | stale CAS, nul writes |
| Twee gelijktijdige requests voor dezelfde key | één commit; tweede lockconflict, daarna stale |
| Gedeeltelijke overlap | conflict, overige recepten byte-identiek |
| Disjuncte scopes | B commit terwijl A nog open en onzichtbaar is |
| Injectiefout na matchfase | volledige rollback |
| Exact plan opnieuw | expliciet stale; verse recovery behoudt unieke rijen |
| Legacy subscriber INSERT tijdens RPC | keyguard weigert phantom |
| Legacy matchwriter tijdens locking | fail-closed conflict |
| Ontbrekende matchrij | veilige insert met dezelfde keyguard |
| Late legacy READY / delete-reinsert | pending, nooit stale current |
| Nieuw catalogusproduct na plan | bronrevisie maakt plan stale |
| Cataloguswriter tijdens RPC | bewezen advisory wait in `pg_locks`, daarna juiste invalidatie |
| Bronwriter al actief | RPC conflicteert; rollback maakt oud plan weer bruikbaar |
| Read-only matchdependency verandert | stale CAS |
| Dubbele varianten / payload buiten scope | weigering zonder writes |
| Browserrollen / private revisies | privileges geweigerd |
| Additive installatie / legacy vóór activatie | bestaande data identiek; gewone current-write werkt |

De concurrencybarrière is een echte `BEGIN`-sessie die na de RPC nog niet commit:
een tweede PostgreSQL-sessie probeert gelijktijdig te schrijven. Een aparte
connectie controleert onzichtbaarheid van A, de werkelijke advisory wait en de
uiteindelijke commit-/rollbackstaat. Er wordt niet met alleen `sleep` geredeneerd.
De GitHub-workflow `core-flows.yml` voert deze suite verplicht uit naast de
bestaande volledige importer-/webgate.

Lokale eindgate: **25/25 PostgreSQL-tests**, **855/855 webtests** (69 bestanden),
**313/313 root/importertests**, syntax- en alle drie seedchecks, ESLint,
TypeScript en Next.js Production-build geslaagd. Dit omvat bounded maintenance,
planner-cache-service, persistent cache en readiness. In Codex Cloud blokkeerde
de sandbox aanvankelijk Node-subprocessen met EPERM; de definitieve volledige
gate is buiten die sandbox uitgevoerd. De eerste sandboxuitvoering met alleen
testbestandsnamen geldt niet als bewijs van de individuele roottests. CI-run en
de exacte functionele SHA staan in PROJECT_STATE.md na de remote verificatie.

## Deployvolgorde — uitsluitend later, afzonderlijk geautoriseerd

1. **Schema/RPC deploy**: additive migratie toepassen. Geen apprelease tegelijk,
   geen backfill of automatische cache-refresh. Bestaande data blijft staan.
2. **Verificatie**: functies, vaste search_path, EXECUTE-rechten, RLS, guards en
   bron-/cacherevisies controleren; PostgreSQL-gate en stagingproeven groen.
   Bevestig geen conflicterende niet-gemigreerde schemawijzigingen op Production.
3. **Appcode deploy**: reguliere goedgekeurde PR-release naar de exacte geteste
   functionele head. Ontbrekende RPC is fail-closed 503, nooit losse upserts.
4. **Live acceptance**: expliciete recepten/keys, BEFORE-audit, admin-dry-run met
   vers token, toegestane bounded write, AFTER-audit van dezelfde varianten én
   buiten-scope invarianten. Controleer legacy-fallback en cataloguswachttijd.
   Eerst alle overige Work-/Preview-/fysieke iPhone-releasegates afhandelen.
5. **Rollback**: stop bounded writes (endpoint beperken of EXECUTE op commit-RPC
   intrekken), rol app terug naar bekende gezonde deployment, **behoud guards,
   revisies en bounded_only**. Dat voorkomt stale READY door de oude app.
   Afgeleide pending-data wordt later via de gecorrigeerde RPC hersteld. Een
   approllback alleen is geen datarollback. Verwijder dit schema pas in een apart
   getoetste migratie nadat geen enkele caller het nodig heeft en alle behandelde
   cache expliciet veilig is afgehandeld; geen tabeldrop/reset in deze PR.

## Bounded recovery voor historische pending/partiële staat

Gebruik hetzelfde admin-POST `/api/internal/planner-readiness/bounded-refresh`.
Leg recipe-ID's en matchkeys vooraf expliciet vast (maximaal 10/10); geen cursor,
wildcard of full backfill. `mode: "dry-run"` geeft scope, aantallen en token.
Controleer `blocked=false`, geen onverwachte subscribers en exact verwachte
aantallen. `mode: "write"` met dezelfde IDs/keys en `expectedPlanToken` gebruikt
dezelfde evaluator en transactionele RPC. Een herhaling van hetzelfde token
conflicteert; een nieuw dry-run-plan kan dezelfde logische rijen opnieuw veilig
opbouwen zonder duplicaten. Bij 409 volledig opnieuw lezen/evalueren. Bij 503
eerst toestand inspecteren wegens mogelijke verloren commitbevestiging.

Historische partial/pending cache wordt lokaal in de herstelproef gesimuleerd;
geen recovery is live uitgevoerd. ROADMAP-fase blijft Productdata & receptkwaliteit.
