# Remediation-Plan — @spearwolf/signalize

Quelle: ./audit.html vom 2026-08-06 (Commit 914f153) · Branch: `main` · erstellt: 2026-08-06

Baseline (vor Lauf-Beginn, alles grün): `pnpm world` ✓ — biome check ✓ · tsc ✓ · rollup ✓ · vitest 254 passed / 4 skipped. Zusätzlich `pnpm test:gc` ✓ — 258 passed. Arbeitsbaum sauber.

Scope: 24 von 47 Findings, vom Nutzer namentlich benannt — 3 high, 17 medium, 4 low. Version ist `1.0.0-dev`, eine Major steht ohnehin an; Breaking Changes sind zulässig.

## Abschluss (2026-08-06)

**Alle 13 Pakete erledigt, 24 von 24 Findings behoben, 14 Commits.** Kein Paket blockiert, kein Stash offen.

Abschluss-Verify auf dem übergebenen Baum: `pnpm world` ✓ (biome check · tsc · rollup · 347 passed / 7 skipped, Coverage 97,03 · 89,38 · 96,92 · 97,58), `pnpm test:gc` ✓ (354 passed), `pnpm bench` ✓, `npx tsc --noEmit -p tsconfig.json` in `src/` sauber. Gegen die Baseline (254 Tests, alle Kommandos grün) ist nichts rot geworden.

**Semver: major** — sieben Änderungen an der öffentlichen Oberfläche fallen in diese Stufe: geändertes Default-Verhalten bei `createMemo({batchWrites})`, bei der Verwerfung asynchroner Cleanups und beim Namens-Eigentum in `SignalGroup`; ein Wurf, wo vorher still zurückgegeben wurde (`batch(async fn)`); eine verschärfte Typdefinition (`NonThenable`, lehnt bisher gültigen Code zur Compilezeit ab); eine geänderte Rejection (`nextValue()` mit `Error` statt `undefined`); umbenannte interne `Symbol.for`-Schlüssel. Dazu ein neuer Export (`onEffectError`) und mehrere optionale Optionen — minor, aber die höchste Stufe gilt.

**Keine Versionsanhebung vorgenommen.** `package.json` steht auf `1.0.0-dev`, gesetzt in `47325da` als Marker für die noch unveröffentlichte 1.0.0. Genau diese Major nimmt die Breaking Changes auf; zwischen dem letzten Release `v0.31.1` und ihr gibt es nichts, wogegen zu brechen wäre. Kein Tag, kein Push, kein Publish — das gehört dem Nutzer.

**Kein CHANGELOG-Sammeleintrag.** Die Projektregel in `CLAUDE.md` verlangt eine Zeile pro Änderung unter `## Unreleased`; die stehen vollständig dort, gruppiert nach Features, Bug Fixes, Documentation, Chores, Tests und Breaking Changes.

### Was der Lauf über den Plan hinaus gefunden hat

Sieben Befunde entstanden erst durch einen Fix und wurden in derselben Runde geschlossen, statt als Regression stehenzubleiben: der halbzerstörte Effect bei werfendem Cleanup und die Zombie-Geschwister in `destroyChildEffects()` (Paket 3), der Selbstzerstörungs-Pfad bei Memo-only-Dependencies (Paket 6), die Leiche in `SignalGroup.#effects` bei unauflösbarer Dependency (Paket 7), das unbegrenzte Listener-Wachstum in `attach()` und der gebrochene Re-Attach nach `detachLink()` (Paket 8), der verlorene Abort-Listener beim retained Replay (Paket 9).

Vier Fehler waren vorbestehend und fielen nebenbei mit: ein `TypeError` in `Signal.onChange(cb)`, sobald der Callback etwas zurückgab (Paket 4); ein Doppel-Dekrement von `getEffectsCount()` bei re-entrantem `destroy()` (Paket 3); ein Leak bei doppelt deklarierten `@signal accessor`-Feldern in Ober- und Unterklasse (Paket 10); ein Stale-Read bei komponierten Memos, dauerhaft bei lazy Memos (Paket 12 — ein Performance-Finding, das sich beim Nachmessen als Korrektheitsfehler entpuppte).

**Das Messinstrument war selbst defekt.** `bench/memo.bench.ts` aus Paket 1 las die Quelle über den untracked Pfad `source.value`; das Memo hatte keine Dependency und rechnete im gemessenen Loop nie neu. Ein Review hatte die Suite abgenommen, die Zahl stand als Ausgangswert in diesem Plan, und aufgefallen ist es erst in Paket 12, als sie eine Design-Entscheidung tragen sollte. Siehe den Nachtrag bei Paket 1.

**Eine Regression dieses Laufs, getrennt korrigiert** (`d5b057c`): zwei Typfehler in Spec-Dateien aus den Paketen 6 und 10. Sie blieben unsichtbar, weil `pnpm compile` nur `tsconfig.lib.json` fährt und das Specs ausschließt — die Root-Config, die sie einschließt, ruft kein Script auf.

### Offene Nebenbefunde

Rund 45 Nebenbefunde stehen in den Paketabschnitten oben, bewusst nicht mehr in diesen Lauf gezogen. Die gewichtigsten:

- **Kein Script fährt die Root-`tsconfig.json`** — Spec- und `bench/`-Dateien sind in `pnpm world` und in CI vollständig ungetypprüft.
- **`EffectImpl.run()` prüft `#destroyed` nur beim Eintritt** — ein Cleanup kann den Effect mitten im Lauf zerstören, der Callback läuft trotzdem weiter und legt Subscriptions auf einer toten Instanz an.
- **Signale, die nach dem ersten `await` gelesen werden, werden nicht getrackt** — `runWithinEffect` poppt den Effect, sobald das synchrone Präfix zurückkehrt. Der größte async-Fallstrick der Bibliothek, in keinem Pitfall-Absatz erwähnt.
- **`SignalGroup.off()` und `clear()` zerstören ihre Effects und Links ungeschützt** — ein werfendes Cleanup bricht die Schleife ab und lässt den Rest stehen.
- **Ein eingesammelter Link lässt tote No-op-Closures auf den globalen Queues zurück.**
- **`@internal` an `Effect#onDestroy` ist reine Prosa** — `tsconfig.lib.json` setzt kein `stripInternal`, die Methode landet in den ausgelieferten Typen.
- **Die `#directSignals`-Ausnahme in `SignalGroup` ist gruppenlokal, die Zerstörung nicht.**
- **`pnpm test -- <file>` filtert nicht**, obwohl `CLAUDE.md` und `AGENTS.md` es so dokumentieren — das Script endet auf `vitest run --coverage`, das zusätzliche `--` schluckt das Muster.

## Nicht im Scope

Bewusst ausgenommen, damit später niemand rätselt: **BUG-001** (`@memo`-Decorator) ist mit Commit `5cb75f4` gegenstandslos geworden — der Decorator existiert nicht mehr. Ebenfalls draußen: API-001 bis API-007, ARCH-001 bis ARCH-003, TYPE-001, TYPE-002, REPO-001, TEST-001, TEST-002, DX-001 bis DX-004 sowie die drei info-Findings INF-001 bis INF-003. Die `acknowledged`-Liste des Audits ist leer.

## Entscheidungen

- **ASYNC-001** — Fehlerkanal als neuer Export `onEffectError(cb)`, analog zu `onCreateEffect`/`onDestroyEffect`. Ohne registrierten Handler landet der Fehler mit Effect-ID auf `console.error`. (2026-08-06)
- **ASYNC-002** — Generationsnummer pro Run; ein Cleanup, dessen Generation überholt wurde, wird verworfen statt verspätet ausgeführt. Kein Warten vor dem nächsten Run — das Synchronitätsversprechen bleibt. (2026-08-06)
- **BUG-006** — Symbole auf `Symbol.for('@spearwolf/signalize/…')` umstellen, ohne Major-Version im Schlüssel: zwei Versionen im selben Prozess sollen einander weiterhin erkennen. (2026-08-06)
- **BUG-004** — Ein gecachter Link wird zusätzlich an die zweite `attach`-Gruppe gehängt, statt die Gruppe zu verwerfen oder zu werfen. (2026-08-06)
- **PERF-003** — Vitest Bench (keine neue Dependency), CI führt die Suite informativ aus, ohne hartes Regressionsgate. (2026-08-06)
- **ASYNC-004/005** — `reject(new Error(…))` plus optionales `AbortSignal` für `nextValue()` und `asyncValues()`. (2026-08-06)
- **MEM-001, MEM-002, MEM-005, IMP-001** — Trotz Erwähnung in den »Offenen Fragen« des Audits werden diese Findings behoben, nicht dokumentiert: der Nutzer hat sie namentlich in den Scope genommen. Es gilt jeweils die Audit-Empfehlung. (2026-08-06)
- **MEM-006** — Bleibt Doku. Ein starker Pfad von der Gruppe zurück zum Schlüsselobjekt ist mit WeakRef und FinalizationRegistry nicht auflösbar. (2026-08-06)

## Vorbestehende Fehler

Keine. Die Baseline ist auf allen vier Kommandos grün.

## Querregeln für alle Pakete

- **Bugfix heißt Test zuerst.** Der fehlschlagende Test wird geschrieben und rot gesehen, bevor der Fix entsteht. Ausnahme: Paket 1 und Paket 13.
- **Leak-Nachweis** bei jedem Paket, das Subscriptions anfasst: `getSubscriptionCount(queue, event?)` aus `src/assert-helpers.ts` zusammen mit `getSignalsCount`/`getEffectsCount`/`getLinksCount` vor dem Szenario schnappschussen, nach dem Destroy vergleichen. Referenz: `unsubscribeEffect.spec.ts`.
- **`pnpm test:gc`** ist der einzige Weg, auf dem `SignalGroup.gc.spec.ts` und alles unter `vitest.gc.config.ts` läuft. GC-abhängige Tests gehören dorthin, sonst werden sie stillschweigend übersprungen.
- **Coverage-Gate der CI:** branches ≥ 85 %, functions ≥ 85 %, lines ≥ 95 %, statements ≥ 95 %.
- **Doku-Reihenfolge bei API-Änderungen** (steht in CLAUDE.md): JSDoc → `docs/api.md` → `docs/recipes.md` → `docs/cheat-sheet.md` → `skills/using-signalize/` → README → CHANGELOG.
- **Modul-Layering:** keine Import-Zyklen, `signal-core.ts` bleibt die Blattschicht. `rollup.config.mjs` bricht bei `CIRCULAR_DEPENDENCY`.
- **Zeilennummern im Audit sind vom Stand 914f153.** Ab Paket 3 arbeiten die Subagenten auf einem veränderten Stand und orientieren sich an Symbolnamen, nicht an Zeilen.

## Pakete

### [x] 1. Microbench-Suite unter bench/

- Findings: PERF-003
- Ziel: Eine Vitest-Bench-Suite, die die Kosten der heißen Pfade misst und in CI mitläuft, damit die späteren PERF-Pakete belegbar wirken.
- Dateien: bench/*.bench.ts (neu), vitest.bench.config.ts (neu), package.json (scripts), `.github/workflows/ci.yml`
- Modell: mittlere Stufe
- Verify: `pnpm check && pnpm bench`
- Commit: `test(bench): add microbenchmark suite for hot paths (PERF-003)`
- Hash: `c6d92d6`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm bench` ✓ (11 Fälle), `pnpm test` 254 passed / 4 skipped (unverändert). Neu: `bench/{batch,effect,memo,signal-group,signal-write}.bench.ts`, `vitest.bench.config.ts`, Script `pnpm bench`, CI-Schritt mit `continue-on-error: true`. Basiswerte stehen als Kommentar neben jeder Suite.

Gemessene Ausgangswerte für Paket 12: `batch()` um einen einzelnen Write ist **3,81×** langsamer als der rohe Write (PERF-004-Referenz); `SignalGroup.findOrCreate` auf einen Cache-Treffer ist **10,66×** langsamer als `SignalGroup.get` (PERF-002-Referenz); Memo-Recompute gegen gecachten Read Faktor 1,26 (PERF-001-Referenz).

> **Nachtrag aus Paket 12 — die PERF-001-Referenz oben ist ungültig.** `bench/memo.bench.ts` las die Quelle über `source.value`, den untracked Lesepfad. Das Memo hatte keine Dependency, der Recompute lief im gemessenen Loop nie, gemessen wurde ein abonnentenloser Signal-Write. Der Beweis lag offen im selben Report: »Memo-Recompute« meldete 13,89 Mio Hz gegen 13,69 Mio für »Write ohne Abnehmer« und 2,88 Mio für »Write mit einem Abnehmer« — ein echter Recompute kann nicht schneller sein als Letzteres. Weder Implementierer noch Reviewer dieses Pakets haben es gesehen; gefunden hat es erst der Reviewer von Paket 12, als die Zahl eine Design-Entscheidung tragen sollte. Repariert in `3d1c3fb`, echte Werte dort.

Review-Runde 1: ein `wichtig`-Befund (fehlender `pnpm bench`-Eintrag in den Kommando-Tabellen von `AGENTS.md` und `README.md`), nachgezogen samt CHANGELOG-Eintrag unter `### Tests`.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- Der Sprung von 0 auf 1 Abnehmer beim Signal-Write kostet Faktor ~4,8, der von 1 auf 10 nur ~7 — riecht nach Fixkosten im ersten `on()`/`emit()`-Roundtrip über eventize.
- `vitest bench` meldet sich selbst als experimentell; ein Vitest-Update kann die Bench-API ohne SemVer-Rücksicht verschieben.

**Umsetzungshinweise**

- Entscheidung 2026-08-06: Vitest Bench (keine neue Dependency), CI läuft die Suite rein informativ — kein hartes Regressionsgate, weil geteilte Runner das zu Fehlalarmen machen.
- Abgedeckte Fälle laut Empfehlung: Signal-Write ohne Abnehmer, Write mit n Effects, Memo-Recompute, Effect-Auf-/Abbau, `SignalGroup.findOrCreate`. Dazu `batch()` um einen einzelnen Write (Referenz für PERF-004).
- Die gemessenen Ausgangswerte gehören als Kommentar oder Markdown-Notiz neben die Suite, damit Paket 12 seine Verbesserung dagegen halten kann.
- Die Bench-Dateien dürfen nicht in den `pnpm test`-Lauf geraten (Vitest ist auf `src/` gewurzelt) und nicht ins npm-Paket (`.npmignore`, `tsconfig.lib.json` prüfen).

**PERF-003 · medium · package.json scripts · kein bench/** — Keine Microbench-Suite, keine Regressionserkennung im CI

Es gibt keinen Benchmark und keinen Schwellwert, an dem eine Performance-Regression auffallen wuerde. Die drei Messungen dieses Laufs (PERF-001, PERF-002, PERF-004) waren in wenigen Minuten geschrieben und haetten als staendige Suite jede dieser Regressionen bei ihrer Entstehung gemeldet. Fuer eine Bibliothek, deren zentrales Versprechen synchrone Reaktivitaet ist, ist die Ausfuehrungsgeschwindigkeit ein funktionales Merkmal und kein Nebenaspekt. Vormals PERF-001.

Empfehlung: Eine kleine Suite unter `bench/` mit Vitest Bench oder mitata: Signal-Write ohne Abnehmer, Write mit n Effects, Memo-Recompute, Effect-Auf- und -Abbau, `findOrCreate`. Im CI gegen die Werte des Basisbranches vergleichen und ab einer definierten Abweichung fehlschlagen lassen.

Evidenz aus dem Audit:

```
package.json enthaelt kein bench-Script; kein bench/ oder benchmarks/ im Repo
```

### [x] 2. Symbol-Schlüssel namespacen

- Findings: BUG-006
- Ziel: Die internen `Symbol.for`-Schlüssel bekommen den Paket-Namespace, damit fremde Objekte nicht als Signal durchgehen.
- Dateien: `src/constants.ts`, src/signal-core.ts (nur falls isSignal einen zusätzlichen Test braucht), `docs/architecture.md`, `CHANGELOG.md`
- Modell: günstigste Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `fix!: namespace internal Symbol.for keys (BUG-006)`
- Hash: `d7e76ef`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm test` 255 passed / 4 skipped, `pnpm test:gc` 259 passed (je +1 durch den neuen Regressionstest). Alle sechs Schlüssel tragen jetzt das Präfix `@spearwolf/signalize/`. Roter Lauf vor dem Fix belegt: `isSignal({[Symbol.for('signal')]: {id: Symbol('fake')}})` lieferte `true`, Test in `src/createSignal.spec.ts`.

Review-Runde 1: ein `wichtig`-Befund (Namespacing-Konvention und ihre Begründung fehlten in `docs/architecture.md`) und ein `klein`-Befund (CHANGELOG-Zeile las sich, als bräche jede Cross-Version-Erkennung dauerhaft) — beide nachgezogen.

Keine Nebenbefunde.

**Umsetzungshinweise**

- Entscheidung 2026-08-06: Variante `Symbol.for('@spearwolf/signalize/signal')` — ohne Major-Version im Schlüssel, damit zwei Versionen einander weiterhin erkennen. Betroffen sind alle sechs Schlüssel in `src/constants.ts`: `$signal`, `$effect`, `$destroySignal`, `$createEffect`, `$destroyEffect`, `RECALL`.
- `Symbol.for` kommt ausschließlich in `src/constants.ts` vor (verifiziert per grep) — der Rest importiert die Konstanten. Die Änderung ist mechanisch.
- Regressionstest: `isSignal({[Symbol.for('signal')]: {id: Symbol()}})` muss `false` liefern.
- Breaking Change gegenüber älteren Versionen im selben Prozess — gehört als `### Breaking Changes` in den CHANGELOG.

**BUG-006 · medium · src/constants.ts:1-14** — Symbol.for-Schluessel ohne Namespace im globalen Registry

Die internen Schluessel liegen im realm-uebergreifenden Symbol-Registry unter denkbar allgemeinen Namen: `Symbol.for('signal')`, `Symbol.for('effect')`, `Symbol.for('recall')`, `Symbol.for('destroySignal')`. Jede andere Bibliothek und jeder Anwendungscode, der auf denselben naheliegenden Namen kommt, teilt sich denselben Schluessel. `isSignal()` prueft ausschliesslich auf dessen Anwesenheit und meldet fuer ein fremdes Objekt `true`; `signalImpl()` reicht dessen Inhalt anschliessend als Signal-Implementierung weiter.

Empfehlung: Auf `Symbol.for('@spearwolf/signalize/signal')` und Analoges umstellen. Das ist ein Breaking Change fuer die Interoperabilitaet zwischen zwei geladenen Versionen und gehoert in eine Major, gemeinsam mit der Entscheidung aus den Offenen Fragen.

Evidenz aus dem Audit:

```
Probe Q: isSignal({[Symbol.for('signal')]: {id: Symbol('fake')}})
-> true
```

### [x] 3. EffectImpl.destroy(): Teardown-Reihenfolge

- Findings: MEM-007, BUG-008
- Ziel: `#destroyed` und die `off()`-Aufrufe wandern vor `runCleanupCallback()`, damit ein Cleanup keinen weiteren Run mehr auslösen kann.
- Dateien: `src/EffectImpl.ts`, src/EffectImpl.spec.ts (oder neue Spec), `docs/api.md`, `CHANGELOG.md`
- Modell: stärkste Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `fix(effect): mark effect destroyed before running cleanup (MEM-007, BUG-008)`
- Hash: `ba5ed84`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓ (kein Zyklus), `pnpm test` 264 passed / 4 skipped (Coverage 97,63 stmts · 90,41 branches · 97,15 funcs · 97,97 lines, alle Gates gehalten), `pnpm test:gc` 268 passed.

Neue Reihenfolge in `destroy()`: `#destroyed = true` → drei `off()` → `emit(this, DESTROY)` + `off(this)` → `emit($destroyEffect)` → `runCleanupCallback()` → `destroyChildEffects()` → Sets leeren → `--count`, die letzten drei in einer `try/finally`-Klammer. Neue Spec `src/EffectImpl.destroy.spec.ts` mit den rot gesehenen Fällen zu MEM-007 (`['run:0','cleanup:0','run:99']` statt `['run:0','cleanup:0']`) und BUG-008 (`expected 1 to be +0`).

Zwei Review-Runden, beide mit echtem Fund:
- Runde 1 (`wichtig`): ein werfender Cleanup ließ den Effect halbzerstört zurück — `destroyChildEffects()`, das Leeren der Sets und `--count` wurden übersprungen, während `#destroyed` schon `true` war. Behoben durch die `try/finally`-Klammer. Nebenbei fiel dabei ein vorbestehender Doppel-Dekrement bei re-entrantem `destroy()` weg (`getEffectsCount()` wurde negativ).
- Runde 2 (`wichtig`): `destroyChildEffects()` brach bei einem werfenden Kind-Cleanup ab und ließ die Geschwister als Zombies auf der Signal-Queue zurück. Behoben durch `try/catch` pro Kind; die Funktion ist jetzt zweigeteilt in `destroyChildEffects()` (wirft, für `run()`) und `collectDestroyChildEffects(errors)` (sammelt, für `destroy()`). Fehlersemantik: ein einzelner Fehler wird unverändert durchgereicht, ab zwei ein `AggregateError`.

Kleine Befunde, im Paket miterledigt: CHANGELOG-Eintrag auf »one line, one fact« gesplittet; Testlücken für DESTROY-Listener am Effect selbst, re-entrantes `destroy()` aus `onDestroyEffect` und `globalDestroySignalQueue` im Subscription-Snapshot geschlossen; eine JSDoc-Zeile behauptete fälschlich, auch ein werfender Destroy-Listener stoppe den Teardown nicht.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- `EffectImpl.run()` prüft `#destroyed` nur beim Eintritt. Zerstört ein Cleanup den Effect während eines Reruns, läuft der Callback trotzdem weiter und `whenSignalIsRead()` legt eine Subscription auf der globalen Signal-Queue an, die kein `destroy()` mehr entfernt.
- Im Rerun-Pfad steht `runCleanupCallback()` ungeschützt vor `destroyChildEffects()` — wirft der eigene Cleanup, überleben die Kinder bis zum nächsten Rerun.
- Wirft ein `DESTROY`-Listener am Effect selbst, bleiben `off(this)`, `emit($destroyEffect)` und `runCleanupCallback()` aus. Vorbestehend, gegenüber dem Vorzustand trotzdem eine Verbesserung.
- `SignalGroup.off()` und `SignalGroup.clear()` iterieren `#effects` ungeschützt; ein werfender Effect bricht die Schleife ab und lässt Rest-Effects, Links und Signale stehen. Berührt Paket 10.
- `AggregateError`-Berichte schachteln sich bei tiefen Effect-Bäumen: der Fehler eines Enkels landet als ein Eintrag im Aggregat des Kindes, das wiederum als ein Eintrag beim Elternteil.
- Die in `CLAUDE.md` und `AGENTS.md` dokumentierte Form `pnpm test -- <file>` filtert nicht — das Script endet auf `vitest run --coverage`, das zusätzliche `--` schluckt das Muster. `pnpm test <file>` funktioniert.

**Umsetzungshinweise**

- Beide Findings haben dieselbe Ursache und werden von derselben Umstellung erledigt — die Audit-Empfehlung zu BUG-008 verweist ausdrücklich auf MEM-007.
- Reihenfolge nach dem Umbau: `#destroyed = true` → die drei `off()`-Aufrufe → `emit($destroyEffect)` → `runCleanupCallback()` → `destroyChildEffects()` → Sets leeren → Counter dekrementieren. Prüfen, ob `emit(this, DESTROY)` / `off(this)` (Zeile 415/416) vor oder nach dem Flag stehen muss: Handler auf dem Effect selbst sollen ebenfalls einen bereits toten Effect sehen.
- `--EffectImpl.count` darf sich nicht doppelt oder gar nicht ausführen — der Frühausstieg `if (this.#destroyed) return` schützt jetzt weniger als vorher, sobald das Flag früher gesetzt wird.
- Tests zuerst rot sehen: (a) Cleanup schreibt in eine eigene Dependency → es darf kein Re-Run folgen; (b) `onDestroyEffect`-Handler ruft `run()` → Callback darf nicht laufen.
- Das Coverage-Gate der CI liegt bei branches ≥ 85 %, functions ≥ 85 %, lines ≥ 95 %, statements ≥ 95 %.

**MEM-007 · medium · src/EffectImpl.ts:412-435** — Teardown-Reihenfolge in destroy(): zusaetzlicher Run, dessen Cleanup verfaellt

`destroy()` setzt `#destroyed = true` erst in Zeile 427, also nach `runCleanupCallback()` (420) und waehrend die Subscriptions auf der Signal-Queue noch stehen (abgemeldet erst in 423). Schreibt eine Cleanup-Funktion in ein Signal, von dem der Effect abhaengt, greift `[RECALL]`, `run()` laeuft durch, weil das Destroyed-Flag noch nicht gesetzt ist, und der Effect-Callback wird ein weiteres Mal ausgefuehrt. Der Cleanup, den dieser Lauf zurueckgibt, landet in `#nextCleanupCallback` und wird nie mehr aufgerufen: ein dort belegtes Intervall oder ein Listener bleibt bestehen. Eine Cleanup-Funktion, die Zustand zuruecksetzt, ist ein alltaegliches Muster.

Empfehlung: `#destroyed = true` und die drei `off()`-Aufrufe vor `runCleanupCallback()` ziehen. Das behebt zugleich BUG-008.

Evidenz aus dem Audit:

```
Probe X: Effect, dessen Cleanup s.set(99) auf einer eigenen Dependency ausfuehrt
-> Ablauf: run:0 -> cleanup:0 -> run:99
Probe X2: der Cleanup des Re-Entrant-Runs wird nie ausgefuehrt
```

**BUG-008 · low · src/EffectImpl.ts:412-427** — onDestroyEffect sieht einen noch nicht als zerstoert markierten Effect

`destroy()` sendet `$destroyEffect` in Zeile 418, setzt `#destroyed` aber erst in Zeile 427. Ein Handler an `onDestroyEffect` bekommt damit eine Instanz, die auf `run()` noch antwortet und den Callback ausfuehrt. Gleiche Ursache wie MEM-007.

Empfehlung: Mit MEM-007 zusammen beheben, indem das Destroyed-Flag vor allen Benachrichtigungen gesetzt wird.

Evidenz aus dem Audit:

```
Probe Y: impl.run() innerhalb eines onDestroyEffect-Handlers
-> Callback wurde ausgefuehrt (1x)
```

### [x] 4. Async-Effect-Callbacks: Fehlerkanal und Generationen

- Findings: ASYNC-001, ASYNC-002
- Ziel: Ein rejizierender async-Effect landet in einem konfigurierbaren Fehlerkanal statt in einer unbehandelten Rejection, und ein veralteter Cleanup wird verworfen statt verspätet ausgeführt.
- Dateien: `src/EffectImpl.ts`, `src/effects.ts`, `src/index.ts`, `src/constants.ts`, neue Spec für async Effects, `docs/api.md`, `docs/recipes.md`, `skills/using-signalize/`, `README.md`, `CHANGELOG.md`
- Modell: stärkste Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `feat(effect): add onEffectError and generation-guarded async cleanups (ASYNC-001, ASYNC-002)`
- Hash: `e94c913`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 276 passed / 4 skipped (Coverage 97,70 · 90,76 · 97,23 · 98,02, alle Gates gehalten), `pnpm test:gc` 280 passed.

**Neue öffentliche API:**

```ts
onEffectError(callback: EffectErrorCallback, priority?: number): () => void
type EffectErrorPhase = 'callback' | 'cleanup';
interface EffectErrorPayload {
  readonly error: unknown;
  readonly effect: FailingEffect;   // { readonly id: symbol; destroy(): void }
  readonly effectId: symbol;
  readonly phase: EffectErrorPhase;
}
```

Kanal ist `$effectError = Symbol.for('@spearwolf/signalize/effectError')` auf der `globalEffectQueue`. Ohne registrierten Handler geht der Fehler mit Effect-ID auf `console.error`. Für Paket 5 und später relevant: `EffectImpl` bleibt bewusst nicht exportiert — statt eines Typexports der Klasse gibt es das engere Interface `FailingEffect`, damit die Klassenoberfläche keine öffentliche Zusage wird.

**Umsetzung ASYNC-002:** `#generation` wird unmittelbar vor dem Callback-Aufruf hochgezählt, nicht am Anfang von `run()`. Der Settle-Handler verwirft den Cleanup, wenn `this.#destroyed || generation !== this.#generation`. Nichts wird awaited. Der Fehlerkanal hängt beim Entstehen des Promise in `run()`, nicht in `runCleanupCallback()` — eine Rejection wird schon eine Mikrotask nach dem Run unhandled, lange bevor der nächste Run den Cleanup erreicht.

**Zwei Bestandstests umgeschrieben**, vom Reviewer im Detail nachgeprüft und bestätigt: `effects.spec.ts > async returned effect cleanup callback is called` verlangte mit `expect(cleanupValues).toEqual([666, 667])` exakt, dass zwei überholte Cleanups verspätet nachfeuern — Probe L im Test-Gewand. `effects.cleanup.spec.ts > async cleanup hook is called when effect is destroyed` brauchte seinen `setTimeout(100)`-Handshake nur, weil der Cleanup asynchron nachlief. Beide kodierten die alte, fehlerhafte Semantik; keine Deckung ging verloren.

**Mitgeheilt, ohne dass ein Finding es verlangte:** ein Effect-Callback, der etwas anderes als eine Funktion zurückgibt, warf beim nächsten Lauf `TypeError: cleanupCallback is not a function`. Traf vor allem `Signal.onChange(cb)`, dessen Callback `any` zurückgeben darf — `sig.onChange(v => total += v)` stürzte beim zweiten Change ab, und TypeScript ließ es durch, weil `() => number` gegen `() => void` zuweisbar ist. Gilt jetzt als »kein Cleanup«. Ebenso geht ein rejizierendes async Cleanup jetzt mit `phase: 'cleanup'` in den Fehlerkanal.

Eine Review-Runde mit neun `klein`-Befunden, alle abgearbeitet: Generation-Bump an die richtige Stelle (die alte Position verwarf bei Re-Entranz aus dem Cleanup nachweislich den Cleanup des zuletzt aufgerufenen Runs); falsche Zusage »These errors never become unhandled rejections« in fünf Dokumenten entschärft; Warnung ergänzt, dass ein werfender Handler den eventize-Dispatch abbricht; `docs/architecture.md` mit `AGENTS.md` synchronisiert; Kostenkommentar an der Handler-Sonde; `vi.restoreAllMocks()` im `afterEach`; Testlücken für den `console.error`-Fallback und die beiden neuen Invarianten geschlossen.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- Signale, die nach dem ersten `await` gelesen werden, werden gar nicht getrackt — `runWithinEffect` poppt den Effect vom Stack, sobald das synchrone Präfix zurückkehrt. Der größte async-Fallstrick der Bibliothek, in keinem Pitfall-Absatz erwähnt.
- Ein async `onEffectError`-Handler, dessen Promise rejiziert, beendet den Prozess weiterhin — `emit()` awaitet nicht. Bewusst offen gelassen und an vier Stellen dokumentiert.
- Die Handler-Sonde fragt nur den benannten Bucket ab: wer `on(globalEffectQueue, '*', cb)` registriert, sieht `$effectError` nie.
- `onCreateEffect` und `onDestroyEffect` stehen weiterhin auf `(...args: unknown[])` hinter `@ts-ignore`, während `onEffectError` sauber typisiert ist (berührt TYPE-001, nicht im Scope).
- Die pendende `.then`-Closure hält den `EffectImpl` bis zum Settle am Leben; ein nie settelndes Callback-Promise hält ihn für die Prozesslaufzeit.
- `CLAUDE.md:45` und `AGENTS.md:129` nennen ein `getSubscriptionCount(queue, event?)` aus `src/assert-helpers.ts`, das es nicht gibt — eventize v6 kennt nur die Ein-Argument-Form, die Pro-Event-Auskunft liefert `getSubscribedEventNames(o)`. Betrifft auch die Querregel oben in diesem Plan.
- `pnpm checkPkgTypes` endet mit Exit-Code 1 (`node10: Resolution failed` für `./decorators`). Vorbestehend, Folge des ESM-only-Pakets, nicht Teil der Verify-Kette.

**Umsetzungshinweise**

- Entscheidung 2026-08-06 zu ASYNC-001: neuer Export `onEffectError(cb)` analog zu `onCreateEffect`/`onDestroyEffect`, also ein `$effectError`-Symbol auf der `globalEffectQueue`. Ist kein Handler registriert, geht der Fehler mit Effect-ID auf `console.error` — er darf unter keinen Umständen als unbehandelte Rejection den Prozess beenden.
- Entscheidung 2026-08-06 zu ASYNC-002: monoton steigende Generationsnummer pro Run. Settled das Promise und der Effect ist seither neu gelaufen oder zerstört, wird der Cleanup **verworfen**, nicht nachgeholt. Kein Warten vor dem nächsten Run — das Synchronitätsversprechen der Bibliothek bleibt unangetastet.
- Dass ein verworfener Cleanup nichts mehr aufräumt, ist eine bewusste Konsequenz und gehört als Warnung in `docs/recipes.md` neben den bestehenden Cleanup-Absatz: wer in einem async-Effect Ressourcen belegt, muss sie synchron oder über ein AbortSignal freigeben.
- Reihenfolge beachten: Paket 3 hat `runCleanupCallback()` und `destroy()` bereits umgestellt — auf diesem Stand aufsetzen, nicht auf dem Audit-Zeilenstand.
- Tests zuerst rot sehen: (a) `createEffect(async () => { s.get(); throw new Error('boom') })` → `onEffectError` feuert, kein `unhandledRejection`; (b) der Ablauf aus Probe L (run:0 → run:1 → run:2) darf keinen Cleanup einer alten Generation mehr ausführen.
- `onEffectError` ist neue öffentliche API: Export in `src/index.ts`, dann JSDoc → `docs/api.md` → `docs/cheat-sheet.md` → `skills/using-signalize/` → README-Tabelle → CHANGELOG (Reihenfolge steht in CLAUDE.md).

**ASYNC-001 · high · src/EffectImpl.ts:396-410** — Rejizierender async-Effect-Callback wird zur unbehandelten Rejection

`runCleanupCallback()` erkennt ein Thenable und haengt `Promise.resolve(cb).then(...)` daran, ohne `.catch()`. Wirft ein `async`-Effect-Callback, landet der Fehler als unbehandelte Rejection im Prozess. Node beendet sich seit v15 in dieser Lage standardmaessig. Der Effect selbst laeuft danach weiter, als waere nichts gewesen: es gibt keinen Fehlerkanal, ueber den ein Konsument davon erfahren koennte. Betroffen ist die naheliegendste Form eines asynchronen Effects, naemlich `createEffect(async () => { await fetch(...) })` mit einem Fetch, der abweist.

Empfehlung: Einen `.catch()`-Zweig anhaengen und den Fehler an einen konfigurierbaren Handler routen, analog zu `onCreateEffect`/`onDestroyEffect` etwa ein `onEffectError(cb)`. Minimalvariante: `console.error` mit Effect-ID, damit der Fehler wenigstens sichtbar wird statt den Prozess zu beenden.

Evidenz aus dem Audit:

```
Probe K: createEffect(async () => { s.get(); throw new Error('boom') }); s.set(1)
-> process 'unhandledRejection' feuert mit: boom from async effect
```

**ASYNC-002 · high · src/EffectImpl.ts:396-410** — Async-Cleanups laufen in falscher Reihenfolge und nach spaeteren Runs

Gibt ein Effect-Callback ein Promise zurueck, wird die Cleanup-Funktion erst beim Settle aufgerufen. Bis dahin kann der Effect bereits mehrfach neu gelaufen sein und neue Ressourcen belegt haben. Es gibt weder ein Generationskennzeichen noch eine Cancellation: der Cleanup von Run N raeumt auf, waehrend Run N+1 laengst laeuft. Das ist die klassische Double-Acquire-Late-Release-Situation, etwa ein Intervall aus Run 1, das erst nach dem Intervall aus Run 3 abgeraeumt wird. Der Cleanup des jeweils letzten Runs steht zum Messzeitpunkt ueberhaupt noch aus.

Empfehlung: Jedem Run eine monoton steigende Generationsnummer geben und beim Settle pruefen, ob der Effect seither neu gelaufen oder zerstoert wurde; in dem Fall den Cleanup verwerfen oder vor dem naechsten Run abwarten. Die gewaehlte Semantik gehoert in `docs/recipes.md` neben den bestehenden Cleanup-Absatz.

Evidenz aus dem Audit:

```
Probe L: async-Effect mit s.set(1); s.set(2)
-> Ablauf: run:0 -> run:1 -> run:2 -> cleanup:0 -> cleanup:1
   (cleanup:2 steht zum Messzeitpunkt noch aus)
```

### [x] 5. Kind-Effects: Static-Deps-Zweig und totes Slot-Recycling

- Findings: MEM-001, IMP-001
- Ziel: Auch Static-Deps-Effects führen ihren Callback auf dem Effect-Stack, damit verschachtelte Effects wieder als Kinder erfasst und zerstört werden; die nie erreichte Slot-Recycling-Mechanik fliegt raus.
- Dateien: `src/EffectImpl.ts`, `src/globalEffectStack.ts`, Specs für verschachtelte Effects, docs/recipes.md (Pitfall 7 und 10), `skills/using-signalize/`, `CHANGELOG.md`
- Modell: stärkste Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `fix(effect): track child effects in static-deps effects, drop dead slot recycling (MEM-001, IMP-001)`
- Hash: `48376a9`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 285 passed / 4 skipped (Coverage 97,69 · 91,02 · 97,23 · 98,01, alle Gates gehalten), `pnpm test:gc` 289 passed.

Der Static-Deps-Zweig in `run()` läuft jetzt über `runWithoutAutoTracking()`, das intern `runWithinEffect(this, this.callback)` aufruft. Die automatische Subscription unterdrückt ein privates Feld `#suppressAutoTracking`, das `whenSignalIsRead()` abfragt. Das Flag wird gesichert und wiederhergestellt statt platt zurückgesetzt — ein re-entranter innerer Run darf den äußeren nicht entsperren. Das Flag-Fenster liegt strikt hinter `runCleanupCallback()`, `destroyChildEffects()` und dem Generation-Bump aus Paket 4, unmittelbar um den Callback. Die Slot-Recycling-Mechanik ist restlos entfernt; `childEffects` ist eine reine Liste.

**Blast Radius**, vom Reviewer unabhängig nachgeprüft: `getCurrentEffect()` hat im Produktivcode genau zwei Aufrufer — `readSignal()` in `signal-core.ts` und `createEffect()` in `EffectImpl.ts`. Beabsichtigt betroffen sind nur die Stellen, die Effects erzeugen (`createMemo`, `Signal.onChange`, die deprecatete `signalReader(cb)`-Form): dort entstehende Effects sind jetzt Kinder und sterben mit dem Elternteil. `readSignal` ist durch das Flag exakt neutralisiert, `hibernate()` leert ohnehin den ganzen Stack, `object-signals.ts`, `decorators.ts`, `SignalGroup.ts`, `SignalAutoMap.ts`, `link.ts`, `SignalLink.ts`, `batch.ts`, `touch.ts`, `value.ts` und `bequiet.ts` sind unbeteiligt. Pitfall 7 bleibt exakt erhalten; `saveSignalsFromDeps()` ist unerreichbar für die Unterdrückung, weil es immer auf einer frisch konstruierten Instanz mit Flag `false` läuft.

Rote Läufe: Probe A (`expected 7 to be 2` über 5 Reruns), Kind-Cleanup beim Parent-Destroy, `Signal.onChange` (`expected 6 to be 2`). Für IMP-001 gibt es keinen roten Lauf — die Mechanik war tot, der Ausbau verhaltenserhaltend; abgesichert durch einen Charakterisierungstest, der die Pitfall-10-Semantik festhält.

Review-Runde 1, ein `wichtig`-Befund: die beiden tragenden Invarianten des neuen Flags waren ungetestet — ein plattes `= false` statt des Restores hätte die Suite grün gelassen. Beide Tests nachgezogen und **per Mutation rot gesehen**: das Restore auf `= false` ändern bricht Test (a) (`expected 2 to be 3` plus überlebender Effect im Teardown), ein modul-globales statt Pro-Instanz-Flag bricht Test (b) (`expected 2 to be 1`, das globale Flag erstickt das Tracking des dynamischen Kindes). Vier kleine Befunde miterledigt: falsche JSDoc-Begründung an `saveSignalsFromDeps()` (tragend ist die frische Instanz, nicht der Zeitpunkt), `AGENTS.md` mit `docs/architecture.md` synchronisiert, `onChange(cb)`-Tabellenzeile um die Verhaltensänderung ergänzt, und die Memo-Aussage in drei Dokumenten korrigiert — der Memo-Effect stirbt mit dem Parent, das Memo-Signal überlebt und liest sich danach als eingefrorene Konstante.

**Für Paket 6 gemessen:** Sonde `createEffect(() => { createMemo(() => src.get()*2)() }, [t.get])` über 10 Reruns — Effects jetzt stabil bei 4 (vorher wachsend), Signale weiterhin 5 → 15 und nach `destroy()` unverändert 15. Der Effect-Teil des Lecks ist weg, der Signal-Teil ist MEM-005 und unberührt. Die Voraussetzung für Paket 6 steht.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- Hätte die Slot-Recycling-Mechanik je gegriffen, wäre sie nicht bloß nutzlos, sondern gefährlich gewesen: `createEffect` hätte den recycelten Effect mit dessen **altem** Callback zurückgegeben und den neu übergebenen kommentarlos verworfen. Der Ausbau nimmt die Falle mit.
- `SignalGroup.#effects` trägt zerstörte Effects nie aus; ein Kind-Effect mit `{attach}` unter einem Static-Deps-Parent stirbt jetzt beim Rerun, bleibt aber bis `clear()` im Set. Harmlos, weil `destroy()` idempotent ist. Berührt Paket 10.
- Der Paket-3-Nebenbefund »`run()` prüft `#destroyed` nur beim Eintritt« gilt jetzt auch für Static-Deps-Effects: zerstört ein Cleanup den Effect mitten im Run, sammelt der danach laufende Callback Kind-Effects in einer bereits toten Instanz.
- Die Zeile `readSignal(signal.id)` in `createSignalReader` (`src/createSignal.ts:48`) ist tot — vorher wegen des leeren Stacks, jetzt wegen des Flags. Deprecateter Pfad, Löschen wäre Kosmetik.

**Umsetzungshinweise**

- Beide Findings sitzen in derselben Mechanik: `run()`, `childEffects`, `curChildEffectSlot`, `getCurrentChildEffect()`, `attachChildEffect()`.
- MEM-001 nach Audit-Empfehlung: Static-Deps-Zweig ebenfalls über `runWithinEffect(this, this.callback)` führen und die automatische Subscription über ein Flag unterdrücken, das `whenSignalIsRead()` abfragt. Das dokumentierte Verhalten (kein Auto-Tracking bei statischen Deps, Pitfall 7) muss unverändert bleiben — `saveSignalsFromDeps()` ruft `whenSignalIsRead()` selbst auf und darf vom Flag nicht getroffen werden.
- IMP-001 nach Audit-Empfehlung: ersatzlos entfernen. `childEffects` wird eine einfache Liste, `curChildEffectSlot`, `getCurrentChildEffect()` und der `if (effect == null)`-Zweig in `createEffect` verschwinden. Das deckt sich mit der dokumentierten Semantik in Pitfall 10.
- Reihenfolge: erst IMP-001 aufräumen, dann MEM-001 — auf der reduzierten Mechanik ist der Umbau kleiner.
- Test zuerst rot sehen (Probe A): `createEffect(() => { createEffect(() => a.get()) }, [trigger.get])` → `getEffectsCount()` muss über 5 Reruns konstant bleiben statt auf 6 zu wachsen. Gegenprobe mit dynamischen Deps muss weiterhin stabil sein.
- Blast Radius im Auge behalten: `getCurrentEffect()` liefert im Static-Deps-Callback künftig einen Effect. Alles, was sich bislang auf `undefined` verlassen hat (`createMemo`, `Signal.onChange`, `object-signals`), muss geprüft werden.

**MEM-001 · high · src/EffectImpl.ts:295-297** — Verschachtelte Effects in Static-Deps-Effects werden nie zerstoert

`run()` ruft den Callback im Static-Deps-Zweig direkt auf (`this.callback()`), im dynamischen Zweig dagegen ueber `runWithinEffect(this, this.callback)`. Nur letzteres legt den Effect auf den globalen Effect-Stack. Folglich liefert `getCurrentEffect()` innerhalb eines Static-Deps-Callbacks `undefined`, jedes dort erzeugte `createEffect()` (und damit auch `Signal.onChange()`) wird nicht als Kind-Effect registriert und von `destroyChildEffects()` nie erfasst. Bei jedem Rerun entsteht ein weiterer Effect, der auf der globalen Signal-Queue subscribed bleibt. Unbegrenzt und ohne Warnung. Pitfall 7 dokumentiert am selben Codepfad nur das fehlende Auto-Tracking, nicht diese Folge.

Empfehlung: Auch den Static-Deps-Zweig ueber `runWithinEffect` fuehren und stattdessen nur die automatische Subscription unterdruecken, etwa ueber ein Flag, das `whenSignalIsRead()` abfragt. Damit bleibt das dokumentierte Verhalten (keine Auto-Deps) erhalten, waehrend die Kind-Effect-Verwaltung wieder greift.

Evidenz aus dem Audit:

```
Probe A: createEffect(() => { createEffect(() => a.get()) }, [trigger.get])
-> nach 5 Reruns: 6 lebende Effects (1 aeusserer + 5 Waisen)
Probe B (Gegenprobe, dynamische Deps): stabil bei 8 Effects ueber 5 Reruns
```

**IMP-001 · medium · src/EffectImpl.ts:112-113 · 229-235 · 250-256 · 380-385** — Slot-Recycling fuer Kind-Effects ist ein unerreichbarer Pfad

`childEffects`, `curChildEffectSlot`, `getCurrentChildEffect()` und `attachChildEffect()` bilden einen Mechanismus, der Kind-Effects ueber Reruns hinweg wiederverwenden soll. Er greift nie: `run()` ruft `destroyChildEffects()`, das das Array leert, und setzt `curChildEffectSlot = 0`, beides vor dem Callback. `getCurrentChildEffect()` liefert deshalb ausnahmslos `undefined`, und der Zweig `if (effect == null)` ist der einzige, der je genommen wird. Das dokumentierte Verhalten (Pitfall 10: Kind-Effects werden bei jedem Rerun neu erzeugt) entspricht dem, der Code suggeriert aber eine Optimierung, die es nicht gibt. Vormals IMP-001.

Empfehlung: Entweder ersatzlos entfernen und `childEffects` auf eine einfache Liste reduzieren, oder das Recycling tatsaechlich implementieren, indem `run()` die Slots wiederverwendet statt sie zu leeren. Die erste Variante deckt sich mit der dokumentierten Semantik und ist die kleinere Aenderung.

Evidenz aus dem Audit:

```
Probe BB: verschachtelter Effect ueber 5 Reruns
-> Symbol(ef3), Symbol(ef4), Symbol(ef5), Symbol(ef6), Symbol(ef7): 5 verschiedene Instanzen
```

### [x] 6. createMemo() im Effect-Body leakt kein Signal mehr

- Findings: MEM-005
- Ziel: Das interne Memo-Signal hängt am Lebenszyklus des erzeugenden Effects und wird mit ihm zerstört.
- Dateien: `src/createMemo.ts`, `src/createMemo.spec.ts`, docs/recipes.md (Pitfall 10), `skills/using-signalize/`, `CHANGELOG.md`
- Modell: mittlere Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `fix(memo): destroy the memo signal with its creating effect (MEM-005)`
- Hash: `45444ee`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 301 passed / 4 skipped (Coverage 98,13 · 92,96 · 97,32 · 98,45, alle Gates gehalten), `pnpm test:gc` 305 passed.

Das teuerste Paket des Laufs: drei Runden, jede hat eine Ebene tiefer einen neuen Pfad freigelegt.

**Der Fix.** `createMemo()` bindet das interne Memo-Signal an den Lebenszyklus des erzeugenden Effects, aber nur unter der Bedingung `parentEffect != null && group == null` — also nur, wenn beim Aufruf ein Parent-Effect auf dem Stack liegt **und** kein `attach` gegeben ist. Ohne Parent bleibt das alte Verhalten; mit `attach` gehört das Signal der Gruppe. Statt eines Direktzugriffs auf `e[$effect]` gibt es ein als `@internal` geführtes `Effect#onDestroy(cb)`, das auch den Fall abdeckt, dass der Effect beim Return aus `createEffect` bereits zerstört ist; dafür bekam `EffectImpl` einen öffentlichen `destroyed`-Getter. Der Hook hängt bewusst an der rohen `EffectImpl`, nicht am `Effect`-Wrapper: der ruft kein `eventize(this)` und emittiert nirgends — ein `once(e, DESTROY, …)` dort hätte **nie** gefeuert, und eventize hätte es per `asEventized()` klaglos angenommen.

**Runde 1 — drei `kritisch`.** Der erste Wurf band das Signal unbedingt an den Effect. Folgen: im Normalfall riss `destroySignal(a, b)` das Memo-Signal mit und kaskadierte auf Downstream-Effects; `SignalGroup.off()` brach sein dokumentiertes Versprechen, attachte Signale am Leben zu lassen (das Signal blieb als Leiche im Namensregister, ein erneutes `attachSignal()` warf); und die Doku empfahl `{attach}` als Escape-Hatch, den es nicht gibt — Kind-Effects werden unabhängig von `attach` registriert. Alle drei durch die verengte Bedingung geschlossen. Wichtig für die Doku: `{attach}` rettet nur den **Wert**, der Memo-Effect stirbt trotzdem beim Parent-Rerun. Einziger Weg zu einem lebendigen Memo ist `hibernate()`, das den Effect-Stack leert und damit gar keine Kind-Registrierung entstehen lässt.

**Runde 2 — ein `kritisch`.** Die verengte Bedingung öffnete einen neuen Pfad: ein Effect, dessen sämtliche Dependencies selbsterzeugte Memos sind, zerstörte sich beim ersten Rerun selbst. `destroyChildEffects()` tötet den Memo-Effect, der Hook zerstört das Memo-Signal, und `[$destroySignal]` stellt mitten im laufenden `run()` fest, dass alle Signale tot sind. Behoben durch `destroyWhenUntriggerable()`: bei `#runDepth > 0` wird nur `#selfDestroyPending` gesetzt und am Ende des äußersten Runs eingelöst — **nachgeholt statt unterdrückt**, weil reine Unterdrückung jeden Effect, der seine letzte Dependency während eines eigenen Runs verliert, dauerhaft als unweckbaren Zombie zurückgelassen hätte. Das Prädikat ist bewusst `#signalSubscriptions.size === 0` statt `#destroyedSignals.size === #signals.size`: der dynamische Zweig leert `#destroyedSignals` am Run-Ende, und ein erst nach dem Read zerstörtes Signal bleibt unabgemeldet in `#signals` stehen — beide Sets lügen zu diesem Zeitpunkt, `#signalSubscriptions` ist das ehrliche Register »wer kann mich noch wecken«.

**Runde 3 — ein `wichtig`.** Der Nachholblock stand außerhalb des `finally` und verfiel, wenn der Run warf: das Flag blieb gesetzt, der Effect zählte für immer in `getEffectsCount()` und blieb unweckbar auf der Queue — gegenüber dem Ausgangsstand ein Rückschritt. Jetzt im `finally` hinter `#runDepth--`, mit eigenem `try/catch` um das `destroy()`; ein dabei geworfener Teardown-Fehler geht über `emitEffectError(this, err, 'cleanup')` in den Kanal aus Paket 4, statt den Original-Fehler zu überschreiben oder einen Aufrufer zu treffen, der nur zufällig gerade ein Signal geschrieben hat.

Alle Regressionstests per Mutation scharf gestellt: `&& group == null` streichen bricht den `{attach}`-Test; die aufgeschobene Prüfung lahmlegen bricht »still destroys the effect at the end of that run«; die alte Platzierung außerhalb des `finally` bricht den Wurf-Test; ohne den `destroyed`-Getter feuert der K1-Hook nie. Die Suiten der Pakete 3 bis 5 laufen unverändert grün — nichts musste weggeändert werden.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- `@internal` an `Effect#onDestroy` ist reine Prosa: `tsconfig.lib.json` setzt kein `stripInternal`, die Methode landet vollständig in `lib/Effect.d.ts` und in der Autovervollständigung. Entweder `stripInternal: true` (prüfen, was es sonst noch mitnimmt — `signal-core.ts` hat weitere `@internal`-Markierungen) oder die Methode nach `EffectImpl` verschieben.
- Die **Auslösebedingung** in `[$destroySignal]` vergleicht weiterhin `#destroyedSignals.size === #signals.size`. Wird ein Signal nach dem Lesen zerstört, bleibt es unabgemeldet in `#signals`, der Vergleich geht nie mehr auf und der Selbstmord unterbleibt ganz. Dieselbe Begründung, die `#signalSubscriptions` als ehrliches Register ausweist, spricht dafür, auch den Auslöser dorthin zu verlegen.
- `readSignal()` prüft `signal.destroyed` nicht: ein erstmaliger Lesezugriff auf ein bereits zerstörtes Signal legt einen `#signalSubscriptions`-Eintrag an, der nie feuert und nie entfernt wird.
- `{attach}` im Effect-Body sammelt pro Rerun ein weiteres Signal und einen weiteren toten Effect in der Gruppe (`attachSignalByName` überschreibt nur die Namensbindung, `#signals` und `#otherSignals` wachsen mit). MEM-005 ist für diesen Fall nicht behoben, sondern an die Gruppenlebensdauer delegiert. Berührt MEM-003 in Paket 10.
- `Effect#onDestroy` ist eine Prototyp-Methode, während `run` und `destroy` gebundene Arrow-Properties sind — `const {onDestroy} = effect` wirft.
- Der `detach`-Zweig mit `#signals.size === 0` ist von keinem Test erreicht; einziger Emitter ist `SignalGroup.off()`.
- Fehlende Tests für ein Memo im Body eines Static-Deps-Effects und für `hibernate()` um ein `createMemo`, obwohl die Doku Letzteres jetzt als einzigen Escape-Hatch nennt.

**Umsetzungshinweise**

- Setzt Paket 5 voraus: erst wenn `getCurrentEffect()` auch im Static-Deps-Zweig einen Effect liefert, greift die Bindung in allen Fällen.
- Audit-Empfehlung: das Memo-Signal im `once(effect, DESTROY, ...)`-Hook des erzeugenden Effects mit zerstören. Ein Memo, das über `attach` bereits an einer Gruppe hängt, darf davon nicht doppelt erfasst werden.
- Test zuerst rot sehen (Probe P): `createEffect(() => { trigger.get(); createMemo(() => src.get()*2)() })` → `getSignalsCount()` muss über 10 Reruns konstant bleiben statt von 11 auf 21 zu wachsen.
- Zusätzlich der Leak-Check aus CLAUDE.md: `getSubscriptionCount(globalDestroySignalQueue)` vor und nach dem Szenario vergleichen — `createMemo` registriert dort ein `once`.

**MEM-005 · medium · src/createMemo.ts:37 · src/EffectImpl.ts:288** — createMemo() im Effect-Body leakt ein Signal pro Rerun

`createMemo()` legt intern ein Signal an. Wird die Funktion im Rumpf eines Effects aufgerufen, entsteht dieses Signal bei jedem Rerun neu. Der zugehoerige Effect wird als Kind-Effect erfasst und beim naechsten Rerun ordentlich zerstoert, das Signal jedoch nicht: es haengt an keiner Gruppe und wird von `destroyChildEffects()` nicht beruehrt. Zurueck bleibt pro Rerun ein Signal, dessen `beforeRead` auf einen zerstoerten Effect zeigt und das damit auch inhaltlich eingefroren ist. Pitfall 10 warnt vor verschachtelten Effects, sagt aber nichts ueber Memos.

Empfehlung: Das Memo-Signal an den Lebenszyklus des erzeugenden Effects binden, also im `once(effect, DESTROY, ...)`-Hook mit zerstoeren. Solange das nicht geschieht, gehoert eine klare Warnung in `docs/recipes.md` und in Pitfall 10.

Evidenz aus dem Audit:

```
Probe P: createEffect(() => { trigger.get(); createMemo(() => src.get()*2)() })
-> getSignalsCount(): 11 nach dem ersten Run, 21 nach 10 Reruns
```

### [x] 7. createEffect: Options-Mutation und unauflösbare Deps

- Findings: BUG-005, BUG-003
- Ziel: `createEffect` lässt das Options-Objekt des Aufrufers in Ruhe und wirft bei einem unbekannten Dependency-Namen eine Meldung, die den Namen nennt.
- Dateien: `src/EffectImpl.ts`, Spec für createEffect-Argumente, `docs/api.md`, `CHANGELOG.md`
- Modell: mittlere Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `fix(effect): stop mutating caller options, report unresolvable deps (BUG-005, BUG-003)`
- Hash: `4e717a9`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 304 passed / 4 skipped, `pnpm test:gc` 308 passed.

BUG-005 wörtlich nach Empfehlung: `const options = dependencies ? {...opts, dependencies} : (optsOrDeps as EffectOptions | undefined)`. Alle vier Overload-Formen geprüft, kein indirekter Mutationspfad über das geteilte `dependencies`-Array. Roter Lauf: `expected { autorun: false, dependencies: [Function] } to deeply equal { autorun: false }`.

BUG-003 mit begründeter Abweichung: der Null-Check sitzt an der Auflösungsstelle im Konstruktor statt in `saveSignalsFromDeps()`. Dort liegen Name und Kontext noch vor, und der Wurf passiert vor `this.id`, vor der Queue-Subscription und vor `++EffectImpl.count` — es entsteht gar kein halb gezählter Effect. Beide vom Plan geforderten Fälle sind abgedeckt, `String(dep)` bettet auch Symbol-Dependencies sauber ein:

- `[signalize] createEffect: cannot resolve dependency "doesNotExist" — no SignalGroup is attached (missing "attach" option)`
- `[signalize] createEffect: cannot resolve dependency "doesNotExist" — no signal with that name is registered in the attached SignalGroup`

Review-Runde 1, ein `kritisch`-Befund — der Preis der Abweichung: `group.attachEffect(this)` lief **vor** der Dependency-Auflösung. Warf sie, blieb eine halb konstruierte Instanz in `SignalGroup.#effects` hängen. Deren späteres `destroy()` beim Gruppen-Teardown lief vollständig durch (alle benutzten Felder haben Default-Initialisierer) und dekrementierte `EffectImpl.count`, obwohl für diese Instanz nie inkrementiert wurde — `getEffectsCount()` driftet dauerhaft ins Negative, und weil `assertEffectsCount()` in praktisch jeder Spec-Datei auf 0 prüft, schlägt irgendwann ein unbeteiligter Test mit `expected 0 to be -1` fehl. Zusätzlich feuerte für die Leiche ein `$destroyEffect` ohne vorheriges `$createEffect`. Behoben durch Verschieben von `group.attachEffect(this)` ans Ende des Konstruktors, direkt vor `++EffectImpl.count`; `SignalGroup.findOrCreate()` bleibt früh, weil `group.signal(dep)` es für den Lookup braucht — ein reiner Read, unabhängig von `#effects`. Roter Lauf des erweiterten Tests: `expected -1 to be +0`.

Keine Nebenbefunde.

**Umsetzungshinweise**

- Beides sitzt in der Argumentverarbeitung von `createEffect` und im Konstruktor — ein Paket, zwei kleine Diffs.
- BUG-005 exakt nach Empfehlung: `const options = dependencies ? {...opts, dependencies} : optsOrDeps` statt `options.dependencies = dependencies`.
- BUG-003: In `saveSignalsFromDeps()` bzw. beim Auflösen im Konstruktor auf `null` prüfen und mit einer Meldung werfen, die den fehlenden Namen und die Gruppe nennt. Denselben Check für `group === undefined` (Zeile 157) — JavaScript-Konsumenten ohne Typprüfung erreichen diesen Fall.
- Tests zuerst rot sehen: (a) `const shared = {autorun:false}; createEffect(fn, [s.get], shared)` → `shared` bleibt unverändert; (b) `createEffect(() => {}, ['doesNotExist'], {attach: g})` → Fehlermeldung enthält `doesNotExist`.

**BUG-005 · medium · src/EffectImpl.ts:210-223** — createEffect mutiert das Options-Objekt des Aufrufers

In der positionalen Form schreibt `createEffect` die Dependencies mit `options.dependencies = dependencies` direkt in das vom Aufrufer uebergebene Objekt. Wer ein gemeinsames Options-Objekt fuer mehrere Effects wiederverwendet, ein durchaus uebliches Muster bei gleicher Prioritaet oder gleichem `attach`, schleppt ab dem zweiten Aufruf die Dependencies des ersten mit. Ein Effect haengt dann an Signalen, die an seiner Aufrufstelle nirgends stehen.

Empfehlung: Ein frisches Objekt bilden statt zu mutieren: `const options = dependencies ? {...opts, dependencies} : optsOrDeps`.

Evidenz aus dem Audit:

```
Probe G: const shared = {autorun:false}; createEffect(fn, [s.get], shared)
-> shared danach: {autorun, dependencies}
```

**BUG-003 · medium · src/EffectImpl.ts:152-162 · 178-182** — Unaufloesbare String-Dependency wirft einen nichtssagenden TypeError

Die Overloads von `createEffect` erzwingen zu Recht ein `attach`, sobald die Dependencies Strings oder Symbole enthalten. Sie koennen aber nicht garantieren, dass der Name in der Gruppe auch registriert ist. Ist er es nicht, liefert `group.signal(name)` `undefined`, und `saveSignalsFromDeps()` dereferenziert das ungeprueft. Der Aufrufer sieht `TypeError: Cannot read properties of undefined (reading 'id')`, ohne Hinweis auf den Namen, die Gruppe oder auch nur darauf, dass es um eine Dependency geht.

Empfehlung: In `saveSignalsFromDeps()` auf `null` pruefen und mit einer Meldung werfen, die den fehlenden Namen und die Gruppe nennt. Dieselbe Pruefung fuer den `group === undefined`-Fall in Zeile 157, den JavaScript-Konsumenten ohne Typpruefung erreichen koennen.

Evidenz aus dem Audit:

```
Probe F: createEffect(() => {}, ['doesNotExist'], {attach: g})
-> TypeError: Cannot read properties of undefined (reading 'id')
```

### [x] 8. link(): Registerhygiene und attach am Cache-Treffer

- Findings: BUG-004, BUG-007, MEM-002
- Ziel: `gLinks` hält Quellsignale nur noch schwach, ein fehlgeschlagenes `link()` hinterlässt keinen Eintrag, und ein gecachter Link wird zusätzlich an die neue Gruppe gehängt.
- Dateien: `src/link.ts`, `src/link.spec.ts`, `docs/api.md`, `docs/recipes.md`, `CHANGELOG.md`
- Modell: mittlere Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `fix(link): weak link registry, validated source, attach on cache hit (BUG-004, BUG-007, MEM-002)`
- Hash: `9cd2e86`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 308 passed / 6 skipped (Coverage 97,93 · 92,04 · 96,8 · 98,25, alle Gates gehalten), `pnpm test:gc` 314 passed.

**MEM-002 ging über den Planumfang hinaus.** Die WeakMap-Umstellung von `gLinks` allein behebt nichts: die Subscriptions im `SignalLink`-Konstruktor halten über ihre Closures `this` stark und darüber transitiv das Quellsignal — ein zirkulärer Pin, unabhängig von `gLinks`. Alle drei globalen Subscriptions (zwei in der Basisklasse, eine in `SignalLinkToSignal` auf `target.id`) laufen jetzt über `WeakRef(this)`. Dazu eine `FinalizationRegistry` in `link.ts`, damit `getLinksCount()` auch dann fällt, wenn ein Link nur weggeworfen und eingesammelt statt zerstört wird; `unregister`-Token ist der Link selbst, `heldValue` bewusst `undefined` — ein Held Value mit Link-Referenz hätte die Collection verhindert.

**Die Semantik von `link()` bleibt unverändert**, vom Reviewer eigens nachgeprüft: eine `WeakMap` hält ihren Wert stark, solange der Schlüssel erreichbar ist, und jeder Schreibpfad auf ein Signal führt über eine starke Referenz auf dessen `SignalImpl`. Also gilt: Quellsignal erreichbar ⇒ innere Map erreichbar ⇒ Link erreichbar ⇒ Propagation wie bisher. Ist das Quellsignal unerreichbar, kann niemand mehr `emit(globalSignalQueue, source.id, …)` auslösen — der eingesammelte Link hätte ohnehin nie wieder gefeuert. Fire-and-forget bleibt intakt. Der Zyklus Quellsignal → WeakMap-Wert → Link → `this.source` ist der klassische Ephemeron-Fall und wird korrekt aufgelöst.

BUG-004 nach Nutzerentscheidung: der gecachte Link wird zusätzlich an die neue Gruppe gehängt und stirbt mit der zuerst geräumten — beim `DESTROY` feuern beide `attach()`-Handler, der Link trägt sich aus allen Gruppen aus. BUG-007: Validierung vor jedem Registerzugriff, Reihenfolge Validierung → Konstruktion → `set()`, Meldung im Format `[signalize] link: …` passend zu Paket 7.

**Zwei Review-Runden, beide mit echtem Fund:**
- Runde 1: MEM-002 war nur für Callback-Links behoben — `SignalLinkToSignal` pinnte sich über `once(globalDestroySignalQueue, this.target.id, …)` weiterhin für die Prozesslaufzeit, während der CHANGELOG pauschal Reclaim versprach. Und der BUG-004-Fix hatte ein **neues** Leck eingeführt: `attach()` registrierte bei jedem Aufruf ein weiteres `once(this, DESTROY, …)`, eventize dedupliziert Funktions-Listener nicht (`isSimilarListenerType` schließt `LISTENER_IS_FUNC` vom Dedup-Index aus), also ließ ein `link(a, b, {attach: g})` pro Frame die Listener-Liste unbegrenzt wachsen. Behoben durch WeakRef in der Unterklasse und ein privates `#attachedGroups`-Set.
- Runde 2: der neue Wächter brach `detachLink()` gefolgt von `attach()` — dieselbe Gruppe stand noch im Set, `attach()` meldete Erfolg, ohne `group.attachLink(this)` erneut zu rufen, und `g.clear()` zerstörte den Link nicht mehr. Dasselbe BUG-004-Symptom durch eine schmalere Tür. Behoben durch Vorziehen von `group.attachLink(this)` vor die Wächterprüfung; der Wurf für einen zerstörten Link passiert weiterhin vor jeder Set-Mutation.

Alle Regressionstests per Rollback scharf gestellt. Der GC-Test liegt in `src/link.gc.spec.ts` und läuft nur über `pnpm test:gc`; er deckt beide Link-Typen ab, läuft bis `getLinksCount() === 0` statt bis zum ersten eingesammelten Link, und schließt mit `toBe(0)`.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- Ein eingesammelter Link lässt zwei bis drei tote No-op-Closures auf `globalSignalQueue` und `globalDestroySignalQueue` zurück, geschlüsselt auf Signal-Symbole, die nie wieder emittiert werden. Pro Waise O(1), aber unbegrenzt viele Waisen. Der vorhandene `gLinkFinalizer` könnte die Unsubscribe-Funktionen als Held Value tragen — die referenzieren den Link nicht — und beim Einsammeln mit abräumen.
- `destroy()` leert `#attachedGroups` nicht; ein zerstörter, aber noch referenzierter Link hält seine bereits geleerten Gruppen stark. Private Felder sind von `Object.freeze` nicht betroffen, ein Nullen wäre möglich.
- Standalone-Signale (`createSignal()` ohne `attach`) haben kein GC-basiertes Bookkeeping: wird ein Signal nie explizit zerstört, bleibt `getSignalsCount()` für die Prozesslaufzeit erhöht, auch wenn das Signal längst einsammelbar wäre. Der GC-Test umgeht das bewusst.
- Der Clamp `if (gLinksCount > 0)` verdeckt Buchführungsfehler, statt sie zu melden.

**Umsetzungshinweise**

- Alle drei sitzen in `src/link.ts`, zwei davon in derselben Funktion — ein Paket.
- MEM-002: äußere `Map` auf `WeakMap` umstellen (die Suche läuft ohnehin immer über das Quellsignal). `getLinksCount()` ohne Argument braucht dann einen separaten Zähler, der im vorhandenen `once(link, DESTROY, ...)`-Hook mitgeführt wird — hoch beim Anlegen, runter beim Destroy.
- BUG-007: `sourceSignal` zu Beginn prüfen und mit klarer Meldung werfen, bevor irgendein Registereintrag entsteht. Reihenfolge im Code: Validierung → Konstruktion → `set()`.
- Entscheidung 2026-08-06 zu BUG-004: den gecachten Link zusätzlich an die neue Gruppe anhängen statt `attach` zu verwerfen. Der Link stirbt dann mit der zuerst geräumten Gruppe — das gehört in die JSDoc von `LinkOptions.attach` und in `docs/api.md`.
- Tests zuerst rot sehen: (a) Probe E — 100 verwaiste Links, nach `globalThis.gc()` muss der Zähler fallen (gehört in die gc-Suite, `pnpm test:gc`); (b) `link(a,b,{attach:g1}); link(a,b,{attach:g2})`, dann `SignalGroup.delete(g2)` → der Link schreibt nicht mehr; (c) `link(notASignal, x)` wirft und `getLinksCount()` bleibt 0.
- Die gc-Suite läuft nur über `pnpm test:gc` (vitest.gc.config.ts) — ein Leak-Test in der normalen Suite würde stillschweigend übersprungen.

**BUG-004 · medium · src/link.ts:61-65** — link() liefert den Cache-Treffer und ignoriert die zweite attach-Gruppe

Existiert bereits ein Link von derselben Quelle zu demselben Ziel, kehrt `link()` vorzeitig mit der vorhandenen Instanz zurueck. Der Rueckweg liegt vor der Auswertung von `options.attach`, sodass die uebergebene Gruppe folgenlos bleibt. Wer den Link fuer die Lebensdauer einer zweiten Komponente anmelden will, bekommt eine Instanz, die an dieser Gruppe nicht haengt: das Aufraeumen der Gruppe zerstoert den Link nicht, er schreibt danach weiter. Kein Rueckgabewert und keine Warnung deuten darauf hin.

Empfehlung: Den zwischengespeicherten Link zusaetzlich an die neue Gruppe anhaengen, statt `attach` zu verwerfen. Alternativ bei abweichendem `attach` werfen, wenn Mehrfachbindung nicht gewuenscht ist.

Evidenz aus dem Audit:

```
Probe D: link(a,b,{attach:g1}); link(a,b,{attach:g2}) liefert dieselbe Instanz
-> nach SignalGroup.delete(g2) und a.set(42): b = 42, der Link lebt weiter
```

**BUG-007 · low · src/link.ts:60-74** — Fehlgeschlagenes link() hinterlaesst einen undefined-Schluessel im Register

`gLinks.set(sourceSignal, links)` steht vor der Konstruktion des Links. Ist die Quelle kein Signal, ist `sourceSignal` bereits `undefined`, der Eintrag wird trotzdem angelegt, und erst der `SignalLink`-Konstruktor wirft beim Zugriff auf `this.source.id`. Zurueck bleibt ein dauerhafter `undefined`-Schluessel mit leerer Map. Sichtbare Folgen hat das keine, `getLinksCount()` zaehlt korrekt null, es ist schlicht ein inkonsistenter Zustand nach einem Fehler.

Empfehlung: `sourceSignal` zu Beginn pruefen und mit einer Meldung werfen, die sagt, dass die Quelle ein Signal sein muss. Der Registereintrag entsteht dann gar nicht erst.

Evidenz aus dem Audit:

```
src/link.ts:68 gLinks.set vor der Konstruktion in :71-74
```

**MEM-002 · medium · src/link.ts:13-16** — Link-Register gLinks ist eine starke globale Map ohne Eviction

`gLinks` ist eine `Map` von `ISignalImpl` auf eine weitere `Map` mit den Zielen. Alle Referenzen sind stark: das Quellsignal, der Link, das Zielsignal und bei Callback-Links die Callback-Funktion samt ihrer Closure. Wird ein Link aufgegeben, ohne `unlink()`, ohne `attach` und ohne `destroySignal()` auf der Quelle, bleibt die gesamte Kette fuer die Prozesslaufzeit erhalten. Der Garbage Collector hat an dieser Stelle keinen Ansatzpunkt, auch dann nicht, wenn ausserhalb der Bibliothek keine einzige Referenz mehr existiert.

Empfehlung: Die aeussere Map auf `WeakMap` umstellen; die Suche erfolgt ohnehin immer ueber das Quellsignal. `getLinksCount()` ohne Argument braucht dann einen separaten Zaehler, der im vorhandenen `once(link, DESTROY, ...)`-Hook mitgefuehrt wird. Falls explizites Aufraeumen bewusst Vertragslage ist, gehoert das an prominenter Stelle in die Link-Doku (siehe Offene Fragen).

Evidenz aus dem Audit:

```
Probe E: 100x { const s = createSignal(i); link(s.get, () => {}) }, danach alle Referenzen fallengelassen
-> getLinksCount(): 0 -> 100, nach globalThis.gc(): unveraendert 100
```

### [x] 9. SignalLink: Subscriptions, Abbruch und Stream-Semantik

- Findings: MEM-004, ASYNC-004, ASYNC-005
- Ziel: `destroy()` lässt keine Listener auf der globalen Destroy-Queue zurück, `nextValue()` rejiziert mit einem Error und lässt sich abbrechen, parallele `asyncValues()`-Iteratoren stören einander nicht mehr.
- Dateien: `src/SignalLink.ts`, `src/SignalLink.spec.ts`, `docs/api.md`, `CHANGELOG.md`
- Modell: mittlere Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `fix(link): release destroy-queue listeners, abortable nextValue, shared retain (MEM-004, ASYNC-004, ASYNC-005)`
- Hash: `6b3cba8`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 327 passed / 6 skipped (Coverage 97,78 · 91,89 · 96,85 · 98,07, alle Gates gehalten), `pnpm test:gc` 333 passed.

**Neue API:**

```ts
nextValue(options?: {signal?: AbortSignal}): Promise<ValueType>
asyncValues(stopAction?: (value, index) => boolean, options?: {signal?: AbortSignal})
```

Abort wirft den `signal.reason` aus der `for await`-Schleife, Destroy beendet sie still — Destroy ist Lebenszyklus des Links, Abort eine vom Aufrufer angeforderte Stornierung, die nicht wie ein normales Ende aussehen darf.

**MEM-004:** ein privates `#releaseOnDestroy`-Array plus eine `protected releaseOnDestroy()`-Methode, weil private Felder für Subklassen unsichtbar sind. Seit Paket 8 sind es drei Subscriptions, nicht zwei. Der Reviewer hat in eventize nachgesehen und bestätigt, dass das die WeakRef-Konstruktion aus Paket 8 **nicht** aufhebt: `makeOnceUnsubscribe(host, obligation)` schließt ausschließlich über Queue und Obligation, kein Feld zeigt auf den Link. Die neue Kante geht vom Link weg, der Rückweg bleibt schwach, `src/link.gc.spec.ts` bleibt aussagekräftig.

**Der `kritisch`-Befund dieses Pakets** war der eleganteste des Laufs und hing an einer JavaScript-Feinheit: eventize spielt retained Werte **synchron beim Subscribe** ein (`once()` → `subscribeTo()` → `publishReplays()` läuft vor dem Return durch), und `subscriptions.push(a(), b())` wertet beide Argumente aus, bevor irgendetwas im Array landet. Feuerte der VALUE-Callback im Replay, iterierte `unsubscribe()` ein leeres Array — der danach registrierte DESTROY-Listener und der Abort-Listener wurden nie entfernt. Weil `retainClear` nur den Wert löscht und nicht die Retain-Policy, traf das ab dem zweiten Schleifendurchlauf **jede** Iteration von `asyncValues(stop, {signal})` und hängte unbegrenzt Abort-Listener an das Signal des Aufrufers. Die vier ursprünglichen ASYNC-004-Tests liefen grün darüber hinweg, weil sie alle einen frischen Link ohne retained Wert benutzten. Behoben durch Umstellung der Reihenfolge: `DESTROY` und der Abort-Listener werden vor `VALUE` subscribed und jeweils sofort einzeln gepusht.

Bewusst **nicht** auf eventizes `onceAsync(obj, names, {signal})` umgestellt. Das tragende Argument steht im Code: `onceAsync` *resolved* immer, DESTROY muss hier *rejecten*, und die einzige Unterscheidung wäre ein `result === this`-Vergleich, der bei einem Link kollidiert, dessen Wert der Link selbst ist. (Die zunächst genannte Begründung, `onceAsync` beobachte nur einen Event-Namen, war falsch — es reicht `eventNames` unverändert an `once()` weiter, das Arrays nimmt. Korrigiert.)

**Zwei Review-Runden.** Runde 1 fand den `kritisch` oben plus drei `wichtig` (ungetestetes `asyncValues({signal})`, Rejection-Wechsel als Bug Fix statt Breaking Change geführt, ein Test der Duplikat-Zustellung als Vertrag festschrieb) und sechs `klein`. Runde 2 fand zwei Reihenfolgen, in denen ein boolesches Flag eine Frage beantworten sollte, die es nicht kennt: `destroy()` gefolgt von `abort()` im selben synchronen Block ließ `asyncValues()` den Destroy-Fehler werfen, statt still zu enden, weil `signal.aborted` »wurde irgendwann abgebrochen« beantwortet und nicht »kam diese Rejection vom Abbruch«. Jetzt `err === options.signal.reason`. Dazu: `nextValue()` auf einem bereits zerstörten Link settelte nie — der Link ist eingefroren, DESTROY wird nie wieder emittiert, der Promise hing für immer. Jetzt ein `isDestroyed`-Guard vor den Subscribes.

`destroy()` sammelt Fehler pro Handle und führt den Teardown immer zu Ende, nach demselben Muster wie `EffectImpl.destroy()` aus Paket 3; die Duplikation ist bewusst, ein gemeinsamer Helfer zöge eine Importkante `SignalLink.ts → EffectImpl.ts`.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- Spiegelbild zur Abort-Unterscheidung: bricht das Signal ab, während der Generator am `yield` parkt, und wird der Link vor dem nächsten `.next()` zerstört, gewinnt die Schleifenbedingung und die Iteration endet still, obwohl abgebrochen wurde.
- Die K1-Absicherung ruht auf »nur VALUE kann inline feuern«. Ein userland `retain(link, DESTROY)` bricht das — der Link ist ein öffentliches eventize-Objekt. Ein `settled`-Flag im Executor, wie eventize es in `onceAsync` selbst verwendet, wäre reihenfolgeunabhängig.
- `retainClear` löscht nur den Wert, nicht die Retain-Policy. Nach dem letzten Iterator wird jeder weitere VALUE-Emit wieder eingelagert, und ein späteres `nextValue()` löst sofort mit dem alten Wert auf, statt auf den nächsten zu warten.
- Ein `for await (const v of con.asyncValues())` ohne `stopAction` und ohne weiteren Producer dreht nach dem ersten Wert in einer Microtask-Endlosschleife denselben retained Wert.
- Ein aufgegebener Async-Generator führt sein `finally` nie aus (Iterator-Protokoll, kein Bug dieser Bibliothek): `#activeAsyncValuesCount` fällt dann nie auf 0 zurück und `retainClear()` läuft für diesen Link nie wieder. In der JSDoc benannt.
- Ein werfender `stopAction` landet im `break`-Zweig und wird verschluckt.
- `emit(this, DESTROY)` steht vor `isDestroyed = true` — die Reihenfolge, die Paket 3 für `EffectImpl` umgedreht hat. Ein DESTROY-Listener, der `link.destroy()` erneut ruft, läuft am Guard vorbei.
- Die drei Fehlerpfade der S6-Sammlung sind ohne Whitebox-Eingriff in eventize nicht erzeugbar und deshalb ungetestet.

**Umsetzungshinweise**

- MEM-004: die Rückgabewerte der beiden `once(globalDestroySignalQueue, …)`-Aufrufe (Konstruktor Zeile 49, `SignalLinkToSignal` Zeile 167) in Feldern halten und in `destroy()` **vor** `Object.freeze(this)` aufrufen. Das Freeze in Zeile 117 ist der Grund, warum das nicht nachträglich geht.
- Entscheidung 2026-08-06 zu ASYNC-004: `reject(new Error('SignalLink destroyed before the next value arrived'))` **plus** ein optionales `{signal?: AbortSignal}` in `nextValue()` und `asyncValues()`. Ein bereits abgebrochenes Signal muss sofort rejizieren, und der Abort-Listener darf seinerseits nicht leaken.
- ASYNC-005: aktive Iteratoren zählen und `retainClear(this, VALUE)` erst ausführen, wenn der letzte beendet ist. Dass `retain` nur den zuletzt gesendeten Wert vorhält und Zwischenwerte verloren gehen, ist Semantik und wird in `docs/api.md` benannt, nicht wegprogrammiert.
- Tests zuerst rot sehen: (a) `getSubscriptionCount(globalDestroySignalQueue)` — Basis 0, nach `link()` 2, nach `link.destroy()` wieder 0; (b) `l.nextValue().catch(e => e)` nach `l.destroy()` liefert einen `Error` mit Message; (c) zwei parallele `asyncValues()`, der erste bricht ab, der zweite bekommt weiter Werte.
- Der Leak-Check aus CLAUDE.md ist hier Pflicht: Zählerstände vor dem Szenario schnappschussen, nach dem Destroy vergleichen. `unsubscribeEffect.spec.ts` ist die Referenz.

**MEM-004 · medium · src/SignalLink.ts:49 · src/SignalLink.ts:167** — SignalLink: once()-Listener auf der globalen Destroy-Queue ueberleben destroy()

Der Konstruktor registriert `once(globalDestroySignalQueue, source.id, () => this.destroy())`, die Signal-zu-Signal-Variante zusaetzlich dasselbe fuer `target.id`. `destroy()` loest jedoch nur die Subscription auf der Signal-Queue (`#unsubscribe`) und die Listener auf dem Link selbst (`off(this)`). Die beiden Destroy-Queue-Eintraege bleiben stehen und halten je eine Closure auf den bereits eingefrorenen Link, bis das jeweilige Signal zerstoert wird. Bei Links, die haeufiger auf- und abgebaut werden als ihre Signale, summiert sich das. Vormals LEAK-001.

Empfehlung: Die Rueckgabewerte der beiden `once()`-Aufrufe in Feldern halten und in `destroy()` vor `Object.freeze(this)` aufrufen, analog zum bestehenden `#unsubscribe`.

Evidenz aus dem Audit:

```
Re-Check LEAK-001: getSubscriptionCount(globalDestroySignalQueue)
-> Basis 0, nach link() 2, nach link.destroy() weiterhin 2
```

**ASYNC-004 · medium · src/SignalLink.ts:61-81** — nextValue() rejiziert ohne Grund und ist nicht abbrechbar

Wird der Link zerstoert, waehrend ein `nextValue()` aussteht, ruft der Destroy-Handler `reject()` ohne Argument. Der Aufrufer faengt `undefined`: kein Error, keine Message, kein Stack. In einem `catch`-Block ist damit nicht unterscheidbar, ob der Link zerstoert wurde oder etwas anderes schiefging; bleibt der Aufruf unbewacht, entsteht eine unbehandelte Rejection mit `undefined` als Grund. Eine Moeglichkeit, ein ausstehendes `nextValue()` abzubrechen, ohne den Link mit zu zerstoeren, gibt es nicht.

Empfehlung: `reject(new Error('SignalLink destroyed before the next value arrived'))`. Optional ein `AbortSignal` in der Signatur, das auch `asyncValues()` nutzen kann.

Evidenz aus dem Audit:

```
Probe M: l.nextValue().catch(e => ...); l.destroy()
-> catch erhaelt: undefined (typeof 'undefined')
```

**ASYNC-005 · low · src/SignalLink.ts:83-101** — asyncValues() verliert Zwischenwerte, parallele Iteratoren stoeren einander

`retain(this, VALUE)` haelt genau den zuletzt gesendeten Wert vor. Werte, die eintreffen, waehrend der Konsument zwischen zwei `next()` haengt, gehen bis auf den letzten verloren. Der Generator sieht damit ein Sample, keinen Stream. Zusaetzlich raeumt der `finally`-Block des zuerst beendeten Iterators mit `retainClear` die Zurueckhaltung fuer alle weiteren ab.

Empfehlung: Die verlustbehaftete Semantik in `docs/api.md` benennen, damit niemand einen lueckenlosen Stream erwartet. Aktive Iteratoren zaehlen und `retainClear` erst beim letzten ausfuehren.

Evidenz aus dem Audit:

```
src/SignalLink.ts:86 retain(this, VALUE) und :99 retainClear ohne Zaehlung
```

### [x] 10. SignalGroup: Zyklen und Named-Signal-Buchführung

- Findings: BUG-002, MEM-003
- Ziel: Ein zyklischer Gruppen-Graph wird abgelehnt statt den Stack zu sprengen, und ein wiederholt gebundener Name sammelt keine Signale mehr an.
- Dateien: `src/SignalGroup.ts`, `src/SignalGroup.spec.ts`, `docs/api.md`, `CHANGELOG.md`
- Modell: stärkste Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `fix(group): reject cyclic group graphs, prune named-signal bookkeeping (BUG-002, MEM-003)`
- Hash: `5388a34`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 339 passed / 7 skipped (Coverage 97,21 · 89,75 · 96,90 · 97,77, alle Gates gehalten), `pnpm test:gc` 346 passed.

**BUG-002 zweistufig.** Stufe 1: `attachGroup()` prüft die Elternkette mit Floyds Hase-und-Igel und wirft, bevor irgendetwas mutiert wird — sowohl bei einem echten Zyklus als auch bei einer bereits kaputten Kette, statt ewig zu laufen. Legitimes Umhängen unter einen früheren Geschwisterknoten bleibt erlaubt. Stufe 2 **weicht bewusst von der Empfehlung ab**: statt eines Visited-Sets ein privates Bitfeld `#busy`, ein Bit je Methode, gesetzt für die Dauer des Laufs, im `finally` gelöscht. Der Reviewer hat das nicht nur als äquivalent, sondern als in zwei Punkten besser abgenommen:

- Das Bit ist ein Gray-Marker (»liegt gerade auf dem Rekursionsstack«), kein Black-Marker (»wurde besucht«). Beim Diamanten — dieselbe Gruppe zweimal auf verschiedenen Wegen erreichbar, ganz ohne Zyklus — hätte ein Visited-Set den zweiten, legitimen Besuch geschluckt; das Bit ist zu dem Zeitpunkt längst gefallen.
- Es fängt einen Fall, den ein durchgereichtes Set nicht fängt: User-Code, der aus einem Listener heraus dieselbe Methode am Top-Level neu startet (`off()` aus dem OFF-Listener).

Getrennte Bits, damit sich Läufe verschiedener Art legitim schachteln dürfen. Der gefährliche Pfad — `clear()` aus dem FinalizationRegistry-Callback, wo ein `RangeError` von keinem `try/catch` des Anwendungscodes erreichbar ist — hat einen eigenen Test in `src/SignalGroup.gc.spec.ts`.

**MEM-003 mit zwei nachgeschärften Eigentumsregeln.** Ein Signal, das **nur** über `attachSignalByName()` in die Gruppe kam, gehört ihr: wird sein Name neu gebunden, ist es durch nichts mehr erreichbar und wird `destroySignal()`t, nicht bloß abgehängt. Ausgenommen bleiben `#directSignals` (zusätzlich per `attachSignal()` gebunden) und Signale, die noch einen weiteren Namen tragen. Der `attachSignalByName(name, undefined)`-Zweig geht an `detachSignal()` vorbei und ruft dieselbe private Freigabe wie der Rebind-Pfad — er löst genau diesen einen Namen, nicht alle Namen des Signals, und enteignet keine direkt angehängten Signale.

Das Zerstören räumt mehr auf als ein Detach: weil `createMemo` ein `once(globalDestroySignalQueue, sImpl.id, e.destroy)` registriert, reißt der Rebind den alten Memo-Effect gleich mit ab. Damit ist auch die Übergabe aus Paket 6 eingelöst — ein benanntes Memo mit `{attach}` im Effect-Rumpf sammelt sich nicht mehr an. Nebenbei erledigt: der Randfall eines in Ober- und Unterklasse doppelt deklarierten `@signal accessor`-Felds, dessen Basisklassen-Signal bisher gezählt liegenblieb.

**Zwei Review-Runden.** Runde 1 fand zwei `wichtig`: das per Rebind verdrängte Signal wurde nur detached und von niemandem zerstört, aus »Leck bis `clear()`« wurde »Leck für immer«; und der Undefined-Zweig enteignete über `detachSignal()` auch `#directSignals`-Signale und löste alle weiteren Namen desselben Signals mit — asymmetrisch zum erklärten Zweck von `#directSignals`. Runde 2 korrigierte zwei frisch geschriebene, falsche Aussagen: der Ratschlag in `docs/recipes.md`, ein Signal per `attachSignal()` zu schützen, gilt nur gruppenlokal — über Gruppengrenzen hinweg verschafft er der zweiten Gruppe das Zerstörungsrecht statt Schutz.

Drei bestehende Tests wurden migriert und vom Reviewer als saubere Migration bestätigt: die Assertions blieben unverändert, geändert wurde nur das Setup, weil die alten Setups dieselben Signale ausschließlich über Namen banden — also genau das, was MEM-003 als Bug beschreibt. Die Fallback-Logik in `detachSignal()` bleibt erhalten und getestet, ist aber von »Standardverhalten bei Namenskollision« auf »Ecke« geschrumpft; das steht so in `docs/recipes.md`.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- Die `#directSignals`-Ausnahme ist gruppenlokal, die Zerstörung nicht. Ein Signal, das Gruppe A besitzt und das in Gruppe B nur einen Namen trägt, wird von einem Rebind in B global zerstört — A merkt nichts. In `docs/recipes.md` benannt, aber nicht im Code abgesichert.
- Bindet jemand von Hand einen Namen neu, der zu einem `@signal accessor`-Feld gehört, zerstört der Rebind dessen Signal, während `findObjectSignalByName()` es weiter zurückgibt — der Accessor wird stumm zur Wertkiste.
- `destroySignal()` läuft im Schleifenrumpf und führt synchron Nutzercode aus. Bindet der denselben Namen währenddessen neu, löscht das nachfolgende `#namedSignals.delete(name)` die frische Bindung, während das frische Signal als Phantom-Kandidat in `#otherSignals` stehenbleibt. Kein Absturz, kein Leck, ein inkonsistenter Lookup.
- Kein Test für den `runEffects()`-Guard, obwohl er als einziger der drei stillen Guards über die öffentliche API erreichbar ist. Die Guards in `hasSignal()`/`signal()` sind seit Stufe 1 unerreichbar und bleiben zwangsläufig ungedeckt.
- Kein Test pinnt die auffälligste Folge der neuen Regel: ein externer Effect, dessen einzige Dependency das verdrängte Signal war, stirbt beim Rebind mit.
- Kein Test baut einen künstlich erzeugten Objektgraph-Zyklus — nach Stufe 1 ist über die öffentliche API keiner mehr konstruierbar, und `#groups` ist privat.
- Ein Listener, der während `clear()` eine andere Gruppe umhängt oder anhängt, mutiert `#groups` unter der Iteration.
- `off()` und `clear()` zerstören ihre Effects und Links weiterhin ungeschützt; ein werfendes Cleanup bricht die Schleife ab, und seit Paket 3 kann es ein `AggregateError` sein.
- `attachSignalByName(name, truthyNichtSignal)` wirft ein rohes `TypeError: Invalid value used as weak map key`.

**Umsetzungshinweise**

- BUG-002 zweistufig nach Empfehlung: (1) `attachGroup()` läuft die Elternkette hoch und lehnt einen Zyklus mit klarer Meldung ab, analog zum bestehenden `group === this`-Check; (2) `hasSignal()`, `signal()`, `runEffects()`, `off()` und `clear()` bekommen zusätzlich ein Visited-Set, damit ein auf anderem Weg entstandener Zyklus nicht dasselbe auslöst.
- Der gefährliche Pfad ist die FinalizationRegistry: sie ruft `group.clear()` aus dem GC-Callback, wo ein `RangeError` von keinem `try/catch` des Anwendungscodes mehr erreichbar ist. Der Visited-Set-Schutz in `clear()` ist deshalb nicht optional.
- MEM-003: beim Rebind eines Namens das vorherige Signal aus `#otherSignals` und `#signals` entfernen, sofern es nicht separat über `attachSignal()` gebunden wurde. Der `attachSignalByName(name, undefined)`-Zweig muss über `detachSignal()` für alle unter dem Namen geführten Signale laufen, damit »Name gelöst« und »Signale gelöst« nicht auseinanderlaufen. Die bestehende Fallback-Logik in `detachSignal()` (Rückfall auf den zuletzt eingefügten Vorgänger) bleibt erhalten.
- Achtung: `#signalKeys` ist eine WeakMap, `#otherSignals` eine Map — beide müssen konsistent bleiben.
- Tests zuerst rot sehen: (a) `a.attachGroup(b); b.attachGroup(a)` → wirft mit klarer Meldung; künstlich erzeugter Zyklus → `clear()` terminiert; (b) Probe H — 500× `attachSignalByName('slot', createSignal(i))`, danach `attachSignalByName('slot', undefined)` → `g.clear()` darf nicht 500 Signale zerstören.
- Die gc-Suite (`pnpm test:gc`) muss mitlaufen: der Absturz aus dem FinalizationRegistry-Callback ist genau dort reproduzierbar.

**BUG-002 · medium · src/SignalGroup.ts:151-164 · 237-250 · 309-316 · 370-404 · 410-448** — Zyklischer Gruppen-Graph sprengt den Stack, Absturz auch aus dem GC-Callback

`attachGroup()` prueft nur auf `group === this`. Zwei Gruppen, die einander gegenseitig anhaengen, bilden einen Zyklus, den keine der rekursiven Methoden erkennt: `hasSignal()`, `signal()`, `runEffects()`, `off()` und `clear()` laufen bis zum `RangeError`. Besonders unangenehm ist der Weg ueber die FinalizationRegistry: sie ruft `group.clear()` aus dem GC-Callback heraus, wo der `RangeError` von keinem `try/catch` des Anwendungscodes mehr erreichbar ist. Im Probelauf hat der Prozess genau daran quittiert, nachdem der eigentliche Test laengst durch war.

Empfehlung: In `attachGroup()` die Elternkette hochlaufen und einen Zyklus mit einer klaren Meldung ablehnen, analog zum bestehenden Selbstbezugs-Check. Ergaenzend die rekursiven Methoden mit einem Visited-Set absichern, damit ein auf anderem Weg entstandener Zyklus nicht denselben Effekt hat.

Evidenz aus dem Audit:

```
Probe T: a.attachGroup(b); b.attachGroup(a)
-> hasSignal RangeError, signal RangeError, runEffects RangeError, off RangeError, clear RangeError
-> danach zusaetzlich uncaught RangeError aus dem FinalizationRegistry-Callback
```

**MEM-003 · medium · src/SignalGroup.ts:205-230** — attachSignalByName sammelt jedes je gebundene Signal

Jede Bindung eines Namens legt das Signal zusaetzlich in `#otherSignals.get(name)` ab, damit `detachSignal()` spaeter auf einen Vorgaenger zurueckfallen kann. Dieses Set wird beim erneuten Binden desselben Namens jedoch nie beschnitten. Wer einen Namen wiederholt auf ein neues Signal legt, etwa beim Austauschen eines Slots an einer langlebigen Gruppe, laesst `#otherSignals` und `#signals` unbegrenzt wachsen. Der Else-Zweig fuer `attachSignalByName(name, undefined)` loescht ausserdem nur den Eintrag in `#namedSignals`: der Name gilt danach als nicht vorhanden, waehrend saemtliche Signale weiter an der Gruppe haengen.

Empfehlung: Beim Rebind das vorherige Signal aus `#otherSignals` und `#signals` entfernen, sofern es nicht separat ueber `attachSignal()` gebunden wurde. Den Undefined-Zweig ueber `detachSignal()` fuer alle unter dem Namen gefuehrten Signale fuehren, damit »Name geloest« und »Signale geloest« nicht auseinanderlaufen.

Evidenz aus dem Audit:

```
Probe H: 500x g.attachSignalByName('slot', createSignal(i)), danach attachSignalByName('slot', undefined)
-> hasSignal('slot') = false, g.clear() zerstoert dennoch 500 Signale
```

### [x] 11. batch(async fn) wird abgelehnt

- Findings: ASYNC-003
- Ziel: Ein Callback, der ein Thenable zurückgibt, führt zu einem klaren Fehler statt zu stillschweigend ungebatchten Writes.
- Dateien: `src/batch.ts`, `src/batch.spec.ts`, src/types.ts (falls die Signatur dort hängt), `docs/api.md`, `CHANGELOG.md`
- Modell: mittlere Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc`
- Commit: `fix(batch): reject async callbacks instead of silently unbatching (ASYNC-003)`
- Hash: `ec226a5` · Folge-Commit `d5b057c` (siehe unten)

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 342 passed / 7 skipped (Coverage 97,22 · 89,85 · 96,92 · 97,78, alle Gates gehalten), `pnpm test:gc` 349 passed. Zusätzlich `npx tsc --noEmit -p tsconfig.json` — in `src/` sauber.

Beide Teile der Empfehlung umgesetzt: Laufzeitprüfung auf Thenable mit `TypeError('[signalize] batch: …')` und die Signatur verengt auf `batch<T>(callback: () => NonThenable<T>): void` mit `NonThenable<T> = T extends PromiseLike<unknown> ? never : T`. Der Typ liegt in `src/types.ts`, weil er Teil einer öffentlichen Signatur ist und der `.d.ts`-Build sonst an TS4023 scheitern würde. Keine bestehende Aufrufstelle bricht — extern gegen `SignalAutoMap.ts`, `createMemo.ts` und `bench/` geprüft.

**Flush-Entscheidung:** die vor dem `await` angefallenen Writes werden geflusht, nicht verworfen. Sie sind real passiert, ihre Effects nicht zu flushen hieße nur, die App sichtbar veraltet stehen zu lassen, und es ist konsistent mit dem bestehenden Verhalten bei einem synchronen Throw im Callback.

**Grenzfall festgelegt:** ein synchroner Callback, der zufällig ein Objekt mit `then`-Property zurückgibt, wirft ebenfalls. Auf Typebene wird er nicht erfasst, weil `{then: () => void}` strukturell nicht zu `PromiseLike<unknown>` passt — genau dafür ist die Laufzeitprüfung da.

Die Entscheidung »`batch()` wirft« steht bewusst neben der Entscheidung aus Paket 4 »async-Effect-Fehler gehen an `onEffectError`«: hier steht der Aufrufer synchron da und kann den Fehler direkt bekommen, dort gibt es niemanden mehr, dem man ihn werfen könnte. Die Abgrenzung steht in der Doku.

Review-Runde 1, zwei `wichtig`: die Doku-Kette war unvollständig (`docs/recipes.md`, `docs/cheat-sheet.md` und `pitfalls.md` erwähnten `batch()`, aber nicht die Async-Ablehnung — für ein Finding, dessen Audit-Text lautet »das Ergebnis sieht funktionierendem Code zum Verwechseln ähnlich«, gerade die Stelle, die es braucht), und im CHANGELOG fehlte die Spiegelzeile unter `### Breaking Changes`, die vier vergleichbare Findings in diesem Lauf bekommen haben.

**Folge-Commit `d5b057c` — Regression dieses Laufs, nicht Teil von ASYNC-003.** Beim Verify ist aufgefallen, dass `pnpm compile` nur `tsconfig.lib.json` fährt, und das schließt Spec-Dateien aus; die Root-`tsconfig.json`, die sie einschließt, ruft kein einziges Script auf. Ein `npx tsc --noEmit -p tsconfig.json` meldete zwei Typfehler in Testdateien, die die Pakete 6 und 10 eingeschleppt hatten:

- `src/SignalGroup.spec.ts` — `ReturnType<typeof createSignal>[]` erbt den Default-Typparameter `unknown`, und `CompareFunc<number>` ist dazu nicht kontravariant.
- `src/createMemo.spec.ts` — impliziter `any`-Parameter im `onCreateEffect`-Callback.

Gegen die Baseline bei `914f153` geprüft: dort war die Root-Config in `src/` fehlerfrei. Beide repariert, reine Typannotationen, keine Testlogik berührt. Getrennt committet, damit die Historie zeigt, was Fix und was Korrektur ist.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- **Kein Script fährt die Root-`tsconfig.json`.** Damit sind Spec- und `bench/`-Dateien in `pnpm world` und in CI vollständig ungetypprüft. Die in JSDoc, `docs/api.md` und CHANGELOG dokumentierte Zusage »von `tsc` abgelehnt« ist real, aber durch keinen Lauf abgesichert — ein TypeScript-Upgrade könnte den Conditional-Type-Trick lautlos brechen, ohne dass ein Test rot würde. Derselbe blinde Fleck hat die beiden Typfehler oben durch zehn Pakete und ebenso viele Reviews getragen.
- `src/batch.ts` Zeilen 22-23 (Prioritäts-Insert in `Batch.batch()`) bleiben unter Branch-Coverage. Vorbestehend.

**Umsetzungshinweise**

- Audit-Empfehlung in zwei Teilen: (1) zur Laufzeit den Rückgabewert des Callbacks auf Thenable prüfen und mit klarer Meldung werfen; (2) die Signatur auf einen expliziten Nicht-Promise-Rückgabetyp verengen, damit der Fehler möglichst schon `tsc` auffällt.
- Der `finally`-Block muss den Batch auch im Wurf-Fall sauber schließen — `Batch.current` darf nicht gesetzt bleiben.
- `EffectImpl` hat mit `isThenable` bereits ein Prädikat; entweder wiederverwenden oder bewusst duplizieren. Achtung Modul-Layering: `batch.ts` darf nicht auf `EffectImpl.ts` zeigen (siehe CLAUDE.md, rollup bricht bei Zyklen).
- Test zuerst rot sehen: `batch(async () => { s.set(1); await Promise.resolve(); s.set(2) })` wirft; ein synchroner Callback, der zufällig ein Objekt mit `then`-Property zurückgibt, ist der Grenzfall — Verhalten bewusst festlegen und testen.

**ASYNC-003 · medium · src/batch.ts:86-103** — batch(async fn) hoert beim ersten await auf zu batchen

`batch()` typisiert den Callback als `VoidFunc`. Eine `async`-Arrowfunktion ist darauf zuweisbar, weil ihr `Promise`-Rueckgabewert gegen `void` nicht anschlaegt. Der `finally`-Block leert die Queue, sobald der Callback sein Promise zurueckgibt, also beim ersten `await`. Alle danach folgenden Writes laufen ungebatcht durch. Weder Typsystem noch Laufzeit sagen etwas dazu, und das Ergebnis sieht funktionierendem Code zum Verwechseln aehnlich.

Empfehlung: Nach dem Callback pruefen, ob der Rueckgabewert ein Thenable ist, und in dem Fall mit einer klaren Meldung werfen. Zusaetzlich die Signatur auf einen expliziten Nicht-Promise-Rueckgabetyp verengen, damit der Fehler moeglichst schon beim Kompilieren auffaellt.

Evidenz aus dem Audit:

```
Probe I: await batch(async () => { s.set(1); await Promise.resolve(); s.set(2); s.set(3) })
-> Effect lief 3x statt 1x
```

### [x] 12. Heiße Pfade: unnötige Allokationen und Batches

- Findings: PERF-001, PERF-002, PERF-004
- Ziel: Memo-Recompute, `findOrCreate()` und `updateFromProps()` zahlen nicht länger für Maschinerie, die sie nicht brauchen.
- Dateien: `src/createMemo.ts`, `src/SignalGroup.ts`, `src/SignalAutoMap.ts`, `bench/`, `CHANGELOG.md`
- Modell: mittlere Stufe
- Verify: `pnpm check && pnpm test && pnpm test:gc && pnpm bench`
- Commit: `perf: avoid throwaway allocations on hot paths (PERF-001, PERF-002, PERF-004)`
- Hash: `3d1c3fb`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 347 passed / 7 skipped (Coverage 97,03 · 89,38 · 96,92 · 97,58, alle Gates gehalten), `pnpm test:gc` 354 passed, `npx tsc --noEmit -p tsconfig.json` in `src/` sauber, `pnpm bench` ✓.

**Das Messinstrument war kaputt.** Der wichtigste Fund dieses Pakets betrifft Paket 1: `bench/memo.bench.ts` las die Quelle über `source.value` — den untracked Lesepfad. Das Memo hatte damit keine einzige Dependency, `source.set()` löste keinen RECALL aus, und der gemessene Loop betrat den Memo-Code nie. Der Beweis lag offen im Repo: »Memo-Recompute« meldete 13,89 Mio Hz, praktisch identisch mit »Signal-Write ohne Abnehmer« (13,69 Mio) und um ein Vielfaches über »Write mit einem Abnehmer« (2,88 Mio). Ein echter Recompute kann nicht schneller sein als ein Write mit einem Abnehmer. **Die im Abschnitt zu Paket 1 notierte Zahl »Memo-Recompute gegen gecachten Read Faktor 1,26« ist damit ungültig.** Repariert (`source.get()`), plus ein zweiter Fall mit einem vom Memo abhängigen Effect — nur dort läuft die Deferred-Dispatch-Maschinerie, um die es geht.

**Echte Messung, von mir selbst reproduziert:**

| Fall | mit Batch-Klammer | ohne (neuer Default) | Faktor |
| --- | --- | --- | --- |
| Memo-Recompute ohne abhängigen Effect | 774.753 Hz | 2.071.043 Hz | **2,67×** |
| Memo-Recompute mit abhängigem Effect | 486.828 Hz | 1.021.951 Hz | **2,10×** |
| `SignalGroup.findOrCreate` auf Cache-Treffer | 6.327.903 Hz | 18.859.414 Hz | **2,98×** |

Der reparierte Recompute liegt jetzt plausibel neben »Signal-Write mit einem Abnehmer«.

**PERF-001 wurde zum Korrektheitsfund.** Die Umsetzung folgt der Audit-Empfehlung wörtlich — neue Option `batchWrites?: boolean` auf `CreateMemoOptions`, Default `false`, also Batch nur öffnen, wenn er gebraucht wird. Der Reviewer fand dabei ein Argument, das im Audit nicht steht und stärker wiegt als die Performance: `EffectImpl.run()` stellt **jeden** Run zurück, solange ein Batch offen ist, und `createMemo` hängt `beforeRead = e.run`. Liest ein Memo-Callback innerhalb der Klammer ein anderes, noch nicht neu berechnetes Memo, wandert dessen Recompute in den Batch und der Lesevorgang bekommt den **alten** Wert. Bei einem lazy Memo ist das dauerhaft, weil `[RECALL]` nur `shouldRun` setzt und `autorun` false bleibt. Belegt mit einem deterministischen Test: mit `{batchWrites: true}` liefert ein eager Memo über einem lazy Memo nach `dep.set(2)` dauerhaft `12` statt `22`. Die Kausalkette ist bis in eventizes Tie-Break-Regel nachgerechnet (`sortByPriorityAndId` sortiert bei gleicher Priorität nach Registrierungsreihenfolge).

Beide Defaults haben also eine Glitch-Klasse, und die neue ist die seltenere: `batchWrites: false` lässt einen Downstream-Effect zweimal laufen, wenn der Memo-Callback selbst weitere Signale schreibt — der erste Lauf mit zerrissenem Snapshot. `batchWrites: true` liefert beim Lesen eines dirty Memos einen stale Wert. Komponierte Memos sind Normalgebrauch, side-effect-schreibende Memo-Callbacks nicht. Beide Richtungen sind getestet, dokumentiert und über die Option umschaltbar.

PERF-002 in `SignalGroup.findOrCreate()` ist als semantisch äquivalent zum Konstruktor-Pfad bestätigt und mit dem Umbau aus Paket 10 verträglich — kein Pfad erzeugt eine Gruppe mehr oder weniger als vorher, die `instanceof`-Kurzschlüsse bleiben intakt, der Konstruktor-Trick bleibt als Absicherung. PERF-004 ist exakt der Guard, den `update()` schon hatte.

Review-Runde 1 fand den `kritisch` oben plus vier `wichtig` (fehlende Warnung zum Preis von `batchWrites: true`, eine durch den Fix falsch gewordene Zusage in `docs/api.md`, komplett fehlende Doku-Kette für die neue Option, kein Test für den eigentlichen Vorteil) und korrigierte nebenbei eine im Report behauptete Thenable-Regression, die es nicht gibt: die alte Klammer hatte einen Block-Body, die Prüfung aus Paket 11 sah nie den Rückgabewert des Memo-Callbacks. Runde 2 zog drei Einzeiler nach, darunter ein Doku-Snippet, das eine nirgends deklarierte Variable benutzte.

Nebenbefunde fürs nächste Audit, nicht Teil dieses Laufs:
- Die Prime-Zeile `expect(inner()).toBe(10)` im Stale-Read-Test ist kausal notwendig — sie legt die Queue-Reihenfolge `inner` vor `outer` fest. Stünde `outer` vorn, käme auch ohne Batch erst 12 heraus, weil `run()` an `!shouldRun` abbricht. Jetzt im Kommentar benannt, aber strukturell fragil.
- `bench/signal-group.bench.ts` erzeugt im »create new group«-Fall pro Iteration eine Gruppe, die in `allGroups` und der FinalizationRegistry hängenbleibt; das Set wächst über die Bench-Dauer monoton und verzerrt die Messung nach hinten. Vorbestehend aus Paket 1.
- `skills/using-signalize/references/pitfalls.md` kennt im Memo-Abschnitt weiterhin nur Pitfall 12 (eager vs. lazy). Der `batchWrites`-Stale-Read ist ein Pitfall in Reinform und steht bislang nur in `references/api.md`. Verwandt und ebenfalls nirgends notiert: dass ein Lesezugriff auf ein dirty Memo aus einem User-`batch()` heraus denselben alten Wert liefert.
- `src/SignalGroup.ts` liegt bei 81,13 % Branch-Coverage, am unteren Ende der Dateiwerte.

**Umsetzungshinweise**

- Gemeinsame Ursache: bedingungslose Arbeit auf Pfaden, die sie meist nicht brauchen. Paket 1 hat die Messwerte geliefert — der Report des Subagenten nennt Vorher/Nachher aus `pnpm bench`.
- PERF-001: im Memo-Effect direkt `si.set(callback())` schreiben und den Batch nur öffnen, wenn er gebraucht wird. Audit misst Faktor 3,5× (185 ms gegen 53 ms bei 200 000 Updates). Achtung: schreibt der Memo-Callback selbst mehrere Signale, war die Klammer bislang der Schutz — das Verhalten dieser Fälle muss durch einen Test abgedeckt sein, bevor die Klammer fällt.
- PERF-002: in `SignalGroup.findOrCreate()` zuerst `store.get(object)` abfragen und nur bei einem Fehltreffer konstruieren. Der `return object`-Trick im privaten Konstruktor bleibt als Absicherung erhalten, trägt aber nicht mehr die Hauptlast. Die `object instanceof SignalGroup`-Kurzschlüsse in `get()` und im Konstruktor beachten. Audit misst Faktor 10×.
- PERF-004: `updateFromProps()` bekommt denselben Guard wie `update()` — Einträge vor dem Batch ermitteln, bei Länge 0 direkt zurückkehren.
- Paket 10 hat `SignalGroup.ts` bereits angefasst; auf dem aktuellen Stand arbeiten, nicht auf dem Zeilenstand des Audits.

**PERF-001 · medium · src/createMemo.ts:52-57 · src/batch.ts:33-62** — Jeder Memo-Recompute zahlt die volle Batch-Maschinerie

Der Memo-Effect umschliesst sein einzelnes `si.set(callback())` mit `batch()`. Laeuft der Recompute ausserhalb eines bestehenden Batches, entsteht dafuer jedes Mal eine `Batch`-Instanz, und `Batch.run()` legt zusaetzlich ein `Set` sowie ein Array an und meldet zwei Listener auf globalen Queues an und wieder ab. Fuer genau einen Write. Die Klammer ist nur dann noetig, wenn der Memo-Callback selbst mehrere Signale schreibt, was der Normalfall nicht ist.

Empfehlung: Direkt schreiben und den Batch nur dann oeffnen, wenn er gebraucht wird, etwa gesteuert ueber eine Option. Alternativ die Batch-Instanz poolen, damit zumindest die Allokation entfaellt.

Evidenz aus dem Audit:

```
Probe U, 200 000 Updates:
  Memo mit Batch-Klammer: 185 ms
  aequivalenter Effect ohne Batch: 53 ms
  Faktor 3,5x
```

**PERF-002 · medium · src/SignalGroup.ts:93-98 · 126-144** — SignalGroup.findOrCreate() allokiert bei jedem Cache-Treffer eine Wegwerf-Instanz

`findOrCreate()` ruft bedingungslos `new SignalGroup(object)`. Die Feld-Initialisierer laufen vor dem Konstruktorrumpf, also entstehen vier Sets, zwei Maps und eine WeakMap, bevor der Rumpf ueberhaupt bemerkt, dass es die Gruppe bereits gibt und die vorhandene zurueckgibt. Die frisch gebaute Instanz wird verworfen. Die Funktion liegt auf dem heissen Pfad von `createSignal({attach})`, `createEffect({attach})`, `link({attach})` und jedem `@signal`-Init.

Empfehlung: In der statischen Methode zuerst `store.get(object)` abfragen und nur bei einem Fehltreffer konstruieren. Der Konstruktor-Trick bleibt als Absicherung erhalten (siehe ARCH-003), traegt dann aber nicht mehr die Hauptlast.

Evidenz aus dem Audit:

```
Probe V, 200 000 Lookups auf dieselbe Gruppe:
  findOrCreate: 21 ms
  SignalGroup.get: 2 ms
  Faktor 10x
```

**PERF-004 · low · src/batch.ts:33-62 · src/SignalAutoMap.ts:111-123** — batch() um einen einzelnen Write kostet das Sechsfache; updateFromProps ohne Size-Guard

Ein `batch()` um genau einen Write kostet das Sechsfache des rohen Writes. Das ist fuer den bewussten Einsatz durch Konsumenten unerheblich, faellt aber dort ins Gewicht, wo die Bibliothek selbst bedingungslos klammert. `SignalAutoMap.update()` prueft immerhin `props.size` vor dem Batch, `updateFromProps()` tut das nicht und oeffnet auch fuer ein leeres Objekt einen vollstaendigen Batch.

Empfehlung: `updateFromProps()` denselben Guard geben wie `update()`, also die Eintraege vor dem Batch ermitteln und bei Laenge null direkt zurueckkehren. Siehe auch PERF-001 fuer die gleiche Klammer im Memo-Pfad.

Evidenz aus dem Audit:

```
Probe W, 200 000 Writes:
  roh: 42 ms
  je in batch() geklammert: 251 ms
  Faktor 6x
```

### [x] 13. Doku: Grenzen der automatischen Gruppen-Bereinigung

- Findings: MEM-006
- Ziel: Die Bedingung, unter der die FinalizationRegistry eine Gruppe überhaupt einsammeln kann, steht in der Doku, statt als stille Annahme im Code.
- Dateien: `docs/architecture.md`, `docs/recipes.md`, `skills/using-signalize/`, README.md (falls dort erwähnt), `CHANGELOG.md`
- Modell: günstigste Stufe
- Verify: `pnpm check`
- Commit: `docs(group): document when automatic group cleanup cannot fire (MEM-006)`
- Hash: `d2884eb`

**Ergebnis** — Verify selbst gelaufen: `pnpm check` ✓, `pnpm compile` ✓, `pnpm bundle` ✓, `pnpm test` 347 passed / 7 skipped, `pnpm test:gc` 354 passed. Reines Doku-Paket, keine Teständerung erwartet und keine eingetreten.

Die technische Begründung steht in `docs/architecture.md` (Kette `allGroups` → Gruppe → `#signals` → Signalwert → Host-Objekt), der praktische Hinweis in der Decorator-Sektion derselben Datei und in `skills/using-signalize/references/api.md`, mit dem Beispiel `@signal() accessor self = this`. Kürzere Varianten in `docs/api.md`, `docs/recipes.md` und `README.md`. Der Reviewer hat die Kette gegen den Stand nach Paket 10 und 12 verifiziert und bestätigt, dass `SignalGroup.delete()` und `clear()` tatsächlich leisten, was der Text ihnen zuschreibt.

Review-Runde 1, zwei `wichtig`:
- In `docs/recipes.md` war beim Umformulieren die Zuordnung verrutscht: »best-effort, non-deterministic« hing plötzlich am expliziten Cleanup statt an der FinalizationRegistry und behauptete damit das Gegenteil der Kernaussage.
- `docs/recipes.md` und `README.md` benannten die Blockade **exklusiv** über den Signalwert. Tatsächlich hält die Gruppe auch ihre Effects und Links stark, und `EffectImpl.callback` hält deren Closure — ein `createEffect(() => render(this.health.get()), {attach: this})` blockiert die Registry genauso, ohne dass ein einziger Signalwert auf `this` zeigt. Das Beispiel drei Zeilen über der Aussage zeigte genau diesen Fall. Beide Stellen auf »jeder starke Pfad zurück zum Host« verallgemeinert, mit Signalwert und Effect-Closure als den zwei Beispielen.

Keine Doppelungen, keine Widersprüche zu dem, was die Pakete 6, 10 und 12 an denselben Dateien geschrieben haben.

Nebenbefund fürs nächste Audit: `skills/using-signalize/references/pitfalls.md` führt diesen Fall nicht, obwohl er ein Pitfall in Reinform ist — die Aussage steht bislang nur in `references/api.md`.

**Umsetzungshinweise**

- Reines Doku-Paket — die Audit-Empfehlung ist ausdrücklich Dokumentation, kein Codefix. Ein starker Pfad von der Gruppe zurück zum Schlüsselobjekt ist mit WeakRef und FinalizationRegistry technisch nicht auflösbar.
- Kernaussage: `allGroups` hält die Gruppe stark, die Gruppe ihre Signale, das Signal seinen Wert. Referenziert ein attachtes Signal das Host-Objekt, wird dieses nie eingesammelt und die Registry feuert nie. Messung: 200 Gruppen ohne Rückreferenz fallen auf 1, mit `createSignal(host)` bleiben es 201.
- Für `@signal accessor`-Felder mit Rückreferenz auf das eigene Objekt ist das die Normalform. Der wirksamste Ort für den Hinweis ist deshalb die Decorator-Doku; `docs/architecture.md` bekommt die technische Begründung.
- Verlässlicher Weg bleibt explizites `SignalGroup.delete(obj)` oder `group.clear()` im Teardown — das gehört so benannt.

**MEM-006 · medium · src/SignalGroup.ts:13-30 · src/SignalGroup.ts:55-72** — Selbstreferenzierender Signal-Wert hebelt die FinalizationRegistry aus

Die Aufraeummechanik ist sauber gebaut: `store` ist eine WeakMap, `#storeKey` eine WeakRef, und die FinalizationRegistry ruft `group.clear()`, sobald das Nutzerobjekt unerreichbar wird. Sie setzt aber voraus, dass von der Gruppe kein starker Pfad zurueck zum Schluesselobjekt fuehrt. Genau den legt jedes attachte Signal an, dessen Wert das Host-Objekt referenziert: `allGroups` haelt die Gruppe stark, die Gruppe ihre Signale, das Signal seinen Wert. Damit wird das Objekt nie eingesammelt, die Registry feuert nie, und `allGroups` waechst unbegrenzt. Fuer `@signal accessor`-Felder mit Rueckreferenz auf das eigene Objekt ist das die Normalform, nicht der Sonderfall.

Empfehlung: Die Bedingung in `docs/architecture.md` benennen: die automatische Bereinigung greift nur ohne Rueckreferenz, explizites `SignalGroup.delete(obj)` oder `group.clear()` im Teardown bleibt der verlaessliche Weg. Ein Hinweis in der Decorator-Doku waere der wirksamste Ort.

Evidenz aus dem Audit:

```
Probe S mit Kontrollgruppe, je 200 Gruppen, zwei erzwungene GC-Runden:
  ohne Rueckreferenz: 200 -> 1 (Registry raeumt ab)
  mit createSignal(host): 201 -> 201 (Registry feuert nie)
```

