# Remediation-Plan — @spearwolf/signalize

Quelle: `./audit.html` vom 2026-08-08 (Folgeaudit zum 2026-08-07) · Branch: `main` · erstellt: 2026-08-09
Baseline: `pnpm world` vollständig grün — check ✓ · compile ✓ · bundle ✓ · test:smoke ✓ · checkPkgTypes ✓ · test ✓ (44 Dateien, 478 Tests, Branch 93,73 %) · test:gc ✓ (478)
Scope: **71 von 125 Findings** — 2 critical, 17 high, 52 medium
Ausgenommen: 43 `low` und 11 `info` — vom Nutzer nicht beauftragt. `acknowledged` im Audit: leer.

Vorgabe des Nutzers: die drei Gates aus dem Optimierungsteil werden zuerst geschlossen — **BUILD-003** (kein Typecheck über Specs), **BUILD-002** (kein CI auf `main`, kein PR-Trigger), **BUILD-015** (Coverage-Schwelle mit leerem Glob). Solange die offen sind, ist jeder spätere Verify-Lauf eine Behauptung.

## Vorbestehende Fehler

Keine. Die Baseline ist auf ganzer Linie grün; jeder rote Lauf ab hier gehört dem Paket, das ihn ausgelöst hat.

## Entscheidungen

Aus der Klärungsrunde vom 2026-08-09:

- **BUILD-009**: `engines.node` auf `>=22`. Node 22 steht bis 2027 im LTS-Fenster. `CLAUDE.md`, `README.md:91` und `docs/quickstart.md:10` werden mitgezogen; ist Node 24 für den Build nötig, steht das in `CONTRIBUTING.md`, nicht in `engines` (2026-08-09)
- **ARCH-001, ARCH-002, READ-011**: alle drei L-Umbauten werden umgesetzt, nicht wegdokumentiert (2026-08-09)
- **API-Fläche schmal halten** (2026-08-09) — API-003: `setMaxEffectDepth()`/`getMaxEffectDepth()` statt `EffectImpl`-Export · API-006: `$signal` bleibt intern, die Doku sagt das auch · API-007: schmale `LinkSource`-Sicht, `ISignalImpl` raus aus den öffentlichen Typexporten · API-008: `destroyed`-Getter an `Signal` und `Effect`
- **ASYNC-002 und ASYNC-003 werden beide behoben**, nicht nur dokumentiert. Beides ändert beobachtbares Verhalten und gehört in die Breaking Changes (2026-08-09)

Annahmen, wo das Audit zwei Wege nennt und die Wahl keine Produktentscheidung ist — jeweils die zuerst genannte Empfehlung:

- BUILD-007: `sourcesContent` aktivieren und die Maps behalten, plus `sourcemap: true` im Rollup-Output (2026-08-09)
- BUILD-015: Vorab-Check, der jede Threshold-Glob-Gruppe gegen `src/**/*.ts` matcht und bei null Treffern abbricht (2026-08-09)
- API-009: zur Laufzeit warnen, wenn `createMemo({name})` ohne `attach` kommt — die Typkopplung wäre ein Breaking Change für einen Diagnosefall (2026-08-09)
- CONS-001: den Fehlerkanal zu `onSignalizeError` verallgemeinern, `console.error` bleibt Fallback ohne Handler (2026-08-09)
- CONS-007: `touch()` und `value()` auf die `link()`-Form bringen; die stillen No-Ops bleiben still und bekommen eine Zeile in `docs/api.md` (2026-08-09)
- TEST-018: alle drei ungetesteten `BUSY_*`-Wächter bekommen einen Test. Das Finding verweist auf READ-013, das zwei davon für entbehrlich hält — READ-013 ist `low` und außerhalb des Scopes, also wird nichts entfernt (2026-08-09)

## Reihenfolge

Fünf Phasen. Die drei Gates stehen ganz vorn, wie beauftragt. Danach das Packaging, weil es dieselbe Werkzeugkette betrifft und jeden späteren `checkPkgTypes` erst aussagekräftig macht. Dann das Testnetz für genau die Bereiche, die Phase 3 bis 5 umbauen — TEST-017 als breiter Sweep über 35 Spec-Dateien liegt bewusst vorn, damit alle danach entstehenden Tests dem neuen Muster folgen und kein späterer Diff darin untergeht. Korrektheit vor Performance vor Typen vor Struktur; die Doku-Pakete zuletzt, weil jedes vorherige Paket einen CHANGELOG-Eintrag hinterlässt.

## Pakete

### Phase 1 — Die Prüfkette schließen

#### [ ] 1. Gate 1: Typecheck über Specs, Benchmarks und Configs
- Findings: BUILD-003 (critical)
- Ziel: Der Testcode — rund 9500 der 14 700 Zeilen in `src/` — wird von einem Compiler geprüft, nicht nur von SWC durchgereicht.
- Bereich: `tsconfig.json`, `package.json`, `.github/workflows/ci.yml`
- Hängt ab von: —
- Risiko: `skipLibCheck` fehlt heute und `tsc -p tsconfig.json` scheitert an sechs Fehlern aus `node_modules`. Was der neue Lauf in den Specs findet, ist unbekannt — schlägt er breit an, wird das Aufräumen ein eigenes Paket 1b.
- Modell: stärkste Stufe
- Hash: —

#### [ ] 2. Gate 2: CI auf Pull Requests und auf main
- Findings: BUILD-002 (high), BUILD-010 (high)
- Ziel: Der Pfad, der tatsächlich publiziert, fährt dasselbe Gate wie ein Feature-Branch — und ein gescheiterter Publish wird rot statt grün.
- Bereich: `.github/workflows/ci.yml`, `.github/workflows/main.yml`, `scripts/publishPackage.cjs`
- Hängt ab von: Paket 1 (das neue `typecheck`-Script wird mit eingehängt)
- Modell: mittlere Stufe
- Hash: —

#### [ ] 3. Gate 3: Coverage-Schwellen, die wirklich messen
- Findings: BUILD-015 (medium), BUILD-016 (medium)
- Ziel: Eine Schwellengruppe ohne Treffer bricht ab, statt grün zu melden; die GC-Suiten scheitern, statt sich selbst zu überspringen.
- Bereich: `vitest.config.ts`, `vitest.gc.config.ts`, die vier `*.gc.spec.ts`
- Hängt ab von: —
- Modell: mittlere Stufe
- Hash: —

#### [ ] 4. Was im Tarball landet, wird entschieden statt vergessen
- Findings: BUILD-001 (high), BUILD-006 (medium), ARCH-004 (medium)
- Ziel: Eine `files`-Allowlist ersetzt die Denylist, tote `lib/*.js` verschwinden, und der Test-Helfer wird gar nicht erst kompiliert.
- Bereich: `package.json`, `.npmignore`, `tsconfig.lib.json`, `vitest.config.ts`, `src/assert-helpers.ts`
- Hängt ab von: —
- Gegenprobe: `npm pack --dry-run`
- Modell: mittlere Stufe
- Hash: —

#### [ ] 5. Der Deklarations-Build liefert aus, was er soll
- Findings: BUILD-004 (high), BUILD-011 (medium), BUILD-005 (medium), BUILD-007 (medium)
- Ziel: JSDoc erreicht den Konsumenten-Tooltip, `@internal` verschwindet aus den Typen, `AbortSignal` löst auf, und keine Sourcemap zeigt mehr ins Leere.
- Bereich: `tsconfig.json`, `tsconfig.lib.json`, `rollup.config.mjs`
- Hängt ab von: Paket 4 (`removeComments` und `stripInternal` wirken nur zusammen, und die Allowlist entscheidet, welche Maps überhaupt mitgehen)
- Modell: mittlere Stufe
- Hash: —

#### [ ] 6. engines.node auf das senken, was der Code braucht
- Findings: BUILD-009 (medium)
- Ziel: Node 22 darf installieren.
- Bereich: `package.json`, `README.md`, `docs/quickstart.md`, `CLAUDE.md`, `CONTRIBUTING.md`
- Hängt ab von: —
- Modell: günstigste Stufe
- Hash: —

### Phase 2 — Das Netz spannen

#### [ ] 7. Aufräumen pro Test in ein finally ziehen
- Findings: TEST-017 (high)
- Ziel: Ein einzelner Fehlschlag reißt nicht mehr die restliche Datei mit — 24 bis 37 rote Tests weniger Kollateralschaden pro echter Regression.
- Bereich: rund 35 `*.spec.ts` in `src/`
- Hängt ab von: Paket 1 (der Typecheck muss über den Specs stehen, bevor 35 Dateien angefasst werden)
- Anmerkung: breiter mechanischer Sweep, bewusst vor allen inhaltlichen Paketen
- Modell: mittlere Stufe
- Hash: —

#### [ ] 8. Die ungeschützten Save/Restore-Rahmen festnageln
- Findings: TEST-016 (high), TEST-021 (medium)
- Ziel: `beQuiet()`, `runWithinEffect()` und der Dedup-Wächter in `attachEffect()` haben je einen Test, der ihr Wegfallen rot färbt.
- Bereich: `src/bequiet.spec.ts`, `src/globalEffectStack`-Umfeld, `src/SignalGroup.*.spec.ts`
- Hängt ab von: Paket 7
- Modell: mittlere Stufe
- Hash: —

#### [ ] 9. Die Wächter und die Teardown-Reihenfolge der SignalGroup festhalten
- Findings: TEST-018 (medium), TEST-019 (medium)
- Ziel: Drei `BUSY_*`-Bits und die drei begründeten Teardown-Reihenfolgen sind Test, nicht Kommentarprosa — bevor Paket 14 und 19 dieselbe Klasse umbauen.
- Bereich: `src/SignalGroup.*.spec.ts`
- Hängt ab von: Paket 7
- Modell: mittlere Stufe
- Hash: —

#### [ ] 10. Die ungetestete Hälfte der Kernlogik abdecken
- Findings: TEST-020 (medium), TEST-023 (medium), TEST-024 (medium), TEST-025 (medium)
- Ziel: Finalizer-Buchhaltung, der Ort des `#generation`-Bumps, die drei Zweige von `createSignal` und der Namens-Fallback in `#removeSignal()` überleben ihre Entfernung nicht mehr — das Netz, ohne das Paket 28 nicht angefasst werden darf.
- Bereich: `src/link.gc.spec.ts`, `src/SignalGroup.gc.spec.ts`, `src/EffectImpl.*.spec.ts`, `src/createSignal.spec.ts`
- Hängt ab von: Paket 7
- Modell: stärkste Stufe
- Hash: —

### Phase 3 — Korrektheit

#### [ ] 11. Der Retain-Replay in asyncValues() terminiert
- Findings: ASYNC-005 (critical), READ-002 (medium), TEST-022 (medium)
- Ziel: Ein einziger Write dreht `asyncValues()` nicht mehr in eine Microtask-Hot-Loop; die Abonnement-Reihenfolge in `nextValue()` ist getestet, der widersprüchliche Kommentar ist weg.
- Bereich: `src/SignalLink.ts`, `src/link.asyncValues.spec.ts`
- Hängt ab von: Paket 7
- Anmerkung: Beide vorhandenen Specs maskieren den Fehler, weil sie aus dem Schleifenkörper schreiben. Der neue Test kommt ohne schreibenden Körper aus — und er muss rot gesehen werden, bevor der Fix kommt.
- Modell: stärkste Stufe
- Hash: —

#### [ ] 12. Zwei Rahmen, die einen werfenden Callback überleben müssen
- Findings: ASYNC-001 (high), BUG-012 (medium)
- Ziel: `hibernate()` stellt seine drei Zustände auch dann wieder her, wenn der Flush wirft; `batch()` verschluckt den Fehler seines Callbacks nicht mehr hinter einem Effect-Fehler.
- Bereich: `src/hibernate.ts`, `src/batch.ts`
- Hängt ab von: Paket 8
- Modell: stärkste Stufe
- Hash: —

#### [ ] 13. Die Fehlerisolation zu Ende bauen
- Findings: READ-001 (medium), BUG-011 (high), MEM-008 (high)
- Ziel: Derselbe Mechanismus einmal statt dreimal — ein `collect()`-Helfer in `collect-errors.ts`, und `destroySignal()` wie `EffectImpl.destroy()` isolieren pro Abonnent beziehungsweise pro Teardown-Schritt, wie `writeSignal()` und `SignalLink#destroy()` es schon tun.
- Bereich: `src/collect-errors.ts`, `src/signal-core.ts`, `src/EffectImpl.ts`, `src/SignalGroup.ts`, `src/SignalLink.ts`
- Hängt ab von: Paket 8, Paket 9
- Anmerkung: Der Helfer kommt zuerst, sonst wird das Sammel-Idiom ein sechzehntes Mal abgeschrieben.
- Modell: stärkste Stufe
- Hash: —

#### [ ] 14. Die Buchhaltungs-Hooks panzern
- Findings: MEM-009 (medium), MEM-010 (medium), MEM-011 (medium), CONS-006 (medium)
- Ziel: Kein werfender Fremd-Listener kostet mehr die Aufräumbuchung — `Priority.Max` an beiden `DESTROY`-Hooks, `unlink()` sammelt pro Link, und `attachEffect()` lehnt einen zerstörten Effect ab wie seine zwei Geschwister.
- Bereich: `src/SignalGroup.ts`, `src/link.ts`
- Hängt ab von: Paket 9, Paket 13
- Modell: stärkste Stufe
- Hash: —

#### [ ] 15. Batch-Semantik für run() und Memo-Reads
- Findings: ASYNC-002 (medium), ASYNC-003 (medium)
- Ziel: Ein explizit angeforderter `effect.run()` wird im Batch nicht mehr verworfen, und ein Memo-Read im Batch liefert den aktuellen Wert statt den von vorher.
- Bereich: `src/EffectImpl.ts`, `src/batch.ts`, `src/createMemo.ts`, `docs/recipes.md`
- Hängt ab von: Paket 12
- Anmerkung: beobachtbare Verhaltensänderung — Breaking-Changes-Eintrag im CHANGELOG ist Teil des Pakets
- Modell: stärkste Stufe
- Hash: —

#### [ ] 16. Zwei API-Zusagen, die heute nicht halten
- Findings: API-014 (medium), CONS-007 (medium)
- Ziel: `SignalGroup.delete(group)` ist kein stiller No-Op mehr, und `touch({})`/`value({})` werfen einen deutbaren Fehler statt eines nativen Spread-Crashs.
- Bereich: `src/SignalGroup.ts`, `src/touch.ts`, `src/value.ts`, `docs/api.md`
- Hängt ab von: Paket 9
- Modell: mittlere Stufe
- Hash: —

### Phase 3b — Der heiße Pfad

#### [ ] 17. Die drei Early Returns
- Findings: PERF-001 (high), PERF-002 (high), PERF-003 (medium)
- Ziel: Kein Fehler-Array pro Effect-Lauf, kein Set plus zwei Subscriptions für einen leeren Batch, kein Emit auf eine Queue ohne Abonnenten. Laut Audit +27 % dynamisch, +63 % auf dem Static-Deps-Pfad.
- Bereich: `src/EffectImpl.ts`, `src/batch.ts`
- Hängt ab von: Paket 10, Paket 15
- Gegenprobe: `pnpm bench` vorher/nachher, Zahlen in den Report
- Modell: stärkste Stufe
- Hash: —

#### [ ] 18. Die Isolations-Frame nur öffnen, wenn es etwas zu isolieren gibt
- Findings: PERF-008 (high)
- Ziel: Ein Write ohne Subscriber zahlt den Isolations-Sockel nicht mehr — über einen eigenen Zähler pro Signal-Id, nicht über eine Rückfrage an eventize.
- Bereich: `src/signal-core.ts`, `src/collect-errors.ts`
- Hängt ab von: Paket 13 (dort bekommt `destroySignal()` denselben Rahmen; der Zähler muss beide bedienen)
- Modell: stärkste Stufe
- Hash: —

#### [ ] 19. Die selten benutzten Collections der SignalGroup lazy anlegen
- Findings: PERF-004 (medium)
- Ziel: Eine leere Gruppe kostet nicht mehr 2000 Bytes; sieben der neun Collections entstehen erst beim ersten Schreiben.
- Bereich: `src/SignalGroup.ts`
- Hängt ab von: Paket 9, Paket 14
- Modell: stärkste Stufe
- Hash: —

### Phase 4 — Typen, öffentliche API, Architektur

#### [ ] 20. any-Defaults raus aus der veröffentlichten Typfläche
- Findings: TYPE-001 (high), TYPE-003 (medium)
- Ziel: `unknown` statt `any` als Typparameter-Default, und `attachSignal`/`detachSignal` und Verwandte geben zurück, was sie bekommen haben, statt den Typ wegzuwerfen.
- Bereich: `src/types.ts`, `src/SignalGroup.ts`, `src/SignalLink.ts`, `src/object-signals.ts`
- Hängt ab von: Paket 1
- Modell: stärkste Stufe
- Hash: —

#### [ ] 21. Drei Typlügen schließen
- Findings: TYPE-002 (medium), TYPE-005 (medium), TYPE-004 (medium)
- Ziel: `set(fn)` ohne `{lazy:true}` kompiliert nicht mehr, `SignalAutoMap.update()` nimmt nur gültige Schlüssel, und der `@signal`-Dekorator behauptet nicht mehr, ein freier String sei eine Property.
- Bereich: `src/types.ts`, `src/createSignal.ts`, `src/SignalAutoMap.ts`, `src/decorators.ts`
- Hängt ab von: Paket 20
- Modell: stärkste Stufe
- Hash: —

#### [ ] 22. Die Effect-Oberfläche benutzbar machen
- Findings: API-001 (high), API-003 (high), API-002 (high), API-004 (medium)
- Ziel: `attachEffect()` nimmt an, was `createEffect()` zurückgibt; `maxDepth` ist über `setMaxEffectDepth()` erreichbar; `onCreateEffect`/`onDestroyEffect` sind typisiert wie `onEffectError`; die Options-Typen sind exportiert. Sechs Doku-Stellen ziehen mit.
- Bereich: `src/EffectImpl.ts`, `src/effects.ts`, `src/index.ts`, `src/SignalGroup.ts`, `docs/`
- Hängt ab von: Paket 20
- Modell: stärkste Stufe
- Hash: —

#### [ ] 23. Die Signal- und Link-Oberfläche schmal halten
- Findings: API-006 (medium), API-007 (medium), API-008 (medium)
- Ziel: `ISignalImpl` verschwindet aus den öffentlichen Typexporten und wird an `SignalLink.source` durch eine schmale `LinkSource`-Sicht ersetzt; `$signal` bleibt intern und die Doku behauptet nichts anderes; `Signal` und `Effect` bekommen einen `destroyed`-Getter.
- Bereich: `src/types.ts`, `src/Signal.ts`, `src/Effect.ts`, `src/SignalLink.ts`, `src/index.ts`, `docs/api.md`
- Hängt ab von: Paket 22
- Anmerkung: Breaking Change an `SignalLink.source` — CHANGELOG-Eintrag gehört ins Paket
- Modell: stärkste Stufe
- Hash: —

#### [ ] 24. Ein Diagnosekanal statt dreier
- Findings: CONS-001 (medium)
- Ziel: Auch ein Teardown-Fehler außerhalb eines Effects — Gruppen-Finalizer, Deprecation-Notiz — ist über einen Handler abfangbar, statt auf ein nicht routbares `console.error` zu gehen.
- Bereich: `src/effects.ts`, `src/SignalGroup.ts`, `src/createSignal.ts`, `src/index.ts`
- Hängt ab von: Paket 22
- Modell: stärkste Stufe
- Hash: —

#### [ ] 25. Der Modulgraph sagt, was er ist
- Findings: ARCH-003 (high), ARCH-001 (medium)
- Ziel: Die vier typ-only Cross-Layer-Imports sind als `import type` markiert und in `AGENTS.md` verzeichnet; zwei Kopien der Bibliothek im selben Prozess erkennen einander, statt sich stumm zu ignorieren.
- Bereich: `src/globalEffectStack.ts`, `src/EffectImpl.ts`, `src/types.ts`, `src/SignalGroup.ts`, `src/global-queues.ts`, `src/link.ts`, `biome.json`, `AGENTS.md`, `docs/architecture.md`
- Hängt ab von: Paket 13, Paket 18
- Modell: stärkste Stufe
- Hash: —

#### [ ] 26. createSignal von effects entkoppeln
- Findings: ARCH-002 (medium)
- Ziel: Ein Bundle mit ausschließlich `createSignal` zieht nicht mehr das Effect- und Group-Subsystem mit — heute 70 % der vollen Oberfläche, davon 83 % ungenutzt.
- Bereich: `src/createSignal.ts`, `src/Signal.ts`, `src/EffectImpl.ts`
- Hängt ab von: Paket 23, Paket 25
- Gegenprobe: Bundle-Größe eines Consumer-Entry mit nur `createSignal`, vorher/nachher
- Modell: stärkste Stufe
- Hash: —

### Phase 5 — Struktur und Doku

#### [ ] 27. EffectImpl.run() zerlegen
- Findings: READ-011 (medium)
- Ziel: Der dynamische Zweig steht für sich, die Snapshot/Prune-Paarung von `#lostSignals` kennt ihr eigenes Commit-Kriterium — 132 Zeilen mit dreizehn Zustandsfeldern werden wieder änderbar.
- Bereich: `src/EffectImpl.ts`
- Hängt ab von: Paket 10, Paket 17, Paket 22 — bewusst als letzter Eingriff in diese Datei
- Modell: stärkste Stufe
- Hash: —

#### [ ] 28. Die API-Doku mit der API abgleichen
- Findings: API-005 (medium), API-009 (medium), API-010 (medium), API-015 (medium)
- Ziel: `new SignalGroup()` verschwindet aus zwei Konzept-Tabellen, `createMemo({name})` ohne `attach` warnt, vier deprecated Stellen tragen ein echtes `@deprecated`, und die sieben Member der `Signal`-Klasse haben JSDoc.
- Bereich: `src/Signal.ts`, `src/SignalGroup.ts`, `src/createSignal.ts`, `src/createMemo.ts`, `src/types.ts`, `docs/architecture.md`, `AGENTS.md`
- Hängt ab von: Paket 23
- Modell: mittlere Stufe
- Hash: —

#### [ ] 29. Zahlen und Kommentare, die nicht mehr gelten
- Findings: READ-009 (medium), READ-010 (medium), READ-012 (medium), CONS-010 (medium)
- Ziel: Eine gemessene Zahl steht an genau einem Ort, mit Datum; die Kommentardichte von 0,83 sinkt dort, wo Kommentare den Code ersetzen statt ihn zu stützen; die GC-Testzahl steht in vier Dokumenten einmal richtig statt dreimal falsch.
- Bereich: `bench/signal-write.bench.ts`, `src/link.ts`, `src/SignalLink.ts`, `src/EffectImpl.ts`, `src/signal-core.ts`, `CLAUDE.md`, `CONTRIBUTING.md`, `AGENTS.md`, `README.md`, `docs/architecture.md`
- Hängt ab von: Paket 27 (die Kommentare in `EffectImpl.run()` entscheiden sich dort)
- Modell: mittlere Stufe
- Hash: —

#### [ ] 30. Den CHANGELOG in Ordnung bringen
- Findings: CONS-008 (medium), CONS-009 (medium), API-016 (medium)
- Ziel: Der `Unreleased`-Block ist navigierbar, der Widerspruch zum Link-Finalizer ist weg, zwei fehlende Breaking Changes stehen drin und der Phantom-Eintrag zu `SignalAutoMap#delete` ist gelöscht.
- Bereich: `CHANGELOG.md`
- Hängt ab von: alle vorherigen Pakete — jedes hinterlässt hier einen Eintrag
- Anmerkung: Nur der `Unreleased`-Block wird angefasst. Freigegebene Überschriften bleiben unberührt.
- Modell: mittlere Stufe
- Hash: —

## Findings-Abgleich

Alle 71 Findings des Scopes sind genau einem Paket zugeordnet:

| Paket | Findings |
| --- | --- |
| 1 | BUILD-003 |
| 2 | BUILD-002, BUILD-010 |
| 3 | BUILD-015, BUILD-016 |
| 4 | BUILD-001, BUILD-006, ARCH-004 |
| 5 | BUILD-004, BUILD-011, BUILD-005, BUILD-007 |
| 6 | BUILD-009 |
| 7 | TEST-017 |
| 8 | TEST-016, TEST-021 |
| 9 | TEST-018, TEST-019 |
| 10 | TEST-020, TEST-023, TEST-024, TEST-025 |
| 11 | ASYNC-005, READ-002, TEST-022 |
| 12 | ASYNC-001, BUG-012 |
| 13 | READ-001, BUG-011, MEM-008 |
| 14 | MEM-009, MEM-010, MEM-011, CONS-006 |
| 15 | ASYNC-002, ASYNC-003 |
| 16 | API-014, CONS-007 |
| 17 | PERF-001, PERF-002, PERF-003 |
| 18 | PERF-008 |
| 19 | PERF-004 |
| 20 | TYPE-001, TYPE-003 |
| 21 | TYPE-002, TYPE-005, TYPE-004 |
| 22 | API-001, API-003, API-002, API-004 |
| 23 | API-006, API-007, API-008 |
| 24 | CONS-001 |
| 25 | ARCH-003, ARCH-001 |
| 26 | ARCH-002 |
| 27 | READ-011 |
| 28 | API-005, API-009, API-010, API-015 |
| 29 | READ-009, READ-010, READ-012, CONS-010 |
| 30 | CONS-008, CONS-009, API-016 |
