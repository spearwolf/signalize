# Remediation-Plan — @spearwolf/signalize

Quelle: `./audit.html` vom 2026-08-08 (Folgeaudit zum 2026-08-07) · Branch: `main` · erstellt: 2026-08-09 · **Stand: 2026-08-11**
Scope: **71 von 125 Findings** — 2 critical, 17 high, 52 medium. Dazu **Paket 31** (zwei `high`-Befunde außerhalb des Audits, in Paket 7b am Code gefunden) und **Paket 32** (ein Nebenbefund aus Paket 7a), beide vom Nutzer in den Lauf aufgenommen.
Ausgenommen: 43 `low` und 11 `info` — vom Nutzer nicht beauftragt. `acknowledged` im Audit: leer.

Vorgabe des Nutzers: die drei Gates aus dem Optimierungsteil werden zuerst geschlossen — **BUILD-003**, **BUILD-002**, **BUILD-015**. Alle drei sind erledigt.

---

## ÜBERGABE — hier weitermachen

**Für einen frischen Agenten ohne Vorwissen.** Dieser Abschnitt sagt, wo der Lauf steht und wie er fortgesetzt wird. Er ist die einzige Stelle, die du zuerst vollständig lesen musst; alles Weitere steht bei den Paketen.

### Wie du weiterarbeitest

Der Lauf folgt dem Skill **`js-ts-audit-remediation`**. Ruf ihn auf, bevor du irgendetwas anfasst — er liefert den Ablauf, und `references/execution.md` beschreibt die sechs Züge je Paket. Die Kurzfassung:

1. **Zug 0 — Paket-Planer** (eigener Subagent, stärkste Stufe): gleicht die Findings des Pakets gegen den *heutigen* Code ab, schreibt den Detailplan in den Paketblock. Die Zeilennummern aus `audit.html` sind nach 25 Commits vielfach verrutscht; **verlass dich nie auf sie**.
2. **Zug 1/2 — Implementierer** (eigener Subagent, Modellstufe steht im Paketblock): setzt um, committet **nicht**, meldet nach festem Rückgabevertrag.
3. **Zug 3 — Reviewer** (eigener Subagent): bekommt einen Diff als Datei, urteilt über Erfüllung je Finding-ID und über Qualität.
4. **Zug 4 — Fehlerkette**: kritische und wichtige Befunde lösen eine Runde aus, kleine wandern in den Plan.
5. **Zug 5 — Verify und Commit**: **du selbst** fährst `pnpm world` und liest die Ausgabe; der Report eines Subagenten ist keine Evidenz. Dann `git add <Pfade>` + `git commit --no-gpg-sign`, danach **sofort** den Paketblock fortschreiben.

**Der Orchestrator schreibt keinen Projektcode.** Auch nicht für einen Einzeiler.

### Nächstes offenes Paket: **18**

Danach in Dokumentreihenfolge: 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30. **13 Pakete offen, 24 erledigt.**

### Baseline — heute, nicht bei Lauf-Beginn

`pnpm world` in allen neun Schritten grün, auf `8281c28`:

| | bei Lauf-Beginn | heute |
| --- | --- | --- |
| Spec-Dateien / Tests | 44 / 478 | **45 / 552** |
| Coverage (Stmts / Branch / Funcs / Lines) | 98,86 / 93,73 / 99,53 / 99,36 | **99,33 / 95,35 / 99,57 / 99,46** |
| ungedeckte Einheiten | — | **8 / 24 / 1 / 6** |
| npm-Tarball | 125 Dateien / 570,6 kB | **45 Dateien / 493,8 kB** |

**Vorbestehende Fehler: keine.** Die Baseline war zu Beginn grün und ist es nach jedem Paket geblieben. Jeder rote Lauf ab hier gehört dem Paket, das ihn ausgelöst hat.

Zwei Zahlen sind ab jetzt der eigentliche Maßstab, nicht die Coverage-Prozente: die **Testzahl** und die **ungedeckten Einheiten** (8 / 24 / 1 / 6). Bei einem Refactor oder einem Performance-Paket müssen beide stehenbleiben; bewegen sie sich, ist die behauptete Äquivalenz verletzt. Die Prozente dagegen dürfen sich bewegen, sobald Zeilen dazukommen.

### Was erledigt ist

25 Commits seit `12879f7`. Jeder Paketblock trägt seinen Hash und einen `- Ergebnis`-Abschnitt mit Messwerten, Review-Befunden und Nebenbefunden.

| Phase | Pakete | Findings |
| --- | --- | --- |
| 1 — Prüfkette | 1, 2, 3, 4, 5, 6 | BUILD-003, BUILD-002, BUILD-010, BUILD-015, BUILD-016, BUILD-001, BUILD-006, ARCH-004, BUILD-004, BUILD-011, BUILD-005, BUILD-007, BUILD-009 |
| 2 — Testnetz | 7a, 7b, 7c1, 7c2, 8, 9, 10, 32a, 32b | TEST-017, TEST-016, TEST-021, TEST-018, TEST-019, TEST-020, TEST-023, TEST-024, TEST-025 (+ Paket 32 ohne Finding) |
| 3 — Korrektheit | 11, 12, 13a, 13b, 31, 14, 15, 16 | ASYNC-005, READ-002, TEST-022, ASYNC-001, BUG-012, READ-001, BUG-011, MEM-008, MEM-009, MEM-010, MEM-011, CONS-006, ASYNC-002, ASYNC-003, API-014, CONS-007 (+ P1/P2 ohne Finding) |
| 3b — Hot Path | 17 | PERF-001, PERF-002, PERF-003 |

**38 der 71 Findings sind geschlossen**, darunter **beide `critical`** und **13 der 17 `high`**. Offen sind 33 Findings in 13 Paketen.

### Was noch offen ist

| Paket | Findings | Worum es geht |
| --- | --- | --- |
| 18 | PERF-008 (high) | Isolations-Frame nur öffnen, wenn es Subscriber gibt |
| 19 | PERF-004 | Collections der `SignalGroup` lazy anlegen |
| 20 | TYPE-001 (high), TYPE-003 | `any`-Defaults raus aus der Typfläche |
| 21 | TYPE-002, TYPE-004, TYPE-005 | Drei Typlügen |
| 22 | API-001 (high), API-002 (high), API-003 (high), API-004 | Effect-Oberfläche benutzbar machen |
| 23 | API-006, API-007, API-008 | Signal- und Link-Oberfläche schmal halten |
| 24 | CONS-001 | Ein Diagnosekanal statt dreier |
| 25 | ARCH-003 (high), ARCH-001 | Modulgraph und Multi-Bundle-Sentinel |
| 26 | ARCH-002 | `createSignal` von `effects` entkoppeln |
| 27 | READ-011 | `EffectImpl.run()` zerlegen |
| 28 | API-005, API-009, API-010, API-015 | API-Doku |
| 29 | READ-009, READ-010, READ-012, CONS-010 | Zahlen und Kommentare, die nicht mehr gelten |
| 30 | CONS-008, CONS-009, API-016 | CHANGELOG |

### Auflagen, die zwischen Paketen hängen

Diese Zusagen sind in erledigten Paketen entstanden und binden ein noch offenes. Sie stehen jeweils auch im Zielblock, hier zur Übersicht:

- **Paket 18** trägt **zwei harte Auflagen aus 13b**. Erstens: es sind **zwei** Zähler, nicht einer — `writeSignal()` stellt auf `globalSignalQueue` zu, `destroySignal()` auf `globalDestroySignalQueue` mit fünf Abonnentensorten. Empfehlung des 13er-Planers: PERF-008 auf `writeSignal()` beschränken. Zweitens, und das ist die harte Grenze: **ein zu niedrig stehender Zähler spart nicht bloß eine Optimierung, er stellt BUG-011 wieder her**, weil `collectDeliveryError()` dann `false` liefert und der Listener sofort wirft. Dazu die Auflage aus 13b, den dort bewusst weggelassenen Guard `if (!collectDeliveryError(err)) throw err;` in `signal-core.ts` **hier** einzuziehen — er war dort unerreichbar und hätte die Branch-Schwelle gerissen; sobald die Frame-Eröffnung bedingt wird, ist er nötig und testbar.
- **Paket 22** (API-008, `destroyed`-Getter an `Effect`): erst damit greift der in Paket 14 eingezogene Wächter in `attachEffect()` auch für den öffentlichen `Effect`-Wrapper — heute ist die Methode auf `EffectImpl` typisiert, während Cheat-Sheet und Skill-Referenz den Wrapper zeigen.
- **Paket 27** (`EffectImpl.run()` zerlegen) ist bewusst der **letzte** Eingriff in diese Datei. Paket 15 hat `#run(immediate)` und `runImmediately` eingeführt, Paket 17 den `isFlushingBatch()`-Guard; die Zeilenangaben aus dem Audit sind dort um mehr als hundert Zeilen verschoben.
- **Paket 29** erbt eine Liste veralteter Zahlen und Verweise, die über den Lauf gewachsen ist: `AGENTS.md` (Zeilenverweise auf `vitest.config.ts`), `README.md` und `CLAUDE.md` (`pnpm`-Version), `AGENTS.md` (Peer-Dep `eventize ^5.0.0` gegen `^6.0.0`), `npm-run-all2`-Engines, `src/SignalGroup.ts` (überlange JSDoc-Zeile), `vitest.config.ts` (Meldung im Singular), Finding-Id-Kollisionen (`PERF-001` in `createMemo.spec.ts`, `PERF-004` in zwei Bench-Dateien) und der Umstand, dass `bench/` **keinen** Fall mit leerer Warteschlange enthält.
- **Paket 30** erbt die CHANGELOG-Kollision: `PERF-001` bezeichnet im `## Unreleased`-Block zwei verschiedene Dinge.

### Umgebung — drei Fallen, die den Lauf schon Zeit gekostet haben

- **Kein `git worktree` im Scratchpad.** Eines hat seinen Pfad als `virtualStoreDir` in `node_modules/.modules.yaml` hinterlassen; danach brach `pnpm world` mit `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` ab, **bevor irgendein Schritt lief**. Reparatur: `CI=true pnpm install --frozen-lockfile`, Lockfile bleibt unberührt.
- **Jeder Subagent legt ein eigenes Unterverzeichnis im Scratchpad an.** Zweimal haben sich Hilfsskripte gegenseitig überschrieben, einmal unbemerkt: Mutationsproben liefen als Traceback durch und meldeten trotzdem grün.
- **Bench-Läufe brauchen ein Protokoll.** Blockweise Läufe verschieben Nachbarfälle — in `memo.bench.ts` um 29 Prozentpunkte, bis ein unberührter Kontrollfall verschlechtert aussieht. Dort verschränkt A/B messen, Median aus 3 bis 5. In `signal-write.bench.ts` trägt die Drift **nicht**, dort ist blockweise ruhiger. Und eine Zahl, die in einem Aufbau außerhalb des Repos entstand, wird als solche gekennzeichnet — sonst ist sie beim nächsten Lesen eine Fiktion.

### Was dieser Lauf am Audit korrigiert hat

Mehrfach war die Empfehlung des Audits am Code widerlegt. Ein Planer, der sie wörtlich umsetzt, baut ins Leere:

- **BUG-011**: der empfohlene Isolations-Frame allein repariert **nichts** — der Frame sammelt, er fängt nicht. Es braucht zusätzlich ein `catch` im Listener.
- **BUILD-005**: `"lib": ["ES2023", "DOM"]` ist ein No-Op, `tsconfig.json` führt DOM längst.
- **BUILD-007**: `sourcesContent` in einer `.d.ts.map` ist technisch nicht herstellbar, `tsc` kennt keinen Schalter dafür.
- **TEST-018**: die empfohlene `runEffects()`-Route über einen `DESTROY`-Listener erreicht ihr `BUSY_*`-Bit **nie**.
- **BUILD-009**: Node 24 ist für den Build gar nicht nötig.
- **TEST-021**: die Begründung (»über `createEffect({attach})` in einer Schleife trivial erreichbar«) ist falsch — `attachEffect()` läuft genau einmal je Effect.
- **READ-001**: es sind zehn Vorkommen in `clear()`/`off()`, nicht neun, und die `location`-Zeile zeigt auf vier Stellen ohne das Idiom.

Zweimal stand außerdem eine Zusage in der **ausgelieferten Doku**, die der Code nicht hielt — einmal versprach sie zu viel (`destroySignal()` isoliere »jeden Abonnenten«), einmal verschwieg sie den einzigen Workaround (ein Upstream-Read weckt eine veraltete Memo-Kette). Beide sind korrigiert.

---

## Vorbestehende Fehler

Keine. Die Baseline ist auf ganzer Linie grün; jeder rote Lauf ab hier gehört dem Paket, das ihn ausgelöst hat.

## Entscheidungen

Aus der Klärungsrunde vom 2026-08-09:

- **BUILD-009**: `engines.node` auf `>=22`. Node 22 steht bis 2027 im LTS-Fenster. `CLAUDE.md`, `README.md:91` und `docs/quickstart.md:10` werden mitgezogen; ist Node 24 für den Build nötig, steht das in `CONTRIBUTING.md`, nicht in `engines` (2026-08-09)
- **ARCH-001, ARCH-002, READ-011**: alle drei L-Umbauten werden umgesetzt, nicht wegdokumentiert (2026-08-09)
- **API-Fläche schmal halten** (2026-08-09) — API-003: `setMaxEffectDepth()`/`getMaxEffectDepth()` statt `EffectImpl`-Export · API-006: `$signal` bleibt intern, die Doku sagt das auch · API-007: schmale `LinkSource`-Sicht, `ISignalImpl` raus aus den öffentlichen Typexporten · API-008: `destroyed`-Getter an `Signal` und `Effect`
- **Paket 31, Rollback bei `{attach}`: bedingt, nicht unbedingt** (2026-08-10). Der Planer hatte einen unbedingten Rollback vorgesehen und die Folge selbst gemessen: ein `{attach}`-Effect, dessen erster Lauf wirft, überlebte bisher in der Gruppe und lief beim nächsten Write wieder (`runs` 1 → 2). Das ist kein Leck — die Gruppe hält ihn —, und `docs/api.md:111-116` sowie `docs/recipes.md:249` sagen ausdrücklich zu, der Effect bleibe nach einem werfenden Callback benutzbar. Der Nutzer hat entschieden: **der Rollback läuft nur, wenn kein Halter existiert.** `options.attach != null` steht an der Stelle fest. Damit hält die dokumentierte Zusage, das Leck ist trotzdem zu, und die zugehörige Breaking-Changes-Zeile entfällt. Dass das Verhalten an einer Option hängt, gehört in die JSDoc.
- **Paket 16, CONS-007: der Wächter gilt auch für iterierbare Nicht-Signale** (2026-08-10, Entscheidung des Orchestrators). Der Planer hat vorgelegt, dass `touch('ab')` oder `value(new Set())` bisher durch den Spread liefen und still `undefined` bekamen — sie werfen ab jetzt. Das ist die einzige Wirkung über den Wortlaut des Findings hinaus. Entschieden: so umsetzen, mit eigener Breaking-Changes-Zeile. Die bindende Festlegung lautet »auf die `link()`-Form bringen«, und ein stilles `undefined` ist genau die schlechteste der fünf Antworten, die CONS-007 anprangert. Erreichbar ist der Fall ohnehin nur aus untypisiertem JS; beide Overloads lehnen das Argument zur Compile-Zeit ab.
- **Paket 32 wird jetzt gebaut, vor Phase 3** (2026-08-10). **Nachtrag am selben Tag, Entscheidung des Orchestrators:** Der Planer hat vorgelegt, dass der Umfang von 32a über die zehn leckenden Tests hinauswächst — auf 33 `finally`-Blöcke in 38 Tests derselben fünf Dateien, weil diese fünf nie Teil des TEST-017-Sweeps waren. Gemessen: `createMemo.spec.ts` mit Wächtern, aber ohne den Umbau liefert 51 Saatpunkte, größter Radius 16, 43 Übeltäter. Ein Wächter ohne das Muster ist schlechter als keiner. Der Vorschlag ist angenommen; die Alternative (Wächter in diesen fünf Dateien weglassen) ließe genau die Blindheit stehen, für die das Paket gebaut wird. Der Befund stammt nicht aus dem Audit, sondern aus dem Sweep: 8 der 43 Spec-Dateien führen keinen Zählerwächter, und 10 Tests in fünf davon lassen 8 Effects und 18 Signale stehen. Der Nutzer hat entschieden, das Netz vor den Korrektheits- und Umbaupaketen zu spannen, statt danach.
- **ASYNC-002 und ASYNC-003 werden beide behoben**, nicht nur dokumentiert. Beides ändert beobachtbares Verhalten und gehört in die Breaking Changes (2026-08-09)

Annahmen, wo das Audit zwei Wege nennt und die Wahl keine Produktentscheidung ist — jeweils die zuerst genannte Empfehlung:

- BUILD-007: `sourcesContent` aktivieren und die Maps behalten, plus `sourcemap: true` im Rollup-Output (2026-08-09) — **korrigiert am 2026-08-09 durch die Messung des Planers von Paket 5**: für `dist/*.js.map` gilt die Festlegung unverändert (selbsttragende Maps mit eingebettetem Quelltext). Für die Declaration-Maps ist sie technisch nicht ausführbar — `tsc` schreibt keinen Quelltext in eine `.d.ts.map`, dafür existiert kein Schalter. Der Nutzer hat **Variante A** gewählt: `declarationMap: false` im Publish-Pass, die tote `sourceMappingURL`-Referenz verschwindet restlos. Go-to-Definition landet in `lib/index.d.ts`, wo nach BUILD-004 das JSDoc steht.
- BUILD-005: Die Audit-Empfehlung (`"lib": ["ES2023", "DOM"]` in `tsconfig.lib.json`, alternativ eine `/// <reference lib="dom" />`-Direktive) ist gemessen wirkungslos — `tsconfig.json:12` führt DOM bereits, und die Direktive landet nicht in der `.d.ts`. Der Nutzer hat den vom Planer gemessenen Ersatzweg freigegeben: ein **strukturelles `AbortSignalLike`** in `src/types.ts` ersetzt die `AbortSignal`-Referenz in den ausgelieferten Typen. Echtes DOM- und Node-`AbortSignal` bleiben zuweisbar; die dritte `TS2304`-Meldung stammt aus `@spearwolf/eventize` und bleibt bestehen (2026-08-09)
- BUILD-015: Vorab-Check, der jede Threshold-Glob-Gruppe gegen `src/**/*.ts` matcht und bei null Treffern abbricht (2026-08-09)
- API-009: zur Laufzeit warnen, wenn `createMemo({name})` ohne `attach` kommt — die Typkopplung wäre ein Breaking Change für einen Diagnosefall (2026-08-09)
- CONS-001: den Fehlerkanal zu `onSignalizeError` verallgemeinern, `console.error` bleibt Fallback ohne Handler (2026-08-09)
- CONS-007: `touch()` und `value()` auf die `link()`-Form bringen; die stillen No-Ops bleiben still und bekommen eine Zeile in `docs/api.md` (2026-08-09)
- TEST-018: alle drei ungetesteten `BUSY_*`-Wächter bekommen einen Test. Das Finding verweist auf READ-013, das zwei davon für entbehrlich hält — READ-013 ist `low` und außerhalb des Scopes, also wird nichts entfernt (2026-08-09)

## Reihenfolge

Fünf Phasen. Die drei Gates stehen ganz vorn, wie beauftragt. Danach das Packaging, weil es dieselbe Werkzeugkette betrifft und jeden späteren `checkPkgTypes` erst aussagekräftig macht. Dann das Testnetz für genau die Bereiche, die Phase 3 bis 5 umbauen — TEST-017 als breiter Sweep liegt bewusst vorn, damit alle danach entstehenden Tests dem neuen Muster folgen und kein späterer Diff darin untergeht. Der Sweep ist nach der Vorabmessung vom 2026-08-09 in **7a, 7b und 7c** geteilt: gemessen 32 Dateien und 356 Tests, zu viel für einen Diff, den ein Review noch trägt (Begründung und Schnitt stehen dort). Vor Phase 3 steht seit dem 2026-08-10 zusätzlich **Paket 32**, das die Wächter der Spec-Dateien vereinheitlicht; es ist nach der Messung vom selben Tag in **32a und 32b** geteilt (fünf Dateien mit echter Umbauarbeit gegen 23 mit je ein bis zwei Assert-Zeilen — Begründung dort). In Phase 3 ist seit dem 2026-08-10 zusätzlich **Paket 13 in 13a und 13b** geteilt: der Refactor und die zwei Bugfixes lassen sich nicht mit demselben Beweis abnehmen — der eine verlangt, dass die Suite exakt dasselbe meldet, der andere, dass sie es nicht tut (Begründung dort). Korrektheit vor Performance vor Typen vor Struktur; die Doku-Pakete zuletzt, weil jedes vorherige Paket einen CHANGELOG-Eintrag hinterlässt.

## Pakete

### Phase 1 — Die Prüfkette schließen

#### [x] 1. Gate 1: Typecheck über Specs, Benchmarks und Configs
- Findings: BUILD-003 (critical)
- Ziel: Der Testcode — rund 9500 der 14 700 Zeilen in `src/` — wird von einem Compiler geprüft, nicht nur von SWC durchgereicht.
- Bereich: `tsconfig.json`, `package.json`, `.github/workflows/ci.yml`
- Hängt ab von: —
- Modell: mittlere Stufe — im Grobplan stand die stärkste, weil der Umfang der Typfehler unbekannt war. Die Vorabmessung hat ihn auf drei benannte Stellen reduziert; das Paket arbeitet jetzt gegen exakte Vorgaben.
- Hash: `2dc2833`
- Dateien: `tsconfig.json`, `package.json`, `.github/workflows/ci.yml`, `src/SignalGroup.teardown.spec.ts`, `src/ordering.property.spec.ts`
- Abgleich (2026-08-09, vom Orchestrator, Zug 0 entfällt beim ersten Paket): BUILD-003 unverändert. Vorab gemessen — `npx tsc --noEmit -p tsconfig.json` bricht mit 9 Fehlern ab: 6 aus `node_modules` (`unplugin`, `webpack-virtual-modules`, allesamt `TS2307` auf nicht installierte optionale Peers), die `skipLibCheck` erledigt, und 3 echte im Testcode. Das Risiko aus dem Grobplan ist damit vom Tisch, das Paket bleibt eins.
- Vorgehen:
  1. In `tsconfig.json` unter `compilerOptions` `"skipLibCheck": true` ergänzen. Es steht bewusst in der Basis-Config, nicht in `tsconfig.lib.json` — `tsconfig.lib.json` und `smoke/tsconfig.json` erben daraus, und die sechs `TS2307` aus `node_modules` treffen jeden dieser Läufe gleichermaßen. Der `include`-Block bleibt unverändert; er deckt `src/**/*.ts`, `bench/**/*.ts` und die drei Vitest-Configs bereits ab.
  2. Die drei echten Typfehler beheben — jeweils die minimale Annotation, keine Umformulierung der Tests:
     - `src/SignalGroup.teardown.spec.ts:594` — `const sibling = link(sig, (v) => v, {attach: host});` → der Callback-Parameter braucht eine Annotation. `sig` ist ein `createSignal(...)`-Signal; die Annotation richtet sich nach dessen Werttyp, im Zweifel `(v: unknown) => v`. `any` ist hier nicht zulässig, das Paket schafft gerade das Gegenteil ab.
     - `src/SignalGroup.teardown.spec.ts:805` — dieselbe Zeile mit `external` statt `sig`, dieselbe Behandlung.
     - `src/ordering.property.spec.ts:116` — `const readValuesByEffect: number[][] = effectSpecs.map(() => []);` löst `TS7011` aus, weil das leere Array-Literal keinen Rückgabetyp hergibt. `effectSpecs.map((): number[] => [])` schreiben.
  3. In `package.json#scripts` ein `"typecheck": "tsc --noEmit -p tsconfig.json"` anlegen. Es steht direkt neben `"compile"`, weil beide `tsc` fahren und der Unterschied (Deklarations-Build gegen Vollprüfung) sonst nicht auffällt.
  4. `"world"` um `typecheck` erweitern: `run-s -sn clean check typecheck compile bundle test:smoke checkPkgTypes test test:gc`. Es steht nach `check` und vor `compile` — ein Typfehler soll auffallen, bevor drei Minuten Build- und Testzeit verbrannt sind.
  5. In `.github/workflows/ci.yml` einen Step `- run: pnpm typecheck` mit `name: Type-check everything, including specs and benchmarks` zwischen dem `pnpm check`-Step und dem `pnpm dist`-Step einhängen. `main.yml` bleibt in diesem Paket unberührt — das ist Paket 2.
  6. CHANGELOG: unter `## Unreleased` → `### Build System` eine Zeile, dass `pnpm typecheck` neu ist und Specs, Benchmarks und die Vitest-Configs erstmals typgeprüft werden.
- Verify: `pnpm typecheck && pnpm check && pnpm test`
- Commit: `build: type-check specs, benchmarks and configs with a real tsc pass (BUILD-003)`
- **Ergebnis (2026-08-09)** — Hash `2dc2833`. Verify vom Orchestrator selbst gefahren: `typecheck` 0 Fehler, `check` 85 Dateien sauber, `test` 44 Dateien / 478 Tests grün, Coverage 98,86 / 93,73 / 99,53 / 99,36 — unverändert gegen die Baseline. Review: BUILD-003 behoben, keine kritischen oder wichtigen Befunde.
- Abweichung des Implementierers: Callback-Annotation `(v: number) => v` statt der im Plan als Grenzfall genannten `(v: unknown) => v` — `sig` und `external` sind konkret `createSignal(0, …)`, der Werttyp ist `number`. Angenommen; die Annotation ist genauer und bleibt `any`-frei.
- Kleiner Befund aus dem Review: `CHANGELOG.md` — der neue Eintrag bündelt drei Fakten in einer Zeile (Script, Einhängung in `world`, Einhängung in CI) und steht damit im Spannungsfeld zur Projektregel »eine Zeile, ein Fakt«. Folgt dem Stil der Nachbarzeile im selben Abschnitt. Wird in Paket 30 mit aufgeräumt.
- Nebenbefunde:
  - `package.json` führt `packageManager: "pnpm@11.20.0"`, `CLAUDE.md:11` nennt `pnpm@11.17.0`. Kein Finding des Audits; Kandidat für Paket 29 (Zahlen, die nicht mehr gelten).
  - Biome verlangte nach der Typannotation einen Zeilenumbruch in `src/ordering.property.spec.ts:116`, per `pnpm fix` erledigt. Kein offener Punkt.

#### [x] 2. Gate 2: CI auf Pull Requests und auf main
- Findings: BUILD-002 (high), BUILD-010 (high)
- Ziel: Der Pfad, der tatsächlich publiziert, fährt dasselbe Gate wie ein Feature-Branch — und ein gescheiterter Publish wird rot statt grün.
- Bereich: `.github/workflows/ci.yml`, `.github/workflows/main.yml`, `scripts/publishPackage.cjs`
- Hängt ab von: Paket 1 (das neue `typecheck`-Script wird mit eingehängt)
- Modell: mittlere Stufe — mechanische Arbeit gegen exakte Vorgaben, aber die Umstellung auf `workflow_call` und die Fehlerpfade eines ungetesteten Deploy-Skripts vertragen keine Flüchtigkeit.
- Hash: `8041bd1`
- Dateien: `.github/workflows/ci.yml`, `.github/workflows/main.yml`, `scripts/publishPackage.cjs`, `CHANGELOG.md`, `AGENTS.md`
- Abgleich (2026-08-09):
  - **BUILD-002 unverändert.** `.github/workflows/ci.yml:3-7` trägt weiterhin nur `on: push: branches-ignore: ["main"]` mit `paths-ignore: ['**.md']`, kein `pull_request`, kein `workflow_call`. `.github/workflows/main.yml:29-33` fährt im Job `test` weiterhin genau `pnpm lint` und `pnpm test`. Paket 1 hat die Lücke sogar vergrößert: der neue Step `pnpm typecheck` steht in `ci.yml:32-33`, in `main.yml` steht er nicht — der Publish-Pfad prüft seit `2dc2833` einen Schritt weniger als jeder Feature-Branch.
  - **BUILD-010 unverändert.** `scripts/publishPackage.cjs:13` lautet `process.exit(!error ? 0 : error);`, `scripts/publishPackage.cjs:38-40` ist weiterhin der `else`-Zweig mit `` console.error(`exec() panic: ${stderr}`); `` als einziger Anweisung. Beide Defekte am 2026-08-09 mit dem Harness aus »Verify« gegen die unveränderte Datei reproduziert: Fall A (`npm show` scheitert) endet mit Exit-Code 0, Fall B (`npm publish` scheitert) endet in `TypeError [ERR_INVALID_ARG_TYPE]: The "code" argument must be of type number. Received an instance of Error` aus `publishPackage.cjs:13`.
- Vorgehen:
  1. **Weg für BUILD-002: `workflow_call`, nicht zwei Step-Listen.** Das Audit nennt beide Wege; die Entscheidung fällt gegen das Anheben von `main.yml`, weil Paket 1 der Beweis ist, dass eine zweite Step-Liste auseinanderläuft — `typecheck` landete in `ci.yml` und `main.yml` blieb zurück. Ein Aufruf kann nicht driften, und jeder künftige Step gilt automatisch auch für den Publish-Pfad.
  2. In `.github/workflows/ci.yml` den `on:`-Block ersetzen durch:
     ```yaml
     on:
       pull_request:
         branches: [ "main" ]
       push:
         branches-ignore: [ "main" ]
         paths-ignore:
           - '**.md'
       workflow_call:
     ```
     Drei Punkte, die genau so bleiben müssen: `paths-ignore` kommt **nicht** unter `pull_request` — ein reiner Doku-PR ließe einen als required konfigurierten Check sonst auf ewig in »expected« hängen, statt ihn zu bestehen. `workflow_call:` bleibt leer (keine `inputs`, keine `secrets`) — `ci.yml` liest keinen Secret und braucht keinen Parameter. Und es kommt **kein** `concurrency:`-Block dazu: ein Branch mit offenem PR läuft dadurch zweimal (einmal `push`, einmal `pull_request`), das ist bewusst in Kauf genommen, weil jede `cancel-in-progress`-Variante entweder den required Check eines PR abschießen kann oder — über den `workflow_call`-Pfad — den Test-Job einer laufenden Deploy-Pipeline auf `main`.
  3. Sonst ändert sich in `ci.yml` nichts. Der Job `test` behält seinen Namen, sein `permissions: contents: read`, alle vierzehn Steps in ihrer Reihenfolge (inklusive `pnpm typecheck` aus Paket 1, des `continue-on-error`-`bench`-Steps und der beiden `if: always()`-Steps am Ende) und alle vorhandenen Kommentare.
  4. In `.github/workflows/main.yml` den kompletten Job `test` (aktuell Zeilen 12-33, von `  test:` bis einschließlich `        name: Run tests`) ersetzen durch:
     ```yaml
       test:
         name: Run all checks, linters and tests
         uses: ./.github/workflows/ci.yml
         permissions:
           contents: read
     ```
     Der lokale Pfad steht ohne `@ref` — so ruft GitHub den Workflow aus demselben Commit auf. Kein `with:`, kein `secrets:`. Der aufrufende Job darf keine `steps:` mehr haben; `runs-on` und `uses: actions/checkout@v7` entfallen ersatzlos, der aufgerufene Workflow bringt beides selbst mit. Nebenwirkung, die niemand im Repo sehen kann: Job-Namen wandern (`Run tests` → `Run all checks, linters and tests`, und über `workflow_call` erscheint der Check verschachtelt). Ist auf GitHub ein Required Status Check unter dem alten Namen konfiguriert, muss er in den Branch-Protection-Regeln nachgezogen werden — das ist eine Einstellung in der Weboberfläche, kein Teil dieses Commits, und gehört in den Report.
  5. Der Job `deploy` in `main.yml` bleibt Zeichen für Zeichen, wie er ist — `needs: test` funktioniert gegen einen Reusable-Workflow-Job unverändert. Auch der Top-Level-Block `permissions: id-token: write / contents: read` bleibt: `id-token: write` braucht `deploy` für OIDC, und der neue `test`-Job stuft sich über sein eigenes `permissions: contents: read` selbst herunter, sodass das schwächere Token in den aufgerufenen Workflow durchgereicht wird.
  6. Damit fällt `pnpm lint` aus beiden Workflows heraus — `pnpm check` aus `ci.yml` deckt Lint und Format ab. Das Script bleibt in `package.json` und in der Tabelle in `AGENTS.md:178` stehen, es ist weiterhin ein gültiges Entwickler-Kommando.
  7. **Weg für BUILD-010: die minimale Reparatur, kein `execFileSync`.** `scripts/publishPackage.cjs` läuft ungeschützt im Deploy-Job und ist von keinem Test gedeckt; die Zwei-Zeilen-Korrektur behebt beide im Finding benannten Defekte, während der Umbau auf `execFileSync` mit `stdio: 'inherit'` das Prozessmodell der Datei ändert (synchron statt callback-basiert, geerbte statt gepufferter Streams). Der eingriffsärmere Weg gewinnt.
  8. `scripts/publishPackage.cjs:13` — `process.exit(!error ? 0 : error);` ersetzen durch `process.exitCode = error ? 1 : 0;`.
  9. `scripts/publishPackage.cjs:39` — direkt hinter `` console.error(`exec() panic: ${stderr}`); `` die Zeile `process.exitCode = 1;` einfügen.
  10. Abweichung von der Audit-Empfehlung, bewusst: das Audit schreibt `process.exit(!error ? 0 : 1)`, der Plan schreibt `process.exitCode`. Ein `process.exit()` im `exec`-Callback kann das `console.error(stderr)` / `console.log(stdout)` der beiden Zeilen darüber abschneiden, sobald stdout eine Pipe ist — und ein CI-Log ist genau das. Nach dem Callback hält nichts mehr die Event-Loop, der Prozess endet von selbst mit dem gesetzten Code; für alle vier Fälle des Harness am 2026-08-09 nachgemessen.
  11. Sonst ändert sich an der Datei nichts: die beiden `process.exit(0)` in den Skip-Zweigen (`-dev`-Version, Version bereits veröffentlicht) bleiben, `exec` bleibt `exec`, die Meldungstexte bleiben.
  12. `CHANGELOG.md`, unter `## Unreleased` → `### Build System`, drei Zeilen, eine Zeile ein Fakt:
      - CI läuft jetzt auch auf Pull Requests gegen `main`, damit ein PR aus einem Fork überhaupt geprüft wird (BUILD-002)
      - Ein Push auf `main` fährt über `workflow_call` denselben CI-Workflow wie jeder Feature-Branch, bevor der Deploy-Job publiziert — vorher nur `pnpm lint` und `pnpm test` (BUILD-002)
      - `scripts/publishPackage.cjs` endet mit Exit-Code 1, wenn `npm show` scheitert, und meldet ein fehlgeschlagenes `npm publish` mit npms eigener Fehlerausgabe statt mit `ERR_INVALID_ARG_TYPE` (BUILD-010)
  13. `AGENTS.md`, zwei Stellen im Abschnitt »Development workflow«:
      - Der Absatz, der mit »`.github/workflows/ci.yml` runs `pnpm check`, `pnpm dist`, …« beginnt (aktuell `AGENTS.md:185`): `pnpm typecheck` in die Aufzählung aufnehmen, zwischen `pnpm check` und `pnpm dist` — Paket 1 hat den Step eingehängt, aber diesen Satz nicht mitgezogen. Im selben Absatz einen Satz anhängen: `ci.yml` triggert auf Push (außer `main`), auf `pull_request` gegen `main` und auf `workflow_call`; `main.yml` ruft `ci.yml` per `workflow_call` auf, der Deploy-Pfad fährt also dieselben Steps.
      - Der Satzteil »Both workflows run one job on `ubuntu-latest` (`ci.yml:9-12`, `main.yml:11-14`)« im Abschnitt »Deliberately not tested« (aktuell `AGENTS.md:191`): er stimmt danach nicht mehr, weil `main.yml` einen aufrufenden Job und den `deploy`-Job hat. Umformulieren auf: jeder Job läuft auf `ubuntu-latest`, und `main.yml`s Test-Job ist der `ci.yml`-Workflow selbst. Die Zeilenreferenzen in Klammern nach der Änderung neu ablesen, nicht aus diesem Plan übernehmen — sie verschieben sich durch Schritt 2 und 4.
- Verify: aus dem Repo-Root, drei Teile:
  1. `python3 -c "import yaml;[yaml.safe_load(open(f)) for f in ('.github/workflows/ci.yml','.github/workflows/main.yml')];print('workflow yaml ok')"` — PyYAML 6.0.3 ist auf diesem Rechner vorhanden, geprüft. Reine Syntaxprüfung; `on:` liest PyYAML als Boolean-Schlüssel, darauf also nichts stützen.
  2. `pnpm check` — Biome deckt `scripts/**/*.cjs` laut `biome.json` mit ab.
  3. Der Publish-Harness. Er kopiert das Skript in ein Wegwerf-Verzeichnis neben eine Stub-`package.json` mit Version `9.9.9` (die echte steht auf `1.0.0-dev` und würde das Skript vor allen interessanten Zweigen aussteigen lassen) und schiebt ein Fake-`npm` vor den `PATH`. Es geht nichts an eine Registry, es wird nichts veröffentlicht:
     ```bash
     S=$(mktemp -d); mkdir -p "$S/pkg/scripts" "$S/bin"
     cp scripts/publishPackage.cjs "$S/pkg/scripts/"
     printf '{"name":"@spearwolf/signalize","version":"9.9.9"}\n' > "$S/pkg/package.json"
     printf '%s\n' '#!/bin/sh' 'case "$1" in' '  show) if [ "$FAKE_SHOW" = fail ]; then echo "npm error network timeout" >&2; exit 1; fi; echo "$FAKE_VERSIONS"; exit 0 ;;' '  publish) if [ "$FAKE_PUBLISH" = fail ]; then echo "npm error 403 forbidden" >&2; exit 1; fi; echo "+ ok"; exit 0 ;;' 'esac' 'exit 0' > "$S/bin/npm"
     chmod +x "$S/bin/npm"; export PATH="$S/bin:$PATH"
     run() { FAKE_SHOW=$1 FAKE_VERSIONS=$2 FAKE_PUBLISH=$3 node "$S/pkg/scripts/publishPackage.cjs" >/dev/null 2>&1; echo "$4 -> $?"; }
     run fail '[]'        ok   'A npm show scheitert    (erwartet 1)'
     run ok   '["0.0.1"]' fail 'B npm publish scheitert (erwartet 1)'
     run ok   '["9.9.9"]' fail 'C schon veroeffentlicht (erwartet 0)'
     run ok   '["0.0.1"]' ok   'D happy path            (erwartet 0)'
     FAKE_SHOW=ok FAKE_VERSIONS='["0.0.1"]' FAKE_PUBLISH=fail node "$S/pkg/scripts/publishPackage.cjs" 2>&1 | grep -q ERR_INVALID_ARG_TYPE && echo 'B: crasht noch' || echo 'B: sauber, kein Crash'
     rm -rf "$S"
     ```
     Der Block ist bewusst ohne Heredoc geschrieben, damit er sich mitsamt der Einrückung dieses Dokuments in eine Shell werfen lässt. Erwartet nach dem Fix: `A -> 1`, `B -> 1`, `C -> 0`, `D -> 0` und `B: sauber, kein Crash`. Gegen die unveränderte Datei liefert derselbe Harness `A -> 0` und `B: crasht noch`, am 2026-08-09 so gemessen — daran sieht man, dass er wirklich misst.
  Ein `pnpm world` ist für dieses Paket nicht nötig: keine der fünf Dateien wird von `src/`, vom Build oder von den Tests gelesen.
- Commit: `ci: run the full gate on pull requests and on main, and fail a broken publish (BUILD-002, BUILD-010)`
- **Ergebnis (2026-08-09)** — Hash `8041bd1`. Verify vom Orchestrator selbst gefahren: YAML beider Workflows `workflow yaml ok`, `pnpm check` 85 Dateien sauber, Publish-Harness `A -> 1`, `B -> 1`, `C -> 0`, `D -> 0`, `B: sauber, kein Crash`. Gegen die unveränderte Datei lieferte derselbe Harness `A -> 0` und `B: crasht noch` — der rote Lauf ist belegt. Review: BUILD-002 und BUILD-010 erfüllt, keine kritischen, wichtigen oder kleinen Befunde; der Reviewer hat den Harness unabhängig nachgefahren.
- Offener Punkt außerhalb des Repos: Die Job-Namen haben sich verschoben (`Run tests` → `Run all checks, linters and tests`, über `workflow_call` verschachtelt dargestellt). Ist auf GitHub ein Required Status Check unter dem alten Namen konfiguriert, muss er in den Branch-Protection-Regeln nachgezogen werden. Weboberfläche, kein Commit — geht an den Nutzer.
- Planänderung (2026-08-09): `AGENTS.md` kommt in dieses Paket, weil Schritt 13 genau die zwei Sätze trifft, die dieses Paket unwahr macht — einer davon ist der Nebenbefund aus Paket 1 (`pnpm typecheck` fehlt in der CI-Beschreibung). `scripts/publishPackage.cjs:2` trägt ein totes `/* eslint-disable no-console */`, obwohl ESLint seit v0.28 raus ist; nicht Teil dieses Pakets, damit der Diff auf dem Finding bleibt, sondern in Paket 29 vermerkt. Reihenfolge und Schnitt der offenen Pakete bleiben unverändert.

<details>
<summary>BUILD-002 und BUILD-010 im Volltext (aus <code>audit.html</code>)</summary>

**BUILD-002 — Die CI-Lücke bei Pull Requests und auf main schließen**
Severity: high · Kategorie: Projektaufbau & Build · Effort: S
Location: `.github/workflows/ci.yml:3-6` · `.github/workflows/main.yml:29-32`

> `ci.yml` triggert ausschließlich auf `push` mit `branches-ignore: [main]` — es gibt keinen `pull_request`-Trigger, ein PR aus einem Fork wird also nie geprüft. Auf `main` übernimmt `main.yml`, das nur `pnpm lint` (Biome ohne Format-Check) und `pnpm test` fährt: kein `pnpm check`, kein `test:gc`, kein `compile`/`bundle` vor dem Test-Gate. Der Pfad, der tatsächlich publiziert, hat damit das schwächste Gate im Projekt — die neun GC-Tests laufen dort nie.

> Empfehlung: `pull_request: branches: [main]` in `ci.yml` ergänzen und den Test-Job in `main.yml` auf `pnpm check`, `pnpm test`, `pnpm test:gc` anheben, oder den CI-Workflow per `workflow_call` wiederverwenden.

**BUILD-010 — Die Fehlerpfade in publishPackage.cjs reparieren**
Severity: high · Kategorie: Projektaufbau & Build · Effort: S
Location: `scripts/publishPackage.cjs:38-40` · `scripts/publishPackage.cjs:13`

> Scheitert die Versionsabfrage `npm show` (Registry-Timeout, Netzwerkhänger), schreibt das Skript `exec() panic: …` auf stderr und lässt den Prozess danach regulär mit Code 0 auslaufen — der Deploy-Job wird grün, obwohl nichts veröffentlicht wurde. Zweitens ist `process.exit(!error ? 0 : error)` falsch typisiert: `error` ist ein Error-Objekt, und Node wirft dafür `ERR_INVALID_ARG_TYPE`. Ein fehlgeschlagenes `npm publish` endet damit in einem verwirrenden Crash statt in der npm-Fehlermeldung.

> Empfehlung: Im Fehlerzweig `process.exitCode = 1` setzen und `process.exit(!error ? 0 : 1)` schreiben; sauberer wäre `execFileSync` mit `stdio: 'inherit'`.

> Evidence: `node -e "try{process.exit(new Error('boom'))}catch(e){console.log('THREW',e.code)}"` → `THREW ERR_INVALID_ARG_TYPE`

</details>

#### [x] 3. Gate 3: Coverage-Schwellen, die wirklich messen
- Findings: BUILD-015 (medium), BUILD-016 (medium)
- Ziel: Eine Schwellengruppe ohne Treffer bricht ab, statt grün zu melden; die GC-Suiten scheitern, statt sich selbst zu überspringen.
- Bereich: `vitest.config.ts`, `vitest.gc.config.ts`, die vier `*.gc.spec.ts`
- Hängt ab von: —
- Modell: mittlere Stufe — die Snippets unten sind vollständig und gemessen, aber der Reformat-Nachlauf in `signal-core.gc.spec.ts` und die vier Doku-Stellen wollen jemanden, der hinschaut.
- Hash: `c65deb4`
- Dateien: `vitest.config.ts`, `src/link.gc.spec.ts`, `src/SignalGroup.gc.spec.ts`, `src/SignalAutoMap.gc.spec.ts`, `src/signal-core.gc.spec.ts`, `AGENTS.md`, `docs/recipes.md`, `CHANGELOG.md`. **`vitest.gc.config.ts` wird nicht angefasst** — es importiert `./vitest.config.js` und erbt den neuen Check dadurch von selbst (gemessen, siehe Abgleich).
- Abgleich (2026-08-09):
  - **BUILD-015 unverändert**, Fundstelle jetzt `vitest.config.ts:89-103` — exakt wie im Audit. Drei Stufen, zwei davon Glob-Gruppen (der negierte Extglob und die Vierer-Brace-Liste). Der Mechanismus ist im installierten Vitest 4.1.10 nachgelesen: `resolveThresholds` baut pro Glob-Key eine eigene Map über `pm(glob)` (picomatch) gegen `relative(config.root, file)`, `checkThresholds` überspringt eine Gruppe ohne Summaries wortlos. Vorabmessung: zwei zusätzliche Gruppen mit unmöglichen Schwellen eingehängt — `'srcc/**/*.ts': {statements: 100, branches: 100, functions: 100, lines: 100}` (Tippfehler) und `'signalize/src/signal-core.ts': {branches: 100}` (Glob gegen das falsche Root) — Lauf: 44 Dateien, 478 Tests, **Exit 0**, keine Warnung. Zur Gegenprobe dieselbe unmögliche Schwelle unter einem echten Glob (`'src/signal-core.ts': {branches: 100}`): `ERROR: Coverage for branches (85.71%) does not meet "src/signal-core.ts" threshold (100%)`, Exit 1. Die Attrappe ist real und sie ist lautlos.
  - **BUILD-016 unverändert.** Alle vier Dateien tragen denselben Sechszeiler: `src/link.gc.spec.ts:13-14`, `src/SignalGroup.gc.spec.ts:25-26`, `src/SignalAutoMap.gc.spec.ts:11-12`, `src/signal-core.gc.spec.ts:11-12`; `execArgv: ['--expose-gc']` steht in `vitest.config.ts:59`. Vorabmessung mit entferntem `execArgv`: `pnpm test` meldet `Test Files 40 passed | 4 skipped (44)` / `Tests 455 passed | 23 skipped (478)` — Zahl für Zahl die Evidence des Audits. `vitest run` **ohne** `--coverage` endet damit auf **Exit 0**; nur `--coverage` zieht, und zwar über dreizehn Schwellen-Fehler auf `SignalAutoMap.ts`, `SignalGroup.ts`, `link.ts` und `signal-core.ts`, also über einen Mechanismus, der von den GC-Tests gar nichts weiß. `pnpm test:gc` bleibt bei entferntem `execArgv` bei `478 passed`, Exit 0 — es fährt `--expose-gc` über die ganze Suite und merkt den Verlust prinzipiell nicht.
  - Baum nach beiden Messungen wieder sauber: `git status --porcelain` zeigt nur `M remediation-plan.md` (diese Datei), `sha1sum vitest.config.ts` = `42514f19…`, identisch mit HEAD, `pnpm test` wieder 44/478 grün.
- Vorgehen:
  1. **Wo der Check lebt: in `vitest.config.ts` selbst, auf Modulebene, nicht in `scripts/`.** Ein Vorschalt-Script in `package.json#scripts.test` griffe genau bei `pnpm test` und sonst nirgends — `pnpm test:watch`, `pnpm test:debug`, ein gefilterter Lauf und `pnpm test:gc` liefen weiter gegen ungeprüfte Globs, und jedes künftige Script müsste daran denken. Der Wurf beim Config-Laden ist nicht umgehbar: Vitest lädt die Datei, bevor es einen einzigen Test einsammelt. Gemessen: mit einer toten Glob-Gruppe brechen `pnpm test`, `vitest` (Watch) und `pnpm test:gc` alle drei mit `failed to load config from …` plus der Fehlermeldung ab, letzteres über den `import`-Pfad von `vitest.gc.config.ts` — dieselbe Meldung, ohne dass die Datei angefasst wird. Die Regel »Modul-Toplevel seiteneffektfrei« aus `CLAUDE.md` gilt dem Tree-Shaking von `src/`; `vitest.config.ts` wird nie gebündelt und ist davon nicht betroffen.
  2. **Womit gematcht wird: `globSync` aus `node:fs`, keine neue Dependency.** `picomatch` (das Vitest selbst benutzt), `tinyglobby` und `minimatch` liegen zwar im pnpm-Store, sind aus dem Projekt-Root aber nicht auflösbar (`require.resolve` scheitert bei allen dreien) — sie wären ein neuer direkter Eintrag in `devDependencies` und damit eine Scope-Ausweitung. Nachgeprüft, dass Nodes `globSync` die vorhandene Extglob-Syntax trägt: für beide heute konfigurierten Glob-Gruppen liefert es gegen die 26 Coverage-Dateien **exakt dieselbe Menge** wie picomatch 4.0.5 (17 bzw. 4 Dateien, elementweise identisch). Der Check ist ein Attrappen-Detektor, kein Nachbau von Vitests Matcher — dass beide bei einer Null-Treffer-Gruppe übereinstimmen, reicht dafür.
  3. In `vitest.config.ts` den Import ergänzen: `import {globSync} from 'node:fs';` als **erste** Zeile, vor `unplugin-swc` — Biome sortiert die Imports so (mit anderer Reihenfolge schlägt `pnpm check` fehl).
  4. Zwischen die Imports und den vorhandenen `/* Vite 8 transpiles TypeScript with oxc … */`-Kommentar (der direkt über `export default defineConfig({` stehen bleibt, wo er hingehört) folgenden Block setzen — wortwörtlich, er ist in dieser Form durch `pnpm typecheck`, `pnpm check` und `pnpm test` gelaufen:
     ```ts
     const coverageInclude = ['src/**/*.ts'];
     const coverageExclude = ['src/**/*.spec.ts', 'src/**/*.test.ts'];

     const coverageThresholds = {
       perFile: true,
       statements: 97,
       branches: 85,
       functions: 96,
       lines: 98,
       'src/**/!(EffectImpl|SignalGroup|SignalLink|SignalAutoMap|bequiet|collect-errors|createSignal|link|signal-core).ts':
         {statements: 100, branches: 100, functions: 100, lines: 100},
       'src/{SignalLink,SignalAutoMap,bequiet,collect-errors}.ts': {
         statements: 100,
         branches: 95,
         functions: 100,
         lines: 100,
       },
     };

     // Keys of `coverage.thresholds` that configure the run instead of naming a
     // glob group — mirrors the skip list in Vitest's own `resolveThresholds`.
     const NON_GLOB_THRESHOLD_KEYS = new Set([
       'perFile',
       'autoUpdate',
       '100',
       'statements',
       'branches',
       'functions',
       'lines',
     ]);

     /*
      * Vitest builds one coverage map per threshold glob and then iterates over
      * its summaries; a glob that matches nothing iterates over zero summaries and
      * the whole group passes. A typo in the path or a glob written against the
      * wrong root turns a 100 % rule into a decoration, without a word of warning.
      * So every glob group is matched here against the files coverage will
      * actually report on, and a group with no match refuses the run (BUILD-015).
      */
     function assertThresholdGlobsMatch(thresholds: Record<string, unknown>): void {
       const cwd = import.meta.dirname;

       const covered = new Set(globSync(coverageInclude, {cwd}));
       for (const file of globSync(coverageExclude, {cwd})) {
         covered.delete(file);
       }

       if (covered.size === 0) {
         throw new Error(
           `[vitest.config.ts] coverage.include matches no file: ${coverageInclude.join(', ')}`,
         );
       }

       const dead = Object.keys(thresholds)
         .filter((key) => !NON_GLOB_THRESHOLD_KEYS.has(key))
         .filter((glob) => !globSync(glob, {cwd}).some((file) => covered.has(file)));

       if (dead.length > 0) {
         throw new Error(
           `[vitest.config.ts] coverage threshold glob group(s) match none of the ${covered.size} files coverage reports on: ${dead.join(' · ')}. Vitest passes an empty group silently, so the rule would not be enforced. Globs are matched relative to the project root.`,
         );
       }
     }

     assertThresholdGlobsMatch(coverageThresholds);
     ```
     Vier Punkte, die genau so bleiben müssen. Erstens: der Check liest `coverageThresholds`, also dasselbe Objekt, das unten in die Config geht — eine zweite Liste würde driften, und das ist die Krankheit, die hier kuriert wird. Zweitens: `coverageInclude`/`coverageExclude` sind aus demselben Grund hochgezogen; wer später einen `exclude`-Eintrag ergänzt, verengt automatisch auch die Menge, gegen die geprüft wird. Drittens: `import.meta.dirname` — Vite bündelt die Config in eine Wegwerf-Datei unter `node_modules/.vite-temp/`, schreibt `import.meta.dirname` dabei aber auf das Verzeichnis der Originaldatei um; nachgemessen, der Check zählt dort 26 Dateien und nicht 0. Viertens: `Record<string, unknown>` als Parametertyp — der Check interessiert sich nur für die Schlüssel, und der inferierte Typ von `coverageThresholds` passt sowohl darauf als auch auf Vitests `Thresholds`-Intersection (`pnpm typecheck` grün, mit `skipLibCheck` aus Paket 1 und allem).
  5. Im `coverage`-Block die drei Literale durch die Konstanten ersetzen: `include: coverageInclude,`, `exclude: coverageExclude,` und — anstelle des kompletten `thresholds: {…}`-Objekts, aber **unterhalb des vorhandenen dreistufigen Erklärkommentars, der Wort für Wort bleibt** — `thresholds: coverageThresholds,`.
  6. **Weg für BUILD-016: `if (!globalThis.gc) throw` auf Modulebene, keine Kopplung an den Projektnamen.** Das Audit nennt beide Wege. Der Projektname ist am Modul-Toplevel nicht verlässlich zu bekommen (Vitest reicht ihn nicht als Env-Variable durch), und er würde die Bedingung sogar aufweichen: gefragt ist nicht »heißt das Projekt `gc`«, sondern »ist die Flagge da«. Ein Blick auf `globalThis.gc` beantwortet genau das, in jedem Lauf, der die Datei überhaupt lädt. Für `pnpm test:gc` bedeutet das nichts Neues — dort trägt die ganze Suite `--expose-gc`, die Bedingung ist immer erfüllt.
  7. In allen vier Dateien — `src/link.gc.spec.ts`, `src/SignalGroup.gc.spec.ts`, `src/SignalAutoMap.gc.spec.ts`, `src/signal-core.gc.spec.ts` — steht derselbe Block. Diesen:
     ```ts
     // `globalThis.gc` is only available when Node is launched with --expose-gc
     // (e.g. via the `gc` project in vitest.config.ts, which `pnpm test` also
     // runs). Without it these tests would silently pass even on a leaky
     // implementation, so we skip the suite instead.
     const hasGc = typeof (globalThis as {gc?: () => void}).gc === 'function';
     const gcDescribe = hasGc ? describe : describe.skip;

     const forceGc = async () => {
       for (let i = 0; i < 5; i += 1) {
         (globalThis as {gc: () => void}).gc();
         await new Promise((resolve) => setImmediate(resolve));
       }
     };
     ```
     ersetzen durch diesen:
     ```ts
     // `globalThis.gc` is only available when Node is launched with --expose-gc
     // (the `gc` project in vitest.config.ts, which `pnpm test` also runs, and
     // `pnpm test:gc` for the whole suite). Skipping the suite when the flag is
     // gone would hide a lost `execArgv` behind a green reporter, so this file
     // refuses to load instead (BUILD-016).
     const gc = (globalThis as {gc?: () => void}).gc;

     if (typeof gc !== 'function') {
       throw new Error(
         'globalThis.gc is missing: this suite must run under --expose-gc. Check `execArgv` in the `gc` project of vitest.config.ts, or run `pnpm test:gc`.',
       );
     }

     const forceGc = async () => {
       for (let i = 0; i < 5; i += 1) {
         gc();
         await new Promise((resolve) => setImmediate(resolve));
       }
     };
     ```
     Der Sechszeiler bleibt in allen vier Dateien dupliziert, statt in einen Helfer zu wandern: eine neue Datei unter `src/` fiele unter `coverage.include` und damit unter die 100-Prozent-Regel der zweiten Stufe — genau die Falle, in die `assert-helpers.ts` schon getappt ist (Paket 4 räumt das). `forceGc` ist heute ohnehin viermal identisch vorhanden; der Fix folgt dem Bestand, statt ihn zu vergrößern.
  8. Im selben Zug in jeder der vier Dateien den einen Aufruf `gcDescribe(` auf `describe(` umstellen. Danach kommt in keiner Datei mehr ein `gcDescribe` oder `hasGc` vor — beides würde sonst an `noUnusedLocals` scheitern.
  9. `pnpm fix` laufen lassen. **Erwartete Nebenwirkung, die kein Fehler ist:** In `src/signal-core.gc.spec.ts` stand der Aufruf wegen der Länge von `gcDescribe` dreizeilig (`gcDescribe(\n  '…',\n  () => {`); mit `describe(` passt er in eine Zeile, und Biome rückt daraufhin die komplette Suite eine Ebene aus. Der Diff dieser Datei wird dadurch rund 130 Zeilen groß, davon ist alles außer dem Kopf reine Einrückung. Die anderen drei Dateien ändern nur je rund 20 Zeilen. Gemessen: nach `pnpm fix` sind `pnpm check` (85 Dateien), `pnpm typecheck` und `pnpm test` (44/478) grün.
  10. `AGENTS.md`, Abschnitt »Deliberately not tested«, der Absatz mit den Zeilenverweisen: `vitest.config.ts:30` (für `environment: 'node'`) und `vitest.config.ts:59` (für `--expose-gc`) stimmen nach Schritt 4 nicht mehr — der neue Block schiebt beide nach unten, im gemessenen Stand auf 98 und 127. **Die Zahlen nach der eigenen Änderung selbst ablesen, nicht aus diesem Plan übernehmen.** Die Zahl »20 tests« im selben Satz bleibt unangetastet; sie gehört zu READ-012 und wird in Paket 29 mit den drei anderen Fundstellen zusammen richtiggestellt.
  11. `AGENTS.md`, Zeile 165, die `pnpm test`-Zeile der Kommandotabelle: hinter »per-file thresholds in `vitest.config.ts`« ergänzen, dass die Config beim Laden abbricht, wenn eine Threshold-Glob-Gruppe keine Datei trifft. Ein Satzteil, keine neue Zeile.
  12. `docs/recipes.md:695-697`: der Satz »`src/link.gc.spec.ts` is the worked example: it skips itself when `globalThis.gc` is missing, drives `gc()` plus `setImmediate` in a bounded budget loop, …« beschreibt danach das Gegenteil dessen, was die Datei tut. Auf »it fails loudly when `globalThis.gc` is missing« umschreiben, der Rest des Satzes bleibt.
  13. `CHANGELOG.md`, unter `## Unreleased`, zwei Zeilen, eine Zeile ein Fakt:
      - unter `### Build System`: `vitest.config.ts` refuses to start when a coverage threshold glob group matches no file — an empty group used to pass silently and enforce nothing (BUILD-015)
      - unter `### Tests`: the four `*.gc.spec.ts` suites fail instead of skipping themselves when the run has no `--expose-gc` (BUILD-016)
- Verify: aus dem Repo-Root. Der grüne Teil zeigt, dass nichts kaputt ist; die beiden Proben zeigen, dass die neuen Wächter zubeißen, wenn man sie täuscht. Der Block ist ohne Heredoc geschrieben und stellt die Datei selbst wieder her:
  ```bash
  pnpm typecheck && pnpm check && pnpm test && pnpm test:gc
  B=$(mktemp -d); cp vitest.config.ts "$B/"
  # Probe 1 (BUILD-015): eine tote Glob-Gruppe muss den Lauf stoppen, bevor ein Test startet
  sed -i "s|^  'src/{SignalLink,|  'srcc/**/*.ts': {statements: 100, branches: 100, functions: 100, lines: 100},\n  'src/{SignalLink,|" vitest.config.ts
  pnpm test; echo "Probe 1 exit=$?  (erwartet 1)"
  cp "$B/vitest.config.ts" .
  # Probe 2 (BUILD-016): ohne --expose-gc muessen die vier GC-Dateien scheitern, nicht skippen
  sed -i "/execArgv: \['--expose-gc'\],/d" vitest.config.ts
  pnpm test; echo "Probe 2 exit=$?  (erwartet 1)"
  cp "$B/vitest.config.ts" .; rm -rf "$B"
  git diff --stat -- vitest.config.ts
  ```
  Erwartet: Probe 1 bricht mit `failed to load config from …` und `Startup Error` ab, die Meldung nennt `srcc/**/*.ts` und »match none of the 26 files coverage reports on« — kein einziger Test läuft. Probe 2 endet mit `Test Files 4 failed | 40 passed (44)` und viermal `globalThis.gc is missing: this suite must run under --expose-gc`; entscheidend ist das Wort `failed`, nicht `skipped`. Das abschließende `git diff --stat` muss leer sein. Gegen den heutigen Stand liefern dieselben zwei Proben `Exit 0` beziehungsweise `Test Files 40 passed | 4 skipped`, am 2026-08-09 so gemessen — daran sieht man, dass sie wirklich messen.
- Commit: `build: fail on an unmatched coverage threshold glob and on a GC suite without --expose-gc (BUILD-015, BUILD-016)`
- **Ergebnis (2026-08-09)** — Hash `c65deb4`. Verify vom Orchestrator selbst gefahren: `typecheck` 0 Fehler, `check` 85 Dateien sauber, `test` 44 Dateien / 478 Tests grün mit Coverage 98,86 / 93,73 / 99,53 / 99,36 (deckungsgleich mit der Baseline), `test:gc` 44 / 478 grün. Beide Täuschungsproben schlugen an und wurden zurückgebaut: tote Glob-Gruppe → `Startup Error`, Exit 1, kein Test läuft an; fehlendes `execArgv` → `Test Files 4 failed | 40 passed (44)`, das Wort ist `failed`, nicht `skipped`. Review: BUILD-015 und BUILD-016 erfüllt; der Reviewer hat beide Proben unabhängig auf einer Kopie nachgefahren und die Extglob-Äquivalenz von `globSync` gegen Vitests picomatch elementweise gegengeprüft.
- Abweichung des Orchestrators: Die Commit-Message wurde beim Committen zu `test: make the coverage thresholds and the GC suites fail instead of passing silently (BUILD-015, BUILD-016)` — inhaltlich dieselbe Aussage, Typ `test` statt `build`, weil der Schwerpunkt des Diffs in den vier Spec-Dateien und der Testkonfiguration liegt.
- Kleine Befunde aus dem Review, keine Runde ausgelöst:
  - `vitest.config.ts:60` — die Extglob-Äquivalenz von `node:fs`-`globSync` zu Vitests picomatch ist nur für die zwei heute konfigurierten Muster belegt. Kommt später eine andersartige Syntax dazu (`?()`, `+()`, verschachtelte Extglobs), kann der Check still abweichen und selbst zur Attrappe werden. Wartungsrisiko, kein aktueller Defekt — gehört in die Notiz, die Paket 10 an der Ausschlussliste hinterlässt.
  - `vitest.config.ts:54` — Fehlermeldung sagt »coverage.include matches no file«, Singular statt Plural. Kosmetisch; wird in Paket 29 mitgenommen.
- Planänderung (2026-08-09): keine an Reihenfolge oder Schnitt. Zwei Notizen für später, jeweils dorthin geschrieben, wo sie gebraucht werden — Paket 4 (`coverage.exclude`) und Paket 10 (die Ausschlussliste der zweiten Schwellenstufe).

<details>
<summary>BUILD-015 und BUILD-016 im Volltext (aus <code>audit.html</code>)</summary>

**BUILD-015 — Eine Coverage-Schwelle mit leerem Glob meldet grün, ohne etwas zu messen**
Severity: medium · Kategorie: Projektaufbau & Build · Effort: S
Location: `vitest.config.ts:89-103`

> Vitests `resolveThresholds` baut pro Glob eine eigene Coverage-Map; matcht der Glob keine Datei, ist sie leer, `checkThresholds` iteriert über null Summaries und die Gruppe passiert. Ein Tippfehler im Pfad oder ein Glob, der auf das falsche Root bezogen ist, verwandelt eine 100-Prozent-Regel lautlos in eine Attrappe. Bei drei Stufen mit teils komplexer Extglob-Syntax ist das kein theoretisches Risiko.

> Empfehlung: Einen Vorab-Check ergänzen, der jede Threshold-Glob-Gruppe gegen `src/**/*.ts` matcht und bei null Treffern abbricht, oder die Globs auf explizite Dateilisten reduzieren.

> Evidence: Realer Glob mit unmöglicher Schwelle → rot. Vertippter Glob (`srcc/**/*.ts`) plus root-relativer Glob, dieselben unmöglichen Schwellen → grün, Exit 0.

**BUILD-016 — Die GC-Suiten überspringen sich selbst, statt zu scheitern**
Severity: medium · Kategorie: Projektaufbau & Build · Effort: S
Location: `src/SignalGroup.gc.spec.ts:26` · `src/link.gc.spec.ts:14` · `vitest.config.ts:59`

> Alle vier GC-Specs setzen `const gcDescribe = hasGc ? describe : describe.skip`. Verliert die `gc`-Projektkonfiguration ihr `execArgv: ['--expose-gc']` (Pool-Wechsel, Vitest-Update, Merge-Unfall), verschwinden 23 Tests, und der Test-Reporter meldet weiter grün. Gerettet wird der Lauf allein von den Coverage-Schwellen — was funktioniert, aber ein Zufallstreffer über einen zweiten Mechanismus ist. `pnpm test:gc` läuft ohne `--coverage` und hätte diesen Rückhalt gar nicht.

> Empfehlung: In den GC-Specs `describe.skip` durch einen harten Abbruch ersetzen, wenn das Projekt `gc` heißt — oder schlicht `if (!globalThis.gc) throw new Error(…)` auf Modulebene.

> Evidence: Mit entferntem `execArgv`: `Test Files 40 passed | 4 skipped`, `Tests 455 passed | 23 skipped`, Reporter grün; erst die Schwellen ziehen.

</details>

#### [x] 4. Was im Tarball landet, wird entschieden statt vergessen
- Findings: BUILD-001 (high), BUILD-006 (medium), ARCH-004 (medium)
- Ziel: Eine `files`-Allowlist ersetzt die Denylist, tote `lib/*.js` verschwinden, und der Test-Helfer wird gar nicht erst kompiliert.
- Bereich: `package.json`, `.npmignore`, `tsconfig.lib.json`, `vitest.config.ts`, `src/assert-helpers.ts`
- Hängt ab von: —
- Gegenprobe: `npm pack --dry-run`
- Anmerkung (2026-08-09, aus Paket 3): `coverage.include` und `coverage.exclude` stehen nach Paket 3 nicht mehr inline im `coverage`-Block, sondern in den Konstanten `coverageInclude` / `coverageExclude` am Kopf von `vitest.config.ts`. Dort wird `src/assert-helpers.ts` ergänzt. Der Threshold-Glob-Check leitet seine Dateimenge aus denselben Konstanten ab, der Ausschluss wirkt also automatisch auch dort; die zweite Schwellenstufe behält danach 16 statt 17 Treffer und bleibt gültig.
- Modell: mittlere Stufe — mechanisch, aber mit zwei Fallen, die beide vorab entschärft sind: der `.gitignore`-Rückfall beim Löschen von `.npmignore` und 36 Importpfade, die ein `git mv` nicht mitzieht. Die Werte unten sind gemessen, nicht geschätzt.
- Hash: `5f4c363`
- Dateien: `.npmignore` (gelöscht), `package.json`, `tsconfig.lib.json`, `vitest.config.ts`, `src/assert-helpers.ts` → `src/__testing__/assert-helpers.ts`, `src/assert-helpers.spec.ts` → `src/__testing__/assert-helpers.spec.ts`, 36 weitere `src/**/*.spec.ts` (nur der Importpfad), `src/SignalGroup.ts`, `AGENTS.md`, `CLAUDE.md`, `skills/using-signalize/references/patterns.md`, `CHANGELOG.md`
- Abgleich (2026-08-09):
  - **BUILD-001 unverändert**, mit neuer Zahl. `.npmignore` liegt weiterhin im Root, `package.json` hat kein `files`. `npm pack --dry-run` gegen `c65deb4`: **125 Dateien, 550 455 Bytes ausgepackt, 150 652 Bytes gepackt**. `remediation-plan.md` ist mit 59 015 Bytes drin (10,7 %) — das Audit maß 256 772 Bytes und 37,8 %, weil es den Plan des vorherigen Remediation-Laufs sah; die Datei ist eine andere, der Mechanismus derselbe. Neuer Beleg, den das Audit nicht hatte: `.claude/settings.local.json` (74 Bytes) liegt ebenfalls im Tarball — eine von git **nicht** verfolgte lokale Editor-Einstellung, für die die Denylist naturgemäß keinen Eintrag haben konnte. Die vollständige Aufschlüsselung des Ist-Zustands: `docs/` 92 472 (16,8 %, 5 Dateien) · `CHANGELOG.md` 69 877 (12,7 %) · `lib/*.js.map` 69 001 (12,5 %, 26) · `lib/*.js` 68 201 (12,4 %, 26) · `dist/*.js` 62 222 (11,3 %, 3) · `remediation-plan.md` 59 015 (10,7 %) · `skills/` 45 924 (8,3 %, 5) · `lib/*.d.ts.map` 20 566 (3,7 %, 26) · `lib/*.d.ts` 20 390 (3,7 %, 26) · `README.md` 15 036 · `LICENSE` 11 357 · `CONTRIBUTING.md` 8 086 · `CODE_OF_CONDUCT.md` 5 222 · `package.json` 3 012 · `.claude/settings.local.json` 74.
  - **BUILD-006 unverändert.** `main`, `module` und beide `exports`-Zweige zeigen ausschließlich auf `dist/*.js`; aus `lib/` braucht die Auflösung nur die `.d.ts`. Gemessen sind es heute 26 `lib/*.js` (68 201 Bytes) plus 26 `lib/*.js.map` (69 001 Bytes) = 137 202 Bytes = **24,9 % des Tarballs**, gegenüber 11,3 % für den echten Runtime-Code in `dist/`. Der Anteil ist größer als die 18,1 % des Audits, weil der Tarball insgesamt kleiner geworden ist; absolut liegen die Zahlen dicht beieinander. Eine Präzisierung zur Formulierung des Findings: die Dateien sind nur im Tarball tot, nicht im Repo — `rollup.config.mjs:19-22` liest `lib/index.js` und `lib/decorators.js` als Bundle-Input. Sie dürfen aus `lib/` nicht verschwinden, nur aus dem Paket.
  - **ARCH-004 unverändert**, Fundstellen verschoben. `src/assert-helpers.ts` (157 Zeilen) steht noch im Wurzelverzeichnis von `src/`; `tsconfig.lib.json:4` schließt weiterhin nur `src/**/*.spec.ts` aus; die Coverage-Ausschlussliste liegt seit Paket 3 nicht mehr in `vitest.config.ts:38`, sondern in der Konstante `coverageExclude` in `vitest.config.ts:6`. Das emittierte `lib/assert-helpers.js` ruft in drei Funktionen `expect(…)` auf, ohne es zu importieren — nachgelesen, nicht vermutet; die Datei liegt mit 1 350 Bytes `.d.ts` plus `.js`, `.js.map` und `.d.ts.map` im Tarball. **Zählung:** 37 Dateien importieren `from './assert-helpers.js'`, alle 37 sind Specs, eine davon ist `src/assert-helpers.spec.ts` selbst. Es gibt keinen Importeur außerhalb der Specs, also auch keinen Produktionspfad, den das Verschieben berühren könnte.
  - Vorabmessung der geplanten Änderung, vollständig in einer Kopie durchgespielt und wieder zurückgebaut: `npm pack --dry-run` liefert danach **42 Dateien, 319 068 Bytes ausgepackt, 95 544 gepackt** — 83 Dateien und 42,0 % des ausgepackten Volumens weniger. `attw --pack --profile esm-only` bleibt grün (`node16 (from ESM)` 🟢, `bundler` 🟢, beide Entrypoints), `tsc --noEmit`, `biome check`, `tsc -p tsconfig.lib.json`, `rollup`, `vitest run --coverage` (44 Dateien, 478 Tests), `vitest run --config vitest.gc.config.ts` (44/478) und der Smoke-Test (4 Tests) laufen alle grün.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff` gegen `package.json`, `.npmignore`, `tsconfig.lib.json`, `vitest.config.ts`, `src/`, `AGENTS.md`, `CLAUDE.md` und `CHANGELOG.md` ist leer. Es wurde nichts veröffentlicht; `npm pack` schrieb ausschließlich in Wegwerf-Verzeichnisse.
- Vorgehen:
  1. `.npmignore` löschen.
  2. In `package.json` direkt hinter der Zeile `"sideEffects": false,` einfügen:
     ```json
     "files": [
       "dist",
       "lib/**/*.d.ts",
       "docs",
       "skills",
       "README.md",
       "CHANGELOG.md",
       "LICENSE"
     ],
     ```
     Fünf Punkte dazu, jeder einzeln nachgemessen. **Erstens, die Falle:** ohne `.npmignore` fällt npm auf `.gitignore` zurück, und dort stehen `lib`, `dist` und `coverage`. Genau die zwei Verzeichnisse, die das Paket ausliefern muss, sind also ignoriert — die `files`-Allowlist sticht das aus, `dist/` und alle 26 `lib/*.d.ts` liegen im Tarball. Ohne diese Messung wäre der Schritt ein Blindflug mit der Option auf ein leeres Paket. **Zweitens:** npm erzwingt genau drei Einträge im Wurzelverzeichnis — `package.json`, `README*`, `LICEN[CS]E*`. Gemessen mit einer reduzierten Liste `["dist","lib/**/*.d.ts","docs","skills"]`: übrig blieben exakt diese drei. `README.md` und `LICENSE` stehen trotzdem in der Liste, weil eine Allowlist lesbar sein soll und die Redundanz nichts kostet. **Drittens:** `CHANGELOG.md` gehört **nicht** dazu. Ohne den Eintrag verschwindet es (42 statt 43 Dateien, ebenfalls gemessen) — die Zeile ist Pflicht, nicht Dekoration. **Viertens:** `lib/**/*.d.ts` matcht `*.d.ts.map` nicht, die 26 Declaration-Maps (20 566 Bytes) fallen damit heraus. Das ist heute richtig: ihre `sources` zeigen auf `../src/*.ts` ohne `sourcesContent`, und `src/` geht nicht mit — sie laufen also ohnehin ins Leere (BUILD-007). Der `//# sourceMappingURL=`-Kommentar in jedem ausgelieferten `.d.ts` wird dadurch zu einer toten Referenz, was Editoren stillschweigend übergehen. Paket 5 macht die Maps brauchbar und weitet den Eintrag dann; siehe die Notiz dort. **Fünftens, bewusst weggelassen und nicht wieder aufzunehmen:** `CONTRIBUTING.md` (8 086) und `CODE_OF_CONDUCT.md` (5 222) sind Repo-Governance und haben in `node_modules` keine Funktion; `.claude/settings.local.json` (74) hatte dort nie etwas verloren.
  3. Verzeichnis `src/__testing__/` anlegen und beide Dateien mit `git mv` hineinschieben: `src/assert-helpers.ts` und `src/assert-helpers.spec.ts`. Der Spec zieht mit, weil er ausschließlich den Helfer prüft — bliebe er zurück, wäre er der einzige Spec in `src/`, der in ein `__testing__/` hineingreift.
  4. Die Importpfade der 36 verbleibenden Specs nachziehen. Der Suchlauf muss das neue Verzeichnis aussparen, sonst verbiegt er den Selbstbezug des mitgewanderten Specs:
     ```bash
     grep -rl "from './assert-helpers.js'" src --include="*.ts" | grep -v '__testing__' \
       | xargs sed -i "s|from './assert-helpers.js'|from './__testing__/assert-helpers.js'|"
     ```
     Danach darf `grep -rn "'./assert-helpers.js'" src --include="*.ts" | grep -v __testing__` nichts mehr finden.
  5. In den zwei verschobenen Dateien gehen die eigenen relativen Importe eine Ebene hoch. In `assert-helpers.ts` sind das fünf: `../effects.js`, `../global-queues.js`, `../link.js`, `../SignalGroup.js`, `../signal-core.js`; der Import aus `@spearwolf/eventize` bleibt, wie er ist. In `assert-helpers.spec.ts` dasselbe für jeden Specifier **außer** `./assert-helpers.js`.
  6. `tsconfig.lib.json`, Zeile 4: `"exclude": ["src/**/*.spec.ts", "src/__testing__/**"],`. Damit erzeugt `pnpm compile` kein `lib/assert-helpers.*` mehr — nachgemessen, `lib/` enthält danach 100 statt 104 Dateien und keinen Treffer auf `assert-helpers`.
  7. `vitest.config.ts`, Zeile 6: die Konstante `coverageExclude` auf drei Einträge bringen. Biome bricht sie dabei ohnehin auf drei Zeilen um:
     ```ts
     const coverageExclude = [
       'src/**/*.spec.ts',
       'src/**/*.test.ts',
       'src/__testing__/**',
     ];
     ```
     Wirkung auf den Threshold-Glob-Check aus Paket 3, gemessen: die Dateimenge, gegen die er matcht, sinkt von 26 auf 25. Die zweite Schwellenstufe (der negierte Extglob) behält 16 statt 17 Treffer, die dritte bleibt bei 4 — **keine Gruppe läuft leer, der Wächter schweigt zu Recht**. Die Coverage-Gesamtzahlen sinken minimal, weil ein vollständig abgedeckter Nenner-Beitrag wegfällt: 98,86 / 93,73 / 99,53 / 99,36 → **98,83 / 93,65 / 99,51 / 99,34**, alle vier deutlich über der ersten Stufe (97 / 85 / 96 / 98). Das ist kein Coverage-Verlust, sondern ein ehrlicherer Nenner.
  8. `pnpm fix`. **Erwartete Nebenwirkung, die kein Fehler ist:** Biome ändert 12 Dateien. Der längere Specifier `'./__testing__/assert-helpers.js'` schiebt einzeilige Importe über die Zeilenbreite und Biome bricht sie um; im mitgewanderten Spec sortieren sich zusätzlich die `../`-Importe vor `./assert-helpers.js`. Danach ist `pnpm check` über 85 Dateien sauber, gemessen.
  9. Die vier Doku-Stellen, die den alten Pfad tragen — jeweils nur der Pfad, keine Neuformulierung der Aussage:
     - `AGENTS.md:131`, letzte Zeile der Tabelle »Source file map«: `assert-helpers.ts` → `__testing__/assert-helpers.ts`. In dieselbe Zelle einen Halbsatz, dass `tsconfig.lib.json` das Verzeichnis ausschließt und die Datei deshalb nicht nach `lib/` kompiliert.
     - `CLAUDE.md:35` (»Removing it breaks `assert-helpers.ts`«) und `CLAUDE.md:47` (»`src/assert-helpers.ts` uses it but does not re-export it«): beide auf den neuen Pfad.
     - `skills/using-signalize/references/patterns.md:86`: `src/assert-helpers.ts` → `src/__testing__/assert-helpers.ts`.
     - `CHANGELOG.md:146`: der Eintrag steht unter `## Unreleased` → `### Breaking Changes` (die nächste freigegebene Überschrift ist `## v0.31.1` in Zeile 150), darf also angefasst werden. Nur der Pfad wird korrigiert, der Satz bleibt.
     - `src/SignalGroup.ts:852`: der JSDoc zu `memberCounts` nennt »`getGroupMemberCounts()` in `assert-helpers.ts`« ohne Verzeichnis. Auf `__testing__/assert-helpers.ts` präzisieren.
  10. `AGENTS.md`, Abschnitt »Development workflow«, unter der Kommandotabelle: zwei Sätze, was das Paket ausliefert. `package.json#files` ist eine Allowlist, `.npmignore` gibt es nicht mehr; im Tarball liegen `dist/`, `lib/**/*.d.ts`, `docs/`, `skills/` sowie `README.md`, `CHANGELOG.md`, `LICENSE` und `package.json` — 42 Dateien. Das ist heute die einzige Stelle im Repo, die überhaupt festhielte, was ein Konsument bekommt; ohne sie ist die nächste Ergänzung wieder Zufall. Die Zahl mit Datum versehen, damit Paket 29 sie findet.
  11. `CHANGELOG.md`, unter `## Unreleased` → `### Build System`, drei Zeilen, eine Zeile ein Fakt:
      - the published tarball is an allowlist (`package.json#files`) instead of an `.npmignore` denylist — 125 files / 550 kB down to 42 files / 319 kB, and an internal planning document no longer ships (BUILD-001)
      - `lib/*.js` and `lib/*.js.map` are no longer published; no resolution path ever reached them and they were 25 % of the tarball (BUILD-006)
      - the test-only assertion helper moved to `src/__testing__/` and is excluded from the declaration build, so the published package no longer carries a module that calls Vitest's global `expect` (ARCH-004)
- Verify: aus dem Repo-Root, zwei Teile. Der erste zeigt, dass nichts kaputt ist; der zweite packt den Tarball, installiert ihn in ein Wegwerf-Projekt und importiert **ausschließlich daraus** — ein grüner Testlauf allein bewiese von diesen drei Findings kein einziges. Der Block ist ohne Heredoc geschrieben, räumt hinter sich auf und veröffentlicht nichts:
  ```bash
  pnpm world
  T=$(mktemp -d); npm pack --pack-destination "$T" >/dev/null
  mkdir -p "$T/node_modules/@spearwolf/signalize"
  tar -xzf "$T"/spearwolf-signalize-*.tgz -C "$T/node_modules/@spearwolf/signalize" --strip-components=1
  ln -s "$PWD/node_modules/@spearwolf/eventize" "$T/node_modules/@spearwolf/eventize"
  tar -tzf "$T"/spearwolf-signalize-*.tgz | sed 's|^package/||' | grep -v '/$' | sort > "$T/contents.txt"
  echo "--- Dateien im Tarball: $(wc -l < "$T/contents.txt")  (erwartet 42)"
  grep -E 'remediation-plan|^lib/.*\.js$|^lib/.*\.js\.map$|assert-helpers|^\.claude/|CONTRIBUTING|CODE_OF_CONDUCT' "$T/contents.txt" && echo 'FEHLER: totes Gewicht im Tarball' || echo 'ok: kein totes Gewicht'
  for f in dist/index.js dist/decorators.js lib/index.d.ts lib/decorators.d.ts package.json README.md CHANGELOG.md LICENSE; do grep -qx "$f" "$T/contents.txt" || echo "FEHLT: $f"; done
  printf '{"type":"module"}\n' > "$T/package.json"
  ( cd "$T" && node --input-type=module -e "
  import {createSignal, createEffect, destroySignal} from '@spearwolf/signalize';
  import {signal} from '@spearwolf/signalize/decorators';
  const sig = createSignal(1); let seen = 0;
  createEffect(() => { seen = sig.get(); });
  sig.set(42); destroySignal(sig);
  if (seen !== 42 || typeof signal !== 'function') { console.error('FEHLER: Consumer-Probe'); process.exit(1); }
  console.log('ok: beide Entrypoints laufen aus dem Tarball');
  " )
  printf '%s\n' "import {createSignal} from '@spearwolf/signalize';" "import {signal} from '@spearwolf/signalize/decorators';" "const s = createSignal<number>(1); const n: number = s.get(); void n; void signal;" > "$T/probe.ts"
  printf '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","target":"ES2023","lib":["ES2023","DOM","DOM.Iterable"],"types":[],"strict":true,"strictNullChecks":false,"noEmit":true},"include":["probe.ts"]}\n' > "$T/tsconfig.json"
  ./node_modules/.bin/tsc -p "$T/tsconfig.json" && echo "ok: Typen loesen aus dem Tarball auf"
  rm -rf "$T"
  git status --porcelain --untracked-files=all
  ```
  Erwartet: `pnpm world` grün über alle neun Schritte, dann `42`, `ok: kein totes Gewicht`, keine `FEHLT:`-Zeile, `ok: beide Entrypoints laufen aus dem Tarball`, `ok: Typen loesen aus dem Tarball auf` und ein `git status`, das nur die Änderungen dieses Pakets zeigt. Gegen den heutigen Stand liefert derselbe Block `125` und 58 Treffer auf tote Dateien, am 2026-08-09 so gemessen — daran sieht man, dass er wirklich misst. Zwei Punkte zur Probe selbst: `lib: ["ES2023", "DOM", "DOM.Iterable"]` steht dort **absichtlich**, weil `lib/SignalLink.d.ts` heute `AbortSignal` ohne mitgelieferte Lib referenziert und die Probe sonst an BUILD-005 scheitern würde, einem Defekt, den dieses Paket nicht besitzt (Paket 5 zieht das nach). Und das `ln -s` auf `@spearwolf/eventize` hält die Probe offline: es geht nichts an eine Registry, `npm pack` schreibt nur nach `$T`, ein `npm publish` kommt nirgends vor.
- Commit: `build: ship an allowlisted tarball and keep the test helper out of the package (BUILD-001, BUILD-006, ARCH-004)`
- **Ergebnis (2026-08-09)** — Hash `5f4c363`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün (44 Dateien / 478 Tests in `test` und `test:gc`, Coverage 98,83 / 93,65 / 99,51 / 99,34, `attw` grün für beide Entrypoints), `npm pack --dry-run` meldet **42 Dateien, 319,6 kB ausgepackt, 95,8 kB gepackt** gegen 125 Dateien und 570,6 kB vorher. Review: BUILD-001, BUILD-006 und ARCH-004 erfüllt; der Reviewer hat Tarball-Listing, Consumer-Probe und Threshold-Gruppen unabhängig nachgefahren und repo-weit nach verbliebenen `assert-helpers`-Importen gesucht — nur der Selbstbezug in der eigenen Spec ist übrig.
- Zusatzbefund aus der Vorabmessung, mitbehoben: `.claude/settings.local.json` (74 B) lag im Tarball — eine von git nicht verfolgte lokale Datei, die die Denylist nicht kannte. Das Audit hatte sie nicht gesehen; die Allowlist schließt sie mit aus.
- Kleine Befunde aus dem Review, keine Runde ausgelöst:
  - `AGENTS.md:195` und `:199` — die Zeilenverweise auf `vitest.config.ts:97` und `:126` zeigen nach der Erweiterung von `coverageExclude` daneben, korrekt wären 101 und 130. Genau die Drift, die der Optimierungsteil des Audits meint. **Gehört nach Paket 29** und wird dort mit erledigt, zusammen mit der Grundsatzfrage, ob solche Verweise überhaupt in die Prosa gehören.
  - `package.json:12-13` — `"docs"` und `"skills"` stehen als ganze Verzeichnisse ohne Glob-Einschränkung in der Allowlist; jede künftig dort abgelegte Datei geht ungefragt mit. Geerbtes Restrisiko aus der Audit-Empfehlung, heute ohne Wirkung (beide Verzeichnisse enthalten nichts Unerwartetes). Für das nächste Audit vermerkt.
  - `src/SignalGroup.ts:852` — die JSDoc-Zeile mit dem neuen Pfad ist über 100 Zeichen lang. Biome greift bei Kommentaren nicht ein; kosmetisch, Paket 29.
- Planänderung (2026-08-09): keine an Reihenfolge oder Schnitt — das Paket bleibt eins, weil die Allowlist und das Verschieben des Helfers dieselbe Frage beantworten und im selben Tarball nachgewiesen werden. Zwei Notizen an Paket 5, dort eingetragen: die Ausweitung des `files`-Eintrags auf die Declaration-Maps und die Wiederverwendung der Consumer-Probe für BUILD-005. Ein Nebenbefund für Paket 29: `AGENTS.md:5` sagt, `skills/using-signalize/` werde »auch im npm-Paket ausgeliefert« — das stimmt nach diesem Paket weiterhin, ist aber die einzige Aussage im Repo über den Paketinhalt und steht an der falschen Stelle; Schritt 10 legt die richtige an.

<details>
<summary>BUILD-001, BUILD-006 und ARCH-004 im Volltext (aus <code>audit.html</code>)</summary>

**BUILD-001 — .npmignore-Denylist durch eine files-Allowlist ersetzen**
Severity: high · Kategorie: Projektaufbau & Build · Effort: S
Location: `.npmignore:1` · `package.json:9`

> Der Paketinhalt wird per Denylist gesteuert: jede neue Datei im Repo-Root landet standardmäßig im Tarball. Genau das ist passiert — `remediation-plan.md` mit 256 772 Bytes macht 37,8 % des ausgepackten Pakets aus, ein internes Planungsdokument, das jeder Konsument mitinstalliert. `audit.html`, `AGENTS.md`, `CLAUDE.md` und `biome.json` stehen in der Liste, `remediation-plan.md` nicht. Der Mechanismus garantiert die Wiederholung.

> Empfehlung: `.npmignore` löschen und in `package.json` ein `"files": ["dist", "lib/**/*.d.ts", "docs", "skills", "README.md", "CHANGELOG.md", "LICENSE"]` setzen; danach `npm pack --dry-run` als Gegenprobe.

> Evidence: `npm pack --dry-run` → `npm notice 256.8kB remediation-plan.md`, total files: 124, unpacked size: 679.2 kB

**BUILD-006 — Die toten lib/*.js und lib/*.js.map aus dem Tarball werfen**
Severity: medium · Kategorie: Projektaufbau & Build · Effort: S
Location: `package.json:6` · `package.json:10-19`

> `exports`, `main` und `module` zeigen ausschließlich auf `dist/*.js`; aus `lib/` werden nur die `.d.ts` gebraucht. Ausgeliefert werden trotzdem alle 40 tsc-Ausgabedateien plus Maps: 60 607 + 62 197 Bytes = 18,1 % des Pakets, gegenüber 8,1 % für den tatsächlichen Runtime-Code in `dist/`. Kein Auflösungspfad erreicht diese Dateien.

> Empfehlung: In der `files`-Allowlist nur `lib/**/*.d.ts` aufnehmen (bzw. `lib/**/*.js*` in der Denylist ergänzen, solange sie bleibt).

> Evidence: Byte-Aufschlüsselung: dist (runtime) 55059 8,1 % | lib .js (tot) 60607 8,9 % | lib .js.map (tot) 62197 9,2 % | lib .d.ts 19317 2,8 %

**ARCH-004 — Den Test-Helfer aus der kompilierten Bibliothek heraushalten**
Severity: medium · Kategorie: Architektur & Struktur · Effort: S
Location: `src/assert-helpers.ts:41` · `tsconfig.lib.json:4` · `vitest.config.ts:38`

> `tsconfig.lib.json` schließt nur `src/**/*.spec.ts` aus, also kompiliert `assert-helpers.ts` — in `AGENTS.md` als »Test-only« dokumentiert — nach `lib/` und wird ausgeliefert. Das emittierte JavaScript ruft das globale `expect` von Vitest ohne Import auf; über die `exports`-Map ist es nicht erreichbar, das publizierte Paket trägt also ein Modul, das beim Laden mit einem `ReferenceError` abbrechen würde. Weil `coverage.include` auf `src/**/*.ts` steht, zählt die Datei zusätzlich als Produktionscode im Coverage-Nenner.

> Empfehlung: Nach `src/__testing__/` verschieben (oder umbenennen) und das Muster in `tsconfig.lib.json` → `exclude` und `vitest.config.ts` → `coverage.exclude` aufnehmen.

</details>

#### [x] 5. Der Deklarations-Build liefert aus, was er soll
- Findings: BUILD-004 (high), BUILD-011 (medium), BUILD-005 (medium), BUILD-007 (medium)
- Ziel: JSDoc erreicht den Konsumenten-Tooltip, `@internal` verschwindet aus den Typen, `AbortSignal` löst auf, und keine Sourcemap zeigt mehr ins Leere.
- Bereich: `tsconfig.json`, `tsconfig.lib.json`, `rollup.config.mjs`, `package.json`
- Hängt ab von: Paket 4 (`removeComments` und `stripInternal` wirken nur zusammen, und die Allowlist entscheidet, welche Maps überhaupt mitgehen)
- Anmerkung (2026-08-09, aus Paket 4), zwei Übergaben:
  - **Die Declaration-Maps müssen in die Allowlist zurückgeholt werden.** Paket 4 setzt `"lib/**/*.d.ts"` in `package.json#files`, und dieser Glob matcht `*.d.ts.map` nicht — die 26 Maps (20 566 Bytes) sind ab dann draußen. Das ist heute richtig, weil sie ohne `sourcesContent` auf ein nicht mitgeliefertes `../src/*.ts` zeigen. In dem Moment, in dem BUILD-007 `sourcesContent` einschaltet, werden sie brauchbar und müssen wieder mit: den Eintrag auf `"lib/**/*.d.ts*"` erweitern oder `"lib/**/*.d.ts.map"` danebenstellen. Ohne diesen Schritt repariert das Paket eine Datei, die keinen Konsumenten mehr erreicht. Für `sourcemap: true` im Rollup-Output ist dagegen nichts zu tun: der Eintrag `"dist"` liefert das ganze Verzeichnis aus, `dist/*.js.map` geht von selbst mit. `lib/*.js.map` bleibt draußen und soll es bleiben — die zugehörigen `lib/*.js` sind nach BUILD-006 nicht mehr im Paket.
  - **Die Consumer-Probe aus Paket 4 ist die fertige Gegenprobe für BUILD-005.** Verify von Paket 4 packt den Tarball, entpackt ihn in ein Wegwerf-`node_modules` und typprüft eine Probe-Datei dagegen — dort steht `lib: ["ES2023", "DOM", "DOM.Iterable"]`, nur damit die Probe nicht an BUILD-005 scheitert. Für dieses Paket denselben Block mit `lib: ["ES2023"]` und `"types": []` fahren. Gegen `c65deb4` gemessen, exakt die Meldung des Findings: `lib/SignalLink.d.ts(18,18)` und `(21,18)` je `TS2304: Cannot find name 'AbortSignal'`, dazu dieselbe Meldung aus `@spearwolf/eventize`. Die dritte gehört nicht uns und verschwindet durch diesen Fix nicht — beim Bewerten des Ergebnisses auseinanderhalten.
- Modell: mittlere Stufe — die vier Schalter sind mechanisch und unten mit exakten Werten hinterlegt, aber drei Dinge wollen jemanden, der hinschaut: der Zwei-Pass-Compile, der neue öffentliche Typ `AbortSignalLike` und die Frage, ob `stripInternal` mehr wegnimmt als gewollt. Alle drei sind am 2026-08-09 vollständig durchgemessen, nichts davon ist Neuland für den Implementierer.
- Hash: `91ab044`
- Dateien: `tsconfig.lib.json`, `tsconfig.types.json` (neu), `package.json`, `rollup.config.mjs`, `src/types.ts`, `src/SignalLink.ts`, `docs/api.md`, `docs/recipes.md`, `skills/using-signalize/references/api.md`, `AGENTS.md`, `README.md`, `CHANGELOG.md`. **`tsconfig.json` wird nicht angefasst** — Begründung in Schritt 1.
- Abgleich (2026-08-09):
  - **BUILD-004 unverändert**, Fundstelle verschoben: `removeComments: true` steht in `tsconfig.json:20`, nicht `:18` — Paket 1 hat `skipLibCheck` darüber eingefügt. Gemessen gegen `5f4c363` nach `pnpm dist`: die 25 `lib/*.d.ts` (19 040 Bytes) enthalten **null Kommentarzeilen**; die drei Treffer auf `*` in `lib/index.d.ts` sind `export *`-Zeilen. `lib/signal-core.d.ts` beginnt mit `import type {…}` und dann direkt `export declare const incSignalsCount`, exakt die Evidence des Audits. Nach dem Fix: 66 907 Bytes, `lib/effects.d.ts` trägt sieben `@param`.
  - **BUILD-011 unverändert.** `stripInternal` steht in keiner der drei tsconfigs; `src/` trägt 16 `@internal`-Marker (`Effect.ts:43`, `collect-errors.ts:56,72,90`, `SignalAutoMap.ts:77`, `signal-core.ts:42,73,89,127`, `SignalGroup.ts:40,96,148,230,438,855`), `lib/*.d.ts` trägt **null** — weil `removeComments` sie vorher wegwirft. Die Kopplung des Audits stimmt: erst BUILD-004, dann greift BUILD-011. **Was `stripInternal: true` tatsächlich entfernt**, gemessen als Diff der 25 `.d.ts` vor/nach (Kommentare herausgerechnet):
    - `collect-errors.d.ts`: `beginIsolatedDelivery`, `endIsolatedDelivery`, `collectDeliveryError` — die Datei verliert damit ihren gesamten Inhalt.
    - `Effect.d.ts`: die Methode `onDestroy(callback)` samt des dann unbenutzten `import type {VoidFunc}`.
    - `SignalAutoMap.d.ts`: der Typ `AutoMapResources`, die Property `[$autoMapResources]`, der Import von `$autoMapResources`.
    - `signal-core.d.ts`: `incSignalsCount`, `readSignal`, `writeSignal`, `signalImpl`; der Typimport schrumpft auf `SignalLike`.
    - `SignalGroup.d.ts`: der Typ `GroupResources`, `$groupResources`, `clearGroupFromFinalizer`, `$setParentGroup`, die Property `[$groupResources]`, die Methode `[$setParentGroup]` und der Getter `memberCounts`.
    **Gegenprobe, ob davon etwas gebraucht wird — vier unabhängige Belege, alle grün:** (a) keines der Symbole steht in `src/index.ts` oder `src/decorators.ts`, die beiden einzigen Entrypoints der `exports`-Map; ein Deep-Import ist mangels `"./*"`-Eintrag ohnehin nicht auflösbar. (b) `attw --pack --profile esm-only` bleibt 🟢 für `node16 (from ESM)` und `bundler`, beide Entrypoints. (c) Die Consumer-Probe (Runtime **und** `tsc`) läuft gegen den fertigen Tarball durch. (d) `pnpm test:smoke` typprüft `smoke/dist-smoke.test.ts` gegen genau diese gestrippten `lib/*.d.ts` und bleibt grün. Dokumentiert ist keines der Symbole: `docs/` und `README.md` kennen nur `onDestroyEffect` (eine andere Funktion), `signalImpl`/`writeSignal` stehen ausschließlich in `AGENTS.md:112,138` und `docs/architecture.md:169`, und die beschreiben `src/`, nicht die ausgelieferte Oberfläche. `memberCounts` liest nur `src/__testing__/assert-helpers.ts`, und das kompiliert gegen `src/`, wo `stripInternal` nichts tut.
  - **BUILD-005 unverändert**, Fundstelle verschoben: `lib/SignalLink.d.ts:18` und `:21` (Audit: 16,19); nach dem Fix von BUILD-004 wandern dieselben zwei Stellen auf `:62` und `:107`, weil das JSDoc dazwischenkommt. Die Consumer-Probe mit `lib: ["ES2023"]`, `types: []` gegen den Tarball von `5f4c363` liefert drei `TS2304: Cannot find name 'AbortSignal'`: zwei aus unserem `lib/SignalLink.d.ts`, eine aus `@spearwolf/eventize/lib/index.d.mts(261,14)`. Die dritte gehört nicht uns.
    **Die Audit-Empfehlung ist an dieser Stelle ein No-Op, gemessen.** `"lib": ["ES2023", "DOM"]` in `tsconfig.lib.json` ändert nichts: `tsconfig.json:12` führt bereits `["ES2023", "DOM", "DOM.Iterable"]`, der Deklarations-Build hat DOM also längst im Scope — das Problem liegt beim Konsumenten, und in die `.d.ts` schreibt `tsc` deshalb kein Wort. Auch die zweite Variante des Audits scheitert in ihrer naheliegenden Form: ein `/// <reference lib="dom" />` an den Kopf von `src/SignalLink.ts` gesetzt und neu kompiliert — die Direktive taucht in `lib/SignalLink.d.ts` **nicht** auf (0 Treffer). `tsc` reicht Lib-Referenzen nicht in die Deklarationsausgabe durch. Der Weg, der misst, steht in Schritt 6.
  - **BUILD-007 unverändert**, Fundstellen exakt: `tsconfig.lib.json:9` (`sourceMap`) und `:12` (`declarationMap`), `rollup.config.mjs:23-30` (der `output`-Block; die `:19` des Audits ist heute `input:`). `lib/index.d.ts.map` trägt `"sources":["../src/index.ts"]` und kein `sourcesContent`; `grep -c sourceMappingURL dist/*.js` liefert 0 für alle drei Dateien.
    **Der Kern der Entscheidung im Plankopf lässt sich nicht ausführen, und das ist gemessen.** `inlineSources: true` in `tsconfig.lib.json` bettet `sourcesContent` in `lib/*.js.map` ein — in `lib/*.d.ts.map` **nicht**, dort bleiben die Schlüssel `version, file, sourceRoot, sources, names, mappings`. `tsc` kennt keinen Schalter, der Quelltext in eine Declaration-Map schreibt; das ist keine Konfigurationsfrage, sondern eine Lücke im Emitter. Damit bleiben für die `.d.ts.map` genau zwei Wege — `src/` mitausliefern, oder die Maps für den Publish-Build abschalten. Siehe die Rückfrage unten; die Zahlen für beide stehen dort. Für die andere Hälfte des Findings ist die Entscheidung dagegen umsetzbar und gemessen: `sourcemap: true` im Rollup-Output erzeugt `dist/*.js.map` **mit** eingebettetem `sourcesContent` (Rollups Default `sourcemapExcludeSources: false`), die Maps sind also selbsttragend. Eine Einschränkung, die im Plan stehen soll: ihre `sources` zeigen auf `../lib/*.js`, nicht auf `../src/*.ts` — Rollup liest die `sourceMappingURL`-Kommentare seiner Eingabedateien ohne Plugin nicht und verkettet die tsc-Maps deshalb nicht. Ein `rollup-plugin-sourcemaps2` wäre eine neue direkte Dependency für einen Zwischenschritt, den der eingebettete Quelltext bereits lesbar macht; bewusst nicht genommen.
  - **Der teure Nebeneffekt von BUILD-004, den das Audit nicht nennt, und der Grund für den Zwei-Pass-Compile.** `removeComments` trennt nicht zwischen `.js`- und `.d.ts`-Ausgabe. Wer den Schalter in `tsconfig.lib.json` auf `false` stellt, bekommt das JSDoc auch in `lib/*.js` — und Rollup trägt es unverändert nach `dist/`. Gemessen: das JS in `dist/` wächst von **62 222 auf 172 371 Bytes** (`index.js` 15 925 → 56 137), und die Sourcemaps aus Schritt 4 kosten dann 246 330 statt 125 125 Bytes — der Tarball landet bei rund 724 kB ausgepackt statt bei 492. Das Runtime-Bundle verdreifacht sich für Kommentare, die dort niemand liest — die Tooltips kommen aus `lib/*.d.ts`. Mit dem Zwei-Pass-Compile aus Schritt 1 bleibt `dist/*.js` bei 62 342 Bytes (die 120 Bytes sind die `sourceMappingURL`-Zeilen). Beide tsc-Läufe dauern je 0,2 s; der zweite Pass kostet nichts, was messbar wäre.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git checkout` hat `package.json`, `tsconfig.lib.json`, `rollup.config.mjs`, `src/SignalLink.ts` und `src/types.ts` zurückgeholt, `tsconfig.types.json` ist gelöscht, `lib/` und `dist/` sind aus `5f4c363` neu gebaut. `npm pack` schrieb ausschließlich in Wegwerf-Verzeichnisse; es wurde nichts veröffentlicht.
- Vorgehen:
  1. **Der Deklarations-Build bekommt einen eigenen Pass.** `tsconfig.json` bleibt unverändert — `removeComments: true` gilt weiter für den JS-Pass und für `smoke/tsconfig.json`, das davon erbt. Statt eines Schalters wandert die Deklarationsausgabe in eine eigene Config, weil `removeComments` und `stripInternal` nur die `.d.ts` betreffen sollen und der Grund dafür oben in Zahlen steht. `tsconfig.lib.json` verliert dafür die drei Declaration-Zeilen und wird zum reinen JS-Pass:
     ```json
     {
       "extends": "./tsconfig.json",
       "include": ["src/**/*.ts"],
       "exclude": ["src/**/*.spec.ts", "src/__testing__/**"],

       "compilerOptions": {
         "rootDir": "./src",
         "outDir": "lib",
         "sourceMap": true,
         "isolatedModules": true
       }
     }
     ```
     `declaration`, `declarationDir` und `declarationMap` müssen zusammen verschwinden: `declarationDir` ohne `declaration` bricht mit `TS5069` ab.
  2. Neue Datei `tsconfig.types.json` im Repo-Root, zwei Leerzeichen Einrückung wie die Geschwister:
     ```json
     {
       "extends": "./tsconfig.lib.json",

       "compilerOptions": {
         "emitDeclarationOnly": true,
         "sourceMap": false,
         "declaration": true,
         "declarationDir": "lib",
         "declarationMap": true,
         "removeComments": false,
         "stripInternal": true
       }
     }
     ```
     `sourceMap: false` ist Pflicht, nicht Kosmetik — der Wert wird aus `tsconfig.lib.json` geerbt und verträgt sich nicht mit `emitDeclarationOnly`. `stripInternal` steht **nur** hier: im JS-Pass hätte es keine Wirkung, und doppelt gepflegt driftet es. Der Wert von `declarationMap` hängt an der Rückfrage unten.
  3. `package.json#scripts`: `"compile"` wird zum Zweiteiler, die beiden Pässe stehen daneben und behalten die Reihenfolge (JS zuerst, weil Rollup `lib/index.js` liest):
     ```json
     "compile": "run-s -sn compile:js compile:types",
     "compile:js": "tsc --project tsconfig.lib.json",
     "compile:types": "tsc --project tsconfig.types.json",
     ```
     Sonst ändert sich an den Scripts nichts: `dist`, `cbt` und `world` rufen `compile` auf und ziehen den zweiten Pass automatisch mit, `clean` löscht `lib` bereits vollständig.
  4. `rollup.config.mjs`, im `output`-Block direkt hinter `format: 'es',` (heute Zeile 29): `sourcemap: true,`. Kein `sourcemapExcludeSources`, kein `sourcemapPathTransform` — der Default bettet den Quelltext ein, und genau das macht die Maps selbsttragend.
  5. `package.json#files`: siehe Rückfrage. Im vorgeschlagenen Zuschnitt bleibt die Liste **unverändert** — `"dist"` nimmt `dist/*.js.map` von selbst mit, und ohne Declaration-Maps gibt es nichts nachzuholen. Die Übergabe-Notiz aus Paket 4 ist damit beantwortet, wenn auch anders als dort erwartet.
  6. **BUILD-005: eine strukturelle Sicht auf `AbortSignal`, kein Lib-Verweis.** Beide Wege des Audits sind oben widerlegt; der dritte ist gemessen und hält. In `src/types.ts` ans Ende:
     ```ts
     /**
      * The structural subset of the standard `AbortSignal` that `nextValue()`
      * and `asyncValues()` actually touch.
      *
      * Named as its own type rather than referencing the global `AbortSignal`:
      * that global lives in `lib.dom.d.ts` or in `@types/node`, and a consumer
      * compiling against plain `"lib": ["ES2023"]` has neither — the published
      * declarations would not resolve for them (BUILD-005). Every real
      * `AbortSignal`, DOM or Node, satisfies this shape.
      */
     export interface AbortSignalLike {
       readonly aborted: boolean;
       readonly reason?: unknown;
       addEventListener(
         type: 'abort',
         listener: () => void,
         options?: {once?: boolean},
       ): void;
       removeEventListener(type: 'abort', listener: () => void): void;
     }
     ```
     Der Typ geht über `export type * from './types.js'` automatisch in die öffentliche Oberfläche. In `src/SignalLink.ts` den Typimport auf `import {AbortSignalLike, ISignalImpl, SignalLike} from './types.js';` erweitern (heute Zeile 16) und die beiden Signaturen umstellen: `nextValue(options?: {signal?: AbortSignalLike})` (Zeile 182) und der Parameter `options?: {signal?: AbortSignalLike},` in `asyncValues()` (Zeile 302). Am Rumpf ändert sich nichts — `aborted`, `reason`, `addEventListener`, `removeEventListener` sind genau die vier Member, die der Code benutzt. Kein Breaking Change: gemessen mit zwei Proben gegen den fertigen Tarball, einmal mit `lib: ["ES2023","DOM","DOM.Iterable"]` und `new AbortController().signal`, einmal mit `types: ["node"]` und Nodes `AbortSignal`, beide an `nextValue()` **und** `asyncValues()` übergeben — beide `tsc`-Läufe Exit 0. Die Meldung aus `@spearwolf/eventize` bleibt; sie gehört nicht uns.
  7. Die zwei JSDoc-Blöcke in `src/SignalLink.ts`, die von einem `AbortSignal` sprechen (Zeile 165 zu `nextValue()`, Zeile 264 zu `asyncValues()`): der Satz bleibt stehen, an der ersten Nennung je Block einen Halbsatz anhängen, dass der Parametertyp `AbortSignalLike` heißt und jedes echte `AbortSignal` ihn erfüllt. Die Prosa erklärt weiter das Verhalten, nicht die Typkosmetik.
  8. Doku, in der Reihenfolge aus `CLAUDE.md` → »When the public API changes«. Jeweils nur die betroffene Stelle, keine Neuformulierung:
     - `docs/api.md:371` (»`options.signal` — an `AbortSignal` — aborts the wait«): den Typnamen nachziehen wie in Schritt 7.
     - `docs/api.md`, die Typtabelle ab Zeile 655: eine neue Tabellenzeile für `AbortSignalLike`, Bedeutung »Structural subset of `AbortSignal` accepted by `nextValue()` / `asyncValues()`.«, sinnvoll direkt unter der Zeile zu `SignalLink<T>`, `ValueCallback<T>`.
     - `docs/recipes.md:594`: dieselbe Ergänzung wie in `api.md:371`.
     - `skills/using-signalize/references/api.md:163` (die Kommentarzeile zu `con.nextValue({signal})`) und die Liste der type-only Re-Exports in `:36-40`, in die `AbortSignalLike` gehört.
     - `docs/cheat-sheet.md` und `README.md` nennen `AbortSignal` nicht und bleiben unberührt — geprüft, nicht vermutet.
  9. `AGENTS.md`, drei Stellen:
     - Zeile 174, die Kommandotabelle: `pnpm compile` ist jetzt `run-s compile:js compile:types` — der erste Pass schreibt `lib/*.js` und `lib/*.js.map` für Rollup, der zweite `lib/*.d.ts`. Die beiden neuen Scripts als eigene Zeilen darunter.
     - Ein Satz im Abschnitt »Development workflow«, warum es zwei Pässe sind: `removeComments` trennt `.js` und `.d.ts` nicht, und Kommentare im Bundle kosteten 110 kB.
     - **Der wichtigste Satz des Pakets für alles, was danach kommt:** `@internal` ist ab jetzt kein Kommentar mehr, sondern ein Schalter. `stripInternal` entfernt jedes so markierte Symbol aus den ausgelieferten Typen; ein `@internal` an einer öffentlichen Stelle nimmt Konsumenten stillschweigend eine Deklaration weg, und `attw` merkt das nicht. Gehört in denselben Abschnitt, in dem Paket 4 den Tarball-Inhalt festgehalten hat.
     - Ebenda die Tarball-Zahlen von Paket 4 nachziehen (42 Dateien / 319 kB → die gemessenen Werte dieses Pakets), mit Datum.
  10. `README.md:334`, Zeile `| `pnpm compile` | `tsc` → `lib/` (types + sourcemaps) |`: auf die zwei Pässe umstellen, sonst nichts.
  11. `CHANGELOG.md`, unter `## Unreleased` → `### Build System`, vier Zeilen, eine Zeile ein Fakt:
      - the published `.d.ts` finally carry their JSDoc — `removeComments` no longer applies to the declaration build, so every documented symbol reaches the consumer's tooltip (BUILD-004)
      - `@internal` symbols are stripped from the published types: `Effect#onDestroy`, `SignalGroup#memberCounts`, `clearGroupFromFinalizer`, the `signal-core` leaf functions and the `collect-errors` helpers are no longer in autocomplete (BUILD-011)
      - `nextValue()` and `asyncValues()` take an `AbortSignalLike` instead of the global `AbortSignal`, so the types resolve for a consumer on plain `"lib": ["ES2023"]` without `@types/node` (BUILD-005)
      - `dist/` ships sourcemaps with the source embedded; `lib/` no longer ships a declaration map that points at files the package does not contain (BUILD-007)
      Die dritte Zeile ist bewusst **kein** Breaking Change: jedes echte `AbortSignal` bleibt zuweisbar, gemessen gegen DOM und `@types/node`.
- Verify: aus dem Repo-Root, zwei Teile. Der erste zeigt, dass nichts kaputt ist; der zweite packt den Tarball, entpackt ihn in ein Wegwerf-`node_modules` und belegt jedes der vier Findings einzeln an der ausgelieferten Datei — ein grüner Testlauf allein bewiese von diesen vier kein einziges. Ohne Heredoc geschrieben, räumt hinter sich auf, veröffentlicht nichts:
  ```bash
  pnpm world
  T=$(mktemp -d); npm pack --pack-destination "$T" >/dev/null
  mkdir -p "$T/node_modules/@spearwolf/signalize"
  tar -xzf "$T"/spearwolf-signalize-*.tgz -C "$T/node_modules/@spearwolf/signalize" --strip-components=1
  ln -s "$PWD/node_modules/@spearwolf/eventize" "$T/node_modules/@spearwolf/eventize"
  P="$T/node_modules/@spearwolf/signalize"
  npm pack --dry-run 2>&1 | grep -E 'total files|unpacked size|package size'
  grep -q '@param' "$P/lib/effects.d.ts" && echo 'ok BUILD-004: JSDoc steht in den ausgelieferten Typen' || echo 'FEHLER BUILD-004: kein JSDoc'
  python3 -c "
  import re,glob
  pat=re.compile('memberCounts|clearGroupFromFinalizer|incSignalsCount|signalImpl|beginIsolatedDelivery|endIsolatedDelivery|collectDeliveryError|readSignal|writeSignal|onDestroy[(]')
  hits=[f.split('/')[-1] for f in glob.glob('$P/lib/*.d.ts') if pat.search(re.sub(r'/\*.*?\*/','',open(f).read(),flags=re.S))]
  print('FEHLER BUILD-011: internes Symbol in den Typen: '+', '.join(hits) if hits else 'ok BUILD-011: kein @internal-Symbol in den Typen')
  "
  grep -c sourceMappingURL "$P"/dist/index.js "$P"/dist/decorators.js
  python3 -c "import json,sys;d=json.load(open('$P/dist/index.js.map'));print('ok BUILD-007: dist-Map traegt Quelltext' if d.get('sourcesContent') and d['sourcesContent'][0] else 'FEHLER BUILD-007: dist-Map ohne sourcesContent')"
  grep -l sourceMappingURL "$P"/lib/*.d.ts && echo 'FEHLER BUILD-007: tote Map-Referenz im ausgelieferten .d.ts' || echo 'ok BUILD-007: keine tote Map-Referenz'
  printf '{"type":"module"}\n' > "$T/package.json"
  ( cd "$T" && node --input-type=module -e "
  import {createSignal, createEffect, destroySignal} from '@spearwolf/signalize';
  import {signal} from '@spearwolf/signalize/decorators';
  const sig = createSignal(1); let seen = 0;
  createEffect(() => { seen = sig.get(); });
  sig.set(42); destroySignal(sig);
  if (seen !== 42 || typeof signal !== 'function') { console.error('FEHLER: Consumer-Probe'); process.exit(1); }
  console.log('ok: beide Entrypoints laufen aus dem Tarball');
  " )
  printf '%s\n' "import {createSignal, link} from '@spearwolf/signalize';" "import {signal} from '@spearwolf/signalize/decorators';" "const s = createSignal<number>(1); const n: number = s.get(); void n; void signal;" "const con = link(s, () => {});" "export async function useIt() { await con.nextValue(); }" > "$T/probe.ts"
  printf '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","target":"ES2023","lib":["ES2023"],"types":[],"strict":true,"strictNullChecks":false,"noEmit":true},"include":["probe.ts"]}\n' > "$T/tsconfig.json"
  ./node_modules/.bin/tsc -p "$T/tsconfig.json" > "$T/tsc.log" 2>&1
  grep -q 'signalize/lib/.*TS2304' "$T/tsc.log" && echo 'FEHLER BUILD-005: AbortSignal loest in unseren Typen nicht auf' || echo 'ok BUILD-005: unsere Typen loesen ohne DOM und ohne @types/node auf'
  grep -c 'eventize.*TS2304' "$T/tsc.log"
  printf '%s\n' "import {createSignal, link} from '@spearwolf/signalize';" "const s = createSignal<number>(1); const con = link(s, () => {});" "const ac = new AbortController();" "export async function useDom() { await con.nextValue({signal: ac.signal}); for await (const v of con.asyncValues(undefined, {signal: ac.signal})) { void v; } }" > "$T/abort.ts"
  printf '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","target":"ES2023","lib":["ES2023","DOM","DOM.Iterable"],"types":[],"strict":true,"strictNullChecks":false,"noEmit":true},"include":["abort.ts"]}\n' > "$T/tsconfig.dom.json"
  ./node_modules/.bin/tsc -p "$T/tsconfig.dom.json" && echo 'ok: echtes AbortSignal bleibt zuweisbar'
  rm -rf "$T"
  git status --porcelain --untracked-files=all
  ```
  Der `python3`-Block ist bewusst kein `grep`: nach BUILD-004 stehen die internen Namen weiterhin in JSDoc-Prosa (`lib/EffectImpl.d.ts` nennt `onDestroy()` im Fließtext), ein direkter `grep` schlägt dort falsch an. Beide Formen am 2026-08-09 gegeneinander laufen lassen — der `grep` meldet einen Treffer, den es nicht gibt, der kommentarbereinigte Ausdruck meldet gegen den gefixten Build sauber und gegen die 25 `.d.ts` aus `5f4c363` die vier tatsächlich betroffenen Dateien.
  Erwartet: `pnpm world` grün über alle neun Schritte (44 Dateien / 478 Tests, Coverage unverändert 98,83 / 93,65 / 99,51 / 99,34, `attw` 🟢 für beide Entrypoints), dann `45` Dateien / `491.9 kB` ausgepackt / `133.6 kB` gepackt, `ok BUILD-004`, `ok BUILD-011`, je `1` Treffer auf `sourceMappingURL` in den beiden Entry-Chunks, `ok BUILD-007` zweimal, `ok: beide Entrypoints laufen aus dem Tarball`, `ok BUILD-005`, genau `1` verbleibende `TS2304` aus `@spearwolf/eventize` (fremd, bleibt), `ok: echtes AbortSignal bleibt zuweisbar` und ein `git status`, das nur die Änderungen dieses Pakets zeigt. Gegen `5f4c363` liefert derselbe Block `42` Dateien, `FEHLER BUILD-004`, `FEHLER BUILD-011`, `0`/`0` auf `sourceMappingURL` in `dist/`, `FEHLER BUILD-007` und `FEHLER BUILD-005` — am 2026-08-09 so gemessen, daran sieht man, dass er wirklich misst. Wird die Rückfrage zugunsten von Variante C entschieden, ändern sich zwei Erwartungen: `95` Dateien / `696.2 kB` / `183.1 kB`, und die Zeile zur toten Map-Referenz kippt in ihr Gegenteil — dann muss `lib/index.d.ts.map` da sein und ihr `sources`-Eintrag auf eine **existierende** Datei im Tarball zeigen.
- Commit: `build: ship documented, internal-free declarations and sourcemaps that resolve (BUILD-004, BUILD-011, BUILD-005, BUILD-007)`
- **Ergebnis (2026-08-09)** — Hash `91ab044`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün (44 Dateien / 478 Tests in `test` und `test:gc`, Coverage 98,83 / 93,65 / 99,51 / 99,34, `attw` grün für beide Entrypoints), `npm pack --dry-run` meldet **45 Dateien, 493,8 kB ausgepackt, 134,2 kB gepackt**. Gegen `5f4c363` lieferte derselbe Block `FEHLER` für alle vier Findings und 42 Dateien. Review: BUILD-004, BUILD-011, BUILD-005 und BUILD-007 erfüllt — der Reviewer hat JSDoc in fünf `.d.ts` gegengelesen, die Liste der gestrippten `@internal`-Symbole gegen die Planvorgabe gehalten, die Consumer-Probe in drei Varianten gefahren (ohne Libs, mit DOM, mit `@types/node`) und `pnpm bundle` auf Zyklen geprüft.
- Runde 1 (2026-08-09): Der Reviewer fand in `AGENTS.md:185` die *geplante* statt der *gemessenen* Tarball-Zahl. Derselbe Implementierer hat sie auf 493,8 / 134,2 gezogen und `CHANGELOG.md`, `README.md` sowie die drei Doku-Dateien nach einer zweiten Fundstelle abgesucht — es gab keine. Genau die Sorte Zahl, die der Optimierungsteil des Audits meint.
- Zwei Erkenntnisse aus diesem Paket, die das Audit nicht hatte: `removeComments` trennt `.js` und `.d.ts` nicht, der naive Fix hätte `dist/` von 62 auf 172 kB gebläht — daher der Zwei-Pass-Compile über `tsconfig.types.json`. Und `stripInternal` ist ab jetzt scharf: eine falsch gesetzte `@internal`-Markierung entfernt still ein Symbol aus den ausgelieferten Typen, ohne dass `attw` oder ein Test anschlägt. Der Satz steht in `AGENTS.md` und gilt für jedes Paket ab 20, das an der öffentlichen Oberfläche arbeitet.
- **Rückfrage — beantwortet am 2026-08-09: der Nutzer hat Variante A gewählt.** `declarationMap: false` im Publish-Pass; die Erwartungen im Verify-Block gelten unverändert (45 Dateien / 491,9 kB / 133,6 kB). Variante C entfällt. Ebenfalls freigegeben: der gemessene Ersatzweg für BUILD-005, das strukturelle `AbortSignalLike` in `src/types.ts` — die wörtliche Audit-Empfehlung ist als No-Op widerlegt. Beides steht jetzt auch im Abschnitt »Entscheidungen« im Kopf. Der Text unten bleibt als Begründung stehen.
- **Rückfrage (2026-08-09, beantwortet) — was mit den Declaration-Maps passiert.** Die Zeile in »Entscheidungen« lautet »`sourcesContent` aktivieren und die Maps behalten«. Die Messung nimmt ihr die Grundlage: `tsc` schreibt `sourcesContent` nur in `.js.map`, nie in `.d.ts.map` (mit `inlineSources: true` nachgeprüft, die Datei behält ihre sechs Schlüssel). Es gibt keinen Schalter, der das ändert. Damit stehen zwei Wege offen, und beide weichen von der Entscheidung ab:
  - **Variante A — `declarationMap: false` im Publish-Pass (Vorschlag).** Die `.d.ts` tragen dann gar keinen `sourceMappingURL`-Kommentar mehr, die tote Referenz ist restlos weg statt nur ausgeblendet. Tarball: **45 Dateien, 491,9 kB ausgepackt, 133,6 kB gepackt**. »Go to Definition« landet in `lib/index.d.ts` — was nach BUILD-004 ein deutlich besseres Ziel ist als vorher, weil dort jetzt das JSDoc steht. Für die Empfehlung spricht auch die Symmetrie zu Paket 4: das hat gerade `lib/*.js` als dritte, überflüssige Form derselben Bibliothek aus dem Paket geworfen; `src/` mitzuliefern holte sie als vierte wieder herein.
  - **Variante C — `src/` ohne Specs mitausliefern und die Maps behalten.** `files` bekommt `"lib/**/*.d.ts*"`, `"src/**/*.ts"`, `"!src/**/*.spec.ts"`, `"!src/__testing__"` (npms Negation funktioniert, gemessen: genau 25 Quelldateien, keine Spec). Die `sources`-Einträge zeigen dann auf existierende Dateien, und ein Ctrl-Klick landet im echten `src/createSignal.ts`. Kosten: **95 Dateien, 696,2 kB ausgepackt, 183,1 kB gepackt** — gegenüber Variante A +50 Dateien, +204,3 kB ausgepackt, +49,5 kB gepackt. Das ist der Preis dafür, dass eine Declaration-Map überhaupt funktionieren kann; ein Mittelweg »Maps ja, Quellen nein« liefert 20,3 kB Daten aus, die auf nichts zeigen, und scheidet aus.
  Beide Varianten sind vollständig durchgemessen, `pnpm world` und `attw` sind in beiden grün. Der Rest des Pakets hängt nicht daran und kann unverändert bleiben. Ohne Antwort wird Variante A gebaut.
- Planänderung (2026-08-09): keine an Reihenfolge oder Schnitt. Das Paket bleibt eins — die vier Schalter greifen ineinander (BUILD-011 wirkt erst nach BUILD-004, und beide leben ab Schritt 1 in derselben neuen Config) und werden an einem einzigen Tarball nachgewiesen. Drei Notizen nach vorn:
  - **An alle Pakete ab 20:** `@internal` wird in diesem Paket scharf geschaltet. Wer künftig eine Markierung setzt, entfernt damit ein Symbol aus den ausgelieferten Typen; wer eine an einer öffentlichen Stelle setzt, bricht Konsumenten, ohne dass `attw` oder der Testlauf anschlagen. Schritt 9 schreibt den Satz nach `AGENTS.md`.
  - **An Paket 28** (API-015, JSDoc für die sieben `Signal`-Member): das Paket wird durch dieses hier erst wirksam. Vorher wäre das neue JSDoc in der Deklarationsausgabe verschwunden.
  - **An Paket 29:** `sourceMap: true` in `tsconfig.lib.json:9` erzeugt 25 `lib/*.js.map` (66 kB), die niemand liest — Rollup verkettet sie nicht, ausgeliefert werden sie nicht, und `--enable-source-maps` steht in keinem Script. Kein Finding des Audits, aber dieselbe Klasse von Angabe, die dort aufgeräumt wird. Ebenfalls dorthin: `README.md:334` und `AGENTS.md:174` beschreiben `pnpm compile` als einen `tsc`-Lauf; Schritt 9 und 10 ziehen das mit, weitere Stellen im selben Ton können dort auffallen.

<details>
<summary>BUILD-004, BUILD-011, BUILD-005 und BUILD-007 im Volltext (aus <code>audit.html</code>)</summary>

**BUILD-004 — removeComments für den Deklarations-Build abschalten**
Severity: high · Kategorie: Projektaufbau & Build · Effort: S
Location: `tsconfig.json:18`

> `removeComments: true` gilt auch für die Deklarationsausgabe. Die ausgelieferten `.d.ts` enthalten dadurch kein einziges JSDoc — die komplette, im Quelltext aufwendig gepflegte Dokumentation von `createEffect`, `createMemo`, `SignalGroup` und Konsorten erreicht keinen Konsumenten-Tooltip. Für eine Bibliothek, deren Doku-Disziplin bis in `skills/` durchdekliniert ist, ist das der teuerste Ein-Zeilen-Schalter im Projekt.

> Empfehlung: `removeComments` aus `tsconfig.json` entfernen oder in `tsconfig.lib.json` mit `"removeComments": false` überschreiben.

> Evidence: `lib/signal-core.d.ts` beginnt direkt mit `export declare const incSignalsCount: () => void;` · `grep -rn "@internal" lib/*.d.ts` → null Treffer, obwohl `src/` acht davon hat

**BUILD-011 — stripInternal setzen, damit interne Symbole nicht in den Typen stehen**
Severity: medium · Kategorie: Projektaufbau & Build · Effort: S
Location: `tsconfig.lib.json:5` · `src/Effect.ts:43-48` · `src/SignalGroup.ts:44-46` · `src/SignalGroup.ts:647` · `src/signal-core.ts:16`

> `stripInternal` ist in keiner tsconfig gesetzt, `@internal` ist damit reine Dekoration. `lib/Effect.d.ts` publiziert `onDestroy()` — dessen eigener JSDoc sagt, es sei nicht Teil der öffentlichen Oberfläche —, `lib/SignalGroup.d.ts` publiziert `memberCounts` und `clearGroupFromFinalizer`, `lib/signal-core.d.ts` die vier Leaf-Layer-Funktionen. Erreichbar sind sie über die `exports`-Map heute nicht — aber sie stehen in der Autovervollständigung, und jede spätere Entfernung ist ein Breaking Change, den niemand versprechen wollte.

> Empfehlung: `"stripInternal": true` in `tsconfig.lib.json` ergänzen — zusammen mit dem Abschalten von `removeComments`, sonst greift die Markierung nicht.

**BUILD-005 — AbortSignal in den ausgelieferten Typen auflösbar machen**
Severity: medium · Kategorie: Projektaufbau & Build · Effort: S · Status: carried-over
Location: `lib/SignalLink.d.ts:16,19` · `tsconfig.lib.json`

> Die ausgelieferten Deklarationen referenzieren `AbortSignal`, ohne dass das Paket die passende Lib mitbringt oder eine Referenz-Direktive setzt. Ein Konsument mit `"lib": ["ES2023"]` und ohne `@types/node` bekommt beim Compile `TS2304: Cannot find name 'AbortSignal'` aus *unseren* Typen — dieselbe Meldung noch einmal aus `@spearwolf/eventize`. Das ist ein Packaging-Defekt, der erst beim Konsumenten sichtbar wird, weil der eigene Build `@types/node` im Scope hat.

> Empfehlung: In `tsconfig.lib.json` `"lib": ["ES2023", "DOM"]` setzen (oder eine `/// <reference lib="dom" />` in einer Ambient-Datei ausliefern) und mit einer Consumer-Probe ohne `@types/node` gegenprüfen.

**BUILD-007 — Die Sourcemap-Situation reparieren — lib-Maps zeigen ins Leere, dist hat gar keine**
Severity: medium · Kategorie: Projektaufbau & Build · Effort: S
Location: `tsconfig.lib.json:9,12` · `rollup.config.mjs:19`

> `tsconfig.lib.json` erzeugt `sourceMap` und `declarationMap`, deren `sources` auf `../src/*.ts` zeigen, ohne `sourcesContent` einzubetten. `src/` wird nicht mitgeliefert, also laufen sämtliche 81 793 Bytes an Maps im Paket ins Nichts — auch »Go to Definition« auf einen Typ endet im Nirgendwo. Das eigentliche Runtime-Bundle in `dist/` hat umgekehrt überhaupt keine Sourcemaps.

> Empfehlung: Entweder `sourcesContent` aktivieren und die Maps behalten, oder sie für den Publish-Build abschalten; unabhängig davon `sourcemap: true` im Rollup-Output ergänzen.

> Evidence: `lib/index.d.ts.map` → `{"sources":["../src/index.ts"], …}` ohne `sourcesContent` · `grep -c sourceMappingURL dist/*.js` → 0 für alle drei Dateien

</details>

#### [x] 6. engines.node auf das senken, was der Code braucht
- Findings: BUILD-009 (medium)
- Ziel: Node 22 darf installieren.
- Bereich: `package.json`, `README.md`, `docs/quickstart.md`, `CLAUDE.md`, `CONTRIBUTING.md`
- Hängt ab von: —
- Modell: mittlere Stufe — im Grobplan stand die günstigste, weil das Paket nach »eine Zahl an fünf Stellen ersetzen« aussah. Es sind acht Doku-Stellen, und dazu kommt eine CI-Matrix, deren Artefaktnamen kollidieren, wenn man sie nicht mitzieht. Die Werte unten sind alle gemessen; gefragt ist jemand, der die Zeilennummern in `AGENTS.md` nach der eigenen Änderung neu abliest, statt sie abzuschreiben.
- Hash: `ce25766`
- Dateien: `package.json`, `README.md`, `docs/quickstart.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `skills/using-signalize/SKILL.md`, `.github/workflows/ci.yml`, `CHANGELOG.md`
- Abgleich (2026-08-09):
  - **BUILD-009 unverändert**, aber zwei der drei Fundstellen sind verrutscht. `engines.node` steht jetzt in `package.json:29-30` (Audit: `20-22`) — Paket 4 hat die `files`-Allowlist eingezogen und Paket 5 die `exports`-Map angefasst, beides oberhalb des Blocks. `README.md:93` (Audit: `91`) — die Zeilen davor sind in Paket 5 gewachsen. `docs/quickstart.md:10` stimmt unverändert. Der Wert ist an allen drei Stellen weiterhin `>=24.13`.
  - **Das Audit nennt drei Doku-Stellen; es sind acht.** Vollständige, am 2026-08-09 repo-weit erhobene Liste (`grep -rn` über `README.md`, `docs/`, `skills/`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `.github/`, `smoke/`, `bench/` nach `Node`, `>=24`, `24.13`): `package.json:29-30` · `README.md:93` · `README.md:314` · `docs/quickstart.md:10` · `CLAUDE.md:3` · `AGENTS.md:11` · `skills/using-signalize/SKILL.md:8` · `CONTRIBUTING.md:11`. Dazu `node-version: 24` in `.github/workflows/ci.yml:26` und `main.yml:29`. Nicht angefasst werden `audit.html:137` (Badge »Node >= 24.13« — das Audit ist ein Dokument seines Datums) und `CHANGELOG.md:182` (steht unter `## v0.31.0` und ist damit unveränderlich; die Korrektur wird ein neuer `## Unreleased`-Eintrag).
  - **Der Code hält `>=22`, und zwar gemessen, nicht erschlossen.** Auf dieser Maschine liegt über nvm ein `v22.13.1` (`~/.nvm/versions/node/v22.13.1/bin/node`; Standard-Node ist `v25.9.0`, `/usr/bin/node` ist `v26.4.0`). Damit gegengeprüft: **`pnpm world` läuft unter Node 22.13.1 in allen neun Schritten durch, Exit 0** — `check` 85 Dateien, `typecheck` 0 Fehler, `compile` (beide `tsc`-Pässe), `bundle`, `test:smoke` 4/4, `checkPkgTypes` 🟢 für `node16 (from ESM)` und `bundler`, `test` 44 Dateien / 478 Tests mit Coverage 98,83 / 93,65 / 99,51 / 99,34 (Ziffer für Ziffer die Werte des Node-25-Laufs), `test:gc` 44 / 478. Zusätzlich: alle 28 ausgelieferten `dist/*.js` und `lib/*.js` bestehen `node --check` unter Node 22, und `node --test smoke/build/*.test.js` — der Lauf gegen den tsc-gesenkten Decorator — meldet dort `pass 4 / fail 0`.
  - **Was die Pakete 1 bis 5 neu eingebracht haben, hält ebenfalls.** Der einzige Neuzugang mit Node-Bezug ist `globSync` aus `node:fs` in `vitest.config.ts` (Paket 3). Unter Node 22 funktioniert es identisch, druckt aber `ExperimentalWarning: globSync is an experimental feature` — einmal pro Vitest-Prozess. Kosmetisch und ausschließlich Entwicklerpfad: `vitest.config.ts` wird weder gebündelt noch ausgeliefert und ist für `engines.node` ohne Belang. Das strukturelle `AbortSignalLike` aus Paket 5 (`src/types.ts`) hat die letzte Referenz auf ein Node-/DOM-Global aus den ausgelieferten Typen entfernt; in `lib/*.d.ts` steht `AbortSignal` nur noch in JSDoc-Prosa, `NodeJS.`/`Buffer`/`process.` an keiner Stelle außer einem Prosasatz in `lib/effects.d.ts:50`. Die ausgelieferte Typfläche hat damit **gar keinen** Node-Boden.
  - **Der Peer-Dependency steht `>=22` nicht im Weg:** `@spearwolf/eventize@6.0.0` deklariert selbst `engines.node: ">=18.16"`.
  - **Die Wirkung des Findings ist real, die Formulierung des Audits braucht eine Fußnote.** Der Konsumentenpfad ist end-to-end nachgestellt: `npm pack` → Tarball in ein Wegwerf-Projekt mit `engineStrict` unter Node 22.13.1 → `[ERR_PNPM_UNSUPPORTED_ENGINE] … Expected version: >=24.13 / Got: v22.13.1`, Exit 1, nichts wird installiert. Mit auf `>=22` gepatchtem Tarball: Installation grün, und eine ESM-Probe über beide Entrypoints (`createSignal`/`createEffect`/`destroySignal`/`SignalGroup` plus `@signal`) läuft durch. Die Fußnote: pnpm 11.20.0 liest den Schalter **nicht** mehr aus `.npmrc` als `engine-strict=true` — dort blieb der Lauf grün — sondern aus `pnpm-workspace.yaml` als `engineStrict: true`. Ohne den Schalter bleibt es bei einer Warnzeile (`[WARN] Unsupported engine: wanted: {"node":">=24.13"} (current: {"node":"v22.13.1"})`), die beim Installieren durchrutscht.
  - **Node 24 ist für den Build nicht nötig** — das ist der Punkt, an dem die Bedingung aus »Entscheidungen« geprüft wird, und sie trifft nicht zu. `pnpm world` ist auf Node 22 grün (siehe oben). Der einzige Bodensatz im Werkzeugkasten ist eine devDependency: `npm-run-all2@9.0.2` deklariert `engines.node: "^22.22.2 || ^24.15.0 || >=26.0.0"`. Mit `engineStrict` bricht `pnpm install` auf 22.13.1 daran ab (gemessen) — ohne den Schalter warnt es nur. Nebenbei zeigt derselbe Bereich, dass die heutige Untergrenze schon unsauber ist: Node 24.13.0, der aktuelle `engines`-Boden, erfüllt `^24.15.0` nicht, und die Entwicklermaschine (25.9.0) erfüllt keinen der drei Zweige. Diese Zahl gehört nach `CONTRIBUTING.md`, nicht nach `engines`.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`; `pnpm world` unter dem Standard-Node ist danach erneut in allen neun Schritten grün (44 / 478, Coverage unverändert), der Tarball lag nie im Repo (`npm pack --pack-destination`).
- Vorgehen:
  1. `package.json:29-30`: `"node": ">=24.13"` → `"node": ">=22"`. Kein `>=22.0.0`, kein Caret — genau die Schreibweise aus der Entscheidung.
  2. **`@types/node` bleibt auf `^24.13.3`** (`package.json:63`). Das ist eine bewusste Nicht-Änderung, und der Implementierer soll sie nicht »mitziehen«: `@types/node` typisiert die Entwicklungs- und Testumgebung (`tsconfig.json` führt `types: ["vitest/globals", "node"]`, `smoke/tsconfig.json` führt `types: ["node"]`), nicht die ausgelieferte Oberfläche — die hat nach Paket 5 keinen Node-Boden mehr. Eine Senkung auf `^22` würde den Build gegen eine ältere API-Fläche prüfen als die, auf der er läuft, und schützt keinen einzigen Konsumenten. Die Zeile in `CHANGELOG.md:182`, die die Kopplung behauptet, steht unter einer veröffentlichten Überschrift und bleibt unangetastet.
  3. `README.md:93`, heute wörtlich »Runs anywhere modern JavaScript runs. Targets ES2023, requires Node `>=24.13`.« → `>=24.13` durch `>=22` ersetzen, der Rest des Satzes bleibt.
  4. `README.md:313-314`, heute wörtlich (zwei Zeilen, Umbruch nach `supported`):
     ```
     The package manager is **pnpm** (`pnpm@11.17.0`); `npm install` is not supported
     here. Node `>=24.13` is required to build.
     ```
     Der zweite Satz ist gemessen falsch — Node 22 baut das Repo vollständig. Ersetzen durch:
     ```
     The package manager is **pnpm** (`pnpm@11.17.0`); `npm install` is not supported
     here. Node `>=22` builds and tests the repo; see
     [CONTRIBUTING.md](./CONTRIBUTING.md) for what the toolchain expects.
     ```
     **`pnpm@11.17.0` bleibt stehen**, obwohl `package.json` `pnpm@11.20.0` führt. Das ist der Nebenbefund aus Paket 1 und gehört zu Paket 29; hier bliebe der Diff sonst nicht auf dem Finding.
  5. `docs/quickstart.md:10`, heute wörtlich »ESM-only. Requires Node `>=24.13` or a modern browser. Targets ES2023.« → `>=24.13` durch `>=22` ersetzen.
  6. `CLAUDE.md:3`, heute wörtlich »`@spearwolf/signalize` — synchronous signals/effects/memos/links on top of `@spearwolf/eventize`. ESM-only, Node `>=24.13`, ES2023.« → `>=24.13` durch `>=22` ersetzen.
  7. `AGENTS.md:11`, heute wörtlich »- Runtime: ESM-only, Node `>=24.13`, targets ES2023, `sideEffects: false`« → `>=24.13` durch `>=22` ersetzen. **`AGENTS.md:12` nicht anfassen** — dort steht »Peer dep: `@spearwolf/eventize ^5.0.0`«, während `package.json` `^6.0.0` führt. Falsche Zahl, aber ein anderes Thema; sie ist unten als Nebenbefund für Paket 29 vermerkt.
  8. `skills/using-signalize/SKILL.md:8`, heute wörtlich »Framework-agnostic, **synchronous** fine-grained reactivity. ESM-only, `sideEffects: false`, ES2023, Node `>=24.13` or any modern browser. Peer dep: `@spearwolf/eventize`. Fully typed.« → `>=24.13` durch `>=22` ersetzen, sonst nichts.
  9. `CONTRIBUTING.md:11`, heute wörtlich »- Node.js (see `package.json` for version)«. Der Verweis ist nach der Senkung zwar weiterhin korrekt, aber er ist genau die Stelle, an der laut Entscheidung die Build-Anforderung stehen soll. Ersetzen durch:
     ```markdown
     - Node.js `>=22` — the same floor as `engines.node` in `package.json`. Nothing in the build needs more: `pnpm world` runs green on Node 22 (measured 2026-08-09 against 22.13.1), and CI runs the full gate on Node 22 and Node 24. One devDependency is narrower than the floor — `npm-run-all2@9` declares `^22.22.2 || ^24.15.0 || >=26.0.0` — so on an older 22.x `pnpm install` prints an engine warning, and refuses outright if you have `engineStrict` turned on
     ```
     Die folgende Zeile »- pnpm package manager« bleibt unverändert.
  10. **Entscheidung zur CI: die Matrix kommt, in `ci.yml`, über `['22', '24']`.** Begründung, weil sie den Bereich des Pakets um eine Datei erweitert: eine Untergrenze, die keine einzige Pipeline je ausführt, ist eine Behauptung — dieselbe Sorte Behauptung, gegen die Paket 1 bis 3 dieses Laufs angetreten sind. Die Messung oben ist ein Einzelbefund vom 2026-08-09 auf einer Maschine; die Matrix hält ihn wahr. Sie schlägt über den `workflow_call` aus Paket 2 auch auf den Publish-Pfad durch, was hier erwünscht ist: es kann keine Version veröffentlicht werden, deren deklarierter Boden nie gelaufen ist. `main.yml` bleibt dabei Zeichen für Zeichen unverändert — der `deploy`-Job behält `node-version: 24`, publiziert wird weiter von einer Version.
  11. In `.github/workflows/ci.yml` den Job-Kopf (heute Zeilen 12-17) ersetzen durch:
      ```yaml
      jobs:
        test:
          name: Run all checks, linters and tests (Node ${{ matrix.node-version }})
          runs-on: ubuntu-latest
          permissions:
            contents: read
          # Both ends of the supported range, because `engines.node` is `>=22`:
          # the floor gets run, not just declared (BUILD-009). fail-fast is off
          # so a version-specific failure stays visible as one — with it on, the
          # first red leg cancels the other and hides which versions are affected.
          strategy:
            fail-fast: false
            matrix:
              node-version: ['22', '24']
      ```
      Die Werte sind bewusst Strings: der `if:`-Ausdruck in Schritt 13 vergleicht gegen `'24'`, und mit einem YAML-Integer ist der Vergleich eine Fußangel, die niemand sieht, bis der Bench-Step zweimal läuft. `setup-node` akzeptiert beides.
  12. Im `setup-node`-Step (heute Zeilen 24-27) `node-version: 24` durch `node-version: ${{ matrix.node-version }}` ersetzen. `cache: pnpm` bleibt: der Cache-Key von `setup-node` enthält die Node-Version nicht, beide Legs teilen sich also denselben pnpm-Store — inhaltlich unproblematisch, weil ein pnpm-Store engine-unabhängig ist, und ein gleichzeitiger Save meldet höchstens ein `Cache already exists` in den Log.
  13. Am `bench`-Step (heute Zeilen 67-69) eine Bedingung ergänzen, sodass er nur im 24er-Leg läuft:
      ```yaml
            - run: pnpm bench
              name: Run microbenchmarks (informative, non-blocking)
              # Only on the newer leg: two engines' timings in one run read like a
              # regression when they are nothing but two different JITs.
              if: matrix.node-version == '24'
              continue-on-error: true
      ```
      Der vorhandene dreizeilige Erklärkommentar über dem Step bleibt, wo er ist.
  14. Am Step »Upload coverage report« (heute Zeilen 97-103) den Artefaktnamen auf `coverage-report-node${{ matrix.node-version }}` ziehen. Das ist keine Kosmetik: `actions/upload-artifact` ab v4 nimmt denselben Artefaktnamen in einem Lauf kein zweites Mal an, das zweite Leg würde den Job rot färben. Und selbst wenn es nur überschriebe, wäre ein Coverage-Bericht aus zwei Läufen unter einem Namen wertlos.
  15. Im Step »Publish coverage summary« (heute Zeilen 71-95) die Zeile `'## Coverage',` innerhalb des `node -e`-Blocks ersetzen durch:
      ```
                    \`## Coverage (Node \${process.version})\`,
      ```
      Backtick und `$` müssen escaped bleiben, der Block steht in einer doppelt gequoteten Shell-Zeichenkette — die Nachbarzeile `const fmt = (k) => \`| \${k} | …\`;` zeigt die Schreibweise. `process.version` statt `${{ matrix.node-version }}`, weil dann die tatsächlich laufende Version in der Zusammenfassung steht und nicht die angeforderte. Ohne diese Änderung hängen zwei identisch überschriebene Coverage-Tabellen untereinander im Step Summary, ohne dass man sie auseinanderhalten kann.
  16. Sonst ändert sich an `ci.yml` nichts: der `on:`-Block aus Paket 2, die Reihenfolge aller vierzehn Steps, `permissions`, die beiden `if: always()`-Steps und sämtliche vorhandenen Kommentare bleiben.
  17. `AGENTS.md`, drei Stellen im Abschnitt »Development workflow« / »Deliberately not tested«:
      - Der Absatz, der mit »`.github/workflows/ci.yml` runs `pnpm check`, `pnpm typecheck`, …« beginnt (heute `AGENTS.md:193`): einen Satz anhängen, dass `ci.yml` als Matrix über Node 22 und 24 läuft — die beiden Enden des von `engines.node` zugesagten Bereichs — und dass `pnpm bench` nur im 24er-Leg läuft.
      - Der letzte Absatz des Abschnitts (heute `AGENTS.md:195`, »`ci.yml` triggers on push (except to `main`) …«): unverändert lassen, er stimmt weiter.
      - »Deliberately not tested«, erster Absatz (heute `AGENTS.md:201`): »no second CI job. Every job runs on `ubuntu-latest` (`ci.yml:13-17`, `main.yml:18-21`)« stimmt nach der Matrix nicht mehr — es sind zwei Jobs. Umformulieren auf: kein Browser-Job; jeder Job läuft auf `ubuntu-latest`, und `ci.yml`s Job ist eine Matrix über zwei Node-Versionen, beide auf Node. **Die Zeilenverweise in Klammern nach der eigenen Änderung neu ablesen** — `ci.yml:13-17` verschiebt sich durch Schritt 11 sicher, `vitest.config.ts:97` und `:126` im selben Abschnitt bleiben unberührt.
  18. `CHANGELOG.md`, unter `## Unreleased` → `### Build System`, zwei Zeilen, eine Zeile ein Fakt:
      - `engines.node` lowered from `>=24.13` to `>=22` — no construct in `src/` needs anything newer, and Node 22 stays in LTS until 2027 (BUILD-009)
      - CI runs the full gate as a matrix over Node 22 and Node 24, so the declared floor is exercised instead of asserted (BUILD-009)
- Verify: aus dem Repo-Root, fünf Teile. Der Node-22-Lauf ist der eigentliche Beweis; alles andere sichert ab, dass nichts anderes kaputtgegangen ist.
  1. `pnpm world` unter dem Standard-Node. Erwartet: neun Schritte grün, 44 Dateien / 478 Tests in `test` und `test:gc`, Coverage 98,83 / 93,65 / 99,51 / 99,34.
  2. Derselbe Lauf unter Node 22. Der Pfad ist maschinenspezifisch; findet die Suche nichts, gehört das in den Report statt in eine Behauptung:
     ```bash
     N22=$(ls -d ~/.nvm/versions/node/v22.*/bin 2>/dev/null | tail -1)
     if [ -z "$N22" ]; then echo 'kein Node 22 auf dieser Maschine — Untergrenze NICHT gegengeprueft'; else
       PATH="$N22:$PATH" node -v
       PATH="$N22:$PATH" pnpm world; echo "world auf Node 22 exit=$?  (erwartet 0)"
     fi
     ```
     Erwartet: Exit 0, dieselben 44 / 478 und dieselben vier Coverage-Zahlen wie unter Punkt 1. Die Zeilen `ExperimentalWarning: globSync is an experimental feature` sind erwartet und kein Fehler.
  3. Der Konsumentenpfad, ohne Registry und ohne Veröffentlichung. Er packt den echten Tarball, hängt ihn in ein Wegwerf-Projekt mit scharfem `engineStrict` und lässt ihn unter Node 22 laufen:
     ```bash
     T=$(mktemp -d); N22=$(ls -d ~/.nvm/versions/node/v22.*/bin 2>/dev/null | tail -1)
     npm pack --pack-destination "$T" >/dev/null 2>&1; TGZ=$(ls "$T"/*.tgz)
     mkdir -p "$T/consumer"; cd "$T/consumer"
     printf '{"name":"probe","version":"1.0.0","type":"module","private":true}\n' > package.json
     printf 'engineStrict: true\n' > pnpm-workspace.yaml
     PATH="$N22:$PATH" pnpm add "$TGZ" @spearwolf/eventize --ignore-scripts; echo "install exit=$?  (erwartet 0)"
     printf '%s\n' "import {createSignal, createEffect, destroySignal, SignalGroup} from '@spearwolf/signalize';" "import {signal} from '@spearwolf/signalize/decorators';" "const sig = createSignal(1); let seen = 0;" "createEffect(() => { seen = sig.get(); });" "sig.set(42); destroySignal(sig);" "console.log(seen === 42 && typeof signal === 'function' && typeof SignalGroup === 'function' ? 'ok: signalize laeuft auf Node ' + process.version : 'FEHLER: Konsumentenprobe');" > probe.mjs
     PATH="$N22:$PATH" node probe.mjs
     cd - >/dev/null; rm -rf "$T"
     ```
     Erwartet: `install exit=0` und `ok: signalize laeuft auf Node v22.x`. Gegen den heutigen Stand liefert derselbe Block `[ERR_PNPM_UNSUPPORTED_ENGINE] … Expected version: >=24.13 / Got: v22.13.1` und `install exit=1` — am 2026-08-09 so gemessen, daran sieht man, dass er wirklich misst. Der Tarball landet über `--pack-destination` nie im Repo.
  4. YAML-Syntax und Restbestände:
     ```bash
     python3 -c "import yaml;[yaml.safe_load(open(f)) for f in ('.github/workflows/ci.yml','.github/workflows/main.yml')];print('workflow yaml ok')"
     grep -rn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=lib --exclude-dir=build --exclude-dir=coverage --exclude=audit.html --exclude=CHANGELOG.md --exclude=remediation-plan.md --exclude=pnpm-lock.yaml -F '>=24.13' . && echo 'FEHLER: 24.13 steht noch irgendwo' || echo 'ok: keine 24.13-Angabe mehr ausserhalb von audit.html und CHANGELOG.md'
     ```
     PyYAML 6.0.3 liegt auf diesem Rechner, in Paket 2 geprüft. `on:` liest PyYAML als Boolean-Schlüssel — darauf nichts stützen, es ist eine reine Syntaxprüfung.
  5. `git status --porcelain --untracked-files=all` — nur die Dateien dieses Pakets, kein Tarball, kein Wegwerf-Verzeichnis.
- Commit: `build: lower the engines.node floor to what the code needs and run it in CI (BUILD-009)`

<details>
<summary>BUILD-009 im Volltext (aus <code>audit.html</code>)</summary>

**BUILD-009 — Die engines-Untergrenze auf das senken, was der Code wirklich braucht**
Severity: medium · Kategorie: Projektaufbau & Build · Effort: S · Status: carried-over
Location: `package.json:20-22` · `README.md:91` · `docs/quickstart.md:10`

> `"node": ">=24.13"` sperrt jeden Konsumenten auf Node 22 aus, das noch bis 2027 im LTS-Fenster steht — bei pnpm mit `engine-strict` ist das ein harter Installationsabbruch. Der Runtime-Code rechtfertigt das nicht: die modernsten Konstrukte sind `WeakRef`/`FinalizationRegistry` (Node 14.6), `AbortSignal` (Node 15) und `??=` (ES2021), Compile-Target ist ES2023. Die Zahl ist die Node-Version der Entwicklungsmaschine, nicht die des Codes, und inzwischen dreifach dupliziert.

> Empfehlung: `engines.node` auf `>=20` oder `>=22` senken und die drei Doku-Stellen mitziehen; ist Node 24 für den *Build* nötig, gehört das in `CONTRIBUTING.md`.

> Evidence: `grep -rnoE "Symbol\.dispose|Object\.groupBy|Array\.fromAsync|Promise\.withResolvers|RegExp\.escape" src/*.ts` → keine Treffer · höchste gefundene APIs: `FinalizationRegistry`, `AbortSignal`, `??=`

</details>

- Planänderung (2026-08-09): Reihenfolge und Schnitt der offenen Pakete bleiben unverändert; Phase 1 endet weiterhin hier, Paket 7 beginnt den Sweep. Zwei Erweiterungen innerhalb des Pakets, beide oben begründet: der Bereich wächst um `AGENTS.md`, `skills/using-signalize/SKILL.md`, `.github/workflows/ci.yml` und `CHANGELOG.md` (fünf zusätzliche Fundstellen plus die Matrix), und die Modellstufe steigt von der günstigsten auf die mittlere. Drei Nebenbefunde für Paket 29, keiner davon ein Finding des Audits:
  - `AGENTS.md:12` nennt »Peer dep: `@spearwolf/eventize ^5.0.0`«, `package.json` führt `^6.0.0`.
  - `README.md:313` nennt `pnpm@11.17.0`, `package.json` führt `pnpm@11.20.0` — dieselbe Stelle, die Paket 1 schon in `CLAUDE.md:11` gefunden hat. Beide gehören in einen Handgriff.
  - `npm-run-all2@9.0.2` verlangt `^22.22.2 || ^24.15.0 || >=26.0.0`; weder der bisherige `engines`-Boden 24.13.0 noch die Entwicklermaschine 25.9.0 erfüllen das. Mit `engineStrict` wäre das ein Installationsabbruch; ohne bleibt es eine Warnung. Kandidat für einen Dependency-Handgriff, kein Defekt von heute.

### Phase 2 — Das Netz spannen

- **Ergebnis (2026-08-09)** — Hash `ce25766`. Verify vom Orchestrator selbst gefahren: YAML beider Workflows gültig, `package.json:30` steht auf `">=22"`, `pnpm world` in allen neun Schritten grün (44 Dateien / 478 Tests, Coverage 98,83 / 93,65 / 99,51 / 99,34). Der Implementierer hat zusätzlich unter Node 22.13.1 (nvm) gefahren — dieselben 44/478 und dieselben vier Coverage-Zahlen — und den Konsumentenfall end-to-end nachgestellt: `npm pack` → Tarball → `pnpm add` mit `engineStrict: true` unter Node 22 installiert und läuft. Review: BUILD-009 erfüllt, keine Befunde; der Reviewer hat alle acht Doku-Stellen einzeln nachgelesen, repo-weit gegengesucht und die fünf Fallstricke der CI-Matrix (Artefaktname, `bench`-Bedingung, Step-Summary, `fail-fast`, `needs: test` gegen einen Matrix-Job) geprüft.
- Scope-Erweiterung des Planers, bewusst und begründet: `ci.yml` bekommt eine Node-Matrix `['22', '24']` mit `fail-fast: false`. Eine Untergrenze, die keine Pipeline je ausführt, ist genau die Sorte Behauptung, gegen die die Pakete 1 bis 3 angetreten sind. Über den `workflow_call` aus Paket 2 gilt sie auch für den Publish-Pfad.
- Erkenntnis, die das Audit nicht hatte: **Node 24 ist für den Build nicht nötig** — die Bedingung aus »Entscheidungen« (»ist Node 24 für den Build nötig, gehört das in CONTRIBUTING.md«) greift damit nicht. `README.md:314` behauptete das Gegenteil und ist korrigiert. Und `pnpm` 11.20 liest `engine-strict` nicht mehr aus `.npmrc`, sondern als `engineStrict` aus `pnpm-workspace.yaml`.
- Offener Punkt außerhalb des Repos: Die Job-Namen verschieben sich erneut, auf »Run all checks, linters and tests (Node 22)« und »(Node 24)«. Zweite Verschiebung nach Paket 2 — konfigurierte Required Status Checks müssen in den Branch-Protection-Regeln nachgezogen werden. Weboberfläche, kein Commit.
- Nebenbefunde, alle nach Paket 29:
  - `AGENTS.md:12` nennt die Peer-Dependency `@spearwolf/eventize ^5.0.0`, `package.json` führt `^6.0.0`.
  - `README.md:313` nennt `pnpm@11.17.0`, `package.json` führt `pnpm@11.20.0` — der Zwilling des Befunds aus Paket 1 in `CLAUDE.md:11`.
  - `npm-run-all2@9.0.2` verlangt `^22.22.2 || ^24.15.0 || >=26.0.0` — weder der alte Boden 24.13.0 noch die Entwicklermaschine 25.9.0 erfüllen das. Ohne `engineStrict` in `pnpm-workspace.yaml` bleibt es bei einer Warnung; in der CI zieht `setup-node` mit `'22'` ohnehin das aktuellste 22.x.


#### Paket 7 ist in 7a, 7b und 7c geteilt

Begründung des Planers (2026-08-09): der Sweep umfasst gemessen **32 Dateien und 356 Tests**, rund 11 700 Zeilen Spec-Code. Als ein Commit wäre das ein Diff, den ein Review nur noch überfliegt — und ein überflogenes Review ist bei einem Paket, das die Testinfrastruktur für die Pakete 8 bis 10 festlegt, teurer als ein zusätzlicher Zug. Geteilt wird nach **Subsystem**, weil das die einzige Achse ist, entlang der ein Reviewer den Kontext im Kopf behält: er liest acht Link-Specs, nicht acht zufällige Dateien. Die drei Teile sind mit 109 / 124 / 123 umzustellenden Tests annähernd gleich groß. Paketnummern werden nicht neu vergeben; die Pakete 8 bis 30 behalten ihre Nummern.

Die Reihenfolge ist 7a → 7b → 7c, weil die Vorlage, die das Finding benennt (`src/link.spec.ts`, der `finally`-Block bei MEM-005), in 7a liegt: der Implementierer, der das Muster festlegt, arbeitet direkt daneben. 7b und 7c wenden es nur noch an.

**Der Abgleich, die Wegentscheidung und das Muster stehen vollständig in 7a und gelten für alle drei Teile.** 7b und 7c verweisen darauf und listen nur ihre Dateien, ihre Ausnahmen und ihre Zahlen.

#### [x] 7a. Aufräumen in ein finally ziehen: Links und SignalAutoMap
- Findings: TEST-017 (high) — Teil 1 von 3
- Ziel: Das Muster steht, und in den acht Dateien, die die größten gemessenen Kollateralschäden tragen, reißt ein Fehlschlag nicht mehr die restliche Datei mit. Größter Einzelfall heute: **37 von 38** roten Tests in `src/link.spec.ts`, davon 36 fremdverschuldet.
- Bereich: 8 `*.spec.ts` in `src/` (Links und `SignalAutoMap`), 3 440 Zeilen
- Hängt ab von: Paket 1 (der Typecheck steht seit `2dc2833` über den Specs — ohne ihn wäre ein Sweep über 3 400 Zeilen ungeprüft)
- Anmerkung: breiter mechanischer Sweep, bewusst vor allen inhaltlichen Paketen. Kein Produktionscode, keine Hook-Blöcke, keine neuen Assertions.
- Modell: mittlere Stufe — die Arbeit ist mechanisch und das Muster unten vollständig ausgeschrieben, aber acht Tests sind Ausnahmen, bei denen ein blind verschobenes `destroy()` den Test seines Gegenstands beraubt. Gefragt ist jemand, der bei jedem Test die Frage stellt: *folgt auf diesen Abbau noch eine Assertion?*
- Hash: `e9904d0`
- Dateien:

  | Datei | umzustellende Tests | Seed-Punkte | größter gemessener Radius | Seed-Punkte mit Radius > 1 |
  | --- | ---: | ---: | ---: | ---: |
  | `src/link.spec.ts` | 34 | 36 | **37 von 38** | 34 |
  | `src/SignalAutoMap.spec.ts` | 36 | 24 | **27 von 38** | 14 |
  | `src/SignalLink.spec.ts` | 11 | 28 | **28 von 28** | 27 |
  | `src/link.unlink.spec.ts` | 11 | 9 | **11 von 11** | 8 |
  | `src/createSignal.link.spec.ts` | 10 | 10 | **10 von 10** | 9 |
  | `src/link.gc.spec.ts` | 3 | 7 | **7 von 7** | 5 |
  | `src/link.asyncValues.spec.ts` | 2 | 2 | 2 von 2 | 1 |
  | `src/link.nextValue.spec.ts` | 2 | 2 | 2 von 2 | 1 |
  | **Summe** | **109** | **118** | | **99** |

  Nicht angefasst: `src/SignalAutoMap.gc.spec.ts` und `src/signal-core.gc.spec.ts` — sie tragen keine Zählerwächter in `beforeEach`/`afterEach` und fallen damit nicht unter TEST-017.
- Abgleich (2026-08-09) — **gilt für 7a, 7b und 7c**:
  - **TEST-017 unverändert, aber jede Zahl des Findings ist nachgezählt und zwei davon sind zu korrigieren.** Die drei genannten Fundstellen existieren: `src/SignalAutoMap.spec.ts:29-35` ist unverändert der Test `get(), has() and clear()` mit `sm.clear()` als letzter Anweisung hinter drei Assertions; `src/link.spec.ts:254-267` ist unverändert `lastValue is undefined after destroy` mit `destroySignal(sigA, sigB)` hinter der letzten Assertion; `src/SignalGroup.off.spec.ts` trägt in allen 20 Tests denselben Bau. Paket 4 hat zwar alle 36 Specs angefasst, aber nur die Importzeile — die Zeilennummern des Findings stimmen noch.
  - **»35 Spec-Dateien« stimmt, »der Rest steht noch« nicht ganz.** Es sind genau 35 Dateien mit Zählerwächtern in `beforeEach`/`afterEach` (von 44 Spec-Dateien insgesamt). Drei davon sind bereits vollständig auf `finally` umgestellt und brauchen nichts: `src/ordering.property.spec.ts` (6 Tests), `src/effects.async.spec.ts` (12) und `src/createSignal.deprecation.spec.ts` (4). Der letzte Lauf hat also nicht zwei Tests umgestellt, sondern 33 in fünf Dateien — die restlichen zwei stehen in `src/link.spec.ts` (MEM-005) und `src/SignalGroup.teardown.spec.ts`. Zu tun bleiben **32 Dateien und 356 Tests**.
  - **Die Wächter sind nicht einheitlich, und das bleibt so.** Zwölf Dateien prüfen nur `assertEffectsCount`, elf `Effects`+`Signals`, elf alle drei, eine (`link.gc.spec.ts`) nur `assertLinksCount`. Ein schmaler Wächter erzeugt einen kleineren Radius, weil er weniger sieht — `src/effects.cleanup.spec.ts` etwa bemerkt ein geleaktes Signal überhaupt nicht. **Das wird in diesem Paket nicht angefasst.** Wächter zu verbreitern ändert, was eine Datei entdeckt, und ist damit inhaltliche Arbeit; sie ist unten als Nebenbefund vermerkt.
  - **Gemessene Gesamtwirkung.** Über alle 32 Dateien gibt es 360 Stellen, an denen ein einzelner Fehlschlag entstehen kann; an **207 davon reißt er heute mindestens einen fremden Test mit**. Das ist der Schaden, den das Paket abstellt. Methode und Zahlen stehen im Verify-Block.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/` ist leer, `npx vitest run` meldet wieder 44 Dateien / 478 Tests grün. Jede Messung wurde über eine Dateikopie im Scratchpad zurückgebaut, kein `git`-Schreibbefehl war beteiligt.
- Vorgehen:
  1. **Der Weg: `finally`, keine Registry.** Das Audit nennt beide; die Entscheidung fällt gegen die Registry, und zwar aus drei gemessenen Gründen.

     *Erstens die Kosten.* Eine Registry braucht eine Anmeldung je Ressource. In den 35 Wächter-Dateien stehen **1 171 ressourcenerzeugende Aufrufe** (518 × `createSignal(`, 221 × `createEffect(`, 178 × `findOrCreate(`, 174 × `link(`, 32 × `SignalGroup.get(`, 18 × `new SignalAutoMap`, 12 × `vi.spyOn(`, 11 × `new AbortController`, 7 × `createMemo(`). Ein `finally`-Block dagegen wird 356-mal geschrieben. Die Registry ist der dreifache Diff für dasselbe Ergebnis.

     *Zweitens gibt es keine aufzählbare Ressourcenmenge.* `signal-core.ts` führt einen Zähler (`g_signalsCount`), kein Verzeichnis; dasselbe gilt für Effects und Links. Eine Registry ohne Aufrufstellen — Schnappschuss vorher, Differenz nachher abräumen — ist nicht baubar, ohne in `src/` eine Liste lebender Signale einzuziehen. Das wäre Produktionscode für einen Testzweck und damit eine Scope-Verschiebung.

     *Drittens ist der bequeme Vitest-Weg gemessen versperrt.* `onTestFinished()` sähe nach der idealen Anmeldung aus, läuft aber **nach** allen `afterEach`-Hooks: gemessen am 2026-08-09 mit einer Wegwerf-Spec ergibt sich die Reihenfolge `beforeEach → Rumpf → afterEach#2 → afterEach#1 → onTestFinished#2 → onTestFinished#1`. Der Wächter feuert also, bevor aufgeräumt wäre. Nebenbefund derselben Messung, für 7c relevant: `afterEach`-Hooks laufen in **umgekehrter** Registrierungsreihenfolge (`sequence.hooks: 'stack'`).

     Ein Helfer in `src/__testing__/` wäre erlaubt und ist trotzdem nicht nötig: das Abbau-Vokabular ist gemessen winzig. 113 Tests enden auf `destroySignal(…)`, 50 auf `group.clear()`, 30 auf `destroySignal(…)` plus `effect.destroy()`, 24 auf `sm.clear()`; der Rest verteilt sich auf `unlink()`, `link.destroy()` und `spy.mockRestore()`. Ein typenschnüffelnder `cleanup(...resources)`-Helfer spart ein bis zwei Zeilen und verbirgt dafür, was ein Test eigentlich abbaut. Der Vorwurf aus READ-001 — dieselbe Sache 35-mal von Hand — trifft hier nicht: wiederholt wird nicht *Logik*, sondern ein zweizeiliges Sprachkonstrukt, und genau seine Sichtbarkeit ist der Zweck.
  2. **Das Muster.** Es wird einmal beschrieben und 356-mal angewandt. Vorlage ist `src/link.spec.ts:686-713` (MEM-005), wo Begründung und Form bereits stehen; der Kommentar dort bleibt unverändert und ist der Ankertext, auf den sich alles Folgende beruft.

     ```ts
     it('lastValue is undefined after destroy', () => {
       const sigA = createSignal(1);          // Arrange bleibt vor dem try
       const sigB = createSignal(-1);

       try {
         const con = link(sigA, sigB);        // Act und Assert

         expect(con.lastValue).toBe(1);

         con.destroy();                       // Act: danach wird noch geprüft
         expect(con.lastValue).toBeUndefined();
       } finally {
         unlink(sigA);                        // Teardown, vollständig
         destroySignal(sigA, sigB);
       }
     });
     ```

     Sechs Regeln, die den Umbau vollständig bestimmen:

     - **(a) Das `try` beginnt hinter der letzten Deklaration, die der `finally`-Block braucht** — nicht am Anfang des Tests. Das hält die Einrückungs-Churn klein und macht Hoisting überflüssig. Was innerhalb des `try` entsteht (oben `con`), wird über einen Griff abgeräumt, der außerhalb steht: `unlink(source)`, `group.clear()`, `sm.clear()`. Geht das nicht, wird die Variable mit `let x: T | undefined;` vor das `try` gezogen — aber erst dann, nicht vorsorglich.
     - **(b) Der `finally`-Block räumt vollständig ab, auch was der Rumpf schon abgeräumt hat.** Doppelter Abbau ist gemessen ein No-Op: `destroySignal()` prüft `!signal.destroyed` (`src/signal-core.ts:145`), `SignalLink#destroy()` steigt bei `isDestroyed` aus (`src/SignalLink.ts:358`), `EffectImpl#destroy()`, `SignalGroup#clear()` und `unlink()` auf ein Signal ohne Links ebenso. Am 2026-08-09 mit einer Wegwerf-Spec über alle fünf Verben nachgeprüft, jeweils zweimal hintereinander gerufen: kein Wurf, keine doppelte Zählerbewegung.
     - **(c) Ein `destroy()`, auf das noch eine Assertion folgt, ist Act und bleibt im `try`.** Das ist die wichtigste Regel des Pakets. Ein Test, der das Zerstören als Verhalten prüft, darf sein `destroy()` nicht in den `finally`-Block verlieren; der bekommt nur den zusätzlichen, idempotenten Gürtel aus (b). Die betroffenen Tests sind unten namentlich gelistet.
     - **(d) Der `finally`-Block darf nicht werfen** — sonst ersetzt er die eigentliche Fehlermeldung. Kritisch bei den Tests, deren Teardown absichtlich wirft. Gemessen: ein zweites `group.clear()` nach einem, der mit `cleanup boom` geworfen hat, wirft **nicht** noch einmal; die Gruppe ist nach dem ersten Durchlauf leer und abgemeldet (Paket 1 hat `clear()` genau dafür fertigmachen lassen). Wo ein Abbau trotzdem werfen könnte, kommt er in ein eigenes `try { … } catch { /* ignore */ }` **innerhalb** des `finally`.
     - **(e) Reihenfolge im `finally`, wie in der Vorlage:** erst Spies (`mockRestore()`), dann Links (`unlink()` / `link.destroy()`), dann Effects, dann Signale, dann Gruppen. Grund: ein noch lebender Link, dessen Quelle gerade zerstört wird, läuft sonst durch seine eigene Teardown-Kette, während der `finally`-Block noch arbeitet.
     - **(f) Die Hook-Blöcke werden nicht angefasst.** Kein Wächter kommt dazu, keiner fällt weg, keine Reihenfolge ändert sich. Wer beim Umbau merkt, dass eine Datei zu wenig prüft, notiert das — er repariert es nicht hier.
  3. **Die Ausnahmen in 7a** — acht Tests, bei denen der Abbau selbst der Prüfgegenstand ist. Sie haben heute *keinen* nachlaufenden Teardown, weil ihr `destroy()`/`clear()` mitten im Rumpf steht und danach noch geprüft wird. Für sie gilt Regel (c) plus (b): der Aufruf bleibt, wo er ist, und der `finally`-Block bekommt zusätzlich den idempotenten Abbau der vorher erzeugten Ressourcen.
     - `src/SignalAutoMap.spec.ts:301` `churn leaves no dead handles in the held value (MEM-007)`
     - `src/SignalAutoMap.spec.ts:334` `clear() releases the hook of an entry whose signal is already dead (MEM-007)`
     - `src/SignalAutoMap.spec.ts:396` `clear() properly destroys all signals`
     - `src/SignalAutoMap.spec.ts:464` `1000 externally destroyed entries leave no keys behind (MEM-007)`
     - `src/SignalAutoMap.spec.ts:657` `delete() on an entry destroyed from the outside reports false (MEM-007)`
     - `src/SignalAutoMap.spec.ts:672` `delete() releases the hook of an entry whose signal is already dead (MEM-007)`
     - `src/createSignal.link.spec.ts:293` `if the signal is destroyed, all connections from this signal should be disconnected automatically`
     - `src/link.gc.spec.ts:77` `orphaned callback-target links (SignalLinkToCallback) are reclaimed by GC once their source is gone`

     Ein neunter Fall hat zwar einen nachlaufenden Teardown, gehört aber in dieselbe Kategorie und ist zugleich die Fundstelle aus dem Finding: `src/link.spec.ts:254` `lastValue is undefined after destroy` — `con.destroy()` bleibt im `try`, nur `destroySignal(sigA, sigB)` wandert. Genau so steht es im Muster unter Schritt 2.
  4. **Zwei Dateibesonderheiten in 7a.** `src/link.gc.spec.ts` und `src/link.asyncValues.spec.ts` haben `async`-Tests; `try`/`finally` gilt dort unverändert, aber der `finally`-Block darf nichts `await`en, was der Fehlschlag schon zerrissen hat — synchroner Abbau reicht in beiden Dateien aus. `src/SignalLink.spec.ts` ist die einzige Datei im Repo mit `new AbortController` (11 Stellen): ein Controller ist keine gezählte Ressource, sein `abort()` gehört trotzdem in den `finally`-Block, damit ein Fehlschlag keinen offenen `AbortSignal`-Listener stehen lässt.
  5. **Importe nachziehen.** `unlink` kommt in mehreren `finally`-Blöcken neu vor. In `src/link.spec.ts` ist es bereits importiert (MEM-005); in den anderen Dateien prüfen und ergänzen. Kein Import auf Verdacht — `pnpm check` meldet ungenutzte Importe.
  6. **`pnpm fix` am Ende.** Das zusätzliche Einrückungsniveau schiebt Zeilen über Biomes Breite; der Formatlauf ist erwartet und kein Fehler. Danach muss `pnpm check` sauber sein.
  7. **Kein CHANGELOG-Eintrag für 7a und 7b.** Ein Konsument kann nichts davon beobachten — das ist der Fall, den `CLAUDE.md` unter »CHANGELOG discipline« ausdrücklich freigibt. Der eine Eintrag für den gesamten Sweep kommt in 7c, wenn er vollständig ist. Der Implementierer soll hier keinen erfinden.
  8. **`AGENTS.md` wird in 7c nachgezogen**, nicht dreimal. Siehe dort.
- Verify: drei Teile. Der erste zeigt, dass nichts kaputt ist; der zweite ist der eigentliche Beweis; der dritte prüft den Baum.
  1. `pnpm world`. Erwartet: neun Schritte grün, 44 Dateien / 478 Tests in `test` und `test:gc`, Coverage 98,83 / 93,65 / 99,51 / 99,34 — Ziffer für Ziffer unverändert gegen `ce25766`. Ein Sweep über Testcode darf die Deckung nicht bewegen; tut er es doch, ist eine Assertion verlorengegangen.
  2. **Der Radius-Test.** Er sät eine echte Fehlschlag-Situation und zählt, wie viele Tests derselben Datei rot werden. Zwei Werkzeuge, beide am 2026-08-09 gemessen.

     **(2a) Die echte Regression in `src/`.** Eine Zeile aus `SignalLink#destroy()` entfernt — der Fall, den das Repo als BUG-001 kennt. Der Block räumt hinter sich auf und fasst kein `git` an:
     ```bash
     cp src/SignalLink.ts /tmp/SignalLink.ts.bak
     python3 - <<'EOF'
     p = 'src/SignalLink.ts'; s = open(p).read()
     old = "    off(this);\n\n    this.lastValue = undefined;"
     assert s.count(old) == 1
     open(p, 'w').write(s.replace(old, "    off(this);\n\n    // SEEDED REGRESSION (BUG-001)", 1))
     EOF
     npx vitest run src/link.spec.ts 2>&1 | grep -E '^ *Tests '
     cp /tmp/SignalLink.ts.bak src/SignalLink.ts && rm /tmp/SignalLink.ts.bak
     ```
     **Vorher (gegen `ce25766` gemessen): `24 failed | 14 passed (38)`. Nachher erwartet: `1 failed | 37 passed (38)`.** Genau ein Test bricht wirklich — `lastValue is undefined after destroy` —, die anderen 23 sind Kollateralschaden über die Wächter. Der Nachher-Wert ist nicht behauptet: er wurde am 2026-08-09 gemessen, indem *nur dieser eine* Test in ein `finally` gezogen wurde. Zwei der 24 roten Tests haben heute schon einen `finally`-Block (MEM-005) und fallen trotzdem — ein `finally` schützt die Nachbarn *hinter* sich, nicht sich selbst vor einem Vorgänger. Deshalb wirkt das Paket nur dateiweise vollständig.
     Dieselbe Regression trifft zusätzlich `src/SignalLink.spec.ts` mit `7 failed | 21 passed (28)`; nach dem Umbau muss auch dort die Zahl der echten Fehlschläge übrig bleiben und kein Nachbar mehr.

     **(2b) Das erschöpfende Tor.** Die Einzelmessung deckt eine Stelle ab; das Tor deckt alle ab. Es sät nacheinander in *jeden* ressourcenerzeugenden Test einer Datei eine fehlschlagende Assertion und verlangt, dass jedes Mal genau ein Test rot wird. Zwei Dateien ins Scratchpad legen:
     ```python
     # blast.py — sät eine fehlschlagende Assertion in den n-ten Test. Exit 2 = kein n-ter.
     import re, sys
     MAKES = re.compile(r"createSignal\(|createEffect\(|createMemo\(|\blink\(|new SignalAutoMap|findOrCreate\(")
     path, nth = sys.argv[1], int(sys.argv[2])
     lines = open(path, encoding='utf-8').read().split('\n')
     starts = [i for i, l in enumerate(lines) if re.match(r"\s*(it|test)(\.\w+)?\(", l)]
     starts.append(len(lines))
     hit = 0
     for a, b in zip(starts, starts[1:]):
         body = lines[a:b]
         exp = next((i for i, l in enumerate(body) if 'expect(' in l), None)
         if exp is None or not MAKES.search('\n'.join(body[:exp])):
             continue
         hit += 1
         if hit != nth:
             continue
         tgt = a + exp
         lines.insert(tgt, re.match(r'\s*', lines[tgt]).group(0) + "expect(1, 'SEEDED').toBe(2);")
         open(path, 'w').write('\n'.join(lines))
         print(tgt + 1); sys.exit(0)
     sys.exit(2)
     ```
     ```bash
     # gate.sh <specfile> — meldet nur die Stellen, an denen mehr als ein Test fällt.
     f=$1; worst=0; n=1; bad=0
     cp "$f" /tmp/gate.bak
     while line=$(python3 /tmp/blast.py "$f" $n 2>/dev/null); do
       r=$(npx vitest run "$f" 2>&1 | grep -E '^ *Tests ' | sed 's/ *Tests *//')
       c=$(echo "$r" | grep -oE '^[0-9]+ failed' | grep -oE '[0-9]+'); c=${c:-0}
       [ "$c" -gt "$worst" ] && worst=$c
       [ "$c" -gt 1 ] && { echo "  RADIUS $c  $f:$line"; bad=$((bad+1)); }
       cp /tmp/gate.bak "$f"; n=$((n+1))
     done
     cp /tmp/gate.bak "$f"; rm -f /tmp/gate.bak
     echo "$f: $((n-1)) Saatpunkte, groesster Radius $worst, Uebeltaeter $bad"
     ```
     **Abnahmekriterium für 7a: `bash gate.sh <datei>` meldet für alle acht Dateien `groesster Radius 1, Uebeltaeter 0`.** Die Vorher-Werte stehen in der Dateitabelle oben; in Summe 99 Übeltäter an 118 Saatpunkten. Laufzeit rund zwei Minuten für alle acht.

     Zwei Belege, dass das Tor wirklich misst und nicht bloß nickt: gegen die drei bereits umgestellten Dateien meldet es am 2026-08-09 `ordering.property.spec.ts: 6 Saatpunkte, groesster Radius 1, Uebeltaeter 0`, `effects.async.spec.ts: 12 / 1 / 0` und `createSignal.deprecation.spec.ts: 4 / 1 / 0` — es besteht auf korrektem Code. Und es sät nach dem Umbau korrekt *in* den `try`-Block, nicht in den `finally`-Block; auch das ist an `link.spec.ts` in beiden Zuständen gegengeprüft (37 vorher, 1 nachher).
  3. `git status --porcelain --untracked-files=all` — nur die acht Spec-Dateien dieses Teilpakets, kein `/tmp/*.bak`, keine Wegwerf-Spec in `src/`, und `git diff -- src/` zeigt außerhalb der acht Dateien nichts. Der Radius-Test verändert Produktionscode; ein vergessener Rückbau ist der eine Fehler, der hier wehtun würde.
- Commit: `test: tear down link and SignalAutoMap resources in a finally, not after the assertions (TEST-017)`

- **Ergebnis (2026-08-09)** — Hash `e9904d0`. Verify vom Orchestrator selbst gefahren: `pnpm typecheck` 0 Fehler, `pnpm check` 85 Dateien sauber, `pnpm test` 44 Dateien / 478 Tests grün, Coverage 98,83 / 93,65 / 99,51 / 99,34 — ziffergleich zur Baseline. `grep -rn SEEDED src/` leer, kein Produktionscode verändert. 109 Tests in acht Dateien umgestellt, neun Ausnahmen im `try` belassen.
- **Zwei Runden, und der Grund dafür ist lehrreich.** Das Abnahmekriterium des Plans — ein Saat-Tor, das einmal pro Test vor der ersten Assertion sät — meldete nach Runde 0 »Radius 1, Übeltäter 0« und war damit erfüllt. Der Reviewer hat ein zweites Tor gebaut, das **vor jeder Assertion** sät (605 statt 118 Saatpunkte), und drei Stellen gefunden, die das erste durchgelassen hatte: zwei Tests, in denen der `finally`-Block nur einen von zwei nötigen `clear()`-Aufrufen trug (gemessen 18 beziehungsweise 10 rote Tests statt einem), und einen Test, der gar nicht umgestellt war und nur deshalb unauffällig blieb, weil er der letzte der Datei ist.
- **Runde 2 fand die eigentliche Lücke.** Auch das feine Tor sät ausschließlich *vor Assertionszeilen* und kann deshalb keinen Fehlschlag *zwischen zwei Arrange-Anweisungen* erzeugen. Genau dort saß der Rest: in zwei Tests lag die Arrange-Phase vollständig im `try`, und ihre erste Ressource — `const corpse = createSignal(1)` — hatte im `finally` keinen Griff. Gemessen **19 von 38 roten Tests**. Ein frischer Implementierer auf der stärksten Stufe hat die Arrange-Zeilen vor das `try` gezogen, `destroySignal(corpse)` idempotent ins `finally` gesetzt, und ein drittes Tor gebaut, das **auch zwischen Arrange-Anweisungen sät**: 341 Saatpunkte über alle acht Dateien, größter Radius 1, null Übeltäter. Er hat die übrigen sieben Dateien mit demselben Muster durchsucht und dort nichts gefunden — mit drei unabhängigen Belegen je Datei.
- **Merksatz für 7b und 7c:** Die Arrange-Phase gehört vor das `try`, nicht hinein. Wer sie drinnen lässt, kauft sich eine Lücke, die kein Saat-Tor sieht, das nur vor Assertionen sät. Das dritte Tor (`blast2.py` / `gate2.sh` im Scratchpad) ist das Abnahmekriterium für die beiden Folgepakete.
- Offener Befund, bewusst nicht in 7a behoben (Q5): An sieben Saatpunkten in den async-Tests hängt beim Fehlschlag noch ein `nextValue()`- oder Iterator-Promise, das der Teardown im `finally` verwirft, während niemand mehr zuhört. Vitest meldet dann zusätzlich `Errors 1 error` und schreibt es dem *nächsten* Testnamen zu; die Testzahl bleibt bei 1, kein Tor sieht es. Bauartbedingte Nebenwirkung des Musters, nicht vom ergänzten `abort()` verursacht — gegengeprüft. Relevant für 7b und 7c.
- Nebenbefunde:
  - `src/link.gc.spec.ts:297` (`a throwing release handle is reported and does not stop the rest`, MEM-001) — als einziger GC-Test trägt sein `finally` nur `error.mockRestore()`, kein idempotentes `waitUntilLinksCollected()` wie seine vier Geschwister. Heute Radius 1, weil der GC-Wait des Folgetests den verwaisten Link einsammelt; die Asymmetrie ist unbeabsichtigt.
  - `src/SignalLink.spec.ts:304` — der einzige der elf `new AbortController`, der innerhalb des `try` in einer Schleife entsteht und kein `abort()` im `finally` bekommt. Leckt nichts, weicht aber von Schritt 4 ab.
  - `src/link.spec.ts:137`, `:163`, `:183` — die drei `attach`-Tests erzeugen ihre `SignalGroup` im `try` und räumen sie dort auch ab. Dieselbe Form wie der behobene Befund, folgenlos, weil Gruppen von keinem Wächter gezählt werden.
  - Die Wächter dieser acht Dateien sehen **Queue-Subscriptions nicht** — deshalb brauchte der behobene Befund einen Reviewer und kein Tor. Ein `assertSubscriptionCount`-Wächter wäre die fehlende Absicherungsklasse. Gehört nicht in dieses Paket; Kandidat fürs nächste Audit.


#### [x] 7b. Aufräumen in ein finally ziehen: Signale, Effects, Decorators
- Findings: TEST-017 (high) — Teil 2 von 3
- Ziel: Dieselbe Umstellung für die zwanzig Dateien rund um `createSignal`, `createEffect`, `EffectImpl` und die Decorators. Größter Einzelfall heute: **15 von 15** roten Tests in `src/EffectImpl.destroy.spec.ts`.
- Bereich: 20 `*.spec.ts` in `src/`, 4 961 Zeilen
- Hängt ab von: Paket 7a (das Muster wird dort festgelegt, hier nur noch angewandt)
- Modell: ~~mittlere Stufe~~ **stärkste Stufe** (angehoben am 2026-08-09, Begründung im Nachtrag) — die meisten Dateien sind klein, aber es sind zwanzig davon, und ~~27~~ **55** Tests fallen unter die Ausnahmeregel (c). Der Umfang ist nicht mehr das einzige Risiko: bei 55 von 138 Tests muss der Implementierer entscheiden, ob ein `destroy()` Act oder Teardown ist.
- Hash: `ef150a9`
- Dateien:

  | Datei | umzustellende Tests | Seed-Punkte | größter gemessener Radius | Seed-Punkte mit Radius > 1 |
  | --- | ---: | ---: | ---: | ---: |
  | `src/EffectImpl.destroy.spec.ts` | 14 | 15 | **15 von 15** | 9 |
  | `src/effects.cleanup.spec.ts` | 12 | 12 | **12 von 12** | 11 |
  | `src/effects.errorIsolation.spec.ts` | 11 | 11 | **11 von 11** | 10 |
  | `src/effects.spec.ts` | 11 | 11 | **13 von 13** | 10 |
  | `src/createSignal.spec.ts` | ~~10~~ 12 | 12 | **13 von 13** | 11 |
  | `src/hibernate.spec.ts` | 10 | 10 | **14 von 16** | 9 |
  | `src/nested-effects-staticDeps.spec.ts` | 9 | 9 | **9 von 9** | 8 |
  | `src/createSignal.destroySignal.spec.ts` | 7 | 7 | **7 von 7** | 4 |
  | `src/EffectImpl.run.spec.ts` | 6 | 6 | 6 von 6 | 5 |
  | `src/createSignal.mutedWrites.spec.ts` | ~~6~~ 7 | 7 | 7 von 7 | 6 |
  | `src/decorators.signal.spec.ts` | 6 | 1 | ~~5 von 6~~ **6 von 6** | 1 |
  | `src/object-signals.spec.ts` | 5 | 4 | 5 von 6 | 2 |
  | `src/createSignal.beforeRead.spec.ts` | 4 | 4 | 4 von 4 | 3 |
  | `src/effects.onCreateEffect.spec.ts` | 3 | 3 | 3 von 3 | 2 |
  | `src/bequiet.spec.ts` | 2 | 2 | 2 von 2 | 1 |
  | `src/effects-and-groups.spec.ts` | 2 | 2 | 2 von 2 | 1 |
  | `src/effects.priority.spec.ts` | 2 | 2 | 2 von 2 | 1 |
  | `src/globalEffectStack.spec.ts` | 2 | 0 | ~~vom Tor nicht erreichbar~~ **2 von 2** | – |
  | `src/effects.noAutorun.spec.ts` | 1 | 1 | 1 von 1 | 0 |
  | `src/nested-effects-isolation.spec.ts` | 1 | 1 | 1 von 1 | 0 |
  | **Summe** | ~~**124**~~ **127** | **120** | | **94** |

  Die Spalten »Seed-Punkte«, »Radius« und »Radius > 1« stehen für das **grobe** Tor aus 7a Verify (2b) und bleiben als Vorher-Wert stehen; das Abnahmekriterium ist seit dem Nachtrag ein anderes und misst andere Zahlen.
- Abgleich (2026-08-09): siehe Paket 7a — die Bestandsaufnahme deckt alle drei Teilpakete ab. Drei Punkte, die nur 7b betreffen:
  - **`src/object-signals.spec.ts` baut mit einem eigenen Verb ab:** `destroyObjectSignals(host)`, nicht `destroySignal()`. Fünf seiner sechs Tests fallen darunter. Wer nach dem üblichen Vokabular sucht, übersieht die Datei.
  - ~~**`src/globalEffectStack.spec.ts` (2 Tests) ist vom Radius-Tor nicht erreichbar** — seine Tests erzeugen keine gezählte Ressource vor der ersten Assertion, das Werkzeug findet keinen Saatpunkt.~~ **Falsch, korrigiert am 2026-08-09:** beide Tests erzeugen sehr wohl eine gezählte Ressource, nämlich `new EffectImpl(NOOP)` (`src/globalEffectStack.spec.ts:19, 26, 27`) — `getEffectsCount()` ist `EffectImpl.count` (`src/effects.ts:107`), der Konstruktor zählt hoch. Blind war nicht die Datei, sondern das Werkzeug: die `MAKES`-Regex kannte `new EffectImpl` nicht. Mit dem erweiterten Tor hat die Datei vier Saatpunkte und einen gemessenen Radius von 2. Sie wird ganz normal umgestellt und ganz normal nachgewiesen. Für `effects.noAutorun.spec.ts` und `nested-effects-isolation.spec.ts` (je 1 Test) gilt weiterhin: Radius schon heute 1, das Tor kann dort nichts zeigen.
  - ~~**`src/decorators.signal.spec.ts` hat nur einen Saatpunkt bei sechs Tests**~~ **Dieselbe Werkzeuglücke, korrigiert am 2026-08-09.** Die Signale entstehen dort mit `const foo = new Foo()` aus einer Klasse mit `@signal() accessor` — auch das ist ein `new`, und auch das kannte die Regex nicht. Mit dem erweiterten Tor: 14 Saatpunkte, größter Radius **6 von 6**, 13 Übeltäter. Keine Sichtprüfung nötig, die Datei ist vollständig messbar.
- Vorgehen:
  1. **Muster, Regeln (a) bis (f) und Wegbegründung: unverändert aus Paket 7a, Schritt 1 und 2.** Sie werden hier nicht wiederholt und nicht neu verhandelt. Wer 7b bearbeitet, liest 7a Schritt 2 und wendet es an.
  2. **Die Ausnahmen in 7b** — ~~27 Tests~~ **die folgende Liste ist unvollständig und teilweise falsch; die nachgezählte Fassung steht im Nachtrag** (55 Tests). Regel (c): der Aufruf bleibt im `try`, der `finally`-Block bekommt nur den idempotenten Gürtel.
     - `src/EffectImpl.destroy.spec.ts:33, 189, 233, 473`
     - `src/createSignal.destroySignal.spec.ts:32, 154, 218, 259, 284` — die Datei prüft `destroySignal()`; hier steht die Regel praktisch in jedem Test
     - `src/effects.spec.ts:27, 240, 317, 494`
     - `src/createSignal.spec.ts:148, 178, 197`
     - `src/createSignal.mutedWrites.spec.ts:98, 118, 174`
     - `src/effects.onCreateEffect.spec.ts:15, 45, 57` — alle drei prüfen, was `destroy()` an der `Effect`-Hülle hinterlässt
     - `src/createSignal.beforeRead.spec.ts:74` `is cleared on destroy`
     - `src/effects-and-groups.spec.ts:67` `typed: name-deps without attach are a compile-time error`
     - `src/effects.errorIsolation.spec.ts:522` `leaves nothing behind after a run of failing writes`
     - `src/nested-effects-isolation.spec.ts:15` `nested effects isolation works as expected`
     - `src/nested-effects-staticDeps.spec.ts:49` `destroys the child effect when the parent is destroyed (MEM-001)`
  3. **Zwei Tests mit Spies**, deren `mockRestore()` als erste Anweisung in den `finally`-Block gehört: `src/createSignal.beforeRead.spec.ts` und `src/createSignal.spec.ts` benutzen `vi.spyOn`. Ohne Wiederherstellung im `finally` überlebt der Spy den Fehlschlag und verfälscht die folgenden Tests — dieselbe Klasse Kollateralschaden, nur ohne Zählerwächter, der sie meldet.
  4. `pnpm fix`, dann `pnpm check` sauber. Kein CHANGELOG-Eintrag (siehe 7a, Schritt 7).
- Verify: identisch zu Paket 7a, mit den Zahlen dieses Teilpakets.
  1. `pnpm world` — 44 / 478, Coverage 98,83 / 93,65 / 99,51 / 99,34, unverändert.
  2. ~~Das erschöpfende Tor aus 7a Verify (2b) über die zwanzig Dateien.~~ **Ersetzt — das Abnahmekriterium steht im Nachtrag, Abschnitt »Das Tor«.** Das grobe Tor aus 7a hat in seiner eigenen Runde 0 drei Lücken durchgelassen; es taugt hier nur noch als Vorher-Wert.
  3. `git status --porcelain --untracked-files=all` — nur die zwanzig Spec-Dateien, `git diff -- src/` außerhalb davon leer.
- Commit: `test: tear down signal and effect resources in a finally, not after the assertions (TEST-017)`
- **Nachtrag (2026-08-09, nach Paket 7a):** 7a ist als `e9904d0` abgenommen und hat zwei Review-Runden gebraucht. Alles darüber steht auf dem Stand *vor* diesem Commit; wo sich beides widerspricht, geht dieser Nachtrag vor. Die acht Dateien von 7a im aktuellen Stand sind die bessere Vorlage als jeder Text hier: was dort nach zwei Runden steht, ist abgenommen. Keine der zwanzig Dateien dieses Teilpakets wurde von `e9904d0` angefasst (`git show --stat e9904d0` listet genau die acht 7a-Dateien), die Zeilennummern oben gelten also unverändert.

  **(1) Die Arrange-Phase gehört vor das `try`, nicht hinein.** Das ist ab hier eine eigene Regel, nicht mehr nur ein Nebensatz in Regel (a), denn genau ihre Missachtung war der teuerste Befund von 7a: ein `const corpse = createSignal(1)` als erste Anweisung *innerhalb* des `try`, ohne Griff im `finally` — gemessen 19 von 38 roten Tests, und zwei Saat-Tore hatten die Stelle vorher durchgelassen. Operativ: nach dem Umbau darf innerhalb eines `try` keine Anweisung mehr stehen, die eine gezählte Ressource erzeugt und deren Bezeichner im `finally` nicht vorkommt. Das ist statisch prüfbar, ohne einen einzigen Testlauf, und der Implementierer prüft es selbst, bevor er abgibt:

  ```bash
  S=/tmp/claude-1000/-home-spw-spaceland-signalize/86735f96-4d5c-405e-956c-1b245ffad377/scratchpad
  python3 $S/static.py src/<datei>.spec.ts    # meldet NOHANDLE / UNBOUND / NO-TRY
  python3 $S/intry.py  src/<datei>.spec.ts    # listet jede Ressourcenerzeugung innerhalb eines try
  ```

  Geht eine Ressource partout nicht vor das `try` (weil ihre Erzeugung selbst geprüft wird), dann `let x: T | undefined;` davor deklarieren und im `finally` mit `x?.destroy()` abräumen. Ein `UNBOUND`-Treffer — eine Ressource ohne Bezeichner, etwa ein `createEffect(() => …)`, dessen Rückgabewert niemand hält — ist kein Freibrief, sondern die Aufforderung, ihm einen zu geben.

  **(2) Ein `finally` kann zu wenig tun.** Zwei Tests in 7a brauchten `sm.clear()` **zweimal**, weil der erste Aufruf über einen Effect-Cleanup einen neuen Eintrag nachlegt. Die Frage bei jedem Test lautet deshalb nicht »ist der Abbau drin«, sondern »räumt dieser Abbau vollständig ab«. Kandidaten in 7b: alles in `src/effects.cleanup.spec.ts` (zwölf Tests, deren Cleanup-Hooks per Konstruktion Seiteneffekte haben), `src/nested-effects-staticDeps.spec.ts` (Kind-Effects, die pro Rerun neu entstehen) und `src/EffectImpl.run.spec.ts:225` (`a cleanup that re-enters run()`). Kein Tor findet das von allein — es zeigt nur, *dass* etwas offen blieb, nicht warum.

  **(3) Das Abnahmekriterium von 7a war zu grob.** Es ist ersetzt, siehe »Das Tor« unten.

  - **Das Tor.** `blast2.py` und `gate2.sh` aus der zweiten 7a-Runde liegen noch im Scratchpad und sind die Grundlage. Sie haben in 7b jedoch eine gemessene Lücke: ihre `MAKES`-Regex kennt `new EffectImpl(` und `const foo = new Foo()` (Klasse mit `@signal() accessor`) nicht, und genau so entstehen die Ressourcen in `src/globalEffectStack.spec.ts`, `src/decorators.signal.spec.ts` und `src/object-signals.spec.ts`. Erweitert um `new [A-Z]\w*\(` und `storeAsObjectSignal(` liegen daneben:

    ```
    /tmp/claude-1000/-home-spw-spaceland-signalize/86735f96-4d5c-405e-956c-1b245ffad377/scratchpad/blast3.py
    /tmp/claude-1000/-home-spw-spaceland-signalize/86735f96-4d5c-405e-956c-1b245ffad377/scratchpad/gate3.sh
    ```

    Ist das Scratchpad beim Start des Pakets weg, ist das Tor in vier Sätzen nachbaubar: gesät wird eine fehlschlagende Assertion **(i)** auf die jeweils nächste Anweisung desselben Blocks nach jeder ressourcenerzeugenden Anweisung, **(ii)** auf die erste Anweisung im `try`, wenn davor eine Ressource entsteht, und **(iii)** auf die erste Anweisung mit `expect(` — den Punkt des alten Tors. Gesät wird ausschließlich **innerhalb** des `try`; ein Fehlschlag davor ist per Regel (1) nicht abzufangen. Nach jeder Saat läuft `npx vitest run <datei>` (rund 0,5 s), gezählt wird die Zahl roter Tests, danach wird die Datei aus einer Sicherung zurückgeschrieben.

    **Abnahmekriterium für 7b: `bash gate3.sh <datei>` meldet für alle zwanzig Dateien `groesster Radius 1, Uebeltaeter 0`.** Vorher-Werte, am 2026-08-09 gegen `e9904d0` gemessen, 359 Saatpunkte und **202 Übeltäter**:

    | Datei | Saatpunkte | größter Radius | Übeltäter |
    | --- | ---: | ---: | ---: |
    | `src/EffectImpl.destroy.spec.ts` | 38 | **15 von 15** | 15 |
    | `src/nested-effects-staticDeps.spec.ts` | 36 | 9 von 9 | 17 |
    | `src/effects.cleanup.spec.ts` | 35 | 12 von 12 | 13 |
    | `src/effects.spec.ts` | 34 | **13 von 13** | 11 |
    | `src/hibernate.spec.ts` | 33 | 14 von 16 | 24 |
    | `src/createSignal.spec.ts` | 29 | **13 von 13** | 24 |
    | `src/createSignal.destroySignal.spec.ts` | 21 | 7 von 7 | 9 |
    | `src/object-signals.spec.ts` | 21 | 5 von 6 | 15 |
    | `src/effects.errorIsolation.spec.ts` | 20 | **11 von 11** | 16 |
    | `src/EffectImpl.run.spec.ts` | 19 | **6 von 6** | 16 |
    | `src/createSignal.mutedWrites.spec.ts` | 15 | **7 von 7** | 13 |
    | `src/decorators.signal.spec.ts` | 14 | **6 von 6** | 13 |
    | `src/bequiet.spec.ts` | 10 | **2 von 2** | 6 |
    | `src/effects.priority.spec.ts` | 9 | **2 von 2** | 2 |
    | `src/createSignal.beforeRead.spec.ts` | 6 | **4 von 4** | 4 |
    | `src/effects-and-groups.spec.ts` | 6 | **2 von 2** | 1 |
    | `src/globalEffectStack.spec.ts` | 4 | **2 von 2** | 1 |
    | `src/effects.onCreateEffect.spec.ts` | 3 | **3 von 3** | 2 |
    | `src/effects.noAutorun.spec.ts` | 3 | 1 von 1 | 0 |
    | `src/nested-effects-isolation.spec.ts` | 3 | 1 von 1 | 0 |
    | **Summe** | **359** | | **202** |

    Zwölf der zwanzig Dateien fallen an ihrer schlimmsten Stelle **vollständig** um. Der ganze Durchlauf dauert rund vier Minuten; er ist keine Abschlussprüfung, sondern das Werkzeug während der Arbeit — `gate3.sh <datei> <n>` fährt einen einzelnen Saatpunkt.

    Zwei Belege, dass das erweiterte Tor misst und nicht bloß nickt: gegen die drei 7a-Dateien, in denen die neue Regex überhaupt zusätzliche Punkte findet, meldet es `SignalAutoMap.spec.ts: 76 / 1 / 0`, `SignalLink.spec.ts: 83 / 1 / 0` und `link.asyncValues.spec.ts: 6 / 1 / 0` — 7a hält auch unter dem schärferen Tor. Und `effects.noAutorun.spec.ts` sowie `nested-effects-isolation.spec.ts` stehen schon vor dem Umbau auf 0, weil sie nur je einen Test haben; dort beweist das Tor nichts, dort zählt die Sichtprüfung.

  - **Die Ausnahmen sind nachgezählt: nicht 27, sondern 55.** Die Liste in Schritt 2 oben ist weder vollständig noch überall richtig — `src/createSignal.spec.ts:148` und `src/createSignal.mutedWrites.spec.ts:98` stehen darin, obwohl ihr Abbau geschlossen am Ende steht (reiner Verschiebefall), und zwölf Tests in `src/effects.cleanup.spec.ts` fehlen, obwohl in jedem einzelnen `effect.destroy()` der Act ist und danach noch geprüft wird. Nachgezählt am 2026-08-09 über alle 138 Tests der zwanzig Dateien, reproduzierbar mit `python3 $S/rulec2.py <dateien>`:

    **(B) 24 Tests ohne nachlaufenden Teardown** — der reine Fall von Regel (c): es gibt nichts zu verschieben, der `finally`-Block bekommt ausschließlich den idempotenten Gürtel.
    - `src/EffectImpl.destroy.spec.ts:33, 189, 233, 473`
    - `src/effects.spec.ts:27, 240, 317, 494`
    - `src/effects.onCreateEffect.spec.ts:15, 45, 57`
    - `src/createSignal.spec.ts:178, 197`
    - `src/createSignal.destroySignal.spec.ts:32, 65`
    - `src/object-signals.spec.ts:61, 78`
    - `src/createSignal.mutedWrites.spec.ts:118` · `src/decorators.signal.spec.ts:197` · `src/createSignal.beforeRead.spec.ts:74` · `src/effects.errorIsolation.spec.ts:522` · `src/effects-and-groups.spec.ts:67` · `src/nested-effects-isolation.spec.ts:15` · `src/nested-effects-staticDeps.spec.ts:49`

    **(A) 31 Tests mit einem Abbau mitten im Rumpf *und* einem nachlaufenden Teardown** — der gefährlichere Fall, weil er wie ein reiner Verschiebefall aussieht: der nachlaufende Teardown wandert ins `finally`, der Abbau in der Mitte bleibt stehen, und der `finally`-Block braucht beide.
    - `src/EffectImpl.destroy.spec.ts:74, 107, 133, 163, 280, 318, 397, 444, 506, 525`
    - `src/effects.cleanup.spec.ts:18, 53, 94, 126, 154, 190, 224, 253, 280, 324, 371, 415` — die ganze Datei
    - `src/createSignal.spec.ts:112, 315` · `src/nested-effects-staticDeps.spec.ts:162, 248` · `src/EffectImpl.run.spec.ts:200, 225` · `src/effects.spec.ts:57` · `src/createSignal.mutedWrites.spec.ts:174` · `src/effects.noAutorun.spec.ts:15`

    Dazu drei Tests, deren Abbau in einem *Callback* steckt (`src/createSignal.destroySignal.spec.ts:154, 218, 259` — `destroySignal(a)` innerhalb des Effect-Rumpfs). Sie tragen auf Anweisungsebene gar keinen Teardown; der `finally`-Block bekommt den vollen idempotenten Gürtel.

  - **Zahlenlage sonst.** 20 Dateien, 4 941 Zeilen (`wc -l`; die »4 961« oben zählen die Dateiendzeile mit), **138 Tests**. 129 davon erzeugen mindestens eine gezählte Ressource, 2 tragen schon einen `try`/`finally` (`src/EffectImpl.destroy.spec.ts:397`, `src/effects.spec.ts:290`) — **127 Tests sind umzustellen**, drei mehr als in der Tabelle oben. Neun Tests erzeugen überhaupt keine Ressource und brauchen nichts: `src/hibernate.spec.ts:25, 30, 175, 249, 271, 299`, `src/createSignal.spec.ts:70`, `src/effects.spec.ts:515`, `src/object-signals.spec.ts:26`. Sie bleiben unangetastet; ein `finally` um nichts herum ist kein Muster, sondern Lärm.

  - **Q5 (das hängende Promise) betrifft 7b nicht.** In den zwanzig Dateien gibt es genau zwei `async`-Tests (`src/effects.cleanup.spec.ts:94`, `src/effects.spec.ts:57`) und **keinen einzigen** Aufruf von `nextValue()`, `asyncValues()` oder ein `for await` — gegengeprüft per `grep` am 2026-08-09. Der Befund aus 7a entsteht an genau diesen Stellen: ein Iterator- oder `nextValue()`-Promise, das der `finally`-Teardown verwirft, während der Fehlschlag den Zuhörer schon weggerissen hat. Ohne diese Konstruktion gibt es hier nichts zu entscheiden. 7b lässt Q5 also stehen, nicht aus Bequemlichkeit, sondern mangels Gegenstand — die Entscheidung fällt in 7c, wo `src/SignalGroup.gc.spec.ts` zehn `async`-Tests hat.

  - **Schnitt und Reihenfolge bleiben.** 7b wird nicht geteilt: die zwanzig Dateien sind klein und voneinander unabhängig, und die zwei Runden von 7a gingen für das *Finden* des Tors drauf, nicht für die Arbeit — dieses Mal steht es vorher da. Die Reihenfolge 7b → 7c bleibt, 7c hängt weiterhin nur am Muster aus 7a. Angehoben ist dagegen die Modellstufe (siehe oben): 55 Regel-(c)-Entscheidungen statt der geplanten 27 sind keine Fleißarbeit mehr.

  - **Baum nach allen Messungen sauber:** `git status --short` zeigt nur `M remediation-plan.md`, `git diff -- src/` ist leer. Jede Saat wurde über eine Sicherung im Scratchpad zurückgebaut, kein `git`-Schreibbefehl war beteiligt.

- **Ergebnis (2026-08-09)** — Hash `ef150a9`. Verify vom Orchestrator selbst gefahren: `pnpm typecheck` 0 Fehler, `pnpm check` 85 Dateien sauber, `pnpm test` 44 Dateien / 478 Tests grün, Coverage 98,83 / 93,65 / 99,51 / 99,34 — ziffergleich. `grep -rn SEEDED src/` leer, genau 20 geänderte Dateien unter `src/`. **128 Tests umgestellt** (127 geplant, Q4 kam in Runde 1 dazu), 129 `finally`-Blöcke, alle 55 Ausnahmen bestätigt, keine zusätzliche gefunden, keine widerlegt.
- Tor `gate3.sh` über alle zwanzig Dateien: **vorher 359 Saatpunkte, größter Radius 15, 202 Übeltäter — nachher 204 / 1 / 0.** Der Reviewer hat es unabhängig nachgefahren, mit integrierter Meldungsprüfung: 204 / 1 / 0 / 0 maskiert.
- **Eine Runde, vier Befunde, alle geschlossen.** Der Reviewer hat ein drittes Tor gebaut, das nicht den Radius prüft, sondern ob die *gemeldete Fehlermeldung* nach der Saat noch von der Saat stammt — `gate3` und `gate4` sind dafür blind. Zwei der vier Befunde saßen genau dort:
  - Q1 `src/EffectImpl.destroy.spec.ts:132` — eine Arrange-Zuweisung war in den `try` gewandert, deren Ziel der Cleanup dereferenziert. Bei einem Fehlschlag lief das `finally` in einen `TypeError` und ersetzte die eigentliche Meldung. Zurück vor das `try`.
  - Q2 `src/EffectImpl.destroy.spec.ts:253, 312, 357, 403` — vier `finally` riefen `destroy()` auf einem Effect mit absichtlich werfendem Cleanup; `EffectImpl#destroy()` sammelt und wirft am Ende, der Abbau war also kein No-Op und ersetzte die Assertion. Jetzt mit `try { … } catch {}` innerhalb des `finally`, wie Regel (d) es vorsieht. Der Reviewer hat gemessen, dass `destroySignal(a, b)` dahinter weiterhin läuft.
  - Q3 `src/hibernate.spec.ts:430` — Assertions im Effect-Callback in der Arrange-Zone, Radius 2, von keinem Tor erreichbar. **Hier hat der Implementierer den Vorschlag des Reviewers widerlegt**: das naheliegende `let effect` plus `effect?.destroy()` schließt die Lücke nicht, weil `createEffect` bei einem werfenden ersten Lauf nie bis `new Effect(effect)` kommt und die Zuweisung nie stattfindet. Der Reviewer hat es auf einer zweiten Kopie nachgebaut und bestätigt — Radius bleibt 2. Gelöst über den `onCreateEffect`-Griff, der in derselben Datei zweimal steht.
  - Q4 `src/EffectImpl.destroy.spec.ts:437` — der Plan zählte ihn zu den Tests, die schon ein `try`/`finally` tragen; das schützte aber nur das `unsubscribe()`, sechs Assertions und ein `destroySignal(c)` standen ungeschützt dahinter. Der Radius war nur deshalb 1, weil die Datei ausschließlich `assertEffectsCount` führt.
- **Zwei `high`-Befunde im Produktionscode**, hier gefunden, vom Reviewer am Code bestätigt und gemessen, vom Nutzer am 2026-08-09 in den Lauf aufgenommen → **Paket 31**. Q3 ist die unmittelbare Folge von P1: der Testcode baut sich seit jeher Gerüste um ein Leck herum, das im Produktionscode gehört.
- Nebenbefunde:
  - **Zehn der zwanzig Dateien führen nur `assertEffectsCount`** und sehen ein geleaktes Signal überhaupt nicht. Genau deshalb konnten acht Tests jahrelang ihre Signale stehen lassen — der Implementierer hat ihnen in diesem Paket den Abbau gegeben, den es vorher gar nicht gab. Wächter verbreitern verbietet Regel (f); Kandidat für Paket 9.
  - `src/EffectImpl.ts:419` — der Guard `if (!effect.destroyed)` vor `saveSignalsFromDeps()` ist redundant, `whenSignalIsRead()` steigt bei `#destroyed` schon selbst aus (`:624`). Fiel bei einer Falsifikationsprobe des Reviewers ab. Nächstes Audit.
  - `src/createSignal.destroySignal.spec.ts:121, 152, 158` — drei auskommentierte `assertSignalDestroySubscriptionsCountChange`-Assertions, unverändert übernommen.
  - Zwei `gate4`-Lücken bleiben bewusst offen: `createSignal.destroySignal.spec.ts:94` (Radius 6) ist mit dem `finally`-Mechanismus nachweislich nicht schließbar — es ist P2; `decorators.signal.spec.ts:195` (Radius 2) wäre schließbar, das Gerüst wäre dort aber reines Rauschen, weil im Callback keine Assertion steht.


#### [x] 7c. Aufräumen in ein finally ziehen: SignalGroup (7c1 + 7c2)
- Findings: TEST-017 (high) — Teil 3 von 3
- **Geteilt in 7c1 und 7c2** (2026-08-09, Begründung im Nachtrag nach 7b). Alles unter diesem Kopf gilt für beide Hälften; die Schnittkante steht im Nachtrag.
- Ziel: Die vier `SignalGroup`-Specs folgen demselben Muster, bevor die Pakete 9, 14 und 19 dieselbe Klasse umbauen. Hier steht der größte im Repo gemessene Kollateralschaden überhaupt: ~~**66 von 84**~~ **78 von 84** roten Tests in `src/SignalGroup.spec.ts`.
- Bereich: 4 `*.spec.ts` in `src/`, ~~3 344~~ **3 340** Zeilen (`wc -l`)
- Hängt ab von: Paket 7a (Muster)
- Modell: stärkste Stufe — und zwar begründet, nicht vorsorglich. `src/SignalGroup.spec.ts` allein hat 84 Tests; ~~28~~ **60** Tests verteilt über die vier Dateien fallen unter die Ausnahmeregel; `src/SignalGroup.teardown.spec.ts` ist die Datei, in der ein Teardown *absichtlich* wirft, also genau der Fall, für den Regel (d) geschrieben ist; und die vier Dateien tragen als einzige einen zweiten, konkurrierenden Aufräummechanismus in den Hooks, dessen Zusammenspiel mit dem neuen `finally` verstanden sein will.
- Hash: —
- Dateien: **die Zahlen dieser Tabelle stammen vom groben Tor aus 7a und sind überholt; die nachgemessene Fassung steht im Nachtrag nach 7b.**

  | Datei | umzustellende Tests | Seed-Punkte | größter gemessener Radius | Übeltäter | ohne den Sweep: Radius / Übeltäter |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | `src/SignalGroup.spec.ts` | ~~81~~ 82 | 71 | ~~**66 von 84**~~ **78 von 84** | 8 | 71 / 34 |
  | `src/SignalGroup.off.spec.ts` | 20 | 19 | **12 von 20** | 5 | 20 / 17 |
  | `src/SignalGroup.teardown.spec.ts` | 19 | 22 | 1 von 22 | 0 | 22 / 16 |
  | `src/SignalGroup.gc.spec.ts` | ~~3~~ 8 | 10 | 4 von 10 | 1 | 8 / 3 |
  | **Summe** | ~~**123**~~ **129** | **122** | | **14** | **70** |
- Abgleich (2026-08-09): siehe Paket 7a. Drei Punkte, die nur 7c betreffen und die Reihenfolge der Teilpakete erklären:
  - **Diese vier Dateien haben bereits eine Bremse, und sie ist erstaunlich wirksam.** Alle vier rufen `SignalGroup.clear()` in ihrem `afterEach` ~~(in `SignalGroup.spec.ts` zusätzlich im `beforeEach`)~~ **und in ihrem `beforeEach` — alle vier, nicht nur `SignalGroup.spec.ts`**, *bevor* die Wächter prüfen. Der statische Sweep räumt jede gruppengebundene Ressource ab, egal ob der Testrumpf dazu kam. Gemessen senkt er die Zahl der Übeltäter ~~von 70 auf 14~~ **von 236 auf 114** (erweitertes Tor, 2026-08-09). Genau deshalb sah das Audit an seiner einen Saatstelle nur `1 von 84` — die Zahl stimmt, sie ist nur nicht repräsentativ.
  - **Er ist trotzdem nicht genug.** Das erschöpfende Tor findet in `src/SignalGroup.spec.ts` ~~acht~~ **95** Stellen, an denen der Sweep nicht greift, und an der schlimmsten fallen ~~**66 von 84**~~ **78 von 84** Tests. Das ist der größte Einzelwert im ganzen Repo, größer als alles in 7a und 7b. Was durchrutscht, sind Signale ohne `{attach}` und Effects, die keiner Gruppe gehören — für die kennt der Sweep keinen Griff. **Am schlimmsten Punkt hilft er gar nichts: mit und ohne Sweep fallen dort dieselben 78 Tests.**
  - **Der Sweep maskiert heute nichts und bleibt deshalb stehen.** Gegenprobe am 2026-08-09: mit auskommentiertem `SignalGroup.clear()` in den Hooks laufen alle vier Dateien vollständig grün (84 / 20 / 22 / 10). Er verdeckt also kein einziges Leck, das die Wächter sonst fänden — er kostet keine Schärfe und bringt eine zweite Sicherung. Wer ihn beim Umbau »aufräumen« will, tut das Gegenteil.
- Vorgehen:
  1. **Muster, Regeln (a) bis (f) und Wegbegründung: unverändert aus Paket 7a, Schritt 1 und 2.**
  2. **`SignalGroup.clear()` bleibt in den Hooks, unverändert, in allen vier Dateien.** Begründung im Abgleich. Es kommt auch keiner in die anderen 28 Dateien dazu — dort gibt es überwiegend keine Gruppen, und ein zweiter Mechanismus ohne Nutzen ist nur eine zweite Stelle, die jemand pflegen muss.
  3. **Die Ausnahmen in 7c** — ~~28 Tests~~ **die folgende Liste ist unvollständig; nachgezählt sind es 60, siehe Nachtrag nach 7a** — unter Regel (c). `src/SignalGroup.teardown.spec.ts` stellt allein 13 davon; zwei davon (`:487`, `:750`) haben ihren `finally`-Block schon.
     - `src/SignalGroup.spec.ts:99, 694, 744, 1168, 1185, 1270, 1293, 1372, 1447`
     - `src/SignalGroup.off.spec.ts:153, 266, 423, 568`
     - `src/SignalGroup.teardown.spec.ts:39, 134, 290, 309, 336, 382, 421, 460, 487, 680, 714, 750, 793`
     - `src/SignalGroup.gc.spec.ts:113, 138`
  4. **Regel (d) ist hier keine Theorie.** ~~Sieben Tests~~ **14 Tests** in `src/SignalGroup.teardown.spec.ts` (~~`:39, 134, 336, 382, 680, 714, 793`~~ **`:39, 87, 134, 336, 382, 487, 550, 583, 608, 648, 680, 714, 750, 793`** — jeder Test der Datei, der ein `throw new Error(…)` in einem Teardown-Pfad stehen hat) und ~~zwei~~ **vier** in `src/EffectImpl.destroy.spec.ts` (in 7b, dort als Q2 nachgetragen) prüfen, dass ein Teardown wirft und die Aufräumarbeit trotzdem zu Ende läuft. Ein `finally { group.clear(); }` dahinter dürfte nicht ein zweites Mal werfen, sonst ersetzt es die eigentliche Fehlermeldung. Gemessen tut es das für `group.clear()` nicht: nach einem `group.clear()`, der mit `cleanup boom` geworfen hat, ist ein zweiter Aufruf still. **7b hat aber gezeigt, dass das für `EffectImpl#destroy()` gerade nicht gilt** — dort sammelt der Abbau und wirft am Ende, vier `finally`-Blöcke haben deshalb die Assertion ersetzt. **Das ist die Stelle, an der der Implementierer hinsehen muss** — bei jedem dieser 14 Tests einmal prüfen, ob der wiederholte Abbau wirklich stumm bleibt, und wo nicht, ein `try { … } catch { /* ignore */ }` innerhalb des `finally` setzen. Nachweis führt nicht das Auge, sondern das Meldungs-Tor (Nachtrag nach 7b, »Das zweite Tor«).
  5. **`src/SignalGroup.gc.spec.ts` ist eine GC-Suite** — zehn `async`-Tests, die auf `globalThis.gc` angewiesen sind und in `vitest.config.ts` über das eigene `gc`-Projekt laufen. Der `finally`-Block bleibt synchron; die vorhandenen `await`-Punkte und die ~~drei~~ **zwei** Tests, die schon einen `finally`-Block haben (`:160` und `:281`, beide tragen dort nur ein `mockRestore()` — siehe Nachtrag), bleiben ~~unangetastet~~ **in ihrem Kern unangetastet, bekommen aber den fehlenden Rest ihres Abbaus**.
  6. **`AGENTS.md`, Abschnitt ~~»Testing conventions« (heute die Aufzählung ab `AGENTS.md:215`)~~ `## Repo conventions` (Überschrift heute `AGENTS.md:211`, Aufzählung ab `:213` — einen Abschnitt dieses Namens gibt es nicht, geprüft am 2026-08-09):** einen Punkt anhängen, der das Muster festhält, damit die Pakete 8 bis 10 und alles danach ihm folgen. Inhalt in einem Satz: jeder Test in einer Datei mit Zählerwächtern räumt seine Ressourcen im `finally` ab, nicht hinter den Assertions, weil ein Fehlschlag sonst über die Wächter jeden folgenden Test derselben Datei mitreißt; ein `destroy()`, auf das noch eine Assertion folgt, bleibt im `try`; ein Abbau, der selbst werfen kann, kommt in ein `try { … } catch { /* ignore */ }` innerhalb des `finally`, sonst ersetzt er die Fehlermeldung; Vorlage ist `src/link.spec.ts` (MEM-005). Der Punkt steht direkt neben dem vorhandenen »Subscription-leak verification«-Punkt (heute `AGENTS.md:219`), der dieselbe Sorte Disziplin beschreibt. **Zeilennummern nach der eigenen Änderung neu ablesen**, nicht aus diesem Plan übernehmen. **Ein zweiter halber Satz gehört dazu** — die Q5-Eigenschaft, siehe Nachtrag.
  7. **`CHANGELOG.md`, unter `## Unreleased` → `### Tests`, eine Zeile für den gesamten Sweep** — sie kommt erst hier, weil sie erst hier wahr ist:
     - ~~every spec with counter guards now tears its resources down in a `finally`, so a real regression fails one test instead of taking the rest of the file with it — 356 tests across 32 files (TEST-017)~~
     - **every spec with counter guards now tears its resources down in a `finally`, so a real regression fails one test instead of taking the rest of the file with it — 366 tests across 32 files (TEST-017)**

     Die »366« ist die Planzahl: 109 (7a, acht Dateien, geliefert) + 128 (7b, zwanzig Dateien, geliefert) + 129 (7c, vier Dateien, geplant). **Der Implementierer von 7c2 setzt die tatsächliche Summe ein**, nicht diese — 7b hat 128 statt der geplanten 127 geliefert, und dasselbe kann hier passieren. Die »32 Dateien« stehen dagegen fest: 8 + 20 + 4. Die drei Dateien, die schon vor dem Sweep umgestellt waren, zählen nicht mit.
- Verify: identisch zu Paket 7a, mit zwei Zusätzen, die der Sweep nötig macht. **Ergänzt um ein zweites Abnahmekriterium, siehe Nachtrag nach 7b.**
  1. `pnpm world` — 44 / 478, Coverage 98,83 / 93,65 / 99,51 / 99,34, unverändert.
  2. ~~Das erschöpfende Tor aus 7a Verify (2b)~~ **Das erweiterte Tor (`blast3.py` / `gate3.sh`)** über die vier Dateien. **Abnahmekriterium: `groesster Radius 1, Uebeltaeter 0`.** Vorher: ~~14 Übeltäter an 122 Saatpunkten, größter Radius 66~~ **114 Übeltäter an 453 Saatpunkten, größter Radius 78**.
  3. **Dasselbe Tor ein zweites Mal, mit ausgeschaltetem Sweep.** Erst das beweist, dass die `finally`-Blöcke die Arbeit tun und nicht `SignalGroup.clear()` sie kaschiert. Vor dem Lauf in allen vier Dateien jedes `SignalGroup.clear();` innerhalb eines `beforeEach`/`afterEach` auskommentieren, danach zurückbauen:
     ```bash
     # vor dem Lauf: Sicherung anlegen, Sweep aushängen
     for f in SignalGroup.spec SignalGroup.off.spec SignalGroup.teardown.spec SignalGroup.gc.spec; do
       cp src/$f.ts /tmp/$f.bak
     done
     # ... SignalGroup.clear(); in den Hooks auskommentieren, gate.sh laufen lassen ...
     for f in SignalGroup.spec SignalGroup.off.spec SignalGroup.teardown.spec SignalGroup.gc.spec; do
       cp /tmp/$f.bak src/$f.ts && rm /tmp/$f.bak
     done
     ```
     **Erwartet auch ohne Sweep: `groesster Radius 1, Uebeltaeter 0` für alle vier.** Gegen den heutigen Stand liefert derselbe Lauf ~~70 Übeltäter und Radien bis 71~~ **236 Übeltäter und Radien bis 78** — am 2026-08-09 mit dem erweiterten Tor so gemessen, daran sieht man, dass er wirklich misst. Wird das nicht erreicht, fehlt ein `finally`; der Sweep würde es im Alltag verdecken. **Die Sweep-freie Kopie liegt fertig im Scratchpad** (`$S/p7c/nosweep`, die vier Hook-Aufrufe mit `// SWEEP OFF:` auskommentiert), samt beider Vorher-Protokolle (`$S/p7c/with-sweep.log`, `$S/p7c/no-sweep.log`).
  4. `git status --porcelain --untracked-files=all` — die vier Spec-Dateien, `AGENTS.md` und `CHANGELOG.md`, sonst nichts. Kein `/tmp/*.bak`, kein auskommentierter Sweep im Baum. **Das ist bei diesem Teilpaket der wichtigste Punkt des Verify:** Schritt 3 verändert Testcode, und ein vergessener Rückbau nähme genau die Bremse heraus, die das Paket stehen lassen will.
- Commit: `test: tear down SignalGroup resources in a finally, not after the assertions (TEST-017)`
- **Nachtrag (2026-08-09, nach Paket 7a):** Die drei Lehren aus 7a gelten hier genauso; ausgeschrieben stehen sie im Nachtrag zu **7b**, und wer 7c anfängt, liest sie dort zuerst. In Kürze:
  1. **Die Arrange-Phase gehört vor das `try`.** Eine im `try` erzeugte Ressource ohne Griff im `finally` ist die Lücke, die kein Saat-Tor sieht, das nur vor Assertionen sät — in 7a kostete sie 19 von 38 Tests. Statisch prüfbar mit `static.py` / `intry.py` im Scratchpad.
  2. **Ein `finally` kann zu wenig tun.** Zwei 7a-Tests brauchten `sm.clear()` zweimal, weil der erste Aufruf per Cleanup einen neuen Eintrag nachlegt. Hier ist das der Normalfall, nicht die Ausnahme: `group.clear()` läuft durch fremde Teardown-Ketten, und `src/SignalGroup.teardown.spec.ts` ist die Datei, in der ein Teardown absichtlich wirft. Bei jedem Test fragen, ob der Abbau *vollständig* ist, nicht ob er *da* ist.
  3. **Das Abnahmekriterium ist das erweiterte Tor** (`blast3.py` / `gate3.sh` im Scratchpad, Pfad und Nachbauanleitung im 7b-Nachtrag), nicht das grobe aus 7a Verify (2b). Für die vier Dateien findet es **453 Saatpunkte** statt der 122 aus der Tabelle oben — Verify-Schritt 2 und 3 laufen mit dem neuen Tor, das Kriterium selbst (`groesster Radius 1, Uebeltaeter 0`, einmal mit und einmal ohne den `SignalGroup.clear()`-Sweep) bleibt unverändert. Rechne mit rund fünf Minuten pro Durchlauf, also zehn für beide.
- **Die 28 Ausnahmen in Schritt 3 sind zu wenig — nachgezählt sind es 60.** Dieselbe Untererfassung wie in 7b, dort ist die Methode beschrieben. Über die vier Dateien: **43 Tests ohne nachlaufenden Teardown** (reine Regel (c)) und **17 Tests mit einem Abbau mitten im Rumpf plus nachlaufendem Teardown** — letztere sind die gefährlichen, weil sie wie reine Verschiebefälle aussehen. Die Listen erzeugt `python3 $S/rulec2.py src/SignalGroup.spec.ts src/SignalGroup.off.spec.ts src/SignalGroup.teardown.spec.ts src/SignalGroup.gc.spec.ts`; der Implementierer soll sie selbst ziehen, weil die Zeilennummern sich mit jedem umgestellten Test verschieben. Die neun Tests ganz ohne Ressource bleiben unangetastet.
- **Q5 (das hängende Promise) wird hier entschieden.** In 7b gibt es keinen Gegenstand dafür: zwei `async`-Tests, kein `nextValue()`, kein `for await`. In 7c gibt es einen — `src/SignalGroup.gc.spec.ts` besteht aus zehn `async`-Tests. Wer 7c umsetzt, prüft an dieser Datei, ob das Muster dort dieselbe Nebenwirkung erzeugt (Vitest meldet `Errors 1 error` und schreibt es dem *nächsten* Testnamen zu, während die Testzahl bei 1 bleibt), und entscheidet dann einmal für den ganzen Sweep: beheben oder als bekannte Eigenschaft dokumentieren. Kein Tor sieht das; es braucht einen Blick in die Vitest-Ausgabe eines gesäten Laufs, nicht nur in die Zeile `Tests`. **Entschieden im Nachtrag unten.**

- **Nachtrag (2026-08-09, nach Paket 7b):** 7b ist als `ef150a9` abgenommen, in einer Runde mit vier Befunden. Der Plantext oberhalb der beiden Nachträge steht auf dem Stand *vor* `e9904d0`; wo sich etwas widerspricht, gewinnt der jüngere Nachtrag, und dieser ist der jüngste. (`$S` ist hier wie überall im Plan das Scratchpad-Verzeichnis der Session, `/tmp/claude-1000/-home-spw-spaceland-signalize/86735f96-4d5c-405e-956c-1b245ffad377/scratchpad`.) **Die 28 Dateien aus 7a und 7b im aktuellen Stand sind die Vorlage, nicht dieser Text** — was dort steht, ist durch zwei beziehungsweise eine Review-Runde gegangen. `git show --name-only --format= ef150a9` listet zwanzig Dateien, **keine davon eine `SignalGroup`-Spec**; `e9904d0` listet die acht 7a-Dateien. Alle Zeilennummern in diesem Block gelten also unverändert.

  **Die zwei neuen Lehren aus 7b** — sie kommen zu den drei aus 7a hinzu, die weiter oben in Kürze stehen.

  **(4) Ein `finally` kann die Fehlermeldung ersetzen, ohne dass ein Radius-Tor es merkt.** Zwei der vier 7b-Befunde waren genau das, und beide Tore (`gate3`, das feinere `gate4`) waren dafür blind, weil sie nur zählen, *wie viele* Tests rot werden, nicht *woran* sie sterben. Q1: eine Arrange-Zuweisung war in den `try` gewandert, deren Ziel der Cleanup dereferenziert — bei einem Fehlschlag lief das `finally` in einen `TypeError` und meldete den statt der Assertion. Q2: vier `finally`-Blöcke riefen `destroy()` auf einem Effect mit absichtlich werfendem Cleanup; `EffectImpl#destroy()` sammelt und wirft am Ende, der Abbau war also kein No-Op. Regel (d) schreibt dafür ein `try { … } catch { /* ignore */ }` **innerhalb** des `finally` vor.

  **Für 7c ist das das wichtigste Werkzeug überhaupt.** `src/SignalGroup.teardown.spec.ts` besteht zu 14 von 22 Tests aus Fällen, in denen ein Teardown absichtlich wirft (Schritt 4 oben, Liste nachgezählt). Ein Radius-Tor gibt dort grünes Licht, während jede gesäte Assertion in Wahrheit durch ein `cleanup boom` ersetzt wird. Genau die Datei, in der man es am wenigsten sieht, ist die, in der es am wahrscheinlichsten passiert.

  **(5) Ein Hoist kann eine Lücke verschieben statt sie zu schließen.** In 7b war `let effect: Effect | undefined` plus `effect?.destroy()` im `finally` an einer Stelle wirkungslos: `createEffect()` kommt bei einem werfenden ersten Lauf nie bis `new Effect(effect)`, die Zuweisung findet also nie statt, und der Griff greift ins Leere. Der Reviewer hat den Vorschlag selbst nachgebaut und bestätigt — Radius blieb 2. Gelöst über einen `onCreateEffect()`-Griff, der die Hülle vor dem ersten Lauf einsammelt. Das ist die Testseite von **P1** (Paket 31).
  *Für 7c geprüft:* dieselbe Konstellation — eine Assertion **innerhalb** eines Effect-Callbacks in der Arrange-Zone, deren Fehlschlag `createEffect()` abbricht — steht in den vier Dateien an keiner Stelle so, dass sie ein Tor erreicht; die `onCreateEffect`-Vorlage aus `src/hibernate.spec.ts` ist trotzdem die Antwort, falls der Implementierer beim Umbau auf eine stößt. Wonach zu suchen ist: ein `createEffect(() => { … expect(…) … })` oder `assert…Count(…)` im Callback, das beim ersten Lauf mitläuft.

  - **Das zweite Tor (Meldungsprüfung).** Der 7b-Reviewer hat es gebaut, es liegt im Scratchpad und wird in 7c zum **zweiten Abnahmekriterium neben dem Radius-Tor**:

    ```
    $S/review/maskgate.sh     # nur Meldungsprüfung
    $S/review/bothgate.sh     # Radius + Meldung in einem Durchlauf
    $S/p7c/gate7c.sh          # dasselbe, plus getrennte Zählung von Radius-0-Fällen
    ```

    Prinzip in drei Sätzen, falls das Scratchpad weg ist: nach jeder Saat läuft `npx vitest run <datei>` und die **komplette Ausgabe** wird aufgehoben, nicht nur die Zeile `Tests`. Enthält sie den Marker `SEEDED` nicht, hat irgendetwas zwischen der gesäten Assertion und dem Report die Meldung ersetzt — der Saatpunkt gilt als `MASKED` und wird mit der ersten `Error`-Zeile ausgegeben. Danach wird die Datei aus der Sicherung zurückgeschrieben. Es kostet keinen zusätzlichen Testlauf, nur ein zweites `grep` auf dieselbe Ausgabe; deshalb gehört es in denselben Durchlauf wie das Radius-Tor.

    **Vorher-Wert, am 2026-08-09 über alle 453 Saatpunkte gemessen: 0 maskiert, mit und ohne Sweep.** Das ist kein Zufall und auch kein Freibrief — es gibt heute erst sechs `finally`-Blöcke in den vier Dateien. Der Wert steht hier, damit nach dem Umbau »0 maskiert« ein *gehaltener* Zustand ist und keine glückliche Fügung: jeder neue `finally`-Block ist ein neuer Kandidat, die Meldung zu schlucken.

  - **Die Zahlenlage, neu belegt.** Alles mit `blast3.py` / `gate3.sh` (dem erweiterten Tor) am 2026-08-09 gegen `ef150a9` gemessen, auf zwei Repo-Kopien im Scratchpad, Protokolle unter `$S/p7c/`:

    | Datei | Tests | umzustellen | Saatpunkte | **mit Sweep** Radius / Übeltäter | **ohne Sweep** Radius / Übeltäter |
    | --- | ---: | ---: | ---: | ---: | ---: |
    | `src/SignalGroup.spec.ts` | 84 | 82 | 278 | **78 von 84** / 95 | **78 von 84** / 130 |
    | `src/SignalGroup.off.spec.ts` | 20 | 20 | 78 | 17 von 20 / 13 | **20 von 20** / 50 |
    | `src/SignalGroup.teardown.spec.ts` | 22 | 19 | 65 | 17 von 22 / 2 | **22 von 22** / 41 |
    | `src/SignalGroup.gc.spec.ts` | 10 | 8 | 32 | 4 von 10 / 4 | 8 von 10 / 15 |
    | **Summe** | **136** | **129** | **453** | **78** / **114** | **78** / **236** |

    Was sich gegen die Tabelle oben verschiebt und warum:
    - **Saatpunkte 122 → 453.** Bestätigt die Ansage des vorigen Nachtrags auf den Punkt. Das grobe Tor sät einmal je Test vor der ersten Assertion; das erweiterte sät zusätzlich nach jeder ressourcenerzeugenden Anweisung und auf die erste Anweisung im `try`.
    - **Größter Radius 66 → 78 von 84.** Die schlimmsten Stellen liegen am Dateianfang (`src/SignalGroup.spec.ts:89, 106, 108, 125, 147, 157`) und sind alle derselbe Bau: `const signal = createSignal(1)` gefolgt von `group.attachSignal(signal)`. Fällt der Test zwischen diesen zwei Zeilen, existiert ein gezähltes Signal, das keiner Gruppe gehört — für das kennt der Sweep keinen Griff, und `assertSignalsCount(0)` im `beforeEach` erledigt den Rest der Datei.
    - **Übeltäter 14 → 114 (mit Sweep) und 70 → 236 (ohne).** Der Sweep halbiert, er rettet nicht. **An der schlimmsten Stelle bewirkt er exakt nichts** — 78 rote Tests mit und ohne ihn. Der Satz »erstaunlich wirksam« oben ist entsprechend entschärft.
    - **Umzustellende Tests 123 → 129.** 136 Tests in vier Dateien, 135 erzeugen mindestens eine gezählte Ressource (Ausnahme: `src/SignalGroup.spec.ts:825`), 6 tragen schon ein `try`/`finally` (`SignalGroup.spec.ts:1226`, `teardown.spec.ts:487, 608, 750`, `gc.spec.ts:160, 281`) — bleiben 129. Die Zahl 3 für `gc.spec.ts` in der Tabelle oben war schlicht falsch: es sind 8.
    - **Vorsicht bei den sechs vorhandenen `finally`-Blöcken.** Keiner davon ist ein fertiges Muster, alle sechs sind der 7b-Q4-Fall: sie schützen ein Detail und lassen den Rest ungedeckt. `SignalGroup.spec.ts:1226` stellt im `finally` nur den Parent-Zeiger zurück und ruft `b.clear(); z.clear();` **dahinter**, ungeschützt; die zwei in `gc.spec.ts` tragen nur `errorSpy.mockRestore()`. Sie werden nicht »übernommen«, sie werden vervollständigt.
    - **Zeilenzahl 3 344 → 3 340** (`wc -l`: 1517 + 634 + 823 + 366). Dieselbe Abweichung wie in 7b — die alte Zahl zählte je Datei eine Endzeile mit.

  - **Die 60 Ausnahmen sind bestätigt, nicht korrigiert.** `python3 $S/rulec2.py` über die vier Dateien am 2026-08-09: **43** ohne nachlaufenden Teardown (reine Regel (c)) plus **17** mit einem Abbau mitten im Rumpf *und* einem nachlaufenden Teardown, dazu 67 reine Verschiebefälle und 9 ohne jeden Teardown. 43 + 17 + 67 + 9 = 136, die Rechnung geht auf. Die Verteilung der 60 über die Dateien: `SignalGroup.spec.ts` 22 + 10, `off.spec.ts` 6 + 2, `teardown.spec.ts` 13 + 4, `gc.spec.ts` 2 + 1. Der Implementierer zieht die Listen selbst, weil die Zeilennummern mit jedem umgestellten Test wandern.

  - **Q5: nicht beheben, dokumentieren.** In `src/SignalGroup.gc.spec.ts` gibt es keinen Gegenstand — die zehn `async`-Tests sind nur deshalb `async`, weil sie `await forceGc()` rufen, einen lokalen Helfer über `setImmediate`, der immer erfüllt und nie ablehnt; kein `nextValue()`, kein `asyncValues()`, kein `for await`. Vier Saatpunkte quer durch die Datei gefahren: `1 failed | 9 passed (10)`, **keine `Errors`-Zeile**. Der Gegenstand liegt ausschließlich in den drei Link-Dateien aus 7a und dort weiterhin: eine Saat in `src/link.nextValue.spec.ts:65` liefert `Tests 1 failed | 1 passed (2)` **plus** `Errors 1 error` — `Error: SignalLink destroyed before the next value arrived` (`src/SignalLink.ts:231`), ausgelöst vom `con.destroy()` im `finally`, während der Fehlschlag den `await` schon weggerissen hat. Vitest nennt es »Unhandled Rejection« und warnt, es könne falsch-positive Tests erzeugen.
    **Entscheidung: als bekannte Eigenschaft dokumentieren.** Beheben hieße, ein abgenommenes Teilpaket wieder aufzumachen und in 7a-Dateien `.catch(() => {})`-Gerüste um Promises zu legen, die der Test gar nicht mehr braucht — das ändert, was die Tests tun, nicht wie sie aufräumen, und ist damit eine andere Arbeit als TEST-017. Der halbe Satz kommt in den neuen `AGENTS.md`-Punkt (Schritt 6): *fällt ein Test, während ein `nextValue()`- oder Iterator-Promise noch offen ist, verwirft der Teardown im `finally` es und Vitest meldet zusätzlich eine unbehandelte Ablehnung — das ist Folge des Musters, kein zweiter Fehler.* Wer es doch angehen will, hat damit die Fundstelle.

  - **Schnitt: 7c wird geteilt.** Es geht nicht um Volumen — mit 129 Tests ist 7c genauso groß wie 7b (128), und 7b lief ungeteilt in einer Runde durch. Es geht um zwei Dinge, die 7b nicht hatte.
    *Erstens die Konzentration.* 7b waren zwanzig kleine, voneinander unabhängige Dateien; ein Reviewer nahm sie eine nach der anderen. 7c hat 82 seiner 129 Tests in **einer** Datei von 1517 Zeilen. Zum Vergleich: 7bs größte Einzeldatei war `EffectImpl.destroy.spec.ts` mit 408 geänderten Zeilen — dort saßen drei der vier Review-Befunde. `SignalGroup.spec.ts` wird gut das Dreifache. Ein Diff dieser Größe wird überflogen, und Überfliegen ist genau das, woran Q1, Q2 und Q4 vorbeigekommen wären.
    *Zweitens die zwei ungleichen Risikoprofile.* Die eine Hälfte ist Fleißarbeit mit hohem Radius, die andere ist die Regel-(d)-Hälfte: 14 absichtlich werfende Teardowns und eine `async`-GC-Suite, also genau der Boden, auf dem das Meldungs-Tor entscheidet und nicht das Radius-Tor. Diese beiden Sorten Aufmerksamkeit gehören nicht in denselben Zug.
    Dazu kommt, was der Lauf bisher gezeigt hat: 7a brauchte zwei Runden, 7b eine, weil die Lehren jeweils mitwanderten. Ein Zwischenhalt nach der Massendatei lässt dieselbe Mechanik ein drittes Mal wirken.

    | | Dateien | Tests | umzustellen | Ausnahmen | Saatpunkte | Extras |
    | --- | --- | ---: | ---: | ---: | ---: | --- |
    | **[x] 7c1** | `src/SignalGroup.spec.ts` | 84 | 82 | 32 | 278 | — |
    | **[x] 7c2** | `off` · `teardown` · `gc` | 52 | 47 | 28 | 175 | `AGENTS.md`, `CHANGELOG.md` |

    - **7c1** hängt ab von Paket 7a (Muster) und 7b (Lehren). Commit: `test: tear down SignalGroup resources in a finally, not after the assertions (TEST-017, part 3a of 3)`. Verify: `pnpm world`, dann beide Tore über die eine Datei, mit und ohne Sweep — vier Zahlen: mit Sweep vorher 278 / 78 / 95 / 0 maskiert, ohne Sweep vorher 278 / 78 / 130 / 0 maskiert. Kein `AGENTS.md`, kein `CHANGELOG`.
    - **7c2** hängt ab von 7c1 (dessen Review-Befunde sind die Vorlage). Commit: `test: tear down SignalGroup teardown and gc resources in a finally (TEST-017, part 3b of 3)`. Verify wie 7c1 über die drei Dateien: mit Sweep vorher 175 Saatpunkte / Radius 17 / 19 Übeltäter / 0 maskiert, ohne Sweep 175 / 22 / 106 / 0 maskiert. **Hier kommen `AGENTS.md` (Schritt 6) und der CHANGELOG-Eintrag (Schritt 7) dazu** — erst mit der letzten der 32 Dateien ist die Zeile wahr. Modell: stärkste Stufe, unverändert; für 7c1 ebenfalls, wegen der 32 Regel-(c)-Entscheidungen in einer Datei.

    Reihenfolge und Nummern sonst unverändert; die Pakete 8, 9 und 10 hängen weiter an »Paket 7a bis 7c«, was jetzt 7a, 7b, 7c1, 7c2 heißt.

    **Ergebnis 7c2 (2026-08-09)** — Hash `7b1949e`. Damit ist der TEST-017-Sweep abgeschlossen. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün (44 Dateien / 478 Tests in `test` und `test:gc`, Coverage 98,83 / 93,65 / 99,51 / 99,34), kein `SEEDED` und kein `SWEEP OFF` im Baum. **52 `finally`-Blöcke**, davon 47 neu und 5 vorhandene vervollständigt — alle fünf waren der 7b-Q4-Fall (geschützt war nur ein `mockRestore()` oder ein `unsubscribe()`, Assertions und `clear()` standen ungedeckt dahinter).

    Tore, je Saatpunkte / größter Radius / Übeltäter / maskiert — vom Reviewer unabhängig reproduziert, Vorher-Werte eingeschlossen:

    | Lauf | vorher | nachher |
    | --- | --- | --- |
    | mit Sweep | 175 / 17 / 19 / 0 | **82 / 1 / 0 / 0** |
    | ohne Sweep | 175 / 22 / 106 / 0 | **82 / 1 / 0 / 0** |
    | erschöpfend (`blast4`), ohne Sweep | — | **333 / 1 / 0 / 0** |

    **Das Meldungs-Tor hat hier seine Berechtigung bewiesen.** Von den 15 werfenden Teardowns (14 geplant plus einer, den der Implementierer selbst fand: `a throwing teardown in an FR-collected group is reported, not thrown`) brauchen **elf** ein `try { … } catch {}` innerhalb des `finally`; ohne es liefert die Saat `Error: cleanup boom` statt der Assertion, bei unverändertem Radius 1. Der Reviewer hat die Probe in beide Richtungen gefahren: Guard aus `teardown.spec.ts:86` entfernt → sofort `Maskiert 1`.

    **Vier brauchen keinen — und das ist der interessanteste Befund des Teilpakets.** `SignalGroup#clear()` emittiert `DESTROY` (`src/SignalGroup.ts:994`) und **nirgends** `OFF`; das `off(this)` bei `:998` ist eventize' Abmeldefunktion, kein Emit. `OFF` fällt ausschließlich in `SignalGroup#off()` (`:963`), der `{detach: true}`-Emit auf die Destroy-Queue ebenfalls nur dort (`:952`). Die Werfer dieser vier hängen an `OFF` beziehungsweise am `detach`-Flag und können auf dem `clear()`-Pfad nicht feuern. Der Implementierer hatte an zweien vorsorglich einen Guard gesetzt und ihn nach der eigenen Falsifikation zurückgebaut; der Reviewer hat die Kette am Produktionscode nachgeprüft und zusätzlich gemessen (ein `off()` vor das `clear()` gesetzt → sofort `Maskiert 2`). Bei einem fünften ist der Werfer durch ein vorangestelltes `unsubscribeBoom()` entwaffnet statt gekapselt.

    **Mutationsprobe, Auflage aus dem 7c1-Review** (Effect-Schleife aus `SignalGroup#clear()` entfernt): 30 Tests rot, davon **zwei aus inhaltlichem Grund** — genau die beiden vom Plan benannten, `sibling cleanup must still run` und `after FR cleanup`. Die übrigen 28 sind Wächter, und hier zu Recht: die Effects lecken tatsächlich, kein `finally` kann ein kaputtes `clear()` reparieren. Die Auflage ist damit erfüllt; die von 7c1 verlangte Zusage aus **V2** bleibt trotzdem für **Paket 9** stehen.

    **Q5 abgeschlossen: dokumentiert, nicht behoben.** `SignalGroup.gc.spec.ts` hat keinen Gegenstand — die zehn `async`-Tests warten nur auf `forceGc()` (`setImmediate`, lehnt nie ab), vier Saatpunkte liefern `1 failed | 9 passed` ohne `Errors`-Zeile. Der Gegenstand liegt allein in den drei Link-Dateien aus 7a. Ein halber Satz steht dazu jetzt in `AGENTS.md`.

    **Die CHANGELOG-Zahl, in Runde 1 korrigiert.** Die erste Fassung nannte 365 — eine Summe aus zwei Paket-Selbstauskünften, einem Bestandswert und einem Zuwachs, also drei Zählweisen in einer Zahl. Der Reviewer hat es bemerkt, der Implementierer hat nachgezählt (`countfin.py`: prüft je `it(`/`test(`, ob ein `} finally {` auf der Body-Einrückung des Tests steht, also test-eigen und nicht in einem Callback) und gegen den Stand vor dem Sweep (`ce25766`) gehalten: **heute 395 von 410 Tests mit `finally`, vorher 11, Zuwachs 384.** In der Zeile steht jetzt der Zuwachs — ein CHANGELOG beschreibt eine Änderung, keinen Bestand —, und das Wort dazu heißt »converted«. Nachprüfbar am Baum, nicht aus Berichten summiert. Genau der Punkt, den der Optimierungsteil des Audits macht.

    Ebenfalls in Runde 1: drei `finally`-Blöcke in `src/SignalGroup.off.spec.ts` (`:289`, `:351`, `:425`) sortierten Gruppe vor Signale, während drei baugleiche Geschwister es andersherum taten. Jetzt folgen alle 20 Blöcke der Datei derselben Ordnung — Effects, Signale, Gruppen, `clear()` zuletzt —, und im ganzen Teilpaket bleibt **genau eine** dokumentierte Umkehrung (`teardown.spec.ts:965`: die Gruppe muss zuerst, sonst reißt `destroySignal(external)` den werfenden Link außerhalb jedes Schutzes ab).

    Kleine Befunde, in den Plan statt in eine Runde: die Regel-(d)-Bilanz des Implementierers war falsch verbucht (zehn gekapselt plus die elfte im 15. Fall, vier ohne Kapsel — sachlich alles richtig, nur falsch gezählt). `src/SignalGroup.teardown.spec.ts:265` erzeugt `const sig = createSignal(i)` in einer Schleife im `try`, der Griff entsteht eine Zeile später; kein Saatpunkt erreicht Schleifenrümpfe, dieselbe Klasse wie der offengelassene Fall in `SignalGroup.spec.ts:1642`. Und die »widerlegte« Ausnahme `gc.spec.ts:113` ist nur halb widerlegt: die Einsortierung war richtig, falsch war der Grund, aus dem `rulec2.py` sie fand — widerlegt ist die Heuristik, nicht die Ausnahme.

    Drei neue `const group`-Bindungen in `gc.spec.ts` (`:62`, `:82`, `:199`) halten die Gruppe für die Testdauer stark. Weil `getSignalGroupsCount()` tote WeakRefs unterwegs wegwirft (`SignalGroup.ts:135-145`), konnte der Zähler vorher auch dadurch fallen, dass die Gruppe still mitgesammelt wurde; jetzt muss der FinalizationRegistry-Callback tatsächlich laufen. Eine Verschärfung, keine Schwächung — dreimal `test:gc` seriell war stabil.

    **Ergebnis 7c1 (2026-08-09)** — Hash `c04a915`. Verify vom Orchestrator selbst gefahren: `pnpm typecheck` 0 Fehler, `pnpm check` 85 Dateien sauber, `pnpm test` 44 / 478 grün, Coverage 98,83 / 93,65 / 99,51 / 99,34 ziffergleich, kein `SEEDED` und kein `SWEEP OFF` im Baum, der Sweep steht in beiden Hooks. **81 `finally`-Blöcke** statt der geplanten 82: drei Tests erzeugen nichts, und zwei der geplanten 82 waren Fehltreffer der `MAKES`-Regex, die `SignalGroup.get(` und `findOrCreate(` für Erzeuger hält — vom Reviewer am Code bestätigt (`findOrCreate(null)` wirft in `src/SignalGroup.ts:272` vor jeder Allokation, `get()` ist ein reiner WeakMap-Lookup). Alle 32 Ausnahmen bestätigt, keine widerlegt.

    Tore, je Saatpunkte / größter Radius / Übeltäter / maskiert — vom Reviewer unabhängig nachgefahren, alle vier Zahlen reproduziert:

    | Lauf | vorher | nachher |
    | --- | --- | --- |
    | mit Sweep | 278 / 78 / 95 / 0 | **141 / 1 / 0 / 0** |
    | ohne Sweep | 278 / 78 / 130 / 0 | **141 / 1 / 0 / 0** |
    | erschöpfend, ohne Sweep (Saat vor **jeder** Anweisung im `try`) | — | **376 / 1 / 0 / 0** |

    Vier Abweichungen, alle vom Reviewer bestätigt: zwei Tests ohne Gerüst (Regex-Fehltreffer, siehe oben); eine neue Bindung `const signal = createSignal(42, {attach: obj})`; `group.clear()` vor den Signal-Destroys in zwei — tatsächlich **drei** — `finally`-Blöcken gegen den Buchstaben von Regel (e), weil dort Effect und Link nur als Gruppenmitglieder existieren und die umgekehrte Ordnung den Link mitten im `finally` abrisse (die dritte Stelle, `:1811-1812`, hat der Reviewer nachgetragen); und zusätzlicher Abbau von Kindgruppen, wo ein Test bisher auf die Kaskade baute.

    **Regel-(d)-Kandidaten liegen nicht nur in `teardown.spec.ts`.** Zwei sitzen hier (`a throwing DESTROY listener registered before the attach cannot stop it`, `… below Priority.Max cannot swallow it either`). Ohne Schutzblock stirbt nicht nur die Meldung — der Reviewer hat zusätzlich **Radius 47 / 47 / 46** reproduziert, weil ein `SignalLink` nach einem abgebrochenen `destroy()` **gezählt weiterlebt**. Für 7c2 mit seinen 14 werfenden Teardowns ist das der Normalfall, nicht die Ausnahme: dort lohnt die Falsifikationsprobe pro Test, nicht nur das Tor.

    **W1, ein bezifferter Nebeneffekt von Regel (b) — und sein Rezept.** `attachEffect() returns the effect` hat einen Leckdetektor verloren: entfernt man die Effect-Schleife aus `SignalGroup#clear()`, fielen vorher 17 Tests, jetzt null. Von den 17 war genau **einer** ein echter Fund, die anderen 16 waren der Kollateralschaden, gegen den TEST-017 angetreten ist. Der Implementierer hat vier Varianten gemessen: das `effect.destroy()` wegzulassen holt den Detektor zurück (17 rot) und bringt den Radius genauso zurück (17) — kein Weg. Was beides hält, ist **V2**: `group.clear()` zurück ins `try`, dahinter ein `assertEffectsCount(0, …)`, `finally` unverändert → **1 failed, Radius 1, kein Kollateralschaden**. Das kostet genau eine neue Assertion, die 7c1 nicht schreiben darf und die wörtlich der Gegenstand von **Paket 9** ist. Der Detektor war nie eine Assertion, sondern ein ungeschützter Test plus ein `afterEach`-Zähler; das Paket ersetzt Zufall durch Zusage, es muss sie nur noch jemand aussprechen. **Auflage für Paket 9: V2 einsetzen.** Und **Auflage für 7c2**: vor der Abnahme dieselbe Mutation fahren und prüfen, dass mindestens ein Test aus inhaltlichem Grund rot bleibt — repo-weit erkennen sie heute nur noch zwei echte Rumpf-Assertions (`sibling cleanup must still run`, `after FR cleanup`), der Rest sind Wächter.

    Kleine Befunde, in Runde 1 behoben: der Kommentar bei `:1536` behauptete, ein Clear auf einer noch zyklischen Kette liefe im Kreis — falsch, `clear()` rekursiert über `#groups` und macht in die Elternkette genau einen Sprung; Begründung ersetzt, Reihenfolge bleibt. Und `detached.push(signal)` steht jetzt direkt hinter `createSignal(i)` statt hinter `detachSignal()`, damit der Griff ab der Erzeugung existiert.

    Nebenbefund, nicht geändert: `src/SignalGroup.spec.ts:1642` (`signal churn …`) erzeugt und zerstört 50 Signale in einer Schleife; bricht die Schleife selbst ab, hält kein Griff die schon erzeugten. Kein Saatpunkt erreicht das, ein Array nur dafür wäre Gerüst ohne Gegenstand.

  - **Die zwei Abnahmekriterien, zusammengefasst.** Beide je Datei, beide zweimal (mit und ohne Sweep), beide aus demselben Durchlauf:
    1. **Radius:** `groesster Radius 1, Uebeltaeter 0` — kein Saatpunkt reißt einen zweiten Test mit.
    2. **Meldung:** `Maskiert 0` — an jedem Saatpunkt steht `SEEDED` in der Vitest-Ausgabe, kein `finally` hat die Fehlermeldung ersetzt.

    `$S/p7c/gate7c.sh <datei>` liefert beide plus eine getrennte Zählung der Radius-0-Fälle (heute 0; ein Saatpunkt, an dem *gar nichts* rot wird, hieße, die gesäte Assertion läuft überhaupt nicht — bisher nie vorgekommen, gehört trotzdem gezählt). Steuerung über `R=<repo-kopie>`, Laufzeit rund 0,9 s pro Saatpunkt, also etwa acht Minuten für alle 453. **Gemessen wird auf einer Kopie im Scratchpad, nie im Arbeitsbaum** — beide Kopien liegen fertig unter `$S/p7c/repo` und `$S/p7c/nosweep`, mit `node_modules` als Symlink auf das Projekt.

    Falls ein einzelner Saatpunkt ohne Sweep nachweislich nicht auf Radius 1 zu bringen ist, weil kein test-lokaler `finally`-Block einen Griff auf die Ressource bekommen kann: als Ausnahme mit Messung dokumentieren, so wie 7b es mit `createSignal.destroySignal.spec.ts:94` (P2) und `decorators.signal.spec.ts:195` gehalten hat. Nicht stillschweigend durchwinken, und nicht das Kriterium aufweichen.

  - **Baum nach allen Messungen sauber:** `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/ AGENTS.md CHANGELOG.md` ist leer. Alle 906 Saatläufe liefen auf zwei Kopien im Scratchpad, kein `git`-Schreibbefehl war beteiligt.

<details>
<summary>TEST-017 im Volltext (aus <code>audit.html</code>) — gilt für 7a, 7b und 7c</summary>

**TEST-017 — Das Aufräumen pro Test in ein finally ziehen — ein Fehlschlag färbt heute ganze Dateien rot**
Severity: high · Kategorie: Testabdeckung & Teststrategie · Effort: L
Location: `src/SignalAutoMap.spec.ts:29-35` · `src/link.spec.ts:254-267` · `src/SignalGroup.off.spec.ts`

> 35 Spec-Dateien prüfen in `beforeEach`/`afterEach`, dass die globalen Zähler auf 0 stehen, räumen aber im Testrumpf *hinter* den Assertions auf. Eine echte Regression lässt den Aufräumcode aus, verschmutzt den globalen Zustand und reißt über die Wächter jeden folgenden Test derselben Datei mit. Der Befund geht dann in 25 bis 38 roten Tests unter, von denen 24 bis 37 Kollateralschaden sind. Der letzte Lauf hat genau zwei Tests umgestellt; der Rest steht noch.

> Empfehlung: Ressourcen pro Test in `afterEach` aus einer Registry abräumen, oder das Aufräumen konsequent in `finally` ziehen; die vorhandene Begründung in `link.spec.ts` ist die Vorlage.

> Evidence: Eine einzige gesäte Assertion in `SignalAutoMap.spec.ts:32` ergibt **38 failed von 38**. Dieselbe Übung in `link.spec.ts:245`: 25 von 38. Zum Vergleich `SignalGroup.spec.ts:53`: 1 von 84.

</details>

- Planänderung (2026-08-09): Paket 7 wird zu **7a, 7b, 7c** geteilt, Begründung und Schnitt oben. **Zweite Planänderung am selben Tag: 7c wird noch einmal zu 7c1 und 7c2 geteilt** — Begründung im Nachtrag nach 7b. Reihenfolge und Nummern aller anderen Pakete bleiben unverändert; die Pakete 8, 9 und 10 hängen jetzt an »Paket 7a bis 7c« statt an »Paket 7« und tragen je eine Notiz, dass ihre neuen Tests dem Muster aus 7a folgen. Von der Audit-Empfehlung wird bewusst nur eine Hälfte genommen: **`finally`, keine Registry** — die Gründe (1 171 Anmeldestellen gegen 356 `finally`-Blöcke, keine aufzählbare Ressourcenmenge in `src/`, `onTestFinished()` läuft gemessen nach den `afterEach`-Hooks) stehen in 7a, Schritt 1. Vier Nebenbefunde, keiner davon ein Finding des Audits:
  - **Die Zählerwächter sind über die 35 Dateien hinweg nicht einheitlich:** zwölf prüfen nur `assertEffectsCount`, elf `Effects`+`Signals`, elf alle drei, `src/link.gc.spec.ts` nur `assertLinksCount`. Ein schmaler Wächter meldet weniger Kollateralschaden, weil er weniger sieht — `src/effects.cleanup.spec.ts` bemerkt ein geleaktes Signal gar nicht. Das ist eine Lücke in der Leckerkennung, nicht in der Kollateralschadensbegrenzung, und gehört deshalb **nicht** in Paket 7. Kandidat für Paket 10, das ohnehin die ungetestete Hälfte der Kernlogik abdeckt.
  - **`SignalLink#destroy()` gibt seine `off(this)`-Zeile ohne Netz frei:** wird `src/SignalLink.ts:421` entfernt, fallen nur 2 von 28 Tests in `src/SignalLink.spec.ts` und keiner in `src/link.spec.ts`. Die Wächter zählen Signale, Effects und Links, nicht Abonnements auf dem Link-Objekt selbst — genau die Lücke, für die `CLAUDE.md` das `getSubscriptionCount`-Bilanzmuster beschreibt. Am 2026-08-09 gemessen. Kandidat für Paket 10.
  - **`src/globalEffectStack.spec.ts` ist für jedes automatische Radius-Werkzeug blind** — seine zwei Tests erzeugen keine gezählte Ressource vor der ersten Assertion. Kein Defekt, aber der Grund, warum das Tor in 7b eine Datei nicht abdecken kann.
  - **Der `SignalGroup.clear()`-Sweep in den Hooks der vier Gruppen-Specs ist die einzige heute wirksame Bremse im Repo** und senkt die Übeltäter dort ~~von 70 auf 14~~ **von 236 auf 114** (erweitertes Tor; an der schlimmsten Stelle bewirkt er nichts). Er maskiert dabei nichts (alle vier Dateien laufen ohne ihn grün, am 2026-08-09 erneut bestätigt: 84 / 20 / 22 / 10). Erwähnenswert, weil er beim Lesen wie ein Aufräum-Kandidat aussieht und keiner ist.

#### [x] 8. Die ungeschützten Save/Restore-Rahmen festnageln
- Findings: TEST-016 (high), TEST-021 (medium)
- Ziel: `beQuiet()`, `runWithinEffect()` und der Dedup-Wächter in `attachEffect()` haben je einen Test, der ihr Wegfallen rot färbt.
- Bereich: `src/bequiet.spec.ts`, `src/globalEffectStack`-Umfeld, `src/SignalGroup.*.spec.ts`
- Hängt ab von: Paket 7a bis 7c (alle drei Zieldateien liegen darin: `bequiet.spec.ts` und `globalEffectStack.spec.ts` in 7b, die `SignalGroup`-Specs in 7c)
- Anmerkung (2026-08-09, aus Paket 7a): **Jeder neue Test folgt dem Muster aus Paket 7a, Schritt 2** — Ressourcen im `finally` abbauen, nicht hinter den Assertions; ein `destroy()`, auf das noch eine Assertion folgt, bleibt im `try`. Nach dem Paket muss das Radius-Tor aus 7a Verify (2b) über die angefassten Dateien weiterhin `groesster Radius 1, Uebeltaeter 0` melden. Ein neuer Test, der das bricht, macht die Arbeit von 7b und 7c in genau dieser Datei wieder zunichte. Sonderfall `src/globalEffectStack.spec.ts`: das Tor findet dort keinen Saatpunkt, hier zählt die Sichtprüfung.
- Modell: mittlere Stufe
- Hash: `537dd6c`
- Dateien: 3 vorhandene Spec-Dateien, **keine neue Datei**, kein Produktionscode.

  | Datei | neue Tests | Ort |
  | --- | ---: | --- |
  | `src/bequiet.spec.ts` | 1 | ans Ende des `describe('beQuiet')`, hinter dem BUG-010-Test |
  | `src/globalEffectStack.spec.ts` | 2 | neues `describe('runWithinEffect()')`, hinter dem vorhandenen `describe('getCurrentEffect()')` |
  | `src/SignalGroup.spec.ts` | 1 | in `describe('effects')`, zwischen `attachEffect() adds an effect to the group` und `runEffects() runs all effects in the group` |

  Der Ort ist nicht Geschmack, er ist gemessen. Beide Rahmen sind Modulzustand: unter der Mutation vergiftet ein nicht geschlossener Rahmen jeden *folgenden* Test derselben Datei. Steht der neue Test vorn, meldet die Mutationsprobe 2 statt 1 (bequiet) beziehungsweise 3 statt 2 (globalEffectStack) rote Tests, und der Zusatz ist Kollateralschaden. Am Ende platziert bleibt die Signatur der Probe exakt auf den neuen Tests. Beides am 2026-08-10 in beiden Anordnungen gefahren.
- Abgleich (2026-08-10): beide Findings unverändert gültig, die Fundstellen haben sich nur verschoben. Alle Zahlen unten auf einer HEAD-Kopie (`7b1949e`) im Scratchpad gemessen, nie im Arbeitsbaum.
  - **TEST-016 unverändert.** Die Zeilennummern des Audits stimmen noch: `src/bequiet.ts:31-37` ist der `try`/`finally` um `action()`, `src/globalEffectStack.ts:13-19` der um `callback()`. Der Sweep hat beide Spec-Dateien angefasst (7b), aber keinen Produktionscode.
  - **Die Prämisse des Findings hält.** »Die von `batch()`, `hibernate()` und `collect-errors.ts` sind alle abgedeckt« ist keine Behauptung geblieben: das `finally` aus `hibernate()` (`src/hibernate.ts:37-43`) sequenziell aufgelöst → **3 rote Tests**, alle drei aus inhaltlichem Grund (`restores context even when callback throws`, `restores batch context …`, `restores effect stack …`, `src/hibernate.spec.ts:322 ff.`). Genau dieser Testtyp fehlt für die beiden Rahmen dieses Pakets — und die drei liefern zugleich das Namensvokabular des Hauses (»restores … when callback throws«), dem die neuen Tests folgen.
  - **TEST-021 unverändert, Fundstelle jetzt `src/SignalGroup.ts:746-757`** (`attachEffect()`, der Wächter `if (!this.#effects.has(effect))` bei `:756`). Der Zwilling steht bei `:800` (`if (!this.#linksWithDestroyHook.has(link))`).
  - **Eine Korrektur an der Begründung des Findings, ohne Folgen für den Test.** »Über `createEffect({attach})` in einer Schleife trivial erreichbar« stimmt so nicht: `attachEffect()` wird aus dem `EffectImpl`-Konstruktor gerufen (`src/EffectImpl.ts:332`), also genau einmal je Effect — eine Schleife über `createEffect({attach})` erzeugt jedes Mal einen *neuen* Effect und trifft den Wächter nie. Der wiederholte Anhang desselben Effects führt allein über den direkten, öffentlichen Aufruf `group.attachEffect(effectImpl)`. Der Wächter bleibt trotzdem nötig, und der Test prüft genau diese Route.
  - **Der Zwilling ist gedeckt, aber schmaler als das Audit dachte.** `if (!this.#linksWithDestroyHook.has(link))` → `if (true)` färbt heute **2 Tests** rot, nicht 6: `src/link.spec.ts:620` `re-attaching the same group on repeated cache hits does not grow the link subscription count` und `:655` `no combination of the two attach routes grows the link's DESTROY listener list (MEM-002)`. Beide sind echte Rumpf-Assertions über `getSubscriptionCount(con)`; die vier fehlenden waren Wächter-Kollateralschaden, den der Sweep abgeräumt hat. Diese zwei sind die Vorlage für den neuen `attachEffect()`-Test.
  - **Mutationsprobe vorab, drei Mutationen, Ausgangslage.** Auf der HEAD-Kopie ohne neue Tests (44 Dateien / 478 Tests grün):

    | Mutation | Eingriff | heute |
    | --- | --- | --- |
    | **A** (M95) | `beQuiet()`: `try`/`finally` → `const result = action(); g_numberOfBeQuietRequests--; return result;` | **478 passed, kein Test rot** |
    | **B** (M97) | `runWithinEffect()`: dasselbe mit `globalEffectStack.pop()` | **478 passed, kein Test rot** |
    | **C** (M22) | `attachEffect()`: `if (!this.#effects.has(effect))` → `if (true)` | **478 passed, kein Test rot** |

    Alle drei überleben, wie das Audit sagt. Das Messwerkzeug nickt dabei nicht bloß: eine Kontrollmutation in derselben Datei (`g_numberOfBeQuietRequests++` ersatzlos gestrichen) liefert sofort `5 failed | 473 passed` — die Kopie sieht Quelländerungen.
  - **Coverage sieht nichts davon.** `src/bequiet.ts` und `src/globalEffectStack.ts` stehen vor *und* nach diesem Paket bei 100/100/100/100. Ein fehlendes `finally` ist keine ungedeckte Zeile, sondern eine ungeprüfte Zusage; darum braucht dieses Paket die Mutationsprobe als Abnahmekriterium und nicht die Deckungszahl. Nebenbefund für Paket 10: `bequiet` steht in beiden Ausnahmelisten von `vitest.config.ts` (Tier-2-Negation und Tier-3-Gruppe mit `branches: 95`) und misst dort 100 — Kandidat zum Streichen, entschieden wird das in Paket 10.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/` ist leer. Jede Mutation lief auf `$S/p8/repo` (`git archive HEAD`, `node_modules` als Symlink), kein `git`-Schreibbefehl war beteiligt.
- Vorgehen: vier Tests, drei Dateien, kein neuer Export, kein neuer Import. Der Wortlaut unten ist der gemessene — er compiliert (`tsc --noEmit -p tsconfig.json`, 0 Fehler), formatiert unverändert durch (`biome check`, keine Korrektur) und läuft grün.
  1. **Zugang klären, bevor irgendwas geschrieben wird — beides ist schon da.**
     - `getCurrentEffect` und `runWithinEffect` sind reguläre Exporte von `src/globalEffectStack.ts`; `src/globalEffectStack.spec.ts:3` importiert beide bereits direkt (`from './globalEffectStack.js'`). Das Modul hängt an keinem Entry Point (`src/index.ts` führt es nicht, `src/decorators.ts` auch nicht), also ist `stripInternal` aus Paket 5 hier gegenstandslos: gestrippt wird nur, was ausgeliefert wird. **Es wird kein Symbol neu exportiert** — die Halte-Bedingung des Pakets (»ein neuer Export nur, damit ein Test etwas erreicht«) tritt nicht ein.
     - `getSubscriptionCount` kommt direkt aus `@spearwolf/eventize`, nicht aus `src/__testing__/assert-helpers.ts` (das benutzt es selbst, re-exportiert es aber nicht). Referenz ist `src/unsubscribeEffect.spec.ts:1`; der exakte Importpfad ist `import {getSubscriptionCount} from '@spearwolf/eventize';`. **In `src/SignalGroup.spec.ts` steht er bereits in Zeile 1** — zusammen mit `once`, `on` und `Priority`.
     - Folge: keine der drei Dateien bekommt eine neue Importzeile. `beQuiet`, `isQuiet`, `createSignal`, `createEffect`, `destroySignal` sind in `bequiet.spec.ts` importiert, `EffectImpl` und `NOOP` in `globalEffectStack.spec.ts`, `$effect`, `getGroupMemberCounts`, `SignalGroup`, `createSignal`, `createEffect` in `SignalGroup.spec.ts`. Nachgeprüft durch `pnpm check` (Biome meldet ungenutzte Importe) und `tsc`.
  2. **Keine neue Datei.** Beide bestehenden Specs passen thematisch: `bequiet.spec.ts` prüft heute den Rückgabewert und die Nicht-Verfolgung, `globalEffectStack.spec.ts` genau die Stack-Invariante. Eine eigene Datei wäre auch harmlos — `vitest.config.ts` nimmt `src/**/*.spec.ts` über `coverageExclude` aus der Dateimenge heraus, gegen die der Threshold-Glob-Check aus Paket 3 matcht, eine neue Spec verschiebt dort also nichts —, sie hätte aber keinen Gegenstand. Die Entscheidung fällt inhaltlich, nicht aus Furcht vor dem Tor.
  3. **`src/bequiet.spec.ts`** — ans Ende des `describe('beQuiet')`, hinter dem BUG-010-Test. Wortlaut:

     ```ts
       it('closes the quiet frame when the action throws, so the next write is loud again (TEST-016)', () => {
         // The counter behind `beQuiet()` is module state, so a frame that is
         // not closed on the way out is not a local mistake: every later write
         // in the process stays muted and every effect stays deaf. Drop the
         // `finally` in `src/bequiet.ts` and this test is the only one that
         // notices.
         const {get: a, set: setA} = createSignal(0);

         let runs = 0;

         const effect = createEffect(() => {
           a();
           runs++;
         });

         try {
           expect(() =>
             beQuiet(() => {
               throw new Error('boom');
             }),
           ).toThrow('boom');

           expect(isQuiet(), 'the quiet frame closed on the way out').toBe(false);

           runs = 0;
           setA(1);

           expect(runs, 'the effect still hears a write after the throw').toBe(1);
         } finally {
           effect.destroy();
           destroySignal(a);
         }
       });
     ```

     Zwei unabhängige Reds unter Mutation A: der Zähler steht (`isQuiet()` bleibt `true`) *und* der stumme Write erreicht den Effect nicht (`runs` bleibt 0). Die Arrange-Phase steht vor dem `try` (Regel (1) aus dem 7b-Nachtrag), beide Griffe — `effect` und `a` — kommen im `finally` vor, und der Abbau ist idempotent (Regel (b)).
  4. **`src/globalEffectStack.spec.ts`** — neues `describe('runWithinEffect()')` hinter dem vorhandenen `describe('getCurrentEffect()')`, innerhalb des äußeren `describe('globalEffectStack')`. Wortlaut:

     ```ts
       describe('runWithinEffect()', () => {
         it('pops the effect when the callback throws (TEST-016)', () => {
           // The stack is module state. An effect left on it after a throwing
           // callback is picked up by the next top-level signal read, which then
           // subscribes a corpse. Drop the `finally` in
           // `src/globalEffectStack.ts` and this test is one of the two that
           // notice.
           const effect = new EffectImpl(NOOP);

           try {
             expect(() =>
               runWithinEffect(effect, () => {
                 throw new Error('boom');
               }),
             ).toThrow('boom');

             expect(
               getCurrentEffect(),
               'the throwing effect left the stack on the way out',
             ).toBeUndefined();
           } finally {
             effect.destroy();
           }
         });

         it('restores the enclosing effect when a nested callback throws (TEST-016)', () => {
           // Not the same claim as above: this one pins the *restore*, not the
           // empty stack. A nested effect that throws must hand the frame back
           // to its parent, which is what nested effects rely on.
           const outer = new EffectImpl(NOOP);
           const inner = new EffectImpl(NOOP);

           try {
             runWithinEffect(outer, () => {
               expect(() =>
                 runWithinEffect(inner, () => {
                   throw new Error('boom');
                 }),
               ).toThrow('boom');

               expect(
                 getCurrentEffect(),
                 'the enclosing effect is current again',
               ).toBe(outer);
             });

             expect(getCurrentEffect()).toBeUndefined();
           } finally {
             inner.destroy();
             outer.destroy();
           }
         });
       });
     ```

     Der zweite Test ist keine Verdopplung des ersten: `pop()` auf einem leeren Rahmen und `pop()` in einen äußeren Rahmen hinein sind zwei Zusagen, und nur die zweite ist die, auf der verschachtelte Effects stehen. Beide fallen unter Mutation B. Warum hier keine Verhaltensassertion über eine »abonnierte Leiche« steht: `runWithinEffect()` sammelt nur Abhängigkeiten ein, die Subscription entsteht erst am Ende von `EffectImpl#run()` — eine Assertion über `runs` wäre an dieser Stelle grün, egal wie der Rahmen aussieht, und damit ein Detektor, der nichts detektiert. Genau der Fehler, an dem in 7c1 einer gestorben ist.
  5. **`src/SignalGroup.spec.ts`** — in `describe('effects')`, direkt vor `runEffects() runs all effects in the group`. Wortlaut:

     ```ts
         it('attachEffect() called repeatedly adds no second DESTROY listener (TEST-021)', () => {
           // The counterpart to the two `attachLink()` tests in `link.spec.ts`
           // (`re-attaching the same group on repeated cache hits …`, `no
           // combination of the two attach routes …`): eventize dedupes only
           // object and named-method listeners, so the plain function passed to
           // `once(effect, DESTROY, …)` is registered again on every call. The
           // guard in `attachEffect()` is the only thing keeping a repeated
           // attach of the same effect from growing that list without bound.
           const group = SignalGroup.findOrCreate({});
           const signal = createSignal(0);

           const effect = createEffect(() => {
             signal.get();
           });
           const effectImpl = effect[$effect];

           try {
             const subscriptionsBefore = getSubscriptionCount(effectImpl);

             group.attachEffect(effectImpl);
             group.attachEffect(effectImpl);
             group.attachEffect(effectImpl);

             expect(
               getSubscriptionCount(effectImpl) - subscriptionsBefore,
               'exactly one DESTROY listener for three attaches',
             ).toBe(1);

             expect(getGroupMemberCounts(group).effects).toBe(1);
           } finally {
             effect.destroy();
             signal.destroy();
             group.clear();
           }
         });
     ```

     Gemessene Zahlen dahinter: `subscriptionsBefore` ist 1 (der Effect trägt schon eine eigene Subscription), nach drei Anhängen sind es intakt 2, unter Mutation C **4** — die Differenz ist 3 statt 1. Die zweite Assertion hält fest, dass der Wächter nur den Hook dedupliziert und nicht die Mitgliedschaft verliert. Reihenfolge im `finally` nach Regel (e): Effect, Signal, Gruppe — dieselbe wie in den Nachbartests der Datei.
  6. **Kein `pnpm fix` nötig, aber `pnpm check` gehört gefahren.** Biome hat den Wortlaut oben unverändert durchgelassen; wer ihn umformuliert, formatiert nach.
  7. **CHANGELOG:** eine Zeile unter `### Tests` in `## Unreleased`, im Ton der TEST-017-Zeile daneben — etwa: `The two save/restore frames without a test — `beQuiet()` and `runWithinEffect()` — and the `attachEffect()` dedup guard are now pinned: removing the `finally` or the guard fails a test instead of passing silently (TEST-016, TEST-021)`. Keine Doku-Synchronisation: die öffentliche API ändert sich nicht, `AGENTS.md` bleibt unangetastet.
- Verify: zwei Teile. Der erste zeigt, dass nichts kaputt ist; der zweite ist der eigentliche Beweis. Alle Erwartungswerte am 2026-08-10 auf einer HEAD-Kopie mit genau diesen vier Tests gemessen.
  1. `pnpm world`. Erwartet: neun Schritte grün, **44 Dateien / 482 Tests** in `test` und `test:gc` (478 + 4), Coverage **98,83 / 93,86 / 99,51 / 99,34**. Nur die Branch-Zahl bewegt sich, von 93,65 auf 93,86 — sie kommt aus `SignalGroup.ts` (86,15 → 86,92); `bequiet.ts` und `globalEffectStack.ts` stehen vorher wie nachher auf 100/100/100/100. Bewegt sich eine der anderen drei Zahlen, ist etwas anderes passiert als dieses Paket.
  2. **Die drei Mutationsproben.** Jede einzeln, auf einer Kopie, nicht im Arbeitsbaum. Die Erwartung ist nicht »ein Test wird rot«, sondern »**genau diese** Tests werden rot«:

     | Mutation | Eingriff | ohne die neuen Tests | mit ihnen |
     | --- | --- | ---: | --- |
     | **A** | `src/bequiet.ts`: `try { return action(); } finally { g_numberOfBeQuietRequests--; }` → `const result = action(); g_numberOfBeQuietRequests--; return result;` | 478 passed, 0 rot | **1 failed \| 481 passed** — `closes the quiet frame when the action throws …` |
     | **B** | `src/globalEffectStack.ts`: dasselbe mit `globalEffectStack.pop()` | 478 passed, 0 rot | **2 failed \| 480 passed** — `pops the effect when the callback throws`, `restores the enclosing effect when a nested callback throws` |
     | **C** | `src/SignalGroup.ts:756`: `if (!this.#effects.has(effect))` → `if (true)` | 478 passed, 0 rot | **1 failed \| 481 passed** — `attachEffect() called repeatedly adds no second DESTROY listener` |

     Kein einziger Kollateralschaden in allen drei Proben — die roten Tests sind ausschließlich die neuen, und sie fallen an ihrer inhaltlichen Assertion, nicht an einem `afterEach`-Wächter. Wer eine andere Zahl misst, hat entweder den Test verschoben (siehe »Dateien«) oder ihn entkernt. Nach jeder Probe: Rückbau aus der Sicherung, `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/` ist leer.
  3. **Das Tor über die vier neuen Tests** — Radius und Meldung, wie in 7c: an jeder Anweisung innerhalb des `try` eine fehlschlagende `expect(1, 'SEEDED').toBe(2)` säen, Datei laufen lassen, rote Tests zählen und prüfen, dass `SEEDED` in der Ausgabe steht (Vitest schreibt die Meldung nach **stderr**, nicht nach stdout — wer nur stdout greift, misst `Maskiert` überall). Gemessen, je Saatpunkte / größter Radius / Übeltäter / maskiert / Radius 0:

     | Test | Ergebnis |
     | --- | --- |
     | `bequiet.spec.ts` · `closes the quiet frame …` | **5 / 1 / 0 / 0 / 0** |
     | `globalEffectStack.spec.ts` · `pops the effect …` | **2 / 1 / 0 / 0 / 0** |
     | `globalEffectStack.spec.ts` · `restores the enclosing effect …` | **2 / 1 / 0 / 0 / 0** |
     | `SignalGroup.spec.ts` · `attachEffect() called repeatedly …` | **6 / 1 / 0 / 0 / 0** |

     Der `SignalGroup`-Test zusätzlich mit ausgehängtem Sweep (beide `SignalGroup.clear()`-Zeilen in den Hooks auskommentiert): ebenfalls **6 / 1 / 0 / 0 / 0**, Datei grün. Damit ist die Anmerkung aus Paket 7a erfüllt, und zwar messend statt sichtprüfend — auch für `src/globalEffectStack.spec.ts`, wo das grobe Tor aus 7a keinen Saatpunkt fand.
- Commit: `test: pin the two unguarded save/restore frames and the attachEffect dedup guard (TEST-016, TEST-021)`

<details>
<summary>TEST-016 und TEST-021 im Volltext (aus <code>audit.html</code>)</summary>

**TEST-016 — Die zwei Kontext-Rahmen testen, die einen werfenden Callback überleben müssen**
Severity: high · Kategorie: Testabdeckung & Teststrategie · Domain: harness · Effort: S
Location: `src/bequiet.ts:31-37` · `src/globalEffectStack.ts:13-19`

> `beQuiet()` und `runWithinEffect()` sind die einzigen beiden Save/Restore-Rahmen der Bibliothek, deren `finally` kein Test schützt — die von `batch()`, `hibernate()` und `collect-errors.ts` sind alle abgedeckt. Fällt das `finally` in `beQuiet()` weg, bleibt der globale Quiet-Zähler nach einer werfenden Action für immer stehen: jeder weitere Signal-Write ist stumm, jeder Effect taub, prozessweit. Bei `runWithinEffect()` bleibt der geworfene Effect auf dem globalen Stack liegen, und jeder spätere Top-Level-Read abonniert eine Leiche.

> Empfehlung: Je einen Test: `beQuiet(() => {throw})` fangen, danach prüfen, dass ein Effect auf einen Write noch reagiert; und nach einem werfenden Effect-Callback `getCurrentEffect()` auf `undefined` prüfen.

> Evidence: Mutant M95 (`try/finally` → sequenziell in `beQuiet`) und M97 (dasselbe in `runWithinEffect`): beide SURVIVED bei 478 passed.

**TEST-021 — Den attachEffect()-Dedup-Wächter testen — sein Zwilling in attachLink() ist gedeckt**
Severity: medium · Kategorie: Testabdeckung & Teststrategie · Domain: harness · Effort: S
Location: `src/SignalGroup.ts:752-757`

> `attachEffect()` und `attachLink()` tragen denselben Kommentar und dieselbe Wache gegen eventizes fehlende Dedup für Funktions-Listener. Die in `attachLink()` ist getestet, die in `attachEffect()` nicht. Ohne sie hängt jeder wiederholte `attachEffect(sameEffect)` einen weiteren DESTROY-Listener an — unbegrenzt, und über `createEffect({attach})` in einer Schleife trivial erreichbar.

> Empfehlung: Denselben Effect dreimal anhängen und `getSubscriptionCount(effectImpl)` gegen den Wert vor den Anhängen prüfen.

> Evidence: M22 (`if (!this.#effects.has(effect))` → `if (true)`): SURVIVED. M23, die identische Mutation in `attachLink()`: KILLED mit 6 Fehlschlägen.

</details>

- Planänderung (2026-08-10): keine. Schnitt, Reihenfolge und Abhängigkeiten bleiben; das Paket bleibt eines und behält seine Nummer. **Die Auflage aus dem 7c1-Review (»V2 einsetzen«) bleibt unberührt bei Paket 9** — sie betrifft `attachEffect() returns the effect` (`src/SignalGroup.spec.ts:1393 ff.`), einen anderen Test in derselben `describe`-Gruppe; der neue Test hier räumt seinen Effect selbst im `finally` ab und ersetzt keinen Leckdetektor. Modellstufe bleibt die mittlere: die vier Tests stehen oben im Wortlaut, jede Erwartungszahl ist gemessen, und der Rest ist Nachfahren. Nebenbefunde: die Begründungszeile von TEST-021 (`createEffect({attach})` in einer Schleife) ist am Code widerlegt — siehe Abgleich, ohne Folgen für Test oder Fix; und `bequiet` steht als Ausnahme in zwei Threshold-Listen, obwohl die Datei 100 % misst — Kandidat für Paket 10.

- **Ergebnis (2026-08-10)** — Hash `537dd6c`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 44 Dateien / **482 Tests** (vorher 478), Coverage 98,83 / **93,86** / 99,51 / 99,34 — nur die Branch-Zahl bewegt sich, wie geplant (`SignalGroup.ts` 86,15 → 86,92). Kein Produktionscode angefasst: `git diff` über `bequiet.ts`, `globalEffectStack.ts` und `SignalGroup.ts` ist leer.
- **Das Abnahmekriterium war die Mutationsprobe, nicht der grüne Lauf.** Vier neue Tests für vorhandenen, korrekten Code — »grün« hätten sie auch dann gemeldet, wenn sie nichts prüfen. Der Reviewer hat alle drei Mutationen unabhängig nachgefahren und für jeden roten Test die **Fehlermeldung** gelesen, nicht nur die Zahl:

  | Mutation | vorher | nachher | fällt an |
  | --- | --- | --- | --- |
  | `finally` aus `beQuiet()` | 478 passed, 0 rot | 1 rot | `isQuiet(), 'the quiet frame closed on the way out'` — inhaltlich |
  | `finally` aus `runWithinEffect()` | 478 passed, 0 rot | 2 rot | je eigene `getCurrentEffect()`-Assertion |
  | Dedup-Wache in `attachEffect()` entschärft | 478 passed, 0 rot | 1 rot | Differenz 3 statt 1 `DESTROY`-Listener |

  Kontrollmutation des Planers (`g_numberOfBeQuietRequests++` gestrichen) → sofort 5 rot; das Werkzeug nickt also nicht alles ab. In allen drei Fällen fällt **ausschließlich** der neue Test, kein Nachbar — der Testort am Ende des `describe` ist gemessen und nicht beliebig: weiter vorn platziert vergiftet der unter der Mutation geleakte Modulzustand die Folgetests und die Probe misst 2 statt 1.
- Coverage sieht von alledem nichts: `bequiet.ts` und `globalEffectStack.ts` standen vor und nach dem Paket auf 100/100/100/100. Ein weiteres Beispiel dafür, dass eine Coverage-Zahl kein Ersatz für eine Zusage ist.
- Zwei Korrekturen am Audit, ohne Folgen für den Fix: die Begründung zu TEST-021, ein wiederholtes `attachEffect(sameEffect)` sei »über `createEffect({attach})` in einer Schleife trivial erreichbar«, ist am Code widerlegt — `attachEffect()` läuft aus dem `EffectImpl`-Konstruktor (`src/EffectImpl.ts:332`), also genau einmal je Effect; die Wiederholungsroute ist der direkte `group.attachEffect()`-Aufruf. Und der getestete Zwilling in `attachLink()` wird von zwei Tests gedeckt, nicht von sechs — die anderen vier waren Wächter-Kollateralschaden, den Paket 7a abgeräumt hat.
- Review: TEST-016 und TEST-021 erfüllt, **keine Befunde**. Alle vier Tests folgen dem `finally`-Muster aus 7a, Arrange vor dem `try`, jeder Griff im `finally`.
- Nebenbefund für Paket 10: `bequiet` steht in beiden Threshold-Ausnahmelisten von `vitest.config.ts` und misst 100 % — die Ausnahme ist gegenstandslos geworden.


#### [x] 9. Die Wächter und die Teardown-Reihenfolge der SignalGroup festhalten
- Findings: TEST-018 (medium), TEST-019 (medium)
- Ziel: Drei `BUSY_*`-Bits und die drei begründeten Teardown-Reihenfolgen sind Test, nicht Kommentarprosa — bevor Paket 14 und 19 dieselbe Klasse umbauen.
- Bereich: `src/SignalGroup.*.spec.ts`
- Hängt ab von: Paket 7c (dieselben vier Dateien)
- Anmerkung (2026-08-09, aus Paket 7a): **Jeder neue Test folgt dem Muster aus Paket 7a, Schritt 2.** Für dieses Paket besonders Regel (d): die `BUSY_*`-Wächter und die Teardown-Reihenfolgen werden mit Tests belegt, in denen ein Abbau *absichtlich* wirft — der `finally`-Block darf dann nicht ein zweites Mal werfen und die eigentliche Meldung ersetzen. Und: `SignalGroup.clear()` bleibt in den Hooks, wo 7c es stehen lässt; es ist die zweite Sicherung, nicht Altlast. Nach dem Paket muss das Radius-Tor aus 7a Verify (2b) über die vier Dateien weiterhin `groesster Radius 1, Uebeltaeter 0` melden — auch im Durchlauf mit ausgehängtem Sweep (7c Verify, Schritt 3).
- Modell: mittlere Stufe — bestätigt am 2026-08-10. Alle sieben Tests stehen unten im gemessenen Wortlaut, jede Mutation ist mit ihrem Erwartungswert vorgemessen; der Rest ist Nachfahren. Die schwere Arbeit dieses Pakets war die Suche nach dem *beobachtbaren* Unterschied je Mutation, und die ist erledigt.
- Hash: `8ae6708`
- Dateien: 2 vorhandene Spec-Dateien, **keine neue Datei**, kein Produktionscode, kein neuer Import, kein neuer Export.

  | Datei | neue Tests | geänderte Tests | Ort | Zeilen |
  | --- | ---: | ---: | --- | ---: |
  | `src/SignalGroup.spec.ts` | 3 | 1 (V2) | ans Ende von `describe('cyclic group graphs (BUG-002)')`, hinter `off() does not recurse when an OFF listener calls off() again` (heute `:1629-1663`) · V2 in `attachEffect() returns the effect` (`:1429-1450`) | +115 |
  | `src/SignalGroup.teardown.spec.ts` | 3 | — | neues `describe('the teardown order is part of the contract (TEST-019)')` ans Dateiende, hinter `describe('every teardown step collects instead of aborting')` (schließt heute `:975`) | +115 |

  **Der Ort ist begründet, nicht Geschmack.** Die drei `BUSY_*`-Tests gehören in `describe('cyclic group graphs (BUG-002)')`, weil dort bereits die zwei *getesteten* Bits liegen (`clear() does not recurse when a DESTROY listener clears the same group` `:1600`, `off() does not recurse when an OFF listener calls off() again` `:1629`) und weil der Nachbar `attachGroup() rejects an already cyclic parent chain instead of hanging` (`:1549`) exakt denselben `$setParentGroup`-Trick benutzt, den zwei der drei neuen Tests brauchen. Nach dem Paket stehen alle fünf Bits in einer `describe`-Gruppe.
  Anders als in Paket 8 ist die Platzierung hier **nicht** probenkritisch: `#busy` ist Instanzzustand, kein Modulzustand, und stirbt mit der Gruppe. Trotzdem gemessen — jede der sechs Mutationen färbt repo-weit genau einen Test rot (`1 failed | 487 passed`), egal wer davor oder danach steht.
- Abgleich (2026-08-10): beide Findings unverändert, **alle sechs Zeilenangaben stimmen ziffergenau**. Sämtliche Zahlen unten auf zwei HEAD-Kopien (`537dd6c`) unter `$S/p9/` gemessen (`git archive HEAD`, `node_modules` als Symlink), nie im Arbeitsbaum. Ein voller `npx vitest run` kostet dort 1,7 s, deshalb ist jede Mutation repo-weit gefahren und nicht nur über eine Datei.
  - **TEST-018 unverändert.** `src/SignalGroup.ts:645` (`if (this.#busy & BUSY_HAS_SIGNAL) return false;`), `:662` (`… BUSY_SIGNAL) return undefined;`), `:765` (`… BUSY_RUN_EFFECTS) return;`). Die Bitdefinitionen stehen bei `:182-186`, die Begründung als Kommentarblock bei `:161-181`. Die zwei gedeckten Bits (`BUSY_OFF` `:905`, `BUSY_CLEAR` `:987`) sind es weiterhin.
  - **Korrektur an der Empfehlung von TEST-018, mit Folgen für den Test.** »Der zweite [Zweck] ist über die öffentliche API erreichbar (ein DESTROY-Listener, der `runEffects()` aufruft)« ist am Code widerlegt: die Wächter sind **ein Bit je Methode** (`:180-181` sagt das ausdrücklich). Ein `DESTROY`-Listener feuert aus `clear()` heraus, dort steht `BUSY_CLEAR`; sein `runEffects()`-Aufruf findet `BUSY_RUN_EFFECTS` frei und läuft ganz normal durch — der Wächter wird auf dieser Route nie berührt. In `BUSY_RUN_EFFECTS` kommt nur, wer schon *innerhalb* des Walks steht: ein Effect-Callback, der `group.runEffects()` derselben Gruppe ruft. Genau das tut der Test unten. (Die zweite Route wäre ein Zyklus im **Kind**-Graphen; der ist über `$setParentGroup` allein nicht baubar und bräuchte eine zweistufige `attachGroup()`-Finte — unnötig, wenn die öffentliche API reicht.)
  - **TEST-019 unverändert.** `src/SignalGroup.ts:993-998` (der `DESTROY`-Emit plus `off(this)` als erste Amtshandlung von `clear()`), `:1002-1024` (Kindgruppen → Effects → Signale), `:915-921` (der Kindgruppen-Abstieg als erste Schleife in `off()`, mit dem Kommentar »Recurse into child groups first (depth-first, mirrors clear())«).
  - **Korrektur an der Formulierung von M125, ohne Folgen für den Test — aber der Implementierer muss die richtige Mutation fahren.** »DESTROY-Emit ans Ende« ist zweideutig. Wandert der `emit`-Block allein nach hinten und `off(this)` bleibt bei `:998` stehen, meldet sich der Listener **gar nicht** mehr (eventize hat ihn da längst abgemeldet): heute schon 6 rote Tests, darunter `clear() emits DESTROY event`. Das ist nicht die Reihenfolgen-Mutation, sondern das Abschalten des Emits. Gemeint und gemessen ist: **`emit`-Block *und* `off(this)` gemeinsam ans Ende, direkt vor `throwCollectedErrors`.** So feuert der Listener weiterhin genau einmal, nur zu spät — und überlebt heute (482 passed).
  - **Mutationsprobe vorab, sieben Mutationen, Ausgangslage.** Auf der unveränderten HEAD-Kopie (44 Dateien / 482 Tests grün):

    | Mutation | Eingriff in `src/SignalGroup.ts` | heute |
    | --- | --- | --- |
    | **B1** (M25) | `:645` ersatzlos gestrichen | **482 passed, kein Test rot** |
    | **B2** (M26) | `:662` ersatzlos gestrichen | **482 passed, kein Test rot** |
    | **B3** (M27) | `:765` ersatzlos gestrichen | **482 passed, kein Test rot** |
    | **O1** (M125) | `:993-998` (`emit(DESTROY)` + `off(this)`) ans Ende von `clear()`, vor `throwCollectedErrors` | **482 passed, kein Test rot** |
    | **O2** (M124) | Signal-Schleife `:1018-1024` vor die Effect-Schleife `:1010-1016` | **482 passed, kein Test rot** |
    | **O3** (M123) | Kindgruppen-Schleife `:913-921` aus `off()` hinter die Link-Schleife `:934-942` | **482 passed, kein Test rot** |
    | **V2** | Effect-Schleife `:1010-1016` aus `clear()` ersatzlos entfernt | **30 rot**, davon **2 aus inhaltlichem Grund** (`sibling cleanup must still run`, `after FR cleanup`), 28 Wächter |

    Sechs von sieben überleben — das Audit hat recht, und zwar unverändert nach dem gesamten 7er-Sweep und nach Paket 8. Die V2-Zeile reproduziert die Messung aus dem 7c2-Ergebnis auf den Punkt. Das Werkzeug nickt nicht bloß ab: die Kontrollmutation »`emit`-Block allein nach hinten« (siehe oben) liefert sofort 6 rote Tests.
  - **Zugang, beides schon da — die Halte-Bedingung des Pakets tritt nicht ein.**
    - `$setParentGroup` ist ein regulärer Export von `src/SignalGroup.ts:155` (`Symbol.for('@spearwolf/signalize/setParentGroup')`), im JSDoc als »@internal Test seam for the cycle guard in `attachGroup()`« geführt, und **`src/SignalGroup.spec.ts:19` importiert ihn bereits** — `import {$groupResources, $setParentGroup, SignalGroup} from './SignalGroup.js';`. Er hängt an keinem Entry Point (`src/index.ts:23` exportiert aus dieser Datei nur `getSignalGroupsCount` und `SignalGroup`), `stripInternal` aus Paket 5 ist damit gegenstandslos: gestrippt wird, was ausgeliefert wird. Kein neues Symbol, keine Sichtbarkeitsänderung.
    - `memberCounts` (`src/SignalGroup.ts:857`, `@internal`) erreicht der Test **nicht direkt**, sondern über `getGroupMemberCounts()` aus `src/__testing__/assert-helpers.ts:16` — dessen einziger Zweck genau das ist, und den `src/SignalGroup.teardown.spec.ts:7` bereits importiert. Auch hier ist `stripInternal` folgenlos: es wirkt beim *Emit* der `.d.ts` im Publish-Pass, nicht beim Typcheck, und die Specs kompilieren gegen `src/`, nicht gegen `lib/`. Belegt statt behauptet: `npx tsc --noEmit -p tsconfig.json` läuft mit den neuen Tests auf 0 Fehler.
  - **Coverage bewegt sich, und zwar erwartbar.** `SignalGroup.ts` 97,12 → **98,08** Statements und 86,92 → **89,23** Branches; global 98,83 → **99,10** / 93,86 → **94,50** / 99,51 unverändert / 99,34 unverändert. Anders als in Paket 8 sind die Wächterzeilen echte ungedeckte Zweige, deshalb schlägt die Probe hier auch auf die Zahl durch — sie bleibt trotzdem *nicht* das Abnahmekriterium: gedeckt heißt ausgeführt, nicht zugesagt.
  - **Regel (d) hat in diesem Paket keinen Gegenstand** — anders als die Anmerkung von 7a vorsorglich annahm. Keiner der sieben Tests braucht einen absichtlich werfenden Teardown: die drei Wächter zeigen sich an einer Antwort statt an einem `RangeError`, die drei Reihenfolgen an einem Protokoll. Kein `finally`-Block kann hier eine Meldung ersetzen, und das Meldungs-Tor bestätigt es (0 maskiert an 41 Saatpunkten, mit und ohne Sweep). Der Sweep bleibt selbstverständlich in den Hooks stehen, wo 7c ihn gelassen hat.
- Vorgehen: sechs neue Tests, ein geänderter Test, zwei Dateien. Der Wortlaut unten ist der gemessene — er compiliert (`tsc --noEmit -p tsconfig.json`, 0 Fehler), läuft unverändert durch Biome (`biome check`, keine Korrektur) und ist grün.
  1. **Nichts importieren, nichts exportieren.** `src/SignalGroup.spec.ts` führt `SignalGroup`, `$setParentGroup`, `$effect`, `createSignal`, `createEffect` und `assertEffectsCount` bereits; `src/SignalGroup.teardown.spec.ts` führt `on`, `DESTROY`, `SignalGroup`, `createSignal`, `createEffect`, `link`, `destroySignal`, `getSignalsCount` und `getGroupMemberCounts` bereits. Keine der beiden Dateien bekommt eine neue Importzeile — nachgeprüft durch `tsc` und `pnpm check` (Biome meldet ungenutzte Importe).
  2. **Keine neue Datei, und das Paket wird nicht geteilt.** Begründung unter »Planänderung«.
  3. **`src/SignalGroup.spec.ts`** — die drei Tests kommen zusammen ans Ende von `describe('cyclic group graphs (BUG-002)')`, hinter den `off()`-Wiedereintrittstest (heute endet er auf `:1663`, die `describe` schließt auf `:1664`). Wortlaut:

     ```ts
     it('hasSignal() answers instead of hanging when the parent chain is cyclic (TEST-018)', () => {
       const a = SignalGroup.findOrCreate({});
       const b = SignalGroup.findOrCreate({});
       const inB = createSignal(1);

       b.attachSignalByName('inB', inB);

       // Break the forest invariant on purpose, exactly as the Floyd test
       // above does: `attachGroup()` rejects every edge that would close a
       // cycle, so this is the only way to reach the guard.
       b.attachGroup(a); // a → b
       b[$setParentGroup](a); // a ↔ b

       try {
         expect(
           () => a.hasSignal('nobody'),
           'the walk ends instead of running until the stack gives out',
         ).not.toThrow();

         expect(
           a.hasSignal('nobody'),
           'a cyclic chain answers like an unknown name',
         ).toBe(false);

         expect(
           a.hasSignal('inB'),
           'one hop up the cyclic chain still answers',
         ).toBe(true);
       } finally {
         b[$setParentGroup](undefined);
         b.clear();
         a.clear();
         inB.destroy();
       }
     });

     it('signal() answers instead of hanging when the parent chain is cyclic (TEST-018)', () => {
       const a = SignalGroup.findOrCreate({});
       const b = SignalGroup.findOrCreate({});
       const inB = createSignal(1);

       b.attachSignalByName('inB', inB);

       b.attachGroup(a); // a → b
       b[$setParentGroup](a); // a ↔ b

       try {
         expect(
           () => a.signal('nobody'),
           'the walk ends instead of running until the stack gives out',
         ).not.toThrow();

         expect(
           a.signal('nobody'),
           'a cyclic chain answers like an unknown name',
         ).toBeUndefined();

         expect(
           a.signal('inB'),
           'one hop up the cyclic chain still answers',
         ).toBe(inB);
       } finally {
         b[$setParentGroup](undefined);
         b.clear();
         a.clear();
         inB.destroy();
       }
     });

     it('runEffects() ignores a re-entrant call from an effect callback (TEST-018)', () => {
       const group = SignalGroup.findOrCreate({});
       const order: string[] = [];

       const first = createEffect(
         () => {
           order.push('first: enter');
           group.runEffects();
           order.push('first: leave');
         },
         {autorun: false},
       );

       const second = createEffect(
         () => {
           order.push('second');
         },
         {autorun: false},
       );

       try {
         group.attachEffect(first[$effect]);
         group.attachEffect(second[$effect]);

         group.runEffects();

         expect(order, 'the re-entrant call ran nothing at all').toEqual([
           'first: enter',
           'first: leave',
           'second',
         ]);
       } finally {
         first.destroy();
         second.destroy();
         group.clear();
       }
     });
     ```

     Drei Dinge, die nicht Geschmack sind:
     - **Warum `.not.toThrow()` *und* eine Wertassertion.** Ohne den Wächter endet der Walk in `RangeError: Maximum call stack size exceeded`. Nackt geschrieben stürbe der Test daran, aber ohne eigene Meldung; der Wrapper macht daraus eine Assertion mit Satz (`expected [Function] to not throw an error but 'RangeError: Maximum call stack size e…' was thrown`). Die zweite Assertion hält fest, *was* der Wächter antwortet (`false` bzw. `undefined` — »zyklisch« wird zu »kein Signal mit diesem Namen«, genau der Punkt, den READ-013 beschreibt), die dritte, dass er den normalen Ein-Sprung-Fall nicht mit kaputt macht.
     - **Warum die Arrange-Phase vor dem `try` steht und der `finally`-Block mit `b[$setParentGroup](undefined)` beginnt.** Regel (1) aus dem 7b-Nachtrag, und die Vorlage `:1549`: die Forst-Invariante geht zurück, *bevor* irgendetwas abgeräumt wird, damit `clear()` gegen einen Graphen läuft, den die öffentliche API auch bauen könnte.
     - **Warum `runEffects()` mit zwei Effects und einem Protokoll.** Ohne den Wächter läuft `second` *innerhalb* des `first`-Callbacks (`['first: enter', 'second', 'first: leave']`) statt danach. Zweimal läuft nichts — dafür sorgt `shouldRun` in `EffectImpl.run()` (`src/EffectImpl.ts:444`) —, die Reihenfolge ist der ganze beobachtbare Unterschied, und sie ist genau die Zusage: ein wiedereintretender Aufruf tut **nichts**, der äußere Walk behält seine Ordnung.
  4. **V2 — die Auflage aus dem 7c1-Review, am Code nachgeprüft und unverändert gültig.** `attachEffect() returns the effect` (`src/SignalGroup.spec.ts:1429-1450`) steht Zeichen für Zeichen so da, wie 7c1 ihn hinterlassen hat; die Messung von 7c1 gilt weiter (V2 heute: 30 rot, davon 2 inhaltlich — der Test ist keiner davon). Eingriff: `group.clear()` **zurück in den `try`-Block**, dahinter die Assertion, `finally` unverändert. Die vier Zeilen kommen hinter `group.attachSignal(signal);`:

     ```ts
           group.attachSignal(signal);

           // The effect the group just took must not survive its teardown. Until
           // TEST-017 gave this test a `finally`, that was policed by the
           // `afterEach` counter alone — a detector by accident. Here it is a
           // promise: drop the effect loop from `SignalGroup#clear()` and this
           // line goes red, not the rest of the file.
           group.clear();
           assertEffectsCount(0, 'clear() destroyed the attached effect');
         } finally {
     ```

     Gemessen: unter V2 fällt der Test an **dieser** Assertion (`clear() destroyed the attached effect: Number of active effects should be 0 but is 1`), im Rumpf, nicht im `afterEach`. Der doppelte `clear()` (einer im `try`, einer im `finally`) ist der idempotente Gürtel aus Regel (b).
  5. **`src/SignalGroup.teardown.spec.ts`** — ein neues `describe` ans Dateiende, hinter `describe('every teardown step collects instead of aborting')` (schließt heute `:975`), innerhalb des äußeren `describe('SignalGroup teardown robustness')`. Wortlaut:

     ```ts
     describe('the teardown order is part of the contract (TEST-019)', () => {
       it('clear() emits DESTROY before it takes anything apart', () => {
         const obj = {};
         const group = SignalGroup.findOrCreate(obj);
         const source = createSignal(1, {attach: obj});
         const target = createSignal(0, {attach: obj});
         const child = SignalGroup.findOrCreate({});

         createEffect(() => source.get(), {attach: obj});
         link(source, target, {attach: obj});

         let calls = 0;
         let seen: ReturnType<typeof getGroupMemberCounts> | undefined;

         try {
           group.attachGroup(child);

           on(group, DESTROY, () => {
             calls += 1;
             seen = getGroupMemberCounts(group);
           });

           group.clear();

           expect(calls, 'the DESTROY listener ran exactly once').toBe(1);
           expect(seen, 'the listener saw the group still intact').toEqual({
             signals: 2,
             namedSignals: 0,
             otherSignals: 0,
             effects: 1,
             links: 1,
             groups: 1,
           });
         } finally {
           group.clear();
           child.clear();
           destroySignal(source, target);
         }
       });

       it('clear() destroys the effects before the signals', () => {
         const obj = {};
         const group = SignalGroup.findOrCreate(obj);
         const source = createSignal(1, {attach: obj});
         const order: string[] = [];

         createEffect(
           () => {
             source.get();
             return () => {
               order.push(`effect cleanup: ${getSignalsCount()} signal(s) alive`);
             };
           },
           {attach: obj},
         );

         try {
           group.clear();

           expect(
             order,
             'the cleanup callback still sees the signal it depended on',
           ).toEqual(['effect cleanup: 1 signal(s) alive']);
         } finally {
           group.clear();
           destroySignal(source);
         }
       });

       it('off() switches the child groups off before its own members', () => {
         const parentObj = {};
         const childObj = {};
         const parent = SignalGroup.findOrCreate(parentObj);
         const child = SignalGroup.findOrCreate(childObj);
         const parentSignal = createSignal(1, {attach: parentObj});
         const childSignal = createSignal(2, {attach: childObj});
         const order: string[] = [];

         createEffect(
           () => {
             parentSignal.get();
             return () => {
               order.push('parent effect');
             };
           },
           {attach: parentObj},
         );

         createEffect(
           () => {
             childSignal.get();
             return () => {
               order.push('child effect');
             };
           },
           {attach: childObj},
         );

         try {
           parent.attachGroup(child);

           parent.off();

           expect(order, 'depth-first: the child goes first').toEqual([
             'child effect',
             'parent effect',
           ]);
         } finally {
           parent.clear();
           child.clear();
           destroySignal(parentSignal, childSignal);
         }
       });
     });
     ```

     Wieder drei Dinge, die begründet sind:
     - **Der `memberCounts`-Test prüft alle sechs Zahlen, nicht eine.** Das Audit verlangt »ein `DESTROY`-Listener, der `group.memberCounts` liest«; die Gruppe hält zum Emit-Zeitpunkt zwei Signale, einen Effect, einen Link und eine Kindgruppe. Unter O1 liest der Listener sechs Nullen, unter einem entfernten Emit läuft er gar nicht — die erste Assertion fängt den zweiten Fall, die zweite den ersten. Nebenwirkung, die für Paket 19 zählt: das ist zugleich die einzige Assertion im Repo, die `memberCounts` **im Vollstand** festnagelt.
     - **Warum die Reihenfolge Effects-vor-Signale über den globalen Zähler beobachtet wird und nicht über den Wert.** Ein zerstörtes Signal bleibt laut `src/signal-core.ts:136-138` als Wertbehälter benutzbar — `source.get()` im Cleanup liefert vorher wie nachher `1` und wäre ein Detektor, der nichts detektiert (der Fehler, an dem in 7c1 einer gestorben ist). `getSignalsCount()` bewegt sich dagegen sofort: `destroySignal()` zählt herunter, *bevor* es emittiert. Gemessen unter O2: `'effect cleanup: 0 signal(s) alive'`.
     - **Warum `off()` mit Cleanup-Callbacks protokolliert.** `off()` zerstört Effects und Links, lässt Signale aber stehen; die Cleanup-Callbacks sind die einzige Spur, die die Reihenfolge sichtbar macht. Unter O3 kippt sie auf `['parent effect', 'child effect']`.
  6. **Kein `pnpm fix` nötig, `pnpm check` gehört trotzdem gefahren.** Biome hat den Wortlaut oben unverändert durchgelassen; wer ihn umformuliert, formatiert nach.
  7. **CHANGELOG:** eine Zeile unter `### Tests` in `## Unreleased`, im Ton der TEST-016/021-Zeile daneben — etwa: `` the three untested `BUSY_*` re-entrancy guards and the three documented teardown orders of `SignalGroup` are pinned: removing a guard or swapping an order now fails exactly one test instead of passing silently (TEST-018, TEST-019) ``. Keine Doku-Synchronisation: die öffentliche API ändert sich nicht, `AGENTS.md` bleibt unangetastet.
- Verify: drei Teile. Der erste zeigt, dass nichts kaputt ist; der zweite ist der eigentliche Beweis; der dritte hält den Standard aus 7c. Alle Erwartungswerte am 2026-08-10 auf einer HEAD-Kopie mit genau diesen sieben Tests gemessen.
  1. `pnpm world`. Erwartet: neun Schritte grün, **44 Dateien / 488 Tests** in `test` und `test:gc` (482 + 6), Coverage **99,10 / 94,50 / 99,51 / 99,34**. Statements und Branches steigen (`SignalGroup.ts` 97,12 → 98,08 und 86,92 → 89,23), Functions und Lines stehen still. Bewegt sich eine der beiden stillen Zahlen, ist etwas anderes passiert als dieses Paket.
  2. **Die sieben Mutationsproben.** Jede einzeln, auf einer Kopie, nicht im Arbeitsbaum. Die Erwartung ist nicht »ein Test wird rot«, sondern »**genau dieser** Test wird rot, an **dieser** Meldung«:

     | Mutation | ohne die neuen Tests | mit ihnen | fällt an |
     | --- | ---: | --- | --- |
     | **B1** `:645` gestrichen | 482 passed, 0 rot | **1 failed \| 487 passed** | `hasSignal() answers instead of hanging …` → `the walk ends instead of running until the stack gives out: … 'RangeError: Maximum call stack size e…' was thrown` |
     | **B2** `:662` gestrichen | 482 passed, 0 rot | **1 failed \| 487 passed** | `signal() answers instead of hanging …` → dieselbe Meldung |
     | **B3** `:765` gestrichen | 482 passed, 0 rot | **1 failed \| 487 passed** | `runEffects() ignores a re-entrant call …` → `the re-entrant call ran nothing at all: expected [ 'first: enter', 'second', …(1) ]` |
     | **O1** `emit(DESTROY)` **+ `off(this)`** ans Ende von `clear()` | 482 passed, 0 rot | **1 failed \| 487 passed** | `clear() emits DESTROY before it takes anything apart` → `the listener saw the group still intact: expected { signals: +0, … }` |
     | **O2** Signale vor Effects | 482 passed, 0 rot | **1 failed \| 487 passed** | `clear() destroys the effects before the signals` → `expected [ 'effect cleanup: 0 signal(s) alive' ]` |
     | **O3** Kindgruppen zuletzt in `off()` | 482 passed, 0 rot | **1 failed \| 487 passed** | `off() switches the child groups off before its own members` → `expected [ 'parent effect', 'child effect' ]` |
     | **V2** Effect-Schleife aus `clear()` | 30 rot, 2 inhaltlich | **34 rot, 4 inhaltlich** | neu dabei: `attachEffect() returns the effect` → `clear() destroyed the attached effect: … should be 0 but is 1`, und `clear() destroys the effects before the signals` (der Effect wird nie zerstört, also läuft kein Cleanup) |

     Bei B1 bis O3 **kein einziger Kollateralschaden** — die rote Zeile ist ausschließlich der neue Test, und er fällt an seiner Rumpfassertion, nicht an einem `afterEach`-Wächter. V2 ist die Ausnahme und darf es sein: ein kaputtes `clear()` leckt tatsächlich Effects, das repariert kein `finally` (so schon in 7c2 gemessen). Die Zahl 2 → 4 ist der eigentliche Ertrag der Auflage: **die repo-weite Erkennung der Effect-Schleife hängt danach nicht mehr an zwei fremden Rumpf-Assertions, sondern an vier — davon eine, die genau dafür geschrieben ist.**
     Nach jeder Probe: Rückbau aus der Sicherung, `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/` ist leer.
  3. **Beide Tore aus 7c über die sieben Tests**, Radius und Meldung, je mit und ohne Sweep (`SignalGroup.clear()` in `beforeEach`/`afterEach` auskommentiert). Gesät wird `expect(1, 'SEEDED').toBe(2);` vor jeder Anweisung im `try`-Block. Werkzeug: `$S/p9/gate9.py <repo> <spec> "<testname>"`, optional `--nosweep`. Gemessen, je Saatpunkte / größter Radius / Übeltäter / maskiert / Radius 0 — **mit und ohne Sweep identisch**:

     | Test | Ergebnis |
     | --- | --- |
     | `hasSignal() answers instead of hanging …` | **6 / 1 / 0 / 0 / 0** |
     | `signal() answers instead of hanging …` | **6 / 1 / 0 / 0 / 0** |
     | `runEffects() ignores a re-entrant call …` | **5 / 1 / 0 / 0 / 0** |
     | `attachEffect() returns the effect` (V2) | **10 / 1 / 0 / 0 / 0** |
     | `clear() emits DESTROY before it takes anything apart` | **7 / 1 / 0 / 0 / 0** |
     | `clear() destroys the effects before the signals` | **3 / 1 / 0 / 0 / 0** |
     | `off() switches the child groups off before its own members` | **4 / 1 / 0 / 0 / 0** |

     Damit ist die Anmerkung aus Paket 7a erfüllt, messend statt sichtprüfend, und der V2-Eingriff hat den Radius des umgebauten Tests nachweislich nicht angehoben (10 Saatpunkte, alle Radius 1) — das war die offene Frage aus 7c1.
- Commit: `test: pin the three re-entrancy guards and the teardown order of SignalGroup (TEST-018, TEST-019)`

<details>
<summary>TEST-018 und TEST-019 im Volltext (aus <code>audit.html</code>)</summary>

**TEST-018 — Die drei ungetesteten Re-Entrancy-Wächter ansteuern**
Severity: medium · Kategorie: Testabdeckung & Teststrategie · Domain: harness · Effort: M
Location: `src/SignalGroup.ts:645` · `src/SignalGroup.ts:662` · `src/SignalGroup.ts:765`

> Von den fünf `BUSY_*`-Bits, die rekursive Walks und Nutzer-Wiedereintritt abfangen, sind zwei getestet (`off()`, `clear()`) und drei nicht: `hasSignal()`, `signal()`, `runEffects()`. Der Kommentar nennt beide Zwecke ausdrücklich. Der zweite ist über die öffentliche API erreichbar (ein DESTROY-Listener, der `runEffects()` aufruft) und braucht den Testzugang gar nicht.

> Empfehlung: Für `runEffects()` ein Effect, dessen Callback `group.runEffects()` aufruft; für `hasSignal()`/`signal()` den `$setParentGroup`-Seam. **Vorher READ-013 entscheiden** — dort stehen zwei derselben Bits als entbehrlich.

> Evidence: M25, M26, M27 — jeweils die Wächter-Zeile ersatzlos gestrichen: alle SURVIVED. M42 und M43 (dieselbe Mutation an `off()`/`clear()`): KILLED.

**TEST-019 — Die Teardown-Reihenfolge von SignalGroup#clear() und #off() festnageln**
Severity: medium · Kategorie: Testabdeckung & Teststrategie · Domain: harness · Effort: M
Location: `src/SignalGroup.ts:994-998` · `src/SignalGroup.ts:1002-1024` · `src/SignalGroup.ts:915-921`

> Drei ausführlich begründete Reihenfolgen im Group-Teardown hält kein Test fest: `clear()` emittiert DESTROY *vor* dem Abbau (ein Listener soll die Gruppe noch intakt sehen), zerstört Effects *vor* Signals, und `off()` steigt erst in die Kindgruppen ab. Alle drei lassen sich vertauschen, ohne dass ein Test rot wird. Damit ist der Vertrag, auf den ein DESTROY-Listener sich stützt, reine Kommentarprosa.

> Empfehlung: Je ein Test mit einem DESTROY-Listener, der `group.memberCounts` liest, plus ein Test, der die Aufrufreihenfolge in ein Array protokolliert und die Sequenz vergleicht.

> Evidence: M125 (DESTROY-Emit ans Ende), M124 (Signals vor Effects), M123 (Kindgruppen nach den eigenen Links) — alle drei SURVIVED.

</details>

- Planänderung (2026-08-10): keine. Reihenfolge, Schnitt und Abhängigkeiten bleiben, das Paket behält seine Nummer.
  - **Nicht geteilt, und zwar gemessen.** Der Grund, aus dem 7c geteilt wurde, greift hier nicht: dort waren es 129 umzustellende Tests und ein Diff über 1517 Zeilen in *einer* Datei. Hier sind es **+115 / +115 Zeilen in zwei Dateien**, sechs neue Tests plus vier Zeilen an einem vorhandenen, jeder Wortlaut ausgeschrieben und grün gemessen, jede Mutation mit Erwartungswert. Das ist knapp mehr als Paket 8 (vier Tests, drei Dateien, eine Runde, null Befunde) und deutlich weniger als jedes 7er-Teilpaket. Ein Schnitt zwischen TEST-018 und TEST-019 wäre sauber möglich (verschiedene Dateien, keine gemeinsame Abhängigkeit) und kostete eine komplette zusätzliche Review-Runde für 115 Zeilen. Dagegen entschieden.
  - **Die Auflage aus dem 7c1-Review ist eingelöst**, nicht weitergereicht: V2 steht als Schritt 4 im Vorgehen, mit gemessenem Wortlaut, gemessener Fehlermeldung und gemessenem Radius.
  - **Zwei Korrekturen am Audit, beide ohne Folgen für den Scope**, beide oben im Abgleich belegt: die von TEST-018 vorgeschlagene `runEffects()`-Route über einen DESTROY-Listener erreicht das Bit nicht (ein Bit je Methode); und M125 muss den `off(this)`-Aufruf mitnehmen, sonst misst man das Abschalten des Emits statt seiner Verschiebung.
  - **READ-013 bleibt unberührt.** Die Festlegung im Plankopf gilt: alle drei Bits bekommen einen Test, entfernt wird nichts. Nebenbei liefert dieses Paket das Argument dafür — die zwei »unerreichbaren« Bits sind über den `$setParentGroup`-Seam sehr wohl erreichbar, und ohne sie endet der Walk in einem `RangeError`, nicht in einer Antwort.
  - Kein neuer `critical`- oder `high`-Befund. Kein Nebenbefund für Paket 29 oder 30.

- **Ergebnis (2026-08-10)** — Hash `8ae6708`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 44 Dateien / **488 Tests** (vorher 482), Coverage **99,10 / 94,50** / 99,51 / 99,34. Kein Produktionscode angefasst, `git diff src/SignalGroup.ts` leer.
- **Sechs Mutationen, sechsmal genau ein roter Test.** Der Reviewer hat alle sechs unabhängig gefahren und je die Fehlermeldung gelesen. Heute überleben sie sämtlich (482 grün, 0 rot):

  | Mutation | nachher | fällt an |
  | --- | --- | --- |
  | `BUSY_HAS_SIGNAL` (`:645`) gestrichen | 1 rot | `RangeError: Maximum call stack size exceeded` |
  | `BUSY_SIGNAL` (`:662`) gestrichen | 1 rot | dieselbe Klasse |
  | `BUSY_RUN_EFFECTS` (`:765`) gestrichen | 1 rot | Reihenfolge-Assertion |
  | `emit(DESTROY)` + `off(this)` ans Ende von `clear()` | 1 rot | »the listener saw the group still intact« |
  | Signale vor Effects zerstört | 1 rot | »effect cleanup: 0 signal(s) alive« |
  | `off()` steigt zuletzt in die Kindgruppen ab | 1 rot | `['parent effect', 'child effect']` |

  Kein Kollateralschaden in irgendeinem Lauf.
- **Zwei Empfehlungen des Audits waren am Code falsch, beide vom Reviewer nachvollzogen.** Erstens erreicht die vorgeschlagene `runEffects()`-Route über einen `DESTROY`-Listener das Bit `BUSY_RUN_EFFECTS` **nie**: es gibt ein Bit je Methode (`src/SignalGroup.ts:180-186`), und der Listener feuert unter `BUSY_CLEAR`. Der Reviewer hat einen eigenen Probe-Test gebaut — der Aufruf läuft ungehindert durch. Die einzige Route ist ein Effect-Callback, der `group.runEffects()` derselben Gruppe ruft. Zweitens muss die Mutation zur `DESTROY`-Reihenfolge das `off(this)` mitnehmen; die Kontrollprobe mit allein verschobenem `emit` reißt **7** Tests statt einem — sie misst dann das Abschalten des Listeners, nicht die Verschiebung.
- **V2 aus dem 7c1-Review ist eingelöst.** `attachEffect() returns the effect` prüft jetzt mit `assertEffectsCount(0, 'clear() destroyed the attached effect')` im `try`, statt sich auf den `afterEach`-Wächter zu verlassen; das `finally` blieb unverändert, der Radius des Tests bleibt 1. Unter der V2-Mutation fallen 34 Tests, davon **vier** aus inhaltlichem Grund statt vorher zwei. Damit ist die Auflage aus Paket 7c1 erfüllt: aus dem Zufall ist eine Zusage geworden.
- **Ein gemeldeter Nebenbefund war ein Messartefakt und ist gestrichen.** Der Implementierer meldete, ein Ganzdatei-Lauf ohne den `SignalGroup.clear()`-Sweep breche schon bei null gesäten Fehlern an einem Alttest um `SignalGroup.spec.ts:133` — was der 7c1-Messung widersprochen hätte. Der Reviewer hat es aufgeklärt: der Test dort ruft `SignalGroup.clear()` **im Rumpf** auf, als Act, weil er genau diese statische Methode prüft. Das selbstgebaute Sweep-Aushängen des Implementierers hat den Aufruf mit auskommentiert und dem Test seinen Gegenstand genommen. Mit korrekt auf die Hooks beschränktem Aushängen läuft die Datei komplett grün, dreifach reproduziert — deckungsgleich mit 7c1. Der 7c-Plan schreibt genau diese Beschränkung vor; wer das Werkzeug neu baut, muss sie mitbauen.
- Kleiner Befund, keine Runde: die zwei neuen `hasSignal()`/`signal()`-Tests räumen im `finally` Gruppen vor Signal ab, während Regel (e) Signale vor Gruppen will. Folgenlos — das Signal hängt an der Gruppe und ist beim `destroy()` schon weg, der Aufruf ist der idempotente Gürtel aus Regel (b) — und es ist dieselbe Reihenfolge wie im bereits abgenommenen Nachbartest.


#### [x] 10. Die ungetestete Hälfte der Kernlogik abdecken
- Findings: TEST-020 (medium), TEST-023 (medium), TEST-024 (medium), TEST-025 (medium)
- Ziel: Finalizer-Buchhaltung, der Ort des `#generation`-Bumps, die drei Zweige von `createSignal` und der Namens-Fallback in `#removeSignal()` überleben ihre Entfernung nicht mehr — das Netz, ohne das Paket 28 nicht angefasst werden darf.
- Bereich: `src/link.gc.spec.ts`, `src/SignalGroup.gc.spec.ts`, `src/EffectImpl.*.spec.ts`, `src/createSignal.spec.ts`
- Hängt ab von: Paket 7a bis 7c (`link.gc.spec.ts` in 7a, `EffectImpl.*.spec.ts` und `createSignal.spec.ts` in 7b, `SignalGroup.gc.spec.ts` in 7c)
- Anmerkung (2026-08-09, aus Paket 7a): **Jeder neue Test folgt dem Muster aus Paket 7a, Schritt 2**, und das Radius-Tor aus 7a Verify (2b) muss über die angefassten Dateien weiterhin `groesster Radius 1, Uebeltaeter 0` melden. Zwei Nebenbefunde aus Paket 7a landen hier, weil sie beide Löcher in der *Leckerkennung* sind und dieses Paket genau dafür da ist: erstens sind die Zählerwächter über die 35 Dateien hinweg uneinheitlich (zwölf prüfen nur `assertEffectsCount`, elf zwei, elf alle drei, `link.gc.spec.ts` nur `assertLinksCount`) — `src/effects.cleanup.spec.ts` bemerkt ein geleaktes Signal deshalb gar nicht; zweitens ist `off(this)` in `SignalLink#destroy()` (`src/SignalLink.ts:421`) ungedeckt: entfernt man die Zeile, fallen 2 von 28 Tests in `src/SignalLink.spec.ts`, weil kein Wächter Abonnements auf dem Link-Objekt zählt. Das ist genau das `getSubscriptionCount`-Bilanzmuster aus `CLAUDE.md`, für das `unsubscribeEffect.spec.ts` die Referenz ist.
- Anmerkung (2026-08-09, aus Paket 3): Die zweite Schwellenstufe in `vitest.config.ts` schließt neun Dateien namentlich vom 100-Prozent-Anspruch aus. Steigt die Deckung dieses Pakets, können Namen aus der Liste fallen — mitprüfen und, wo es passt, streichen. Kein Muss, aber genau hier der billigste Moment dafür.
- Modell: **mittlere Stufe** — herabgesetzt am 2026-08-10, aus demselben Grund wie in Paket 8 und 9: alle acht Tests stehen unten im gemessenen Wortlaut, jede Mutation ist mit ihrem Erwartungswert und ihrer Fehlermeldung vorgemessen, der Rest ist Nachfahren. **Mit einer Auflage:** Die beiden GC-Tests sind nicht umformulierbar. Ihr Beweiswert hängt an je einer Zeile, deren Grund nicht im Code steht (`gc()` ohne nachfolgendes `await`; die Zeugen-Assertion über die `WeakRef`-Liste). Wer sie umbaut, muss die zugehörige Mutationsprobe fünfmal neu fahren, sonst ist der Test grün und leer.
- Hash: `de36cf0`
- Dateien: 6 vorhandene Spec-Dateien, **keine neue Datei**, kein Produktionscode. Dazu eine Zeile in `vitest.config.ts` (Nebenbefund, Schritt 8).

  | Datei | neue Tests | Finding | Ort | Zeilen |
  | --- | ---: | --- | --- | ---: |
  | `src/effects.async.spec.ts` | 1 | TEST-023 | in `describe('cleanup generations')`, direkt hinter `keeps the cleanup of the outer run when a cleanup re-enters the effect` (heute `:333-384`) | +81 |
  | `src/createSignal.destroySignal.spec.ts` | 1 | TEST-024 | ans Ende des äußeren `describe('destroySignal')`, hinter `destroy signal destroys effects and memos` (endet `:163`) und **vor** `describe('a dependency destroyed while the effect is running')` | +29 |
  | `src/createSignal.lazy.spec.ts` | 2 | TEST-024 | ans Dateiende, hinter `laziness is NOT catching on` (`:67-83`) | +48 |
  | `src/SignalGroup.spec.ts` | 1 | TEST-025 | in `describe('edge cases and additional code paths')`, direkt hinter `detachSignal() reverts to previous signal when detaching non-active signal with same name` (`:1146-1184`) | +40 |
  | `src/SignalGroup.teardown.spec.ts` | 1 | TEST-020 | hinter `clearGroupFromFinalizer() reports a throwing teardown instead of letting it escape` (`:578-645`), vor `describe('every teardown step collects instead of aborting')` | +36 |
  | `src/link.gc.spec.ts` | 1 | TEST-020 | ans Dateiende, hinter `a throwing release handle is reported and does not stop the rest (MEM-001)` | +60 |
  | `src/SignalGroup.gc.spec.ts` | 1 | TEST-020 | ans Dateiende, hinter `a group whose host dies while an effect keeps it alive is still cleared (MEM-003)` | +46 |
  | **Summe** | **8** | | | **+340** |

  **Der Ort ist bei vier der acht gemessen und nicht Geschmack.** Drei davon stehen unmittelbar hinter dem Test, den sie ergänzen — und die Nachbarschaft ist jedes Mal die Begründung, warum es den neuen Test überhaupt braucht: `keeps the cleanup of the outer run …` (TEST-023) baut genau die Szene, in der der Bump-Ort *nicht* sichtbar wird; `detachSignal() reverts to previous signal …` (TEST-025) lässt genau einen Kandidaten übrig, weshalb »der letzte« und »der erste« dort dasselbe Signal sind; `the FinalizationRegistry backstop still works for a group created during the sweep (BUG-009)` (TEST-020) ist der positive Zwilling zum neuen Negativfall. Der vierte ist `src/createSignal.destroySignal.spec.ts`: der Test gehört vor die verschachtelte `describe`, weil er die Lese-Hälfte derselben Zusage prüft wie die Schreib-Hälfte darüber. Anders als in Paket 8 ist keine Platzierung probenkritisch — kein neuer Test hinterlässt Modulzustand —, aber jede wurde trotzdem gegengemessen: jede Mutation färbt repo-weit genau einen Test rot.
- Abgleich (2026-08-10): **alle vier Findings unverändert gültig, alle zwölf Zeilenangaben stimmen ziffergenau.** Sämtliche Zahlen unten auf HEAD-Kopien (`8ae6708`) unter `$S/p10/` gemessen (`git archive HEAD`, `node_modules` als Symlink), nie im Arbeitsbaum. Ausgangslage: 44 Dateien / **488 Tests** grün (das Audit rechnet noch mit 478, Paket 8 und 9 haben zehn dazugelegt).
  - **Die Mutationsprobe vorab, zehn Mutationen, Ausgangslage.** Auf der unveränderten Kopie ohne die neuen Tests:

    | # | Finding | Eingriff | heute |
    | --- | --- | --- | --- |
    | **A** | TEST-020 | `src/SignalGroup.ts:75-77`: der Hüllen-`delete` im Ressourcen-Finalizer ersatzlos | **488 passed, 0 rot** |
    | **B** | TEST-020 | `src/SignalGroup.ts:103`: `\|\| !allGroups.has(selfRef)` gestrichen | **488 passed, 0 rot** |
    | **C** | TEST-020 | `src/SignalGroup.ts:136-144`: Husk-Sweep → `return allGroups.size;` | **488 passed, 0 rot** |
    | **D** | TEST-020 | `src/SignalGroup.ts:370-372`: `if (object !== this)` gestrichen, immer registrieren | **488 passed, 0 rot** |
    | **E** | TEST-020 | `src/link.ts:247`: `gLinkFinalizer.unregister(newLink)` ersatzlos | **488 passed, 0 rot** |
    | **F** | TEST-023 | `src/EffectImpl.ts:476` → `const generation = this.#generation;`, `this.#generation++` an den Anfang von `run()` (hinter `this.#runDepth++`) | **488 passed, 0 rot** |
    | **G** | TEST-024 | `src/createSignal.ts:52`: `} else if (!signal.destroyed) {` → `} else {` | **488 passed, 0 rot** |
    | **H** | TEST-024 | `src/createSignal.ts:110`: die Klausel `lazy !== this.lazy \|\|` gestrichen | **488 passed, 0 rot** |
    | **I** | TEST-024 | `src/createSignal.ts:85`: `this.valueFn = undefined;` gestrichen | **488 passed, 0 rot** |
    | **J** | TEST-025 | `src/SignalGroup.ts:724-726`: Schleife → `otherSignals.values().next().value` | **488 passed, 0 rot** |

    Zehn von zehn überleben — das Audit hat recht, und zwar unverändert nach dem 7er-Sweep und nach Paket 8 und 9.
  - **TEST-020 unverändert, aber die fünf Stellen sind nicht gleich viel wert — zwei davon sind nicht testbar, und das ist ein Befund, kein Ausweichen.** Die Fundstellen: `:75-77` (Hüllen-`delete`), `:103` (Mitgliedschaftsprüfung), `:136-144` (Husk-Sweep in `getSignalGroupsCount()`), `:370-372` (Ausnahme für selbstgeschlüsselte Gruppen), `src/link.ts:247` (`gLinkFinalizer.unregister()`). Drei bekommen einen Test (B, C, E), zwei nicht:
    - **A — der Hüllen-`delete` im Ressourcen-Finalizer: nicht testbar, weil er keine eigene Beobachtung hat.** `allGroups` ist Modulzustand ohne Leser außer `getSignalGroupsCount()` und der statischen `SignalGroup.clear()` — und **beide fegen die Hüllen selbst weg** (`:138-139` beziehungsweise `:329-332`). Was der `delete` allein bewirkt, ist damit von außen unsichtbar; was die »Order is load-bearing«-Begründung bei `:56-58` zusagt, ist eine *Zeitzusage* (»wer auf den Gruppenzähler wartet, hat auch alle Handles freigegeben«), und ein Test darauf müsste das Fenster zwischen Einsammeln und Finalizer-Job treffen. Genau dieses Fenster ist nicht steuerbar: mal ist der Job schon gelaufen, mal nicht. Ein Test dafür wäre ein Flackerer, und ein flackernder GC-Test ist schlimmer als keiner. **Bleibt ungedeckt, mit Notiz in Paket 19.**
    - **D — die Ausnahme für selbstgeschlüsselte Gruppen: nicht testbar, weil sie nichts tut.** Für `object === this` würde die zusätzliche Registrierung `groupFinalizationRegistry.register(this, selfRef, this)` lauten; feuert sie, ist die Gruppe längst eingesammelt, `groupRef.deref()` liefert `undefined` und die Callback-Zeile `:124` steigt aus. Die Ausnahme spart eine folgenlose Registrierung, sie verhindert kein Verhalten. Ein Test hätte keinen Gegenstand. **Bleibt ungedeckt — und anders als bei A steht hier auch nichts auf dem Spiel.**
    - **E ist die einzige der fünf mit Nutzerwirkung**, genau wie das Finding sagt, und der `gLinksCount > 0`-Deckel bei `:248` verbirgt sie fast überall: bei Zählerstand 0 bleibt der zweite Abzug wirkungslos. Der Test braucht deshalb lebende Links als Sockel — 50 Stück, gegen 50 zerstörte und fallengelassene. Ohne diesen Sockel ist die Mutation unsichtbar.
  - **TEST-023 unverändert, und der Grund für sein Überleben ist am Nachbarn gemessen.** `src/effects.async.spec.ts:333` (`keeps the cleanup of the outer run when a cleanup re-enters the effect`) baut die Szene aus dem Kommentar bei `src/EffectImpl.ts:469-476` bereits vollständig nach und behauptet in seinem eigenen Kommentar (`:374-379`) exakt die Zusage des Findings — und bleibt unter Mutation F trotzdem grün. Der Grund: dort settlen beide Promises in der Reihenfolge, in der ihre Runs *betreten* wurden. Unter F bekommen beide Runs dieselbe Nummer (der äußere liest `this.#generation` erst *nach* dem verschachtelten Lauf), der innere Cleanup landet zuerst im Slot, der äußere verdrängt ihn — und das Endergebnis ist zufällig dasselbe wie im intakten Code. Sichtbar wird der Unterschied erst, wenn der **innere** Lauf **nach** dem äußeren settelt: dann verdrängt unter F der ältere Cleanup den jüngeren aus dem Slot. Genau diese Umkehrung baut der neue Test, über ein zurückgehaltenes Promise im zweiten Callback-Aufruf.
  - **TEST-024 unverändert; die dritte Empfehlung braucht einen Testzugang, und der ist vorhanden.** `:52-54`, `:110` und `:85` stehen unverändert. Die Empfehlung »nach dem ersten Read `signalImpl(sig).valueFn` auf `undefined` prüfen« ist eins zu eins umsetzbar: `signalImpl` ist ein regulärer Export von `src/signal-core.ts` und `valueFn` steht auf `ISignalImpl` (`src/types.ts:75`) — **kein neuer Export, keine Sichtbarkeitsänderung.** Details unter Vorgehen, Schritt 1.
  - **TEST-025 unverändert, und der Nachbar erklärt, warum M24 überlebt.** `src/SignalGroup.spec.ts:1146` (`detachSignal() reverts to previous signal when detaching non-active signal with same name`) bindet drei Signale unter einen Namen und hängt zwei davon ab — aber in der Reihenfolge, in der am Ende genau **ein** Kandidat übrigbleibt. Bei einem Kandidaten liefern »der zuletzt eingefügte« und »der erste« dasselbe Signal; die Schleife bei `:724-726` ist dort nicht unterscheidbar. Der neue Test hängt zuerst den aktiven ab und lässt **zwei** Kandidaten stehen.
  - **Coverage sieht von TEST-023, TEST-024 und einem Teil von TEST-020 nichts.** `createSignal.ts` steht vor *und* nach diesem Paket auf 100 / 95,74 / 100 / 100, `link.ts` auf 100 / 90 / 100 / 100, `EffectImpl.ts` auf 98,11 / 96,07 / 96,66 / 99 — ziffergleich. Bewegen tut sich allein `SignalGroup.ts` (97 → siehe Verify). Drei der vier Findings sind also ungeprüfte *Zusagen*, keine ungedeckten Zeilen; das Abnahmekriterium ist die Mutationsprobe und nicht die Deckungszahl. Dritter Beleg in Folge nach Paket 8 und 9.
  - **Das Werkzeug nickt nicht bloß ab.** Kontrollmutation `off(this)` aus `SignalLink#destroy()` (`src/SignalLink.ts:421`) entfernt → sofort 1 roter Test mit inhaltlicher Meldung (`off(this) released the remaining listeners: expected 2 to be +0`). Die Kopie sieht Quelländerungen.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/ vitest.config.ts` ist leer. Kein `git`-Schreibbefehl war beteiligt.
- Vorgehen: acht neue Tests, sechs Dateien, plus eine Zeile in `vitest.config.ts`. Der Wortlaut unten ist der gemessene — er compiliert (`tsc --noEmit -p tsconfig.json`, 0 Fehler), läuft unverändert durch Biome (`biome check`, keine Korrektur) und ist grün.
  1. **Zugänge klären, bevor irgendetwas geschrieben wird — alles ist schon da, kein Symbol wird neu exportiert.**
     - `signalImpl` ist ein regulärer Export von `src/signal-core.ts`; `valueFn: () => Type \| undefined` steht auf dem Interface `ISignalImpl` (`src/types.ts:75`), also compiliert `signalImpl(sig).valueFn` ohne Cast. `src/SignalGroup.teardown.spec.ts:22` importiert `signalImpl` bereits; `src/createSignal.lazy.spec.ts` bekommt dafür eine Importzeile. `stripInternal` aus Paket 5 ist hier gegenstandslos: es wirkt beim Emit der `.d.ts` im Publish-Pass, und die Specs compilieren gegen `src/`, nicht gegen `lib/` (in Paket 9 belegt).
     - `clearGroupFromFinalizer` ist ein regulärer Export von `src/SignalGroup.ts:98`, im JSDoc als »@internal Exported for the regression test in `SignalGroup.teardown.spec.ts`« geführt, und **genau diese Datei importiert ihn bereits** (`:18`). Der neue Test ist der dritte, der diesen Seam benutzt.
     - `getSubscriptionCount` kommt direkt aus `@spearwolf/eventize`, `globalSignalQueue` aus `src/global-queues.js` — beides neu in `src/createSignal.destroySignal.spec.ts`, Referenz für das Muster ist `src/unsubscribeEffect.spec.ts:1`.
     - **Zwei neue Importzeilen insgesamt, kein neuer Export, keine Sichtbarkeitsänderung.** Die Halte-Bedingung des Pakets tritt nicht ein.
  2. **Keine neue Datei, und das Paket wird nicht in GC gegen Nicht-GC geteilt.** Begründung unter »Planänderung«. Folge für den Schwellen-Glob-Check aus Paket 3: nichts zu tun — er matcht gegen die Dateimenge, aus der `coverageExclude` alle `src/**/*.spec.ts` bereits herausnimmt.
  3. **`src/effects.async.spec.ts`** (TEST-023) — hinter `keeps the cleanup of the outer run when a cleanup re-enters the effect`. Wortlaut:

     ```ts
     it('a cleanup that settles after the run it was superseded by does not take the slot (TEST-023)', async () => {
       // The sibling above pins the *sequence*, this one the *numbering*. Move
       // the `++this.#generation` from just before the callback to the top of
       // `run()` and the sibling stays green: with both promises settling in
       // the order their runs were entered, the slot ends up holding the same
       // cleanup either way. It only comes apart when the inner run settles
       // *after* the outer one — then the bump at the top hands both runs the
       // same number, the older cleanup passes the identity check and
       // displaces the newer one out of the slot.
       const log: string[] = [];
       const {get: a, set: setA} = createSignal(0);

       let runSeq = 0;
       let releaseInner!: () => void;
       const innerSettles = new Promise<void>((resolve) => {
         releaseInner = resolve;
       });

       const effect = createEffect(async () => {
         const seq = ++runSeq;
         a();
         log.push(`run:${seq}`);
         // Run 2 is the nested one, entered from the cleanup of run 1. Held
         // back until run 3 — the outer run — has already stored its cleanup.
         if (seq === 2) await innerSettles;
         return () => {
           log.push(`cleanup:${seq}`);
           if (seq === 1) setA(99);
         };
       });

       try {
         await flush();

         setA(1);

         expect(log, 'the cleanup of run 1 re-entered the effect').toEqual([
           'run:1',
           'cleanup:1',
           'run:2',
           'run:3',
         ]);

         await flush();

         expect(log, 'only the outer run has settled so far').toEqual([
           'run:1',
           'cleanup:1',
           'run:2',
           'run:3',
         ]);

         releaseInner();
         await flush();

         // The inner run is the older one: its cleanup is stale on arrival and
         // runs on the spot instead of pushing the current one out of the slot.
         expect(
           log.at(-1),
           'the late cleanup of the inner run ran orphaned',
         ).toBe('cleanup:2');

         effect.destroy();

         expect(log, 'the slot held the cleanup of the outer run').toEqual([
           'run:1',
           'cleanup:1',
           'run:2',
           'run:3',
           'cleanup:2',
           'cleanup:3',
         ]);
       } finally {
         // Before the teardown: a failed assertion above must not leave the
         // effect callback of run 2 awaiting a promise nobody resolves.
         releaseInner();
         effect.destroy();
         destroySignal(a);
       }
     });
     ```

     Vier Dinge, die nicht Geschmack sind:
     - **Das `if (seq === 2)` ist der ganze Test.** Ohne das zurückgehaltene Promise ist das hier eine Verdopplung des Nachbarn und unter Mutation F grün — gemessen. Der zweite Callback-Aufruf ist der verschachtelte Lauf, den der Cleanup von Lauf 1 betritt; er muss als letzter settlen.
     - **Warum die mittlere `toEqual`-Assertion nicht redundant ist.** Sie hält fest, dass nach dem ersten `flush()` **noch kein** Cleanup gelaufen ist — ohne sie wäre die Endsequenz auch dann erreichbar, wenn der äußere Cleanup sofort verworfen worden wäre.
     - **Warum die Endsequenz und nicht nur `log.at(-1)`.** Unter F ist der Inhalt derselbe und nur die Reihenfolge kippt (`cleanup:3`, `cleanup:2` statt `cleanup:2`, `cleanup:3`). Ein `toContain` würde das nicht sehen; die vorgezogene `log.at(-1)`-Assertion mit Satz fängt die Umkehrung an ihrer schärfsten Stelle und gibt die lesbare Meldung.
     - **Warum `releaseInner()` als erstes im `finally` steht.** Bricht eine Assertion vorher ab, wartet der Callback von Lauf 2 sonst für den Rest des Prozesses auf ein Promise, das niemand mehr auflöst. Gemessen: das Q5-Phänomen aus Paket 7a (`Errors 1 error`, dem nächsten Testnamen zugeschrieben) tritt hier **mit und ohne** diese Zeile nicht auf — ein geparktes Promise ist kein verworfenes. Die Zeile bleibt trotzdem, sie kostet nichts und ist die ehrliche Form.
  4. **`src/createSignal.destroySignal.spec.ts`** (TEST-024, erster Zweig) — ans Ende des äußeren `describe`, vor der verschachtelten `describe`. Zwei neue Importe (siehe Schritt 1). Wortlaut:

     ```ts
     it('a destroyed signal does not report its reads to the running effect', () => {
       // The other half of the `destroySignal()` promise. The write half — a
       // destroyed signal notifies nobody — is covered above; this is the read
       // half: an effect that reads a corpse must not subscribe to its id.
       // Without the guard the effect carries a dependency on a signal that can
       // never fire again, for as long as the effect lives.
       const alive = createSignal(1);
       const dead = createSignal(2);

       destroySignal(dead);

       const subscriptionsBefore = getSubscriptionCount(globalSignalQueue);

       const effect = createEffect(() => {
         alive.get();
         dead.get();
       });

       try {
         expect(
           getSubscriptionCount(globalSignalQueue) - subscriptionsBefore,
           'the effect subscribed to the live signal and to nothing else',
         ).toBe(1);
       } finally {
         effect.destroy();
         destroySignal(alive);
       }
     });
     ```

     Warum zwei Signale und nicht nur das tote: `EffectImpl#whenSignalIsRead()` legt genau ein `on(globalSignalQueue, signalId, …)` je Abhängigkeit an (`src/EffectImpl.ts:634`), und der Effect selbst abonniert auf *anderen* Queues. Die Differenz ist damit exakt die Zahl der Abhängigkeiten. Das lebende Signal ist die Gegenprobe: es beweist, dass der Mechanismus überhaupt zählt, statt nur nichts zu finden — gemessen 1 intakt, **2** unter Mutation G.
  5. **`src/createSignal.lazy.spec.ts`** (TEST-024, zweiter und dritter Zweig) — beide ans Dateiende, plus die `signalImpl`-Importzeile. Wortlaut:

     ```ts
     it('set(undefined) replaces the factory of a lazy signal that was never read (TEST-024)', () => {
       // `lazy !== this.lazy` is the only clause of the writer condition that
       // sees this write: the new value is `undefined` and so is `#value` on an
       // unread lazy signal, so the value comparison in the third clause says
       // "no change" and the factory would stay in place — the write would be
       // swallowed and the next read would hand out `'foo'` instead of
       // `undefined`.
       const lazyFn = vi.fn(() => 'foo');
       const sig = createSignal<string | undefined>(lazyFn, {lazy: true});

       try {
         sig.set(undefined);

         expect(sig.get(), 'the write went through').toBeUndefined();
         expect(
           lazyFn,
           'the factory was dropped unevaluated',
         ).not.toHaveBeenCalled();
       } finally {
         sig.destroy();
       }
     });

     it('the first read releases the factory function (TEST-024)', () => {
       // A lazy factory is a closure over whatever the caller had in scope. It
       // is needed exactly once; keeping it after that pins everything it
       // captured for the lifetime of the signal, and nothing in the public
       // surface would ever show it.
       const captured = {payload: 'held by the factory closure'};
       const sig = createSignal(() => captured.payload, {lazy: true});

       try {
         expect(
           signalImpl(sig).valueFn,
           'the factory is held until the first read',
         ).toBeTypeOf('function');

         expect(sig.get()).toBe('held by the factory closure');

         expect(
           signalImpl(sig).valueFn,
           'and released with it — the closure is not kept for a second call',
         ).toBeUndefined();
       } finally {
         sig.destroy();
       }
     });
     ```

     Drei begründete Entscheidungen:
     - **Das Signal muss ungelesen sein**, sonst ist `this.lazy` bereits `false` und die erste Klausel wird gar nicht befragt. Deshalb steht zwischen `createSignal` und `set(undefined)` kein Read — und `lazyFn` darf am Ende **nie** gerufen worden sein.
     - **Der explizite Typparameter `<string | undefined>`** ist kein Zierrat: ohne ihn leitet TypeScript `string` her und `set(undefined)` compiliert nicht. Der Test prüft eine Laufzeitzusage, nicht die Typfläche.
     - **Warum die Feldassertion und kein `WeakRef`-Test.** Ein GC-Test auf »die Closure ist einsammelbar« kann nur *positiv* nichtdeterministisch antworten; die Feldassertion ist deterministisch, prüft dieselbe Zusage und ist genau die Empfehlung des Findings. Beide Reads von `signalImpl(sig).valueFn` gehören dazu: der erste beweist, dass die Fabrik überhaupt dort gehalten wird, der zweite, dass sie geht.
     - **`sig.destroy()` im `finally`, obwohl die Nachbarn dieser Datei nichts abräumen.** Regel (b) aus Paket 7a. Die Datei trägt heute keinen einzigen Zählerwächter — die vier vorhandenen Tests lassen je ein Signal stehen (gemessen, siehe Paket 32). Die beiden neuen kommen wächtertauglich an.
  6. **`src/SignalGroup.spec.ts`** (TEST-025) — direkt hinter `detachSignal() reverts to previous signal …`. Wortlaut:

     ```ts
     it('detachSignal() hands the name to the most recently bound candidate, not the first (TEST-025)', () => {
       // The neighbour above stops one candidate short: after its two
       // detaches exactly one signal is left under the name, and "the last
       // one" and "the first one" are then the same signal. With two
       // candidates left the rule becomes visible — and it is the rule that
       // decides what `group.signal(name)` returns after a detach.
       const group = SignalGroup.findOrCreate({});
       const first = createSignal(1);
       const second = createSignal(2);
       const active = createSignal(3);

       try {
         // Explicitly attached, so the rebind does not destroy them and they
         // stay fallback candidates (MEM-003).
         group.attachSignal(first);
         group.attachSignal(second);

         group.attachSignalByName('slot', first);
         group.attachSignalByName('slot', second);
         group.attachSignalByName('slot', active);

         expect(group.signal('slot')).toBe(active);

         group.detachSignal(active);

         expect(
           group.signal('slot'),
           'the youngest remaining candidate takes the slot',
         ).toBe(second);

         group.detachSignal(second);

         expect(group.signal('slot'), 'and the next one after that').toBe(first);
       } finally {
         first.destroy();
         second.destroy();
         active.destroy();
         group.clear();
       }
     });
     ```

     Warum `attachSignal()` **und** `attachSignalByName()` für die ersten beiden: ein Rebind zerstört das verdrängte Signal, sofern die Gruppe es nicht direkt besitzt (`#displaceFromName`, `src/SignalGroup.ts:574-577`). Ohne den expliziten Anhang wären `first` und `second` beim dritten Bind tot und stünden gar nicht mehr als Kandidaten zur Verfügung. `active` bleibt bewusst ohne — es ist der Kandidat, der abgehängt wird. Die dritte Assertion ist keine Verdopplung: sie zeigt, dass die Regel eine Kette ist und nicht ein Sonderfall des ersten Abhängens.
  7. **`src/SignalGroup.teardown.spec.ts`, `src/link.gc.spec.ts`, `src/SignalGroup.gc.spec.ts`** (TEST-020) — die drei testbaren der fünf Stellen. Wortlaut, in dieser Reihenfolge:

     ```ts
     it('the backstop leaves a group alone that is no longer registered (TEST-020)', () => {
       // The counterpart to the test above: there the group is still filed in
       // the registry and the backstop has to reach it. Here it was cleared
       // explicitly first, and the membership check is all that keeps a
       // finalizer job that was already queued from running a second teardown
       // over it. `clear()` unregisters from both FinalizationRegistries, so
       // the only way to reach this code path at all is the direct call the
       // seam exists for.
       const host = {};
       const group = SignalGroup.findOrCreate(host);
       createSignal(0, {attach: host});

       let destroyEmits = 0;

       try {
         group.clear();

         // After the explicit teardown — `clear()` runs `off(this)`, so a
         // listener from before would not be heard either way and would prove
         // nothing.
         on(group, DESTROY, () => {
           destroyEmits += 1;
         });

         clearGroupFromFinalizer(group);

         expect(
           destroyEmits,
           'a group that already left the registry is not torn down twice',
         ).toBe(0);
       } finally {
         // The second `clear()` is the idempotent belt: it emits `DESTROY` once
         // more, after the assertion, and takes the listener off with it.
         group.clear();
       }
     });
     ```

     ```ts
     it('a destroyed link is not counted down a second time when it is collected (TEST-020)', async () => {
       // `destroy()` decrements `gLinksCount` and unregisters the link from
       // `gLinkFinalizer` in the same breath. Without the unregister the
       // finalizer fires later — the link is unreachable by then — and
       // decrements a second time for the same link, so `getLinksCount()`
       // undercounts every link that is still alive. The `gLinksCount > 0`
       // clamp hides this whenever the count is already 0, which is why the
       // survivors below are load-bearing.
       const SURVIVOR_COUNT = 50;
       const CORPSE_COUNT = 50;

       const survivorSource = createSignal(0);
       const corpseRefs: WeakRef<object>[] = [];

       try {
         for (let i = 0; i < SURVIVOR_COUNT; i += 1) {
           link(survivorSource, () => {});
         }

         (() => {
           for (let i = 0; i < CORPSE_COUNT; i += 1) {
             const source = createSignal(i);
             const corpse = link(source, () => {});
             corpse.destroy();
             corpseRefs.push(new WeakRef(corpse));
           }
         })();

         expect(getLinksCount(), 'the corpses are already counted out').toBe(
           SURVIVOR_COUNT,
         );

         for (
           let i = 0;
           i < 20 && corpseRefs.some((ref) => ref.deref() !== undefined);
           i += 1
         ) {
           await forceGc();
         }

         // The witness: without a collected corpse the assertion below would
         // hold for the trivial reason that nothing ran at all.
         expect(
           corpseRefs.filter((ref) => ref.deref() !== undefined).length,
           'every destroyed link really was collected',
         ).toBe(0);

         // One more round, so a finalizer job that was queued in the sweep
         // above has had every chance to run before the count is read.
         await forceGc();

         expect(getLinksCount(), 'the live links are still all counted').toBe(
           SURVIVOR_COUNT,
         );
       } finally {
         unlink(survivorSource);
         destroySignal(survivorSource);
       }
     });
     ```

     ```ts
     it('getSignalGroupsCount() drops the husk of a collected group on the way past', async () => {
       // The resource finalizer takes the dead WeakRef out of `allGroups` too,
       // but it runs in a job of its own: a FinalizationRegistry callback is
       // never invoked synchronously from `gc()`. So the moment right after the
       // collection — with no `await` in between — is the one window in which
       // the husk is provably still in the set, and therefore the only one in
       // which the sweep inside the counter is the thing being measured.
       const baselineGroups = getSignalGroupsCount();
       let groupRef!: WeakRef<SignalGroup>;

       (() => {
         const host = {marker: 'husk-sweep'};
         groupRef = new WeakRef(SignalGroup.findOrCreate(host));
       })();

       let countAtCollection: number | undefined;

       try {
         expect(getSignalGroupsCount()).toBe(baselineGroups + 1);

         for (let i = 0; i < 20; i += 1) {
           gc();
           if (groupRef.deref() === undefined) {
             countAtCollection = getSignalGroupsCount();
             break;
           }
           await new Promise((resolve) => setImmediate(resolve));
         }

         expect(
           countAtCollection,
           'the group was never collected — the measurement never happened',
         ).not.toBeUndefined();

         expect(
           countAtCollection,
           'the husk is not counted, even before its finalizer has run',
         ).toBe(baselineGroups);
       } finally {
         // The host lives and dies inside the IIFE, so a group that was *not*
         // collected has no handle left but the static sweep.
         SignalGroup.clear();
       }
     });
     ```

     **Was diese drei deterministisch macht — vier Punkte, jeder gemessen.** Sie sind der Grund, warum die Modellstufe unten eine Auflage trägt:
     - **Der Backstop-Test braucht gar keine GC.** `clearGroupFromFinalizer()` ist exportiert; der Test ruft die Stelle direkt auf, die im Betrieb ein Finalizer-Job ruft. Er steht deshalb in der Nicht-GC-Datei und ist so deterministisch wie jeder andere Unit-Test.
     - **Der Husk-Test steht auf einer Spezifikationszusage, nicht auf Hoffnung.** Ein `FinalizationRegistry`-Callback läuft nie synchron aus `gc()`, sondern in einem eigenen Job. Zwischen `gc()` und dem Ablesen von `getSignalGroupsCount()` steht deshalb **kein `await`** — genau dort ist die Hülle nachweislich noch in `allGroups` und der Sweep im Zähler ist das einzige, was sie herausnimmt. Die Schleife wiederholt nur den Versuch, *einzusammeln*; die Messung selbst ist einmalig und eingerahmt. Bleibt das Einsammeln aus, ist `countAtCollection` `undefined` und die erste Assertion sagt das mit Satz, statt die zweite zufällig grün zu melden.
     - **Der Link-Test beweist erst, dass etwas passiert ist, und behauptet dann, was nicht passiert ist.** Eine negative GC-Assertion ohne Zeugen ist wertlos: »der Zähler steht noch bei 50« gilt auch, wenn gar nichts eingesammelt wurde. Die `WeakRef`-Liste über alle 50 Leichen ist dieser Zeuge (dasselbe Muster wie `hostRefs.filter(…)` in `a host whose only back-reference is a signal value is reclaimed (MEM-003)`, `src/SignalGroup.gc.spec.ts:315`). Und die Richtung ist die freundliche: intakt kann der Zähler gar nicht fallen, unter der Mutation genügt **eine** eingesammelte Leiche für Rot — gemessen fallen alle 50, der Zähler geht auf 0.
     - **Alle drei sind wiederholt gemessen.** Siehe Verify, Schritt 4: 10 × `npx vitest run` und 3 × `pnpm test:gc` grün, je 5 × rot unter ihrer Mutation, plus je einmal rot unter `test:gc`.
  8. **Nebenbefund aus Paket 8 und aus Paket 3 abarbeiten: `bequiet` fällt aus beiden Schwellenlisten.** In `vitest.config.ts` zwei Stellen, eine Zeile Wirkung:

     ```ts
     'src/**/!(EffectImpl|SignalGroup|SignalLink|SignalAutoMap|collect-errors|createSignal|link|signal-core).ts':
       {statements: 100, branches: 100, functions: 100, lines: 100},
     'src/{SignalLink,SignalAutoMap,collect-errors}.ts': {
     ```

     Dazu der Kommentarblock darüber: »Tier 3 covers the **four** files« wird »the **three** files«. Damit steht `src/bequiet.ts` unter Stufe 2 und muss 100/100/100/100 halten — es misst das seit Paket 8 und hat als einzige der vier Tier-3-Dateien **kein** verbleibendes Paket, das sie anfasst. Gemessen: mit der Änderung läuft `npx vitest run --coverage` unverändert grün; die Kontrollprobe (eine ungetestete Funktion in `src/bequiet.ts`) liefert sofort `Coverage for branches (0%) does not meet "src/**/!(…)" threshold (100%) for src/bequiet.ts` — die Regel greift wirklich.
     **Die anderen acht Namen bleiben, und zwar begründet:** `SignalLink.ts` steht in Paket 11, 13, 20 und 23 im Bereich, `SignalAutoMap.ts` in Paket 21, `collect-errors.ts` in Paket 13 und 18 — die zwei Branch-Punkte Schlupf aus Stufe 3 sind für genau diese Pakete gedacht und keine Altlast. `EffectImpl.ts`, `SignalGroup.ts`, `createSignal.ts`, `link.ts` und `signal-core.ts` liegen ohnehin unter 100.
  9. **`pnpm check` gehört gefahren, `pnpm fix` ist nicht nötig.** Biome hat den Wortlaut oben unverändert durchgelassen (`biome check src/`, keine Korrektur); wer ihn umformuliert, formatiert nach und misst neu.
  10. **CHANGELOG:** eine Zeile unter `### Tests` in `## Unreleased`, im Ton der Zeilen aus Paket 8 und 9 — etwa: `` the finalizer bookkeeping around a collected link and group, the point at which an effect bumps its generation counter, the destroyed-read and unread-lazy branches of `createSignal()` and the name fallback in `SignalGroup#detachSignal()` are pinned: each now fails exactly one test instead of passing silently (TEST-020, TEST-023, TEST-024, TEST-025) ``. Keine Doku-Synchronisation: die öffentliche API ändert sich nicht, `AGENTS.md` bleibt unangetastet.
- Verify: vier Teile. Der erste zeigt, dass nichts kaputt ist; der zweite ist der eigentliche Beweis; der dritte hält den Standard aus 7c/8/9; der vierte ist die Mehrfachmessung, ohne die die zwei GC-Tests nicht abgenommen sind. Alle Erwartungswerte am 2026-08-10 auf einer HEAD-Kopie mit genau diesen acht Tests gemessen.
  1. `pnpm world`. Erwartet: neun Schritte grün, **44 Dateien / 496 Tests** in `test` und `test:gc` (488 + 8), Coverage **99,28 / 94,92 / 99,51 / 99,43** (vorher 99,10 / 94,50 / 99,51 / 99,34). Bewegen darf sich allein `SignalGroup.ts`: 98,08 → **98,72** Statements, 89,23 → **90,76** Branches, 98,32 → **98,66** Lines, Functions unverändert 100. `EffectImpl.ts` (98,11 / 96,07 / 96,66 / 99), `createSignal.ts` (100 / 95,74 / 100 / 100), `link.ts` (100 / 90 / 100 / 100) und `signal-core.ts` (100 / 85,71 / 100 / 100) stehen vorher wie nachher ziffergleich. Bewegt sich eine davon, ist etwas anderes passiert als dieses Paket.
  2. **Die zehn Mutationsproben.** Jede einzeln, auf einer Kopie, nicht im Arbeitsbaum. Die Erwartung ist nicht »ein Test wird rot«, sondern »**genau dieser** Test wird rot, an **dieser** Meldung«:

     | # | Eingriff | ohne die neuen Tests | mit ihnen | fällt an |
     | --- | --- | ---: | --- | --- |
     | **A** | Hüllen-`delete` (`SignalGroup.ts:75-77`) | 488 passed, 0 rot | **496 passed, 0 rot** | *nicht testbar — erwarteter Überlebender, siehe Abgleich* |
     | **B** | Mitgliedschaftsprüfung (`:103`) | 488 passed, 0 rot | **1 failed \| 495 passed** | `the backstop leaves a group alone …` → `a group that already left the registry is not torn down twice: expected 1 to be +0` |
     | **C** | Husk-Sweep (`:136-144`) | 488 passed, 0 rot | **1 failed \| 495 passed** | `getSignalGroupsCount() drops the husk …` → `the husk is not counted, even before its finalizer has run: expected 1 to be +0` |
     | **D** | Ausnahme für selbstgeschlüsselte Gruppen (`:370-372`) | 488 passed, 0 rot | **496 passed, 0 rot** | *nicht testbar — erwarteter Überlebender, siehe Abgleich* |
     | **E** | `gLinkFinalizer.unregister()` (`link.ts:247`) | 488 passed, 0 rot | **1 failed \| 495 passed** | `a destroyed link is not counted down a second time …` → `the live links are still all counted: expected +0 to be 50` |
     | **F** | `#generation`-Bump an den Anfang von `run()` | 488 passed, 0 rot | **1 failed \| 495 passed** | `a cleanup that settles after the run it was superseded by …` → `the late cleanup of the inner run ran orphaned: expected 'cleanup:3' to be 'cleanup:2'` |
     | **G** | `} else if (!signal.destroyed) {` → `} else {` | 488 passed, 0 rot | **1 failed \| 495 passed** | `a destroyed signal does not report its reads …` → `the effect subscribed to the live signal and to nothing else: expected 2 to be 1` |
     | **H** | `lazy !== this.lazy \|\|` gestrichen | 488 passed, 0 rot | **1 failed \| 495 passed** | `set(undefined) replaces the factory …` → `the write went through: expected 'foo' to be undefined` |
     | **I** | `this.valueFn = undefined;` (`:85`) gestrichen | 488 passed, 0 rot | **1 failed \| 495 passed** | `the first read releases the factory function …` → `and released with it …: expected [Function] to be undefined` |
     | **J** | Namens-Fallback → erster Kandidat | 488 passed, 0 rot | **1 failed \| 495 passed** | `detachSignal() hands the name to the most recently bound candidate …` → `the youngest remaining candidate takes the slot` |

     **A und D sind Pflichtmessungen, keine Auslassung.** Sie müssen 496 grün melden — meldet eine von beiden rot, hat der Implementierer einen Test gebaut, der etwas anderes prüft als geplant, und das gehört aufgeklärt, nicht gefeiert. Bei den acht anderen: kein einziger Kollateralschaden, die rote Zeile ist ausschließlich der neue Test, und er fällt an seiner Rumpfassertion, nicht an einem `afterEach`-Wächter. Nach jeder Probe: Rückbau aus der Sicherung, `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/` ist leer.
  3. **Das Meldungs-Tor über die acht neuen Tests** — Radius und Meldung, wie in 7c, 8 und 9: vor jeder Anweisung innerhalb des `try`-Blocks ein `expect(1, 'SEEDED').toBe(2);` säen, die Datei laufen lassen, rote Tests zählen und prüfen, dass `SEEDED` in der Ausgabe steht (Vitest schreibt die Meldung nach **stderr**). Gemessen, je Saatpunkte / größter Radius / Übeltäter / maskiert / Radius 0:

     | Test | Ergebnis |
     | --- | --- |
     | `effects.async.spec.ts` · `a cleanup that settles after the run …` | **10 / 1 / 0 / 0 / 0** |
     | `createSignal.destroySignal.spec.ts` · `a destroyed signal does not report its reads …` | **1 / 1 / 0 / 0 / 0** |
     | `createSignal.lazy.spec.ts` · `set(undefined) replaces the factory …` | **3 / 1 / 0 / 0 / 0** |
     | `createSignal.lazy.spec.ts` · `the first read releases the factory function` | **3 / 1 / 0 / 0 / 0** |
     | `SignalGroup.spec.ts` · `detachSignal() hands the name …` | **10 / 1 / 0 / 0 / 0** |
     | `SignalGroup.teardown.spec.ts` · `the backstop leaves a group alone …` | **4 / 1 / 0 / 0 / 0** |
     | `link.gc.spec.ts` · `a destroyed link is not counted down a second time …` | **7 / 1 / 0 / 0 / 0** |
     | `SignalGroup.gc.spec.ts` · `getSignalGroupsCount() drops the husk …` | **4 / 1 / 0 / 0 / 0** |

     Werkzeug: `$S/p10/gate10.py <spec> "<testname>"`. Eine Warnung an den, der es nachbaut: Fortsetzungszeilen mehrzeiliger `expect(…)`-Aufrufe (`]);`, `);`, `}`) sind keine Saatpunkte — wer dort sät, erzeugt einen Syntaxfehler, die Datei lädt nicht, und das Tor meldet »Radius 0« statt eines Fehlers.
  4. **Die Mehrfachmessung für die zwei GC-Tests.** Ohne sie ist das Paket nicht abgenommen; ein GC-Test, der einmal grün war, hat nichts bewiesen. Gemessen am 2026-08-10 auf der Kopie mit allen acht Tests:
     - **10 × `npx vitest run`** (beide Projekte, `gc` inklusive) — 10 × `496 passed`, kein Flackern.
     - **3 × `pnpm test:gc`** (seriell, `--expose-gc` über die ganze Suite, anderer Pool-Zuschnitt) — 3 × `496 passed`.
     - **5 × Mutation C** → 5 × `1 failed | 495 passed`, jedes Mal dieselbe Meldung. **5 × Mutation E** → dasselbe.
     - Beide Mutationen zusätzlich **je einmal unter `pnpm test:gc`** → je `1 failed | 495 passed`, derselbe Test.
     Wer eine andere Zahl misst, hat einen der beiden Tests umformuliert — siehe die Auflage bei »Modell«.
- Commit: `test: pin the finalizer bookkeeping, the generation bump, the createSignal branches and the name fallback (TEST-020, TEST-023, TEST-024, TEST-025)`

<details>
<summary>TEST-020, TEST-023, TEST-024 und TEST-025 im Volltext (aus <code>audit.html</code>)</summary>

**TEST-020 — Die ungetestete Hälfte der Finalizer-Buchhaltung schließen**
Severity: medium · Kategorie: Testabdeckung & Teststrategie · Domain: harness · Effort: M
Location: `src/SignalGroup.ts:76` · `src/SignalGroup.ts:103` · `src/SignalGroup.ts:138-142` · `src/link.ts:247`

> Die GC-Suite läuft im Standardlauf mit, prüft aber die Buchhaltung um die Finalizer herum nicht. Fünf Stellen überleben ihre Entfernung: der Hüllen-`delete` im Ressourcen-Finalizer samt seiner »Order is load-bearing«-Begründung, die Mitgliedschaftsprüfung, der Husk-Sweep in `getSignalGroupsCount()`, die Ausnahme für selbstgeschlüsselte Gruppen und `gLinkFinalizer.unregister()`. Letzteres ist das einzige mit direkter Nutzerwirkung: ein zerstörter und danach eingesammelter Link zieht `getLinksCount()` ein zweites Mal herunter.

> Empfehlung: In `link.gc.spec.ts` einen Test, der einen Link zerstört, ihn fallenlässt, `gc()` treibt und `getLinksCount()` gegen die Baseline prüft; in `SignalGroup.gc.spec.ts` einen, der `getSignalGroupsCount()` unmittelbar nach dem Einsammeln liest.

> Evidence: M20, M21, M75, M76, M78, M79, M06 — alle SURVIVED bei 478 passed.

**TEST-023 — Festnageln, wo der Generationszähler des Effects hochgezählt wird**
Severity: medium · Kategorie: Testabdeckung & Teststrategie · Domain: harness · Effort: S
Location: `src/EffectImpl.ts:469-476`

> Ein achtzeiliger Kommentar erklärt, warum `#generation` unmittelbar vor dem Callback hochgezählt wird und nicht am Anfang von `run()`: nur so bekommt ein äußerer Lauf, dessen Cleanup `run()` rekursiv betreten hat, die höhere Nummer, gegen die sein später einlaufendes Promise verglichen wird. Verschiebt man den Bump an den Anfang, bleibt die Suite grün — obwohl das exakt der Mechanismus ist, den `acceptCleanupCallback()` schützt.

> Empfehlung: Ein Test mit einem Cleanup, der ein Signal schreibt, von dem der Effect abhängt, und einem `async` Callback, dessen Cleanup nach dem verschachtelten Lauf einläuft — prüfen, dass genau der jüngere Cleanup im Slot landet.

> Evidence: M63 (`const generation = ++this.#generation;` → `= this.#generation;`, Bump verschoben): SURVIVED bei 478 passed.

**TEST-024 — Die Destroyed- und Lazy-Pfade von createSignal abdecken**
Severity: medium · Kategorie: Testabdeckung & Teststrategie · Domain: harness · Effort: S
Location: `src/createSignal.ts:52-54` · `src/createSignal.ts:110` · `src/createSignal.ts:85`

> Drei Zweige der Signal-Kernlogik sind ungeprüft. Erstens meldet ein zerstörtes Signal seine Reads nicht mehr an den laufenden Effect — das ist die halbe Zusage aus dem `destroySignal()`-JSDoc, und nur die Write-Hälfte ist getestet. Zweitens ist die erste Klausel der Writer-Bedingung, `lazy !== this.lazy`, überflüssig machbar. Drittens darf die Fabrikfunktion nach dem ersten lazy Read stehenbleiben, ohne dass jemand es merkt — sie hält beliebig viel Speicher fest.

> Empfehlung: Je ein Test: Effect über ein zerstörtes Signal laufen lassen und `getSubscriptionCount` prüfen; `set(undefined)` auf ein lazy Signal; nach dem ersten Read `signalImpl(sig).valueFn` auf `undefined` prüfen.

> Evidence: M80, M35, M83 — alle SURVIVED bei 478 passed.

**TEST-025 — Den Namens-Fallback in #removeSignal() testen**
Severity: medium · Kategorie: Testabdeckung & Teststrategie · Domain: harness · Effort: S
Location: `src/SignalGroup.ts:720-727`

> Verliert ein Name sein aktives Signal, während weitere Kandidaten unter demselben Namen stehen, soll laut Kommentar der zuletzt eingefügte einspringen (»Set preserves insertion order«). Ersetzt man die Schleife durch den *ersten* Kandidaten, bleibt alles grün. Die Regel entscheidet, welches Signal ein `group.signal(name)` nach einem `detachSignal()` zurückgibt — sichtbares Verhalten, unbelegt.

> Evidence: M24 (`for (const s of otherSignals) previous = s;` → `otherSignals.values().next().value`): SURVIVED.

</details>

- Planänderung (2026-08-10): **eine.** Der geparkte Nebenbefund aus Paket 7a (uneinheitliche Zählerwächter) wird aus diesem Paket herausgeschnitten und bekommt eine eigene Nummer — **Paket 32**, direkt unten. Alles andere bleibt: Reihenfolge, Abhängigkeiten, die vier Findings, die Nummer 10.
  - **Nicht in GC gegen Nicht-GC geteilt, und zwar gemessen.** Der Schnitt lag nahe — vier Findings in vier Ecken, zwei Tests in GC-Suiten —, trägt aber nicht: **+340 Zeilen in sechs Dateien**, acht Tests, jeder Wortlaut ausgeschrieben und grün gemessen, jede der zehn Mutationen mit Erwartungswert und Fehlermeldung. Das ist die Größenordnung von Paket 9 (sieben Tests, +230 Zeilen, eine Runde, keine Befunde) und weit unter der von 7c (129 Tests, 1517 Zeilen), wo der Schnitt fiel. Der riskante Teil sind zwei Tests, und ihre Determinismus-Frage ist mit 10 + 3 grünen und 2 × 5 roten Läufen bereits beantwortet — ein eigenes Paket dafür kostete eine volle zusätzliche Review-Runde für 106 Zeilen.
  - **Zwei der fünf TEST-020-Stellen sind als nicht testbar gestrichen** (A: der Hüllen-`delete`; D: die Ausnahme für selbstgeschlüsselte Gruppen), beide mit Fundstelle und Messung im Abgleich, beide als Pflicht-Überlebende in der Verify-Tabelle. Das Finding bleibt damit **teilweise erfüllt**, und zwar an der Stelle, die es selbst als die einzige mit Nutzerwirkung bezeichnet — die drei gedeckten sind `:103`, `:136-144` und `link.ts:247`. Notiz dazu in Paket 19.
  - **Der zweite Nebenbefund aus Paket 7a ist gegenstandslos und wird gestrichen.** Die Anmerkung oben sagt, `off(this)` in `SignalLink#destroy()` (`src/SignalLink.ts:421`) sei ungedeckt. Am 2026-08-10 nachgemessen: die Zeile entfernt → **1 roter Test**, `src/SignalLink.spec.ts` · `a throwing DESTROY listener does not leave the link half torn down`, und er fällt an einer inhaltlichen Assertion mit genau diesem Wortlaut: `off(this) released the remaining listeners: expected 2 to be +0` (`:844-846`). Die Assertion stammt aus `e9904d0` — also aus Paket 7a selbst, wo der Reviewer den Befund im selben Commit geschlossen hat. Die Notiz hat den Fix nur nicht mitbekommen.
  - **Der Nebenbefund aus Paket 8 ist erledigt** (Schritt 8): `bequiet` fällt aus beiden Schwellenlisten. Die vom 7c-Planer erhoffte Schrumpfung der neunstelligen Ausschlussliste beträgt gemessen **genau einen Namen** — die anderen drei Tier-3-Dateien stehen alle noch im Bereich verbleibender Pakete, ihr Branch-Schlupf ist Absicht.
  - **Die `Bereich`-Zeile oben ist überholt und wird von der Dateitabelle abgelöst.** Sie nennt `src/EffectImpl.*.spec.ts` und `src/createSignal.spec.ts`; gemessen liegen die Tests woanders. Für TEST-023 ist `src/effects.async.spec.ts` die richtige Datei, nicht `EffectImpl.run.spec.ts` — der Unterschied zwischen Bump-Ort und Bump-Wirkung wird nur über ein `async` Callback sichtbar, und das Vokabular dafür (`flush()`, der `unhandledRejection`-Wächter, das `describe('cleanup generations')`) steht ausschließlich dort. Für TEST-024 sind es `src/createSignal.destroySignal.spec.ts` und `src/createSignal.lazy.spec.ts` statt `createSignal.spec.ts`, jeweils die thematisch zuständige Datei. Dazu kommen `src/SignalGroup.spec.ts` und `src/SignalGroup.teardown.spec.ts`, die in der Zeile fehlen.
  - **Eine Korrektur an der Zielzeile dieses Pakets**, ohne Folgen für den Schnitt: dort steht »das Netz, ohne das **Paket 28** nicht angefasst werden darf«. Paket 28 ist die Doku-Synchronisation und hängt an nichts hiervon. Die Pakete, die dieses Netz tatsächlich brauchen, sind **17** (`EffectImpl.run()`, Early Returns), **19** (lazy Collections in `SignalGroup`) und **27** (`EffectImpl.run()` zerlegen) — alle drei haben ihre Notiz unten bekommen.
  - **Modellstufe von der stärksten auf die mittlere gesenkt**, mit der Auflage bei »Modell«. Begründung wie in Paket 9: die schwere Arbeit dieses Pakets war die Suche nach dem *beobachtbaren* Unterschied je Mutation — beim `#generation`-Bump und beim Husk-Sweep war das der eigentliche Aufwand —, und die ist erledigt.
  - Kein neuer `critical`- oder `high`-Befund. Kein Nebenbefund für Paket 29 oder 30.

- **Ergebnis (2026-08-10)** — Hash `de36cf0`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 44 Dateien / **496 Tests** (vorher 488), Coverage **99,28 / 94,92 / 99,51 / 99,43**. Kein Produktionscode angefasst.
- **Zehn Mutationen, acht rot, zwei bewusst grün.** Der Reviewer hat alle zehn unabhängig gefahren, Zahl und Fehlermeldung deckungsgleich. Die acht testbaren fallen je auf **genau einen** Test an einer Rumpfassertion, ohne Kollateralschaden: Mitgliedschaftsprüfung, Husk-Sweep, `gLinkFinalizer.unregister()`, `#generation`-Bump, Destroyed-Read-Wache, `lazy !== this.lazy`, `valueFn`-Freigabe, Namens-Fallback.
- **Zwei Stellen sind begründet ungetestet geblieben.** Der Hüllen-`delete` im Ressourcen-Finalizer ist unbeobachtbar — beide Leser von `allGroups` fegen die Hülle selbst weg, was bleibt, ist eine Zeitzusage ohne steuerbares Fenster. Und die Ausnahme für selbstgeschlüsselte Gruppen ist folgenlos: feuert die zusätzliche Registrierung, ist die Gruppe längst weg und `deref()` liefert `undefined`. Beide sind **Pflicht-Überlebende** der Mutationsprobe; der Reviewer hat sie je fünfmal grün gefahren. Ein flackernder GC-Test wäre schlimmer als keiner.
- **Die GC-Tests sind gemessen stabil.** 5 × `vitest run` grün, 3 × `pnpm test:gc` grün, je 5 × rot unter ihrer Mutation mit identischer Meldung, dazu je einmal rot unter `test:gc`. Ihr Determinismus ruht auf zwei ausgemessenen Details, die im Testcode nachgeprüft sind: 50 lebende Links als Sockel, weil der `gLinksCount > 0`-Deckel den Fehler sonst verbirgt, und beim Husk-Sweep auf der Zusage, dass ein FinalizationRegistry-Callback nie synchron aus `gc()` läuft — zwischen `gc()` und dem Ablesen steht kein `await`.
- **Mutation F war eine Falle.** Die naive Fassung (die ganze Zeile nach oben verschoben) erzeugt drei rote Tests in zwei Dateien und misst damit ein Artefakt der Mutationsform. Nur die chirurgische Fassung — Inkrement an den Anfang, Lesen bleibt unten — trifft den Mechanismus, den TEST-023 meint. Beide hat der Reviewer gegengeprobt.
- Runde 1: Der CHANGELOG-Eintrag behauptete pauschal, die Finalizer-Buchhaltung sei festgenagelt, ohne die zwei ausgelassenen Stellen zu nennen. Er ist jetzt auf die drei belegten zurückgezogen und benennt die zwei Ausnahmen samt Grund — aus einem Fakt wurden zwei, also zwei Zeilen. Derselbe Punkt, an dem 7c2 eine Runde brauchte.
- Mitgenommene Aufräumarbeit: `bequiet` fällt aus beiden Threshold-Ausnahmelisten in `vitest.config.ts`, weil die Datei seit Paket 8 auf 100 % steht. Der Reviewer hat mit einer Kontrollmutation nachgewiesen, dass das Tier-2-Gate danach scharf ist und keine Schwellengruppe leer läuft.
- Nebenbefund: `src/createSignal.lazy.spec.ts` trägt in seinen vier Altbestand-Tests keinen Teardown — die Datei war nicht Teil des Sweeps, weil sie keine Zählerwächter führt. Die zwei neuen Tests folgen dem Muster trotzdem. Gehört zu Paket 32.


#### [x] 32. Die Zählerwächter der Spec-Dateien vereinheitlichen
- Findings: **nicht aus `audit.html`** — der erste der beiden Nebenbefunde, die Paket 7a bei Paket 10 geparkt hat. Am 2026-08-10 vom Planer von Paket 10 nachgemessen und herausgeschnitten, weil er ein mechanischer Sweep über zwei Dutzend Hook-Blöcke ist und nichts mit den vier TEST-Findings zu tun hat.
- Ziel: Jede Spec-Datei bemerkt jedes geleakte Signal, jeden geleakten Effect und jeden geleakten Link — statt nur die Sorte, die zufällig in ihrem `afterEach` steht.
- Bereich: die `beforeEach`/`afterEach`-Blöcke von bis zu 32 der 44 `*.spec.ts` in `src/`, plus die zehn Tests, die heute etwas stehenlassen
- Hängt ab von: Paket 7a bis 7c (das `finally`-Muster steht dort; ein neuer Wächter ohne das Muster erzeugt genau den Kollateralschaden, den TEST-017 abgeräumt hat) und Paket 10 (`createSignal.lazy.spec.ts` bekommt dort zwei Tests, die bereits wächtertauglich sind)
- **Gemessene Ausgangslage (2026-08-10)**, mit einer Wegwerf-`setupFiles`-Sonde, die je Test die drei globalen Zähler vor und nach dem Rumpf vergleicht:
  - Wächterverteilung über die 43 Spec-Dateien in `src/` (die 44. ist `src/__testing__/assert-helpers.spec.ts`, sie prüft die Helfer selbst und braucht keinen Wächter): **8 Dateien ohne jeden Wächter** (`batch`, `createMemo`, `global-queues`, `signal-core.gc`, `SignalAutoMap.gc`, `createSignal.lazy`, `unsubscribeEffect`, `createSignal.compareFn`), **12 nur `assertEffectsCount`**, **11 `Effects`+`Signals`**, **1 nur `assertLinksCount`** (`link.gc`, dort begründet), **11 alle drei**.
  - **10 Tests in 5 Dateien lassen heute etwas stehen** — zusammen 8 Effects und 18 Signale, und keiner dieser fünf Dateien fällt es auf, weil sie zu den acht ohne Wächter gehören: `createMemo.spec.ts` (2 Tests, je E+1 S+3), `batch.spec.ts` (2 Tests, E+2 S+2 und E+1 S+3), `unsubscribeEffect.spec.ts` (1 Test, E+2 S+2), `createSignal.compareFn.spec.ts` (1 Test, E+1 S+1), `createSignal.lazy.spec.ts` (4 Tests, je S+1).
  - Der Sweep ist also **nicht** grün bei Ankunft: erst müssen diese zehn Tests ihren Abbau bekommen (`finally`-Muster aus 7a), dann können die Wächter dazu.
  - Was der Befund **nicht** ist: ein Leck im Produktionscode. Die zehn Tests leaken innerhalb ihres eigenen Worker-Prozesses und sterben mit ihm; der Schaden ist ausschließlich blinde Erkennung für alles, was Phase 3 bis 5 in diesen Dateien noch anrichten kann.
- Anmerkung: Paket 7a hat diese Arbeit ausdrücklich aus dem Sweep herausgehalten (Regel (f): »Die Hook-Blöcke werden nicht angefasst«), weil sie ändert, *was eine Datei entdeckt*, und damit inhaltlich ist. Genau deshalb steht sie hier und nicht dort. `link.gc.spec.ts` ist die begründete Ausnahme, die bleiben muss: sie verzichtet absichtlich auf `assertSignalsCount`, weil ihr ganzer Gegenstand fallengelassene Quellsignale sind (Kommentar `:41-52`). Weitere solche Fälle sind vom Planer zu suchen, nicht zu unterstellen.
- Einordnung: Sollte **vor Phase 3** laufen, sonst schützt es genau die Pakete nicht, für die es gedacht ist. Kein Muss für die Findings des Audits — reine Netzverstärkung.
- Modell: siehe 32a und 32b — **32a stärkste Stufe** (angehoben, Begründung im Schnitt), 32b mittlere Stufe
- Hash: —

- **Abgleich (2026-08-10)** — nachgemessen vom Planer von Paket 32, mit derselben Methode und nach `de36cf0`:
  - **Methode.** Eine Wegwerf-Sonde `src/__testing__/probe.setup.ts`, über `setupFiles` in `vitest.config.ts` eingehängt, schreibt je Test eine Zeile mit der Differenz der drei globalen Zähler. Sie registriert ihre Hooks vor jedem dateilokalen Hook; unter `sequence.hooks: 'stack'` läuft ihr `afterEach` damit **als letzter**, also hinter jedem `SignalGroup.clear()` und jedem `mockRestore()` einer Datei. Gemessen wird deshalb genau das, was auch ein Wächter sähe: »ist der Zähler zurück, wenn der Test samt Hooks fertig ist?«
  - **Die Zahlen der alten Messung stehen, alle.** 496 Sondenzeilen (eine je Test, 44 Dateien), davon exakt **10 mit Leck** — dieselben zehn Tests, dieselben Deltas, in Summe unverändert **8 Effects und 18 Signale**. Wächterverteilung ebenfalls unverändert: 8 Dateien ohne jeden Wächter, 12 nur `assertEffectsCount`, 11 `Effects`+`Signals`, 1 nur `assertLinksCount`, 11 alle drei.
  - **Was Paket 10 verschoben hat: nichts von Belang.** `createSignal.lazy.spec.ts` ist von 4 auf 6 Tests gewachsen; die zwei neuen (`set(undefined) replaces the factory …`, `the first read releases the factory function …`) tragen bereits `try`/`finally` und lecken nicht. Die vier Altbestand-Tests lecken weiter, wie im Nebenbefund von Paket 10 notiert. Die `vitest.config.ts`-Änderung (`bequiet` aus den Threshold-Ausnahmelisten) berührt das Paket nicht.
  - **Die Flächenprobe: alle drei Wächter in alle 32 Kandidatendateien injiziert, volle Suite.** Rot werden genau die fünf bekannten Dateien (38 Tests), alle 39 übrigen sind grün — **einschließlich aller vier `.gc.spec.ts`**. Das `gc`-Projekt lief in dieser Fassung 20-mal grün, dazu einmal seriell unter `--expose-gc` über die ganze Suite. Kein einziger Wächter wird von seinem Gegenstand widerlegt; die Ausnahmen unten stehen deshalb auf Determinismus-Gründen, nicht auf roten Läufen.
  - **Was die alte Messung nicht gesehen hat, und was den Schnitt bestimmt.** Die fünf leckenden Dateien waren nie Teil des TEST-017-Sweeps — 7a hat die wächterlosen Dateien ausdrücklich ausgeklammert. Sie enthalten zusammen **38 Tests, davon nur 4 mit `finally`**. Wer ihnen einen Wächter gibt, ohne den Rest umzustellen, stellt den Kollateralschaden wieder her, den TEST-017 abgeräumt hat: gemessen auf einer Kopie, `createMemo.spec.ts` mit allen drei Wächtern und seinen zwei geschlossenen Lecks → **51 Saatpunkte, größter Radius 16, 43 Übeltäter**. Der Sweep ist also nicht nur »nicht grün bei Ankunft«, er ist in diesen fünf Dateien komplett ungetan.
  - **Die Gegenrichtung ist gemessen harmlos.** Die 23 Dateien, die bereits Hook-Blöcke tragen, vertragen die Verbreiterung ohne jeden neuen Radius. Saat-Tor (`gate3.sh`/`blast3.py`) über alle 23 mit den verbreiterten Wächtern: **243 Saatpunkte, größter Radius 1, 0 Übeltäter.** Die `finally`-Blöcke aus 7a bis 7c sind also auch für Signale und Links vollständig, nicht nur für das, was damals gemessen wurde.
  - **Eine Ausnahme, und sie ist vorbestehend.** `src/createSignal.deprecation.spec.ts:26` meldet Radius 2. Auf der **unveränderten** Datei reproduziert sich derselbe Wert an derselben Anweisung (`:27` vor dem Wächtereinzug) — die Kopplung ist die modulweite »warne genau einmal«-Zusage, die Test 1 auslöst und Test 2 prüft, kein Zählerleck. Mit dem `finally`-Mechanismus nicht schließbar, dieselbe Klasse wie die offengelassene P2-Lücke aus 7b. Wird **nicht** in diesem Paket angefasst.
  - **Eine Blindstelle des Werkzeugs, fürs Protokoll.** `src/ordering.property.spec.ts` liefert 0 Saatpunkte: die Ressourcen entstehen in fast-check-Eigenschaftskörpern, nicht auf `it`-Ebene, und `blast3.py` sieht sie nicht. Die Datei bekommt ihren `assertLinksCount` trotzdem — sie steht seit 7a auf `finally` und ist in der vollen Suite grün —, aber ihr Radius ist mit diesem Tor nicht belegt. Kein Grund, das Tor umzubauen; ein Grund, es nicht als Vollständigkeitsbeweis zu lesen.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/ vitest.config.ts` ist leer. Jede Messung lief auf zwei Vollkopien im Scratchpad (`p32/repo`, `p32/repo2`), kein `git`-Schreibbefehl war beteiligt.

- **Ausnahmen — fünf Dateien bekommen keinen (weiteren) Wächter.** Die Regel dahinter, weil sie auch für jede künftige Spec gilt: *ein Wächter kommt in eine Datei, wenn sie diese Ressourcenart erzeugen kann und ihren Zähler am Testende deterministisch auf null zurückbringt.* Beides muss gelten, nicht eines.
  1. `src/__testing__/assert-helpers.spec.ts` — prüft die Wächter selbst. Bleibt, wie im Ausgangsbefund vermerkt.
  2. `src/global-queues.spec.ts` — importiert `isEventized` und die drei Queues, sonst nichts; erzeugt in allen drei Tests kein Signal, keinen Effect, keinen Link. Ein Wächter wäre Dekoration und würde behaupten, die Datei stünde unter dem Netz, wo es nichts zu halten gibt.
  3. `src/link.gc.spec.ts` — behält `assertLinksCount` und bekommt **nichts** dazu. Kein `assertSignalsCount` aus dem im Kommentar `:41-52` ausgeschriebenen Grund (fallengelassene Quellsignale sind der Gegenstand, und die Budget-Schleifen warten auf `getLinksCount()`, nicht auf den Signalzähler); kein `assertEffectsCount`, weil die Datei keinen Effect erzeugt.
  4. `src/signal-core.gc.spec.ts` — bleibt **ganz ohne Wächter**, und das ist ab jetzt eine Entscheidung statt einer Lücke. Der Signalzähler ist ihr Gegenstand und kommt über den Finalizer zurück; der Kommentar `:26-29` sagt es bereits. Effects und Links erzeugt sie nicht.
  5. `src/SignalAutoMap.gc.spec.ts` — dieselbe Lage, nur ohne die Begründung im Code. Sie bekommt in 32b den Kommentar, den `signal-core.gc.spec.ts` schon hat, und sonst nichts.
  - **Wichtig für die Nachprüfung:** die drei GC-Dateien wären mit allen drei Wächtern heute grün — 20 Läufe des `gc`-Projekts, plus ein serieller Lauf. Die Ausnahme wird also nicht gehalten, weil etwas rot ist, sondern weil ihr Grün an einem GC-Zeitpunkt hinge, den niemand zusagt. Ein Wächter, dessen Farbe die Speicherbereinigung bestimmt, ist kein Netz, sondern ein Flackern mit Zusatzschritt.

- **Helfer: nein.** Kein gemeinsamer Hook-Helfer in `src/__testing__/`, jede Datei trägt ihren Block selbst. Zwei Gründe, einer davon technisch: die drei Zeilen *sind* die Aussage der Datei darüber, was sie nicht verlieren darf — und weil fünf der 44 Dateien eine andere Aussage machen, muss man sie an Ort und Stelle lesen können, statt einen Parametersatz zu entziffern (`guardCounters({signals: false})` kostet denselben Gedanken hinter einer Abstraktion); dazu kommt, dass ein Helfer seine Hooks auf einer anderen Verschachtelungsebene registrieren würde als die vorhandenen, und in acht Dateien steht in denselben Hooks bereits Aufräumcode (`SignalGroup.clear()`, `warnSpy.mockRestore()`, `process.off(…)`), dessen Reihenfolge relativ zu den Wächtern in 7c bewusst festgelegt wurde. Das ist dasselbe Argument, das in 7a gegen die Registry entschieden hat.

- **Schnitt: geteilt in 32a und 32b.** Nicht nach »Tests aufräumen« gegen »Wächter einziehen«, sondern entlang der einzigen Naht, die die Messung anbietet: die fünf Dateien ohne Hook-Block brauchen den vollen 7a-Umbau (33 `finally`-Blöcke, 10 davon schließen ein echtes Leck) und ihren neuen Wächterblock — das ist Urteilsarbeit an jedem einzelnen Test, Regel (c) inklusive. Die 23 Dateien mit vorhandenem Hook-Block bekommen ein bis zwei Assert-Zeilen und sonst nichts — das ist ein Diff, den ein Reviewer in fünf Minuten vollständig liest. Beides in einen Commit zu werfen hieße, 33 Testrümpfe hinter 23 Einzeilern zu verstecken. **32a zuerst**, weil die fünf Dateien die einzigen mit echten Lecks sind; 32b ist danach ein Formalakt. Die Modellstufe für 32a ist gegen die Vorgabe **angehoben**: 7a hat für dieselbe Arbeit zwei Runden und am Ende die stärkste Stufe gebraucht, und `createMemo.spec.ts` mit 18 Tests und 51 Saatpunkten ist kein leichterer Fall als das, was dort schiefging.

#### [x] 32a. Die fünf wächterlosen Specs unter das Netz holen
- Findings: **nicht aus `audit.html`** — Teil 1 von 2 des Nebenbefunds aus dem TEST-017-Sweep
- Ziel: Die fünf Dateien, die 7a mangels Wächter ausgelassen hat, folgen dem `finally`-Muster, ihre zehn Lecks sind zu, und ihr neuer Wächterblock meldet ab jetzt jedes Signal, jeden Effect und jeden Link, den ein späteres Paket dort stehenlässt.
- Bereich: 5 `*.spec.ts` in `src/`, 38 Tests, 1 421 Zeilen
- Hängt ab von: Paket 7a bis 7c (Muster und Regeln (a) bis (f)), Paket 10 (`createSignal.lazy.spec.ts` in seiner heutigen Form)
- Modell: **stärkste Stufe**
- Hash: `454eb94`
- Dateien:

  | Datei | Tests | mit `finally` heute | brauchen `finally` | davon mit echtem Leck | Saatpunkte heute | neuer Wächter |
  | --- | ---: | ---: | ---: | ---: | ---: | --- |
  | `src/createMemo.spec.ts` | 18 | 0 | 18 | 2 | 51 | E + S + L |
  | `src/batch.spec.ts` | 11 | 2 | 8 | 2 | 28 | E + S + L |
  | `src/createSignal.lazy.spec.ts` | 6 | 2 | 4 | 4 | 8 | E + S + L |
  | `src/unsubscribeEffect.spec.ts` | 2 | 0 | 2 | 1 | 6 | E + S + L |
  | `src/createSignal.compareFn.spec.ts` | 1 | 0 | 1 | 1 | 2 | E + S + L |
  | **Summe** | **38** | **4** | **33** | **10** | **95** | |

  Der eine Test in `batch.spec.ts`, der weder `finally` hat noch eines braucht, erzeugt nichts (`resets Batch.current after a throw in a nested batch callback`, `:157`) — er bleibt unverändert, wie die drei Fälle derselben Art in 7c1.
- Vorgehen:
  1. **Erst der Abbau, dann der Wächter — in dieser Reihenfolge, Datei für Datei.** Wer den Hook-Block zuerst einzieht, macht die Datei rot und weiß danach nicht, ob es an ihm oder an einem Testrumpf liegt. Innerhalb einer Datei gilt: alle Rümpfe umstellen, Suite für diese Datei grün fahren, dann den Block dazu, dann erneut.
  2. **Das Muster ist das aus 7a, unverändert**, samt der Regeln (a) bis (f) und samt dem Merksatz aus 7a Runde 2: **die Arrange-Phase gehört vor das `try`, nicht hinein.** Regel (f) ist hier ausgesetzt — die Hook-Blöcke *sind* der Gegenstand —, alles andere gilt wörtlich. Q1 und Q2 aus dem 7b-Review sind die beiden Fallen, die in diesen fünf Dateien wieder auftreten können: eine Arrange-Zuweisung im `try`, die der `finally`-Block dereferenziert, und ein Abbau, der selbst wirft und die eigentliche Meldung ersetzt.
  3. **Die zehn leckenden Tests, jeder mit seinem Griff.** Die drei nicht offensichtlichen Abbauwege sind auf einer Kopie nachgemessen, nicht geraten:
     - `src/createMemo.spec.ts:13` `non-lazy by default` (E+1 S+3) und `:50` `lazy memo works as expected` (E+1 S+3) — `try` beginnt bei `expect(fullName()).toBe('');`, `finally` bekommt **`destroySignal(fullName, firstName, lastName);`**. Gemessen: `destroySignal()` auf den Memo-Reader nimmt den internen Effect mit, beide Zähler stehen danach auf 0. Ein separates `effect.destroy()` gibt es hier nicht und braucht es nicht.
     - `src/batch.spec.ts:10` `delay the effect callback execution until the batch callback finished` (E+2 S+2) — die beiden `createEffect(…)`-Aufrufe bekommen Griffe (`const effect0 = …`, `const effect1 = …`) und bleiben vor dem `try`; `try` beginnt bei `expect(effectCallCount0).toBe(1);`, `finally`: `effect0.destroy(); effect1.destroy(); destroySignal(a, b);`
     - `src/batch.spec.ts:62` `nested effects work as expected` (E+1 S+3) — ein Griff auf den `createEffect(…)`, `finally`: `effect.destroy(); destroySignal(a, b, c);`
     - `src/unsubscribeEffect.spec.ts:10` `should be called before recalling the effect callback` (E+2 S+2) — nur der **äußere** Effect braucht einen Griff; gemessen nimmt sein `destroy()` den im Callback erzeugten inneren mit. `finally`: `outer.destroy(); destroySignal(a, b);`
     - `src/createSignal.compareFn.spec.ts:17` `works as expected` (E+1 S+1) — der Effect stammt aus der deprecated Reader-Callback-Form `signal(mock)`. Gemessen genügt **`destroySignal(signal);`** im `finally`, es räumt den Effect mit ab; dasselbe Vorgehen wie in `createSignal.deprecation.spec.ts`. Der `warnSpy` bleibt in `beforeAll`/`afterAll`, wo er steht.
     - `src/createSignal.lazy.spec.ts:5` `works as expected` (S+1) — `finally`: `destroySignal(val);`
     - `src/createSignal.lazy.spec.ts:26` `set() stores function as value — there is no updater-function pattern` (S+1) — `finally`: `destroySignal(count);`
     - `src/createSignal.lazy.spec.ts:50` `set() with {lazy: true} defers evaluation to next read` (S+1) — `finally`: `destroySignal(count);`
     - `src/createSignal.lazy.spec.ts:68` `laziness is NOT catching on` (S+1) — `finally`: `destroySignal(val);`
  4. **Die übrigen 23 Rümpfe.** Sie lecken heute nicht, aber sie haben keinen `finally`-Block und sind damit unter dem neuen Wächter die Sprengsätze aus der Messung. Vollständig, mit Zeilennummer nach `de36cf0`:
     - `src/createMemo.spec.ts` — `:91`, `:126`, `:151`, `:170`, `:210`, `:243`, `:276`, `:320`, `:370`, `:415`, `:449`, `:481`, `:531`, `:564`, `:610`, `:644` (16 Tests). Sechs davon zerstören mitten im Rumpf und prüfen danach weiter — dort greift Regel (c): der Aufruf bleibt, wo er ist, der `finally`-Block bekommt nur den idempotenten Gürtel.
     - `src/batch.spec.ts` — `:128`, `:171`, `:271`, `:293`, `:330`, `:362` (6 Tests). `:128` und `:171` prüfen einen Wurf; ihr `finally` darf die Meldung nicht ersetzen (Regel (d)).
     - `src/unsubscribeEffect.spec.ts` — `:98` `leaves no trace: subscriptions and counters return to their snapshot after teardown (TEST-010)`. Der Test nimmt seine eigenen Schnappschüsse; sein Abbau ist Gegenstand und bleibt im `try`.
  5. **Die fünf Hook-Blöcke.** Je `beforeEach` und `afterEach` mit `assertEffectsCount(0, …)`, `assertSignalsCount(0, …)`, `assertLinksCount(0, …)` in dieser Reihenfolge, direkt hinter dem `describe(`-Kopf, im Stil der 39 vorhandenen Blöcke. In `createSignal.compareFn.spec.ts` kommen sie **zusätzlich** zu den vorhandenen `beforeAll`/`afterAll`; die Spy-Verwaltung bleibt dort, wo sie ist.
  6. **Importe nachziehen.** `assertEffectsCount`, `assertSignalsCount`, `assertLinksCount` aus `./__testing__/assert-helpers.js` in allen fünf Dateien; `destroySignal` aus `./signal-core.js` fehlt in `createSignal.lazy.spec.ts` und `createSignal.compareFn.spec.ts`. `createMemo.spec.ts` importiert bereits aus `assert-helpers.js` (`getGroupMemberCounts`) — die Liste wird ergänzt, keine zweite Importzeile.
  7. **`pnpm fix` am Ende**, dann `pnpm check` sauber. Kein CHANGELOG-Eintrag: kein Konsument beobachtet davon etwas — derselbe Fall, den 7a und 7b unter »CHANGELOG discipline« ausgenommen haben. Der eine Eintrag für beide Teile kommt in 32b.
- Verify: vier Teile. Der erste zeigt, dass nichts kaputt ist; der zweite ist das eigentliche Abnahmekriterium; der dritte gibt den Wächtern Zähne; der vierte prüft den Baum.
  1. `pnpm world`. Erwartet: neun Schritte grün, 44 Dateien / **496 Tests** in `test` und `test:gc`, Coverage 99,28 / 94,92 / 99,51 / 99,43 — ziffergleich zu `de36cf0`. Ein Umbau an Testrümpfen darf die Deckung nicht bewegen; tut er es, ist eine Assertion verlorengegangen.
  2. **Die Sonde meldet null.** Das ist das Abnahmekriterium, nicht der grüne Lauf. Die Sonde ist Wegwerfcode und wird danach vollständig zurückgebaut:
     ```ts
     // src/__testing__/probe.setup.ts — via `setupFiles: ['src/__testing__/probe.setup.ts']`
     // im `test`-Block von vitest.config.ts eingehängt (gilt über `extends: true`
     // für beide Projekte). Registriert vor jedem dateilokalen Hook, ihr afterEach
     // läuft unter `sequence.hooks: 'stack'` deshalb als letzter.
     import {appendFileSync} from 'node:fs';
     import {afterEach, beforeEach} from 'vitest';
     import {getEffectsCount} from '../effects.js';
     import {getLinksCount} from '../link.js';
     import {getSignalsCount} from '../signal-core.js';

     const OUT = process.env.PROBE_OUT!;
     let before: [number, number, number];

     beforeEach(() => {
       before = [getEffectsCount(), getSignalsCount(), getLinksCount()];
     });

     afterEach((ctx) => {
       const after = [getEffectsCount(), getSignalsCount(), getLinksCount()];
       const d = after.map((v, i) => v - before[i]);
       appendFileSync(
         OUT,
         `${d.some((x) => x !== 0) ? 'LEAK' : 'ok'}\t${ctx.task.file.name}\t${ctx.task.name}\tE${d[0]} S${d[1]} L${d[2]}\n`,
       );
     });
     ```
     ```bash
     rm -f /tmp/probe.tsv
     PROBE_OUT=/tmp/probe.tsv npx vitest run --coverage.enabled=false
     wc -l < /tmp/probe.tsv      # muss 496 sein — eine Zeile je Test, keine fehlt
     grep -c '^LEAK' /tmp/probe.tsv || true
     ```
     **Vorher gemessen: 496 Zeilen, 10 `LEAK`. Nachher gefordert: 496 Zeilen, 0 `LEAK`.** Die Zeilenzahl ist Teil des Kriteriums: eine Sonde, die nur 480 Tests sieht, meldet auch null.
  3. **Die Wächter haben Zähne — drei Proben, eine je neu eingezogenem Wächtertyp**, je auf einer Kopie gesät und wieder zurückgebaut. Jede muss **genau ihren** Wächter zum Sprechen bringen und keinen anderen:
     - `assertEffectsCount`: in `src/batch.spec.ts:10` das `effect0.destroy()` aus dem `finally` streichen → `afterEach: Number of active effects should be 0 but is 1`.
     - `assertSignalsCount`: in `src/createMemo.spec.ts:13` das `destroySignal(…)` auf die beiden Quellsignale kürzen (`destroySignal(fullName)`) → `afterEach: Number of active signals should be 0 but is 2`.
     - `assertLinksCount`: in `src/createSignal.lazy.spec.ts:5` ein `link(val, () => {})` in den Rumpf setzen, ohne `unlink` im `finally` → `afterEach: Number of active links should be 0 but is 1`.
  4. **Das Saat-Tor über alle fünf Dateien.** `gate3.sh` mit `blast3.py` (Scratchpad; `p7c/gate7c.sh` ist dieselbe Schleife plus Meldungsmaskenprüfung und nimmt Repo-Wurzel und Blast-Skript über die Variablen `R` und `BL` entgegen — das ist die Fassung, die hier zu fahren ist, weil sie zusätzlich `Maskiert` zählt). Werkzeugbeschreibung, falls sie nicht mehr auffindbar sind: `blast3.py <spec> (--list|<n>)` schiebt eine `expect(1, 'SEEDED').toBe(2);` an den n-ten Saatpunkt einer Datei und druckt die Zeilennummer, Exit 2 wenn es keinen n-ten gibt; Saatpunkte sind je Test die Anweisung **nach** jeder ressourcenerzeugenden Anweisung, die erste Anweisung im `try` wenn davor Ressourcen entstanden, und die erste `expect(`-Zeile — alle nur innerhalb des `try`, wenn es eines gibt. `gate3.sh <spec>` fährt sie alle durch, sichert und stellt die Datei je Durchlauf wieder her und zählt Fehlschläge pro Saat; ein Durchlauf, bei dem mehr als ein Test fällt, ist ein Übeltäter. Das Zählen der maskierten Meldungen ist ein `grep -q SEEDED` auf die Ausgabe.
     **Abnahmekriterium: `größter Radius 1, Übeltäter 0, Maskiert 0` für alle fünf Dateien.** Vorher gemessen für `createMemo.spec.ts` mit Wächtern, aber ohne den Umbau: 51 Saatpunkte, größter Radius **16**, 43 Übeltäter. Die Saatpunktzahl steigt nach dem Umbau (das Tor sät in den `try`-Block, nicht in den `finally`-Block) — die Zahl der Übeltäter muss auf null fallen.
  5. `git status --porcelain --untracked-files=all` — nur die fünf Spec-Dateien, keine `probe.setup.ts`, kein `setupFiles` in `vitest.config.ts`, kein `SEEDED` und kein `/tmp/*.bak` im Baum. `git diff -- src/` zeigt außerhalb der fünf Dateien nichts, und über Produktionscode gar nichts.
- Commit: `test: give the five guard-less specs a finally per test and all three counter guards (sweep follow-up, no finding id)`

- **Ergebnis (2026-08-10)** — Hash `454eb94`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen Schritten grün, 44 Dateien / 496 Tests, Coverage 99,28 / 94,92 / 99,51 / 99,43 — ziffergleich zu `de36cf0`. Kein Produktionscode angefasst. **36 `finally`-Blöcke, davon 34 neu**, alle fünf Dateien mit E+S+L-Wächtern.
- **Die Sonde ist der Beleg, nicht der grüne Lauf.** Vorher 496 Testzeilen mit **10 `LEAK`** (8 Effects, 18 Signale), nachher **0** — über die ganze Suite, nicht nur über die fünf Dateien. Der Reviewer hat sie unabhängig gefahren und zur Kontrolle gegen `de36cf0` gehalten, wo sie die zehn Lecks reproduziert.
- Beide Saat-Tore vom Reviewer nachgefahren: `blast3` **47 / 1 / 0 / 0**, `blast4` erschöpfend **295 / 1 / 0 / 0**. Kein Test hat seinen Prüfgegenstand verloren — `expect(`-Zeilen und `it(`-Zahlen je Datei identisch zum Vorstand, keine Assertion in einem `finally`.
- **Alle drei Wächter haben Zähne, aber die Rezepte des Plans hatten keine.** Der Implementierer hat nachgewiesen, dass zwei der drei Zahn-Proben nichts messen können: ein gestrichenes `effect0.destroy()` nimmt das `destroySignal(a, b)` desselben `finally` über `EffectImpl[$destroySignal]` → `destroyWhenUntriggerable()` mit, sobald die letzte Abhängigkeit stirbt; und ein `link()` ohne `unlink` reißt `destroySignal(val)` über `SignalLink.ts:132` mit der Quelle ab. Der Reviewer hat beides am Produktionscode bestätigt und die Ersatzrezepte gefahren — jeder Wächter meldet, und jeweils **nur** der betreffende. Dieselbe Warnung gilt für die zwei Zahn-Proben in **32b**.
- **Der Planzahl-Fehler, den der Implementierer gefunden hat**: `batch.spec.ts` war als »hat schon vier `finally`« verbucht; `git show de36cf0:src/batch.spec.ts` enthält **null**, die verbuchten Stellen sind `try`/`catch`. Einer davon (`throws when the callback is an async function…`) ist exakt der 7b-Q4-Fall: `eff.destroy(); destroySignal(a);` standen ungedeckt hinter sechs Assertions.
- Runde 1: Der CHANGELOG-Eintrag musste wieder raus — Schritt 7 sieht für 32a keinen vor, der eine Eintrag für beide Teile kommt in 32b. Mein Auftrag an den Implementierer hatte `CHANGELOG.md` fälschlich im erwarteten Diff gelistet; der Plan sticht.
- Kleine Befunde, in den Plan statt in eine Runde:
  - Die Typbegründung zu den weggelassenen `destroySignal(attached/escaped)` hält nicht — `SignalReader<T> extends SignalLike<T>` (`src/types.ts:86`), eine verbreiterte Deklaration hätte getragen. Das Ergebnis stimmt trotzdem: `outer.destroy()` räumt das Memo-Signal vollständig ab, `blast4` belegt es an jedem Saatpunkt.
  - `src/createMemo.spec.ts:566` — `const src = createSignal(i)` im Schleifenrumpf ohne Griff im `finally`. Kein Saatpunkt erreicht Schleifenrümpfe; dieselbe Klasse wie die offengelassenen Fälle in 7c1 (`SignalGroup.spec.ts:1642`) und 7c2 (`teardown.spec.ts:265`).
  - `src/createSignal.compareFn.spec.ts:23` — Wächterblöcke hinter `beforeAll`/`afterAll` statt direkt hinter dem `describe(`-Kopf. Folgenlos und lesbarer als die Planvorgabe.
  - `src/batch.spec.ts:291` — ein zweiter ressourcenloser Test ohne `finally`, den der Plan nicht kennt. Entscheidung richtig, Buchhaltung des Plans um einen daneben.
- **Neuer Produktionsbefund, eingestuft als `low`, geht ins nächste Audit**: `src/link.ts:182` — `link()` nimmt eine bereits zerstörte Quelle an und zählt den Link, der dann nie etwas transportiert. Reproduziert und gemessen. Die Meldung des Implementierers (»`getLinksCount()` bleibt dauerhaft erhöht«) überzeichnet: `unlink(source)`, `link.destroy()` und ein geräumtes `{attach}` bringen den Zähler zurück, und der `gLinkFinalizer` nimmt Zähler und Abos mit, sobald die tote Quelle unerreichbar wird. »Dauerhaft« gilt nur, wenn der Aufrufer den Handle wegwirft und die Quelle am Leben hält. Bleibt: zwei Abos auf permanenten globalen Queues, ein mitgezählter toter Link, und eine JSDoc bei `:163-167`, die einen Abbauweg zusagt, den es für diesen Fall nicht gibt. Der eigentliche Punkt ist die Asymmetrie zu BUG-007 — eine `null`-Quelle wirft, eine tote wird durchgewunken.
- Nebenbefund für 32b und alles Spätere: **die Hook-Reihenfolge Effects → Signals → Links maskiert.** Ein Test, der ein Signal *und* einen Link stehenlässt, meldet nur das Signal — `assertSignalsCount` wirft, `assertLinksCount` läuft nie. Betrifft alle 44 Dateien.


#### [x] 32b. Die Wächter der übrigen 23 Specs verbreitern
- Findings: **nicht aus `audit.html`** — Teil 2 von 2 des Nebenbefunds aus dem TEST-017-Sweep
- Ziel: Keine Spec-Datei ist mehr für eine ganze Ressourcenklasse blind, außer den fünf, für die das begründet ist — und die Begründung steht überall im Code, wo sie gilt.
- Bereich: 23 `*.spec.ts` in `src/`, nur `beforeEach`/`afterEach`, keine Testrümpfe; dazu ein Kommentar in `src/SignalAutoMap.gc.spec.ts`
- Hängt ab von: **Paket 32a** (nicht inhaltlich, sondern damit ein roter Lauf eindeutig diesem Teil gehört)
- Modell: mittlere Stufe
- Hash: `774a9ac`
- Dateien: die neuen Assert-Zeilen kommen **in den vorhandenen Wächterblock**, in der Reihenfolge Effects → Signals → Links, und **nicht** an den Anfang des Hooks: in acht Dateien steht dort Aufräumcode (`SignalGroup.clear()`, `warnSpy.mockRestore()`, `process.off(…)`, `vi.restoreAllMocks()`), dessen Position relativ zu den Wächtern in 7c festgelegt wurde und sich nicht verschieben darf.

  **Zwölf Dateien bekommen `assertSignalsCount` + `assertLinksCount`** (heute nur `assertEffectsCount`), mit ihren heute gemessenen Saatpunkten:

  | Datei | Saatpunkte | Datei | Saatpunkte |
  | --- | ---: | --- | ---: |
  | `src/EffectImpl.destroy.spec.ts` | 22 | `src/effects.priority.spec.ts` | 2 |
  | `src/createSignal.destroySignal.spec.ts` | 13 | `src/effects.spec.ts` | 15 |
  | `src/effects-and-groups.spec.ts` | 4 | `src/globalEffectStack.spec.ts` | 6 |
  | `src/effects.async.spec.ts` | 26 | `src/nested-effects-isolation.spec.ts` | 1 |
  | `src/effects.cleanup.spec.ts` | 12 | `src/nested-effects-staticDeps.spec.ts` | 18 |
  | `src/effects.noAutorun.spec.ts` | 2 | `src/effects.onCreateEffect.spec.ts` | 3 |

  **Elf Dateien bekommen `assertLinksCount`** (heute `Effects`+`Signals`):

  | Datei | Saatpunkte | Datei | Saatpunkte |
  | --- | ---: | --- | ---: |
  | `src/EffectImpl.run.spec.ts` | 8 | `src/decorators.signal.spec.ts` | 12 |
  | `src/bequiet.spec.ts` | 5 | `src/effects.errorIsolation.spec.ts` | 22 |
  | `src/createSignal.beforeRead.spec.ts` | 6 | `src/hibernate.spec.ts` | 17 |
  | `src/createSignal.deprecation.spec.ts` | 8 | `src/object-signals.spec.ts` | 10 |
  | `src/createSignal.mutedWrites.spec.ts` | 12 | `src/ordering.property.spec.ts` | 0 |
  | `src/createSignal.spec.ts` | 19 | | |

  **Elf Dateien bleiben unverändert**, sie tragen bereits alle drei: `SignalAutoMap`, `SignalGroup.gc`, `SignalGroup.off`, `SignalGroup`, `SignalGroup.teardown`, `SignalLink`, `createSignal.link`, `link.asyncValues`, `link.nextValue`, `link`, `link.unlink`.

  **Fünf Dateien bekommen keinen Wächter** — die Ausnahmen oben. Zwei davon bekommen stattdessen Prosa: `src/SignalAutoMap.gc.spec.ts` einen Kommentar über dem `describe(` nach dem Vorbild von `src/signal-core.gc.spec.ts:26-29`, und `src/global-queues.spec.ts` eine Zeile, die sagt, dass hier nichts entsteht, das ein Zähler sehen könnte. Damit muss der nächste Planer diese Entscheidung nicht ein zweites Mal treffen.
- Vorgehen:
  1. Die 23 Blöcke ergänzen, in beiden Hooks, an der Stelle der vorhandenen Wächter.
  2. Importe in `./__testing__/assert-helpers.js` erweitern — vorhandene Importzeile, keine zweite.
  3. Die zwei Kommentare setzen (`SignalAutoMap.gc.spec.ts`, `global-queues.spec.ts`).
  4. `pnpm fix`, dann `pnpm check`.
  5. **Ein CHANGELOG-Eintrag für 32a und 32b zusammen**, unter `### Tests`: eine Zeile, ein Fakt — jede Spec-Datei prüft ab jetzt alle drei globalen Zähler, mit den fünf im Code begründeten Ausnahmen.
  6. `AGENTS.md`: die Regel aus den Ausnahmen (»ein Wächter kommt in eine Datei, wenn sie diese Ressourcenart erzeugen kann und ihren Zähler am Testende deterministisch auf null zurückbringt«) gehört neben die Konventionen für Spec-Dateien, sonst fällt die nächste neue Spec wieder in die alte Lücke.
- Verify:
  1. `pnpm world` — neun Schritte grün, 44 / 496, Coverage ziffergleich.
  2. Die Sonde aus 32a erneut: 496 Zeilen, 0 `LEAK`.
  3. **Das Saat-Tor über alle 23 Dateien.** Erwartet: **243 Saatpunkte, größter Radius 1, 0 Übeltäter** — genau die Zahlen, die der Planer am 2026-08-10 auf der Kopie gemessen hat. Die eine zulässige Abweichung ist `src/createSignal.deprecation.spec.ts:26` mit Radius 2; sie ist vorbestehend, auf der unveränderten Datei reproduziert und gehört nicht in dieses Paket. Weicht sonst etwas ab, ist es neu und gehört untersucht, nicht wegdiskutiert.
  4. **Zähne, zwei Proben** — je eine für die beiden neu eingezogenen Wächtertypen: in `src/effects.cleanup.spec.ts` ein `destroySignal(…)` aus einem `finally` streichen (der neue `assertSignalsCount` muss melden, `assertEffectsCount` nicht), und in `src/hibernate.spec.ts` einen Link ohne `unlink` im Rumpf erzeugen (der neue `assertLinksCount` muss melden).
  5. `git status --porcelain --untracked-files=all` — nur die 23 Spec-Dateien, die zwei kommentierten Dateien und `CHANGELOG.md` plus `AGENTS.md`. Kein Produktionscode, keine Sonde, kein `SEEDED`.
- Commit: `test: widen the counter guards of 23 specs to signals, effects and links (sweep follow-up, no finding id)`

### Phase 3 — Korrektheit

- **Ergebnis (2026-08-10)** — Hash `774a9ac`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 44 Dateien / 496 Tests, Coverage 99,28 / 94,92 / 99,51 / 99,43 — ziffergleich. 12 Dateien bekommen `assertSignalsCount` und `assertLinksCount` dazu, 11 nur `assertLinksCount`. Kein Produktionscode angefasst.
- Der Reviewer hat die Sonde **fünfmal im Volllauf, fünfmal im `gc`-Projekt und einmal seriell unter `--expose-gc`** gefahren: durchweg 496 Zeilen, 0 `LEAK`. Saat-Tor 243 Saatpunkte / Radius 1 / 0 Übeltäter / 0 maskiert. Die eine erwartete Abweichung in `createSignal.deprecation.spec.ts` hat er gegen `454eb94` gehalten — dieselbe Stelle, nur um drei Zeilen verschoben, vorbestehend bestätigt (modulweite »warne einmal«-Kopplung, kein Zählerleck).
- **Die Zahn-Rezepte des Plans waren auch hier untauglich**, wie 32a vorhergesagt hat: ein `link()` auf eine noch lebende Quelle erzeugt zusätzlich ein Signal-Leck, das `assertSignalsCount` zuerst auslöst. Mit dem 32a-Ersatz — eine bereits zerstörte Quelle verlinken — meldet **nur** `assertLinksCount`. Der Reviewer hat beide Proben nachgefahren und bestätigt, dass jeder Wächter einzeln meldet.
- **Zwei Runden, beide in der Prosa.** Runde 1: zwei Planschritte fehlten, weil mein Auftrag an den Implementierer zu eng gefasst war — die Begründungskommentare in den Ausnahmedateien und die Regel in `AGENTS.md`. Runde 2: `AGENTS.md` und der CHANGELOG behaupteten, alle fünf Ausnahmen seien dokumentiert und fielen unter eine von drei Kategorien. Für `src/__testing__/assert-helpers.spec.ts` stimmte das nicht — sie erzeugt und zerstört deterministisch und fällt unter keine der drei. Der wirkliche Grund ist ein vierter und ein besserer: **sie prüft die Wächter selbst**, ein Wächter in ihren Hooks wäre zirkulär und ein Defekt in der Assertion könnte sich selbst decken. Die Kategorie steht jetzt in der Regel, die Datei hat ihren Kommentar.
- Ebenfalls in Runde 2 korrigiert: die Regel verlangte den Kommentar »at the `describe(` head«, nannte aber `link.gc.spec.ts` als Beispiel, wo er im Rumpf steht. Formulierung geweitet statt Beispiel getauscht.
- Alle drei CHANGELOG-Zahlen sind vom Reviewer am Baum nachgerechnet: 10 Lecks / 8 Effects / 18 Signale gegen `de36cf0`, und 2 → 36 `finally`-Blöcke in den fünf Dateien, also 34 neue.
- Falscher Alarm, der Erwähnung verdient: Der Implementierer meldete ein »beschädigtes `node_modules` (nur noch 14 Einträge)«, das er per `CI=true pnpm install` repariert habe. 14 Verzeichnisse für 14 eindeutige Pakete **ist** das normale pnpm-Layout — der virtuelle Store liegt in `.pnpm` und wird von `ls` ohne `-a` nicht gezeigt. `package.json` und `pnpm-lock.yaml` sind unverändert; es war nichts kaputt.

**Paket 32 ist damit abgeschlossen.** Alle 44 Spec-Dateien laufen jetzt unter einem Netz, das jedes geleakte Signal, jeden Effect und jeden Link bemerkt — mit fünf begründeten und dokumentierten Ausnahmen. Die Sonde meldet über die ganze Suite null. Das ist die Grundlage, auf der Phase 3 bis 5 arbeiten.


#### [x] 11. Der Retain-Replay in asyncValues() terminiert
- Findings: ASYNC-005 (critical), READ-002 (medium), TEST-022 (medium)
- Ziel: Ein einziger Write dreht `asyncValues()` nicht mehr in eine Microtask-Hot-Loop; die Abonnement-Reihenfolge in `nextValue()` ist getestet, der widersprüchliche Kommentar ist weg.
- Bereich: `src/SignalLink.ts`, `src/link.asyncValues.spec.ts`
- Hängt ab von: Paket 7
- Anmerkung: Beide vorhandenen Specs maskieren den Fehler, weil sie aus dem Schleifenkörper schreiben. Der neue Test kommt ohne schreibenden Körper aus — und er muss rot gesehen werden, bevor der Fix kommt.
- Modell: stärkste Stufe
- Hash: `12759eb`
- Dateien:

  | Datei | Änderung |
  | --- | --- |
  | `src/link.asyncValues.spec.ts` | **zuerst**: drei neue Tests (der Regressionsbeweis), zwei vorhandene Tests bleiben unangetastet |
  | `src/SignalLink.spec.ts` | ein neuer Test im `K1`-Block (TEST-022); **ein** vorhandener Test wird angepasst — der einzige im Repo, der auf dem Fehler steht |
  | `src/SignalLink.ts` | der Fix (ASYNC-005), der Kommentartausch (READ-002), zwei JSDoc-Sätze |
  | `docs/api.md`, `skills/using-signalize/references/api.md` | je ein Satz zur Sampler-Beschreibung |
  | `CHANGELOG.md` | ein Eintrag unter `### Bug Fixes` |

  `src/link.ts` wird **nicht** angefasst. Der Fehler sitzt vollständig in `SignalLink`.
- Abgleich (2026-08-10):
  - **ASYNC-005 unverändert, und als einziges Finding dieses Laufs zeilengenau stehengeblieben.** `async *asyncValues(` steht weiterhin bei `src/SignalLink.ts:304`, `retain(this, VALUE);` bei `:308`, der VALUE-`push` bei `:250-256` (das Finding nennt `:248-254`, zwei Zeilen Drift aus Paket 5). Die drei Bausteine des Fehlers sind alle da: `retain(this, VALUE)` bei `:308`, `once(this, VALUE, …)` bei `:252`, und eventize spielt einen retainten Wert synchron *innerhalb* der Registrierung ab, ohne den Slot zu leeren — belegt in `node_modules/@spearwolf/eventize/lib/index.mjs`: `registerEventListener` stellt bei `keeper.hasRetainedFor(eventName) && (isNewListener || obligation !== null)` einen Replay in die Queue, `subscribeTo` fährt ihn über `publishReplays()` noch vor der Rückgabe, und `EventKeeper.replayTo()` liest den Slot, ohne ihn zu räumen. Nur `keeper.clear()` (= `retainClear`) und `keeper.remove()` (= `unretain`) leeren ihn.
  - **Reproduktion am echten Code, 2026-08-10** — Vitest, Repo-Kopie im Scratchpad, Schleife ohne schreibenden Körper, Notausstieg über `stopAction` bei 500 000: `{"iterations":500001,"yielded":[2,2,2,2,2,2],"macrotaskRan":false,"ms":568}`. Ziffer für Ziffer die Messung des Audits (500 000, `[2,2,2,2,2,2]`, keine Makrotask, 551 ms). Ein einziges `a.set(2)` reicht.
  - **Die beiden vorhandenen Specs maskieren tatsächlich vollständig** und werden trotzdem nicht angefasst: `src/link.asyncValues.spec.ts:33` und `:61` schreiben beide `a.set(val + 1)` aus dem Schleifenkörper, jeder Durchlauf sieht also eine neue Generation. Sie sind nach dem Fix der Beweis, dass der retainte Slot seine Aufgabe behält (Wert kommt an, während der Konsument zwischen zwei Reads steht) — grün vorher wie nachher, gemessen.
  - **READ-002 unverändert, Fundstelle verschoben.** Der Kommentar steht bei `src/SignalLink.ts:251`, nicht bei `:233-235`. Der Widerspruch besteht wie beschrieben: `// we can not just use 'once' here because the value is retained`, direkt darüber der `once(this, VALUE, …)`-Aufruf, 40 Zeilen weiter oben der K1-Block, der dieselbe Retain-Eigenschaft korrekt begründet. **Das Finding wird nicht separat abgearbeitet, sondern vom Fix erledigt:** der Fix ersetzt `once` durch `on`, womit der Satz wieder wahr wird — und er wird durch einen ersetzt, der sagt, warum. Ein vorgezogenes Streichen der Zeile wäre Arbeit, die der Fix zwei Schritte später wegwirft.
  - **TEST-022 unverändert, Fundstelle `src/SignalLink.ts:205-256`** (statt `:209-254`). Der 16-Zeilen-Kommentar steht bei `:211-226`. **M58 nachgemessen am 2026-08-10:** DESTROY-`push` hinter den VALUE-`push` verschoben (Abort-Listener unangetastet, damit die Mutation isoliert bleibt), voller Lauf → **44 Dateien / 496 Tests grün. SURVIVED, bestätigt.** Die Nachbarmutation M60 ist dagegen von den drei vorhandenen `K1`-Tests gedeckt, die `getEventListeners(controller.signal, 'abort').length` prüfen (`src/SignalLink.spec.ts:280`, `:307`, `:334`) — was fehlt, ist genau die Zählung auf dem Link selbst.
  - **Nebenbefund, für dieses Paket entscheidend: ein vorhandener Test steht auf dem Fehler.** `src/SignalLink.spec.ts:317` (`a shared AbortSignal across an asyncValues(stop, {signal}) loop …`) ruft dreimal `iter.next()`, **ohne dazwischen zu schreiben**, und erwartet dreimal `done: false`. Das geht heute nur, weil jeder Read denselben retainten Wert erneut geliefert bekommt. Gegen den Prototyp-Fix läuft dieser Test in seinen 1000-ms-Timeout — und reißt, weil ein Timeout den `finally`-Block des Tests nicht mehr erreicht, **15 weitere Tests derselben Datei** über die Zählerwächter mit (gemessen: 16 rot von 28). Er wird angepasst, nicht gestrichen: sein Gegenstand (kein Listener-Zuwachs auf einem geteilten `AbortSignal`, wenn ein Read über den synchronen Replay auflöst) bleibt vollständig erhalten, wenn zwischen den Reads geschrieben wird — der Replay-Pfad wird dann sogar echter getroffen als heute. Zwei Zeilen Test, eine Zeile Kommentar.
  - **Kein neuer `critical`- oder `high`-Befund.** Was auffiel und keiner ist: der oben gemessene Kollateralradius von 15 ist keine Lücke im Netz aus Paket 32, sondern seine bekannte Grenze — ein `finally` im Testkörper läuft nicht, wenn Vitest den Test wegen Timeouts abbricht. Gegen einen Test, der hängt, hilft nur, dass er nicht hängt; siehe Schritt 1.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/ audit.html` ist leer. Jede Messung lief auf einer `rsync`-Kopie des Baums im Scratchpad mit symbolisch verlinktem `node_modules`; kein `git`-Schreibbefehl war beteiligt.
- Vorgehen:
  1. **Zuerst der Regressionstest, und zwar einer, der terminiert.** Das ist die harte Vorbedingung des Pakets, und sie ist gemessen: ein `for await` über `asyncValues()` **ohne** `stopAction` hängt heute unbegrenzt — die Microtask-Hot-Loop lässt keine Makrotask durch, also feuert auch Vitests eigener `testTimeout` nie. Gemessen am 2026-08-10 mit `timeout: 3000`: nach 45 s extern mit `SIGKILL` beendet, Vitest hatte nie wieder die Kontrolle. **Der Notausstieg muss deshalb im Schleifenkörper sitzen, nicht in der Testinfrastruktur** — konkret in `stopAction`, der einzigen Abbruchbedingung, die synchron innerhalb des Durchlaufs greift. Ein `AbortSignal` täte es nicht: das Abbrechen käme aus einem Timer, und Timer laufen nicht mehr. Mit dem Deckel terminiert der rote Lauf in 5 ms und meldet eine Assertion. Die drei Tests kommen ans Ende von `src/link.asyncValues.spec.ts`, die beiden vorhandenen bleiben unverändert davor stehen. Über den `describe`-Block kommen zwei Konstanten:

     ```ts
     const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

     // Notausstieg *im* Schleifenkörper. Eine durchdrehende asyncValues()-
     // Schleife starves every timer, Vitest's own testTimeout included
     // (measured: killed after 45 s with testTimeout 3000), so the runaway
     // guard has to be the one thing that still runs — stopAction.
     const RUNAWAY = 20;
     ```

     Test 1, der eigentliche Beweis. Kein schreibender Schleifenkörper:

     ```ts
     it('delivers one propagated value once, without a writing loop body (ASYNC-005)', async () => {
       const a = createSignal(23);
       const b = createSignal(0);

       try {
         const con = link(a, b);
         const seen: number[] = [];

         const iteration = (async () => {
           for await (const val of con.asyncValues((_v, i) => i >= RUNAWAY)) {
             seen.push(val);
           }
         })();

         a.set(1);

         await macrotask();

         expect(
           seen.length,
           'the loop must not replay the retained value at itself',
         ).toBeLessThan(RUNAWAY);
         expect(seen).toEqual([1]);

         con.destroy();
         await iteration;

         expect(seen).toEqual([1]);
       } finally {
         destroySignal(a, b);
       }
     });
     ```

     Das `await macrotask()` ist die zweite Hälfte der Aussage: es läuft heute erst, nachdem die Schleife am Deckel angeschlagen ist, und nach dem Fix, während die Schleife wartet. Test 2 hält fest, dass der gewählte Weg parallele Iteratoren nicht beschädigt:

     ```ts
     it('two parallel iterators each see every value once (ASYNC-005)', async () => {
       const a = createSignal(23);

       try {
         const con = link(a, () => {});
         const seenA: number[] = [];
         const seenB: number[] = [];

         const one = (async () => {
           for await (const val of con.asyncValues((_v, i) => i >= RUNAWAY)) {
             seenA.push(val);
           }
         })();
         const two = (async () => {
           for await (const val of con.asyncValues((_v, i) => i >= RUNAWAY)) {
             seenB.push(val);
           }
         })();

         a.set(1);
         await macrotask();
         a.set(2);
         await macrotask();

         expect(seenA).toEqual([1, 2]);
         expect(seenB).toEqual([1, 2]);

         con.destroy();
         await Promise.all([one, two]);
       } finally {
         destroySignal(a);
       }
     });
     ```

     Test 3 ist der Gegenzeuge: er verbietet die billige Lösung, den Retain einfach abzuschaffen. Der Körper ist zwischen zwei Reads beschäftigt, und der Wert, der in dieser Lücke ankommt, muss trotzdem ankommen:

     ```ts
     it('a value that arrives between two reads is still delivered (the retained slot earns its keep)', async () => {
       const a = createSignal(23);

       try {
         const con = link(a, () => {});
         const seen: number[] = [];

         const iteration = (async () => {
           for await (const val of con.asyncValues((_v, i) => i >= RUNAWAY)) {
             seen.push(val);
             await macrotask(); // busy: no VALUE listener subscribed meanwhile
           }
         })();

         a.set(1);
         await macrotask();
         a.set(2); // lands in the retained slot with nobody waiting
         await macrotask();
         await macrotask();

         expect(seen).toEqual([1, 2]);

         con.destroy();
         await iteration;
       } finally {
         destroySignal(a);
       }
     });
     ```

     Alle drei folgen Regel (a) bis (f) aus 7a: Arrange vor dem `try`, `con.destroy()` als Act im `try` (danach wird noch geprüft), der idempotente Gürtel im `finally`. Gemessen: eine gesäte Fehlassertion in Test 1 **und** in Test 2 (dort mit zwei noch geparkten Iteratoren) ergibt jeweils Radius 1, keine Wächtermeldung, kein `Errors 1 error` — der Q5-Nebenbefund aus 7a tritt hier nicht auf, weil ein zerstörter Link die Schleife still beendet, statt eine Rejection freizulassen.
  2. **Den roten Lauf sehen und protokollieren.** `npx vitest run --coverage=false --project unit src/link.asyncValues.spec.ts` → `Tests 3 failed | 2 passed (5)` in ~15 ms. Die erwarteten Meldungen stehen im Verify-Block. Erst danach wird `src/SignalLink.ts` angefasst. Wer hier keinen roten Lauf hat, hat den Notausstieg falsch gesetzt oder schreibt doch aus dem Schleifenkörper.
  3. **Der Weg: die Generation mitführen, nicht den Slot leeren.** Das Audit nennt beide; die Wahl fällt auf die zweite, und sie ist gemessen, nicht geraten.

     *Der Slot-Leerlauf bricht Zusagen, die dieser Lauf gerade erst gegeben hat.* Prototyp Variante A — `retainClear(this, VALUE)` nach jedem gelieferten Wert in `asyncValues()` — bringt zwar alle drei neuen Tests aus Schritt 1 zum Laufen, macht aber **19 von 500 Tests rot**. Der erste Fehlschlag ist `K1: a single nextValue({signal}) resolving via a synchronous retained replay …` (`src/SignalLink.spec.ts:261`), und zwar mit Timeout: ein `nextValue()` neben einem laufenden Iterator löst nicht mehr über den Replay auf, weil der Iterator den Slot geräumt hat. Das ist genau die Zusage aus `CHANGELOG.md:42` und aus MEM-004. Der Rest ist Kollateralschaden desselben Timeouts.

     *Der Zusatz »verträglicher mit parallelen Iteratoren« stimmt und ist am Code prüfbar.* Parallele Iteratoren gibt es wirklich — `#activeAsyncValuesCount` (`src/SignalLink.ts:65`) und der Test `a finishing asyncValues() iterator does not clear the retained value while a sibling iterator is still active` sind für sie gebaut. Sie teilen sich **einen** Slot. Wer ihn nach seinem eigenen Read leert, nimmt ihn dem Geschwister weg, das gerade noch im Körper steckt — Test 3 aus Schritt 1 beschreibt genau diese Lücke, nur für einen Iterator.

     *Und die Generation ist schon da.* `#propagationGeneration` (`:70`) wird pro `updateValue()`-Rahmen hochgezählt, bevor `action()` die Kontrolle bekommt (BUG-008), und überlebende Rahmen emittieren mit genau dieser Nummer. Es braucht **ein** neues Feld und **kein** neues Konzept.
  4. **Der Fix, in vier Griffen.** Gemessen als Prototyp: voller Lauf 44 Dateien / 500 Tests grün, `tsc -p tsconfig.json --noEmit` 0 Fehler, `biome check` sauber, `SignalLink.ts` bleibt bei 100/100/100/100.

     *(4a)* Neben `#propagationGeneration` ein zweites Feld:

     ```ts
     // ASYNC-005: the generation of the value eventize currently holds in its
     // retained VALUE slot — the one a fresh subscription gets replayed, in
     // full, inside its own `on()`/`once()` call. 0 = nothing emitted yet.
     // Only ever compared for equality, like the counter above it.
     #emittedGeneration = 0;
     ```

     *(4b)* In `updateValue()`, eine Zeile vor dem Emit — hinter dem BUG-008-Check, damit ein überholter Rahmen die Nummer nicht bewegt:

     ```ts
     this.#emittedGeneration = generation;
     emit(this, VALUE, value);
     this.lastValue = value;
     ```

     *(4c)* `nextValue()` wird zur Fassade über eine private Fassung mit Cursor. **Die öffentliche Signatur und ihr Verhalten ändern sich nicht** — ein direkt aufgerufenes `nextValue()` übergibt `null` und löst weiter über einen Replay auf, wenn einer daliegt. Das ist Absicht: alles andere wäre eine Verhaltensänderung an einer öffentlichen Methode über die Fehlerbehebung hinaus, und die drei `K1`-Tests bestehen darauf.

     ```ts
     nextValue(options?: {signal?: AbortSignalLike}): Promise<ValueType> {
       return this.#nextValue(null, options);
     }

     #nextValue(
       cursor: {generation: number} | null,
       options?: {signal?: AbortSignalLike},
     ): Promise<ValueType> {
     ```

     Der Rumpf bleibt, bis auf den VALUE-Block, unverändert — insbesondere die Reihenfolge DESTROY → Abort → VALUE und der K1-Kommentar darüber. Der VALUE-Block, an dem auch READ-002 hängt:

     ```ts
     // ASYNC-005: `on`, not `once` — which is what the line that used to
     // stand here ("we can not just use 'once' here because the value is
     // retained") was reaching for, three refactors ago. A retained VALUE is
     // replayed synchronously inside this very call (see the K1 block above),
     // and a replay of a generation this caller has already consumed is not a
     // next value: it has to be ignored *while staying subscribed*. A `once`
     // is spent by the replay, so ignoring it would leave this promise
     // pending for good. A plain `nextValue()` passes no cursor and therefore
     // still settles on the replay, exactly as before.
     let settledInline = false;
     const releaseValue = on(this, VALUE, (val) => {
       if (cursor != null && cursor.generation === this.#emittedGeneration) {
         return;
       }
       if (cursor != null) {
         cursor.generation = this.#emittedGeneration;
       }
       settledInline = true;
       unsubscribe();
       resolve(val);
     });
     if (settledInline) {
       // Settled by the replay, i.e. from inside the `on()` call above:
       // `unsubscribe()` ran before this handle existed, so it walked past
       // it. Release it here instead — the one thing `once` used to do for
       // us, since a spent obligation removes itself.
       releaseValue();
     } else {
       subscriptions.push(releaseValue);
     }
     ```

     Der `if (settledInline)`-Zweig ist nicht kosmetisch: ohne ihn bliebe jeder über einen Replay aufgelöste `nextValue()` mit einem lebenden VALUE-Listener auf dem Link zurück — dieselbe Klasse Leck, die K1 für die anderen beiden Handles beschreibt, nur neu eingebaut. Der neue Test aus Schritt 6 sieht genau das.

     *(4d)* In `asyncValues()`, direkt nach dem Hochzählen von `#activeAsyncValuesCount`, und der eine Aufruf im Rumpf:

     ```ts
     // ASYNC-005: this iterator's own cursor into the shared retained slot.
     // 0 accepts whatever is in the slot right now — a second iterator
     // joining a running one still starts with the current value, as before —
     // and from then on the same generation is never handed out twice.
     const cursor = {generation: 0};
     ```
     ```ts
     const next = await this.#nextValue(cursor, options);
     ```
  5. **Die JSDoc- und Doku-Sätze, in der Reihenfolge aus `CLAUDE.md`.** In `asyncValues()`' JSDoc, in den Absatz über den Sampler, hinter »… same as a single `retain()`'d event anywhere else.«:

     > Each iterator sees each propagated value at most once: a read that finds nothing new waits for the next propagation instead of being handed the retained value again (ASYNC-005). A plain `nextValue()` is unchanged — it still settles on whatever is in the slot.

     `docs/api.md:386-397`, hinter »… it is a sampler, not a lossless stream.«: *Within one iterator every propagated value arrives at most once — a read with nothing new waits for the next propagation.* Dieselbe Aussage, ein Satz, in `skills/using-signalize/references/api.md:175`. `docs/recipes.md:602` und `docs/cheat-sheet.md:102` bleiben, wie sie sind — sie beschreiben den Sampler und den geteilten Slot, und beides gilt unverändert.
  6. **Der Test für TEST-022, in den vorhandenen `K1`-Block.** Er gehört nach `repeated nextValue({signal}) calls …` (`src/SignalLink.spec.ts:290-315`) und vor den Schleifentest. Neu ist die Zählung **auf dem Link**; die Abort-Zählung steht daneben, weil beide Handles an derselben Reihenfolge hängen:

     ```ts
     it('a nextValue({signal}) settling through the replay releases its DESTROY subscription on the link too, repeatedly (TEST-022)', {
       timeout: 500,
     }, async () => {
       const sigA = createSignal(1);
       const controller = new AbortController();

       try {
         const con = link(sigA, () => {});

         const iter = con.asyncValues();
         const p0 = iter.next();
         sigA.set(2);
         await p0;

         // Baseline inside the retained state, with no read pending: the
         // generator sits at its yield, so every listener a nextValue() adds
         // from here on has to be gone again once it settles.
         const baseline = getSubscriptionCount(con);

         for (let i = 0; i < 3; i++) {
           const result = await con.nextValue({signal: controller.signal});
           expect(result).toBe(2);
           expect(
             getSubscriptionCount(con),
             'a replay-resolved nextValue() must leave no listener on the link',
           ).toBe(baseline);
           expect(getEventListeners(controller.signal, 'abort').length).toBe(0);
         }

         await iter.return(undefined as any);
         con.destroy();
       } finally {
         controller.abort();
         destroySignal(sigA);
       }
     });
     ```

     `getSubscriptionCount` und `getEventListeners` sind in dieser Datei bereits importiert (`:5`, `:1`); es kommt kein Import dazu. Der Test ist **vor** dem Fix grün und **nach** dem Fix grün — er ist kein Regressionstest für einen Fehler, sondern ein Wächter über einer Reihenfolge. Sein Wert steht in der Mutationsprobe im Verify-Block: er tötet M58 in beiden Zuständen des Codes, radius 1.
  7. **Den einen vorhandenen Test anpassen, der auf dem Fehler steht.** In `src/SignalLink.spec.ts:340-344`, im Schleifentest des `K1`-Blocks:

     ```ts
     for (let i = 0; i < 3; i++) {
       // Written while the generator sits at its `yield`, i.e. with no VALUE
       // listener subscribed: the emit goes straight into the retained slot,
       // and the `iter.next()` below picks it up through the synchronous
       // replay — K1's trigger, now without relying on the same value being
       // handed out over and over (ASYNC-005).
       sigA.set(3 + i);
       const {value, done} = await iter.next();
       expect(done).toBe(false);
       expect(value).toBe(3 + i);
       expect(getEventListeners(controller.signal, 'abort').length).toBe(0);
     }
     ```

     Gemessen: diese Fassung ist gegen den heutigen Code grün und gegen den gefixten grün, trifft den Replay-Pfad in beiden Fällen und prüft zusätzlich, was geliefert wurde. Sie darf deshalb auch vor dem Fix committet werden, wenn der Implementierer die Reihenfolge Test-vor-Fix strikt fahren will.
  8. **CHANGELOG**, unter `## Unreleased` → `### Bug Fixes`, hinter den drei vorhandenen `asyncValues`-Zeilen:

     > - `SignalLink.asyncValues()` no longer hands the same value to the same iterator over and over: eventize replays a retained event synchronously on subscribe and leaves it in the slot, so from the first propagated value on, every read of the loop resolved instantly with that same value. A `for await` without a `stopAction` never terminated and starved every timer in the process — measured 500 000 iterations of one value without a single macrotask getting through. Each iterator now tracks the propagation it last consumed and waits for the next one instead; a value that arrives while the consumer is busy is still delivered, several iterators still share one retained slot, and `nextValue()` on its own is unchanged (ASYNC-005)
  9. **`pnpm fix`, dann `pnpm check`.** Der neue VALUE-Block liegt an Biomes Zeilenbreite; ein Formatlauf ist erwartet.
- Verify: fünf Teile. Der erste ist der rote Lauf, der zweite der grüne, der dritte die Mutationsprobe, der vierte der Terminierungsbeleg, der fünfte der Baum.
  1. **Rot, vor dem Fix.** `npx vitest run --coverage=false --project unit src/link.asyncValues.spec.ts`. Erwartet: `Tests 3 failed | 2 passed (5)`, Laufzeit im Millisekundenbereich, **kein** Timeout und **kein** Hänger. Die Meldungen, gemessen am 2026-08-10:

     ```
     × delivers one propagated value once, without a writing loop body (ASYNC-005)
       AssertionError: the loop must not replay the retained value at itself: expected 20 to be less than 20
     × two parallel iterators each see every value once (ASYNC-005)
       AssertionError: expected [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, …(10) ] to deeply equal [ 1, 2 ]
     × a value that arrives between two reads is still delivered (…)
       AssertionError: expected [ 1, 2, 2 ] to deeply equal [ 1, 2 ]
     ```

     Der dritte ist der aufschlussreichste: der Wert 2 kommt heute doppelt an — einmal echt, einmal als Replay.
  2. **Grün, nach dem Fix.** `pnpm world` vollständig. Erwartet: neun Schritte grün, **44 Dateien / 500 Tests** in `test` und `test:gc` (496 + 4 neue), Coverage total 99,29 / 95,01 / 99,51 / 99,44 gegen 99,28 / 94,92 / 99,51 / 99,43 aus Paket 32 — die einzige Bewegung nach oben, und `src/SignalLink.ts` bleibt bei **100 / 100 / 100 / 100**. Das ist die eigentliche Zahl: die vier neuen Verzweigungen (`cursor` gesetzt/nicht, Generation gleich/verschieden, `settledInline` wahr/falsch) sind alle von den Tests dieses Pakets abgedeckt, sonst fällt die Tier-3-Schwelle aus `vitest.config.ts:20-25`.
  3. **Die Mutationsprobe für TEST-022 (M58).** Sie muss **zweimal** laufen: gegen den Code vor dem Fix (dort ist sie die Rechtfertigung des Tests) und gegen den Code danach (dort ist sie die Abnahme). Der Block räumt hinter sich auf und fasst kein `git` an:

     Das Skript schiebt den DESTROY-`push` ans Ende des Promise-Rumpfes, also *hinter* die VALUE-Registrierung, und funktioniert unverändert in beiden Codezuständen — am 2026-08-10 in beiden nachgefahren:

     ```bash
     cp src/SignalLink.ts /tmp/SignalLink.ts.bak
     python3 - <<'EOF'
     p = 'src/SignalLink.ts'; s = open(p).read()
     d = ("      subscriptions.push(\n        once(this, DESTROY, () => {\n"
          "          unsubscribe();\n          reject(\n"
          "            new Error('SignalLink destroyed before the next value arrived'),\n"
          "          );\n        }),\n      );\n\n")
     assert s.count(d) == 1
     s = s.replace(d, '', 1)
     end = s.index('    });\n  }')   # Ende des nextValue-Promise-Rumpfes
     open(p, 'w').write(s[:end] + d + s[end:])
     EOF
     npx vitest run --coverage=false src/SignalLink.spec.ts 2>&1 | grep -E '^ *Tests '
     cp /tmp/SignalLink.ts.bak src/SignalLink.ts && rm /tmp/SignalLink.ts.bak
     ```

     Erwartet und gemessen, in beiden Zuständen identisch: **`Tests 1 failed | 28 passed (29)`** — es fällt genau der neue Test, mit `a replay-resolved nextValue() must leave no listener on the link: expected 2 to be 1`. Radius 1, kein anderer Test wackelt. Zum Vergleich, ebenfalls gemessen: dieselbe Mutation gegen den heutigen Code **ohne** den neuen Test → 44 Dateien / 496 Tests grün, SURVIVED.
  4. **Der Terminierungsbeleg.** Zwei Zahlen, beide mit einer Wegwerf-Spec im Scratchpad, nicht in `src/`:
     - vor dem Fix, Schleife ohne schreibenden Körper und mit Notausstieg bei 500 000: `iterations 500001 · yielded [2,2,2,2,2,2] · macrotaskRan false · 568 ms`;
     - nach dem Fix, dieselbe Spec: der Lauf terminiert nicht mehr über den Notausstieg, sondern wartet — die Schleife steht nach einem gelieferten Wert, und Vitests `testTimeout` greift wieder (er greift, weil Makrotasks wieder durchkommen). Im Testkörper der Suite ist das dieselbe Aussage, nur als Assertion: `seen` hat nach einer Makrotask genau einen Eintrag statt `RUNAWAY`.

     Wer den Beleg nachbauen will: `for await` **ohne** `stopAction` und ohne Notausstieg hängt vor dem Fix unbegrenzt (gemessen: nach 45 s extern gekillt, `testTimeout: 3000` hat nie gefeuert). Diese Form gehört in keine Spec-Datei.
  5. **Der Baum.** `git status --porcelain --untracked-files=all` zeigt die fünf geänderten Dateien plus `remediation-plan.md`, kein `/tmp/*.bak`, keine Wegwerf-Spec in `src/`, und `grep -rn 'zz-' src/` ist leer.
- Commit: `fix(link): stop asyncValues() from replaying the retained value at itself (ASYNC-005, READ-002, TEST-022)`

<details>
<summary>ASYNC-005, READ-002 und TEST-022 im Volltext (aus <code>audit.html</code>)</summary>

**ASYNC-005 — Den Retain-Replay in asyncValues() abbrechen — ein einziger Write dreht die Schleife endlos**
Severity: critical · Kategorie: Async & Concurrency · Effort: M
Location: `src/SignalLink.ts:304` · `src/SignalLink.ts:308-333` · `src/SignalLink.ts:248-254`

> `asyncValues()` setzt `retain(this, VALUE)`, und jeder Durchlauf ruft `nextValue()`, das mit `once(this, VALUE, …)` abonniert. Eventize spielt einen retainten Wert synchron beim Registrieren ab und leert den Slot dabei nicht. Ab dem ersten propagierten Wert löst deshalb jedes `nextValue()` sofort mit demselben Wert auf: die `for await`-Schleife wird zur Microtask-Hot-Loop, liefert denselben Wert unbegrenzt oft und lässt keine Makrotask mehr durch. Ohne `stopAction` terminiert sie nie. Beide Specs in `link.asyncValues.spec.ts` schreiben aus dem Schleifenkörper heraus einen neuen Wert und maskieren das vollständig.

> Empfehlung: Nach jedem gelieferten Wert den retainten Slot leeren, oder — verträglicher mit parallelen Iteratoren — die vorhandene `#propagationGeneration` mitführen und ein Replay verwerfen, dessen Generation der Iterator schon gesehen hat. Danach ein Test ohne schreibenden Schleifenkörper.

> Evidence: Messung gegen frisch kompiliertes `lib/`: ein `s.set(2)`, danach `iterations = 500000` (nur durch den Notausstieg begrenzt), `yielded = [2,2,2,2,2,2]`, `setTimeout(0) gelaufen: false`, 551 ms Wandzeit.

**READ-002 — Den überholten once-Kommentar in nextValue() korrigieren**
Severity: medium · Kategorie: Lesbarkeit & Clean Code · Effort: S
Location: `src/SignalLink.ts:233-235`

> Direkt über dem Aufruf steht `// we can not just use 'once' here because the value is retained` — und die Zeile darunter ist ein `once(this, VALUE, …)`. Der Kommentar beschreibt eine Fassung, die es nicht mehr gibt, und widerspricht dem ausführlichen Begründungsblock 40 Zeilen darüber, der die tatsächliche Ursache nennt. Wer dem falschen Kommentar folgt, sucht nach einem `on()`-Konstrukt, das nirgends existiert.

> Empfehlung: Die Zeile streichen oder durch einen Rückverweis auf den Block darüber ersetzen.

**TEST-022 — Die Abonnement-Reihenfolge in nextValue() festnageln**
Severity: medium · Kategorie: Testabdeckung & Teststrategie · Effort: S
Location: `src/SignalLink.ts:209-254`

> Ein 16-zeiliger Kommentar begründet, warum DESTROY und der Abort-Listener *vor* VALUE abonniert werden: `asyncValues()` retained VALUE, und ein retained Event wird synchron innerhalb des `once()`-Aufrufs zugestellt — bei umgekehrter Reihenfolge liefe das `unsubscribe()` über ein leeres Array und ließe die anderen beiden Handles hängen. Die Reihenfolge lässt sich umdrehen, ohne dass ein Test rot wird.

> Empfehlung: Innerhalb eines `asyncValues()`-Laufs (VALUE ist dann retained) `nextValue({signal})` aufrufen, auflösen lassen und danach `getSubscriptionCount(link)` sowie die Listener am `AbortSignal` gegen die Baseline prüfen.

> Evidence: M58 (VALUE-`push` vor den DESTROY-`push`): SURVIVED. Der benachbarte Abort-Fall M60: KILLED mit 21 Fehlschlägen.

</details>

- **Ergebnis (2026-08-10)** — Hash `12759eb`. **Das letzte `critical` des Audits ist zu.** Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 44 Dateien / **503 Tests** (vorher 496), Coverage 99,30 / 95,05 / 99,52 / 99,45, `src/SignalLink.ts` bleibt bei 100/100/100/100.
- **Rot gesehen, bevor gefixt wurde.** Die drei Regressionstests fallen gegen den ungefixten Stand in 17 ms als Assertion — nicht als Timeout: `expected 20 to be less than 20`, `[1,1,1,…] to deeply equal [1,2]`, `[1,2,2] to deeply equal [1,2]`. Der Notausstieg sitzt in der `stopAction` (`RUNAWAY = 20`), weil ein `for await` gegen den Fehler jeden Timer verhungern lässt, Vitests eigenen `testTimeout` eingeschlossen — der Planer musste extern nach 45 Sekunden killen.
- **Terminierung, gemessen in drei Codezuständen**: vorher `{"iterations":500000,"macrotaskRan":false,"ms":587}`, nachher `{"iterations":1,"yielded":[2],"macrotaskRan":true,"ms":50}`. Der Reviewer hat zusätzlich **ohne `stopAction`** geprüft: die Schleife parkt, die Makrotask feuert, drei Writes ergeben exakt `[1,2,3]`, und sie endet auf `destroy()`.
- **Der naheliegende Weg war der falsche.** Der Planer hat beide vom Audit genannten Varianten gebaut: `retainClear` nach jedem Wert macht **19 von 500 Tests rot** und bricht als erstes die K1/MEM-004-Zusage aus dem letzten Remediation-Lauf (`CHANGELOG.md:42`) — mit einem Timeout. Gewählt wurde die Generation: ein Feld `#emittedGeneration`, ein privater `#nextValue(cursor, options)` hinter dem unveränderten öffentlichen `nextValue()`, `on` statt `once`. Womit der Kommentar aus READ-002 wieder wahr wird, statt gestrichen zu werden.
- **Runde 1 fand eine Regression, die der Fix selbst eingeführt hatte**, und dabei einen zweiten, älteren Defekt. `.return()` auf einem leerlaufenden Iterator settelte nicht mehr — drei Subscriptions blieben stehen, `#activeAsyncValuesCount` fiel nie auf 0, und `docs/api.md:392` versprach genau das Gegenteil. Der Reviewer schlug eine Doku-Korrektur vor; ich habe stattdessen die Reparatur beauftragt, weil eine dokumentierte Zusage wegzuschreiben eine Verschlechterung der öffentlichen Oberfläche wäre. Der Implementierer hat sie gebaut und die Ursache richtig verortet: nicht in den vier Verzweigungen des Fixes, sondern in der Generator-Semantik — ein `async function*`, das in einem `await` suspendiert, stellt `.return()` hinter den laufenden Read. Gemessen, vom Reviewer unabhängig reproduziert:

  | | A: nach konsumiertem Wert, Read im Leerlauf | B: vor dem ersten Wert |
  | --- | --- | --- |
  | vor Paket 11 | settled | **PENDING** |
  | Fix ohne W1 | **PENDING** | **PENDING** |
  | jetzt | settled | settled |

  **Fall B war vorbestehend kaputt und hat keine Finding-ID** — er ist ohne Audit-Grundlage mitgenommen worden, weil derselbe Abbruchgriff ihn ohne eine einzige zusätzliche Zeile Produktivcode schließt. Der Zustand nach dem Paket ist damit besser als vor ihm, nicht nur wiederhergestellt.
- Der Reviewer hat die Fassade um `asyncValues()` hart geprüft: das emittierte `.d.ts` ist zwischen dem Vorstand und jetzt **byte-identisch**, `Object.prototype.toString` liefert `[object AsyncGenerator]`, `[Symbol.asyncIterator]()` gibt `this`, ein zweites und drittes `.return()` laufen durch. Dazu sechs Adversarial-Fälle um das Cancel-Fenster (aus einem VALUE-Listener vor und nach dem Read-Listener, `destroy()`+`return()`, `abort()`+`return()`, zwei synchrone `return()`, Wert und `return()` im selben Block) — jedes Mal Subs-Delta 0 und `retained: []`. Ein echtes `AbortSignal` nimmt weiterhin den dokumentierten Weg; der interne Cancel-`Error` entkommt nie einem `for await`.
- TEST-022: Die Mutation M58 (DESTROY-`push` hinter die VALUE-Registrierung) tötete vorher niemanden. Der neue Test tötet sie in beiden Codezuständen mit Radius 1 — und er misst wirklich die Reihenfolge: steht DESTROY hinter VALUE, löst der Inline-Replay auf, bevor das DESTROY-Handle existiert, und jeder Aufruf lässt einen Listener stehen.
- Ein vorhandener Test stand auf dem Fehler: `src/SignalLink.spec.ts:317` las dreimal ohne zu schreiben und wäre gegen den Fix in seinen Timeout gelaufen — der hätte **15 weitere Tests** mitgerissen, weil ein Timeout das `finally` des Tests nicht erreicht. Er wurde angepasst, nicht gestrichen; der Reviewer hat über eine Mutation belegt, dass er seinen Gegenstand behalten hat.
- Vier kleine Befunde aus Runde 0, alle behoben: zwei Kommentare, die einen vom Fix entfernten `once()`-Aufruf nannten (dieselbe Defektklasse, die READ-002 beanstandet, neu erzeugt in der Datei, die das Paket aufräumen sollte); ein `#emittedGeneration`-Kommentar, der mehr behauptete als das Feld tut; und `settledInline`, das seinen Namen nicht hielt — heißt jetzt `hasSettled`, mit der Falle im Kommentar benannt.
- **Zwei neue kleine Befunde aus der zweiten Runde, für das nächste Audit:**
  - `src/SignalLink.ts:393-395` und `docs/api.md:399-402` — die W1-Zusage gilt nur für das zurückgegebene Objekt selbst. Ein äußerer `async function*` mit `yield* con.asyncValues()`, dessen `.return()` während eines wartenden inneren Reads gerufen wird, bleibt **PENDING**; zwei Subscriptions bleiben stehen. Keine Regression, aber »closing works at any time« ohne Einschränkung lädt dazu ein. Ein Nebensatz würde reichen.
  - `src/SignalLink.ts:466-470` — `.throw()` verhält sich jetzt in zwei Zuständen entgegengesetzt: mit pendendem Read rejectet es mit dem übergebenen Fehler, am `yield` geparkt wird derselbe Aufruf von der S9-`catch`-Klausel verschluckt und der Iterator endet normal. Das Schlucken ist vorbestehend; vor dieser Runde settelte die andere Hälfte nie, es gab also keinen Widerspruch zu sehen. Getestet ist nur die freundliche Hälfte.
  - Offen und kosmetisch: kurze Hängezeilen mitten im Absatz in `docs/api.md:387-389` und `skills/using-signalize/references/api.md:175-178`; `CHANGELOG.md:48` bündelt noch zwei Fakten in einer Zeile. Paket 30.


#### [x] 12. Zwei Rahmen, die einen werfenden Callback überleben müssen
- Findings: ASYNC-001 (high), BUG-012 (medium)
- Ziel: `hibernate()` stellt seine drei Zustände auch dann wieder her, wenn der Flush wirft; `batch()` verschluckt den Fehler seines Callbacks nicht mehr hinter einem Effect-Fehler.
- Bereich: `src/hibernate.ts`, `src/batch.ts`
- Hängt ab von: Paket 8
- Anmerkung (2026-08-10, aus Paket 32): **Das Netz, das ab jetzt unter diesem Paket liegt.** `src/batch.spec.ts` war bis Paket 32 die einzige Datei im Bereich ganz ohne Wächter — ein `batch()`, das nach einem Wurf einen Effect oder ein Signal stehenlässt, fiel dort niemandem auf; jetzt melden alle drei Zähler, und alle elf Tests räumen im `finally` ab. `src/hibernate.spec.ts` bekommt zusätzlich `assertLinksCount`.
- Modell: stärkste Stufe
- Hash: `e10c51e`
- Dateien: zwei Produktionsdateien, zwei Spec-Dateien, kein neuer Export, keine neue Datei.

  | Datei | Änderung |
  | --- | --- |
  | `src/hibernate.spec.ts` | **zuerst**: ein neuer Test ans Ende von `describe('exception handling')`; vier Importzeilen erweitert |
  | `src/batch.spec.ts` | **zuerst**: fünf neue Tests in einem neuen `describe`-Block ans Ende der Datei |
  | `src/hibernate.ts` | der Fix (ASYNC-001) — der Flush wandert in den `try`, der Kommentar wandert mit |
  | `src/batch.ts` | der Fix (BUG-012) — ein `catch` um den Callback, ein `catch` um den Flush, `throwCollectedErrors()` am Ende; ein neuer Name im vorhandenen Import aus `./collect-errors.js` |
  | `docs/api.md` | zwei Sätze: `batch()` (Zeile 444-446) und `hibernate()` (Zeile 479) |
  | `skills/using-signalize/references/api.md` | ein Halbsatz an Zeile 195 |
  | `CHANGELOG.md` | zwei Einträge unter `### Bug Fixes`, einer unter `### Breaking Changes` |

  `src/bequiet.ts`, `src/globalEffectStack.ts` und `src/collect-errors.ts` werden **nicht** angefasst. Die drei Rahmen sind in Ordnung; kaputt ist nur, wer sie aufruft.
- Abgleich (2026-08-10): beide Findings unverändert gültig, beide zeilengenau. Alle Zahlen unten auf einer `rsync`-Kopie von HEAD (`f245356`) im Scratchpad gemessen, `node_modules` symbolisch verlinkt, nie im Arbeitsbaum, kein `git`-Schreibbefehl beteiligt. Baseline der Kopie: 44 Dateien / **503 Tests** grün, `batch.ts` und `hibernate.ts` je 100/100/100/100.
  - **ASYNC-001 unverändert, Fundstelle exakt `src/hibernate.ts:32-35`.** `if (savedBatch) { savedBatch.flush(); }` steht vor `try {` in Zeile 37, die drei `restore*`-Aufrufe stehen im `finally` bei `:41-43`. Der Flush ruft `Batch.flush()` → `Batch.run()` (`src/batch.ts:33-36`), und `run()` wirft über `endIsolatedDelivery()`, sobald ein verzögerter Effect gescheitert ist. Zwischen `clearBatch()/clearBeQuiet()/clearGlobalEffectStack()` (`:28-30`) und dem `try` liegt also ein Fenster, in dem alle drei Zustände geleert sind und niemand sie zurücklegt.
  - **Reproduktion ASYNC-001, drei Zustände einzeln.** Aufbau: ein Effect, der wirft, sobald `a > 0`; `batch(() => { setA(1); beQuiet(() => runWithinEffect(host, () => hibernate(…))) })`. Gemessen unmittelbar vor und unmittelbar nach dem `hibernate()`-Aufruf, an der Stelle, an der der Aufrufer den Wurf abfängt:

    | Zustand | vor `hibernate()` | nach dem Wurf, heute | Soll |
    | --- | --- | --- | --- |
    | `getCurrentBatch()` | die `Batch`-Instanz mit einem verzögerten Effect | `undefined` | dieselbe Instanz |
    | `getBeQuietCount()` | `1` | `0` | `1` |
    | `getCurrentEffect()` | `host` | `undefined` | `host` |

    Der Callback von `hibernate()` läuft dabei **nie** — der Flush wirft davor. Das ist heute wie nach dem Fix so; nur trägt der Fix die Zustände über den Wurf.
  - **Was davon dauerhaft liegen bleibt, ist genau einer der drei — und es ist der, den niemand sieht.** Batch und Effect-Stack reparieren sich zufällig selbst: `batch()` setzt `Batch.current = undefined` in seinem eigenen `finally`, `runWithinEffect()` poppt in seinem. Der `beQuiet`-Zähler nicht: `hibernate()` hat ihn auf 0 gesetzt, das `finally` von `beQuiet()` zählt beim Verlassen auf **-1** herunter. Gemessen nach Verlassen aller Rahmen: `getBeQuietCount() === -1`. Folge: das nächste `beQuiet(() => …)` im Prozess zählt auf 0 hoch, `isQuiet()` liefert `false`, und die stille Lesung ist ab da wirkungslos — ohne Ausnahme, ohne Warnung, für die Lebensdauer des Moduls. In der Erstmessung schlug genau das durch: die zweite Probe im selben Lauf sah `getBeQuietCount() === 0` statt `1`, weil die erste den Zähler vergiftet hatte.
  - **BUG-012 unverändert, Fundstelle exakt `src/batch.ts:151-156`.** Das `finally` bei `:151`, `curBatch.run()` bei `:154`. Ein `throw` aus einem `finally` ersetzt in JS den propagierenden Fehler ersatzlos; es gibt kein `cause` und keine Sammlung.
  - **Reproduktion BUG-012, ziffergleich mit der `evidence` des Findings.** `batch(() => { s.set(1); throw new Error('CALLER-error') })` bei einem Effect, der im Flush `EFFECT-error` wirft → beim Aufrufer kommt an: `Error: EFFECT-error`, `cause === undefined`, `errors === undefined`. Der Callback-Fehler existiert danach nirgends mehr.
  - **Die zweite Hälfte des Findings ebenfalls reproduziert.** Derselbe Aufbau mit `return {then: () => {}}` statt `throw` → beim Aufrufer kommt `Error: EFFECT-error` an, **kein `TypeError`**. Die `TypeError`-Wache aus ASYNC-003, die JSDoc (`src/batch.ts:113-122`) und `docs/api.md:433` als harten Fehler am Aufrufort zusagen, ist damit heute genau dann still, wenn im selben Batch irgendein Effect scheitert — also im Fehlerfall, für den sie gebaut wurde.
  - **Die Wechselwirkung, und sie ist keine Kosmetik: BUG-012 verschluckt den Regressionstest für ASYNC-001.** Der erste Testentwurf schrieb die Beobachtungen als `expect()` *innerhalb* des Batch-Callbacks und klammerte das Ganze in `expect(() => batch(…)).toThrow('effect boom')`. Gemessen: **grün, gegen den ungefixten Code.** Die `AssertionError` der inneren Prüfung propagiert aus dem Callback, `curBatch.run()` im `finally` wirft `effect boom` hinterher und ersetzt sie, und das äußere `toThrow` nickt den Ersatz ab. Der Test hätte den Fix bezeugt, ohne ihn je zu prüfen. **Deshalb steht in dem Test unten kein einziges `expect()` innerhalb des Batches**: die drei Beobachtungen werden in ein Objekt geschrieben und danach geprüft, wo nichts sie mehr überschreiben kann. Der Test ist damit gegen beide Codezustände von `batch.ts` unempfindlich — er misst ASYNC-001 und nur ASYNC-001.
  - **Die Falle beim Selbstaufräumen, gemessen.** Der ASYNC-001-Test hinterlässt gegen den ungefixten Code `getBeQuietCount() === -1`, und **kein Wächter aus Paket 32 sieht das** — Effects, Signale und Links stimmen ja. Nachgewiesen mit einem Sondentest direkt hinter dem neuen Test, der nichts weiter tut als `beQuiet(() => getBeQuietCount())`: ohne Selbstaufräumen **2 rote Tests** (`counter inside the frame: expected +0 to be 1`), mit `clearBeQuiet()` im `finally` **1 roter Test**, der neue selbst. Der Test nimmt seinen Schaden also selbst zurück, und die Zeile ist nach dem Fix ein No-op, weil der Zähler dann ohnehin auf 0 steht.
  - **Die Wurfform ändert sich, in genau einem Fall, und der Fall ist der defekte.** Vier Kombinationen, gemessen gegen beide Codezustände:

    | Fall | heute | nach dem Fix |
    | --- | --- | --- |
    | nur der Callback wirft | der Fehler selbst, identisch | unverändert — `throwCollectedErrors()` gibt einen einzelnen Fehler unverändert weiter |
    | nur der Flush wirft | der Effect-Fehler (bzw. dessen `AggregateError`) | unverändert |
    | beide werfen | **der Callback-Fehler ist weg** | `AggregateError`, `errors: [Callback-Fehler, Flush-Fehler]` |
    | nichts wirft | nichts | unverändert, und **keine Allokation** — das Fehler-Array entsteht erst beim ersten Wurf |

    Damit geht der Fix nicht über die Fehlerbehebung hinaus; die Halte-Bedingung des Pakets tritt nicht ein. Die Zusage im JSDoc (`src/batch.ts:124-126`) und in `docs/api.md:444-446` nennt `AggregateError` bereits als mögliche Wurfform von `batch()` — der Fix weitet sie auf einen Fall aus, in dem heute Information verloren geht, statt ihr zu widersprechen. **Trotzdem ein Breaking-Changes-Eintrag**, und zwar nach Präzedenz im selben `## Unreleased`-Block: der Eintrag zu BUG-004 (»A `set()` on a signal with both a failing effect and a throwing `link()` callback now throws an `AggregateError` … where it used to throw the effect's error alone«) beschreibt dieselbe Formänderung aus demselben Grund und steht dort. Ein `catch`, das heute `err.message === 'CALLER-error'` liest, sieht nach dem Fix den Wrapper.
  - **`throwCollectedErrors()` wählt die Form, nicht dieses Paket** (`src/collect-errors.ts:17-24`): null → nichts, eins → unverändert durchgereicht, mehrere → `AggregateError` mit `[signalize] N errors while <what>`. `what` heißt hier `'running a batch'`, in Abgrenzung zu `'flushing a batch of signal writes'`, das `Batch.run()` intern schon benutzt (`src/batch.ts:80`). Ein Flush, der selbst schon mehrere Effect-Fehler gebündelt hat, kommt als **verschachtelter** `AggregateError` an — nichts wird geplättet, wie überall sonst, wo dieser Helfer benutzt wird; `docs/recipes.md:244-246` sagt das bereits zu.
  - **Kein Import-Zyklus.** `src/batch.ts` importiert bereits aus `./collect-errors.js`; hinzu kommt nur ein weiterer Name im vorhandenen `import`. `collect-errors.ts` ist die Blattschicht (Kommentar `:1-3`) — `pnpm bundle` bleibt zyklenfrei, nachgeprüft: `rollup -c rollup.config.mjs` läuft mit den Fixes durch.
  - **Nebenbefund, gemessen, nicht in diesem Paket behoben:** Wirft der Flush, den `hibernate()` auslöst, so bleibt der verzögerte Effect in `delayedEffects` stehen — `Batch.flush()` (`src/batch.ts:33-36`) setzt `delayedEffects.length = 0` erst *nach* `this.run()`, und `run()` ist geworfen. Der wiederhergestellte Batch ruft denselben Effect beim Schließen also ein zweites Mal auf: gemessen **2 Läufe** des werfenden Effects, sowohl auf der Baseline als auch mit beiden Fixes. Vorbestehend, von keinem der beiden Findings berührt, und ein `try`/`finally` in `flush()` wäre eine Verhaltensänderung ohne Finding. Gehört zu Paket 15, das `batch.ts` umbaut; der neue Test hält den heutigen Stand mit einer Assertion fest, damit die Änderung dort begründet werden muss statt zu passieren.
  - **Kein neuer `critical`- oder `high`-Befund.** Was auffiel und keiner ist: dass ein `finally` einen Fehler ersetzen kann, ist an genau zwei weiteren Stellen im Repo relevant, und beide sind bereits sauber — `Batch.run()` verschachtelt sein `finally` ausdrücklich (`src/batch.ts:71-82`), und `endIsolatedDelivery()` stellt den Modulzustand vor dem Wurf wieder her (`src/collect-errors.ts:78-81`).
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/ docs/ audit.html CHANGELOG.md` ist leer.
- Vorgehen: sechs Schritte. Der Wortlaut unten ist der gemessene — er compiliert (`tsc --noEmit -p tsconfig.json`, 0 Fehler), formatiert unverändert durch (`biome check` über die vier Dateien, keine Korrektur) und ist in beiden Codezuständen gefahren.
  1. **Zuerst der Regressionstest für ASYNC-001.** Ans Ende von `describe('exception handling')` in `src/hibernate.spec.ts`, hinter `restores effect stack when callback throws` — Modulzustand gehört ans Ende eines Blocks, aus demselben Grund wie in Paket 8. Vier vorhandene Importzeilen wachsen, **keine fünfte kommt dazu**:

     ```ts
     import {batch, getCurrentBatch} from './batch.js';
     import {beQuiet, clearBeQuiet, getBeQuietCount, isQuiet} from './bequiet.js';
     import {EffectImpl} from './EffectImpl.js';
     import {getCurrentEffect, runWithinEffect} from './globalEffectStack.js';
     ```

     `EffectImpl` steht heute als `import type` da und wird zum Wert-Import — die vorhandenen Verwendungen (`let impl: EffectImpl | undefined`) bleiben gültig, Biome verlangt kein `type` mehr, sobald der Name als Wert vorkommt. Der Test:

     ```ts
     it('restores all three contexts when the flushed batch throws (ASYNC-001)', () => {
       // The flush used to sit *before* the `try`, so an effect that threw in
       // it skipped all three `restore*` calls. Two of the three repair
       // themselves on the way out (`batch()` resets `Batch.current`,
       // `runWithinEffect()` pops the stack) — the quiet counter does not, and
       // is left one below where it started, for the rest of the process.
       //
       // Not a single `expect()` runs inside the batch callback: an assertion
       // failure in there is thrown away by `Batch.run()` in `batch()`'s
       // `finally` (BUG-012, fixed in the same package). The observations are
       // recorded and asserted afterwards, where nothing can overwrite them.
       const {get: a, set: setA} = createSignal(0);
       const boom = createEffect(() => {
         if (a() > 0) {
           throw new Error('effect boom');
         }
       });
       const host = new EffectImpl(() => {});

       const seen: Record<string, unknown> = {hibernateCallbackRan: false};
       let escaped: unknown;

       try {
         try {
           batch(() => {
             setA(1); // queues `boom`, which throws on the next flush

             beQuiet(() => {
               runWithinEffect(host, () => {
                 seen.batchBefore = getCurrentBatch();
                 seen.quietBefore = getBeQuietCount();
                 seen.effectBefore = getCurrentEffect();

                 try {
                   hibernate(() => {
                     seen.hibernateCallbackRan = true;
                   });
                 } catch (err) {
                   seen.thrown = err;
                 }

                 seen.batchAfter = getCurrentBatch();
                 seen.quietAfter = getBeQuietCount();
                 seen.effectAfter = getCurrentEffect();

                 return () => {};
               });
             });

             seen.quietAfterFrame = getBeQuietCount();
           });
         } catch (err) {
           escaped = err;
         }

         // preconditions: all three contexts were set when hibernate() was called
         expect(seen.batchBefore).toBeDefined();
         expect(seen.quietBefore).toBe(1);
         expect(seen.effectBefore).toBe(host);

         // the flush throws before the hibernate callback gets to run
         expect((seen.thrown as Error)?.message).toBe('effect boom');
         expect(seen.hibernateCallbackRan).toBe(false);

         // ASYNC-001: the three restores must have run anyway
         expect(seen.batchAfter, 'the batch context is back').toBe(
           seen.batchBefore,
         );
         expect(seen.quietAfter, 'the quiet frame is back').toBe(1);
         expect(seen.effectAfter, 'the effect stack is back').toBe(host);

         // and the quiet counter closes at zero instead of going negative
         expect(seen.quietAfterFrame, 'the quiet frame closed cleanly').toBe(0);

         // The failed flush never reached `delayedEffects.length = 0`, so the
         // restored batch still holds `boom` and recalls it once more when it
         // closes. Pre-existing, unchanged by this fix, asserted so the next
         // change to batch.ts has to say so.
         expect((escaped as Error)?.message).toBe('effect boom');
       } finally {
         // The quiet counter is module state and no counter guard can see it:
         // without the fix this test leaves it at -1, and every later
         // `beQuiet()` in this file would then count 0 and report `isQuiet()`
         // as false. The test takes its own damage back.
         clearBeQuiet();
         host.destroy();
         boom.destroy();
         destroySignal(a);
       }
     });
     ```

     Drei Dinge daran sind nicht Geschmack, sondern gemessen: das `clearBeQuiet()` im `finally` (ohne es sind es 2 rote Tests statt 1, siehe Abgleich), das Fehlen jeder Assertion innerhalb des Batches (sonst grün gegen den defekten Code, siehe Abgleich), und `new EffectImpl(() => {})` als Halter für den Effect-Stack — dieselbe Bauweise wie in `src/globalEffectStack.spec.ts:27`, ohne Autorun, `host.destroy()` im `finally` bringt `getEffectsCount()` zurück auf 0.
  2. **Dann die fünf Regressionstests für BUG-012**, als neuer `describe`-Block ans Ende von `src/batch.spec.ts`, hinter `describe('effect priority inside a batch (TEST-002)')` und mit einer Leerzeile davor. Keine neue Importzeile — `batch`, `getCurrentBatch`, `createSignal`, `createEffect`, `destroySignal` stehen alle schon oben.

     ```ts
     describe('the callback error survives a failing flush (BUG-012)', () => {
       it('reports both the callback error and the effect error, as an AggregateError', () => {
         const {get: a, set: setA} = createSignal(0);
         const boom = createEffect(() => {
           if (a() > 0) {
             throw new Error('effect boom');
           }
         });

         try {
           const callbackError = new Error('callback boom');
           let caught: unknown;

           try {
             batch(() => {
               setA(1); // queues `boom` for the flush in the `finally`
               throw callbackError;
             });
           } catch (err) {
             caught = err;
           }

           // The flush runs in `batch()`'s `finally`; its error used to replace
           // the callback's without a trace — no `cause`, no `errors`.
           expect(caught).toBeInstanceOf(AggregateError);

           const errors = (caught as AggregateError).errors;
           expect(errors).toHaveLength(2);
           expect(errors[0], 'the callback error comes first').toBe(callbackError);
           expect((errors[1] as Error).message).toBe('effect boom');

           expect(getCurrentBatch()).toBeUndefined();
         } finally {
           boom.destroy();
           destroySignal(a);
         }
       });

       it('does not let a failing effect swallow the thenable TypeError', () => {
         const {get: a, set: setA} = createSignal(0);
         const boom = createEffect(() => {
           if (a() > 0) {
             throw new Error('effect boom');
           }
         });

         try {
           let caught: unknown;

           try {
             batch(() => {
               setA(1);
               // biome-ignore lint/suspicious/noThenProperty: intentionally building a non-promise thenable, as in the ASYNC-003 block above
               return {then: () => {}};
             });
           } catch (err) {
             caught = err;
           }

           // The guard is documented as a hard error at the call site. A failing
           // effect in the same batch used to make it disappear entirely.
           expect(caught).toBeInstanceOf(AggregateError);

           const errors = (caught as AggregateError).errors;
           expect(errors).toHaveLength(2);
           expect(errors[0]).toBeInstanceOf(TypeError);
           expect((errors[0] as TypeError).message).toContain(
             '[signalize] batch:',
           );
           expect((errors[1] as Error).message).toBe('effect boom');
         } finally {
           boom.destroy();
           destroySignal(a);
         }
       });

       it('rethrows a lone callback error unchanged, without wrapping it', () => {
         const callbackError = new Error('callback boom');
         let caught: unknown;

         try {
           batch(() => {
             throw callbackError;
           });
         } catch (err) {
           caught = err;
         }

         expect(caught, 'the single error keeps its identity').toBe(callbackError);
         expect(getCurrentBatch()).toBeUndefined();
       });

       it('rethrows a lone flush error unchanged, without wrapping it', () => {
         const {get: a, set: setA} = createSignal(0);
         const boom = createEffect(() => {
           if (a() > 0) {
             throw new Error('effect boom');
           }
         });

         try {
           let caught: unknown;

           try {
             batch(() => {
               setA(1);
             });
           } catch (err) {
             caught = err;
           }

           expect(caught).toBeInstanceOf(Error);
           expect(caught).not.toBeInstanceOf(AggregateError);
           expect((caught as Error).message).toBe('effect boom');
         } finally {
           boom.destroy();
           destroySignal(a);
         }
       });

       it('a nested batch hands its callback error to the outer batch unchanged', () => {
         const callbackError = new Error('boom from nested');
         let caught: unknown;

         try {
           batch(() => {
             batch(() => {
               throw callbackError;
             });
           });
         } catch (err) {
           caught = err;
         }

         expect(caught).toBe(callbackError);
         expect(getCurrentBatch()).toBeUndefined();
       });
     });
     ```

     Die letzten drei sind die Gegenprobe: sie sind **auch heute schon grün** und halten die drei Fälle fest, in denen sich die Wurfform *nicht* ändern darf. Ohne sie wäre ein Fix, der jeden Batch-Fehler in einen `AggregateError` packt, ununterscheidbar von dem richtigen. `expect(caught).toBe(callbackError)` prüft die Identität, nicht die Nachricht — ein Wrapper mit derselben Message käme durch eine `toThrow()`-Prüfung.
  3. **Rot sehen, dann erst den Fix.** Die Ausgabe steht unter Verify (1).
  4. **Der Fix für ASYNC-001** — `src/hibernate.ts`. Der Block `:32-35` wandert in den `try`, der Kommentar wandert mit und sagt jetzt, warum er dort steht:

     ```ts
       try {
         // Flush the saved batch after clearing (so effects actually run instead
         // of being re-batched) — inside the `try`, because an effect that throws
         // in there must not cost the three `restore*` calls below. It used to sit
         // in front of the `try`, and a failing flush then left the process with a
         // cleared batch, a quiet counter of 0 and an empty effect stack, in the
         // middle of frames that were still open (ASYNC-001).
         if (savedBatch) {
           savedBatch.flush();
         }

         return callback();
       } finally {
     ```

     Das `finally` bleibt Zeile für Zeile, wie es ist. Dazu ein Satz ins JSDoc bei `:13-15`: die Zusage »After executing the callback (regardless of success or exception), all states … are restored« gilt ab jetzt auch für den Flush, nicht nur für den Callback.
  5. **Der Fix für BUG-012** — `src/batch.ts`. Ein Name mehr im vorhandenen Import, und der Rumpf von `batch()` ab `:140`:

     ```ts
     import {
       beginIsolatedDelivery,
       collectDeliveryError,
       endIsolatedDelivery,
       throwCollectedErrors,
     } from './collect-errors.js';
     ```

     ```ts
       // Created on the first failure, never on the happy path: `batch()` sits in
       // front of every grouped write and the overwhelming majority of calls
       // collect nothing. Same reasoning as the delivery frame's array.
       let errors: unknown[] | undefined;

       try {
         const result = callback();
         if (isThenable(result)) {
           throw new TypeError(
             /* unverändert */
           );
         }
       } catch (err) {
         // Held, not rethrown: the flush below runs either way, and a failing
         // effect in it must not take this error's place (BUG-012).
         errors = [err];
       } finally {
         if (curBatch) {
           Batch.current = undefined;
           try {
             curBatch.run();
           } catch (err) {
             if (errors === undefined) {
               errors = [err];
             } else {
               errors.push(err);
             }
           }
         }
       }

       // One error is rethrown unchanged — the common case keeps its identity,
       // including the `TypeError` the thenable guard promises at the call site.
       // Two become an `AggregateError` in that order: callback first, flush
       // second. A flush that already bundled several failing effects arrives as
       // one nested `AggregateError`; nothing is flattened, exactly as everywhere
       // else this helper is used.
       if (errors !== undefined) {
         throwCollectedErrors(errors, 'running a batch');
       }
     }
     ```

     Zwei Dinge, die nicht wegoptimiert werden dürfen: das `if (errors !== undefined)` statt `throwCollectedErrors(errors ?? [], …)` — sonst entsteht auf dem heißen Pfad je Batch ein leeres Array, und Paket 17 (PERF-002) müsste es wieder herausnehmen. Und `Batch.current = undefined` bleibt die erste Anweisung im `if (curBatch)`, vor dem inneren `try`: der Batch muss geschlossen sein, bevor der Flush läuft, sonst re-batcht sich der Flush selbst. Dazu zwei Sätze ins JSDoc bei `:124-126`, die den neuen Fall benennen.
  6. **Doku und CHANGELOG.** `docs/api.md:444-446` bekommt hinter »several failures as an `AggregateError`« einen Satz: wirft der Callback *und* der Flush, kommt ein `AggregateError` über beide an, Callback-Fehler zuerst. `docs/api.md:479` (»State is restored on exit, including after a throw«) wird um den Flush erweitert — heute liest sich das, als gälte es nur für den Callback, und genau da lag der Fehler. `skills/using-signalize/references/api.md:195` sagt bisher »flushes an active outer batch before running its callback … and restores batches / quiet state / effect stack afterwards«; dort gehört ein Halbsatz hin, dass das auch gilt, wenn der Flush selbst wirft. `docs/cheat-sheet.md` und `docs/recipes.md` brauchen nichts — sie beschreiben die Sammelform allgemein und stimmen weiterhin. CHANGELOG: zwei Zeilen unter `### Bug Fixes` (eine je Finding) und eine unter `### Breaking Changes` für die geänderte Wurfform, jede mit `(ASYNC-001, audit 2026-08-08)` beziehungsweise `(BUG-012, audit 2026-08-08)`. **Das Datum ist Pflicht:** unter `## Unreleased` stehen bereits vier Einträge mit `(ASYNC-001)` aus dem Audit vom 2026-08-07 — ein anderes Finding mit derselben ID, das mit `onEffectError()` zu tun hat. Ohne Datum sind die beiden nicht auseinanderzuhalten.
- Verify:
  1. **Der rote Lauf, vor jedem Fix.** `npx vitest run --coverage.enabled=false` über die volle Suite, mit beiden neuen Testblöcken und unverändertem Produktionscode. Erwartet: **3 rote Tests von 509**, in zwei Dateien, und genau diese drei ersten Assertions:
     - `src/hibernate.spec.ts` → `restores all three contexts when the flushed batch throws (ASYNC-001)` → `AssertionError: the batch context is back: expected undefined to be Batch{ delayedEffects: [ [ …(2) ] ] }`
     - `src/batch.spec.ts` → `reports both the callback error and the effect error, as an AggregateError` → `AssertionError: expected Error: effect boom to be an instance of AggregateError`
     - `src/batch.spec.ts` → `does not let a failing effect swallow the thenable TypeError` → dieselbe Meldung
     Die drei Gegenproben aus Schritt 2 sind dabei **grün** — sind sie es nicht, misst der Test etwas anderes als die Wurfform. Getrennt gefahren meldet `src/hibernate.spec.ts` 1 rot / 16 grün und `src/batch.spec.ts` 2 rot / 14 grün; Radius jeweils 1, kein Kollateralschaden.
  2. **Der grüne Lauf.** `pnpm world`, neun Schritte. Erwartet: 44 Dateien / **509 Tests** (503 + 6), `test:gc` ebenfalls 509. Coverage `batch.ts` und `hibernate.ts` je **100/100/100/100** — beide fallen unter die Tier-2-Negation aus `vitest.config.ts:18`, ein unbedeckter `catch`-Zweig bricht den Lauf. Gesamt gemessen: 99,30 / **95,09** / 99,52 / 99,45 gegen 99,30 / 95,05 / 99,52 / 99,45 auf der Baseline — Branch-Deckung steigt um 0,04, alles andere ziffergleich. `test:smoke` 4 pass / 0 fail, `rollup -c` ohne `CIRCULAR_DEPENDENCY`, `tsc --noEmit` 0 Fehler, `biome check` ohne Korrektur.
  3. **Mutationsprobe ASYNC-001.** Den Flush wieder vor das `try` schieben, sonst nichts. Erwartet: **1 rot von 509**, `restores all three contexts when the flushed batch throws (ASYNC-001)`, erste fallende Assertion `the batch context is back` — eine inhaltliche Aussage über den wiederhergestellten Batch, keine Zähler- und keine Aufräum-Assertion. 43 von 44 Dateien bleiben grün. Gemessen am 2026-08-10.
  4. **Mutationsprobe BUG-012.** Das `catch` um den Callback und das um `curBatch.run()` entfernen, `throwCollectedErrors()` streichen, also der heutige Stand. Erwartet: **2 rot von 509**, beide an `expect(caught).toBeInstanceOf(AggregateError)`, beide im neuen Block; die drei Gegenproben bleiben grün, 43 von 44 Dateien bleiben grün. Gemessen am 2026-08-10.
  5. **Die Zahn-Probe für das Selbstaufräumen.** `clearBeQuiet()` aus dem `finally` des neuen `hibernate`-Tests streichen und den Fix zurückbauen (Probe 3). Erwartet: der neue Test fällt **und** ein direkt dahinter eingefügter Sondentest `beQuiet(() => getBeQuietCount())` fällt mit `expected +0 to be 1` — der Beweis, dass die Zeile Arbeit tut und nicht Dekoration ist. Sonde danach wieder entfernen; sie gehört nicht in den Commit.
  6. `git status --porcelain --untracked-files=all` — nur `src/hibernate.ts`, `src/batch.ts`, `src/hibernate.spec.ts`, `src/batch.spec.ts`, `docs/api.md`, `skills/using-signalize/references/api.md`, `CHANGELOG.md` und `remediation-plan.md`. Keine Sonde, keine `.gc.spec.ts`, kein `lib/`, kein `dist/`.
- Commit: `fix: keep a throwing flush from breaking hibernate(), and a failing effect from eating batch()'s callback error (ASYNC-001, BUG-012)`

<details>
<summary>ASYNC-001 und BUG-012 im Volltext (aus <code>audit.html</code>)</summary>

**ASYNC-001 — `hibernate()` muss den Batch-Flush innerhalb des `try` ausführen**
Severity: high · Kategorie: Async & Concurrency · Effort: S · Status: unchanged
Location: `src/hibernate.ts:33-35`

> `if (savedBatch) savedBatch.flush();` steht weiterhin vor dem `try {`. Wirft ein Effect im Flush, laufen die drei `restore*`-Aufrufe im `finally` nie: der Prozess bleibt mit geleertem Batch, einem `beQuiet`-Zähler von 0 und leerem Effect-Stack zurück — mitten in einem noch offenen `beQuiet`-Frame. Danach ist der globale Zustand der Bibliothek dauerhaft verschoben, ohne dass irgendetwas es meldet.

> Empfehlung: Den Flush in den bestehenden `try`-Block ziehen, sodass das `finally` die drei Zustände in jedem Fall wiederherstellt.

**BUG-012 — `batch()` den Fehler seines Callbacks nicht vom Flush überschreiben lassen**
Severity: medium · Kategorie: Bugs & Korrektheitsrisiken · Effort: S · Status: new
Location: `src/batch.ts:151-156`

> Im `finally` läuft `curBatch.run()`. Wirft der Callback *und* ein verzögerter Effect, ersetzt der Effect-Fehler den Callback-Fehler ersatzlos — kein `cause`, kein `AggregateError`. Das trifft auch die im JSDoc als harte Fehlermeldung angekündigte `TypeError`-Wache gegen thenable Callbacks: sie wird still verschluckt, sobald irgendein Effect im selben Batch fehlschlägt. Es widerspricht dem Sammel-Prinzip, das der Rest der Bibliothek durchhält.

> Evidence: `batch(() => { s.set(1); throw new Error('CALLER-error') })` erreicht den Aufrufer als `Error: EFFECT-error`, ohne `cause` und ohne `errors`.

> Empfehlung: Den Callback-Fehler festhalten, den Flush in ein eigenes `try` legen und beide über `throwCollectedErrors()` zusammenführen.

</details>

- **Ergebnis (2026-08-10)** — Hash `e10c51e`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen Schritten grün, 44 Dateien / **509 Tests** (vorher 503), Coverage 99,30 / **95,09** / 99,52 / 99,45. `batch.ts` und `hibernate.ts` je 100/100/100/100 — die Tier-2-Negation in `vitest.config.ts` erzwingt das, ein unbedeckter `catch`-Zweig hätte den Lauf gebrochen.
- **Rot gesehen, bevor gefixt wurde**: 3 failed | 506 passed, mit `expected undefined to be Batch{…}` und zweimal `expected Error: effect boom to be an instance of AggregateError`. Die **drei Gegenproben blieben dabei grün** — Einzelfehler Callback, Einzelfehler Flush, verschachtelter Batch. Der Test misst die Wurfform, nicht das Werfen.
- **Was ASYNC-001 wirklich kostet, ist enger als das Finding sagt und schlimmer.** Von den drei globalen Zuständen reparieren sich zwei zufällig selbst: `batch()` stellt seinen Kontext im eigenen `finally` wieder her, und ein `pop()` auf dem von `hibernate()` geleerten Effect-Stack ist ein No-op. Dauerhaft beschädigt bleibt genau einer — der beQuiet-Zähler endet bei **-1**, danach zählt jedes folgende `beQuiet()` auf 0 und `isQuiet()` liefert `false`: die stille Lesung ist für die Lebensdauer des Moduls wirkungslos. **Kein Wächter aus Paket 32 sieht diesen Zustand.**
- **Die Falle, an der der Planer fast gescheitert wäre.** Sein erster Testentwurf klammerte alles in `expect(() => batch(…)).toThrow('effect boom')` und lief **grün gegen den kaputten Code**: die `AssertionError` der inneren Prüfung wurde von `curBatch.run()` im `finally` ersetzt, und das äußere `toThrow` nickte den Ersatz ab. Der Test hätte den Fix bezeugt, ohne ihn je zu prüfen — der Fehler frisst die Assertion, die ihn nachweisen soll. Im finalen Test steht deshalb zwischen `batch(() => {` und dem Ende des äußeren `catch` **kein einziges `expect()`**; Beobachtungen laufen über Variablen und werden danach geprüft. Der Reviewer hat das Zeile für Zeile nachgezählt.
- `clearBeQuiet()` im `finally` des Tests ist keine Zierde: ohne die Zeile fallen gemessen **zwei** Tests statt einem. Der Reviewer hat die Probe nachgefahren und zusätzlich mit einer zweiten Sonde belegt, dass Batch und Effect-Stack im kaputten Zustand tatsächlich unbeschädigt sind. Dass `expect(seen.quietAfterFrame).toBe(0)` im `try` steht, also **vor** der Reparatur, ist Absicht: erst behaupten, dann heilen.
- **Die Wurfform ändert sich nur im defekten Fall**, in allen vier Kombinationen gemessen und vom Reviewer um sechs weitere ergänzt (Callback wirft selbst einen `AggregateError`, zwei werfende Effects, `throw 'string'`, `throw undefined`, thenable ohne Effect-Fehler, verschachtelter Batch): Einzelfehler bleiben **bitgleich**, weil `throwCollectedErrors` bei `length === 1` dasselbe Objekt samt Stack wirft; der glückliche Pfad allokiert nichts; bei zwei werfenden Effects verschachtelt der Helfer statt zu plätten.
- **Runde 1 galt der Prosa, und der Befund war ernst.** Der CHANGELOG behauptete, der Fix »restores the documented `TypeError`« — genau in dem beschriebenen Szenario kommt er aber in einem `AggregateError` verpackt an, was der eigene Test bei `src/batch.spec.ts:495-499` ausdrücklich festhält. Wer nach `e instanceof TypeError` fängt, greift weiterhin daneben, nur aus einem anderen Grund. Und die Breaking-Zeile grenzte »Callback wirft **und** Flush scheitert« ab, während die Thenable-Wache gar nicht im Callback wirft, sondern in `batch()` nach dessen Rückkehr — die zweite beobachtbare Formänderung stand damit unter keiner Breaking-Zeile. Beides ist umformuliert, mitsamt `docs/api.md:433-434` und dem `@throws {TypeError}`-Tag, der jetzt nur noch für den Fall ohne Flush-Fehler gilt.
- Ebenfalls in Runde 1: `skills/using-signalize/references/pitfalls.md:54` war nach der Änderung unvollständig — der Satz nannte für `batch()` nur die Sammelform »when several effects of one write fail, `errors` in delivery order«. Der zweite Weg in die Sammelform (Callback plus gescheiterter Flush) steht dort jetzt, samt dem Hinweis, dass diese `errors` **nicht** in Delivery-Reihenfolge stehen.
- Zwei kleine Befunde mitgenommen: `src/hibernate.ts:46-51` bekommt einen Kommentar, warum die drei `restore*` flach in einem `finally` liegen dürfen (keiner kann werfen — zwei Zuweisungen und ein `push(...snapshot)`, dessen einziger denkbarer Wurf ein `RangeError` bei absurder Verschachtelungstiefe wäre), mit der Bedingung, unter der das kippt. Und `src/hibernate.spec.ts` zählt jetzt die werfenden Läufe des Effects statt sie über die Fehlermeldung zu erschließen.
- **Nebenbefund, bewusst nicht behoben, gehört zu Paket 15**: `src/batch.ts:34-35` — `Batch.flush()` setzt `delayedEffects.length = 0` erst **nach** `this.run()`. Ein werfender Flush lässt die Warteschlange stehen, und derselbe Effect läuft ein zweites Mal; gemessen 2 Läufe, auf der Baseline wie mit beiden Fixes. Der neue Test hält den heutigen Stand mit `expect(boomRuns, 'the failed flush left boom in the queue').toBe(2)` fest — räumt Paket 15 die Warteschlange in einem `finally` ab, fällt genau diese Assertion, und die Änderung muss begründet werden statt zu passieren.


#### Paket 13 ist in 13a und 13b geteilt

Begründung des Planers (2026-08-10): das Paket enthält zwei Arbeiten, die sich **nicht mit demselben Beweis abnehmen lassen**. READ-001 ist eine Umformung ohne Verhaltensänderung; ihr einziger Nachweis ist der Satz »die Suite meldet vorher und nachher exakt dasselbe«. BUG-011 und MEM-008 sind Bugfixes; ihr Nachweis ist ein roter Lauf, der grün wird — also genau die Änderung der Suite-Meldung. In einem Commit gemessen geht 509 → 519, und niemand kann den Zahlen danach noch ansehen, ob die 15 Umformungen etwas bewegt haben. Das ist kein Stilargument, sondern der Grund, warum die Messung unten zweimal gefahren wurde.

Dazu die Größen, gemessen: 13a sind **116 geänderte Zeilen** in vier Produktionsdateien, davon 70 in `SignalGroup.ts` — mechanisch, ohne einen einzigen neuen Test. 13b sind **34 Zeilen Produktionscode** in zwei Dateien und **414 Zeilen Test** in zwei Spec-Dateien. Zusammen wäre das ein Diff, in dem 34 Zeilen echter Fix zwischen 116 Zeilen Umformung und 414 Zeilen Test stehen. **13a zuerst**, weil 13b den Helfer benutzt: die vier Schritte aus MEM-008 werden mit `collect()` geschrieben, nicht mit dem Idiom, das 13a gerade abgeschafft hat. Paketnummern werden nicht neu vergeben.

#### [x] 13a. Das Sammel-Idiom in einen Helfer fassen
- Findings: READ-001 (medium)
- Ziel: Das Idiom `try { … } catch (err) { errors.push(err); }` steht genau einmal — in `collect-errors.ts`, dem Blattmodul, das für diese Zuständigkeit schon existiert. 15 Wiederholungen im Produktionscode verschwinden, 14 davon durch einen `collect()`-Aufruf ersetzt; die fünfzehnte gehört zu 13b.
- Bereich: `src/collect-errors.ts`, `src/SignalGroup.ts`, `src/SignalLink.ts`, `src/EffectImpl.ts`
- Hängt ab von: Paket 8, Paket 9 (die Teardown-Reihenfolgen, die hier umgeformt werden, sind dort festgenagelt)
- Modell: mittlere Stufe — im Grobplan stand die stärkste, für ein Paket mit zwei `high`-Fixes. Die bleiben in 13b. Was hier übrig ist, ist eine Umformung, deren 15 Fundstellen unten einzeln aufgezählt sind, deren eine Ausnahme benannt ist und deren Ersetzungstext ausgeschrieben und gemessen ist.
- Hash: `8d4f615`
- Dateien: vier Produktionsdateien, keine Spec-Datei, kein neuer Export in `index.ts` (`collect()` ist `@internal`, wie `beginIsolatedDelivery()` und Geschwister), kein CHANGELOG-Eintrag.

  | Datei | Änderung | geänderte Zeilen |
  | --- | --- | ---: |
  | `src/collect-errors.ts` | **zuerst**: `collect()` neben `throwCollectedErrors()` | 19 |
  | `src/SignalGroup.ts` | 11 Fundstellen, ein Name mehr im vorhandenen Import | 70 |
  | `src/SignalLink.ts` | 2 Fundstellen, ein Name mehr im vorhandenen Import | 14 |
  | `src/EffectImpl.ts` | 1 Fundstelle (`collectDestroyChildEffects`), ein Name mehr im vorhandenen Import | 12 |

  `src/batch.ts` wird **nicht** angefasst — Begründung im Abgleich. `src/signal-core.ts` auch nicht: es trägt das Idiom nicht.
- Abgleich (2026-08-10): READ-001 **im Kern unverändert gültig, in zwei Angaben ungenau**. Alle Zahlen auf einer `rsync`-Kopie von HEAD im Scratchpad gemessen, `node_modules` symbolisch verlinkt, nie im Arbeitsbaum, kein `git`-Schreibbefehl beteiligt. Baseline der Kopie: 44 Dateien / **509 Tests** grün, Coverage 99,30 / 95,09 / 99,52 / 99,45.
  - **Die Zahl 15 stimmt, auf den Treffer.** `grep -rn '\.push(err' src/*.ts` ohne Specs liefert 17 Zeilen: 15 Idiom-Stellen, dazu `src/collect-errors.ts:95` (das ist der Rahmen selbst, nicht das Idiom) und `src/batch.ts:177` (aus Paket 12, andere Form — siehe unten). Verteilung: **`SignalGroup.ts` 11** (`:338`, `:919`, `:929`, `:939`, `:954`, `:965`, `:996`, `:1006`, `:1014`, `:1022`, `:1030`), **`SignalLink.ts` 2** (`:526`, `:547`, dort heißt das Array `releaseErrors` — der Grund, warum eine Suche nach dem Wortlaut `errors.push` es findet, eine nach `const errors` aber nicht), **`EffectImpl.ts` 2** (`:753`, `:963`). Gegengeprüft gegen `12879f7`, den Stand zum Auditdatum: identisch, 15 zu 15. Nichts ist seither dazugekommen außer `batch.ts:177`.
  - **»allein neunmal in `clear()` und `off()`« ist zu niedrig: es sind zehn.** `off()` fünf (`childGroup.off()`, `effect.destroy()`, `link.destroy()`, der Soft-Detach-Emit, `emit(this, OFF, this)`), `clear()` fünf (`emit(this, DESTROY, this)`, `childGroup.clear()`, `effect.destroy()`, `destroySignal(signal)`, `link.destroy()`). Die elfte in der Datei steht im statischen `SignalGroup.clear()` bei `:338`. Ändert nichts am Befund, nur an seiner Ziffer.
  - **Die `location`-Zeile des Findings ist veraltet und darf nicht als Wegweiser benutzt werden.** READ-001 ist `carried-over` aus dem Audit vom 2026-08-07; die genannten Bereiche zeigen im heutigen Code auf `attachLink()` (`SignalGroup.ts:783-790`), auf `#signalKeys`-Lookup (`:705-712`), auf eine Promise-Fehlerroute in `EffectImpl.ts:819-831` und auf den `asyncValues()`-Rumpf in `SignalLink.ts:339-346` — vier Stellen, an denen das Idiom nicht steht. Maßgeblich ist die Liste oben, nicht die Location.
  - **14 der 15 haben dieselbe Form, eine hat sie nicht.** Gleiche Form heißt: das `try` umschließt **genau eine Anweisung**, und der `catch`-Rumpf besteht aus nichts als dem `push`. Das gilt für alle bis auf **`EffectImpl.ts:955-964`** — dort stehen **vier** Anweisungen in einem gemeinsamen `try`, und genau das ist MEM-008. Diese Stelle wird hier **nicht** mit umgeformt; sie wird in 13b in vier einzelne `collect()`-Aufrufe zerlegt, was der Fix ist. Ein Umformen an dieser Stelle in 13a würde das Finding zementieren, indem es dessen Form für kanonisch erklärt.
  - **`src/batch.ts:177` bleibt, wie es ist, und das ist kein Versehen.** Die Stelle stammt aus Paket 12 und lautet `if (errors === undefined) { errors = [err]; } else { errors.push(err); }` — das Array wird dort erst beim ersten Fehler angelegt, weil `batch()` auf dem heißen Pfad liegt. `collect(errors, …)` braucht ein Array, das es schon gibt; ein `collect()` mit lazy Allokation müsste das Array zurückgeben und wäre ein anderer Helfer. Paket 17 (PERF-002) baut dieselbe Datei um; die Entscheidung gehört dorthin, nicht hierher.
  - **Der Nachweis, dass die Umformung nichts bewegt, ist gefahren.** Auf einer zweiten Kopie nur der Helfer plus die 14 Ersetzungen, kein Fix, kein neuer Test: `tsc --noEmit -p tsconfig.json` 0 Fehler, `biome check` ohne Korrektur, **509 von 509 grün**, Coverage 99,29 / **95,09** / 99,55 / 99,44 gegen 99,30 / 95,09 / 99,52 / 99,45 auf der Baseline. Die Abweichungen in der dritten Stelle sind reine Nennerverschiebung — es verschwinden 55 Zeilen Produktionscode; die **unbedeckten Zeilen sind dieselben** (`EffectImpl.ts` 907-908, `SignalGroup.ts` 332-333/342/346 gegen vorher 332-333/346/350, also derselbe Code, um vier Zeilen nach oben gerutscht). Kein Schwellwert wird berührt: `SignalGroup.ts` liegt bei 98,67 / 90,76 / 100 / 98,56 gegen die Stufe 97 / 85 / 96 / 98.
  - **Und der Nachweis, dass der Helfer trägt, was das Idiom trug.** Mutationsprobe auf derselben Kopie: `collect()` fängt nicht mehr (`fn()` statt `try`/`catch`). Ergebnis **23 rote Tests in 4 Dateien** — `SignalGroup.teardown.spec.ts`, `SignalLink.spec.ts`, `EffectImpl.destroy.spec.ts`, `SignalGroup.gc.spec.ts` —, erste fallende Assertionen unter anderem `the groups after the throwing one must still be torn down: expected +0 to be 2` und `sibling cleanup must still run: expected +0 to be 1`. Der Helfer ist nicht Dekoration; er ist die Stelle, an der 23 Zusagen hängen.
  - **Kein neuer `critical`- oder `high`-Befund** in 13a. Was auffiel und keiner ist: `SignalGroup#clear()` ruft die Unsubscribe-Handles bei `:1035-1039` **ohne** Guard (`for (const unsubscribe of […]) unsubscribe();`), also ungeschützt zwischen lauter geschützten Schleifen. Das ist vertretbar — es sind eventize-eigene Handles, keine Anwendungscode-Route, und `SignalLink#destroy()` guardet dieselbe Sorte nur deshalb, weil dort ein Subclass-Handle dazukommen kann. Wird hier **nicht** angefasst: eine neue `collect()`-Stelle an einer Zeile, die das Idiom nie trug, ist eine Verhaltensänderung ohne Finding.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/ docs/ audit.html CHANGELOG.md` ist leer.
- Vorgehen: drei Schritte. Der Wortlaut unten ist der gemessene — er compiliert (`tsc --noEmit -p tsconfig.json`, 0 Fehler) und formatiert unverändert durch (`biome check`, keine Korrektur).
  1. **Zuerst der Helfer.** In `src/collect-errors.ts`, unmittelbar hinter `throwCollectedErrors()` und **vor** dem `/* The delivery frame. */`-Block — die beiden Auswerte-/Sammelfunktionen gehören zusammen, der Frame-Block ist ein eigenes Thema mit eigenem Modulzustand:

     ```ts
     /**
      * Run `fn` and, if it throws, append the failure to `errors` instead of
      * letting it out.
      *
      * The one shape every teardown in this library repeats: keep going, report
      * at the end via {@link throwCollectedErrors}. Written down once so that a
      * forgotten `catch` cannot quietly reintroduce an abort.
      *
      * @param errors - The caller-owned list the failure is appended to
      * @param fn - The step to run under the guard
      * @internal
      */
     export const collect = (errors: unknown[], fn: () => void): void => {
       try {
         fn();
       } catch (err) {
         errors.push(err);
       }
     };
     ```

     Nicht exportiert über `src/index.ts`: `collect-errors.ts` liefert heute keinen einzigen öffentlichen Namen, und `@internal` hält es nach BUILD-004 auch aus den ausgelieferten `.d.ts` heraus. Kein eigener Test: die Datei steht auf der Stufe 100/95/100/100, und die 23 Tests aus der Mutationsprobe decken beide Zweige — gemessen bleibt `collect-errors.ts` nach dem Umbau bei 100 in allen vier Spalten.
  2. **Dann die 14 Ersetzungen**, in dieser Reihenfolge, weil sie von der kleinsten zur größten Datei geht und ein Reviewer den Vergleichsmaßstab in der kleinsten aufbaut. Jede ist eine Eins-zu-eins-Ersetzung; **kein Kommentar wird dabei entfernt** — die Kommentare über den Schleifen erklären die Teardown-*Reihenfolge* und die Snapshots, nicht das `catch`.

     `src/EffectImpl.ts` — 1 Stelle, in `collectDestroyChildEffects()`:

     ```ts
     for (const effect of this.childEffects) {
       collect(errors, () => effect.destroy());
     }
     ```

     `src/SignalLink.ts` — 2 Stellen, in `destroy()`. Die erste ist die einzige im ganzen Paket, die **ohne Wrapper-Closure** auskommt, weil das Schleifenelement selbst schon die parameterlose Funktion ist:

     ```ts
     for (const unsubscribe of this[$queueUnsubscribes]) {
       collect(releaseErrors, unsubscribe);
     }
     ```

     ```ts
     collect(releaseErrors, () => emit(this, DESTROY, this));
     ```

     `src/SignalGroup.ts` — 11 Stellen. Im statischen `clear()`:

     ```ts
     collect(errors, () => group.clear());
     ```

     In `off()`, in dieser Reihenfolge:

     ```ts
     for (const childGroup of [...this.#groups]) {
       collect(errors, () => childGroup.off());
     }
     ```
     ```ts
     for (const effect of [...this.#effects]) {
       collect(errors, () => effect.destroy());
     }
     ```
     ```ts
     for (const link of [...this.#links]) {
       collect(errors, () => link.destroy());
     }
     ```
     ```ts
     if (!si.destroyed) {
       collect(errors, () =>
         emit(globalDestroySignalQueue, si.id, si.id, {detach: true}),
       );
     }
     ```
     ```ts
     collect(errors, () => emit(this, OFF, this));
     ```

     In `clear()`, in dieser Reihenfolge:

     ```ts
     collect(errors, () => emit(this, DESTROY, this));
     off(this);
     ```
     ```ts
     for (const childGroup of [...this.#groups]) {
       collect(errors, () => childGroup.clear());
     }
     ```
     ```ts
     for (const effect of [...this.#effects]) {
       collect(errors, () => effect.destroy());
     }
     ```
     ```ts
     for (const signal of [...this.#signals]) {
       collect(errors, () => destroySignal(signal));
     }
     ```
     ```ts
     for (const link of [...this.#links]) {
       collect(errors, () => link.destroy());
     }
     ```

     **Vorsicht bei zwei Paaren:** die Effect-Schleife und die Link-Schleife stehen je zweimal wortgleich da — einmal in `off()` (dort folgt unmittelbar `this.#effects.clear()` beziehungsweise `this.#links.clear()`), einmal in `clear()` (dort nicht; die Sammel-`clear()`-Aufrufe kommen dort weiter unten in einem Block). Wer per Suchen-und-Ersetzen arbeitet, muss die Folgezeile mit in das Muster nehmen, sonst trifft er zweimal dieselbe Stelle.
  3. **Die drei Importzeilen.** In `SignalGroup.ts` und `SignalLink.ts` wird aus `import {throwCollectedErrors} from './collect-errors.js';` je `import {collect, throwCollectedErrors} from './collect-errors.js';`. In `EffectImpl.ts` wächst der vorhandene Einzeiler auf die mehrzeilige Form, die Biome erzwingt:

     ```ts
     import {
       collect,
       collectDeliveryError,
       throwCollectedErrors,
     } from './collect-errors.js';
     ```

     Keine neue Importzeile irgendwo, keine neue Modulkante: alle drei Dateien importieren aus `collect-errors.js` bereits.

     **Kein CHANGELOG-Eintrag.** Reiner interner Refactor ohne beobachtbaren Effekt — genau der Fall, den `CLAUDE.md` → »CHANGELOG discipline« ausnimmt. Der Beweis dafür ist Verify (1) und (2), nicht eine Behauptung.
- Verify:
  1. **Die Zählung, vor und nach dem Umbau.** `grep -rn '\.push(err' src/*.ts | grep -v spec` — vorher 17 Zeilen, nachher **3**: `collect-errors.ts` zweimal (der Helfer selbst und `g_deliveryErrors.push`) und `batch.ts:177`. Steht dort eine vierte, ist eine Stelle übersehen; steht dort eine zweite in `batch.ts`, wurde eine umgeformt, die nicht dazugehört.
  2. **Der Vergleich, und er ist der eigentliche Nachweis.** `pnpm world` vollständig. Erwartet: 44 Dateien / **509 Tests** grün, also *dieselbe Zahl wie auf der Baseline* — kein Test kommt dazu, keiner fällt weg, keiner ändert seine Meldung. Coverage gemessen **99,29 / 95,09 / 99,55 / 99,44**; die Baseline liegt bei 99,30 / 95,09 / 99,52 / 99,45. Wer diese vier Zahlen weiter auseinandergehen sieht als in der zweiten Nachkommastelle, hat Verhalten geändert und muss sagen, wo. `SignalGroup.ts` **98,67 / 90,76 / 100 / 98,56** (Stufe 97/85/96/98), `SignalLink.ts` und `collect-errors.ts` je 100 in allen vier Spalten (Stufe 100/95/100/100), `EffectImpl.ts` 98,10 / 96,07 / 96,77 / 98,99. `tsc --noEmit` 0 Fehler, `biome check` ohne Korrektur, `rollup -c` ohne `CIRCULAR_DEPENDENCY`, `test:smoke` 4 pass, `test:gc` 509.
  3. **Mutationsprobe.** Im Helfer `try { fn(); } catch (err) { errors.push(err); }` durch `fn();` ersetzen, sonst nichts. Erwartet: **23 rote Tests von 509 in 4 Dateien** — `src/SignalGroup.teardown.spec.ts`, `src/SignalLink.spec.ts`, `src/EffectImpl.destroy.spec.ts`, `src/SignalGroup.gc.spec.ts` —, inhaltliche Assertionen, darunter `the groups after the throwing one must still be torn down: expected +0 to be 2`, `sibling cleanup must still run: expected +0 to be 1` und `expected Error: child boom to be an instance of AggregateError`. 40 von 44 Dateien bleiben grün. Gemessen am 2026-08-10. Fällt weniger als das, hat eine Umformung ihren Gegenstand verloren.
  4. `git status --porcelain --untracked-files=all` — nur `src/collect-errors.ts`, `src/SignalGroup.ts`, `src/SignalLink.ts`, `src/EffectImpl.ts` und `remediation-plan.md`. Kein `CHANGELOG.md`, keine Spec-Datei, kein `lib/`, kein `dist/`.
- Commit: `refactor(errors): fold the repeated collect-and-carry-on idiom into a single helper (READ-001)`

<details>
<summary>READ-001 im Volltext (aus <code>audit.html</code>)</summary>

**READ-001 — Das wiederholte Fehler-Sammel-Idiom in einen Helfer fassen**
Severity: medium · Kategorie: Lesbarkeit & Clean Code · Effort: S · Status: carried-over
Location: `src/SignalGroup.ts:785-824` · `src/SignalGroup.ts:707-758` · `src/EffectImpl.ts:819-831` · `src/SignalLink.ts:339-346`

> Der Block `try { … } catch (err) { errors.push(err); }` steht fünfzehnmal wörtlich im Quellcode, allein neunmal in `clear()` und `off()`. Er bläht beide Methoden auf je rund 70 Zeilen auf, in denen die eigentliche Teardown-Reihenfolge zwischen Boilerplate untergeht, und jede Wiederholung ist eine Stelle, an der ein vergessenes `catch` still eine Abbruchmöglichkeit einbaut — CONS-005 ist genau das. `collect-errors.ts` existiert bereits als Blattmodul für diese Zuständigkeit und enthält nur die Auswertehälfte.

> Empfehlung: In `collect-errors.ts` ein `collect(errors: unknown[], fn: () => void): void` ergänzen und die Schleifenkörper darauf reduzieren.

</details>

- **Ergebnis (2026-08-10)** — Hash `8d4f615`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen Schritten grün, 44 Dateien / **509 Tests** — unverändert, wie es sich für eine Umformung ohne Verhaltensänderung gehört. 14 Stellen umgeformt: 11 in `SignalGroup.ts`, 2 in `SignalLink.ts`, 1 in `EffectImpl.ts`.
- **Der Gleichstand ist strukturell, nicht real** — vom Reviewer nachgerechnet. Coverage bewegt sich von 99,30 / 95,09 / 99,52 / 99,45 auf 99,29 / 95,09 / **99,55** / 99,44, aber die Branch-Deckung ist mit **465/489 bitgleich**: kein Zweig ist unbedeckt geworden. Statements und Lines sinken, weil Code verschwindet; Functions steigt um 14 (13 neue Closures plus `collect()`), alle durch die Mutationsprobe gedeckt. Die unbedeckten Zeilen in `SignalGroup.ts` verschieben sich von `332-333,346,350` auf `332-333,342,346` — derselbe Code, vier Zeilen nach oben gerutscht.
- **Mutationsprobe**: lässt man `collect()` nicht mehr fangen, fallen **23 Tests in vier Dateien** (`EffectImpl.destroy.spec.ts`, `SignalGroup.teardown.spec.ts`, `SignalLink.spec.ts`, `SignalGroup.gc.spec.ts`), 40 von 44 Dateien bleiben grün. Vom Reviewer unabhängig reproduziert. Das belegt, dass der Helfer fängt, was das Idiom fing — die Nullwirkung ist gemessen, nicht behauptet.
- **Zwei Aussparungen, beide bestätigt**: `src/EffectImpl.ts:955-964` bleibt unangetastet, weil die vier Anweisungen im gemeinsamen `try` **das Finding MEM-008 sind** und in 13b zerlegt werden — wer sie hier einebnet, nimmt dem Folgepaket seinen Gegenstand. Und `src/batch.ts:177` aus Paket 12 (lazy allokiertes Array, andere Form) gehört zu Paket 17. Der Gegen-Grep findet danach genau vier `.push(err)`-Treffer: den Helfer, den Delivery-Rahmen und die zwei Aussparungen — keine übersehene Stelle.
- Zwei Ungenauigkeiten im Finding, beide korrigiert: es sind **zehn** Vorkommen in `clear()` und `off()`, nicht neun (die elfte steht im statischen `clear()`), und die `location`-Zeile ist als `carried-over` veraltet — sie zeigt auf vier Stellen, an denen das Idiom gar nicht steht.
- Kein CHANGELOG-Eintrag, und das ist richtig: `collect()` wird nicht exportiert, keine Fehlermeldung, kein Stacktrace und keine Reihenfolge ändern sich beobachtbar. `CLAUDE.md` erlaubt für reine interne Refactorings ausdrücklich das Weglassen.
- Kleiner Befund, betrifft den Plan statt den Code: Verify-Punkt (1) sagt, der Grep liefere nachher **3** Treffer, und wertet einen vierten als übersehene Stelle. Tatsächlich sind es vier, weil der bewusst ausgesparte MEM-008-Rest selbst ein `errors.push(err)` trägt. Wer die Anweisung wörtlich nachfährt, hält ein korrektes Ergebnis für einen Fehler.
- Lesbarkeit, die eigentliche Begründung des Findings: `off()` und `clear()` sind nicht nur kürzer. Die verbleibenden Zeilen sind jetzt Aussagesätze, die fast wörtlich den darüberstehenden Kommentar wiederholen — `collect(errors, () => effect.destroy())` neben »Destroy own effects«. Die Teardown-Reihenfolge steht wieder da, statt zwischen Boilerplate zu verschwinden.


#### [x] 13b. Die Fehlerisolation zu Ende bauen: destroySignal() und EffectImpl.destroy()
- Findings: BUG-011 (high), MEM-008 (high)
- Ziel: Ein werfender Abonnent kostet die Abonnenten hinter ihm nicht mehr die Destroy-Zustellung, und ein werfender Teardown-Schritt kostet den Effect nicht mehr seinen Cleanup-Callback. Beides ist der Mechanismus, den `writeSignal()` und `SignalLink#destroy()` schon haben.
- Bereich: `src/signal-core.ts`, `src/EffectImpl.ts`, `src/createSignal.destroySignal.spec.ts`, `src/EffectImpl.destroy.spec.ts`, `docs/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Hängt ab von: Paket 13a (der Helfer; die vier Schritte aus MEM-008 werden mit `collect()` geschrieben), Paket 8, Paket 9
- Anmerkung (2026-08-10, aus Paket 32): **Das Netz, das ab jetzt unter diesem Paket liegt.** Eine Isolation pro Abonnent beziehungsweise pro Teardown-Schritt kann genau einen Schritt überspringen, ohne dass eine Assertion darüber spricht — und ein übersprungener Teardown-Schritt ist ein Zähler, der oben bleibt. Seit Paket 32 sieht das jede Spec-Datei im Bereich: `src/EffectImpl.destroy.spec.ts` (22 Saatpunkte) und `src/createSignal.destroySignal.spec.ts` (13) führten bis dahin nur `assertEffectsCount` und waren für ein liegengebliebenes Signal blind. In der Messung unten hat sich das sofort ausgezahlt: der erste Entwurf des BUG-011-Tests riss gegen den ungefixten Code **fünf** Tests der Datei mit, weil der nicht zerstörte Link durch `assertLinksCount` in jedem folgenden `beforeEach` schlug.
- Modell: stärkste Stufe
- Hash: `daed7c4`
- Dateien: zwei Produktionsdateien, zwei Spec-Dateien, keine neue Datei, kein neuer Export.

  | Datei | Änderung | geänderte Zeilen |
  | --- | --- | ---: |
  | `src/createSignal.destroySignal.spec.ts` | **zuerst**: sechs Tests in einem neuen `describe`-Block ans Ende; vier neue Importzeilen, zwei erweitert | +231 |
  | `src/EffectImpl.destroy.spec.ts` | **zuerst**: vier Tests in einem neuen `describe`-Block ans Ende; zwei Namen mehr im eventize-Import | +183 |
  | `src/signal-core.ts` | der Fix (BUG-011), Hälfte 1: der Frame um den Emit; JSDoc | 12 |
  | `src/EffectImpl.ts` | der Fix (BUG-011), Hälfte 2: `[$destroySignal]` parkt selbst · der Fix (MEM-008): vier `collect()` statt eines `try` · JSDoc | 22 |
  | `docs/api.md` | zwei Absätze: die Delivery-Zusage bei `:57-65`, die Teardown-Zusage bei `:168-179` | |
  | `skills/using-signalize/references/pitfalls.md` | ein Halbsatz in Pitfall 11d (`:54`) | |
  | `CHANGELOG.md` | zwei Einträge unter `### Bug Fixes`, zwei unter `### Breaking Changes` | |

  `src/collect-errors.ts` wird **nicht** angefasst. Der Rahmen ist in Ordnung; kaputt ist, wer ihn nicht aufruft.
- Abgleich (2026-08-10): beide Findings unverändert gültig, beide zeilengenau. **Die Empfehlung zu BUG-011 greift zu kurz — gemessen, nicht vermutet** (siehe unten). Alle Zahlen auf `rsync`-Kopien von HEAD im Scratchpad, `node_modules` symbolisch verlinkt, nie im Arbeitsbaum, kein `git`-Schreibbefehl beteiligt. Baseline: 44 Dateien / **509 Tests** grün.
  - **BUG-011 unverändert, Fundstelle exakt `src/signal-core.ts:160`.** `emit(globalDestroySignalQueue, signal.id, signal.id);` steht nackt in der Schleife von `destroySignal()`; der Vergleichsrahmen in `writeSignal()` steht 60 Zeilen darüber bei `:96-114`.
  - **Reproduktion BUG-011, alle drei Opfer namentlich.** Aufbau: ein Signal `a`; ein Effect, der `a` liest und dessen Cleanup wirft (er registriert damit als **erster** auf `globalDestroySignalQueue` für diese Id); danach ein `link(a.get, …)`, danach `group.attachSignal(a.get)`, danach ein `SignalAutoMap.fromProps({a}, ['a'])`. Reihenfolge ist Registrierungsreihenfolge, und alles hinter dem Effect ist das, was ausfällt. Gemessen unmittelbar nach `destroySignal(a)`:

    | Beobachtung | heute | nach dem Fix |
    | --- | --- | --- |
    | geworfen | `Error: cleanup boom` | unverändert |
    | `link.isDestroyed` | `false` | `true` |
    | `getLinksCount()` | `1 → 1` | `1 → 0` |
    | `getGroupMemberCounts(group).signals` | `1` | `0` |
    | `map.has('a')` | `true` | `false` |

    Ziffergleich mit der `evidence` des Findings. Der `SignalAutoMap`-Fall braucht `fromProps()` mit einem **bereits bestehenden** Signal — auf dem `get()`-Pfad legt die Map das Signal selbst an und ist damit zwangsläufig der erste Abonnent seiner Id, kann also gar nicht übersprungen werden (der Kommentar `src/SignalAutoMap.ts:112-122` beschreibt genau diese eine Ausnahme).
  - **Die Empfehlung des Audits allein repariert nichts. Gemessen.** »Denselben `beginIsolatedDelivery()`/`collectDeliveryError()`/`endIsolatedDelivery()`-Rahmen um den Emit legen« — nur den Rahmen gesetzt, sonst nichts: **alle fünf Zeilen der Tabelle bleiben auf dem heutigen Wert.** Der Grund steht in `collect-errors.ts:30-35`: der Rahmen *sammelt*, er *fängt nicht*. Isoliert wird beim Listener — `EffectImpl[RECALL]` fängt seinen eigenen Fehler und parkt ihn (`src/EffectImpl.ts:605-618`), und deshalb läuft die Zustellung weiter. Das `catch` um `emit()` in `writeSignal()` ist ausdrücklich *nicht* der Isolationsmechanismus, sondern die Auffanglinie für Listener, die keiner sind (Kommentar `:100-107`). Auf dem Destroy-Pfad hat **kein** Listener ein solches `catch`. Der Fix braucht deshalb zwei Hälften, und die Gegenprobe zeigt, dass keine für sich reicht: Rahmen entfernt, Listener-`catch` behalten → dieselben 2 roten Tests; Listener-`catch` entfernt, Rahmen behalten → dieselben 2 roten Tests. **Das ist die einzige Abweichung von der Audit-Empfehlung in diesem Paket, und sie erweitert sie, statt ihr zu widersprechen** — das Finding nennt `collectDeliveryError()` selbst mit, seine `evidence` ist ohne die Listener-Hälfte nicht herstellbar.
  - **MEM-008 unverändert, Fundstelle exakt `src/EffectImpl.ts:955-964`.** Vier Anweisungen in einem `try`, ein `catch (err) { errors.push(err); }`.
  - **Reproduktion MEM-008, beide Einstiege, mit der Angabe, welcher Schritt ausfällt.** Gemessen an einem Effect mit einem zählenden Cleanup:

    | wer wirft | Schritt 1 `emit(this, DESTROY)` | Schritt 2 `off(this)` | Schritt 3 `emit($destroyEffect)` | Schritt 4 `runCleanupCallback()` |
    | --- | --- | --- | --- | --- |
    | ein `onDestroyEffect()`-Handler (Schritt 3) | läuft | läuft | läuft | **fällt aus** |
    | ein `DESTROY`-Listener am `EffectImpl` (Schritt 1) | läuft | **fällt aus** | **fällt aus** | **fällt aus** |

    Der erste Fall ist der aus der `evidence`, ziffergleich: `reporter boom` erreicht den Aufrufer, `Cleanup ausgeführt: false`, `getEffectsCount() === 0`. Der zweite ist teurer und im Finding nicht ausgeschrieben: das übersprungene `off(this)` lässt Listener auf einer Instanz stehen, die sich für zerstört hält — gemessen bleibt **1 Abonnement** auf dem `EffectImpl` zurück, dauerhaft, denn `destroy()` ist Einweg. Zusätzlich erfährt kein `onDestroyEffect()`-Handler je von diesem Effect. Nach dem Fix laufen in beiden Zeilen alle vier Schritte.
  - **Die Wurfform ändert sich, in beiden Fixes, in genau den Fällen, in denen heute Information verloren geht.** Sechs Kombinationen, gegen beide Codezustände gemessen:

    | Fall | heute | nach dem Fix |
    | --- | --- | --- |
    | `destroySignal`, kein Abonnent wirft | nichts | unverändert, und keine Allokation |
    | `destroySignal`, ein Abonnent wirft | der Fehler selbst, identisch | unverändert (`throwCollectedErrors` reicht bei `length === 1` dasselbe Objekt samt Stack durch) |
    | `destroySignal`, zwei Abonnenten werfen | `Error: cleanup one` — **der zweite Effect bleibt außerdem am Leben**, `getEffectsCount()` 1 statt 0 | `AggregateError`, `errors: ['cleanup one', 'cleanup two']` in Zustellreihenfolge |
    | `destroySignal(a, b)`, ein Abonnent von `a` wirft | `b` wird nicht zerstört | **unverändert** — der Rahmen wird pro Signal geöffnet, nicht um die Schleife |
    | `EffectImpl.destroy()`, ein Schritt wirft | der Fehler selbst, identisch | unverändert |
    | `EffectImpl.destroy()`, drei Schritte plus ein Kind werfen | `AggregateError` über **zwei** Fehler (Listener + Kind); der eigene Cleanup-Fehler existiert nirgends, weil der Cleanup nie lief | `AggregateError` über **vier**: die drei eigenen Schritte in Teardown-Reihenfolge, dann der Bericht des Kindes als **verschachtelter** `AggregateError` |

    Damit geht keiner der beiden Fixes über die Fehlerbehebung hinaus; die Halte-Bedingung des Pakets tritt nicht ein. Die Zusagen, die es schon gibt, nennen `AggregateError` als Form bereits — `docs/api.md:178` für `Effect.destroy()`, `docs/api.md:61` für die Zustellung eines Writes; der Fix weitet sie auf Fälle aus, in denen heute Fehler verschwinden, statt ihr zu widersprechen. **Trotzdem je ein Breaking-Changes-Eintrag**, nach der Präzedenz im selben `## Unreleased`-Block: BUG-004 und BUG-012 stehen dort mit derselben Formänderung aus demselben Grund. Ein `catch`, das heute `err.message` liest oder ein `instanceof` fährt, sieht in den beiden neuen Fällen den Wrapper.
  - **Die vierte Zeile der Tabelle ist eine bewusste Entscheidung, kein Übersehen.** Der Rahmen steht **innerhalb** der `for`-Schleife von `destroySignal()`, nicht darum. Drei Gründe: die Isolation ist eine Eigenschaft *einer* Zustellung, nicht der Argumentliste — genauso wie in `writeSignal()`; ein Rahmen um die Schleife würde die Wurfform auch über Signale hinweg ändern (mehrere Signale mit je einem werfenden Abonnenten ergäben einen `AggregateError`), und das wäre die Änderung über die Fehlerbehebung hinaus, bei der dieses Paket anhalten müsste; und Paket 18 (PERF-008) will die Frame-Eröffnung an einem Zähler **pro Signal-Id** festmachen, was nur bei einem Rahmen pro Signal geht. Der heutige Stand wird deshalb mit einer eigenen Assertion festgehalten (Test 5 unten), damit eine spätere Ausweitung begründet werden muss statt zu passieren.
  - **Die Modulschicht hält, und `writeSignal()` ist der Beleg.** `src/signal-core.ts` importiert `beginIsolatedDelivery`, `collectDeliveryError` und `endIsolatedDelivery` bereits in seiner Zeile 3-7; der Fix fügt **keinen einzigen Import** hinzu, weder hier noch in `EffectImpl.ts` (dort steht `collectDeliveryError` seit BUG-004 im Import). `collect-errors.ts` ist die Blattschicht und importiert nichts, auch nicht aus diesem Paket (Kommentar `:1-3`). Nachgeprüft: `tsc -p tsconfig.lib.json` plus `rollup -c rollup.config.mjs` laufen mit beiden Fixes durch, **ohne `CIRCULAR_DEPENDENCY`**.
  - **Was der Frame in `destroySignal()` sonst noch berührt, und warum es folgenlos bleibt.** `g_deliveryDepth` ist modulglobal: parkt `EffectImpl[$destroySignal]` ab jetzt in *irgendeinem* offenen Frame, dann auch in dem eines äußeren Writes, wenn ein Effect-Callback ein Signal zerstört. Das ist genau die Zusage aus `collect-errors.ts:37-44` (verschachtelte Frames, ein Eintrag je scheiternder Einheit) und in beiden Richtungen gemessen: volle Suite grün, `SignalGroup#clear()` — das `destroySignal()` unter seinem eigenen `collect()` in einer Schleife fährt — unverändert, `SignalGroup#off()` — das ohne Frame emittiert — ebenfalls, dort greift der Rückfall `if (!collectDeliveryError(err)) throw err;`. Der letzte Pfad hat vorher keinen Test gehabt und bekommt einen (Test 6 unten); ohne ihn fiele `EffectImpl.ts` von 96,07 auf 94,23 Branch-Deckung.
  - **Nebenbefund, gemessen, nicht in diesem Paket behoben:** `SignalGroup#clear()` ruft die Unsubscribe-Handles bei `:1035-1039` ungeschützt auf, zwischen lauter geschützten Schleifen. Vorbestehend, kein Finding, keine Anwendungscode-Route. Notiert, weil ein Leser des Diffs sonst fragt, warum diese eine Schleife kein `collect()` bekommt.
  - **Kein neuer `critical`- oder `high`-Befund.** Was auffiel und keiner ist: der `AggregateError` eines Kind-Effects wird vom Elternteil als *ein* Eintrag geführt statt geplättet — das ist die überall gleiche Zusage (`docs/recipes.md:244-246`) und wird von Test 3 ausdrücklich festgehalten.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/ docs/ audit.html CHANGELOG.md` ist leer.
- Vorgehen: fünf Schritte. Der Wortlaut unten ist der gemessene — er compiliert (`tsc --noEmit -p tsconfig.json`, 0 Fehler), formatiert unverändert durch (`biome check`, keine Korrektur) und ist in beiden Codezuständen gefahren.
  1. **Zuerst die sechs Regressionstests für BUG-011**, als neuer `describe`-Block ans Ende von `src/createSignal.destroySignal.spec.ts`, innerhalb des äußeren `describe('destroySignal')` und mit einer Leerzeile davor. Importe: vier neue Zeilen (`link`, `SignalAutoMap`, `SignalGroup`), `signalImpl` kommt zum vorhandenen `signal-core`-Import, `getGroupMemberCounts` zum vorhandenen Helfer-Import.

     ```ts
     import {link} from './link.js';
     import {SignalAutoMap} from './SignalAutoMap.js';
     import {SignalGroup} from './SignalGroup.js';
     import {destroySignal, signalImpl} from './signal-core.js';
     ```

     ```ts
     describe('the destroy delivery is isolated, like a write (BUG-011)', () => {
       it('serves every subscriber behind a throwing effect cleanup', () => {
         // Subscription order on `globalDestroySignalQueue` is registration
         // order, and the effect registers first — so everything created after
         // it is exactly what a throwing cleanup used to skip. All three
         // victims from the finding are here: the link stayed subscribed to a
         // dead source, the group kept the dead SignalImpl, the auto map kept
         // its entry.
         const a = createSignal(0);
         const host = {a};
         let propagated = 0;

         const effect = createEffect(() => {
           a.get();
           return () => {
             throw new Error('cleanup boom');
           };
         });
         const sibling = link(a.get, (value: number) => {
           propagated = value;
         });
         const group = SignalGroup.findOrCreate({});
         group.attachSignal(a.get);
         const map = SignalAutoMap.fromProps(host, ['a']);

         try {
           expect(map.get('a'), 'the map holds that signal, not a copy').toBe(a);
           expect(propagated, 'the link is live before the destroy').toBe(0);

           expect(
             () => destroySignal(a),
             'the failure still reaches the caller',
           ).toThrow('cleanup boom');

           expect(sibling.isDestroyed, 'the link let go of the dead source').toBe(
             true,
           );
           expect(
             getGroupMemberCounts(group).signals,
             'the group dropped the dead signal',
           ).toBe(0);
           expect(map.has('a'), 'the auto map dropped its entry').toBe(false);
         } finally {
           // Against the unfixed code the link, the group entry and the map
           // entry are still there, and the file's counter guards would then
           // fail in every later test of this file rather than in this one.
           // The test takes its own damage back; against the fixed code all
           // three lines are no-ops.
           sibling.destroy();
           map.clear();
           group.clear();
           try {
             effect.destroy();
           } catch {
             // the cleanup throws by design; already reported above
           }
           destroySignal(a);
         }
       });

       it('bundles two failing subscribers into an AggregateError, in delivery order', () => {
         const a = createSignal(0);

         const first = createEffect(() => {
           a.get();
           return () => {
             throw new Error('cleanup one');
           };
         });
         const second = createEffect(() => {
           a.get();
           return () => {
             throw new Error('cleanup two');
           };
         });

         try {
           let caught: unknown;
           try {
             destroySignal(a);
           } catch (err) {
             caught = err;
           }

           expect(caught).toBeInstanceOf(AggregateError);
           expect(
             (caught as AggregateError).errors.map(
               (err) => (err as Error).message,
             ),
             'both failures, in the order they were delivered',
           ).toEqual(['cleanup one', 'cleanup two']);

           assertEffectsCount(0, 'both effects tore themselves down');
         } finally {
           for (const effect of [first, second]) {
             try {
               effect.destroy();
             } catch {
               // the cleanups throw by design
             }
           }
           destroySignal(a);
         }
       });

       it('rethrows a lone failure unchanged, with its identity intact', () => {
         // The counter-probe: one failing subscriber must not become an
         // `AggregateError`. `toBe` on the instance, not `toThrow` on the
         // message — a wrapper carrying the same message would pass that.
         const a = createSignal(0);
         const boom = new Error('cleanup boom');

         const effect = createEffect(() => {
           a.get();
           return () => {
             throw boom;
           };
         });

         try {
           let caught: unknown;
           try {
             destroySignal(a);
           } catch (err) {
             caught = err;
           }

           expect(caught, 'the same object, not a wrapper').toBe(boom);
         } finally {
           try {
             effect.destroy();
           } catch {
             // thrown by design
           }
           destroySignal(a);
         }
       });

       it('leaves a destroy without a failing subscriber alone', () => {
         // The other counter-probe: the ordinary path must stay silent.
         const a = createSignal(0);
         let cleanupRuns = 0;

         const effect = createEffect(() => {
           a.get();
           return () => {
             ++cleanupRuns;
           };
         });

         try {
           expect(() => destroySignal(a)).not.toThrow();
           expect(cleanupRuns).toBe(1);
           assertEffectsCount(0, 'the effect lost its last dependency');
         } finally {
           effect.destroy();
           destroySignal(a);
         }
       });

       it('stops at the failing signal when several are destroyed at once', () => {
         // Pre-existing and untouched here: the frame is opened per signal, so
         // `destroySignal(a, b)` still leaves `b` alive when a subscriber of
         // `a` throws. Isolation is a property of one delivery, not of the
         // argument list. Asserted so that widening the frame to the whole
         // loop — which would change the throw form across signals — has to be
         // a decision instead of a side effect.
         const a = createSignal(0);
         const b = createSignal(0);

         const effect = createEffect(() => {
           a.get();
           return () => {
             throw new Error('cleanup boom');
           };
         });

         try {
           expect(() => destroySignal(a, b)).toThrow('cleanup boom');

           expect(signalImpl(a).destroyed, 'a is gone').toBe(true);
           expect(signalImpl(b).destroyed, 'b never got its turn').toBe(false);
         } finally {
           try {
             effect.destroy();
           } catch {
             // thrown by design
           }
           destroySignal(a, b);
         }
       });

       it('rethrows at the group when no delivery frame is open (soft-detach)', () => {
         // `SignalGroup#off()` emits the soft-detach on the same queue, and it
         // does *not* open a delivery frame. The effect listener then has
         // nowhere to park its failure and rethrows at once, where the group's
         // own per-signal guard picks it up — the same contract `[RECALL]`
         // keeps for a `run()` outside any delivery.
         const a = createSignal(0);
         const group = SignalGroup.findOrCreate({});
         group.attachSignal(a.get);

         const effect = createEffect(() => {
           a.get();
           return () => {
             throw new Error('cleanup boom');
           };
         });

         try {
           expect(() => group.off(), 'raised by the group, not swallowed').toThrow(
             'cleanup boom',
           );
           assertEffectsCount(0, 'the effect lost its only dependency');
         } finally {
           group.clear();
           try {
             effect.destroy();
           } catch {
             // thrown by design
           }
           destroySignal(a);
         }
       });
     });
     ```

     Vier Dinge daran sind gemessen und nicht Geschmack: das `sibling.destroy()` im `finally` des ersten Tests (ohne es sind es gegen den ungefixten Code **5 rote Tests dieser Datei statt 1**, weil `assertLinksCount` im nächsten `beforeEach` schlägt); `link(a.get, (value: number) => …)` statt `link(a.get, other.set)` (die Writer-Signatur nimmt `T | (() => T)` und lässt `tsc` mit `TS2345` abbrechen); Test 3 mit `toBe()` auf die Instanz statt `toThrow()` auf die Nachricht; und Test 6, der als einziger den `throw`-Zweig von `collectDeliveryError() === false` fährt.
  2. **Dann die vier Regressionstests für MEM-008**, als neuer `describe`-Block ans Ende von `src/EffectImpl.destroy.spec.ts`. Keine neue Importzeile — `off` und `on` kommen zum vorhandenen eventize-Import dazu, alles andere steht schon oben.

     ```ts
     describe('every teardown step is guarded on its own (MEM-008)', () => {
       it('runs the cleanup callback even when an onDestroyEffect handler throws', () => {
         // The finding's own scenario, reachable through fully public API: the
         // four steps used to share one `try`, so a throwing reporter took the
         // cleanup — the one place userland releases its resources — with it,
         // on an effect that counts as destroyed and gets no second attempt.
         const {get: a} = createSignal(0);
         let cleanupRuns = 0;

         const effect = createEffect(() => {
           a();
           return () => {
             ++cleanupRuns;
           };
         });

         const unsubscribe = onDestroyEffect(() => {
           throw new Error('reporter boom');
         });

         try {
           expect(
             () => effect.destroy(),
             'the reporter failure still reaches the caller',
           ).toThrow('reporter boom');

           expect(cleanupRuns, 'the cleanup ran all the same').toBe(1);
           expect(getEffectsCount()).toBe(0);
         } finally {
           unsubscribe();
           effect.destroy();
           destroySignal(a);
         }
       });

       it('unsubscribes, reports and cleans up even when a DESTROY listener throws', () => {
         // The first of the four steps. It used to skip the other three: the
         // instance kept its own listeners (`off(this)` never ran), no
         // `onDestroyEffect()` handler was ever told, and the cleanup did not
         // run.
         const {get: a} = createSignal(0);
         let cleanupRuns = 0;
         let reported = 0;

         const effect = createEffect(() => {
           a();
           return () => {
             ++cleanupRuns;
           };
         });
         const impl = effect[$effect] as EffectImpl;

         on(impl, DESTROY, () => {
           throw new Error('listener boom');
         });
         const unsubscribe = onDestroyEffect(() => {
           ++reported;
         });

         try {
           expect(() => effect.destroy()).toThrow('listener boom');

           expect(
             getSubscriptionCount(impl),
             'off(this) ran: no listener is left on the instance',
           ).toBe(0);
           expect(reported, 'the destroy was still reported').toBe(1);
           expect(cleanupRuns, 'and the cleanup still ran').toBe(1);
           expect(getEffectsCount()).toBe(0);
         } finally {
           unsubscribe();
           off(impl);
           effect.destroy();
           destroySignal(a);
         }
       });

       it('reports every failing step, in teardown order', () => {
         // Three failures in one teardown — listener, reporter, cleanup — plus
         // a child. Before the split only the first of the four steps could
         // ever be reported, so the two behind it vanished without a trace.
         const {get: a} = createSignal(0);
         const {get: b} = createSignal(0);

         const effect = createEffect(() => {
           a();
           createEffect(() => {
             b();
             return () => {
               throw new Error('child boom');
             };
           });
           return () => {
             throw new Error('cleanup boom');
           };
         });
         const impl = effect[$effect] as EffectImpl;

         on(impl, DESTROY, () => {
           throw new Error('listener boom');
         });
         const unsubscribe = onDestroyEffect(() => {
           throw new Error('reporter boom');
         });

         try {
           let caught: unknown;
           try {
             effect.destroy();
           } catch (err) {
             caught = err;
           }

           expect(caught).toBeInstanceOf(AggregateError);
           const errors = (caught as AggregateError).errors;

           expect(errors, 'three own steps plus the child').toHaveLength(4);
           expect(
             errors.slice(0, 3).map((err) => (err as Error).message),
             'the four steps report in teardown order',
           ).toEqual(['listener boom', 'reporter boom', 'cleanup boom']);

           // The child fails in the same three ways and hands its report over
           // whole: nested, not flattened, exactly as everywhere else this
           // helper is used. Its own `emit(this, DESTROY)` has no listener, so
           // two of the three steps fail there.
           expect(errors[3]).toBeInstanceOf(AggregateError);
           expect(
             (errors[3] as AggregateError).errors.map(
               (err) => (err as Error).message,
             ),
           ).toEqual(['reporter boom', 'child boom']);

           expect(getEffectsCount()).toBe(0);
         } finally {
           unsubscribe();
           off(impl);
           try {
             effect.destroy();
           } catch {
             // thrown by design
           }
           destroySignal(a, b);
         }
       });

       it('rethrows a lone failing step unchanged, with its identity intact', () => {
         // The counter-probe: one failure must not become an `AggregateError`.
         // `toBe` on the instance — a wrapper with the same message would pass
         // a `toThrow()`.
         const {get: a} = createSignal(0);
         const boom = new Error('cleanup boom');

         const effect = createEffect(() => {
           a();
           return () => {
             throw boom;
           };
         });

         try {
           let caught: unknown;
           try {
             effect.destroy();
           } catch (err) {
             caught = err;
           }

           expect(caught, 'the same object, not a wrapper').toBe(boom);
           expect(getEffectsCount()).toBe(0);
         } finally {
           try {
             effect.destroy();
           } catch {
             // thrown by design
           }
           destroySignal(a);
         }
       });
     });
     ```

     Der dritte Test ist der wertvollste und der empfindlichste: seine Erwartung `['reporter boom', 'child boom']` für das Kind ist **gemessen, nicht abgeleitet** — der Elternteil und das Kind teilen sich denselben werfenden `onDestroyEffect()`-Handler, weshalb das Kind zwei statt einem Fehler meldet. Gegen den ungefixten Code liefert dieselbe Stelle `['listener boom', 'reporter boom']` mit Länge 2.
  3. **Rot sehen, dann erst die Fixes.** Die Ausgabe steht unter Verify (1).
  4. **Der Fix für BUG-011, beide Hälften.** In `src/signal-core.ts` ersetzt der Rahmen die nackte Zeile `:160`, wortgleich zum Vorbild in `writeSignal()`:

     ```ts
           const outerErrors = beginIsolatedDelivery();
           try {
             emit(globalDestroySignalQueue, signal.id, signal.id);
           } catch (err) {
             // Same asymmetry as in `writeSignal()`: an effect parks its own
             // failure in the frame and the delivery goes on. Everything else
             // on this queue — a `SignalLink`, a `SignalGroup`, a
             // `SignalAutoMap`, a memo — is library code without a `catch` of
             // its own, so its throw *does* end the delivery. It must at least
             // not swallow what the effects before it already handed in.
             collectDeliveryError(err);
           } finally {
             endIsolatedDelivery(
               outerErrors,
               'notifying the subscribers of a destroyed signal',
             );
           }
     ```

     Der Frame steht **innerhalb** der `for`-Schleife, ein Frame je Signal — Begründung im Abgleich, festgehalten von Test 5. Kein neuer Import. Dazu ein Absatz ins JSDoc von `destroySignal()`, im Wortlaut der Zusage, die `writeSignal()` bei `:82-89` bereits trägt.

     In `src/EffectImpl.ts` bekommt der Listener die Hälfte, die die Zustellung tatsächlich weiterlaufen lässt. Der heutige Rumpf von `[$destroySignal]` wandert unverändert in eine private Methode, `[$destroySignal]` wird zur Hülle — dieselbe Bauweise, die `[RECALL]` bei `:605-618` schon hat:

     ```ts
       [$destroySignal](signalId: symbol, params?: {detach?: boolean}): void {
         // BUG-011: this is the listener eventize calls, and — exactly as in
         // `[RECALL]` — the only place where swallowing helps. One frame
         // further out, around `emit()`, the dispatch loop has already given
         // up on every subscriber behind this one: the link that is still
         // attached to the dead source, the group that still holds the dead
         // SignalImpl, the auto map entry that is still there. Without an open
         // frame (`SignalGroup#off()`'s soft-detach emit) the error belongs to
         // whoever triggered the teardown and is rethrown here.
         try {
           this.onSignalDestroyed(signalId, params);
         } catch (err) {
           if (!collectDeliveryError(err)) throw err;
         }
       }

       private onSignalDestroyed(
         signalId: symbol,
         params?: {detach?: boolean},
       ): void {
     ```

     Der Rumpf darunter bleibt Zeile für Zeile, wie er ist, inklusive seiner beiden `return`s. Kein neuer Import — `collectDeliveryError` steht seit BUG-004 im vorhandenen.
  5. **Der Fix für MEM-008**, ebenfalls `src/EffectImpl.ts`. Die vier Anweisungen aus dem gemeinsamen `try` bei `:955-964` werden vier `collect()`-Aufrufe; das `errors`-Array und alles darunter (`collectDestroyChildEffects`, das `finally`, `throwCollectedErrors`) bleiben unverändert:

     ```ts
         collect(errors, () => emit(this, DESTROY, this));
         collect(errors, () => off(this));
         collect(errors, () => emit(globalEffectQueue, $destroyEffect, this));
         collect(errors, () => this.runCleanupCallback());
     ```

     Der Kommentar darüber (»Userland code below may throw …«) bleibt und bekommt einen Satz: dass die vier Schritte **einzeln** gesichert sind, weil ein Ausfall des letzten — des Cleanups — die einzige Stelle trifft, an der Anwendungscode seine Ressourcen freigibt, und `destroy()` einen zweiten Versuch nicht kennt. Dazu das JSDoc von `destroy()` bei `:916-934`: der Satz »A cleanup callback that throws propagates to the caller, but does not stop the teardown« gilt ab jetzt für **jeden** der vier Schritte, und die Aufzählung der `AggregateError`-Fälle (»this effect's cleanup and a child's, or several children's«) wächst um die eigenen Schritte.

     **Doku und CHANGELOG.** `docs/api.md:168-179` (die Teardown-Zusage von `Effect.destroy()`) nennt heute nur den Cleanup als möglichen Werfer — dort gehört hin, dass ein `DESTROY`-Listener und ein `onDestroyEffect()`-Handler den Rest des Teardowns ebenso wenig anhalten, und dass mehrere gescheiterte Schritte als `AggregateError` in Teardown-Reihenfolge ankommen. `docs/api.md:57-65` (»A failing effect no longer costs its siblings their notification«) bekommt einen Satz, dass dasselbe für `destroySignal()` gilt: jeder Abonnent wird bedient, bevor die Funktion zurückkehrt oder wirft. `skills/using-signalize/references/pitfalls.md:54` zählt die Aufrufe auf, die in die Sammelform geraten können (`set()`, `touch()`, `batch()`) — `destroySignal()` gehört dazu. `docs/recipes.md` und `docs/cheat-sheet.md` brauchen nichts; sie beschreiben die Sammelform allgemein und stimmen weiterhin. CHANGELOG: zwei Zeilen unter `### Bug Fixes` (eine je Finding) und zwei unter `### Breaking Changes` (eine je geänderter Wurfform), jede mit `(BUG-011, audit 2026-08-08)` beziehungsweise `(MEM-008, audit 2026-08-08)`.
- Verify:
  1. **Der rote Lauf, vor jedem Fix.** `npx vitest run --coverage.enabled=false` über die volle Suite, mit beiden neuen Testblöcken und unverändertem Produktionscode. Erwartet: **5 rote Tests von 519**, in zwei Dateien, und genau diese fünf ersten Assertionen:
     - `src/createSignal.destroySignal.spec.ts` → `serves every subscriber behind a throwing effect cleanup` → `AssertionError: the link let go of the dead source: expected false to be true`
     - `src/createSignal.destroySignal.spec.ts` → `bundles two failing subscribers into an AggregateError, in delivery order` → `AssertionError: expected Error: cleanup one to be an instance of AggregateError`
     - `src/EffectImpl.destroy.spec.ts` → `runs the cleanup callback even when an onDestroyEffect handler throws` → `AssertionError: the cleanup ran all the same: expected +0 to be 1`
     - `src/EffectImpl.destroy.spec.ts` → `unsubscribes, reports and cleans up even when a DESTROY listener throws` → `AssertionError: off(this) ran: no listener is left on the instance: expected 1 to be +0`
     - `src/EffectImpl.destroy.spec.ts` → `reports every failing step, in teardown order` → `AssertionError: three own steps plus the child: expected [ Error: listener boom, …(1) ] to have a length of 4 but got 2`

     Die vier Gegenproben (Tests 3, 4, 5 und 6 aus Schritt 1, Test 4 aus Schritt 2) sind dabei **grün** — sind sie es nicht, misst der Test etwas anderes als die Isolation. 42 von 44 Dateien bleiben grün; **kein einziger fremder Test fällt**, insbesondere kein `beforeEach`/`afterEach`-Wächter (das ist die Wirkung des `sibling.destroy()` im ersten `finally`).
  2. **Der grüne Lauf.** `pnpm world`, neun Schritte. Erwartet: 44 Dateien / **519 Tests** (509 + 10), `test:gc` ebenfalls 519. Coverage gesamt **99,30 / 95,11 / 99,56 / 99,44** gegen 99,29 / 95,09 / 99,55 / 99,44 nach 13a — Branch-Deckung steigt. `EffectImpl.ts` **98,15 / 96,15 / 97,22 / 99,00** gegen die Stufe 97/85/96/98; `signal-core.ts` **100 / 85,71 / 100 / 100** — die Branch-Zahl ist ziffergleich mit der Baseline und liegt 0,71 Punkte über der Schwelle, der neue `catch`-Zweig ist gedeckt. `test:smoke` 4 pass / 0 fail, `rollup -c` ohne `CIRCULAR_DEPENDENCY`, `tsc --noEmit` 0 Fehler, `biome check` ohne Korrektur.
  3. **Mutationsprobe BUG-011, Hälfte 1.** Den Frame in `destroySignal()` entfernen, den Listener-`catch` in `[$destroySignal]` stehen lassen. Erwartet: **2 rot von 519**, `the link let go of the dead source` und `expected Error: cleanup one to be an instance of AggregateError`; 43 von 44 Dateien grün. Gemessen am 2026-08-10.
  4. **Mutationsprobe BUG-011, Hälfte 2.** Umgekehrt: den Frame stehen lassen, den `try`/`catch` in `[$destroySignal]` entfernen (Rumpf direkt aufrufen). Erwartet: **dieselben 2 rot von 519**, dieselben Assertionen. Das ist der Beweis, dass beide Hälften tragen und die Audit-Empfehlung allein nicht reicht — fällt hier nichts, wurde die Isolation woanders gebaut als beschrieben. Gemessen am 2026-08-10.
  5. **Mutationsprobe MEM-008.** Die vier `collect()`-Aufrufe zu einem zusammenziehen (`collect(errors, () => { emit(this, DESTROY, this); off(this); emit(globalEffectQueue, $destroyEffect, this); this.runCleanupCallback(); })`), also der heutige Stand mit dem Helfer geschrieben. Erwartet: **3 rot von 519**, die drei MEM-008-Tests, an `the cleanup ran all the same`, `off(this) ran: no listener is left on the instance` und `three own steps plus the child`; die vierte, die Gegenprobe, bleibt grün. 43 von 44 Dateien bleiben grün. Gemessen am 2026-08-10.
  6. `git status --porcelain --untracked-files=all` — nur `src/signal-core.ts`, `src/EffectImpl.ts`, `src/createSignal.destroySignal.spec.ts`, `src/EffectImpl.destroy.spec.ts`, `docs/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md` und `remediation-plan.md`. Keine Sonde, kein `lib/`, kein `dist/`.
- Commit: `fix: isolate the destroy delivery and guard every effect teardown step on its own (BUG-011, MEM-008)`

<details>
<summary>BUG-011 und MEM-008 im Volltext (aus <code>audit.html</code>)</summary>

**BUG-011 — Die Zustellung in `destroySignal()` isolieren wie die eines Writes**
Severity: high · Kategorie: Bugs & Korrektheitsrisiken · Effort: S · Status: new
Location: `src/signal-core.ts:160` · `src/signal-core.ts:91-115`

> `writeSignal()` öffnet einen `beginIsolatedDelivery()`-Frame, damit ein werfender Effect seinen nachrangigen Geschwistern nicht die Benachrichtigung kostet. `destroySignal()` emittiert nackt. Ein Effect, dessen Cleanup wirft, beendet die Destroy-Zustellung: alle dahinter registrierten Abonnenten desselben Signals gehen leer aus — der `SignalLink` bleibt am toten Quellsignal abonniert, die `SignalGroup` behält den toten `SignalImpl`, ein `SignalAutoMap`-Eintrag bleibt stehen. Die Gruppen-Ebene fängt das nicht ab: `clear()`/`off()` umschließen pro Signal, nicht pro Abonnent.

> Evidence: Nach `destroySignal(s)` mit einem werfenden Effect-Cleanup: `link.isDestroyed = false`, `getLinksCount()`-Delta `1` statt `0`, `group.memberCounts.signals = 1` statt `0`.

> Empfehlung: Denselben `beginIsolatedDelivery()`/`collectDeliveryError()`/`endIsolatedDelivery()`-Rahmen um den Emit legen, den `writeSignal()` schon hat.

**MEM-008 — Jeden Teardown-Schritt in `EffectImpl.destroy()` einzeln absichern**
Severity: high · Kategorie: Memory Leaks & Ressourcen · Effort: S · Status: new
Location: `src/EffectImpl.ts:955-964`

> Vier Schritte stehen in einem gemeinsamen `try`: `emit(this, DESTROY)`, `off(this)`, `emit(globalEffectQueue, $destroyEffect)`, `runCleanupCallback()`. Wirft einer, fallen alle folgenden aus — insbesondere der Cleanup-Callback, also genau die Stelle, an der Anwendungscode seine Ressourcen freigibt. Der Effect gilt trotzdem als zerstört, es gibt also keinen zweiten Versuch. Erreichbar über vollständig öffentliches API: ein werfender `onDestroyEffect()`-Handler genügt. `SignalLink#destroy()` und `SignalGroup#clear()` sammeln hier pro Schritt — `EffectImpl` ist der Ausreißer.

> Evidence: Mit `onDestroyEffect(() => { throw … })`: `destroy` wirft `reporter boom`, `Cleanup-Callback ausgeführt: false`, `getEffectsCount() = 0`.

> Empfehlung: Die vier Schritte je in ein eigenes `try` legen und die Fehler in das bereits vorhandene `errors`-Array sammeln, wie in `SignalLink#destroy()`.

</details>

- **Ergebnis (2026-08-10)** — Hash `daed7c4`. **Damit ist der Punkt »Die Fehlerisolation zu Ende bauen« aus dem Optimierungsteil des Audits geschlossen.** Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 44 Dateien / **520 Tests** (vorher 509), Coverage 99,30 / **95,13** / 99,56 / 99,44, `signal-core.ts` 100 / 85,71 / 100 / 100.
- **Rot gesehen**: 5 failed | 514 passed in zwei Dateien, ohne einen einzigen fremden Fehlschlag und ohne einen ausgelösten Zählerwächter.
- **Die Audit-Empfehlung für BUG-011 repariert allein nichts** — der wichtigste Befund dieses Pakets. Setzt man nur den `beginIsolatedDelivery()`-Frame, bleiben alle fünf beobachteten Werte unverändert: **der Frame sammelt, er fängt nicht.** Isoliert wird beim Listener, und auf dem Destroy-Pfad hatte kein Listener ein `catch`. Der Fix braucht zwei Hälften, und die Mutationsprobe belegt es — jede einzeln zurückgebaut ergibt **dieselben** zwei roten Tests. Vom Reviewer unabhängig reproduziert.
- Alle drei im Finding genannten Opfer sind gerettet, einzeln gemessen statt über die erste fallende Assertion erschlossen: `link.isDestroyed` `false` → `true`, `getLinksCount()` 1 → 0, `getGroupMemberCounts(group).signals` 1 → 0, `map.has('a')` `true` → `false`.
- **Der Frame steht innerhalb der `for`-Schleife, nicht darum.** Ein Frame um die Schleife würde die Wurfform auch über Signale hinweg ändern; `destroySignal(a, b)` bricht weiterhin am ersten scheiternden Signal ab. Der Reviewer hat gegengeprobt: zieht man den Frame um die Schleife, fällt genau ein Test, an `b never got its turn`. Die Assertion misst, was sie festnageln soll.
- **Runde 1 brachte den elegantesten Fund des Laufs.** Der Review fand, dass der neue Listener-`catch` in einem **fremden** Frame parkt: ein Soft-Detach aus `group.off()`, ausgelöst innerhalb einer offenen Write-Zustellung, gab seinen Fehler an den Write statt an die Gruppe — `group.off()` kehrte **still erfolgreich** zurück. Meine Frage an den Implementierer war, ob sich der `catch` an die *Identität* des Frames binden lässt statt an seine Tiefe. Seine Antwort: der Frame hat keine Identität, aber **der Emitter kennt sich selbst**, und das steht seit jeher im zweiten Emit-Parameter. Auf `globalDestroySignalQueue` gibt es genau zwei Emitter — `signal-core.ts` (öffnet den Frame) und `SignalGroup.ts` mit `{detach: true}` (öffnet keinen). `params?.detach` ist damit kein Näherungswert, sondern exakt das Bit »dieser Emit hat keinen Frame geöffnet«. Der Fix ist eine Zeile, und die Verlagerung ist weg:

  | Stand | `offThrew` | `writeThrew` |
  | --- | --- | --- |
  | Baseline | `cleanup boom` | `null` |
  | 13b vor Runde 1 | `null` | `cleanup boom` |
  | jetzt | `cleanup boom` | `null` |

  Der Reviewer hat die Emitter-Behauptung repo-weit gegengeprüft (kein dritter Emitter, `global-queues.ts` aus keinem Entry Point erreichbar, also **kein Konsument kann darauf emittieren**) und den Hard-Destroy-Fall in drei Verschachtelungen gemessen. Damit ist W2 eine Präzisierung, keine Verhaltensänderung — und die Zusage des Plans, dass kein Fix über die Fehlerbehebung hinausgeht, stimmt wieder.
- **Ebenfalls Runde 1: die Doku versprach zu viel.** »every subscriber … every effect, every `link()`, every `SignalGroup`, every `SignalAutoMap` … is served« — isoliert ist aber **nur der Effect**. Gemessen gegen den gefixten Code mit einem werfenden `on(link, 'destroy', …)`-Handler: Group und AutoMap gehen weiterhin leer aus, dieselben zwei Opfer, deren Rettung derselbe Absatz zusagte. An allen drei Stellen (`docs/api.md`, JSDoc, CHANGELOG) auf Effects zurückgezogen, mit der Ausnahme benannt wie beim Write.
- Eine begründete Abweichung von meiner Vorgabe: der Guard `if (!collectDeliveryError(err)) throw err;` in `signal-core.ts` **kommt nicht**, weil die Branch-Deckung der Datei damit von 85,71 auf 81,25 fällt und die 85-%-Schwelle reißt — der `throw`-Zweig ist heute unerreichbar, und kein Test kann ihn fahren. Ein `v8 ignore` wäre der schlechteste Weg (das Repo benutzt null Ignore-Hints, und ausgerechnet den Wächterzweig auszublenden). Der Kommentar sagt jetzt, was Paket 18 zu tun hat; die Auflage steht dort im Plan.
- **Eine Kommentarzeile als Landmine-Markierung**, die kein Test halten kann: `params?.detach` und ein künftiger Soft-Detach-Frame sind **eine Entscheidung, nicht zwei**. Wer `SignalGroup#off()` einen eigenen Frame gibt — der naheliegende erste Reflex —, ändert damit nichts, weil der Guard vorher wirft; der wahrscheinliche nächste Schritt ist, den Guard zu streichen, und genau so kommt der stille Erfolg zurück. Was ein solcher Frame braucht, ist Identität, nicht eine Bedingung weniger.
- **Nebenbefund fürs nächste Audit**: der Soft-Detach-Pfad ist weiterhin **nicht** isoliert — der erste werfende Effect beendet die Zustellung für die übrigen Abonnenten derselben Id. Vor und nach 13b identisch; BUG-011 spricht nur von `destroySignal()`. Der Schaden ist qualitativ anders (das Signal überlebt, der übersprungene Abonnent hält eine Subscription auf etwas Lebendiges), der Fix wäre Blattschicht-Umbau mit Frame-Identität, und er ist eine **gemeinsame Entwurfsfrage mit PERF-008** — getrennt gebaut ergeben sie zwei halbe Antworten.


#### [x] 31. Der werfende erste Lauf soll nichts liegen lassen (P1, P2)
- Findings: **nicht aus `audit.html`** — zwei Befunde, die beim Umbau der Effect-Specs in Paket 7b aufgefallen sind. Vom Reviewer am Code bestätigt und gemessen, beide als `high` eingestuft, vom Nutzer am 2026-08-09 zur Behebung in diesem Lauf freigegeben.
- Ziel: Wirft der erste Lauf eines Effects oder eines Memos, bleibt nichts Gezähltes und nichts Abonniertes zurück — derselbe Griff, den `EffectImpl.run()` sich selbst schon gibt.
- Bereich: `src/EffectImpl.ts`, `src/createMemo.ts`, plus die Specs, deren Gerüste danach entfallen können
- Hängt ab von: Paket 7b (die Testgerüste, die es nur wegen dieser Lecks gibt, stehen dort), Paket 13a und 13b (die Fehlerisolation legt den Rahmen fest, in den sich der Fix einfügen muss)
- Anmerkung (2026-08-10, aus Paket 13): **Der Rahmen, in den sich der Rollback einfügen muss — und die eine Frage, die er beantworten muss, bevor eine Zeile geschrieben wird.** Die Empfehlung des Reviewers lautet `try { … } catch (err) { effect.destroy(); throw err; }`. Genau dieses `throw err` ist nach 13b **verboten**, und zwar aus demselben Grund, aus dem BUG-012 und MEM-008 Findings sind: `effect.destroy()` kann selbst werfen — nach 13b sogar in mehr Fällen als heute, weil es die Fehler aller vier Teardown-Schritte und die der Kinder meldet statt nur des ersten. Ein `throw err` im `catch` würde den Abbau-Fehler ersatzlos verschlucken; ein `throw` aus dem Abbau würde den Lauf-Fehler ersetzen. Der Rollback gehört deshalb in die Form, die 13a und 13b im ganzen Repo durchhalten: `const errors = [runError]; collect(errors, () => effect.destroy()); throwCollectedErrors(errors, 'creating an effect');`. `collect()` steht seit 13a in `src/collect-errors.ts`, `EffectImpl.ts` importiert beides bereits. Vier weitere Zusagen, die 13b festnagelt und die dieser Fix nicht brechen darf:
  1. **Ein einzelner Fehler bleibt bitgleich.** `throwCollectedErrors()` reicht bei `length === 1` dasselbe Objekt samt Stack durch — der überwältigend häufige Fall (der Lauf wirft, der Abbau nicht) ändert seine Wurfform also **nicht**. Das ist die Bedingung dafür, dass P1/P2 ohne Breaking-Changes-Eintrag auskommen. Ein unbedingter Wrapper würde sie brechen.
  2. **`EffectImpl.destroy()` kann ab 13b einen `AggregateError` über bis zu vier eigene Schritte plus die Kinder werfen.** Wer im Rollback auf `err.message` oder `instanceof` prüft, greift daneben.
  3. **`destroySignal(si)` kann ab 13b ebenfalls einen `AggregateError` werfen** (zwei werfende Abonnenten desselben Signals) — betrifft P2s Rollback direkt.
  4. **`destroySignal(a, b)` bricht am ersten scheiternden Signal ab**, festgehalten in `src/createSignal.destroySignal.spec.ts` durch `stops at the failing signal when several are destroyed at once`. Ein Rollback, der mehrere Ressourcen in einem Aufruf abräumt, darf sich nicht darauf verlassen, dass die Schleife durchläuft.

  Die Testbauweise, die 13b gemessen hat und die hier übernommen gehört: `toBe()` auf die Instanz für »unverändert durchgereicht« (ein Wrapper mit derselben Nachricht käme durch ein `toThrow()`), `toBeInstanceOf(AggregateError)` plus `errors.map((e) => e.message)` für die Sammelform, und je eine Gegenprobe für die Fälle, in denen sich die Form **nicht** ändern darf.
- Anmerkung (2026-08-10, aus Paket 32): **P2 bekommt endlich einen Zeugen.** P2 ist ein Signalleck in `createMemo`, und `src/createMemo.spec.ts` war bis Paket 32 die größte Datei im Repo ohne jeden Wächter — 18 Tests, kein `assertSignalsCount`, kein `finally`. Der Regressionstest für P2 kann sich ab jetzt auf den Dateiwächter stützen, statt seinen eigenen Schnappschuss zu bauen; und der Test, der den Fix belegt, fällt auch dann, wenn er ihn selbst zu prüfen vergisst.
- Modell: stärkste Stufe
- Hash: `dd27974`

**P1 · `src/EffectImpl.ts:418-426`, `static createEffect()`** — `effect.run()` läuft vor `return new Effect(effect)`. Propagiert der Lauf einen Wurf (es gibt kein `catch` um `runWithinEffect`, nur ein `finally`), wird `new Effect(effect)` nie erreicht. Der Konstruktor hat bei `:334` bereits hochgezählt und bei `:319` bereits auf `globalEffectQueue` abonniert.

Gemessen mit `createEffect(() => { sig.get(); throw new Error('boom'); })`: `getEffectsCount()` 0 → 1, `getSubscriptionCount(globalEffectQueue)` 0 → 1, kein Halter. Liegen bleibt zusätzlich jedes RECALL-Abo auf den Signalen, die der Callback vor dem Wurf noch gelesen hat. Rettungswege existieren nur zufällig — `attach` (die Gruppe hält den Effect), Erzeugung innerhalb eines fremden Effect-Callbacks (der Elternteil hält ihn), oder das Zerstören aller gelesenen Signale, was den Selbstabbau auslöst. Hat der Callback vor dem Wurf **nichts** gelesen, ist der Effect endgültig unerreichbar.

Das Repo weiß davon: `src/effects.spec.ts:290` trägt seit jeher einen Workaround mit einer Variable namens `leaked` und dem Kommentar »run() throws before the Effect wrapper escapes createEffect«. In Paket 7b mussten zwei weitere Teststellen dasselbe Gerüst bauen (`src/hibernate.spec.ts:215`, `:391`, dazu `:430` aus Runde 1).

**P2 · `src/createMemo.ts:83` gegen `:98`** — das Memo-Signal `si` entsteht vor seinem Effect. Gemessen mit `createMemo(() => { throw new Error('memo boom'); })`: Effects +1, **Signale +1**, beides bleibt stehen. Der Wurf verlässt `createMemo` vor dem `return`, weder Reader noch Signal erreichen je den Aufrufer. Ohne `{attach}` gibt es überhaupt keinen Griff — auch die Selbstabbau-Notbremse aus P1 greift nicht, weil ein Memo-Callback typischerweise wirft, bevor er liest. `{lazy: true}` umgeht es, `{attach}` macht es reparabel.

Empfehlung des Reviewers für beide: den Erzeugungspfad in ein `try { … } catch (err) { effect.destroy(); /* bzw. destroySignal(si) */ throw err; }` fassen.

Zwei Dinge, die der Paket-Planer prüfen muss: ob der Fix die Fehlerform ändert (aus einem nackten Wurf könnte ein `AggregateError` werden, wenn auch der Abbau wirft — das berührt die Zusagen aus Paket 13b — die Antwort steht seit dem 2026-08-10 in der Anmerkung oben), und welche Testgerüste danach entfallen können, ohne dass ein Test seinen Gegenstand verliert.

- Dateien: `src/EffectImpl.ts` (P1), `src/createMemo.ts` (P2), neu `src/creation-rollback.spec.ts`, `src/effects.spec.ts` und `src/hibernate.spec.ts` (Gerüst-Abbau), `docs/api.md`, `docs/recipes.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Abgleich (2026-08-10): beide Befunde **unverändert**, beide am echten Code auf einer Kopie reproduziert (`vitest run --project unit`, Sonde danach zurückgebaut).
  - **P1 · `src/EffectImpl.ts:414-430`** — `const effect = new EffectImpl(...)` bei `:414`, dann `attachChildEffect` `:418`, `emit($createEffect)` `:420`, `effect.run()` `:427`, `return new Effect(effect)` `:430`. Kein `try` dazwischen. Die zwei Zeilennummern der Befundbeschreibung sind nach 13a/13b um vier Zeilen verrutscht: der Konstruktor abonniert bei **`:323`** (`on(globalEffectQueue, this.id, RECALL, this)`) und zählt bei **`:338`** hoch (`++EffectImpl.count`), nicht bei `:319`/`:334`.
    Reproduktion, Snapshot vor/nach `createEffect(() => { sig.get(); throw new Error('boom'); })` als `{effects, signals, effQ, sigQ, desQ}`:
    `{0,1,0,0,0}` → `{1,1,1,1,1}`. Also **drei** Sorten, wie beschrieben: der Zähler, ein Abo auf `globalEffectQueue` und **zwei** Abos je gelesenem Signal (RECALL auf `globalSignalQueue` *und* der Destroy-Wächter auf `globalDestroySignalQueue` — `whenSignalIsRead()` legt beide zusammen an, `src/EffectImpl.ts:637-640`). `getSubscribedEventNames(globalSignalQueue)` enthält die Id des gelesenen Signals. Ohne Lesevorgang: `{0,0,0,0,0}` → `{1,0,1,0,0}`, und dann führt kein Weg mehr zu diesem Effect.
    Die drei Rettungswege sind vermessen, nicht erschlossen: `destroySignal(sig)` bringt den Stand auf `{0,0,0,0,0}` (Selbstabbau greift) · `{attach: host}` lässt den Effect als Gruppenmitglied stehen (`memberCounts.effects === 1`) · innerhalb eines fremden Effect-Callbacks hält ihn der Elternteil (`getEffectsCount() === 2`).
  - **P2 · `src/createMemo.ts:83` gegen `:100`** — das Memo-Signal entsteht bei `:83`, `createEffect` läuft erst bei `:100`, `return si.get` steht bei `:164` (die Befundbeschreibung nennt `:98`, ebenfalls Drift). Reproduktion mit `createMemo(() => { throw new Error('memo boom'); })`: Effects **+1**, Signale **+1**, `globalEffectQueue` **+1**, nichts davon geht zurück. Mit `{attach: host, name: 'answer'}` zusätzlich `globalDestroySignalQueue` **+1**, und die Gruppe hält beides (`{signals: 1, namedSignals: 1, otherSignals: 1, effects: 1}`) — dort ist es reparabel, `group.clear()` räumt es ab. Ohne `attach` gibt es keinen Griff, und die P1-Notbremse greift nicht: der Callback wirft, bevor `si.set()` überhaupt aufgerufen wird, der Effect liest also nichts.
  - **Drei Punkte, die der Befundtext nicht hat, alle gemessen.**
    1. **Es sind vier Gerüste, nicht drei.** `src/effects.spec.ts:336` (das alte) und `src/hibernate.spec.ts:212`, `:388`, `:526`. Das dritte in `hibernate.spec.ts` ist der `:430`-Eintrag der Anmerkung, es steht heute bei `:526` in »works correctly with all contexts combined«.
    2. **Dieselbe Lücke liegt zwei Zeilen weiter oben.** Wirft ein `onCreateEffect()`-Handler, wirft `emit(globalEffectQueue, $createEffect, effect)` bei `:420`, und es bleibt genau dasselbe liegen wie beim werfenden Lauf (gemessen: Effects +1, `effQ` +1). Ein Rollback, der `run()` absichert und den `emit` zwei Zeilen darüber nicht, wäre willkürlich; der geschützte Bereich beginnt deshalb direkt hinter dem Konstruktor. **Nicht** im geschützten Bereich liegt der Konstruktor selbst, und das ist kein Versehen: er zählt und abonniert als Letztes (`:323`, `:338`), nachdem die Namensauflösung durch ist — ein Wurf aus ihm (BUG-003) lässt heute schon nichts zurück, nachgemessen mit `createEffect(() => {}, {dependencies: ['nope'], attach: host})` → `getEffectsCount() === 0`.
    3. **Der `{attach}`-Fall verliert eine Erholung.** Heute überlebt ein Effect, dessen erster Lauf wirft, in seiner Gruppe und **läuft beim nächsten Write wieder** — gemessen: `runs` 1 → 2, und wenn die Ursache weg ist, arbeitet er normal weiter. Nach dem Fix ist er zerstört, `runs` bleibt 1. Das ist kein Nebeneffekt, sondern die Zusage selbst (»`createEffect()` gibt einen `Effect` heraus oder hinterlässt nichts«), aber es ist beobachtbar und gehört in die Breaking Changes — siehe Vorgehen (7).
- Vorgehen: **Zuerst der Test, rot gesehen, dann der Fix** — beides zusammen ist ein Commit (Begründung beim Schnitt unten).

  1. **Die neue Spec-Datei anlegen: `src/creation-rollback.spec.ts`.** Ein Thema, zwei Erzeuger — deshalb eine Datei mit zwei `describe`-Blöcken statt zwei Dateien (`AGENTS.md:229` lässt für Effect-Themen ausdrücklich ein eigenes `effects.<feature>.spec.ts` zu, und das Repo führt mit `nested-effects-isolation.spec.ts`, `effects-and-groups.spec.ts` und `ordering.property.spec.ts` bereits themenbenannte Dateien). Sie trägt die drei Zählerwächter aus Paket 32 in beiden Hooks. Der Wortlaut steht unten in Schritt 8; er ist vollständig, Biome-formatiert (`biome check` sauber) und gemessen — mit Fix zehnmal grün, ohne Fix siebenmal rot.

     **Warum jeder Test seinen `EffectImpl` über `onCreateEffect()` einfängt.** Nicht als Krücke, sondern als Messgerät: `impl.destroyed` ist die einzige Assertion, die »der Effect wurde abgeräumt« *am Objekt* prüft statt über einen Zähler, und in einem roten Lauf ist derselbe Griff das, was den Schaden im eigenen Test einsperrt — `impl?.destroy()` im `finally` stellt die Welt wieder her, bevor der Dateiwächter der nächsten Tests anschlägt. Gemessen: die vier P1-Tests fallen ohne Fix an ihrer eigenen Assertion und lösen **keinen** fremden Hook aus. Die Momentaufnahmen der Subscription-Zähler stehen **hinter** der Registrierung des Fanghandlers — er abonniert `globalEffectQueue` selbst, und die Grundlinie muss beantworten, was `createEffect()` hinterlässt, nicht was der Test hält. (Erste Fassung hatte sie davor: vier Tests grün gegen den kaputten Code, aus dem falschen Grund.)

  2. **Rot fahren.** `pnpm test src/creation-rollback.spec.ts` gegen den unveränderten Produktionscode. Erwartung in Verify (1).

  3. **P1 — `src/EffectImpl.ts`, `static createEffect()`.** Alles zwischen Konstruktor und `return` in ein `try`, der `catch` räumt ab und meldet beides:

     ```ts
     const effect = new EffectImpl(callback, options);

     // BUG-012, von der anderen Seite: der Konstruktor hat gezählt und
     // abonniert, der Aufrufer hält aber noch nichts. Wirft irgendetwas
     // dahinter, ist der Effect für niemanden mehr erreichbar — außer
     // zufällig, über eine Gruppe, einen Elterneffect oder die Zerstörung
     // aller gelesenen Signale. Also gilt hier dieselbe Regel wie in
     // `run()`: ein Lauf, der wirft, lässt den Effect trotzdem geregelt
     // zurück. Der Abbau darf den Erzeugungsfehler dabei weder ersetzen
     // noch verdrängen, deshalb sammeln statt `throw err`.
     try {
       // An effect born while another effect's callback is running belongs to
       // that effect and dies with it — see collectDestroyChildEffects().
       getCurrentEffect()?.attachChildEffect(effect);

       emit(globalEffectQueue, $createEffect, effect);

       if (effect.hasStaticDeps()) {
         if (!effect.destroyed) {
           effect.saveSignalsFromDeps();
         }
       } else if (effect.autorun) {
         effect.run();
       }
     } catch (err) {
       const errors: unknown[] = [err];
       collect(errors, () => effect.destroy());
       throwCollectedErrors(errors, 'creating an effect');
     }

     return new Effect(effect);
     ```

     **Die Form, und warum sie die Auflage aus Paket 13 einhält.** `collect()` und `throwCollectedErrors()` sind in `src/EffectImpl.ts:12-16` bereits importiert, es kommt kein Import dazu. Die vier Zusagen aus 13b, einzeln:
     - *Einzelfehler bitgleich.* `errors` enthält im Normalfall (Lauf wirft, Abbau nicht) genau einen Eintrag, und `throwCollectedErrors` wirft bei `length === 1` **dasselbe Objekt**. Der Test prüft das mit `toBe(boom)` auf die Instanz, nicht mit `toThrow()` — ein Wrapper mit gleicher Nachricht käme durch ein `toThrow` durch.
     - *`destroy()` kann ab 13b einen `AggregateError` über vier eigene Schritte plus die Kinder werfen.* Der `catch` prüft nichts am Fehler — kein `instanceof`, kein `message` —, er sammelt ihn nur. Ein Abbau-`AggregateError` landet als **zweiter Eintrag**, verschachtelt, nicht geplättet.
     - *`destroySignal()` kann ebenfalls sammeln.* Betrifft P2, gleiche Behandlung.
     - *`destroySignal(a, b)` bricht am ersten Fehler ab.* Der Rollback räumt genau **eine** Ressource ab, es gibt keine Schleife, auf deren Durchlauf er sich verlassen müsste.

     Der `catch` läuft ohne `return` aus; das ist kein Loch, sondern die Folge davon, dass `throwCollectedErrors` bei nichtleerem `errors` immer wirft. Ein zusätzliches `throw err` wäre toter Code — und in `EffectImpl.ts` billig, in `createMemo.ts` (Schritt 4) ein Verstoß gegen die 100-%-Stufe der Coverage-Schwellen.

  4. **P2 — `src/createMemo.ts`.** Import ergänzen (`import {collect, throwCollectedErrors} from './collect-errors.js';`, alphabetisch hinter `./batch.js`), dann den gesamten Rumpf ab `const group = …` bis einschließlich `return si.get;` in ein `try` einrücken und anhängen:

     ```ts
     } catch (err) {
       // Das Memo-Signal entsteht vor seinem Effect und hat bis zum `return`
       // keinen Halter: ohne {attach} ist ein Wurf dazwischen ein Signal,
       // das niemand mehr erreicht und das kein Zähler je wieder abgibt.
       // Sammeln statt ersetzen, aus demselben Grund wie in createEffect().
       const errors: unknown[] = [err];
       collect(errors, () => destroySignal(si));
       throwCollectedErrors(errors, 'creating a memo');
     }
     ```

     `destroySignal` ist in `src/createMemo.ts:8` schon importiert. Der geschützte Bereich beginnt hinter `createSignal()` und deckt damit auch `SignalGroup.findOrCreate()` und `attachSignalByName()` ab — dieselbe Lücke, derselbe Griff. Mit P1 zusammen ist der Effect zu diesem Zeitpunkt bereits abgeräumt; `destroySignal(si)` ist alles, was P2 selbst noch zu tun hat.

  5. **Die vier Gerüste abbauen, jedes einzeln geprüft.** Keines von ihnen trägt eine Assertion; alle vier sind reine Aufräumhilfen, die es nur gibt, weil `createEffect()` im Fehlerfall keinen Griff herausgibt. Aber **drei von ihnen räumen auch auf dem Erfolgspfad auf** — dort verwerfen die Tests den Rückgabewert und zerstören den Effect über `impl`. Ersatzlos streichen wäre dort ein neues Leck; sie werden ersetzt, nicht entfernt:
     - `src/effects.spec.ts:328-353`, »runaway self-triggering effect throws once maxDepth is exceeded«: hier **entfällt** das Gerüst ersatzlos. Der Effect wirft im Konstruktionslauf, der Fix zerstört ihn, `leaked?.destroy()` hätte nichts mehr zu tun. Das `finally` behält `EffectImpl.maxDepth = originalMaxDepth;` und `destroySignal(count);`. Der Import von `onCreateEffect` fällt aus der Datei heraus (`onDestroyEffect` und `EffectImpl` bleiben, beide werden weiter gebraucht). Der Prüfgegenstand — die `maxDepth`-Meldung — bleibt unberührt, und der Test **gewinnt** einen Detektor: der Dateiwächter aus Paket 32 sieht ab jetzt, ob der geplatzte Effect zurückbleibt. Achtung beim Nachvollziehen: dieser Test bleibt auch **ohne** den Fix grün, weil `destroySignal(count)` im `finally` den Selbstabbau auslöst — genau der dritte Rettungsweg. Er ist Aufräumarbeit, kein Regressionstest.
     - `src/hibernate.spec.ts:205-235` (»clears effect stack within hibernate callback«), `:383-411` (»restores effect stack when callback throws«) und `:513-568` (»works correctly with all contexts combined«): alle drei setzen ihre Assertionen **in den Effect-Callback**, die Erzeugung gehört also in den `try`. Statt des Fanghandlers hält jetzt eine Variable den Rückgabewert:
       ```ts
       let effect: ReturnType<typeof createEffect> | undefined;

       try {
         effect = createEffect(() => {
           …
         });
       } finally {
         effect?.destroy();
         destroySignal(a);
       }
       ```
       `ReturnType<typeof createEffect>` ist in dieser Datei bereits die übliche Schreibweise (`:575`), es kommt kein Import dazu; `onCreateEffect` fällt aus den Importen heraus, `EffectImpl` bleibt (`:435`, `new EffectImpl(() => {})`). Der Prüfgegenstand — Effect-Stack innerhalb und nach `hibernate()` — steht unverändert im Callback. Was diese drei Tests dabei verlieren, ist nichts: `impl` wurde in keinem von ihnen gelesen, nur zerstört. Was sie gewinnen, ist dasselbe wie oben — fällt eine ihrer Assertionen, ist der Effect nach dem Fix weg, und der Dateiwächter meldet den Rest.
     - **Nicht angefasst** werden die drei weiteren `onCreateEffect()`-Stellen im Baum: `src/createMemo.spec.ts:302` und `src/EffectImpl.destroy.spec.ts:474` benutzen den Handler, um einen Effect *während* der Erzeugung zu zerstören (K1, MEM-003) — das ist ihr Prüfgegenstand, kein Gerüst; `src/effects.onCreateEffect.spec.ts` testet den Hook selbst. Alle drei laufen mit dem Fix unverändert grün (gemessen).

  6. **Die zwei Doku-Zusagen nachziehen, die der Fix bricht.** `docs/api.md:111-116` und `docs/recipes.md:249` sagen beide, ein werfender Callback lasse den Effect unbeschadet: »The effect itself stays usable: it keeps its dependencies and runs again on the next change.« Für jeden Lauf außer dem ersten stimmt das weiter; für den ersten ist es ab jetzt falsch. Beide Stellen bekommen den Nebensatz, dass der **erste** Lauf — der innerhalb von `createEffect()` — die Ausnahme ist: dort gibt es keinen Effect zu behalten, die Erzeugung wird zurückgenommen und der Fehler kommt am `createEffect()`-Aufruf an. Dazu je ein Satz im JSDoc von `createEffect()` (`src/EffectImpl.ts`, über den Überladungen) und von `createMemo()` (`src/createMemo.ts:52-73`), und in der `createMemo`-Sektion von `docs/api.md:262` ein Satz, dass ein werfender `computer` weder Signal noch Effect hinterlässt. `skills/using-signalize/references/pitfalls.md:54` beschreibt die Sammelformen und bekommt den zweiten Weg in die Sammelform bei der Erzeugung — einen Halbsatz, keine neue Nummer.

  7. **CHANGELOG.** Unter `### Bug Fixes` je eine Zeile für P1 und P2, ohne Finding-Id (die gibt es nicht — die Herkunft ist »audit follow-up, Paket 7b«). Unter `### Breaking Changes` **zwei** Zeilen, und das ist eine Korrektur an der Erwartung aus der Anmerkung von Paket 13: die Zusage »Einzelfehler bleibt bitgleich« hält, aber sie ist nicht die einzige beobachtbare Kante.
     - *Die Wurfform ändert sich nur, wenn beide Seiten scheitern.* Wirft der Erzeugungspfad **und** der Rollback, kommt ein `AggregateError` mit `errors: [Erzeugungsfehler, Abbaufehler]` an, wo vorher der Erzeugungsfehler allein ankam (bzw. bei P2: gar kein Abbau stattfand). Dieselbe Präzedenz wie `CHANGELOG.md:176-178` für BUG-012, BUG-011 und MEM-008 — ein `catch`, das `instanceof` prüft oder `.message` liest, sieht den Wrapper.
     - *Ein Effect, dessen erster Lauf wirft, existiert nicht mehr.* Mit `{attach}` (oder erzeugt innerhalb eines fremden Effect-Callbacks) blieb er bisher am Leben und lief beim nächsten Write erneut — gemessen `runs` 1 → 2 —, konnte sich also von einem vorübergehenden Fehler erholen. Wer darauf gebaut hat, ruft `createEffect()` jetzt erneut auf.

  8. **Der Wortlaut der neuen Datei** — `src/creation-rollback.spec.ts`, zehn Tests, sieben davon Regression, drei Gegenproben:

     ```ts
     import {
       getSubscribedEventNames,
       getSubscriptionCount,
       on,
     } from '@spearwolf/eventize';
     import {
       assertEffectsCount,
       assertLinksCount,
       assertSignalsCount,
       getGroupMemberCounts,
       NO_GROUP_MEMBERS,
     } from './__testing__/assert-helpers.js';
     import {createMemo} from './createMemo.js';
     import {createSignal} from './createSignal.js';
     import type {EffectImpl} from './EffectImpl.js';
     import {createEffect, onCreateEffect, onDestroyEffect} from './effects.js';
     import {
       globalDestroySignalQueue,
       globalEffectQueue,
       globalSignalQueue,
     } from './global-queues.js';
     import {SignalGroup} from './SignalGroup.js';
     import {destroySignal, signalImpl} from './signal-core.js';

     describe('a creation that throws leaves nothing behind (P1, P2)', () => {
       beforeEach(() => {
         assertEffectsCount(0, 'beforeEach');
         assertSignalsCount(0, 'beforeEach');
         assertLinksCount(0, 'beforeEach');
       });

       afterEach(() => {
         assertEffectsCount(0, 'afterEach');
         assertSignalsCount(0, 'afterEach');
         assertLinksCount(0, 'afterEach');
       });

       describe('createEffect', () => {
         it('destroys an effect whose first run threw after reading a signal (P1)', () => {
           const sig = createSignal(1);
           const boom = new Error('boom');

           let impl: EffectImpl | undefined;
           const unsubCreate = onCreateEffect((created: EffectImpl) => {
             impl = created;
           });

           // Snapshot behind the capture handler: it subscribes to the effect
           // queue itself, and the baseline has to answer "what did createEffect()
           // leave", not "what does this test hold".
           const effectQueueBefore = getSubscriptionCount(globalEffectQueue);
           const signalQueueBefore = getSubscriptionCount(globalSignalQueue);
           const destroyQueueBefore = getSubscriptionCount(globalDestroySignalQueue);

           let caught: unknown;
           try {
             try {
               createEffect(() => {
                 sig.get();
                 throw boom;
               });
             } catch (err) {
               caught = err;
             }

             expect(caught, 'the run error reaches the caller unchanged').toBe(boom);
             expect(
               impl,
               'the effect did exist — onCreateEffect saw it',
             ).toBeDefined();
             expect(
               impl.destroyed,
               'an effect that never escaped createEffect() must not survive it',
             ).toBe(true);
             assertEffectsCount(0, 'a creation that threw leaves nothing counted');
             expect(
               getSubscriptionCount(globalEffectQueue),
               'the RECALL subscription the constructor made must be gone',
             ).toBe(effectQueueBefore);
             expect(
               getSubscriptionCount(globalSignalQueue),
               'so must the RECALL subscription on the signal the callback read',
             ).toBe(signalQueueBefore);
             expect(
               getSubscriptionCount(globalDestroySignalQueue),
               'and the destroy-watch that came with it',
             ).toBe(destroyQueueBefore);
             expect(
               getSubscribedEventNames(globalSignalQueue),
               'and it is that signal id that is gone, not some other',
             ).not.toContain(signalImpl(sig).id);
           } finally {
             unsubCreate();
             impl?.destroy();
             destroySignal(sig);
           }
         });

         it('destroys an effect whose first run threw before reading anything (P1)', () => {
           const boom = new Error('boom');

           let impl: EffectImpl | undefined;
           const unsubCreate = onCreateEffect((created: EffectImpl) => {
             impl = created;
           });

           const effectQueueBefore = getSubscriptionCount(globalEffectQueue);

           let caught: unknown;
           try {
             try {
               createEffect(() => {
                 throw boom;
               });
             } catch (err) {
               caught = err;
             }

             expect(caught, 'the run error reaches the caller unchanged').toBe(boom);
             expect(
               impl.destroyed,
               'the case with no rescue path at all: nothing was read, so no signal destruction can ever collect this effect',
             ).toBe(true);
             assertEffectsCount(0, 'a creation that threw leaves nothing counted');
             expect(
               getSubscriptionCount(globalEffectQueue),
               'the RECALL subscription the constructor made must be gone',
             ).toBe(effectQueueBefore);
           } finally {
             unsubCreate();
             impl?.destroy();
           }
         });

         it('destroys the effect when an onCreateEffect() handler throws (P1)', () => {
           const boom = new Error('handler boom');

           let impl: EffectImpl | undefined;
           const unsubCreate = onCreateEffect((created: EffectImpl) => {
             impl = created;
           });
           const unsubThrow = onCreateEffect(() => {
             throw boom;
           });

           const effectQueueBefore = getSubscriptionCount(globalEffectQueue);

           let caught: unknown;
           try {
             try {
               createEffect(() => {});
             } catch (err) {
               caught = err;
             }

             expect(caught, 'the handler error reaches the caller unchanged').toBe(
               boom,
             );
             expect(
               impl.destroyed,
               'the $createEffect notification is inside the guarded region, same as the run',
             ).toBe(true);
             assertEffectsCount(0, 'a creation that threw leaves nothing counted');
             expect(getSubscriptionCount(globalEffectQueue)).toBe(effectQueueBefore);
           } finally {
             unsubThrow();
             unsubCreate();
             impl?.destroy();
           }
         });

         it('reports a failing rollback next to the run error instead of in its place (BUG-012)', () => {
           const boom = new Error('boom');
           const reporterBoom = new Error('reporter boom');

           let impl: EffectImpl | undefined;
           const unsubCreate = onCreateEffect((created: EffectImpl) => {
             impl = created;
           });
           const unsubDestroy = onDestroyEffect(() => {
             throw reporterBoom;
           });

           let caught: unknown;
           try {
             try {
               createEffect(() => {
                 throw boom;
               });
             } catch (err) {
               caught = err;
             }

             expect(
               caught,
               'two failures, so the collected form — not one of them dropped',
             ).toBeInstanceOf(AggregateError);
             expect(
               (caught as AggregateError).errors,
               'the run error first, the rollback behind it, both unwrapped',
             ).toEqual([boom, reporterBoom]);
             expect(impl.destroyed, 'the rollback ran to its end').toBe(true);
             assertEffectsCount(
               0,
               'the counter comes back down even when the rollback reports',
             );
           } finally {
             unsubDestroy();
             unsubCreate();
             impl?.destroy();
           }
         });

         it('leaves an effect alone that throws on a later run', () => {
           const sig = createSignal(0);
           const boom = new Error('later boom');
           let runs = 0;

           const effect = createEffect(() => {
             runs++;
             if (sig.get() > 0) throw boom;
           });

           try {
             expect(runs, 'the first run went through').toBe(1);

             let caught: unknown;
             try {
               sig.set(1);
             } catch (err) {
               caught = err;
             }

             expect(caught, 'the write reports the effect failure').toBe(boom);
             expect(runs).toBe(2);
             assertEffectsCount(
               1,
               'a failed rerun is not a failed creation — the effect stays',
             );
           } finally {
             effect.destroy();
             destroySignal(sig);
           }
         });

         it('rolls nothing back when nothing threw ({autorun: false})', () => {
           const effect = createEffect(
             () => {
               throw new Error('never runs at creation time');
             },
             {autorun: false},
           );

           try {
             assertEffectsCount(1, 'the creation itself did not throw');
           } finally {
             effect.destroy();
           }
         });

         it('a constructor that throws never counted anything to roll back (BUG-003)', () => {
           const host = {};

           let caught: unknown;
           try {
             createEffect(() => {}, {dependencies: ['nope'], attach: host});
           } catch (err) {
             caught = err;
           }

           try {
             expect(
               (caught as Error).message,
               'the name lookup fails inside the constructor',
             ).toMatch(/cannot resolve dependency "nope"/);
             assertEffectsCount(
               0,
               'the guarded region starts after the constructor because the constructor counts and subscribes last',
             );
           } finally {
             SignalGroup.delete(host);
           }
         });
       });

       describe('createMemo', () => {
         it('destroys the memo signal and its effect when the first compute throws, {attach} case (P2)', () => {
           const host = {};
           const boom = new Error('memo boom');

           let caught: unknown;
           try {
             try {
               createMemo(
                 () => {
                   throw boom;
                 },
                 {attach: host, name: 'answer'},
               );
             } catch (err) {
               caught = err;
             }

             expect(caught, 'the compute error reaches the caller unchanged').toBe(
               boom,
             );
             assertSignalsCount(0, 'the memo signal must not outlive its creation');
             assertEffectsCount(0, 'and neither must the memo effect');
             expect(
               getGroupMemberCounts(SignalGroup.findOrCreate(host)),
               'the group is left as empty as it was before',
             ).toEqual(NO_GROUP_MEMBERS);
           } finally {
             SignalGroup.findOrCreate(host).clear();
             SignalGroup.delete(host);
           }
         });

         it('destroys the memo signal when the first compute throws (P2)', () => {
           const boom = new Error('memo boom');

           let impl: EffectImpl | undefined;
           const unsubCreate = onCreateEffect((created: EffectImpl) => {
             impl = created;
           });

           const effectQueueBefore = getSubscriptionCount(globalEffectQueue);

           let caught: unknown;
           try {
             try {
               createMemo(() => {
                 throw boom;
               });
             } catch (err) {
               caught = err;
             }

             expect(caught, 'the compute error reaches the caller unchanged').toBe(
               boom,
             );
             assertSignalsCount(
               0,
               'without {attach} nobody holds this signal — a leak here is permanent',
             );
             assertEffectsCount(0, 'and neither must the memo effect survive');
             expect(getSubscriptionCount(globalEffectQueue)).toBe(effectQueueBefore);
           } finally {
             unsubCreate();
             impl?.destroy();
           }
         });

         it('reports a failing signal teardown next to the compute error (BUG-012)', () => {
           const boom = new Error('memo boom');
           const destroyBoom = new Error('destroy boom');

           let impl: EffectImpl | undefined;
           const unsubCreate = onCreateEffect((created: EffectImpl) => {
             impl = created;
           });
           const unsubDestroyQueue = on(globalDestroySignalQueue, () => {
             throw destroyBoom;
           });

           let caught: unknown;
           try {
             try {
               createMemo(() => {
                 throw boom;
               });
             } catch (err) {
               caught = err;
             }

             expect(
               caught,
               'two failures, so the collected form — not one of them dropped',
             ).toBeInstanceOf(AggregateError);
             expect(
               (caught as AggregateError).errors,
               'the compute error first, the signal teardown behind it',
             ).toEqual([boom, destroyBoom]);
             assertSignalsCount(
               0,
               'the signal is gone even though its destroy notification threw',
             );
           } finally {
             unsubDestroyQueue();
             unsubCreate();
             impl?.destroy();
           }
         });
       });
     });
     ```

     Die drei Gegenproben stehen dort mit Absicht und sind einzeln gemessen: »leaves an effect alone that throws on a later run« hält fest, dass der Rollback **nur** an der Erzeugung hängt (der Effect bleibt gezählt, der Write meldet den Fehler); »rolls nothing back when nothing threw« deckt den `{autorun: false}`-Pfad, an dem der Callback erst später wirft; »a constructor that throws never counted anything« nagelt die Grenze des geschützten Bereichs fest. Alle drei sind vor **und** nach dem Fix grün — sie messen, dass sich hier nichts bewegt.
- Verify: alle Zahlen unten sind auf einer Kopie des Baums (`daed7c4` plus dieser Änderung) gemessen, nicht geschätzt. Baseline vor dem Paket: 44 Dateien / 520 Tests, Coverage 99,30 / 95,13 / 99,56 / 99,44.

  1. **Rot, beide Fixes fehlen** — `pnpm test src/creation-rollback.spec.ts` gegen den unveränderten Produktionscode, nachdem die Datei aus Schritt 8 steht. Erwartet **7 failed | 3 passed (10)**, alles in dieser einen Datei, die übrigen 44 Dateien grün. Die erste fallende Assertion je Test, wörtlich:
     - `an effect that never escaped createEffect() must not survive it: expected false to be true`
     - `the case with no rescue path at all: nothing was read, so no signal destruction can ever collect this effect: expected false to be true`
     - `the $createEffect notification is inside the guarded region, same as the run: expected false to be true`
     - `two failures, so the collected form — not one of them dropped: expected Error: boom to be an instance of AggregateError`
     - `the memo signal must not outlive its creation: Number of active signals should be 0 but is 1`
     - `without {attach} nobody holds this signal — a leak here is permanent: Number of active signals should be 0 but is 1`
     - der siebte Fehlschlag ist der `BUG-012`-Memo-Test, und er meldet **zuerst** `beforeEach: Number of active signals should be 0 but is 1`. Das ist kein Kollateralschaden, sondern der Befund selbst: das Signal, das sein Vorgänger verloren hat, ist über keinen Griff mehr erreichbar, also kann kein `finally` es zurückholen. Derselbe Test fällt auch inhaltlich (kein `AggregateError`). Alle drei Gegenproben bleiben grün.
  2. **Grün.** Nach Schritt 3 bis 5: `pnpm test` → **45 Dateien / 530 Tests**, Coverage **99,31 / 95,13 / 99,56 / 99,45** (Statements 1153/1161, Branches 469/493, Functions 231/232, Lines 1092/1098). `createMemo.ts` bleibt auf 100/100/100/100 und reißt damit die Tier-2-Stufe nicht; `EffectImpl.ts` geht auf 98,19 / 96,22 / 97,29 / 99,01, unbedeckt bleiben nur `953-954` wie bisher. Dazu `pnpm typecheck` (0 Fehler), `pnpm check` (86 Dateien, sauber — die neue Spec und `src/effects.spec.ts` brauchen einen `pnpm fix`-Durchlauf — dort kollabiert die Import-Zeile, nachdem `onCreateEffect` herausfällt), `pnpm bundle` (`created dist`, **kein** `CIRCULAR_DEPENDENCY`), `pnpm test:gc` (45 / 530). Zum Schluss `pnpm world` vollständig.
  3. **Mutationsprobe P1** — nur den `try`/`catch` aus Schritt 3 zurückbauen, P2 stehen lassen, Volllauf. Erwartet **6 failed | 524 passed (530)**, alle sechs in `creation-rollback.spec.ts`, 44 von 45 Dateien grün, **kein** ausgelöster Dateiwächter. Die vier P1-Tests fallen an ihrer eigenen `impl.destroyed`- bzw. `AggregateError`-Assertion, die zwei P2-Tests an `and neither must the memo effect: Number of active effects should be 0 but is 1` — sichtbar wird damit auch, dass P2 den Effect nicht selbst abräumt, sondern P1 dafür zuständig ist.
  4. **Mutationsprobe P2** — nur den `catch` aus Schritt 4 zurückbauen, P1 stehen lassen, Volllauf. Erwartet **3 failed | 527 passed (530)**, alle drei in `creation-rollback.spec.ts`, 44 von 45 Dateien grün. Die zwei ersten fallen an `Number of active signals should be 0 but is 1` (einmal `{attach}`, einmal ohne), der dritte über den `beforeEach`-Wächter und inhaltlich am fehlenden `AggregateError`. **Kein P1-Test fällt** — die zwei Fixes sind unabhängig belegt.
  5. **Die Wurfform gegenprüfen, viermal, weil hier die Zusage aus 13b hängt.** Einzelfehler Erzeugung: `caught === boom` (Identität, nicht Nachricht) — steht in vier Tests. Beide Seiten scheitern: `AggregateError` mit `errors` `[boom, reporterBoom]` bzw. `[boom, destroyBoom]`, beide Einträge **dieselben Instanzen**, nicht geplättet. Glücklicher Pfad: kein `errors`-Array wird angelegt. Und der Fall »Abbau wirft, Erzeugung nicht« existiert nicht — ohne Erzeugungsfehler läuft der `catch` nie.
  6. **Der Gerüst-Abbau darf nichts kosten.** Nach Schritt 5 laufen `src/effects.spec.ts` und `src/hibernate.spec.ts` unverändert grün, und `grep -n onCreateEffect src/effects.spec.ts src/hibernate.spec.ts` liefert **null Treffer**. Die eigentliche Probe ist der Volllauf aus (3): dort fehlt der P1-Fix, und **keiner** der vier umgebauten Tests fällt — `effects.spec.ts` heilt sich über `destroySignal(count)` im `finally` selbst, die drei in `hibernate.spec.ts` über `effect?.destroy()` auf dem Erfolgspfad. Der Abbau nimmt also nichts weg, was heute etwas misst; er tauscht eine Krücke gegen die gewöhnliche `finally`-Form.
  7. `git status --porcelain --untracked-files=all` — genau neun Einträge: `src/EffectImpl.ts`, `src/createMemo.ts`, `src/creation-rollback.spec.ts` (neu), `src/effects.spec.ts`, `src/hibernate.spec.ts`, `docs/api.md`, `docs/recipes.md`, dazu `CHANGELOG.md` und `skills/using-signalize/references/pitfalls.md`. Keine Sonde, kein `zz-`, kein `lib/`, kein `dist/`.
- Commit: `fix: roll back a createEffect() or createMemo() that throws before it returns (no finding id, audit follow-up from package 7b)`
- Schnitt: **nicht geteilt.** Der Grund, aus dem Paket 13 geteilt wurde, greift hier nicht: dort standen eine Umformung ohne Verhaltensänderung und zwei Bugfixes nebeneinander, also zwei Beweise, die einander widersprechen (»die Suite meldet exakt dasselbe« gegen »die Suite meldet etwas anderes«). P1 und P2 sind zweimal derselbe Beweis in derselben Datei: ein roter Lauf, der grün wird. Sie in zwei Commits zu legen, hieße P2 gegen einen Zustand zu messen, in dem P1 noch fehlt — und dann meldet jeder P2-Test zusätzlich den Effect, den P1 liegen lässt (gemessen in Mutationsprobe (3): genau die zwei P2-Tests fallen dort mit einer P1-Ursache). Die Größen tragen das: **rund 20 Zeilen Produktionscode** in zwei Dateien, **395 Zeilen** neue Spec, vier ersetzte Gerüste, fünf Doku-Stellen. 13b lag mit 34 Produktions- und 414 Testzeilen in derselben Größenordnung und war ein Paket.

- **Ergebnis (2026-08-10)** — Hash `dd27974`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, **45 Dateien / 531 Tests** (vorher 44 / 520), Coverage 99,31 / 95,17 / 99,56 / 99,45. Neue Spec-Datei `src/creation-rollback.spec.ts` mit 11 Tests.
- **Rot gesehen**: 6 failed | 5 passed. Die zwei `{attach}`-Tests waren dabei schon grün — der Beleg, dass die bedingte Fassung dort nichts bewegt.
- **Was liegen blieb, ist gemessen und jetzt weg**: der Effect-Zähler, das `globalEffectQueue`-Abo und **zwei** Abos je gelesenem Signal (nicht nur RECALL — `whenSignalIsRead()` legt den Destroy-Wächter mit an), bei P2 zusätzlich das Memo-Signal. Ohne einen einzigen Lesevorgang im Callback bleibt der Effect endgültig unerreichbar.
- **Die Entscheidung des Nutzers ist in beide Richtungen festgenagelt.** Der Reviewer hat eine dritte Probe gefahren, die der Implementierer nicht gemacht hatte: Rollback unbedingt, Bedingung in beiden Dateien entfernt → genau die zwei `{attach}`-Gegenproben fallen.
- **Warum P2 dieselbe Bedingung trägt, ist keine Symmetrie, sondern Zwang.** Der Memo-Effect wird intern mit `{attach: group}` erzeugt, P1 lässt ihn also stehen. Ein unbedingter P2-Rollback zerstörte sein Signal, während der Effect weiterlebt und beim nächsten Write `si.set()` auf ein totes Signal ruft — gemessen: `computes` 1 → 2, ein rechnender Zombie. Es kracht nicht (ein Write auf ein zerstörtes Signal ist ein stiller No-Op), und genau das macht es schlimmer.
- **Ein Doku-Beispiel lebte vom Leck.** Das Beispiel in `docs/recipes.md` (»When an effect callback throws«) erzeugte einen Effect, dessen erster Lauf wirft, ohne `attach`, und behauptete danach, ein `sig.set(1)` melde den Fehler erneut. Gemessen vorher `{"setThrew":"a failed"}`, nachher `{"setThrew":null}` — die Aussage hing daran, dass der geleakte Effect noch da war. Der Wurf steht jetzt hinter einer Bedingung, dieselbe Aussage ohne das Leck als Voraussetzung. Als Klasse bemerkenswert: **es gibt im Repo keinen Mechanismus, der Codeblöcke aus `docs/` ausführt** — ein Beispiel, das einen Fehler als Feature benutzt, fällt in keinem Test auf.
- **Runde 1 galt einer Begründung, die der Code nicht hält.** Die Doku erklärte die Ausnahme mit dem *Halter* (»the one where somebody else already holds it«), der Code prüft die *Option*. Für einen Kind-Effect, der innerhalb eines fremden Effect-Callbacks entsteht, fällt das auseinander: der Elternteil hält ihn über `attachChildEffect()`, und er wird trotzdem zurückgerollt. Gemessen — HEAD: Kind lebt, `getEffectsCount() === 2`, läuft beim nächsten Write wieder; jetzt: zerstört. Kein Leck, kein Zählerdrift, aber eine beobachtbare Verhaltensänderung, die unter keiner Breaking-Zeile stand. Drei ausgelieferte Sätze benennen jetzt die Option statt des Halters, und die fehlende Breaking-Zeile ist da.
- Ebenfalls Runde 1: der Pitfall-Satz las sich, als überlebe ein benutzbares Memo. Der `{attach}`-Überlebende eines Memos ist **halb verdrahtet** — `beforeRead` unbesetzt, die Signal→Effect-Bindung fehlt, `destroySignal()` lässt den Effect weiterrechnen. Vor wie nach dem Fix identisch, also keine Regression; jetzt steht es dort: ein Gruppenmitglied zum Abräumen, kein Memo zum Benutzen.
- Zwei Kommentare mitgenommen: dass der geschützte Bereich in `createMemo.ts` einen Schritt weiter reicht, als der Rollback zurücknehmen kann (heute unerreichbar, weil dazwischen nur Zuweisungen stehen), und warum im `catch` kein `return` und kein `throw` folgt — `throwCollectedErrors()` wirft immer, sagt es aber mit `: void` nicht, und nur `strictNullChecks: false` verhindert, dass tsc einen Abschluss verlangt.
- Vier Testgerüste aufgeräumt: das maxDepth-Gerüst in `effects.spec.ts` entfällt ersatzlos, die drei in `hibernate.spec.ts` bleiben als Aufräumung nötig (sie räumen auch auf dem Erfolgspfad auf) und sind auf `effect?.destroy()` umgestellt. Die drei `onCreateEffect()`-Stellen in `createMemo.spec.ts`, `EffectImpl.destroy.spec.ts` und `effects.onCreateEffect.spec.ts` sind Prüfgegenstand, kein Gerüst — unangetastet.
- Nebenbefund fürs nächste Audit: `src/createMemo.ts` — nach einem werfenden ersten Compute steht in der Gruppe ein Memo-Signal ohne `beforeRead`-Kopplung und ohne die zwei Destroy-Bindungen, weil die Verdrahtung erst hinter `createEffect()` steht. Vorbestehend, kein Leck (die Gruppe hält beides). Eine saubere Antwort wäre, die Verdrahtung vor den Autorun zu ziehen — ein Umbau von `createMemo()`.


#### [x] 14. Die Buchhaltungs-Hooks panzern
- Findings: MEM-009 (medium), MEM-010 (medium), MEM-011 (medium), CONS-006 (medium)
- Ziel: Kein werfender Fremd-Listener kostet mehr die Aufräumbuchung — `Priority.Max` an beiden `DESTROY`-Hooks, `unlink()` sammelt pro Link, und `attachEffect()` lehnt einen zerstörten Effect ab wie seine zwei Geschwister.
- Bereich: `src/SignalGroup.ts`, `src/link.ts`
- Hängt ab von: Paket 9, Paket 13a und 13b
- Anmerkung (2026-08-10, aus Paket 9): **Das Netz, das ab jetzt unter diesem Paket liegt.** Wer die `DESTROY`-Hooks umhängt, arbeitet an genau den Stellen, die Paket 9 festgenagelt hat — vier Zusagen, die vorher niemand hielt: `clear() emits DESTROY before it takes anything apart` (der Emit bleibt die *erste* Amtshandlung von `clear()`, und ein Listener sieht die Gruppe im Vollstand: zwei Signale, ein Effect, ein Link, eine Kindgruppe); `clear() destroys the effects before the signals`; `off() switches the child groups off before its own members`; `attachEffect() called repeatedly adds no second DESTROY listener` (TEST-021, aus Paket 8). Eine `Priority.Max`-Umstellung an den Hooks darf keine dieser vier Zeilen bewegen. Bewegt sie eine, ist das eine Verhaltensänderung und keine Panzerung — dann gehört sie begründet, nicht wegformatiert.
- Modell: **mittlere Stufe** — herabgesetzt am 2026-08-10, nach dem Muster von Paket 9 und 10. Alle fünf Tests stehen unten im gemessenen Wortlaut (compiliert, biome-sauber, rot und grün gefahren), alle vier Mutationen sind mit ihrer Fehlermeldung vorgemessen, der Produktionscode ist ein Diff von 16 Zeilen über zwei Dateien. **Mit einer Auflage:** die Doku-Synchronisation zieht sich über fünf Dateien (`docs/api.md`, `docs/cheat-sheet.md`, `docs/recipes.md`s Pitfall-Pendant in `skills/`, `skills/…/references/api.md`, `CHANGELOG.md`) und trägt zwei Breaking-Changes-Zeilen. Wer dort abkürzt, liefert einen Fix, den niemand findet.
- Hash: `0455fc9`
- Dateien: zwei Produktionsdateien, drei vorhandene Spec-Dateien, vier Doku-Dateien. **Keine neue Datei, kein neuer Export, keine neue Modulkante** — `src/link.ts` importiert `./collect-errors.js` neu, und das ist das Blattmodul, das per Definition jeder erreichen darf (`rollup -c` ohne `CIRCULAR_DEPENDENCY` gemessen).

  | Datei | Was | Zeilen |
  | --- | --- | ---: |
  | `src/SignalGroup.ts` | CONS-006-Wächter am Kopf von `attachEffect()`, `Priority.Max` am Hook, zwei Kommentarblöcke, JSDoc | +4 Code, +~14 Kommentar |
  | `src/link.ts` | zwei Importzeilen, `Priority.Max` am Hook in `link()`, `collect()` + `throwCollectedErrors()` in `unlink()`, zwei Kommentarblöcke, JSDoc | +8 Code, +~18 Kommentar |
  | `src/SignalGroup.spec.ts` | 2 neue Tests ans Ende des vorhandenen `describe('effects')`, hinter TEST-021 (heute `:564-597`) | +74 |
  | `src/link.spec.ts` | 1 neuer Test in einem neuen `describe` **als letzter Block der Datei**, plus `Priority` im vorhandenen eventize-Import | +39 |
  | `src/link.unlink.spec.ts` | 2 neue Tests in einem neuen `describe` am Dateiende, plus `import type {SignalLink}` | +96 |
  | `docs/api.md` | `unlink()`-Abschnitt (`:369`), `attachEffect(eff)`-Zeile der Instanztabelle (`:580`) | 2 Stellen |
  | `docs/cheat-sheet.md` | `:96` (unlink), `:136` (attachEffect) | 2 Zeilen |
  | `skills/using-signalize/references/api.md` | `:154` (unlink), `:209` (attachEffect) · `references/pitfalls.md:54` (Pitfall 11d, die Liste der Wege in die Sammelform) | 3 Stellen |
  | `CHANGELOG.md` | 3 Zeilen `### Bug Fixes`, 2 Zeilen `### Breaking Changes` | +5 |

  **Der Ort der Tests ist begründet.** Die zwei `attachEffect()`-Tests gehören in `describe('effects')` von `src/SignalGroup.spec.ts`, weil dort bereits die drei anderen Zusagen über diese Methode stehen (`attachEffect() adds an effect to the group` `:539`, TEST-021 `:564`, `attachEffect() returns the effect` `:1470`) — nach dem Paket steht der gesamte Vertrag der Methode in einer `describe`-Gruppe. Der MEM-010-Test steht **als letzter Block in `src/link.spec.ts`, und das ist probenkritisch**: auf dem ungefixten Code ist der Zählerdrift, den er zeigt, für das ganze Modul dauerhaft (gemessen: auch `destroySignal(source)` korrigiert ihn nicht), jeder Test dahinter fiele im roten Lauf als Kollateralschaden. MEM-011 gehört nach `src/link.unlink.spec.ts`, weil das die Datei ist, die `unlink()` prüft.
- Abgleich (2026-08-10): **alle vier Findings unverändert, alle sechs Zeilenangaben ziffergenau.** Sämtliche Zahlen unten auf zwei HEAD-Kopien (`dd27974`) unter `$S/p14/` und `$S/p14red/` gemessen (`git archive HEAD`, `node_modules` als Symlink), nie im Arbeitsbaum. Baseline dort: 45 Dateien / **531 Tests** grün, Coverage 99,31 / 95,17 / 99,56 / 99,45, `link.ts` 100 / 90 / 100 / 100, `SignalGroup.ts` 98,67 / 90,76 / 100 / 98,56. Ein voller `npx vitest run` kostet 1,4 s, deshalb ist jede Mutation repo-weit gefahren.
  - **MEM-009 unverändert.** `src/SignalGroup.ts:750` (`once(effect, DESTROY, () => {…})`, Normalpriorität) gegen `:819` (`once(link, DESTROY, Priority.Max, () => {…})`). Der Kommentarblock zur Reichweite der Garantie steht bei `:807-818`. **Reproduziert**: Effect mit `{attach}`, danach `on(effectImpl, DESTROY, Priority.High, …)` mit Wurf, dann `effect.destroy()` → der Fehler erreicht den Aufrufer (`listener boom`), `getEffectsCount()` **0**, `getGroupMemberCounts(group).effects` **1**. Genau die Evidenz des Findings. **Was liegen bleibt**: der tote `EffectImpl` samt Callback-Closure in `#effects`, bis `clear()` läuft — gemessen räumt `clear()` ihn dann tatsächlich ab (`effects: 0`), das Leck ist also begrenzt, aber es hängt an der Lebensdauer der Gruppe, und die ist bei einem Komponenten-Host oder einem `@signal`-Objekt die der Anwendung.
  - **CONS-006 unverändert.** `src/SignalGroup.ts:742-759` (`attachEffect()`, kein Wächter) gegen `:457-459` (`#addSignal()`: »Cannot attach a destroyed signal to a group«) und `:786-788` (`attachLink()`: »Cannot attach a destroyed link to a group«). Die im Finding genannten Zeilen `746-759` und `461-463` treffen dieselben zwei Stellen, um vier beziehungsweise vier Zeilen versetzt — der `collect()`-Refactor aus 13a hat `SignalGroup.ts` verschoben. **Reproduziert**: `effect.destroy(); group.attachEffect(effectImpl)` → **kein Wurf**, `getGroupMemberCounts(group).effects === 1` bei `getEffectsCount() === 0`. Bitgleich zur Evidenz.
  - **MEM-010 unverändert.** `src/link.ts:242-251` (`once(newLink, DESTROY, () => {…})`). **Reproduziert, und die dritte Folge ist die schlimmste**: `on(link, DESTROY, Priority.High, …)` mit Wurf, dann `link.destroy()` → `getLinksCount()` bleibt **1**; `destroySignal(source, target)` korrigiert das **nicht** (gemessen: weiterhin 1, für die Prozesslebensdauer); und ein späteres `link(source, sameTarget)` liefert **dasselbe Objekt** zurück (`same: true`), `isDestroyed: true`, und `attach()` darauf wirft sofort `Cannot attach a destroyed link to a group`. Das ist die einzige der vier mit direkt sichtbarer Nutzerwirkung: der Anwender bekommt aus einem gültigen `link()`-Aufruf einen eingefrorenen Leichnam, ohne dass irgendetwas vorher gewarnt hätte.
  - **MEM-011 unverändert.** `src/link.ts:272-276` (die Schleife über `links.values()` mit ungeschütztem `link.destroy()`). **Reproduziert**: drei Links auf einer Quelle, auf dem ersten ein **normalprioriger** `on(link, DESTROY, …)` mit Wurf — MEM-011 braucht keine Prioritätsspiele, ein gewöhnlicher Listener reicht. `unlink(source)` → `isDestroyed` `[true, false, false]`, Zähler-Delta **1 statt 3**, also zwei vollständig abonnierte Links stehen geblieben, `links.clear()` nie gelaufen. Deckt sich mit der Evidenz (»Delta 2«, gemeint: zwei zu viel).
  - **Die Findings hängen zusammen, und die Rechnung ändert sich mit der Reihenfolge.** Mit einem *hochprioren* werfenden Listener auf dem ersten Link ist das Delta heute **0 statt 3** — dann fällt zusätzlich die Buchung von MEM-010 aus. Nach dem MEM-010-Fix allein wäre es 1 statt 3, nach beiden Fixes 3. Gemessen, alle drei Stände.
  - **Die vier Zusagen aus Paket 9 halten, einzeln gefahren statt aus dem Gesamtlauf erschlossen.** Auf der gefixten Kopie sind alle vier grün, namentlich nachgewiesen (`vitest run src/SignalGroup.teardown.spec.ts src/SignalGroup.spec.ts --reporter=verbose`, 115 Tests):
    - `clear() emits DESTROY before it takes anything apart` ✓ — der Emit ist unverändert die erste Amtshandlung von `clear()`; die zwei Hooks hängen an *Effect* und *Link*, nicht an der Gruppe, und `clear()` emittiert, bevor irgendetwas zerstört wird. Der Vollstand, den der Listener sieht, entsteht nicht durch die Hooks.
    - `clear() destroys the effects before the signals` ✓ — die Priorität eines Hooks *auf dem Effect* sagt nichts über die Reihenfolge der Schleifen *in der Gruppe*.
    - `off() switches the child groups off before its own members` ✓ — dito.
    - `attachEffect() called repeatedly adds no second DESTROY listener` (TEST-021) ✓ — der `if (!this.#effects.has(effect))`-Wächter bleibt Zeichen für Zeichen stehen; ein zusätzliches Prioritätsargument an `once()` legt keine zweite Subscription an. Der Test misst genau das über `getSubscriptionCount(effectImpl)` und meldet weiterhin **1** für drei Attaches. Der neue CONS-006-Wächter läuft davor, aber der Effect in diesem Test lebt.
    Die Halte-Bedingung des Pakets tritt damit **nicht** ein.
  - **Eine Verhaltensänderung, die keine der vier Zusagen berührt, aber benannt gehört.** `Priority.Max` heißt: der Buchhaltungs-Hook läuft jetzt **vor** jedem Anwendungs-Listener oberhalb der Normalpriorität. Gemessen an der einzigen Stelle, an der das über die öffentliche Fläche sichtbar ist: ein `on(link, DESTROY, Priority.High, …)` liest `getLinksCount()` heute als **1** und danach als **0**. Für einen Listener auf Normalpriorität ändert sich nichts (gemessen: 0 vorher wie nachher) — der Hook wird zuerst registriert und gewinnt den Gleichstand ohnehin. Der alte Wert war der Defekt; die Zeile gehört trotzdem in den CHANGELOG-Eintrag.
  - **Auf der Gruppenseite ist dieselbe Umstellung nicht öffentlich beobachtbar.** `#effects` erreicht man nur über `memberCounts` (`@internal`, im Test über `getGroupMemberCounts()`), und `runEffects()` überspringt einen zerstörten Effect ohnehin — `run()` ist nach `destroy()` ein No-Op. Kein CHANGELOG-Fall.
  - **Wurfform, gemessen statt behauptet.** `unlink()` heute: der Fehler des ersten scheiternden Links propagiert unverändert, die übrigen Links werden nicht angefasst. Nach dem Fix: **ein** Fehler ist bitgleich derselbe (`toBe()` auf die Instanz, gemessen `identical: true`), **zwei** Fehler kommen als `AggregateError` mit `message: '[signalize] 2 errors while unlinking a source signal'` und `errors: ['boom-a', 'boom-b']` in Teardown-Reihenfolge. Das ist ein **Breaking Change** derselben Klasse, die Paket 12 für `batch()` und 13b für `destroySignal()` protokolliert hat, und braucht eine Zeile.
  - **`attachEffect()` wirft neu — wen trifft es.** Repo-weit gesucht: die einzige interne Aufrufstelle ist `src/EffectImpl.ts:336` (`group?.attachEffect(this)`), die letzte Anweisung vor `++EffectImpl.count` im Konstruktor. Dort ist `#destroyed` zwangsläufig `false`; der Autorun von `createEffect()` läuft erst *hinter* dem Konstruktor, `{attach}` kommt also nie mit einem zerstörten Effect vorbei — auch nicht nach Paket 31, dessen Rollback den Effect zerstört, *nachdem* er attached wurde. Alle 15 weiteren Treffer liegen in `src/SignalGroup.spec.ts`. Bleibt der öffentliche Weg: `group.attachEffect(impl)` aus Anwendungscode. Der Wurf ist ein **Breaking Change** und braucht eine Zeile — der Effekt für den Anwender ist, dass ein bisher stummer Programmierfehler jetzt an der Stelle auffällt, an der er passiert.
  - **Eine Falle für Paket 22, die heute nicht zuschnappt.** `attachEffect()` ist auf `EffectImpl` typisiert, `docs/cheat-sheet.md:136` und `skills/…/api.md:209` schreiben aber `g.attachEffect(e)` mit dem öffentlichen `Effect`-Wrapper. Der hat heute **keinen** `destroyed`-Getter (gemessen: `'destroyed' in effect === false`), also greift `effect?.destroyed` bei ihm nicht und ein zerstörter Wrapper käme weiterhin durch. Sobald API-008 (»`destroyed`-Getter an `Signal` und `Effect`«, Entscheidung vom 2026-08-09, umzusetzen in Paket 22) landet, fängt derselbe Wächter an, auch für Wrapper zu greifen. Das ist die richtige Richtung und kein Grund, hier etwas anders zu bauen — aber es ist eine Verhaltensänderung, die dann in *Paket 22* anfällt und nicht hier.
  - **Nebenbefund, vorbestehend, nicht Gegenstand dieses Pakets**: `group.attachEffect(undefined)` fügt `undefined` in `#effects` ein und wirft danach aus eventize (»cannot attach to a value of type 'undefined'«); das nächste `group.clear()` scheitert mit `Cannot read properties of undefined (reading 'destroy')`. `attachLink()` hat dafür sein `if (link)`, `#addSignal()` gibt `undefined` zurück — `attachEffect()` hat nichts. Der CONS-006-Wächter mit optionalem Zugriff ändert daran nichts (`undefined?.destroyed` ist falsy, der Pfad bleibt wie er ist), verschlimmert es aber auch nicht. Kein Finding des Audits, `medium` im Charakter; die Reparatur wäre eine Produktentscheidung im Stil von CONS-007 (stiller No-Op gegen Wurf) und gehört ins nächste Audit, nicht in diesen Diff.
  - **Kein neuer `critical`- oder `high`-Befund.** Coverage nach dem Paket: global 99,31 / **95,19** / **99,57** / 99,45, `link.ts` unverändert 100 / 90 / 100 / 100, `SignalGroup.ts` 98,68 / **90,90** / 100 / 98,57. Die Bewegung liegt in der zweiten Nachkommastelle, weil beide Dateien vor dem Paket schon fast vollständig gedeckt waren — gedeckt heißt eben ausgeführt, nicht zugesagt, und genau das repariert dieses Paket.
- Vorgehen: vier Fixes, fünf neue Tests, zwei Produktionsdateien. Der Wortlaut unten ist der gemessene — er compiliert (`tsc --noEmit -p tsconfig.json`, 0 Fehler), läuft unverändert durch Biome (`biome check`, keine Korrektur), ist auf dem ungefixten Code rot und danach grün. **Erst die fünf Tests, rot sehen, dann die vier Fixes** — alle vier sind Korrektheitsfindings.
  1. **Nichts exportieren, drei Importzeilen ändern.** `src/SignalGroup.spec.ts` führt `on`, `Priority`, `DESTROY`, `$effect`, `createSignal`, `createEffect`, `assertEffectsCount` und `getGroupMemberCounts` bereits — **keine** neue Importzeile. `src/link.spec.ts`: aus `import {getSubscriptionCount, on} from '@spearwolf/eventize';` wird `import {getSubscriptionCount, on, Priority} from '@spearwolf/eventize';`. `src/link.unlink.spec.ts` bekommt hinter der `./index.js`-Zeile ein `import type {SignalLink} from './SignalLink.js';` (nur für die Typannotation des Aufräum-Arrays). In `src/link.ts`: `import {once, Priority} from '@spearwolf/eventize';` und darunter, vor `./constants.js`, `import {collect, throwCollectedErrors} from './collect-errors.js';` — Biome sortiert alphabetisch, `collect-errors` steht vor `constants`.
  2. **`src/SignalGroup.spec.ts`** — die zwei Tests kommen zusammen ans Ende von `describe('effects')`, hinter TEST-021 (schließt heute auf `:597`) und vor `runEffects() runs all effects in the group`:

     ```ts
     it('attachEffect() takes the effect back out even when a DESTROY listener throws first (MEM-009)', () => {
       // The counterpart to `attachLink()`'s hook, which has carried
       // `Priority.Max` since MEM-002. eventize ends the delivery at the
       // first throwing listener, so a bookkeeping hook on normal priority
       // is at the mercy of whoever subscribed before it: the group kept the
       // dead `EffectImpl` and its callback closure until the next
       // `clear()`. The group's own accounting comes before application
       // code.
       const group = SignalGroup.findOrCreate({});
       const signal = createSignal(0);

       const effect = createEffect(() => {
         signal.get();
       });
       const effectImpl = effect[$effect];

       try {
         group.attachEffect(effectImpl);
         expect(getGroupMemberCounts(group).effects).toBe(1);

         on(effectImpl, DESTROY, Priority.High, () => {
           throw new Error('listener boom');
         });

         expect(
           () => effect.destroy(),
           'the listener error still reaches the caller',
         ).toThrow('listener boom');

         assertEffectsCount(0, 'the effect itself is destroyed either way');

         expect(
           getGroupMemberCounts(group).effects,
           'the group let go of the dead effect, listener or no listener',
         ).toBe(0);
       } finally {
         effect.destroy();
         signal.destroy();
         group.clear();
       }
     });

     it('attachEffect() refuses a destroyed effect, like its two siblings (CONS-006)', () => {
       // `#addSignal()` and `attachLink()` both reject a corpse; this one
       // took it and held it. A destroyed `EffectImpl` has emitted its
       // DESTROY and run `off(this)`, so the `once(effect, DESTROY, …)`
       // counter-hook below never fires again — the group would carry the
       // effect and its callback closure until `clear()`.
       const group = SignalGroup.findOrCreate({});
       const signal = createSignal(0);

       const effect = createEffect(() => {
         signal.get();
       });
       const effectImpl = effect[$effect];

       try {
         effect.destroy();
         assertEffectsCount(0, 'the effect is gone before the attach');

         expect(() => group.attachEffect(effectImpl)).toThrow(
           'Cannot attach a destroyed effect to a group',
         );

         expect(
           getGroupMemberCounts(group).effects,
           'the group did not take the corpse',
         ).toBe(0);
       } finally {
         signal.destroy();
         group.clear();
       }
     });
     ```

     Das `effect.destroy()` im `finally` des ersten Tests ist kein Kopierfehler: der erste `destroy()`-Aufruf wirft, `Effect#destroy()` kommt deshalb nicht bis zu seinem `this[$effect] = undefined`, und der zweite Aufruf läuft in den `if (this.#destroyed) return`-Wächter — ein No-Op, der die Symmetrie des Musters aus Paket 7 wahrt. Im zweiten Test fehlt er bewusst, weil der Effect dort im `try` stirbt.
  3. **`src/link.spec.ts`** — ein neuer `describe`-Block **ans Dateiende**, hinter `describe('MEM-005: an unbounded link register on one source is reported once')`, als letzter Block innerhalb von `describe('link() comprehensive tests')`. Der Kommentar über dem Block ist Teil des Tests, nicht Schmuck:

     ```ts
     // Last block in the file on purpose: before the fix the counter drift
     // this test exposes is permanent for the whole module, so every test
     // behind it would fail as collateral in the red run.
     describe('MEM-010: the registry lets go even when a DESTROY listener throws first', () => {
       it('a throwing listener does not strand the entry, the counter or the next link()', () => {
         const src = createSignal(1);
         const target = createSignal(0);

         try {
           const first = link(src, target);
           assertLinksCount(1, 'after link');

           on(first, DESTROY, Priority.High, () => {
             throw new Error('listener boom');
           });

           expect(
             () => first.destroy(),
             'the listener error still reaches the caller',
           ).toThrow('listener boom');

           assertLinksCount(0, 'the counter came back down');

           const second = link(src, target);
           try {
             expect(
               second,
               'link() built a fresh link instead of handing back the frozen one',
             ).not.toBe(first);
             expect(second.isDestroyed, 'and it is usable').toBe(false);
           } finally {
             second.destroy();
           }
         } finally {
           destroySignal(src, target);
         }
       });
     });
     ```
  4. **`src/link.unlink.spec.ts`** — ein neuer `describe`-Block ans Ende von `describe('unlink()')`:

     ```ts
     describe('MEM-011: one failing link does not cost its siblings their teardown', () => {
       it('unlink(source) tears every link down and reports afterwards', () => {
         const src = createSignal(0);
         const first = link(src, () => {});
         const second = link(src, () => {});
         const third = link(src, () => {});

         try {
           assertLinksCount(3, 'three links on one source');

           on(first, DESTROY, () => {
             throw new Error('listener boom');
           });

           expect(
             () => unlink(src),
             'the failure still reaches the caller',
           ).toThrow('listener boom');

           expect(
             [first, second, third].map((l) => l.isDestroyed),
             'every link was torn down, not only the ones before the throw',
           ).toEqual([true, true, true]);

           assertLinksCount(0, 'and the register is empty again');
         } finally {
           destroySignal(src);
         }
       });

       it('one failure is rethrown unchanged, several arrive as an AggregateError', () => {
         const src = createSignal(0);
         const solo = new Error('solo boom');
         const created: SignalLink<number>[] = [];

         try {
           const one = link(src, () => {});
           created.push(one);

           on(one, DESTROY, () => {
             throw solo;
           });

           let caught: unknown;
           try {
             unlink(src);
           } catch (err) {
             caught = err;
           }

           expect(caught, 'the single error is the very same object').toBe(solo);
           assertLinksCount(0, 'after the single failure');

           const a = link(src, () => {});
           const b = link(src, () => {});
           created.push(a, b);

           on(a, DESTROY, () => {
             throw new Error('boom-a');
           });
           on(b, DESTROY, () => {
             throw new Error('boom-b');
           });

           let aggregated: unknown;
           try {
             unlink(src);
           } catch (err) {
             aggregated = err;
           }

           expect(aggregated, 'two failures are bundled').toBeInstanceOf(
             AggregateError,
           );
           expect(
             (aggregated as AggregateError).errors.map((e: Error) => e.message),
             'in teardown order',
           ).toEqual(['boom-a', 'boom-b']);
           assertLinksCount(0, 'after the double failure');
         } finally {
           // Rule (d) from package 7a: on the unfixed code `unlink()` leaves
           // links standing that still carry their throwing listeners, so an
           // unguarded teardown here would fail a second time and replace the
           // assertion that brought us here. Each link goes down on its own.
           for (const l of created) {
             try {
               l.destroy();
             } catch {
               /* ignore */
             }
           }
           destroySignal(src);
         }
       });
     });
     ```

     **Der geguardete `finally`-Block des zweiten Tests ist gemessen, nicht vorsorglich.** In der ersten Fassung stand dort ein blankes `destroySignal(src)`; im roten Lauf zerstörte das den von `unlink()` übersprungenen Link `b`, dessen Listener warf, und die Meldung des Tests wurde von `Error: boom-b` aus `src/SignalLink.ts:540` ersetzt statt von der Assertion, die ihn rot gemacht hatte. Genau der Fall, vor dem Regel (d) aus Paket 7a warnt. Mit dem Guard meldet er `two failures are bundled: expected Error: boom-a to be an instance of AggregateError`. Die Form `try { … } catch { /* ignore */ }` im `finally` folgt `src/SignalGroup.teardown.spec.ts:219-229`.
  5. **Roten Lauf sehen.** Erwartet: `Test Files 3 failed | 42 passed (45)`, `Tests 5 failed | 531 passed (536)`, sechs Fehlerblöcke — der MEM-010-Test meldet zusätzlich seinen eigenen `afterEach`-Wächter, weil der Drift echt ist. Die genauen Meldungen stehen unten unter »Verify«. Kein fremder Fehlschlag.
  6. **Fix MEM-009 und CONS-006 — `src/SignalGroup.ts`.** Der Wächter kommt an den Kopf von `attachEffect()`, vor den Dedup-Kommentar; das `Priority.Max` in die `once()`-Zeile:

     ```ts
     attachEffect(effect: EffectImpl) {
       if (effect?.destroyed) {
         throw new Error('Cannot attach a destroyed effect to a group');
       }

       // Guarded because eventize's own dedup can't help: …  (unverändert)
       if (!this.#effects.has(effect)) {
         this.#effects.add(effect);
         once(effect, DESTROY, Priority.Max, () => {
           this.#effects.delete(effect);
         });
       }
       return effect;
     }
     ```

     `Priority` ist in `src/SignalGroup.ts:8` bereits importiert. Dazu zwei Textstellen, beide verlangt das Finding ausdrücklich (»inklusive des dortigen Kommentars zur Reichweite der Garantie«):
     - **Ein Kommentarblock über der `once()`-Zeile**, der die Panzerung *und ihre Grenze* benennt, in der Substanz wie `:807-818`: eventize bricht die Zustellung am werfenden Listener ab, auf Normalpriorität entschied die Registrierungsreihenfolge, ob diese Zeile je lief; `Priority.Max` ist `+Infinity` und kein exklusiver Slot — wer sich *vorher* auf `Priority.Max` registriert, läuft weiterhin zuerst (Gleichstand fällt auf die Registrierungsreihenfolge zurück), und dann behält die Gruppe ihren toten Effect. Alles darunter, und das ist jede gewöhnliche Priorität, ist gedeckt. **Nicht** wortgleich kopieren — ein Verweis auf die Schwesterstelle plus die eigene Begründung, sonst stehen zwei identische Absätze in einer Datei.
     - **Eine JSDoc-Zeile an `attachEffect()`**, dass ein bereits zerstörter Effect abgelehnt wird und warum: sein `DESTROY` ist gelaufen, `off(this)` auch, der Gegenhaken feuert nie mehr, die Gruppe trüge die Leiche bis `clear()`.
  7. **Fix MEM-010 — `src/link.ts:242`.** `once(newLink, DESTROY, () => {` → `once(newLink, DESTROY, Priority.Max, () => {`, Rumpf unverändert. Darüber ein Kommentar, der den Unterschied zur Effect-Seite festhält: hier ist der Schaden **dauerhaft**, nicht bloß bis zum nächsten `clear()` — `getLinksCount()` steht für die Prozesslebensdauer zu hoch, der Registry-Eintrag bleibt, `destroySignal(source)` korrigiert ihn nicht (gemessen), und das nächste `link(source, sameTarget)` liefert den eingefrorenen Link, der bei `attach()` wirft. Reichweite wie an den anderen zwei Stellen.
  8. **Fix MEM-011 — `src/link.ts:266-290`.** `unlink()` bekommt eine Fehlerliste, beide Zweige gehen durch `collect()`, und die Meldung steht am Ende:

     ```ts
     const links = gLinks.get(sourceSignal)!;

     const errors: unknown[] = [];

     if (target == null) {
       for (const link of links.values()) {
         collect(errors, () => link.destroy());
       }
       links.clear();
     } else {
       const link = links.get(
         signalImpl(target as SignalLike<ValueType>) ?? target,
       );
       if (link != null) {
         collect(errors, () => link.destroy());
       }
     }

     if (links.size === 0) {
       gLinks.delete(sourceSignal);
     }

     throwCollectedErrors(errors, 'unlinking a source signal');
     ```

     **Warum auch der Einzelziel-Zweig durch `collect()` geht, obwohl das Finding nur die Schleife nennt.** Nicht Symmetrie, sondern der gemeinsame Rumpf: `unlink()` hat danach genau *einen* Ausgang für Fehler, und der `if (links.size === 0)`-Abschluss läuft in beiden Zweigen. Die Wurfform ändert sich dort nicht — der Zweig kann nie mehr als einen Fehler sammeln, und `throwCollectedErrors()` wirft bei `length === 1` dasselbe Objekt (gemessen: `identical: true`).
     **Der `for`-Kopf bleibt `links.values()`, ohne Kopie.** Der Buchhaltungs-Hook aus Schritt 7 löscht während der Iteration den *eigenen* Eintrag; das Löschen des aktuellen Schlüssels ist bei `Map` zulässig, kein anderer Eintrag wird angefasst. Wer hier vorsorglich `[...links.values()]` schreibt, ändert nichts außer der Allokation — aber er nimmt dem `links.clear()` dahinter seinen letzten Rest Sinn.
     Dazu ein Kommentar über dem `errors`-Array (was ohne ihn liegen blieb: jeder nicht besuchte Link vollständig abonniert, `links.clear()` ausgefallen) und eine JSDoc-Zeile an `unlink()` über die Wurfform: gesammelt statt beim ersten Fehler abgebrochen, ein Fehler unverändert, mehrere als `AggregateError` in Teardown-Reihenfolge.
  9. **`docs/api.md`, zwei Stellen.**
     - Der Abschnitt `### unlink(source, target?)` (heute `:369-372`) bekommt einen zweiten Absatz: jeder Link wird abgebaut, bevor irgendetwas gemeldet wird; ein Fehler kommt unverändert, mehrere als `AggregateError` in Teardown-Reihenfolge. Formulierung an `:601` anlehnen, wo `clear()`/`off()` dieselbe Zusage tragen.
     - Die Zeile `` | `attachEffect(eff)` / `runEffects()` | … | `` der Instanztabelle (heute `:580`): »Throws on an already destroyed effect, like `attachSignal()` and `attachLink()`. A destroyed effect takes itself out of the group by itself.« Die zweite Hälfte steht heute schon zwei Absätze weiter unten im Fließtext (`:612-613`) und wird dort **nicht** dupliziert.
  10. **`docs/cheat-sheet.md`**: hinter `g.attachEffect(e); g.runEffects();` (`:136`) ein `// attachEffect throws on a destroyed effect`, und im Link-Block bei `unlink(src, target); unlink(src);` (`:96`) ein `// unlink(src) tears every link down, then reports — several failures as an AggregateError`. Dieselben zwei Zeilen sinngemäß in `skills/using-signalize/references/api.md:154` und `:209`.
  11. **`skills/using-signalize/references/pitfalls.md:54` (Pitfall 11d).** Der Absatz zählt heute jeden Weg in die Sammelform auf — Write, `destroySignal()`, `batch()`, der Rollback aus Paket 31. `unlink(source)` ist ein neuer, und zwar der erste, der *nicht* an einer Zustellung hängt. Ein Halbsatz reicht; die Liste ist bereits lang genug, um an Länge zu leiden.
  12. **`CHANGELOG.md`, unter `## Unreleased`.** Drei Zeilen unter `### Bug Fixes`, ans Ende des Blocks, in der Reihenfolge der Fixes:
      - Ein `SignalGroup` lässt einen zerstörten Effect auch dann los, wenn ein höherpriorer `DESTROY`-Listener wirft — der Buchhaltungs-Hook hängt jetzt auf `Priority.Max`, wie der von `attachLink()`. Vorher blieb der tote `EffectImpl` samt Callback-Closure bis zum nächsten `clear()` in der Gruppe (MEM-009, audit 2026-08-08)
      - Der Registry-Hook von `link()` hängt ebenfalls auf `Priority.Max`. Ein werfender höherpriorer `DESTROY`-Listener ließ `getLinksCount()` für die Prozesslebensdauer zu hoch stehen und den Eintrag in der Registry — ein späteres `link(source, sameTarget)` gab den zerstörten, eingefrorenen Link zurück, der bei `attach()` sofort warf. Ein `DESTROY`-Listener oberhalb der Normalpriorität sieht den Zähler jetzt bereits heruntergebucht (MEM-010, audit 2026-08-08)
      - `unlink(source)` baut jeden Link ab, auch wenn der `DESTROY`-Listener eines früheren wirft. Vorher endete die Schleife dort, jeder noch nicht besuchte Link blieb vollständig abonniert und die Registry wurde nicht geleert (MEM-011, audit 2026-08-08)

      Zwei Zeilen unter `### Breaking Changes`:
      - `unlink(source)` wirft einen `AggregateError` über alle gescheiterten Links statt des ersten Fehlers allein; `errors` steht in Teardown-Reihenfolge. Ein einzelner Fehler kommt unverändert wie bisher — dieselbe Form, die `clear()`, `Effect.destroy()` und `destroySignal()` bereits tragen (MEM-011, audit 2026-08-08)
      - `SignalGroup#attachEffect(effect)` wirft `Cannot attach a destroyed effect to a group`, wo es einen bereits zerstörten Effect bisher stillschweigend aufnahm und bis zum nächsten `clear()` hielt — die Regel, nach der `attachSignal()` und `attachLink()` schon immer verfuhren (CONS-006, audit 2026-08-08)

      **`MEM-009` und `MEM-010` sind im CHANGELOG bereits vergeben** — an ein `SignalAutoMap#delete()` und an eine `gLinks`-`WeakMap` aus früheren Audits. Deshalb trägt jede der fünf Zeilen ihr `audit 2026-08-08`; ohne das Datum zeigen zwei Einträge derselben Datei auf verschiedene Dinge unter demselben Namen.
  13. **Kein Schnitt.** Begründung unter »Planänderung« am Ende des Abschnitts.
- Verify: aus dem Repo-Root, sechs Teile. Alle Zahlen am 2026-08-10 auf den zwei Kopien gemessen.
  1. **Der rote Lauf, vor dem ersten Fix.** `npx vitest run` mit den fünf Tests gegen unveränderten Produktionscode. Erwartet exakt: `Test Files 3 failed | 42 passed (45)`, `Tests 5 failed | 531 passed (536)`, und diese sechs Meldungen — vier inhaltliche Assertionen, eine `toThrow`-Assertion, ein Wächter:

     | Test | Meldung |
     | --- | --- |
     | MEM-009 | `the group let go of the dead effect, listener or no listener: expected 1 to be +0` |
     | CONS-006 | `expected [Function] to throw an error` |
     | MEM-010 | `the counter came back down: Number of active links should be 0 but is 1: expected 1 to be +0` |
     | MEM-010 (`afterEach`) | `afterEach: Number of active links should be 0 but is 1: expected 1 to be +0` |
     | MEM-011 (1) | `every link was torn down, not only the ones before the throw: expected [ true, false, false ] to deeply equal [ true, true, true ]` |
     | MEM-011 (2) | `two failures are bundled: expected Error: boom-a to be an instance of AggregateError` |

     Der zweite MEM-010-Eintrag ist kein Kollateralschaden, sondern der Drift selbst: der Wächter derselben Testrunde. Fällt **irgendein anderer** Test, hat der Implementierer eine Testdatei verändert, die er nicht anfassen sollte — oder den Block in `link.spec.ts` nicht ans Dateiende gesetzt.
  2. **Der grüne Lauf, nach allen vier Fixes.** `pnpm world` vollständig. Erwartet: 45 Dateien / **536 Tests** (vorher 531), `test:gc` ebenfalls 536, Coverage **99,31 / 95,19 / 99,57 / 99,45** gegen die Baseline 99,31 / 95,17 / 99,56 / 99,45. `link.ts` **100 / 90 / 100 / 100** (unverändert), `SignalGroup.ts` **98,68 / 90,90 / 100 / 98,57** (vorher 98,67 / 90,76 / 100 / 98,56). `tsc --noEmit` 0 Fehler, `biome check` ohne Korrektur, `rollup -c` ohne `CIRCULAR_DEPENDENCY` — der neue Import von `link.ts` auf `collect-errors.js` ist gemessen zyklenfrei, `collect-errors.ts` importiert nichts.
  3. **Die vier Zusagen aus Paket 9, namentlich.** `npx vitest run src/SignalGroup.teardown.spec.ts src/SignalGroup.spec.ts --reporter=verbose` und die vier Zeilen im Protokoll aufsuchen: `clear() emits DESTROY before it takes anything apart`, `clear() destroys the effects before the signals`, `off() switches the child groups off before its own members`, `attachEffect() called repeatedly adds no second DESTROY listener (TEST-021)` — alle vier `✓`, 115 Tests in der Auswahl. Das ist kein Ritual: `Priority.Max` verschiebt genau die Reihenfolge, die Paket 9 festgenagelt hat, und ein Gesamt-Grün allein sagt nicht, dass diese vier gelaufen sind.
  4. **Mutationsprobe, vier Eingriffe, jeder einzeln zurückgebaut** — repo-weit gefahren, alle vier am 2026-08-10 vorgemessen:

     | Mutation | Eingriff | Erwartet |
     | --- | --- | --- |
     | **M1** | `Priority.Max` aus `once(effect, DESTROY, …)` in `src/SignalGroup.ts` entfernen | **1 failed \| 535 passed**, MEM-009 an `the group let go of the dead effect, listener or no listener: expected 1 to be +0` |
     | **M2** | den `if (effect?.destroyed) throw`-Wächter ersatzlos streichen | **1 failed \| 535 passed**, CONS-006 an `expected [Function] to throw an error` |
     | **M3** | `Priority.Max` aus `once(newLink, DESTROY, …)` in `src/link.ts` entfernen | **1 failed \| 535 passed**, MEM-010 an `the counter came back down` (plus dessen `afterEach`) |
     | **M4** | `collect(errors, () => link.destroy())` in der Schleife durch `link.destroy()` ersetzen | **2 failed \| 534 passed**, beide MEM-011-Tests an `expected [ true, false, false ] to deeply equal [ true, true, true ]` beziehungsweise `two failures are bundled` |

     Kein einziger Kollateralschaden bei allen vieren: die rote Zeile ist ausschließlich der zugehörige neue Test, und er fällt an seiner Rumpfassertion. Wer weniger misst, hat einen Fix eingebaut, den kein Test hält.
  5. **Gegenprobe zur Wurfform, außerhalb der Suite** (fünf Zeilen in einer Wegwerf-Spec, danach löschen): `unlink()` mit **einem** werfenden Link → das geworfene Objekt ist per `toBe()` dasselbe wie das des Listeners; mit **zwei** → `AggregateError`, `message === '[signalize] 2 errors while unlinking a source signal'`, `errors.map(e => e.message)` gleich `['boom-a', 'boom-b']`. Beides steht als Assertion im zweiten MEM-011-Test; die Gegenprobe ist für den Fall, dass jemand `throwCollectedErrors()` durch einen unbedingten Wrapper ersetzt und der Test das nicht mehr sagt.
  6. `git status --porcelain --untracked-files=all` — nur `src/SignalGroup.ts`, `src/link.ts`, `src/SignalGroup.spec.ts`, `src/link.spec.ts`, `src/link.unlink.spec.ts`, `docs/api.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md` und `remediation-plan.md`. Kein `lib/`, kein `dist/`, keine neue Datei, kein `audit.html`.
- Commit: `fix: arm the bookkeeping hooks against a throwing listener (MEM-009, MEM-010, MEM-011, CONS-006)`
- Planänderung (2026-08-10): **kein Schnitt, das Paket bleibt eines und behält seine Nummer.** Vier Findings, zwei Produktionsdateien, ein Diff von 16 Code-Zeilen plus Kommentar — kleiner als 13b, das ungeteilt blieb. Vor allem aber sind es nicht vier Themen, sondern eines in vier Ausprägungen: eventize beendet die Zustellung am ersten werfenden Listener, und die Buchhaltung der Bibliothek stand dahinter. MEM-009 und CONS-006 liegen in **derselben Methode** (`attachEffect()`, vier Zeilen auseinander) — sie zu trennen hieße, dieselbe Methode zweimal anzufassen. MEM-009 und MEM-010 sind buchstäblich dieselbe Zeile auf zwei Seiten, mit derselben Begründung und demselben Reichweiten-Vorbehalt; getrennt gebaut entstehen zwei Kommentarblöcke, die sich gegenseitig nicht kennen. MEM-011 hängt an MEM-010, und zwar messbar: das Zähler-Delta nach einem `unlink()` mit hochpriorem werfendem Listener ist heute 0 von 3, nach dem MEM-010-Fix allein 1 von 3, nach beiden 3 von 3 — wer nur MEM-011 baut, kann `assertLinksCount(0)` nicht zusagen. Ein Commit, fünf Tests, vier Mutationen, jede mit genau einem roten Test.
- Modell **von der stärksten auf die mittlere Stufe gesenkt**, mit der Auflage bei »Modell«. Begründung wie in Paket 9 und 10: die schwere Arbeit war hier die Frage, ob `Priority.Max` eine der vier Zusagen aus Paket 9 bewegt (Antwort: keine, einzeln nachgewiesen) und wo die Wurfform kippt (`unlink()` ab dem zweiten Fehler, `attachEffect()` grundsätzlich) — beides ist erledigt und beziffert. Der Rest ist Nachfahren.

<details>
<summary>Die vier Findings im Volltext (aus <code>audit.html</code>)</summary>

**MEM-009 — Dem DESTROY-Hook von attachEffect() dieselbe Priority.Max-Panzerung geben wie attachLink()**
Severity: medium · Kategorie: Memory Leaks & Ressourcen · Effort: S · Status: new
Location: `src/SignalGroup.ts:754` · `src/SignalGroup.ts:823`

> `attachLink()` registriert seinen Buchhaltungs-Hook mit `Priority.Max`, `attachEffect()` auf Normalpriorität. Ein Anwendungs-Listener mit höherer Priorität läuft vorher, und wenn er wirft, bricht eventize die Zustellung ab: der zerstörte Effect bleibt in `#effects` stehen und hält seine Callback-Closure bis zum `clear()` der Gruppe am Leben. Zwei Pfade, die dasselbe tun sollen, mit unterschiedlicher Absicherung.

> Empfehlung: `once(effect, DESTROY, Priority.Max, …)` — identisch zu Zeile 823, inklusive des dortigen Kommentars zur Reichweite der Garantie.

> Evidenz: Bei identischem Aufbau: `group.memberCounts.effects = 1` (Effect) gegen `links = 0` (Link).

**MEM-010 — Auch den Zähler-Hook in link() panzern**
Severity: medium · Kategorie: Memory Leaks & Ressourcen · Effort: S · Status: new
Location: `src/link.ts:242-251`

> Der `once(newLink, DESTROY, …)`-Hook, der `gLinks` aufräumt, `gLinkFinalizer` deregistriert und `gLinksCount` dekrementiert, hängt auf Normalpriorität. Ein höherpriorer werfender DESTROY-Listener überholt ihn, und die Folgen sind dauerhaft: `getLinksCount()` steht für die Prozesslebensdauer zu hoch, der Registry-Eintrag bleibt stehen — und ein späteres `link(source, sameTarget)` gibt den *zerstörten*, eingefrorenen Link zurück, der bei `attach()` sofort wirft.

> Empfehlung: Den Hook auf `Priority.Max` heben, wie `SignalGroup#attachLink()`.

> Evidenz: Nach `destroy()` bleibt der Zähler auf `1`, auch nach `destroySignal(source)`. Ein zweites `link()` gibt dasselbe Objekt zurück, `isDestroyed: true`, `attach()` wirft.

**MEM-011 — unlink(source) einen werfenden Link nicht die übrigen kosten lassen**
Severity: medium · Kategorie: Memory Leaks & Ressourcen · Effort: S · Status: new
Location: `src/link.ts:272-276`

> Die Schleife über `links.values()` ruft `link.destroy()` ungeschützt. `SignalLink#destroy()` sammelt zwar intern, wirft aber am Ende — ein einziger werfender DESTROY-Listener beendet damit `unlink()`, und alle noch nicht besuchten Links bleiben vollständig abonniert. `links.clear()` fällt ebenfalls aus. Jeder andere Teardown-Pfad des Pakets sammelt hier.

> Empfehlung: Pro Link ein `try`, Fehler sammeln, am Ende `throwCollectedErrors(errors, 'unlinking a source signal')`.

> Evidenz: Drei Links, der erste mit werfendem Listener: `destroyed = true, false, false`, `getLinksCount()`-Delta `2` statt `0`.

**CONS-006 — attachEffect() einen zerstörten Effect ablehnen lassen**
Severity: medium · Kategorie: Konsistenz · Effort: S · Status: new
Location: `src/SignalGroup.ts:746-759` · `src/SignalGroup.ts:461-463`

> `#addSignal()` wirft »Cannot attach a destroyed signal to a group«, `attachLink()` wirft »Cannot attach a destroyed link to a group« — `attachEffect()` prüft nichts. Ein bereits zerstörter `EffectImpl` hat sein `DESTROY` schon emittiert und `off(this)` gelaufen, also feuert der `once(effect, DESTROY, …)`-Gegenhaken nie. Die Gruppe hält die Leiche samt Callback-Closure bis `clear()`.

> Empfehlung: `if (effect?.destroyed) throw new Error('Cannot attach a destroyed effect to a group')` an den Anfang von `attachEffect()`.

> Evidenz: Nach `e.destroy(); g.attachEffect(impl)` ist `g.memberCounts.effects === 1` bei `getEffectsCount() === 0`, ohne Fehler.

</details>

- **Ergebnis (2026-08-10)** — Hash `0455fc9`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 45 Dateien / **536 Tests** (vorher 531), Coverage 99,31 / 95,19 / 99,57 / 99,45, `rollup -c` zyklenfrei trotz der neuen Kante `link.ts → collect-errors.ts`.
- **Rot gesehen**: 5 failed | 531 passed in drei Dateien. Fünf Meldungen an inhaltlichen Assertionen, die sechste ist der `afterEach`-Wächter des MEM-010-Tests selbst — der Reviewer hat bestätigt, dass das der Drift ist und kein Kollateralschaden: kein anderer Test fällt darüber, weil der Block bewusst ans Dateiende gesetzt wurde.
- **Alle vier Mutationsproben vom Reviewer unabhängig gefahren**, je 1 beziehungsweise 2 rot, ohne Kollateralschaden: `Priority.Max` aus `attachEffect()`, der CONS-006-Wächter gestrichen, `Priority.Max` aus dem `link()`-Hook, `collect()` in `unlink()` durch den nackten Aufruf ersetzt.
- **Die dritte Folge von MEM-010 ist die einzige mit direkt sichtbarer Nutzerwirkung** und ist geprüft: ein späteres `link(source, sameTarget)` liefert jetzt einen frischen Link statt des eingefrorenen, zerstörten, der bei `attach()` sofort geworfen hätte.
- **Die vier Zusagen aus Paket 9 halten**, vom Reviewer namentlich gefahren statt aus dem Gesamt-Grün erschlossen. `Priority.Max` verschiebt die Reihenfolge, in der Listener laufen, und Paket 9 hatte die Teardown-Reihenfolge der `SignalGroup` gerade festgenagelt — der Grund, warum nichts kippt: die zwei Hooks hängen an *Effect* und *Link*, nicht an der Gruppe, und `once()` mit Prioritätsargument legt keine zweite Subscription an.
- Der Reviewer hat zusätzlich die Tie-Break-Reihenfolge der zwei `Priority.Max`-Hooks auf demselben `SignalLink` geprüft (Gruppen-Hook aus `attachLink()` und Registry-Hook aus `link()`): der Gruppen-Hook wird weiterhin zuerst registriert, die Reihenfolge zwischen beiden bleibt unverändert.
- **Regel (d), gemessen statt vermutet**: der `finally`-Block des zweiten MEM-011-Tests braucht einen Guard. Ohne ihn ersetzt `Error: boom-b` aus `SignalLink.ts:540` die eigene Assertion — der Test hätte den Fix bezeugt, ohne ihn zu prüfen. Der Reviewer hat den Guard testweise ausgebaut und es reproduziert.
- Wurfform: `unlink()` reicht einen Einzelfehler bitgleich durch (per `toBe()` auf die Instanz), ab zwei kommt ein `AggregateError` in Teardown-Reihenfolge — Breaking Change, Zeile vorhanden. `attachEffect()` wirft neu; die einzige interne Aufrufstelle ist der `EffectImpl`-Konstruktor, wo `#destroyed` zwangsläufig `false` ist, und der Reviewer hat das auch für den Paket-31-Rollback nachgeprüft.
- Zwei Ungenauigkeiten im Plandokument, ohne Wirkung auf den Code: die Auswahl für die Paket-9-Zusagen umfasst 117 Tests, nicht 115; und MEM-010 kollidiert im CHANGELOG **nicht** mit einem älteren Eintrag — der trägt die ID MEM-002. Nur die MEM-009-Kollision ist real. Das Datums-Suffix bleibt dadurch richtig, nur seine Begründung war ungenau.
- Zwei Nebenbefunde, beide bestätigt und bewusst nicht hier behoben: `attachEffect()` ist auf `EffectImpl` typisiert, während Cheat-Sheet und Skill-Referenz den öffentlichen `Effect`-Wrapper zeigen — der neue Wächter greift dort erst, wenn **API-008 in Paket 22** den `destroyed`-Getter ergänzt. Und `group.attachEffect(undefined)` legt `undefined` in `#effects` ab und lässt das nächste `clear()` crashen; vorbestehend, ohne Finding, nächstes Audit.


#### [x] 15. Batch-Semantik für run() und Memo-Reads
- Findings: ASYNC-002 (medium), ASYNC-003 (medium)
- Ziel: Ein explizit angeforderter `effect.run()` wird im Batch nicht mehr verworfen, und ein Memo-Read im Batch liefert den aktuellen Wert statt den von vorher.
- Bereich: `src/EffectImpl.ts`, `src/batch.ts`, `src/createMemo.ts`, `docs/recipes.md`
- Hängt ab von: Paket 12
- Anmerkung: beobachtbare Verhaltensänderung — Breaking-Changes-Eintrag im CHANGELOG ist Teil des Pakets
- Anmerkung (2026-08-10, aus Paket 32): **Der größte Gewinner des Netzes.** Beide Specs des Bereichs — `src/batch.spec.ts` (11 Tests) und `src/createMemo.spec.ts` (18 Tests, 51 Saatpunkte) — hatten bis Paket 32 weder Wächter noch einen einzigen `finally`-Block. Ein Memo-Read im Batch, der ein internes Signal doppelt anlegt oder eines nicht mehr freigibt, war dort schlicht unbeobachtbar. Ab jetzt zählt jede der 29 Testrunden Effects, Signale und Links.
- Anmerkung (2026-08-10, aus Paket 12): **Was Paket 12 in `batch.ts` festnagelt, bevor dieses Paket dieselbe Datei umbaut.** Fünf neue Tests im Block `the callback error survives a failing flush (BUG-012)` legen die Wurfform von `batch()` in allen vier Kombinationen fest: nur der Callback wirft → derselbe Fehler, identisch, per `toBe()` auf die Instanz geprüft; nur der Flush wirft → derselbe Fehler, ausdrücklich **kein** `AggregateError`; beide werfen → `AggregateError` mit `errors: [Callback, Flush]` in dieser Reihenfolge; ein verschachtelter Batch reicht den Fehler seines Callbacks unverändert nach außen. Wer hier `Batch.current = undefined` vor dem Flush verschiebt, das Fehler-Array eager anlegt oder `throwCollectedErrors()` durch einen unbedingten Wrapper ersetzt, bricht mindestens einen dieser fünf. Zwei Dinge dazu, beide am 2026-08-10 gemessen und für dieses Paket relevant: ein `expect()` **innerhalb** eines Batch-Callbacks ist wertlos, weil `curBatch.run()` im `finally` die `AssertionError` ersetzt — neue Tests in dieser Datei schreiben ihre Beobachtungen nach draußen. Und der offene Nebenbefund: `Batch.flush()` setzt `delayedEffects.length = 0` erst nach `this.run()`, ein werfender Flush lässt die Warteschlange also stehen und derselbe Effect läuft ein zweites Mal (gemessen: 2 Läufe, vor wie nach Paket 12). Ein `try`/`finally` in `flush()` wäre die Reparatur; sie hat kein Finding und gehört, wenn überhaupt, hierher — der neue `hibernate`-Test hält den heutigen Stand mit einer Assertion fest, damit die Änderung begründet wird statt zu passieren.
- Modell: stärkste Stufe
- Hash: `34aec18`
- Dateien: vier Spec-Dateien (alle vier **zuerst**), vier Produktionsdateien, fünf Doku-Dateien. **Keine neue Datei, kein neuer Export, keine neue Modulkante** — `EffectImpl.ts` und `createMemo.ts` importieren `./batch.js` bereits, `rollup -c` läuft mit allen Fixes ohne `CIRCULAR_DEPENDENCY` durch.

  | Datei | Was | Zeilen |
  | --- | --- | ---: |
  | `src/effects.noAutorun.spec.ts` | **zuerst**: 3 Tests in einem neuen `describe` ans Dateiende, plus `import {batch}` (biome sortiert ihn auf Zeile 6) | +105 |
  | `src/batch.spec.ts` | **zuerst**: 5 Tests in einem neuen `describe` ans Dateiende, plus `import type {SignalReader}` | +131 |
  | `src/createMemo.spec.ts` | **zuerst**: der W5-Test dreht sich um (12 → 22), zwei Kommentarblöcke und der Name des Nachbartests ziehen mit | ~40 geändert |
  | `src/hibernate.spec.ts` | **zuerst**: die zwei von Paket 12 festgenagelten Assertionen (`boomRuns` 2 → 1, `escaped` → `undefined`) | ~12 geändert |
  | `src/EffectImpl.ts` | `#explicitRunRequested`, `run`/`runImmediately`/`#run(immediate)`, ein Wort im `[RECALL]`-Gate | +14 Code, +~35 Kommentar |
  | `src/batch.ts` | `unbatch()`, `flush()` mit `try`/`finally` | +12 Code, +~20 Kommentar |
  | `src/Effect.ts` | `runImmediately` als gebundene `@internal`-Property neben `run` | +2 Code, +4 JSDoc |
  | `src/createMemo.ts` | `beforeRead = e.runImmediately` (eine Zeile), JSDoc von `batchWrites` neu | 1 Code, ~25 JSDoc |
  | `docs/api.md` | `run()`-Zeile (`:188`), `batchWrites` (`:303-318`), `batch()`-Abschnitt (`:461-489`), `hibernate()`-Hinweis (`:479`) | 4 Stellen |
  | `docs/recipes.md` | `:205`, der Abschnitt `Memos: batchWrites ist opt-in …` (`:299-344`) samt Überschrift, `:358` | 3 Stellen |
  | `docs/cheat-sheet.md` | `:82-85` (der `batchWrites`-Kommentar im Memo-Block) | 1 Stelle |
  | `skills/using-signalize/references/api.md` | `:139-146` (derselbe Kommentar, ausführlicher) | 1 Stelle |
  | `AGENTS.md` | Abschnitt »Batching« (`:86-92`), ein vierter Schritt | 1 Stelle |
  | `CHANGELOG.md` | 3 Zeilen `### Bug Fixes`, 3 Zeilen `### Breaking Changes` | +6 |

  `README.md` bleibt unberührt: das Batch-Beispiel (`:165-186`) liest das Memo *nach* dem Batch, und die »API at a glance«-Liste ändert sich nicht. `skills/using-signalize/references/pitfalls.md` ebenfalls nicht — dort steht heute keine Zusage über Memo-Reads im Batch, und nach dem Fix gibt es dort auch keine Falle mehr zu beschreiben.
- Abgleich (2026-08-10): **beide Findings unverändert gültig, beide in der Sache, keines zeilengenau** — die `location`-Angaben stammen aus dem Vorgänger-Audit und zeigen ins Leere. Alle Zahlen unten auf einer `git archive HEAD`-Kopie (`0455fc9`) im Scratchpad gemessen, `node_modules` symbolisch verlinkt, nie im Arbeitsbaum, kein `git`-Schreibbefehl beteiligt. Baseline der Kopie: 45 Dateien / **536 Tests** grün, Coverage 99,31 / 95,19 / 99,57 / 99,45.
  - **ASYNC-002 unverändert. Fundstelle heute: `src/EffectImpl.ts:469-473` (das Batch-Gate in `run()`) und `:628-630` (`[RECALL]`).** Die `location`-Zeile des Findings (`:413-417 · :511-516`) zeigt auf die Overload-Kette von `createEffect()` und in den Static-Deps-Zweig — beides falsch, das Verhalten ist es nicht.
  - **ASYNC-003 unverändert. Fundstelle heute: `src/createMemo.ts:136` (`sImpl.beforeRead = e.run;`) und dasselbe Batch-Gate.** Auch hier ist `createMemo.ts:100-118` veraltet; dort steht seit Paket 31 der Rollback-`try`.
  - **Reproduktion, fünf Proben, je gegen beide Codezustände gefahren:**

    | Probe | heute | nach dem Fix |
    | --- | --- | --- |
    | **A1** `{autorun:false}`, `run()` im Batch, Dependency vorher geschrieben | `[0]` — der Lauf ist **weg**, auch nach dem Batch | `[0,1]`, beim Schließen des Batches |
    | **B1** ein im Batch erzeugtes Memo im selben Batch gelesen | `undefined` | `20` |
    | **B2** Memo nach einem Write auf seine Dependency im Batch gelesen | `20` (der Wert von vorher), nach dem Batch `40` | `40` |
    | **B3** dasselbe mit `{lazy:true}` | `20`; der Flush macht daran nichts, erst der nächste Read außerhalb | `40` |
    | **B4** Recomputes je Batch (ein Write, zwei Reads) | `[2]` | `[2]` — **unverändert** |
    | **B5** Downstream-Effect eines im Batch gelesenen Memos | im Batch `[]`, danach `[4]` | unverändert |

    A1 ist die Ziffer aus der `evidence` des Findings, nur zu Ende gemessen: das Audit hält bei »1 → 1 (unverändert)« an, und die dritte Messung — ein `run()` *nach* dem Batch liefert `[0,1]` — zeigt, dass der angeforderte Lauf nicht verschoben, sondern verworfen wurde.
  - **Weg für ASYNC-002: die zweite Empfehlung (Absicht am Effect vermerken), nicht die erste.** Der Batch hält ausschließlich Ids (`delayedEffects: Array<[number, Set<symbol>]>`) und erreicht den Effect einzig über `emit(globalEffectQueue, id, id, RECALL)`; »den Flush `run()` direkt aufrufen lassen« bräuchte also eine zweite Aktionsart auf der Queue, einen zweiten Listener je Effect, eine Id→Effect-Registry und dazu eine Erweiterung des Dedup-Wächters in `Batch.run()`, der heute auf `actionType === RECALL` hört. Die Absicht gehört ohnehin dem Effect, der gefragt wurde, und `[RECALL]` ist die einzige Stelle, die sie heute wegwirft: ein Feld und ein zweites Konjunkt im Gate genügen.
  - **Die Lebensdauer des Vermerks ist die halbe Arbeit.** Er wird nur gesetzt, wenn `!autorun` — ein Autorun-Effect braucht ihn nie —, und er wird **nicht** von `[RECALL]` verbraucht, sondern von dem Lauf, der ihn einlöst (`this.#explicitRunRequested = false` unmittelbar hinter dem Batch-Gate). Grund, gemessen: läuft der Effect aus einem anderen Anlass, bevor der Flush an ihn kommt, so trägt `globalEffectCalledQueue` seine Id in `alreadyBeenCalled` ein und der Flush überspringt sein RECALL — der Vermerk bliebe scharf und der nächste beliebige Write würde den Effect laufen lassen. Das ist der Moment, in dem `{autorun:false}` still zu `true` geworden wäre. Probe: ein Helfer-Effect auf `Priority 1000`, der im Flush `target.run()` ruft, danach ein einfacher Write → `seen` bleibt bei `[1]`. Der zweite Test unten hält dieselbe Zusage auf dem kurzen Weg fest; Mutation M2 belegt sie.
  - **ASYNC-003: `beforeRead` bekommt einen eigenen Eingang, der Batch bleibt offen.** Der naheliegende Weg — in `createMemo()` um `e.run()` herum `clearBatch()`/`restoreBatch()` legen, beides ist aus `batch.ts` bereits exportiert und `hibernate.ts` macht es vor — ist **falsch, und zwar messbar**: der Recompute schreibt das Memo-Signal, und mit weggeräumtem Batch laufen die Downstream-Effects dieses Writes sofort statt gebündelt. Genau darauf zielt der Halbsatz des Findings (»der Write wird vom Batch ohnehin dedupliziert«) — er hält nur, solange der Batch währenddessen aktuell bleibt. Deshalb ist der Bypass per-Aufruf (`#run(immediate)`), nicht per-Rahmen. Als Kontrollmutation M6 gefahren: der Entwurf mit `clearBatch()` fällt an genau einem Test (`the recompute must not notify past the open batch: expected [ 4 ] to deeply equal []`).
  - **Warum `Batch.unbatch()` dazugehört und nicht Beiwerk ist.** Ohne die Rücknahme steht die Id des Memo-Effects nach dem vorgezogenen Lauf weiter in der Warteschlange, und der Flush rechnet dasselbe Memo ein zweites Mal (gemessen: `computes` `[2]` → `[2,2]`). Der Wert bliebe richtig, aber die Zahl der Callback-Aufrufe je Batch änderte sich — eine dritte beobachtbare Änderung, die zu keinem der beiden Findings gehört. Mit `unbatch()` lautet die Zusage sauber: **der Read zieht den Lauf vor, er fügt keinen hinzu.** Ein späterer Write im selben Batch reiht den Effect über `batch()` wie gehabt wieder ein — zurückgenommen wird der anstehende Lauf, nicht der Platz in der Prioritätsordnung.
  - **Was der ASYNC-003-Fix für `{batchWrites: true}` bedeutet: der dokumentierte Vorbehalt ist danach gegenstandslos, und die Zusage muss umformuliert werden.** Der Vorbehalt ist heute die halbe Begründung dafür, dass die Option per Default aus ist (`src/createMemo.ts:33-48`, `docs/api.md:310-318`, `docs/recipes.md:320-344`, dazu die Kurzfassungen in `cheat-sheet.md` und der Skill-Referenz). Er beschreibt exakt den Mechanismus, den dieser Fix abschafft — `beforeRead` ist `e.run`, `run()` verschiebt im Batch —, und fällt mit ihm. Gemessen ist es der einzige bestehende Test, der sich dreht: `{batchWrites: true}: reading a dirty lazy memo from within a batched outer memo returns its stale value` (`src/createMemo.spec.ts:691`) liefert statt `12` jetzt `22`, und `signalImpl(inner)?.value` statt `10` jetzt `20`. **Der Default bleibt trotzdem `false`** — das ist keine Produktentscheidung dieses Pakets, sondern bleibt bei PERF-001: was `batchWrites: true` kostet, ist ab hier eine `Batch`-Instanz je Recompute (und damit PERF-002 in Paket 17), nicht mehr die Lesefrische. Genau so werden die fünf Stellen umgeschrieben; der Nachbartest `default (no batchWrites): …returns its fresh value` bleibt inhaltlich unberührt und bekommt nur ein »too« im Namen, weil er jetzt der Zwilling und nicht mehr der Gegensatz seines Vorgängers ist.
  - **Wechselwirkung mit Paket 12: keine der vier Wurfform-Kombinationen bewegt sich.** Alle fünf Tests aus `describe('the callback error survives a failing flush (BUG-012)')` bleiben grün, in jedem der sechs Mutationsläufe unten. Das ist kein Zufall, sondern die Bauform: `batch()` ruft `curBatch.run()`, nicht `flush()` — der `finally`-Zusatz aus dem Nebenbefund liegt in einer Methode, die `batch()` überhaupt nicht anfasst, und `Batch.run()` bleibt Zeile für Zeile unverändert. Die zweite Warnung aus Paket 12 ist dagegen scharf und wurde befolgt: in den zwei neuen Tests, die *innerhalb* eines Batch-Callbacks beobachten (`seenInsideTheBatch = [...seen]`), steht kein einziges `expect()` im Callback.
  - **Der Nebenbefund aus Paket 12 wird behoben, und die `boomRuns`-Assertion fällt.** Entscheidend ist ein Detail von `Batch.run()`: es stellt jedem Eintrag der Warteschlange sein RECALL zu und wirft erst danach, aus `endIsolatedDelivery()`. Eine geworfene Warteschlange ist also nie »halb abgearbeitet«, sondern immer vollständig verbraucht — sie stehen zu lassen ist unter keinem Blickwinkel richtig. Heute läuft derselbe Effect deshalb zweimal für einen Write, und derselbe Fehler wird an zwei verschiedene Aufrufer gemeldet (an `hibernate()` und, beim Schließen, an `batch()`). Gemessen nach dem `finally`: `boomRuns` 2 → **1**, `escaped` `Error: effect boom` → **`undefined`**. Beide Assertionen in `src/hibernate.spec.ts:487-488` drehen sich, mitsamt ihrem Kommentar; Mutation M5 fährt den Beweis rückwärts. Der einzige Aufrufer von `flush()` ist `hibernate()` — `batch()` wirft seine `Batch`-Instanz nach `run()` ohnehin weg, weshalb dort nie jemand etwas gemerkt hat.
  - **Kein neuer `critical`- oder `high`-Befund**, und keine Verhaltensänderung über die beiden Findings plus diesen Nebenbefund hinaus: die volle Suite meldet gegen die Fixes genau zwei rote Tests, beide oben benannt und beide gewollt.
  - **Die veröffentlichte Typfläche wächst nicht.** `runImmediately` trägt `@internal` an beiden Stellen, und `tsconfig.types.json:11` steht auf `stripInternal: true` — nachgeprüft im Build der Kopie: `lib/Effect.d.ts` und `lib/EffectImpl.d.ts` führen weiterhin nur `run: () => void`. Zur Laufzeit ist die Methode da, wie jedes andere `@internal` dieser Bibliothek. Die gebundene Property statt einer Prototyp-Methode ist Absicht: `createMemo()` weist sie zu (`beforeRead = e.runImmediately`), wie bisher `e.run`, ohne zusätzliche Closure. Die Notiz in der JSDoc von `Effect#onDestroy()` — dass diese Inkonsistenz einmal zu klären ist — bleibt gültig und ist Paket 22/23; hier wird ihr gefolgt, nicht vorgegriffen.
  - **Zwei Id-Kollisionen, beide real, beide dieselbe Falle wie in Paket 12.** Unter `## Unreleased` stehen bereits `(ASYNC-002)` (Breaking Changes, `CHANGELOG.md:169`, es geht um Cleanups von `async`-Callbacks) und `(ASYNC-003)` (zweimal, `:32` und `:173`, die Thenable-Wache von `batch()`) — beide aus dem Audit vom 2026-08-07. **Jede Zeile dieses Pakets trägt deshalb `audit 2026-08-08`.** Dasselbe gilt im Testcode: `src/batch.spec.ts:248` führt bereits ein `describe('rejects thenable-returning callbacks (ASYNC-003)')`, also trägt der neue Block in derselben Datei den Datumszusatz im Namen.
  - **Coverage.** `batch.ts`, `createMemo.ts` und `Effect.ts` bleiben bei 100/100/100/100 — die Tier-2-Negation in `vitest.config.ts` erzwingt das für alle drei, ein ungedeckter Zweig in `unbatch()` hätte den Lauf gebrochen. Alle drei Zweige der Schleife werden von den neuen Tests gefahren: leeres `delayedEffects` (das im Batch erzeugte Memo), Treffer (`prio === priority`, das Memo nach einem Write), Nicht-Treffer (der Lazy-Memo-Test, in dem ein Effect auf Priorität 0 in der Schlange steht und das Memo auf 1000 gar nicht erst eingereiht wurde — `[RECALL]` reicht einen lazy Memo nicht an `run()` weiter). `EffectImpl.ts` steigt auf 98,27 / 96,49 / 97,43 / 99,06 (vorher 98,20 / 96,29 / 97,29 / 99,02), Gesamt auf 99,32 / 95,26 / 99,57 / 99,46.
  - Baum nach allen Messungen sauber: `git status --porcelain --untracked-files=all` zeigt nur `M remediation-plan.md`, `git diff -- src/ docs/ skills/ audit.html CHANGELOG.md` ist leer.
  - **Zur Modellstufe:** bleibt die stärkste. Der Code ist klein und gemessen, die Doku ist es nicht: fünf Stellen tragen dieselbe Begründung für den `batchWrites`-Default, und die muss ausgetauscht werden, ohne den Default selbst anzufassen. Wer dort mechanisch »stale« streicht, hinterlässt eine Option ohne Begründung.
- Vorgehen: acht Schritte, Tests zuerst. Der Wortlaut unten ist der gemessene — er compiliert (`tsc --noEmit -p tsconfig.json`, 0 Fehler), geht ohne Korrektur durch `biome check`, und ist in beiden Codezuständen gefahren. Die Kommentare im Produktionscode sind nachträglich formuliert und verhaltensneutral.
  1. **Zuerst die drei Regressionstests für ASYNC-002**, als neuer `describe`-Block ans Ende von `src/effects.noAutorun.spec.ts` (mit einer Leerzeile davor), in `describe('Effect -> autorun: false')`. Dort steht der `{autorun:false}`-Vertrag, und der Fix ändert genau ihn; `batch.spec.ts` bekommt dafür den Memo-Block aus Schritt 2. Eine neue Importzeile: `import {batch} from './batch.js';` — biome sortiert sie auf Zeile 6.

     ```ts
     describe('an explicitly requested run inside a batch (ASYNC-002, audit 2026-08-08)', () => {
       it('carries the requested run out when the batch closes, instead of dropping it', () => {
         const {get: signal, set: setValue} = createSignal(0);
         const seen: number[] = [];

         const effect = createEffect(
           () => {
             seen.push(signal());
           },
           {autorun: false},
         );

         try {
           effect.run(); // prime: this is what subscribes the effect to `signal`
           expect(seen).toEqual([0]);

           setValue(1); // marks it dirty; autorun is false, so nothing runs
           expect(seen).toEqual([0]);

           // No `expect()` inside the batch callback — an assertion that fails in
           // there can be replaced by the flush in `batch()`'s `finally` (BUG-012,
           // Paket 12). The observation is copied out and checked afterwards.
           let seenInsideTheBatch: number[] = [];
           batch(() => {
             effect.run();
             seenInsideTheBatch = [...seen];
           });

           expect(
             seenInsideTheBatch,
             'the run is deferred, like every other run inside a batch',
           ).toEqual([0]);
           expect(
             seen,
             'and it is actually carried out when the batch closes',
           ).toEqual([0, 1]);
         } finally {
           effect.destroy();
           destroySignal(signal);
         }
       });

       it('does not make the effect run on a later write of its own accord', () => {
         const {get: signal, set: setValue} = createSignal(0);
         const seen: number[] = [];

         const effect = createEffect(
           () => {
             seen.push(signal());
           },
           {autorun: false},
         );

         try {
           effect.run();
           setValue(1);

           batch(() => {
             effect.run();
           });

           expect(seen).toEqual([0, 1]);

           // The request is spent. If the effect kept the note it took when the
           // batch parked its run, this write would run it — and `{autorun:
           // false}` would quietly have become `true` for the rest of its life.
           setValue(2);
           expect(seen, 'the effect is still a non-autorun effect').toEqual([
             0, 1,
           ]);

           effect.run();
           expect(seen).toEqual([0, 1, 2]);
         } finally {
           effect.destroy();
           destroySignal(signal);
         }
       });

       it('a write inside the batch still does not run the effect on its own', () => {
         const {get: signal, set: setValue} = createSignal(0);
         const seen: number[] = [];

         const effect = createEffect(
           () => {
             seen.push(signal());
           },
           {autorun: false},
         );

         try {
           effect.run();
           expect(seen).toEqual([0]);

           batch(() => {
             setValue(1); // nobody asked for a run
           });

           expect(
             seen,
             'the flush marks it dirty and leaves it alone, batch or no batch',
           ).toEqual([0]);

           effect.run();
           expect(seen).toEqual([0, 1]);
         } finally {
           effect.destroy();
           destroySignal(signal);
         }
       });
     });
     ```

     Der dritte Test ist die Gegenprobe und **gegen beide Codezustände grün**: er nagelt fest, dass der Fix nur den ausdrücklich angeforderten Lauf betrifft und nicht das Autorun-Gate insgesamt aufweicht.
  2. **Dann die fünf Regressionstests für ASYNC-003**, als neuer `describe`-Block ans Ende von `src/batch.spec.ts` (Leerzeile davor), hinter `describe('the callback error survives a failing flush (BUG-012)')`. Eine neue Importzeile: `import type {SignalReader} from './types.js';`; `batch`, `createMemo`, `createSignal`, `createEffect` und `destroySignal` stehen alle schon oben.

     ```ts
     describe('a memo read inside a batch is current (ASYNC-003, audit 2026-08-08)', () => {
       it('a memo whose dependency was written in the same batch reads the new value', () => {
         const dep = createSignal(10);
         const memo = createMemo(() => dep.get() * 2);

         try {
           expect(memo()).toBe(20);

           let insideTheBatch: unknown;
           batch(() => {
             dep.set(20);
             insideTheBatch = memo();
           });

           expect(
             insideTheBatch,
             'the read used to return the pre-write value and heal afterwards',
           ).toBe(40);
           expect(memo()).toBe(40);
         } finally {
           destroySignal(dep, memo);
         }
       });

       it('a memo created inside a batch reads its value instead of undefined', () => {
         const dep = createSignal(10);
         let memo!: SignalReader<number>;
         let insideTheBatch: unknown = 'never read';

         try {
           batch(() => {
             memo = createMemo(() => dep.get() * 2);
             insideTheBatch = memo();
           });

           expect(
             insideTheBatch,
             'a memo created in a batch has no previous value to fall back to',
           ).toBe(20);
         } finally {
           destroySignal(dep, memo);
         }
       });

       it('a lazy memo read inside a batch catches up instead of staying stale', () => {
         const dep = createSignal(10);
         const memo = createMemo(() => dep.get() * 2, {lazy: true});
         const downstream: number[] = [];
         const eff = createEffect(() => {
           downstream.push(dep.get());
         });

         try {
           expect(memo()).toBe(20); // prime: the first read is what runs it

           let insideTheBatch: unknown;
           batch(() => {
             dep.set(20);
             insideTheBatch = memo();
           });

           // `[RECALL]` only marks a lazy memo dirty, so the run the batch used
           // to queue for it was a no-op even at the flush: the value stayed
           // stale until something read it outside any batch.
           expect(insideTheBatch, 'lazy, dirty, and read inside the batch').toBe(
             40,
           );
           expect(downstream, 'the plain effect is still deferred').toEqual([
             10, 20,
           ]);
         } finally {
           eff.destroy();
           destroySignal(dep, memo);
         }
       });

       it('the read replaces the recompute the flush would have done, it does not add one', () => {
         const dep = createSignal(1);
         const computes: number[] = [];
         const memo = createMemo(() => {
           computes.push(dep.get());
           return dep.get() * 2;
         });

         try {
           computes.length = 0;

           batch(() => {
             dep.set(2);
             memo();
             memo();
           });

           // One recompute for the batch, exactly as before the fix — the read
           // pulls the queued run forward and takes it out of the queue, instead
           // of running the callback a second time when the batch closes.
           expect(computes, 'one write, one recompute').toEqual([2]);
           expect(memo()).toBe(4);
         } finally {
           destroySignal(dep, memo);
         }
       });

       it('the memo write it triggers stays inside the batch', () => {
         const dep = createSignal(1);
         const memo = createMemo(() => dep.get() * 2);
         const seen: number[] = [];
         const downstream = createEffect(() => {
           seen.push(memo());
         });

         try {
           expect(seen).toEqual([2]);
           seen.length = 0;

           let seenInsideTheBatch: number[] = [];
           batch(() => {
             dep.set(2);
             memo(); // recomputes here, and writes the memo signal here
             seenInsideTheBatch = [...seen];
           });

           expect(
             seenInsideTheBatch,
             'the recompute must not notify past the open batch',
           ).toEqual([]);
           expect(seen, 'one deduplicated run, after the callback').toEqual([4]);
         } finally {
           downstream.destroy();
           destroySignal(dep, memo);
         }
       });
     });
     ```

     Die letzten beiden sind **gegen beide Codezustände grün** und trotzdem die wichtigsten: sie halten die zwei Entwurfsentscheidungen fest, an denen ein naheliegender Ersatz-Fix scheitert (Mutation M4 und M6). Der dritte Test führt den Effect auf `dep` nicht als Beiwerk mit — er ist der Eintrag auf Priorität 0, an dem `unbatch()` seinen Nicht-Treffer-Zweig fährt.
  3. **Dann die zwei festgenagelten Assertionen umdrehen.** Beide sind heute grün und werden durch die Fixes rot; sie gehören deshalb in den roten Lauf, nicht hinter ihn.
     - `src/createMemo.spec.ts:691-730` — Testname auf `'{batchWrites: true}: reading a dirty lazy memo from within a batched outer memo returns its fresh value (ASYNC-003, audit 2026-08-08)'`, die zwei Assertionen auf `22` beziehungsweise `20`, dazu die neuen Botschaften `"fresh on the first read, inside outer's own batch()"` und `'inner recomputed at the read, not at some later unbatched one'`. Die zwei nachfolgenden Zeilen (`expect(inner()).toBe(20); expect(outer()).toBe(22);`) bleiben stehen und verlieren nur ihren Kommentar über das nachträgliche Aufholen. Der W5-Kommentarblock darüber (`:678-689`) und der Blockkopf des `describe` (`:582-606`, Punkt 2) werden umgeschrieben: der Mechanismus wird nicht gestrichen, sondern in die Vergangenheitsform gesetzt, mit dem Satz, dass `beforeRead` seit ASYNC-003 nicht mehr `e.run` ist, sondern `e.runImmediately`, und dass beide Einstellungen jetzt denselben frischen Wert lesen. Der Nachbartest `:732` bekommt ein `too` an den Namen und einen Kommentar, der ihn als Zwilling statt als Gegensatz einordnet.
     - `src/hibernate.spec.ts:482-488` — der Kommentarblock und die zwei Assertionen:

       ```ts
       // `flush()` empties the queue in a `finally` now, so the restored
       // batch has nothing left to recall: one write, one run, one report —
       // at the `hibernate()` caller, which is the frame that asked for the
       // flush. It used to leave `boom` in the queue (`delayedEffects.length
       // = 0` sat *after* the throwing `run()`), run its callback a second
       // time when the outer batch closed, and hand the same failure to a
       // second caller.
       expect(boomRuns, 'the failed flush took its queue with it').toBe(1);
       expect(
         escaped,
         'and nothing is left for the outer batch to rethrow',
       ).toBeUndefined();
       ```

     **Roter Lauf hier**: `Tests 7 failed | 537 passed (544)`, die Meldungen stehen unter Verify (1).
  4. **Fix ASYNC-002, in `src/EffectImpl.ts`.** Ein Feld neben `autorun`/`shouldRun`:

     ```ts
     /**
      * Set while an explicitly requested run of a **non-autorun** effect sits
      * parked in an open batch (ASYNC-002).
      *
      * `[RECALL]` drops the flush's redispatch for a non-autorun effect — that
      * is what `{autorun: false}` means for a *signal write*. But `run()` is
      * not a signal write: somebody asked, in so many words, for this effect
      * to run, and the batch only ever promised to postpone that run, not to
      * swallow it. The note is what tells the two apart at the flush, where
      * the effect id is all that arrives.
      *
      * Cleared by the run that honours it, not by `[RECALL]`: a request can
      * also be spent by a run that happened for another reason before the
      * flush got to it — the batch then dedups its RECALL away, and the note
      * would stay armed for the next unrelated write. That is the moment
      * `{autorun: false}` would silently have become `true`.
      */
     #explicitRunRequested = false;
     ```

     und das zweite Konjunkt im Gate:

     ```ts
     [RECALL]() {
       this.shouldRun = true;
       if (!this.autorun && !this.#explicitRunRequested) return;
     ```

     Der große JSDoc-Block über `[RECALL]` bekommt einen Satz: ein `run()`, das ein offener Batch geparkt hat, wird beim Flush ausgeführt, auch ohne `autorun` — verworfen wird nur die Wiederzustellung eines Writes.
  5. **Fix ASYNC-003, drei Dateien.** In `src/EffectImpl.ts` wird `run` zum Zweizeiler, `runImmediately` kommt daneben, und der Rumpf zieht in `#run(immediate)` um. Der vorhandene JSDoc-Block bleibt über `run`, die Mechanik steht im Rumpf:

     ```ts
     run = (): void => {
       this.#run(false);
     };

     /**
      * Run the effect callback now, even while a batch is open.
      *
      * The entry point for a read that demands a current value — a memo's
      * `beforeRead` (ASYNC-003). Everything else about the run is identical,
      * including that its own writes go into the open batch.
      *
      * @internal
      */
     runImmediately = (): void => {
       this.#run(true);
     };

     #run(immediate: boolean): void {
       if (this.#destroyed) return;
       if (!this.shouldRun) return;

       const curBatch = getCurrentBatch();
       if (curBatch) {
         if (!immediate) {
           // ASYNC-002: the id is the only thing that reaches the flush, and
           // `[RECALL]` cannot tell a redispatched write from a run somebody
           // asked for. The note travels with the effect instead.
           if (!this.autorun) {
             this.#explicitRunRequested = true;
           }
           curBatch.batch(this.id, this.priority);
           return;
         }
         // ASYNC-003: a read that demands a current value is not deferrable —
         // postponing it does not delay the answer, it falsifies it. The write
         // this run is about to make still goes into the open batch, and that
         // is the point: the value is current *and* the notification stays
         // grouped. What the queue must not keep is the run itself, which is
         // happening right now; left in there it would recompute a second time
         // at the flush.
         curBatch.unbatch(this.id, this.priority);
       }

       this.#explicitRunRequested = false;

       if (this.#runDepth >= EffectImpl.maxDepth) {
       …
     ```

     Das schließende `};` des alten Arrow-Bodys wird zu `}`. **Sonst ändert sich im Rumpf nichts** — insbesondere bleibt `const generation = ++this.#generation;` zwischen `runCleanupCallback()` und der Callback-Invokation, wo Paket 10 es festgenagelt hat.

     In `src/batch.ts` die Rücknahme, direkt hinter `batch()`:

     ```ts
     /**
      * Take an effect id back out of the queue.
      *
      * The counterpart of {@link batch}, for the one run that cannot be
      * deferred: a memo whose value is being read right now runs past the
      * batch gate (ASYNC-003), and the entry an earlier write left for it is
      * then a duplicate of a run that has already happened. A later write
      * re-queues the effect through `batch()` as before — this takes the
      * pending run away, not the effect's place in the priority order.
      */
     unbatch(effectId: symbol, priority: number) {
       const len = this.delayedEffects.length;
       for (let i = 0; i < len; i++) {
         const [prio, effects] = this.delayedEffects[i];
         if (prio === priority) {
           effects.delete(effectId);
           return;
         }
       }
     }
     ```

     In `src/Effect.ts` die gebundene Property neben `run`:

     ```ts
     /**
      * Run the effect callback now, even while a batch is open.
      *
      * @internal Used by `createMemo()` as the memo signal's `beforeRead`
      * hook. Stripped from the published `.d.ts` by `stripInternal`.
      */
     runImmediately = () => this[$effect]?.runImmediately();
     ```

     In `src/createMemo.ts` die eine Zeile: `sImpl.beforeRead = e.runImmediately;`, mit zwei Zeilen Kommentar darüber, warum es nicht `e.run` ist. Dazu die JSDoc von `batchWrites` (`:24-50`): der Absatz über den Preis wird ersetzt — was `true` heute kostet, ist eine `Batch`-Instanz je Recompute, nicht die Lesefrische; ein Halbsatz hält fest, dass der frühere Vorbehalt (ein im Callback gelesenes dirty Memo kam stale zurück, bei `{lazy:true}` dauerhaft) seit ASYNC-003 nicht mehr gilt, und dass der Default aus dem verbliebenen Grund `false` bleibt.
  6. **Fix des Nebenbefunds, `src/batch.ts`:**

     ```ts
     flush() {
       // The queue is spent either way: `run()` delivers a RECALL to every id
       // in it and only then re-raises what the effects handed in, so a throw
       // is never "we stopped halfway". Clearing after `run()` instead of in a
       // `finally` used to leave the whole queue standing — and `hibernate()`,
       // its only caller, then restored a batch that recalled every one of
       // them a second time when it closed: two runs of the same callback for
       // one write, and the same failure reported at two different callers.
       try {
         this.run();
       } finally {
         this.delayedEffects.length = 0;
       }
     }
     ```
  7. **Doku, fünf Dateien plus `AGENTS.md`.** Reihenfolge nach `CLAUDE.md`: JSDoc (in Schritt 4 bis 6 erledigt) → `docs/api.md` → `docs/recipes.md` → `docs/cheat-sheet.md` → `skills/`.
     - `docs/api.md:188`, die `run()`-Zeile der Effect-Instanztabelle: »Inside a `batch()`, queues the effect« bekommt den zweiten Halbsatz, dass der eingereihte Lauf beim Flush ausgeführt wird, `autorun` hin oder her.
     - `docs/api.md:303-318` (`batchWrites`): der zweite Absatz (»That grouping has a real cost … This is why the default is `false`«) wird ersetzt. Neu: die Kosten sind eine `Batch` je Recompute; der frühere Vorbehalt über stale composed memos ist mit ASYNC-003 weg, weil `beforeRead` den Recompute am Batch-Gate vorbeiführt; der Default bleibt `false`, weil seitenschreibende `computer` die Ausnahme sind.
     - `docs/api.md`, `### batch(callback)` (`:461-489`): ein Absatz dazu, dass ein Memo-Read innerhalb des Batches den Memo neu rechnet statt einen alten Wert zu liefern, und dass dessen Write trotzdem im Batch bleibt. Und im `hibernate()`-Kasten (`:479`): der Batch wird geleert, auch wenn der Flush wirft — der wiederhergestellte Batch ruft niemanden ein zweites Mal.
     - `docs/recipes.md:205` und `:358`: aus »defers the run until the batch ends« / »queues the run« wird jeweils die vollständige Aussage — eingereiht, beim Schließen des Batches ausgeführt, auch bei `{autorun:false}`.
     - `docs/recipes.md:299-344`: die Überschrift »Memos: `batchWrites` is opt-in, and reading a composed memo is why« stimmt nach dem Fix nicht mehr und wird zu einer, die nur noch die Gruppierung nennt. Das erste Beispiel bleibt; der Absatz ab »at a cost« und das zweite Beispiel samt Erklärung werden auf den neuen Stand gebracht — ein Absatz, der sagt, dass ein im Callback gelesenes dirty Memo (auch ein lazy) jetzt frisch zurückkommt, und dass der Default aus dem Kostengrund `false` bleibt.
     - `docs/cheat-sheet.md:82-85` und `skills/using-signalize/references/api.md:139-146`: derselbe Kommentar, kurz und ausführlich — »costs read-freshness« fällt ersatzlos, an seine Stelle tritt die `Batch`-Instanz je Recompute.
     - `AGENTS.md:86-92` (»Batching«): ein vierter Punkt hinter der dreistufigen Aufzählung — ein Memo-Read läuft am Gate vorbei (`beforeRead` → `runImmediately`), und ein ausdrücklich angefordertes `run()` überlebt die Warteschlange auch ohne `autorun`. Zwei Zeilen; es ist die Datei, die vor jeder nicht-trivialen Änderung gelesen wird.
  8. **`CHANGELOG.md`, unter `## Unreleased`.** Drei Zeilen ans Ende von `### Bug Fixes`:
     - `effect.run()` inside an open `batch()` is no longer dropped for an `{autorun: false}` effect. The run was queued and then discarded at the flush — silently, with no return value and no error — because `[RECALL]` only runs an effect it redispatches when `autorun` is set. The batch now carries the request through: an explicitly requested run happens when the batch closes, a plain signal write still leaves a non-autorun effect alone (ASYNC-002, audit 2026-08-08)
     - Reading a memo inside a `batch()` returns its current value instead of the one from before. The memo's recompute used to be deferred like any other run, so a memo whose dependency was written in the same batch read stale — and one *created* in the batch read `undefined`, having no previous value at all. The recompute now happens at the read; its write stays inside the batch and is deduplicated there as before (ASYNC-003, audit 2026-08-08)
     - A batch flushed by `hibernate()` empties its queue even when an effect in it throws. It used to keep the whole queue, and the restored batch then recalled every delayed effect a second time when it closed — one write, two runs of the same callback, and the same failure reported at two different callers (audit follow-up, Paket 12)

     Drei Zeilen unter `### Breaking Changes`:
     - An `{autorun: false}` effect now runs when a batch that queued its explicitly requested `effect.run()` closes. Code that called `effect.run()` inside a `batch()` and relied on nothing happening — knowingly or not — sees the callback run once per batch it asked in (ASYNC-002, audit 2026-08-08)
     - A memo read inside a `batch()` now recomputes at the read instead of returning its pre-batch value. Downstream effects are unaffected — the recompute's write goes into the same batch and is flushed with everything else — but code that read a memo inside a batch and compared it against the pre-batch value now sees the new one. The caveat documented for `{batchWrites: true}` memos (a composed memo read from inside such a callback could come back stale, permanently for a lazy one) no longer applies; `batchWrites` still defaults to `false`, now for its allocation cost alone (ASYNC-003, audit 2026-08-08)
     - An effect that throws in the flush `hibernate()` performs is no longer recalled a second time when the surrounding batch closes, and that second, duplicate failure no longer arrives at the `batch()` caller. It is reported once, at the `hibernate()` caller (audit follow-up, Paket 12)

     **Das Datum ist Pflicht, in fünf der sechs Zeilen:** `(ASYNC-002)` und `(ASYNC-003)` sind unter `## Unreleased` bereits an drei Einträge aus dem Audit vom 2026-08-07 vergeben (`:32`, `:169`, `:173`) und beschreiben dort etwas völlig anderes.
- Verify: aus dem Repo-Root, sechs Teile. Alle Zahlen am 2026-08-10 auf der Kopie gemessen.
  1. **Der rote Lauf, nach Schritt 3 und vor Schritt 4.** `npx vitest run --coverage.enabled=false`. Erwartet exakt `Tests 7 failed | 537 passed (544)` in drei Dateien, mit diesen Meldungen:

     | Test | Meldung |
     | --- | --- |
     | ASYNC-002 (1) | `and it is actually carried out when the batch closes: expected [ +0 ] to deeply equal [ +0, 1 ]` |
     | ASYNC-002 (2) | `expected [ +0 ] to deeply equal [ +0, 1 ]` |
     | ASYNC-003 (1) | `the read used to return the pre-write value and heal afterwards: expected 20 to be 40` |
     | ASYNC-003 (2) | `a memo created in a batch has no previous value to fall back to: expected undefined to be 20` |
     | ASYNC-003 (3) | `lazy, dirty, and read inside the batch: expected 20 to be 40` |
     | `createMemo.spec.ts` (W5) | `fresh on the first read, inside outer's own batch(): expected 12 to be 22` |
     | `hibernate.spec.ts` | `the failed flush took its queue with it: expected 2 to be 1` |

     Die drei übrigen neuen Tests sind hier **grün** und müssen es sein — sie sind die Gegenproben. Fällt irgendein anderer Test, wurde eine Datei angefasst, die nicht dazugehört.
  2. **Der grüne Lauf, nach allen Fixes.** `pnpm world` vollständig. Erwartet: 45 Dateien / **544 Tests** (vorher 536) in `test` und `test:gc`, Coverage **99,32 / 95,26 / 99,57 / 99,46** gegen die Baseline 99,31 / 95,19 / 99,57 / 99,45; `batch.ts`, `createMemo.ts` und `Effect.ts` tauchen in der Coverage-Tabelle nicht auf, weil sie auf 100/100/100/100 stehen (die Tabelle listet nur, was darunter liegt); `EffectImpl.ts` **98,27 / 96,49 / 97,43 / 99,06**, unbedeckt bleiben die zwei Zeilen des `emitEffectError`-Zweigs in der aufgeschobenen Selbstzerstörung (vorher `966-967`, jetzt `992-993` — dieselbe Stelle, 26 Zeilen tiefer). `tsc --noEmit` 0 Fehler, `biome check` ohne Korrektur, `rollup -c` ohne `CIRCULAR_DEPENDENCY`, `test:smoke` 4 Tests grün.
  3. **Die fünf Zusagen aus Paket 12, namentlich.** `npx vitest run src/batch.spec.ts src/hibernate.spec.ts --reporter=verbose` und die fünf Zeilen des Blocks `the callback error survives a failing flush (BUG-012)` im Protokoll aufsuchen — alle `✓`. Ein Gesamt-Grün allein sagt nicht, dass die vier Wurfform-Kombinationen gelaufen sind, und dieses Paket baut dieselbe Datei um.
  4. **Mutationsprobe, sechs Eingriffe, jeder einzeln zurückgebaut** — repo-weit gefahren, alle sechs vorgemessen:

     | Mutation | Eingriff | Erwartet |
     | --- | --- | --- |
     | **M1** | `[RECALL]`-Gate zurück auf `if (!this.autorun) return;` | **2 failed \| 542 passed**, beide ASYNC-002-Tests, an `and it is actually carried out when the batch closes` |
     | **M2** | `this.#explicitRunRequested = false;` im Rumpf von `#run()` streichen | **1 failed \| 543 passed**, `does not make the effect run on a later write of its own accord` an `the effect is still a non-autorun effect: expected [ +0, 1, 2 ] to deeply equal [ +0, 1 ]` |
     | **M3** | `beforeRead` zurück auf `e.run` | **3 failed \| 541 passed**, die drei ersten ASYNC-003-Tests |
     | **M4** | den `curBatch.unbatch(…)`-Aufruf streichen | **1 failed \| 543 passed**, `the read replaces the recompute the flush would have done` an `one write, one recompute: expected [ 2, 2 ] to deeply equal [ 2 ]` |
     | **M5** | `flush()` wieder ohne `try`/`finally` | **1 failed \| 543 passed**, der ASYNC-001-Test an `the failed flush took its queue with it: expected 2 to be 1` |
     | **M6** (Kontrolle) | statt `unbatch()` den verworfenen Entwurf: `clearBatch()` / `restoreBatch()` um den vorgezogenen Lauf | **1 failed \| 543 passed**, `the memo write it triggers stays inside the batch` an `the recompute must not notify past the open batch: expected [ 4 ] to deeply equal []` |

     Kein Kollateralschaden bei allen sechs. M6 ist der eigentliche Wert dieser Tabelle: er belegt, dass die Suite den richtigen Fix vom plausibelsten falschen unterscheidet.
  5. **Gegenprobe zur Zahl der Recomputes, außerhalb der Suite** (eine Wegwerf-Spec, danach löschen): ein Memo mit gezählten Läufen, dreimal gemessen — zwei Writes ohne Read im Batch, ein Write plus zwei Reads im Batch, ein ungebatchter Write plus Read. Erwartet vor wie nach dem Fix `[3]`, `[4]`, `[5]`. Die mittlere Zahl ist die, die ohne `unbatch()` kippt.
  6. `git status --porcelain --untracked-files=all` — nur `src/EffectImpl.ts`, `src/batch.ts`, `src/Effect.ts`, `src/createMemo.ts`, `src/effects.noAutorun.spec.ts`, `src/batch.spec.ts`, `src/createMemo.spec.ts`, `src/hibernate.spec.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `AGENTS.md`, `CHANGELOG.md` und `remediation-plan.md`. Kein `lib/`, kein `dist/`, keine neue Datei, kein `audit.html`.
- Commit: `fix: honour a run the batch parked, and keep memo reads current (ASYNC-002, ASYNC-003)`

<details>
<summary>Die zwei Findings im Volltext (aus <code>audit.html</code>)</summary>

**ASYNC-002 — effect.run() innerhalb von batch() für {autorun: false} zum Laufen bringen oder ablehnen**
Severity: medium · Kategorie: Async & Concurrency · Effort: M · Status: carried-over
Location: `src/EffectImpl.ts:413-417 · src/EffectImpl.ts:511-516`

> `run()` reiht die Effect-ID in einen offenen Batch ein und kehrt zurück. Der Flush emittiert später `RECALL`, und `[RECALL]` setzt `shouldRun = true`, ruft `run()` aber nur `if (this.autorun)`. Für einen Non-Autorun-Effect wird der ausdrücklich angeforderte Lauf also verworfen — still, ohne Rückgabewert und ohne Fehler. `docs/recipes.md:305` sagt schlicht, `effect.run()` im Batch »queues the run«: es reiht ihn ein und wirft ihn dann weg.

> Evidence:
> ```
> 7a: run() außerhalb batch -> 1
> 7a: run() innerhalb batch  -> 1 (unverändert => still verschluckt)
> ```

> Empfehlung: Den Batch-Flush für explizit eingereihte Läufe `run()` direkt aufrufen lassen (am `autorun`-Gate vorbei) oder die Absicht am Effect vermerken und in `[RECALL]` berücksichtigen.

**ASYNC-003 — Memo-Reads innerhalb von batch() dokumentieren oder beheben**
Severity: medium · Kategorie: Async & Concurrency · Effort: M · Status: carried-over
Location: `src/createMemo.ts:100-118 · src/EffectImpl.ts:413-417`

> Ein Memo erzwingt seine Neuberechnung über `beforeRead = e.run`, und `run()` verschiebt bedingungslos, solange ein Batch offen ist. Ein Memo zu lesen, dessen Dependency im selben Batch gerade geschrieben wurde, liefert daher den Wert von vorher; ein im Batch *erzeugtes* Memo liefert `undefined`, weil es gar keinen vorherigen Wert gibt. Die Doku beschränkt diesen Vorbehalt auf `{batchWrites: true}`-Memos — der weit häufigere Fall, ein `batch()` um Code, der Memos liest, ist nirgends abgedeckt. Der Wert heilt nach dem Batch, was den falschen Zwischenstand rein still macht.

> Evidence:
> ```
> 8a: frisch erzeugtes Memo im Batch gelesen -> undefined (erwartet 20)
> 8b: außerhalb -> 20 | nach Write im Batch gelesen -> 20 (erwartet 30) | nach dem Batch -> 30
> 8c: im Batch -> 31 (erwartet 41)
> ```

> Empfehlung: `beforeRead` die Batch-Verschiebung umgehen lassen (der Write wird vom Batch ohnehin dedupliziert) — mindestens aber den Batching-Abschnitt in `docs/recipes.md` um beide Fälle ergänzen.

</details>

- **Ergebnis (2026-08-10)** — Hash `34aec18`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 45 Dateien / **548 Tests** (vorher 536), Coverage 99,32 / 95,26 / 99,57 / 99,46, `batch.ts`, `createMemo.ts` und `Effect.ts` bei 100 %.
- **Rot gesehen**: 7 failed | 537 passed mit sieben wortgleichen Meldungen, die drei Gegenproben grün.
- **Der Vermerk wird vom Lauf verbraucht, nicht von `[RECALL]`** — sonst bliebe er scharf, wenn der Flush das RECALL wegdedupliziert. Der Reviewer hat es mit einem Helfer-Effect auf Priorität 1000 gemessen, der die Deduplizierung erzwingt.
- **Zwei Grenzen, die das Audit nicht kannte, und beide sind jetzt dokumentiert und getestet.**
  - **ASYNC-003 reicht nur eine Ebene tief.** Ein Memo, das nur über ein *anderes Memo* veraltet ist, hat `shouldRun === false` und wird nicht erreicht — gemessen `11` statt `21`, vor wie nach dem Fix. Nicht schließbar, und der stärkere der beiden Gründe ist nicht der fehlende Weg von der Signal-Id zum Signal, sondern dass ein vorsorglicher Upstream-Pull **falsch** wäre: `#signals` enthält exakt die Reads des *letzten* Laufs, also rechnete er bei `() => flag.get() ? a() : b()` den zuletzt genommenen Zweig und verfehlte den anderen — genau den, auf den es ankommt, wenn `flag` im Batch kippt. Zu eifrig und unvollständig zugleich; er hätte die Grenze nicht einmal geschlossen. Was es bräuchte, ist »maybe dirty«-Propagation mit Zweifarbenmarkierung — eine andere Bibliothek, kein Fix.
  - **Es gibt einen Ausweg, und die Doku sagte, es gebe ihn nicht.** Der Reviewer hat gemessen, dass ein Read des Upstream-Memos im selben Batch die Kette weckt (`21` statt `11`, eager **und** lazy) — während `docs/api.md` behauptete, das mache keinen Unterschied. Der einzige Workaround, den ein Leser aus der Einschränkung ableiten kann, stand als Nicht-Existenz in der ausgelieferten Doku. Jetzt steht er dort als eigener Absatz, mit Test.
  - **Und »catches up at the flush« gilt nur eager.** Hinter einem `{lazy: true}`-Upstream bleibt das Downstream-Memo auch nach dem Flush auf dem alten Wert, weil ein lazy Memo nie pusht. Vorbestehende Semantik, aber die neue Grenzbeschreibung sagte den Aufholvorgang unbedingt zu. Zweite Testvariante ergänzt.
- **Eine dritte beobachtbare Änderung, die der Plan als »unverändert« geführt hatte.** Ein Memo, das **sowohl** ein im Batch geschriebenes Signal **als auch** ein Upstream-Memo liest, rechnet 2× statt 1× (dreigliedrige Kette 5 statt 3) — der Write des Upstream reiht den Leser sofort wieder ein. Der Implementierer hat eine Rückversicherung gebaut und in vier Konstellationen gemessen, bevor er sie verwarf: sie hilft nur, wenn niemand sonst das Memo liest, und im vierten Fall wandert der Recompute aus dem Prioritäts-1000-Slot mitten in den Lauf eines Prioritäts-0-Lesers, wo kein Batch offen ist — der Memo-Write emittiert dann sofort und startet genau den Leser neu, der ihn ausgelöst hat. Ein doppelter Memo-Compute gegen einen doppelten Downstream-Lauf **plus** die Prioritätsordnung: schlechter Tausch, korrekt verworfen. Eigene Breaking-Zeile, eigener Test.
- **Die beiden Grenzen sind komplementär**, und die erste Fassung der Breaking-Zeile war genau darum zu weit gefasst: ein Memo wird **entweder** nicht erreicht (W1) **oder** doppelt gerechnet (W2), nie beides. Liest es nur das Upstream-Memo, wird es gar nicht vorgezogen und bleibt bei 1×.
- **`batchWrites` behält seinen Default `false`, aber die Begründung wechselt vollständig** — nicht mehr Lesefrische, sondern eine `Batch`-Instanz je Recompute, der nicht schon in einem Batch liegt. **Sechs** Doku-Stellen trugen die alte Begründung, nicht fünf wie der Plan sagte; die sechste (`docs/api.md:297`) hat der Reviewer gefunden. Der bestehende Test »returns its stale value« dreht sich mit.
- **Der Nebenbefund aus Paket 12 ist hier behoben**: `Batch.flush()` leert die Warteschlange jetzt im `finally`. Die zwei Assertionen, die Paket 12 als Klammer gesetzt hatte, drehen sich mit — `boomRuns` 2 → 1, `escaped` → `undefined`. Die Begründung trägt: `Batch.run()` stellt jedem Eintrag sein RECALL zu und wirft erst aus `endIsolatedDelivery()` im `finally`; eine geworfene Warteschlange ist nie halb abgearbeitet, sondern verbraucht. Dass derselbe Fehler bisher an zwei Aufrufer ging, war für sich ein Defekt.
- Keine der fünf BUG-012-Wurfform-Zusagen aus Paket 12 bewegt sich, in allen sechs Mutationsläufen namentlich geprüft.
- Zwei ältere CHANGELOG-Zeilen im selben `## Unreleased`-Block trugen die abgeschaffte Begründung und wären so mit ausgeliefert worden — beide umgeschrieben. Sie stehen unter `## Unreleased`, dürfen also geändert werden; Stehenlassen wäre hier **nicht** regelkonform gewesen.
- Zwei Umgebungsprobleme, keins am Code: Ein Subagent hatte ein temporäres git-Worktree unter dem Scratchpad angelegt, dessen Pfad als `virtualStoreDir` in `node_modules/.modules.yaml` stehenblieb — danach brach `pnpm world` mit `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` ab, **bevor irgendein Schritt lief**. Vom Orchestrator mit `CI=true pnpm install --frozen-lockfile` geradegezogen, `package.json` und `pnpm-lock.yaml` per Prüfsumme unverändert. Und im Scratchpad haben sich Hilfsskripte zweier Agenten gegenseitig überschrieben; wer dort misst, legt ein eigenes Unterverzeichnis an.
- Offener kleiner Befund, mitgenommen als Kommentar: die Begründung für die Warteschlangen-Leerung in `flush()` deckt die Zustellung, nicht `run()`s eigenes Setup — ein Wurf aus `beginIsolatedDelivery()` oder den zwei `on()`-Abonnements davor leerte eine Warteschlange, aus der nie zugestellt wurde. Heute unmöglich (ein Array-Push und zwei Subscribes), deshalb Notiz statt zweitem `try`.


#### [x] 16. Zwei API-Zusagen, die heute nicht halten
- Findings: API-014 (medium), CONS-007 (medium)
- Ziel: `SignalGroup.delete(group)` ist kein stiller No-Op mehr, und `touch({})`/`value({})` werfen einen deutbaren Fehler statt eines nativen Spread-Crashs.
- Bereich: `src/SignalGroup.ts`, `src/touch.ts`, `src/value.ts`, `docs/api.md`
- Hängt ab von: Paket 9
- Modell: mittlere Stufe — der Code ist zwölf Zeilen und vollständig vermessen. Die Arbeit liegt in der Doku: `SignalGroup.delete()` wird an sechs Stellen beschrieben, und die Zusage »stiller No-Op« gilt nach diesem Paket für vier andere Funktionen weiter, muss also erstmals ausgeschrieben werden, statt sich aus dem Schweigen zu ergeben.
- Hash: `8cc46e9`
- Dateien: zwei Spec-Dateien (**zuerst**) — `src/SignalGroup.spec.ts`, `src/object-signals.spec.ts`; drei Produktionsdateien — `src/SignalGroup.ts`, `src/touch.ts`, `src/value.ts`; sechs Doku-Dateien — `docs/api.md`, `docs/architecture.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`. **Keine neue Datei, kein neuer Export, keine neue Modulkante, kein neues Symbol.**
- Abgleich (2026-08-10): beide Findings **unverändert**, beide am Code von `34aec18` reproduziert. Die Messungen liefen auf einer Kopie unter dem Scratchpad (kein Worktree, eigenes Unterverzeichnis); der Baum ist unberührt.
  - **API-014 unverändert.** `src/SignalGroup.ts:302-304` ist Zeichen für Zeichen die Fassung des Findings (`static delete(object) { store.get(object)?.clear(); }`), `get()` steht auf `:257-263`, `findOrCreate()` auf `:271-289` — beide mit dem `instanceof`-Frühausstieg. Die `location`-Zeile stimmt.
  - **Was heute wirklich passiert: gar nichts.** Gemessen an einer Gruppe mit einem angehängten Signal, einem `{attach}`-Effect und einem `{attach}`-Link: nach `SignalGroup.delete(group)` steht `getSignalsCount()` auf 1, `getEffectsCount()` auf 1, `getLinksCount()` auf 1, `getGroupMemberCounts(group)` unverändert, und `SignalGroup.get(host)` liefert weiterhin **dieselbe** Gruppe. Kein halber Abbau, kein Teileffekt — der Aufruf ist folgenlos. Derselbe Aufbau mit `SignalGroup.delete(host)` räumt alles ab. Das ist die `evidence` des Findings, nur über alle drei Ressourcenarten statt über ein Signal.
  - **Die Symmetriefrage ist beantwortet, und die Audit-Empfehlung reicht: `clear()` räumt den Store-Eintrag selbst ab.** `clear()` hält den Hostschlüssel in `#storeKey` (gesetzt im Konstruktor, `:348-349`) und ruft `store.delete(key)` (`:1027-1032`) — gemessen: nach `group.clear()` liefert `SignalGroup.get(host)` `undefined`, und `findOrCreate(host)` gibt eine **neue** Gruppe zurück. Es gibt keinen zweiten Store-Eintrag, der zurückbliebe: eine Gruppe kann nie ihr eigener Store-Schlüssel sein, weil sowohl `findOrCreate()` (`:286-288`) als auch der Konstruktor (`:340-342`) bei `instanceof SignalGroup` aussteigen, bevor irgendetwas abgelegt wird. Der Frühausstieg verliert also nichts, und danach gilt beides: `delete(host)` und `delete(group)` hinterlassen denselben Zustand.
  - **Kein Aufrufer baut auf dem No-Op.** Repo-weit gesucht (`src/`, `smoke/`, `bench/`, `docs/`, `skills/`, `README.md`): **zehn Aufrufstellen im Code** — `creation-rollback.spec.ts:264,336,375`, `SignalGroup.spec.ts:106,154,1140`, `SignalAutoMap.spec.ts:635`, `smoke/dist-smoke.test.ts:92,118` und die interne Weiterreichung in `SignalGroup.ts:295` —, jede mit einem Hostobjekt, keine mit einer Gruppe. Dazu zwanzig Erwähnungen in der Prosa, ebenfalls durchweg mit einem Hostobjekt. Der Fix kann keinen bestehenden Test drehen, und die volle Suite belegt es: 548 → 551 Tests, die drei neuen sind die einzigen neuen.
  - **Mitgenommen wird der deprecated Zwilling.** `SignalGroup.destroy(object)` (`:291-296`) delegiert an `delete()`; `SignalGroup.destroy(group)` ist heute derselbe stille No-Op und wird durch denselben Frühausstieg mitrepariert. Gemessen: nach dem Fix räumt auch er ab und warnt weiterhin. Kein eigener Test — die Delegation ist bereits durch `SignalGroup.destroy() is deprecated but works` (`:144`) gedeckt.
  - **CONS-007 unverändert, mit einer veralteten Zeilenangabe.** `src/touch.ts:16-25` und `src/value.ts:17-22` sind unverändert, `src/link.ts:192-195` trägt den `TypeError` (die `location` sagt `191-194`, eine Zeile daneben). Die vierte Angabe, `src/signal-core.ts:142-145`, zeigt nach Paket 13b ins JSDoc — `destroySignal()` steht jetzt auf `:154-157`. Nur die Zeile ist gewandert, die Aussage stimmt.
  - **Die native Meldung, wörtlich.** `touch({})` und `value({})` werfen beide `TypeError: Spread syntax requires ...iterable[Symbol.iterator] to be a function`. `touch(undefined)`, `value(undefined)` und `touch(null)` werfen `TypeError: source is not iterable (cannot read property undefined)` beziehungsweise `… property null`. Keine der vier Meldungen nennt die Bibliothek, die Funktion oder den Parameter; die zweite Form nennt zwar `source`, aber als Name einer internen Variable.
  - **Die fünf Antworten auf denselben Fehlaufruf, über die ganze Oberfläche nachgemessen** (jeweils mit `{}`): `link({}, cb)` → `TypeError: [signalize] link: source must be a signal` · `touch({})`, `value({})` → nativer Spread-Fehler · `unlink({})`, `destroySignal({})`, `muteSignal({})`, `unmuteSignal({})` → still, Rückgabe `undefined` · `getLinksCount({})` → `0`. Es sind also **vier** stille No-Ops, nicht zwei: das Finding nennt `unlink()` und `destroySignal()`, `muteSignal()`/`unmuteSignal()` (`src/index.ts:29-30`, öffentlich) verhalten sich genauso und fehlen dort.
  - **`getLinksCount({})` ist kein No-Op und wird trotzdem nicht angefasst.** Es gibt eine Zahl zurück, und `0` ist für einen Nicht-Signal-Wert nicht falsch, sondern nur nicht unterscheidbar von »ein Signal ohne Links«. Ein Wurf hier wäre eine Verhaltensänderung ohne Finding-Deckung — die Festlegung im Plankopf spricht von den stillen No-Ops. Der Unterschied gehört in die Doku-Zeile, nicht in den Code.
  - **Die Grenze des Wächters, und die eine Verhaltensänderung über den Wortlaut des Findings hinaus.** Geprüft wird die *Form* des Arguments (Signal oder Array), nicht das Ergebnis der Auflösung. Damit bleibt `touch([host, 'unbekannt'])` der No-Op, den `src/object-signals.spec.ts:126-138` seit jeher festhält, und `value([host, 'unbekannt'])` bleibt `undefined`. Was sich ändert: ein **iterierbarer** Nicht-Signal-Wert lief bisher durch den Spread hindurch und bekam still `undefined` (gemessen: `value('ab')` → `undefined`, `touch('ab')` → wirkungslos, ebenso `new Set()` und `[]`); er wirft ab jetzt. Der Schaden ist begrenzt und benennbar: **beide Overloads lehnen so ein Argument schon zur Compile-Zeit ab**, erreichbar ist der Fall nur aus untypisiertem JavaScript. Der Gegenentwurf — statt `Array.isArray()` auf `Symbol.iterator` prüfen, damit Strings weiter still bleiben — wurde verworfen: er hält ausgerechnet die Antwort am Leben, die von allen fünf die schlechteste ist (falsches Ergebnis ohne jedes Signal), und die Festlegung im Kopf lautet »auf die `link()`-Form bringen« — `link()` wirft für alles, was kein Signal ist. Eigene Breaking-Changes-Zeile, siehe Schritt 8.
  - **Die Wurfform ändert sich nicht, die Fehlerklasse bleibt `TypeError`.** Vorher nativ, nachher eigen — `instanceof TypeError` trägt in beiden Fällen, `err.message` ändert sich. Damit folgt das Paket der Präzedenz aus 12, 13b, 14 und 15: dort wurde jede Änderung der Wurfform (Einzelfehler → `AggregateError`) als Breaking Change geführt, weil ein `catch` sie sehen kann. Hier sieht ein `catch` nur einen anderen Text — außer im Iterables-Fall oben, wo aus »kein Wurf« ein Wurf wird. Genau der bekommt die Breaking-Zeile, die Textänderung bekommt eine Bug-Fix-Zeile.
  - **Die Form der beiden Wächter folgt Paket 14.** `attachEffect()` (`src/SignalGroup.ts:749-751`) prüft am Kopf der Funktion, vor jeder Zustandsänderung, wirft einen Satz im Imperativ ohne Punkt, und sein Test (`src/SignalGroup.spec.ts:642-673`) prüft die Meldung als Zeichenkette und danach, dass nichts hängen geblieben ist. Beide Wächter hier stehen ebenso am Kopf, vor der ersten Auflösung; die Meldung trägt zusätzlich das `[signalize] <fn>:`-Präfix, weil `link.ts:194` — die Funktion, auf deren Form angeglichen wird — es trägt. Die Präfixform ist im Repo etabliert (`batch()`, `link()`).
  - **Coverage, gemessen.** `touch.ts` und `value.ts` fallen unter die Tier-1-Auflage 100/100/100/100 (`vitest.config.ts:18-19`, sie stehen in keiner Ausnahme) — beide neuen Zweige müssen also in **beide** Richtungen gefahren werden. Deshalb gehört der zweite neue Test (der Tupel-Fall von `value()`) zwingend dazu: ohne ihn bliebe in `value.ts` der Zweig `!isSignal && Array.isArray` ungedeckt und `pnpm test` bräche. Ergebnis mit beiden Tests: `touch.ts` und `value.ts` bleiben bei 100 % in allen vier Spalten (sie erscheinen gar nicht erst im Bericht), `SignalGroup.ts` 98,68 / 90,90 / 100 / 98,57 → **98,69 / 91,04 / 100 / 98,58**, Gesamt 99,32 / 95,26 / 99,57 / 99,46 → **99,33 / 95,35 / 99,57 / 99,46**.
  - **Kein neuer `critical`- oder `high`-Befund.** Die volle Suite meldet gegen beide Fixes null rote Tests, `test:gc` ebenso, `tsc --noEmit -p tsconfig.json` 0 Fehler, `biome check` über die fünf berührten Dateien sauber.
- Vorgehen: neun Schritte, Tests zuerst. Der Wortlaut unten ist der gemessene — er compiliert, geht ohne Korrektur durch `biome check` und ist in beiden Codezuständen gefahren.
  1. **Zuerst der Regressionstest für API-014**, in `src/SignalGroup.spec.ts`, `describe('static methods')`, unmittelbar hinter `it('SignalGroup.delete() removes a group')` und vor `it('SignalGroup.clear() removes all groups')`. Keine neue Importzeile — `getGroupMemberCounts`, `NO_GROUP_MEMBERS`, `createEffect` und `createSignal` stehen alle schon oben.

     ```ts
     it('SignalGroup.delete() takes the group itself, like get() and findOrCreate() (API-014)', () => {
       const host = {};
       const group = SignalGroup.findOrCreate(host);
       const signal = createSignal(1);
       const effect = createEffect(() => {}, {attach: host});
       try {
         group.attachSignal(signal);

         assertSignalsCount(1, 'after attach');
         assertEffectsCount(1, 'after attach');

         SignalGroup.delete(group);

         assertSignalsCount(0, 'the attached signal is destroyed');
         assertEffectsCount(0, 'the attached effect is destroyed');
         expect(
           getGroupMemberCounts(group),
           'the group let go of every member',
         ).toEqual(NO_GROUP_MEMBERS);
         expect(
           SignalGroup.get(host),
           'and the store entry under the host went with it',
         ).toBeUndefined();
       } finally {
         signal.destroy();
         effect.destroy();
         group.clear();
       }
     });
     ```

     Die letzte Assertion ist die eigentliche Symmetrieprobe: sie hält fest, dass der Frühausstieg den Store nicht umgeht, sondern `clear()` ihn über `#storeKey` mitnimmt. Wer den Fix später auf `object.off()` oder ein bloßes `store.delete()` umbaut, fällt genau dort.
  2. **Dann die zwei Regressionstests für CONS-007**, in `src/object-signals.spec.ts`, unmittelbar vor `it('touch([obj, name]) is a no-op when no signal is stored under that name')`. Eine neue Importzeile, die Biome hinter `./touch.js` einsortiert: `import {value} from './value.js';`. Die Datei ist der richtige Ort, weil dort der Tupel-Vertrag beider Funktionen steht — genau die Grenze, die der Wächter nicht überschreiten darf.

     ```ts
     it('touch() and value() reject a source that is neither a signal nor a tuple (CONS-007)', () => {
       const notASignal = {} as any;

       expect(() => touch(notASignal)).toThrow(TypeError);
       expect(() => touch(notASignal)).toThrow(
         '[signalize] touch: source must be a signal or an [object, propertyName] tuple',
       );

       expect(() => value(notASignal)).toThrow(TypeError);
       expect(() => value(notASignal)).toThrow(
         '[signalize] value: source must be a signal or an [object, propertyName] tuple',
       );

       expect(() => touch(undefined as any)).toThrow(
         '[signalize] touch: source must be a signal or an [object, propertyName] tuple',
       );
       expect(() => value(undefined as any)).toThrow(
         '[signalize] value: source must be a signal or an [object, propertyName] tuple',
       );
     });

     it('value([obj, name]) stays a plain undefined when no signal is stored under that name (CONS-007)', () => {
       const host: Record<string, unknown> = {};
       const foo = createSignal(1);
       storeAsObjectSignal(host, 'foo', foo);

       try {
         expect(value([host, 'foo'] as any)).toBe(1);
         expect(value([host, 'bar'] as any)).toBeUndefined();
         expect(value([{other: 1}, 'other'] as any)).toBeUndefined();
       } finally {
         destroyObjectSignals(host);
       }
     });
     ```

     Der zweite Test ist die Gegenprobe und **gegen beide Codezustände grün**: er nagelt fest, dass der Wächter die Form prüft und nicht das Ergebnis — und er ist zugleich die einzige Deckung für den Array-Zweig in `value.ts`, ohne die die Tier-1-Auflage reißt (siehe Abgleich). Sein Zwilling für `touch()` steht schon da, zwei Zeilen tiefer.
  3. **Rot sehen.** `npx vitest run --project unit src/SignalGroup.spec.ts src/object-signals.spec.ts --coverage.enabled=false` gegen den unveränderten Produktionscode: **2 failed | 98 passed**, und zwar genau
     - `AssertionError: the attached signal is destroyed: Number of active signals should be 0 but is 1: expected 1 to be +0`
     - `AssertionError: expected [Function] to throw error including '[signalize] touch: source must be a s…' but got 'Spread syntax requires ...iterable[Sy…'`

     Kein dritter Fehlschlag, kein ausgelöster Zählerwächter in `beforeEach`/`afterEach`.
  4. **Der Fix für API-014** in `src/SignalGroup.ts:302-304`. Der Rumpf wird ersetzt, die vorhandene JSDoc bleibt stehen und bekommt einen Satz:

     ```ts
       /**
        * Delete and clear the SignalGroup associated with an object.
        * Passing a group itself works too and clears that group directly, the
        * same argument `get()` and `findOrCreate()` accept.
        * @param object - The object whose group should be deleted, or the group
        */
       static delete(object: object) {
         // API-014: a group is a valid argument for itself, exactly as in `get()`
         // and `findOrCreate()`. A group made by `findOrCreate(host)` is filed
         // under `host`, never under itself, so the store lookup alone turned
         // `SignalGroup.delete(group)` — the documented public destructor — into
         // a silent no-op. Nothing else has to be undone here: `clear()` drops
         // the store entry under the host itself, through `#storeKey`.
         if (object instanceof SignalGroup) {
           object.clear();
           return;
         }
         store.get(object)?.clear();
       }
     ```

     `store.get(null)` bleibt erlaubt (eine `WeakMap` beantwortet einen Nicht-Objekt-Schlüssel mit `undefined`, sie wirft nicht) — `SignalGroup.delete() does nothing for non-existent object` (`:1137`) und der `null`-Fall bleiben unberührt.
  5. **Der Wächter in `src/touch.ts`**, als erste Anweisung von `function touch(source: any)`:

     ```ts
     function touch(source: any) {
       // CONS-007: the same answer `link()` gives. Without this the non-tuple
       // case ran straight into the spread below and the caller got
       // `Spread syntax requires ...iterable[Symbol.iterator] to be a function`,
       // which names neither this function nor its argument. The shape is
       // checked, not the lookup result: `touch([obj, 'unknown'])` stays the
       // documented no-op.
       if (!isSignal(source) && !Array.isArray(source)) {
         throw new TypeError(
           '[signalize] touch: source must be a signal or an [object, propertyName] tuple',
         );
       }
       const signal = signalImpl(
     ```

     Der Rest der Funktion bleibt unverändert, `isSignal` ist bereits importiert. Die doppelte `isSignal()`-Auswertung (Wächter und Ternär) ist bewusst: es ist ein Property-Lookup, `touch()` ist kein heißer Pfad (das ist `writeSignal()`), und eine gemeinsame lokale Variable würde den Wächter vom Kopf der Funktion wegziehen.
  6. **Derselbe Wächter in `src/value.ts`**, als erste Anweisung von `function value(source: any)`:

     ```ts
     function value(source: any) {
       // CONS-007: see `touch()` — same guard, same reason. The shape is checked,
       // not the lookup result: `value([obj, 'unknown'])` stays `undefined`.
       if (!isSignal(source) && !Array.isArray(source)) {
         throw new TypeError(
           '[signalize] value: source must be a signal or an [object, propertyName] tuple',
         );
       }
       return isSignal(source)
     ```

     Kein gemeinsamer Helfer für die beiden Wächter, und das ist eine Entscheidung: er wäre ein neues Modul zwischen `object-signals.ts` und den zwei Blättern, für acht Zeilen, deren einzige gemeinsame Substanz eine Bedingung ist — die Meldung nennt jeweils ihre eigene Funktion. `link.ts` trägt seinen Wächter aus demselben Grund inline.
  7. **JSDoc beider Funktionen** um eine `@throws`-Zeile ergänzen, direkt hinter dem vorhandenen `@param source`:
     - `src/touch.ts`: `@throws TypeError if source is neither a signal nor an [object, propertyName] tuple`
     - `src/value.ts`: dieselbe Zeile, vor `@returns`.

     Das ist die Quelle, aus der `lib/*.d.ts` seit BUILD-004 sein JSDoc bezieht; die Reihenfolge des Doku-Abgleichs aus `CLAUDE.md` beginnt hier.
  8. **Doku, in der Reihenfolge aus `CLAUDE.md`.** Sechs Dateien, jede genau eine Stelle:
     - `docs/api.md:86-87`, die zwei letzten Zeilen der Tabelle »Top-level helpers« (`### Top-level helpers`, Überschrift auf `:77`, Tabelle `:79-87`): bei `value(sig | [obj, key])` hinter »Untracked read (signal or `[host, name]`).« und bei `touch(sig | [obj, key])` hinter »Force a notify.« je den Satz »Throws `TypeError` on anything else.« anfügen.
     - `docs/api.md`, unmittelbar hinter derselben Tabelle und **vor** dem `---` auf `:89`, der neue Absatz — **die Zeile, die der Plankopf für die stillen No-Ops verlangt**, und die einzige Stelle im ganzen Paket, an der sie stehen soll:

       > **A non-signal argument.** Three functions object to one: `link()`, `touch()` and `value()` throw a `TypeError` prefixed with `[signalize] <fn>:`. Four do not: `destroySignal()`, `muteSignal()`, `unmuteSignal()` and `unlink()` do nothing and report nothing — they are teardown-shaped, and a teardown that refuses an argument it does not recognise is harder to use than one that shrugs. `getLinksCount(notASignal)` answers `0`, the same answer a signal without links gives. Do not read that silence as confirmation that the argument was a signal; `isSignal(v)` is the way to ask.

     - `docs/api.md:580`, die Tabellenzeile `SignalGroup.delete(obj)`: »Clear and remove the group.« → »Clear and remove the group. Passing the group itself works too, like `get()` / `findOrCreate()`.«
     - `docs/architecture.md:106-107`: »`SignalGroup.delete(obj)` is the public destructor.« → »… is the public destructor, for the host object or for the group itself.« Der Rest des Aufzählungspunkts (Instanzmethode `clear()`, deprecated `destroy()`) bleibt.
     - `docs/cheat-sheet.md:128`: den Kommentar `// clear & remove` zu `// clear & remove — obj or the group itself` erweitern.
     - `skills/using-signalize/references/api.md:207`: `// clear & remove — the preferred destructor` → `// clear & remove — the preferred destructor; a group works as the argument too`.
     - `skills/using-signalize/references/pitfalls.md:72` (Punkt 15): »the static form additionally looks the group up by the host object« → »the static form additionally looks the group up by the host object, and takes a group itself just as `get()`/`findOrCreate()` do«.

     `docs/recipes.md`, `README.md` und `SKILL.md` bleiben unberührt: ihre sechs Fundstellen übergeben durchweg ein Hostobjekt und beschreiben kein Verhalten, das sich ändert.
  9. **CHANGELOG**, unter `## Unreleased`. Keine Id-Kollision — weder `API-014` noch `CONS-007` steht bisher in der Datei; das Suffix `audit 2026-08-08` bleibt trotzdem, wie in allen Zeilen dieses Laufs.
     - `### Bug Fixes`, zwei Zeilen:
       - `SignalGroup.delete(group)` clears the group it is handed instead of doing nothing. A group made by `findOrCreate(host)` is filed in the store under `host`, so the lookup this method did found nothing — the documented public destructor was a silent no-op for exactly the argument `get()` and `findOrCreate()` accept. The deprecated `SignalGroup.destroy(group)`, which routes through it, is fixed with it (API-014, audit 2026-08-08)
       - `touch()` and `value()` reject a source that is neither a signal nor an `[object, propertyName]` tuple with `[signalize] touch: …` / `[signalize] value: …` (`TypeError`), the shape `link()` already used. The unchecked case used to run into a spread and produce `Spread syntax requires ...iterable[Symbol.iterator] to be a function`, which names neither the function nor its argument (CONS-007, audit 2026-08-08)
     - `### Breaking Changes`, zwei Zeilen:
       - `SignalGroup.delete(group)` tears the group down. Code that passed a group where a host object was expected used to get a silent no-op and now gets the full teardown — every attached signal, effect, link and child group is destroyed (API-014, audit 2026-08-08)
       - `touch(x)` / `value(x)` throw for an `x` that is neither a signal nor an array. An *iterable* non-signal — a string, a `Set`, a generator — used to be spread into the object-signal lookup and answered `undefined` silently; it throws now. Both overloads already rejected such an argument at `tsc` time, so only untyped JavaScript callers can reach it (CONS-007, audit 2026-08-08)
     - `### Documentation`, eine Zeile:
       - `docs/api.md` now says which functions refuse a non-signal argument and which stay silent: `link()`, `touch()` and `value()` throw, `destroySignal()`, `muteSignal()`, `unmuteSignal()` and `unlink()` do nothing and report nothing, and `getLinksCount()` answers `0` (CONS-007, audit 2026-08-08)
- Verify: fünf Teile, alle am 2026-08-10 auf der Kopie gefahren.
  1. **Rot vor Grün**, Schritt 3 oben: 2 failed | 98 passed, die zwei Meldungen wörtlich wie dort. Danach dieselbe Zeile mit den Fixes: 100 passed.
  2. **`pnpm world`** in allen neun Schritten. Erwartung, gemessen: 45 Dateien / **551 Tests** (vorher 548), Coverage **99,33 / 95,35 / 99,57 / 99,46** (vorher 99,32 / 95,26 / 99,57 / 99,46), `touch.ts` und `value.ts` erscheinen nicht im Bericht (100 % in allen vier Spalten), `SignalGroup.ts` 98,69 / 91,04 / 100 / 98,58. `test:gc` grün (551), `typecheck` 0 Fehler, `check` sauber.
  3. **Drei Mutationsproben**, jede einzeln zurückgebaut, jede über die **volle** Suite gefahren — Ergebnis je **1 failed | 550 passed**, kein Kollateralschaden:

     | Mutation | fällt | erste Assertion |
     | --- | --- | --- |
     | Frühausstieg in `delete()` entfernt | `SignalGroup.delete() takes the group itself …` | `the attached signal is destroyed: … expected 1 to be +0` |
     | Wächter in `touch.ts` entfernt | `touch() and value() reject a source …` | `expected [Function] to throw error including '[signalize] touch: …' but got 'Spread syntax requires …'` |
     | Wächter in `value.ts` entfernt | derselbe Test | dieselbe Meldung mit `[signalize] value: …` |

     Dass beide Wächter einzeln melden, ist der Grund für die vier `toThrow`-Paare im ersten Test; eine gemeinsame Assertion hätte den zweiten Ausfall verdeckt.
  4. **Die Grenze, die nicht fallen darf**: `touch([obj, 'unbekannt'])` bleibt der No-Op (`src/object-signals.spec.ts`, bestehender Test), `value([obj, 'unbekannt'])` bleibt `undefined` (neuer Test). Beide laufen gegen beide Codezustände grün — wer sie rot sieht, hat statt der Form das Auflösungsergebnis geprüft.
  5. **Der Baum.** `git status --porcelain --untracked-files=all` zeigt die elf geänderten Dateien plus `remediation-plan.md`, keine Wegwerf-Spec in `src/`, `grep -rn 'zz-' src/` leer.
- Commit: `fix: make the group destructor and the two signal readers answer for themselves (API-014, CONS-007)`

<details>
<summary>API-014 und CONS-007 im Volltext (aus <code>audit.html</code>)</summary>

**API-014 — SignalGroup.delete(group) behandeln wie get und findOrCreate**
Severity: `medium` · Kategorie: Öffentliche API · Aufwand: S · Status: `new`
Location: `src/SignalGroup.ts:302-304 · src/SignalGroup.ts:257-263`

> `get()` und `findOrCreate()` haben beide einen `instanceof SignalGroup`-Frühausstieg, `delete()` nicht — es schlägt nur in `store` nach. Eine über `findOrCreate(host)` erzeugte Gruppe liegt unter `host` im Store, nicht unter sich selbst, also ist `SignalGroup.delete(group)` ein stiller No-Op. `docs/architecture.md:106` nennt genau diese Methode »the public destructor«.

> Empfehlung: `if (object instanceof SignalGroup) { object.clear(); return; }` voranstellen.

> Evidence: Nach `SignalGroup.delete(g)` ist das angehängte Signal nicht zerstört; nach `SignalGroup.delete(host)` schon.

**CONS-007 — Ein Fehlerverhalten für »ist kein Signal« festlegen**
Severity: `medium` · Kategorie: Konsistenz · Aufwand: M · Status: `new`
Location: `src/touch.ts:17-21 · src/value.ts:17-22 · src/link.ts:191-194 · src/signal-core.ts:142-145`

> Derselbe Fehlaufruf bekommt vier verschiedene Antworten. `link({}, cb)` wirft einen sauberen `TypeError` mit Präfix; `unlink({})` und `destroySignal({})` schweigen; `getLinksCount({})` gibt `0`; `touch({})` und `value({})` werfen den nativen Spread-Fehler, weil der Nicht-Tupel-Fall ungeprüft in `...(source as [any, any])` läuft. Die letzten beiden sind für einen Anwender nicht deutbar.

> Empfehlung: Mindestens `touch()` und `value()` auf die `link()`-Form bringen. Für die stillen No-Ops eine Zeile in `docs/api.md`, dass sie es sind.

> Evidence: `touch({})` → `TypeError: Spread syntax requires ...iterable[Symbol.iterator] to be a function`.

</details>

### Phase 3b — Der heiße Pfad

- **Ergebnis (2026-08-10)** — Hash `8cc46e9`. **Damit ist Phase 3, die Korrektheitsphase, abgeschlossen.** Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 45 Dateien / **551 Tests** (vorher 548), Coverage 99,33 / 95,35 / 99,57 / 99,46, `touch.ts` und `value.ts` bei 100 % in allen vier Spalten.
- **Rot gesehen**: 2 failed | 98 passed in den zwei betroffenen Dateien. Drei Mutationsproben, je 1 rot ohne Kollateralschaden, vom Reviewer unabhängig nachgefahren.
- **API-014 war folgenlos, nicht halb kaputt**: nach `SignalGroup.delete(group)` blieben Signal, Effect und Link vollständig am Leben, und `SignalGroup.get(host)` lieferte weiterhin dieselbe Gruppe. `clear()` allein reicht als Fix — es hält den Hostschlüssel in `#storeKey` und ruft `store.delete(key)` selbst. Der Reviewer hat es mit einem eigenen Test bestätigt und die Symmetrie am Code nachgeprüft: sowohl `findOrCreate()` als auch der private Konstruktor steigen bei `instanceof SignalGroup` aus, bevor etwas in den Store gelangt — **eine Gruppe kann nie ihr eigener Schlüssel werden**, ein zweiter Eintrag ist strukturell ausgeschlossen. Der deprecated `SignalGroup.destroy(group)` ist durch dieselbe Zeile mitrepariert und warnt weiterhin genau einmal.
- **Es sind fünf Fälle, nicht zwei.** Das Finding nennt `unlink({})` und `destroySignal({})` als stille No-Ops; dazu kommen `muteSignal({})` und `unmuteSignal({})`, beide öffentlich und im Finding vergessen. Alle vier bleiben still — sie sind teardown-förmig. `getLinksCount({}) → 0` ist der fünfte und **kein** No-Op, sondern eine Antwort; auch sie bleibt, weil ein Wurf dort eine Verhaltensänderung ohne Finding-Deckung wäre. `docs/api.md` benennt jetzt alle drei Gruppen getrennt. Der Reviewer hat repo-weit nach einem sechsten Kandidaten gesucht und keinen gefunden.
- Die zwei neuen Wächter folgen der Form aus Paket 14 (Position am Funktionskopf, vor jeder Zustandsänderung) und der Meldungsform aus `link.ts` (`[signalize] <fn>:`-Präfix). Ein echtes `[reader, writer]`-Tupel kommt weiterhin durch — vom Reviewer geprüft, kein legitimer Aufruf wird abgewiesen.
- **Der Breaking-Fall ist der, den man übersieht**: ein *iterierbarer* Nicht-Signal-Wert (String, `Set`, Generator) lief bisher durch den Spread und bekam still `undefined`. Er wirft ab jetzt. Nur aus untypisiertem JS erreichbar; beide Overloads lehnen ihn zur Compile-Zeit ab. Der Gegenentwurf — `Symbol.iterator` prüfen statt `Array.isArray` — ist verworfen: er hätte genau die schlechteste der fünf Antworten konserviert, die CONS-007 anprangert. Die reine Änderung der Fehlermeldung (nativer Spread-Fehler → eigener `TypeError`) steht dagegen als Bug Fix, nicht als Breaking Change.
- Die `location`-Zeile von CONS-007 zeigt für `signal-core.ts` seit Paket 13b zwölf Zeilen daneben — vermerkt, damit niemand den Befund für gegenstandslos hält.
- Review: **keine Befunde.**


#### [x] 17. Die drei Early Returns
- Findings: PERF-001 (high), PERF-002 (high), PERF-003 (medium)
- Ziel: Kein Fehler-Array pro Effect-Lauf, kein Set plus zwei Subscriptions für einen leeren Batch, kein Emit auf eine Queue ohne Abonnenten. Laut Audit +27 % dynamisch, +63 % auf dem Static-Deps-Pfad.
- Bereich: `src/EffectImpl.ts`, `src/batch.ts`
- Hängt ab von: Paket 10, Paket 15
- Anmerkung (2026-08-10, aus Paket 10): **Was das Netz ab jetzt schützt — und was nicht.** PERF-001 und PERF-003 greifen beide in denselben `try`-Block von `EffectImpl.run()` (`:461-476`), unmittelbar um `const generation = ++this.#generation;`. Genau dieser Ort ist seit Paket 10 zugesagt: `a cleanup that settles after the run it was superseded by does not take the slot` (`src/effects.async.spec.ts`) fällt, sobald der Bump vor `runCleanupCallback()` rutscht, ein Early Return ihn überspringt oder er hinter die Callback-Invokation wandert. Der achtzeilige Kommentar bei `:469-476` ist damit keine Prosa mehr, sondern ein Test — er darf beim Umbau *mitwandern*, aber nicht seinen Platz in der Reihenfolge verlieren. **Nicht geschützt:** PERF-002 (`src/batch.ts`) — dort hat Paket 10 nichts hinterlassen, der Batch-Umbau steht auf der vorhandenen Suite allein.
- Anmerkung (2026-08-10, aus Paket 15): **Was dieses Paket nach 15 vorfindet, und eine Begründung, die dann fehlt.** Der `run()`-Rumpf heißt nach 15 `#run(immediate)` und trägt vor dem `maxDepth`-Wächter zwei neue Zeilen, die PERF-001 und PERF-003 nicht anfassen dürfen: das Batch-Gate ist jetzt zweistufig (Einreihen mit Vermerk gegen `unbatch()` und Weiterlaufen), und `this.#explicitRunRequested = false;` steht unmittelbar dahinter — ein Early Return, der daran vorbeispringt, lässt den Vermerk scharf und macht aus einem `{autorun:false}`-Effect dauerhaft einen Autorun-Effect. Der Test, der das meldet, heißt `does not make the effect run on a later write of its own accord` (`src/effects.noAutorun.spec.ts`). Für PERF-002 kommt in `batch.ts` `unbatch()` dazu: eine Schleife über `delayedEffects`, die pro vorgezogenem Memo-Read einmal läuft — wer die Warteschlange umbaut (etwa auf eine Map je Priorität), baut sie mit um; die drei Zweige stehen unter der 100-%-Auflage der Tier-2-Negation. **Und die Begründung, die 15 verbraucht:** `{batchWrites: true}` kostet nach 15 keine Lesefrische mehr, sondern nur noch eine `Batch`-Instanz je Recompute — die Zeile in `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md` und der Skill-Referenz, die den Default `false` erklärt, hängt damit ab sofort an genau dem Sockel, den PERF-002 einspart. Wer ihn wegoptimiert, sollte diese vier Stellen mitlesen: bleibt vom Preis nichts übrig, ist die Erklärung für den Default fällig, nicht der Default.
- Anmerkung (2026-08-10, aus Paket 32): **Die Lücke bei PERF-002 ist kleiner geworden, aber nicht zu.** Neue Zusagen über das Batch-Verhalten sind nicht dazugekommen; was dazugekommen ist, ist die Buchhaltung: `src/batch.spec.ts` führt seit Paket 32 alle drei Zähler und räumt in jedem Test im `finally` ab. Ein Early Return, der ein Set oder zwei Subscriptions einspart und dabei einen Effect nicht mehr abmeldet, fällt damit auf — ein Early Return, der Reihenfolge oder Dedup verändert, weiterhin nicht.
- Gegenprobe: `pnpm bench` vorher/nachher, Zahlen in den Report
- Modell: stärkste Stufe
- Hash: `8281c28`
- Dateien: zwei Produktionsdateien — `src/EffectImpl.ts`, `src/batch.ts`; **eine** Spec-Datei — `src/batch.spec.ts` (ein neuer Test, für PERF-003); drei Bench-Dateien für die Baseline-Blöcke — `bench/signal-write.bench.ts`, `bench/memo.bench.ts`, `bench/batch.bench.ts`; sechs Doku-Stellen für die `batchWrites`-Begründung — `src/createMemo.ts` (JSDoc), `docs/api.md` (zweimal), `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`; dazu `AGENTS.md`, `docs/architecture.md` und `CHANGELOG.md`. **Keine neue Datei, keine neue Modulkante, kein neuer öffentlicher Export** — `isFlushingBatch()` ist paketintern und steht *nicht* in `src/index.ts`.
- Abgleich (2026-08-10, Messungen bis 2026-08-11): alle drei Findings **unverändert** und am Code von `8cc46e9` reproduziert. Gemessen wurde im Arbeitsbaum selbst (kein Worktree, Hilfsdateien in einem eigenen Scratchpad-Unterverzeichnis), jede Messung danach zurückgebaut; `git status --porcelain --untracked-files=all` meldet am Ende nur `remediation-plan.md`.

  **Zum Messprotokoll, weil die Zahlen sonst nichts wert sind.** `pnpm bench` läuft je Datei in *einem* Prozess, und schnelle Benchmarks weiter oben in der Datei erzeugen mehr Müll für die weiter unten — die Zahl eines Falls hängt damit von seinen Nachbarn ab. Gemessen: `write source, memo (default) recomputes, effect reacts` fiel im Volllauf der Datei nach dem Fix scheinbar von 1,40 auf 1,19 Mops/s, isoliert (`pnpm bench memo -t "recomputes, effect reacts"`) stieg er von **1,28 auf 1,62 Mops/s (+26 %)**. Alle Zahlen unten stammen deshalb aus **isolierten Läufen** (`-t`-Filter oder eigene Datei), mit `{time: 2000, warmupTime: 500}` statt der 500-ms-Voreinstellung, je 2 bis 5 Wiederholungen, und die genannte Zahl ist der **Median**. Wo `hz` und `p75` auseinanderlaufen, steht beides da: `hz` ist `1/mean` und reagiert auf GC-Ausreißer, `p75` nicht.

  - **PERF-001 unverändert, Fundstelle gewandert.** Das Finding sagt `src/EffectImpl.ts:633-637 · :430`; heute steht `destroyChildEffects()` auf **`:858-862`** und der unbedingte Aufruf in `#run()` auf **`:540`**. Der Rumpf ist Zeichen für Zeichen der beschriebene: `const errors: unknown[] = []; this.collectDestroyChildEffects(errors); throwCollectedErrors(errors, 'destroying an effect');`. `collectDestroyChildEffects()` (`:869-874`) hat nach 13b **zwei** Aufrufer — `destroyChildEffects()` und `destroy()` (`:1087`, mit eigener Fehlerliste) —, die Audit-Empfehlung, es unangetastet zu lassen, trägt also weiterhin.
  - **PERF-001, eigene Messung** (isolierte Datei, Median aus 2 Läufen, gegen Baseline-Median aus 3): `set → 1 dynamischer Effect` 2,53 → **2,97 Mops/s (+17 %)** · `set → 1 Static-Deps-Effect` 3,14 → **3,95 Mops/s (+26 %)** · `set → 10 dynamische Effects` 388 → **488 kops/s (+26 %)**. Der Audit nennt +13 % und +38 %; die Richtung stimmt, die Größenordnung auch, die Verteilung zwischen den beiden Pfaden nicht ganz. **Aussagekräftig ist der Fan-out**: je mehr Effect-*Läufe* ein Write auslöst, desto größer der Anteil. `create + destroy (1 dependency)` bleibt bei 327 kops/s (unverändert, korrekt — `destroy()` geht über `collectDestroyChildEffects()`).
  - **PERF-002 unverändert, Fundstelle gewandert.** Das Finding sagt `src/batch.ts:33-62 · :28-31`; `Batch#run()` steht heute auf **`:76-121`**, `flush()` auf `:55-74`. Paket 12 und 15 haben den Rumpf umgebaut (Delivery-Rahmen, `try`/`finally` um die Abmeldungen, Warteschlangen-Leerung in `flush()`), aber nichts davon berührt die Beschreibung: `new Set`, `unsubscribe`-Array, `beginIsolatedDelivery()` und zwei `on()`-Aufrufe laufen weiterhin **bedingungslos**, auch bei leerer `delayedEffects`.
  - **PERF-002, eigene Messung** (eigene Bench-Datei, Median aus 3 Läufen): `batch(() => {})` 1,51 Mops/s → **20,1 Mops/s**, also **663 ns → 50 ns (13,3×)** · `batch(1 Write), kein Effect` 1,31 → **8,45 Mops/s**, **766 ns → 118 ns (6,5×)** · `batch(1 Write) → 1 Effect` 669 → 728 kops/s · `batch(10 Writes) → 1 Effect` 420 → 465 kops/s. Die letzten beiden Zahlen gehören **nicht** zu PERF-002 (dort ist die Warteschlange nicht leer, der Early Return greift nie), sondern zu PERF-001/003 im Effect-Lauf innerhalb des Flushs; sie sind die Kontrollfälle, die sich **nicht verschlechtern** dürfen. Der Audit misst 367 → 10 ns, diese Maschine ist langsamer und der Faktor kleiner; die Aussage ist dieselbe.
  - **PERF-003 unverändert, Fundstelle gewandert, und der Abonnentenbefund stimmt exakt.** Das Finding sagt `src/EffectImpl.ts:434 · src/batch.ts:44-46`; der Emit steht heute auf **`src/EffectImpl.ts:544`**, der einzige Abonnent auf **`src/batch.ts:88-90`**. Repo-weit gesucht (`src`, `bench`, `docs`, `skills`, `README.md`, `AGENTS.md`, `smoke`): `globalEffectCalledQueue` erscheint an genau sieben Stellen — der Deklaration (`src/global-queues.ts:6`), dem Import und dem Emit in `EffectImpl.ts`, dem Import und dem `on()` in `batch.ts`, vier Zähl-Assertionen in `src/batch.spec.ts:204-241`, dazu zwei Prosa-Zeilen (`AGENTS.md:48`, `docs/architecture.md:61`) und ein Kommentar in `bench/memo.bench.ts:66`. **Kein zweiter Abonnent, kein Export aus `src/index.ts`, kein Weg für Anwendungscode** — die `exports`-Map von `package.json` kennt nur `.` und `./decorators`. `src/global-queues.spec.ts` prüft die anderen drei Queues, diese nicht.
  - **PERF-003, eigene Messung** (isolierte Datei, Median aus 2 Läufen): `set → 1 dynamischer Effect` 2,53 → **2,93 Mops/s (+16 %)** · `set → 1 Static-Deps-Effect` 3,14 → **3,61 Mops/s (+15 %)** · `set → 10 dynamische Effects` 388 → **442 kops/s (+14 %)**.
  - **Alle drei zusammen, eigene Messung**, Median aus 3 (Effects) beziehungsweise 2 (übrige) isolierten Läufen:

    | Fall | Baseline | alle drei | Delta |
    | --- | ---: | ---: | ---: |
    | `set → 1 dynamischer Effect` | 2,53 Mops/s | **3,45 Mops/s** | **+36 %** |
    | `set → 1 Static-Deps-Effect` | 3,14 Mops/s | **4,39 Mops/s** | **+40 %** |
    | `set → 10 dynamische Effects` | 388 kops/s | **584 kops/s** | **+51 %** |
    | `signal-write`: fans out to 1 | 1,90 Mops/s | **2,41 Mops/s** | **+27 %** |
    | `signal-write`: fans out to 10 | 371 kops/s | **572 kops/s** | **+52 %** |
    | `signal-write`: fans out to 100 | 40,5 kops/s | **62,7 kops/s** | **+51 %** |
    | `batch(() => {})` | 663 ns | **50 ns** | **13,3×** |
    | `batch(1 Write), kein Effect` | 766 ns | **118 ns** | **6,5×** |
    | `memo`: Recompute ohne Downstream-Effect | 1,79 Mops/s | **2,36 Mops/s** | **+32 %** |
    | `memo`: `{batchWrites: true}`, ohne Downstream-Effect | 522 kops/s | **2,31 Mops/s** | **4,4×** |
    | `memo`: Recompute mit Downstream-Effect | 1,28 Mops/s | **1,62 Mops/s** | **+26 %** |
    | `memo`: `{batchWrites: true}`, mit Downstream-Effect | 504 kops/s | 519 kops/s | +3 % (Rauschen) |
    | `effect`: create + destroy | 327 kops/s | 328 kops/s | 0 % |

    Der Audit verspricht +27 % dynamisch und +63 % auf dem Static-Deps-Pfad. Gemessen sind es **+36 %** und **+40 %** — das Versprechen wird auf dem einen Pfad übertroffen und auf dem anderen um ein Drittel verfehlt. Beides ist erklärbar: seit dem Auditstand liegen sechzehn Pakete, unter anderem 13a und 13b, die genau diese Fehlerpfade umgebaut haben.

  - **Zwei Fälle, die im Rauschen liegen und deshalb in keiner Commit-Message auftauchen dürfen.** `signal write, no consumers` steigt von 10,6 auf 12,0 Mops/s (+13 %), reproduzierbar über je zwei Stichproben — **ohne jeden Mechanismus**: bei diesem Benchmark existiert kein einziger Effect, keine der drei Änderungen liegt auf dem Pfad. Das ist Code-Layout, nicht Wirkung. Und `set → Effect mit 1 Kindeffect` fällt in `hz` um 3 % (264 → 257 kops/s), während sein `p75` von 0,0038 auf 0,0035 ms **sinkt** — der Fall allokiert pro Lauf einen kompletten Kindeffect, seine `hz` wird von GC-Ausreißern getrieben. Über `p75` gelesen sind es +8 %.
  - **Der Nebenbefund aus Paket 12 (`src/batch.ts:177`) gehört hierher, und die Antwort ist: bleibt, jetzt mit Zahl.** Die Stelle heißt heute `src/batch.ts:188` (`let errors: unknown[] | undefined;`) mit dem lazy Auffüllen bei `:214` und `:219-223`. 13a hatte sie ausgespart und die Entscheidung hierher verwiesen. Gemessen, indem die eager Fassung (`const errors: unknown[] = []` plus `throwCollectedErrors()` unbedingt) gegen die lazy gefahren wurde, **nach** PERF-002: `batch(() => {})` 20,1 → 17,7 Mops/s, `batch(1 Write), kein Effect` 8,45 → 7,62 Mops/s. Die lazy Form ist also **10 bis 12 % des verbleibenden Preises** wert — vor PERF-002 war sie unter 1 % und damit kaum verteidigbar, danach ist sie eine der größeren Posten. **Sie bleibt unverändert; der Kommentar bei `:185-187` bekommt die Zahl.** Damit ist die Notiz aus 12/13a geschlossen.
  - **Die Notiz aus Paket 15 trägt nach dem Fix nicht mehr, und zwar messbar.** 15 hat die Begründung für den Default `{batchWrites: false}` an sechs Stellen auf »eine `Batch`-Instanz je Recompute« umgeschrieben. Nach PERF-002 ist genau dieser Sockel weg: ein Memo mit `{batchWrites: true}` **ohne** Downstream-Effect läuft mit 2,31 Mops/s gegen 2,36 Mops/s des Defaults — der Unterschied ist mit zwei Prozent nicht mehr von Null zu unterscheiden, vorher war der Faktor **3,4**. Die Begründung ist damit falsch, aber der Default ist es nicht: **mit** Downstream-Effect kostet `{batchWrites: true}` weiterhin 519 kops/s gegen 1,62 Mops/s des Defaults — Faktor **3,1**, und zwar nicht mehr wegen einer Allokation, sondern weil dann ein echter Flush läuft (Set, Array, zwei Subscriptions, Delivery-Rahmen und eine Zustellung über eventize statt eines direkten Aufrufs) für einen einzigen aufgeschobenen Effect. Das ist die bessere Begründung: der Preis fällt genau dort an, wo die Option benutzt wird, und er lohnt sich erst, wenn ein Recompute denselben Downstream-Effect **mehrfach** auslösen würde. Die sechs Stellen werden darauf umgeschrieben (Schritt 7).
  - **Modulschicht für PERF-003: keine neue Kante, keine Zyklusgefahr.** `EffectImpl.ts:10` importiert bereits `getCurrentBatch` aus `./batch.js`; `isFlushingBatch` reist auf derselben Zeile mit. `batch.ts` importiert nichts aus `EffectImpl.ts` — der Kommentar bei `batch.ts:147-149` erklärt, warum dort sogar `isThenable` dupliziert ist. `pnpm bundle` (Rollup mit `CIRCULAR_DEPENDENCY` als Fehler) ist mit allen drei Änderungen grün gefahren.
  - **Verschachtelte Flushs: der Tiefenzähler ist Pflicht, und heute sieht das kein Test.** Ein Effect-Callback im Flush kann `batch()` aufrufen (`Batch.current` ist während des Flushs `undefined`, es entsteht also eine neue `Batch`), deren `run()` ein zweiter, verschachtelter Flush ist. Beide Flushs haben dann eigene `alreadyBeenCalled`-Mengen und **beide** Abonnements hängen gleichzeitig an der Queue. Ein Flag statt eines Zählers stellt beim Schließen des inneren Flushs auf `false` — jeder Effect, der danach im äußeren Flush direkt läuft, wird nicht mehr vermerkt und läuft am Ende ein zweites Mal. **Gemessen**: die Flag-Mutation (`g_flushDepth = 1` / `= 0` statt `++` / `--`) lässt die **volle Suite grün** (551/551). Der Fall hat heute keinen Zeugen; deshalb Schritt 4.
  - **Der Emit selbst hat genau einen Zeugen.** Wird er ersatzlos gestrichen, fällt **1** Test: `src/effects.priority.spec.ts > Effect priority > prioritized memos should run before others`. Das ist die untere Schranke — der Guard darf den Emit im Flush nicht verlieren.
  - **Der leere Flush hat neunzehn Zeugen.** Wird aus dem Early Return von PERF-002 ein `throw`, fallen **19 Tests in 7 Dateien** (`SignalAutoMap.spec.ts`, `batch.spec.ts`, `createMemo.spec.ts`, `createSignal.destroySignal.spec.ts`, `effects.noAutorun.spec.ts`, `hibernate.spec.ts`, `ordering.property.spec.ts`). Der neue Zweig ist also von beiden Seiten gedeckt, ohne dass ein Test dafür geschrieben werden müsste — und `batch.ts` steht unter der Tier-2-Auflage 100/100/100/100 (`vitest.config.ts:17-18`), das ist keine Formalie.
  - **Äquivalenz, am Code nachgewiesen, nicht nur behauptet.** PERF-001: `throwCollectedErrors([])` kehrt sofort zurück, `childEffects.length = 0` auf einem leeren Array ist ein No-op, die Schleife läuft null Mal — der Early Return lässt nichts aus. PERF-002: zwischen `beginIsolatedDelivery()` und `endIsolatedDelivery()` steht bei leerer Warteschlange nur das Anmelden und Abmelden zweier Listener; `collectDeliveryError()` wird nie gerufen, der Rahmen kann also nichts enthalten, und Anmelden plus Abmelden ist von außen nicht beobachtbar. `unbatch()` ändert daran nichts: es leert eine `Set`, nicht das Array — `delayedEffects.length` bleibt `> 0`, der Early Return greift dort nie. PERF-003: der Guard ist **weiter** als das Abonnementfenster (Inkrement vor `beginIsolatedDelivery()`, Dekrement nach `endIsolatedDelivery()`), ein überflüssiger Emit ist damit möglich, ein fehlender nicht.
  - **Die volle Prüfkette ist mit allen drei Änderungen gefahren**: `pnpm world` in allen neun Schritten grün, **45 Dateien / 551 Tests** — identisch zur Baseline. `pnpm check` und `pnpm typecheck` sauber, auch mit `let g_flushDepth` unterhalb der Klasse.
  - **Zwei Zeilenangaben in den Anmerkungen oben sind vor-15 und zeigen daneben.** Die Paket-10-Anmerkung nennt den `try`-Block bei `:461-476` und den achtzeiligen Kommentar bei `:469-476`; nach 15 stehen sie auf **`:538-624`** beziehungsweise **`:546-552`**. Die Aussage — Bump zwischen `runCleanupCallback()` und der Callback-Invokation, Kommentar wandert mit — gilt unverändert; nur die Zahlen sind verjährt. Vermerkt, damit niemand am falschen Ort nachsieht und die Anmerkung für gegenstandslos hält.
  - **Kein neuer `critical`- oder `high`-Befund.** Zwei Kleinigkeiten für Paket 29: `src/createMemo.ts:39` und `src/createMemo.spec.ts` (`describe('batchWrites option (PERF-001)')`) tragen die Finding-Id **PERF-001 des Vor-Audits** (dort: die Batch-Maschinerie), die im aktuellen Audit etwas völlig anderes bezeichnet. Dasselbe in `bench/memo.bench.ts:63-72` und `bench/batch.bench.ts:6-13` (»PERF-004«). Wer diesen Plan liest, verwechselt sonst zwei Findings mit derselben Nummer.
- Modell (bestätigt, 2026-08-11): **stärkste Stufe**, wie im Grobplan. Der Code ist drei Zeilen und vollständig vermessen — die Arbeit liegt woanders: der Implementierer muss Bench-Rauschen von Wirkung unterscheiden (zwei Fälle bewegen sich hier ohne Mechanismus), sechs Doku-Stellen auf eine Begründung umschreiben, die er selbst nachmisst, und eine Mutationsprobe fahren, bei der »grün« das erwartete Ergebnis ist. Genau die Lage, in der eine schwächere Stufe selbstbewusst die falsche Zahl berichtet.
- Vorgehen: acht Schritte. Test vor Fix nur bei PERF-003 — die anderen beiden ändern kein Verhalten und können keinen Test bekommen.
  1. **Der Test für PERF-003 zuerst, und er ist gegen den *heutigen* Code grün.** Das ist die Ausnahme von der Regel »rot sehen«: er hält eine Zusage fest, die schon gilt, und die der Fix nicht brechen darf. Er gehört nach `src/batch.spec.ts`, in den `describe('batch')`-Rumpf hinter `it('Batch.run() releases its temporary listeners even when an effect throws')`. Gemessen: grün auf `8cc46e9`, grün mit dem Fix, **rot mit der Flag-Mutation** (`expected 2 to be 1`).

     ```ts
     it('an effect that ran inside an outer flush, after a nested batch closed, is not run a second time by that flush (PERF-003)', () => {
       const a = createSignal(0);
       const b = createSignal(0);
       const c = createSignal(0);

       const runs: string[] = [];

       // Runs first in the flush, and does two things while the outer flush
       // is still open: it opens a nested batch that has something to flush,
       // and then writes unbatched — `Batch.current` is undefined during a
       // flush, so `observer` runs right there.
       const driver = createEffect(
         () => {
           a.get();
           runs.push('driver');
           batch(() => {
             c.set(c.value + 1);
           });
           b.set(b.value + 100);
         },
         {priority: 10},
       );

       const observer = createEffect(
         () => {
           b.get();
           runs.push('observer');
         },
         {priority: 0},
       );

       const inner = createEffect(() => {
         c.get();
         runs.push('inner');
       });

       try {
         runs.length = 0;

         batch(() => {
           a.set(1);
           b.set(2);
         });

         expect(
           runs.filter((r) => r === 'observer').length,
           'the outer flush must still know that observer already ran',
         ).toBe(1);
       } finally {
         driver.destroy();
         observer.destroy();
         inner.destroy();
         destroySignal(a);
         destroySignal(b);
         destroySignal(c);
       }
     });
     ```

     `src/batch.spec.ts` führt seit Paket 32 alle drei Zähler in `beforeEach`/`afterEach`; der `finally`-Block bedient sie. Importe: `batch`, `createEffect`, `createSignal` und `destroySignal` stehen bereits oben, es kommt keine Importzeile dazu.
  2. **PERF-001, eine Zeile.** In `src/EffectImpl.ts`, `destroyChildEffects()` (`:858`), als erste Anweisung des Rumpfes:

     ```ts
     private destroyChildEffects(): void {
       if (this.childEffects.length === 0) return;
       const errors: unknown[] = [];
       …
     ```

     Zwei Sätze ins JSDoc darüber: dass der Early Return exakt äquivalent ist (leeres Array → `throwCollectedErrors()` kehrt sofort zurück, `length = 0` ist ein No-op) und dass er dort steht, weil `#run()` die Methode bei **jedem** Rerun ruft, die überwältigende Mehrheit der Effects aber nie ein Kind hat. `collectDestroyChildEffects()` bleibt unangetastet — `destroy()` (`:1087`) ruft es mit eigener Fehlerliste, und dort ist der leere Fall kein heißer Pfad.
  3. **PERF-002, eine Zeile.** In `src/batch.ts`, `run()` (`:76`), als erste Anweisung:

     ```ts
     run() {
       if (this.delayedEffects.length === 0) return;

       const alreadyBeenCalled = new Set<symbol>();
       …
     ```

     Darüber ein kurzer Kommentar, der die Äquivalenz benennt: bei leerer Warteschlange laufen zwischen `beginIsolatedDelivery()` und `endIsolatedDelivery()` nur zwei `on()` und ihre Abmeldung, es kann nichts gesammelt werden, und der Rahmen ist von außen nicht beobachtbar. Und den Fall benennen, für den es sich lohnt: jeder Batch, dessen Writes keinen Effect erreicht haben — `SignalAutoMap.update()` auf unbeobachteten Props, ein `{batchWrites: true}`-Memo ohne Downstream-Effect, jedes defensive `batch()` im Anwendungscode. **`flush()` bleibt unverändert**: sein `finally` leert eine ohnehin leere Warteschlange, das ist der Nebenbefund aus Paket 12, den 15 geschlossen hat, und er bleibt geschlossen.
  4. **PERF-003, der Tiefenzähler.** In `src/batch.ts`, **oberhalb** von `class Batch` (nicht darunter — Biome nimmt beides an, aber der Leser der Klasse soll den Zustand vor sich haben, den ihre Methode führt):

     ```ts
     /*
      * How deep we are inside `Batch#run()`.
      *
      * A counter, not a flag, and it brackets *more* than the two temporary
      * subscriptions below, not less: an effect callback may open a batch of
      * its own, whose flush is a second, nested `run()` with its own dedup
      * set — while the outer flush's subscription is still live. A flag would
      * report "no flush" the moment the inner one closed, and every effect
      * that ran directly after that would go unrecorded and be run a second
      * time by the outer flush. A superfluous emit is free; a missing one is
      * a duplicate effect run.
      */
     let g_flushDepth = 0;

     /**
      * Whether a batch flush is currently delivering.
      *
      * The one reason `EffectImpl` emits on `globalEffectCalledQueue` at all:
      * that queue has exactly one subscriber, installed by `Batch#run()` for
      * the duration of a flush. Outside one, the emit walks eventize's
      * dispatch for zero listeners, on the hottest path in the library.
      * @internal
      */
     export const isFlushingBatch = (): boolean => g_flushDepth > 0;
     ```

     In `run()` das Inkrement **vor** `beginIsolatedDelivery()` setzen und das Dekrement **nach** `endIsolatedDelivery()`, in einem eigenen `finally`, damit ein Wurf aus dem Schließen des Rahmens den Zähler nicht stehen lässt:

     ```ts
     const unsubscribe: VoidFunc[] = [];
     g_flushDepth++;
     const outerErrors = beginIsolatedDelivery();
     …
       } finally {
         try {
           endIsolatedDelivery(outerErrors, 'flushing a batch of signal writes');
         } finally {
           g_flushDepth--;
         }
       }
     ```

     Die Reihenfolge ist die Zusage: der Zähler steht, bevor das erste Abonnement existiert, und fällt, nachdem das letzte weg ist. Wer ihn enger legt, verliert Emits.
  5. **PERF-003, der Guard.** In `src/EffectImpl.ts` den Import auf `import {getCurrentBatch, isFlushingBatch} from './batch.js';` erweitern und den Emit auf `:544` umschließen:

     ```ts
     if (isFlushingBatch()) {
       emit(globalEffectCalledQueue, this.id, this.id);
     }
     ```

     **Die Position ist festgenagelt, nicht verhandelbar** (Anmerkung aus Paket 10 oben): der Emit bleibt zwischen `this.shouldRun = false;` und `const generation = ++this.#generation;`. Der achtzeilige Kommentar über dem Bump bleibt, wo er ist, und behält seinen Platz *hinter* dem Emit.
  6. **Die drei Bench-Baselines fortschreiben**, im Stil der vorhandenen Blöcke (die Dateien führen bereits eine datierte Vorher/Nachher-Historie aus Paket 12). Je ein neuer Absatz in `bench/signal-write.bench.ts`, `bench/memo.bench.ts` und `bench/batch.bench.ts` mit den **selbst gemessenen** Zahlen dieses Pakets, dem Hinweis auf isolierte Läufe (`-t`-Filter) und dem Satz, dass `signal write, no consumers` sich ohne Mechanismus bewegt hat und nicht als Wirkung gelesen werden darf. Die alten Blöcke bleiben stehen — sie sind Historie, und READ-009 (Paket 29) räumt dort auf, nicht dieses Paket. **Neue Bench-Fälle werden nicht angelegt**: die drei relevanten Formen (leerer Batch, Batch ohne erreichten Effect, Static-Deps-Rerun) fehlen zwar in `bench/`, aber ein Benchmark ist Wartungslast, und Paket 29 entscheidet über den Zuschnitt der Suite. Der Messaufbau dieses Pakets liegt im Scratchpad und wird im Report benannt.
  7. **Die `batchWrites`-Begründung an sechs Stellen umschreiben** — die Aufgabe, die Paket 15 ausdrücklich hierher gegeben hat. Neue Aussage, überall in der jeweiligen Länge: der Allokations-Sockel ist weg (ein `{batchWrites: true}`-Memo **ohne** Downstream-Effect kostet gemessen nichts mehr gegenüber dem Default); was bleibt, ist ein vollständiger Flush, sobald das Memo einen Downstream-Effect hat — gemessen rund **3×** je Recompute —, und der lohnt sich erst, wenn ein Recompute denselben Effect sonst mehrfach auslösen würde. Genau deshalb bleibt der Default `false`. Die Stellen:
     - `src/createMemo.ts:33-42` (der Absatz »That grouping costs an allocation, and that is now the whole price …«)
     - `docs/api.md:299` (Tabellenzelle, »costs an allocation«)
     - `docs/api.md:312-316` (der Absatz »That grouping costs an allocation …«)
     - `docs/recipes.md:322-327` (»at a cost that is now purely an allocation …«)
     - `docs/cheat-sheet.md:82-85`
     - `skills/using-signalize/references/api.md:139-144`

     Was **nicht** angefasst wird: die Absätze über die Lesefrische composed memos (ASYNC-003, Paket 15) und die beiden Grenzen W1/W2. Die sind von diesem Paket unberührt.
  8. **Die kleinen Stellen und der CHANGELOG.**
     - `AGENTS.md:48` und `docs/architecture.md:61`: die Zelle `globalEffectCalledQueue | Batch deduplication (tracking)` bekommt den Halbsatz, dass darauf **nur während eines Flushs** emittiert wird.
     - `src/batch.ts:185-187`: in den Kommentar über `let errors` die gemessene Zahl aufnehmen (10 bis 12 % des verbleibenden `batch()`-Preises nach dem Early Return). Damit ist der Nebenbefund aus Paket 12 mit einer Begründung geschlossen statt mit einem Verweis.
     - `CHANGELOG.md`, unter `## Unreleased` eine **neue Rubrik `### Performance`** hinter `### Bug Fixes` — keine der vorhandenen passt, und ein Performance-Fix ist weder ein Bug Fix noch ein Chore. Vier Zeilen, eine Zeile ein Fakt:
       - Ein Effect-Rerun allokiert keine Fehlerliste mehr, wenn er keine Kindeffects hat (PERF-001)
       - Ein `batch()`, dessen Writes keinen Effect erreicht haben, überspringt den Flush vollständig — gemessen 663 ns → 50 ns für ein leeres `batch()` (PERF-002)
       - Ein Effect-Lauf außerhalb eines Batch-Flushs emittiert nicht mehr auf `globalEffectCalledQueue` (PERF-003)
       - Ein Signal-Write mit zehn abhängigen Effects läuft gemessen rund 50 % schneller; `{batchWrites: true}` kostet ohne Downstream-Effect nichts mehr
     - **Keine Breaking-Changes-Zeile.** Kein beobachtbares Verhalten ändert sich; das ist die Zusage dieses Pakets, und Schritt 1 von »Verify« ist ihr Beweis.
- Verify: sieben Schritte. Der Beweis ist zweiteilig — die Suite muss **dasselbe** melden, die Bench-Zahl muss sich **bewegen**.
  1. **Suite-Gleichstand, nach jedem einzelnen der drei Fixes und am Ende.** `pnpm test` meldet **45 Dateien / 551 Tests**, plus den einen neuen aus Schritt 1 des Vorgehens: **552**. Kein anderer Test darf sich bewegen — nicht bestanden/nicht bestanden, nicht Datei- oder Testzahl. Die Coverage-**Prozente** ändern sich zwangsläufig, weil Zeilen dazukommen; verglichen wird deshalb die Zahl der **ungedeckten** Einheiten, und die muss ziffergleich bleiben. Gemessen auf `8cc46e9`: `1187/1195` Statements, `493/517` Branches, `237/238` Functions, `1122/1128` Lines — also **8 / 24 / 1 / 6** ungedeckt. Mit allen drei Änderungen (ohne den neuen Test): `1198/1206`, `499/523`, `238/239`, `1130/1136` — **wieder 8 / 24 / 1 / 6**, bei +11 Statements, +6 Branches (die drei neuen `if`), +1 Function (`isFlushingBatch`) und +8 Lines, alle gedeckt. Weicht eine der vier Zahlen ab, ist ein neuer Zweig ungedeckt und die Tier-2-Auflage für `batch.ts` bricht ohnehin.
  2. **`pnpm world`**, alle neun Schritte grün. `bundle` ist hier nicht Zierde, sondern der Zyklustest für die Kante `EffectImpl.ts → batch.ts`.
  3. **Bench, vorher/nachher, nach dem Protokoll oben** — isolierte Läufe, `{time: 2000, warmupTime: 500}`, Median aus mindestens drei Wiederholungen, `hz` **und** `p75`. Erwartet, mit Toleranz nach unten (andere Maschine, andere Tageszeit): `signal write, fans out to 10` und `fans out to 100` je **+40 % oder mehr**, `fans out to 1` **+20 % oder mehr**, ein leeres `batch()` **unter 100 ns**, `memo`-Recompute mit `{batchWrites: true}` ohne Downstream-Effect **auf dem Niveau des Defaults**. **Nicht aussagekräftig und deshalb nicht zu berichten**: `signal write, no consumers` (kein Mechanismus, gemessen +13 % Streuung), `effect: create + destroy` (unberührt), `memo: {batchWrites: true} mit Downstream-Effect` (Flush läuft ohnehin), `batch() → 1 Effect` und `batch(10 Writes) → 1 Effect` (Kontrollfälle: sie dürfen sich nur **nicht verschlechtern**).
  4. **Mutationsprobe PERF-001** — und sie ist **kein roter Test**, sondern eine zurückfallende Zahl. Die eine Zeile entfernen, `pnpm test` fahren: die Suite bleibt **grün**, das ist der Beweis der Äquivalenz. Dann isoliert `pnpm bench signal-write -t "fans out to 10"`: der Wert muss auf das Baseline-Niveau zurückfallen. Beide Hälften gehören in den Report, die grüne wie die langsame.
  5. **Mutationsprobe PERF-002** — dieselbe Form: Zeile raus, Suite grün, `batch(() => {})` zurück über 500 ns. Zusätzlich die **Zähne-Probe**, die belegt, dass der Zweig überhaupt gefahren wird: aus dem Early Return ein `throw new Error('EMPTY-FLUSH')` machen — erwartet **19 rote Tests in 7 Dateien** (`SignalAutoMap.spec.ts`, `batch.spec.ts`, `createMemo.spec.ts`, `createSignal.destroySignal.spec.ts`, `effects.noAutorun.spec.ts`, `hibernate.spec.ts`, `ordering.property.spec.ts`). Weniger heißt, dass etwas den leeren Flush nicht mehr erreicht.
  6. **Mutationsprobe PERF-003, drei Teile.** (a) Den Emit ersatzlos streichen: erwartet genau **1** roter Test, `src/effects.priority.spec.ts > prioritized memos should run before others` — der Guard darf den Emit im Flush nicht verlieren. (b) Den Tiefenzähler durch ein Flag ersetzen (`g_flushDepth = 1` / `= 0`): erwartet genau **1** roter Test, der neue aus Schritt 1, mit `expected 2 to be 1`. Ohne diesen neuen Test bleibt die Suite hier grün — auf `8cc46e9` nachgemessen. (c) Den Guard auf `if (true)` festnageln (also die Wirkung zurücknehmen): Suite grün, und `signal write, fans out to 10` fällt zurück.
  7. **`git status --porcelain --untracked-files=all`** — nur die im Feld `Dateien` genannten. Keine Bench-Sonde, kein `zz-`-Rest, kein `EMPTY-FLUSH`, kein `console.log`. Der Messaufbau lebt im Scratchpad und bleibt dort.
- Commit: `perf: skip the three things the hot path never needed (PERF-001, PERF-002, PERF-003)`

<details>
<summary>Die drei Findings im Volltext (aus <code>audit.html</code>)</summary>

**PERF-001** · Performance · code · **high** · effort S · status `carried-over`

**Kein Fehler-Array mehr bei jedem Effect-Lauf allokieren**

Location: `src/EffectImpl.ts:633-637 · src/EffectImpl.ts:430`

> `run()` ruft `destroyChildEffects()` bedingungslos, und die Methode allokiert ein frisches `errors: unknown[]` und ruft `throwCollectedErrors()` auch dann, wenn `childEffects` leer ist — was für die überwältigende Mehrheit der Effects bei jedem einzelnen Rerun gilt. Ein CPU-Profil über 3 Mio. Reruns verortet 5,8 % der Samples allein in `collectDestroyChildEffects`. Ein `if (this.childEffects.length === 0) return;` ist exakt äquivalent und kauft 13 % auf dem dynamischen und 38 % auf dem Static-Deps-Pfad.

> Empfehlung: Aus `destroyChildEffects()` früh zurückkehren, wenn `childEffects` leer ist. `collectDestroyChildEffects()` bleibt unangetastet — `destroy()` ruft es mit eigener Fehlerliste.

> Evidence:
> ```
> === lib (Baseline)                     === mit Early Return
> set -> 1 dynamischer Effect  5,34 Mops/s   6,02 Mops/s  (+12,7 %)
> set -> Static-Deps-Effect    8,84 Mops/s  12,18 Mops/s  (+37,8 %)
>
> CPU-Profil, 3M Reruns + 300k Batches, Self Time:
>  21,4 %  run @ EffectImpl.js:115
>  14,5 %  whenSignalIsRead @ EffectImpl.js:181
>   5,8 %  collectDestroyChildEffects @ EffectImpl.js:237
> ```

---

**PERF-002** · Performance · code · **high** · effort S · status `carried-over`

**Den Batch-Flush überspringen, wenn nichts aufgeschoben wurde**

Location: `src/batch.ts:33-62 · src/batch.ts:28-31`

> `Batch#run()` allokiert bedingungslos ein `Set`, ein Array und installiert plus entfernt zwei Catch-all-Subscriptions — auch wenn `delayedEffects` leer ist, was für jeden Batch gilt, dessen Writes keinen einzigen Effect erreicht haben. Das ist der Normalfall für `SignalAutoMap.update()` auf unbeobachteten Props, für ein `{batchWrites: true}`-Memo ohne Downstream-Effect und für jedes defensive `batch()` im Anwendungscode. Ein leeres `batch()` kostet 367 ns; eine einzelne Zeile senkt es auf 10 ns.

> Empfehlung: Aus `Batch#run()` früh zurückkehren, wenn `this.delayedEffects.length === 0` — vor dem `Set`, dem Array und den beiden `on()`-Aufrufen.

> Evidence:
> ```
> === lib (Baseline)                    === mit Early Return
> batch() ohne Writes       367 ns/op       10 ns/op
> batch(1 Write), kein Effect 401 ns/op      30 ns/op
> batch(1 Write) -> 1 Effect  944 ns/op     985 ns/op
> batch(10 Writes) -> 1 Effect 1964 ns/op  1896 ns/op
> ```

---

**PERF-003** · Performance · code · **medium** · effort M · status `carried-over`

**Auf globalEffectCalledQueue nur während eines Batch-Flushs emittieren**

Location: `src/EffectImpl.ts:434 · src/batch.ts:44-46`

> Jeder Effect-Lauf emittiert seine ID auf `globalEffectCalledQueue`. Diese Queue wird nicht aus `src/index.ts` exportiert und hat im ganzen Paket genau einen Abonnenten — den temporären Catch-all, den `Batch#run()` für die Dauer eines Flushs installiert. Außerhalb eines Flushs läuft der Emit also durch die Zustellung von eventize für null Listener, auf dem heißesten Pfad der Bibliothek. Zusammen mit den beiden Early Returns oben sind das +27 % auf dem dynamischen und +63 % auf dem Static-Deps-Pfad, bei nachweislich unveränderter Dedup-, Nesting- und Prioritätssemantik.

> Empfehlung: Ein `isFlushingBatch()`-Prädikat aus `batch.ts` exportieren (Tiefenzähler um die Flush-Schleife) und den Emit damit absichern. `EffectImpl.ts` importiert bereits aus `batch.ts`, also keine neue Modulkante.

> Evidence:
> ```
> === Baseline                        === alle drei Guards
> set -> 1 dynamischer Effect  6,15 Mops/s   7,82 Mops/s  (+27 %)
> set -> Static-Deps-Effect   10,89 Mops/s  17,80 Mops/s  (+63 %)
>
> Verhaltensprüfung, byte-identische Ausgabe:
> dedup: Effect-Läufe im Batch = 1 | nested dedup: 1 | Prioritätsreihenfolge: high,low
> ```

</details>

- **Ergebnis (2026-08-11)** — Hash `8281c28`. Verify vom Orchestrator selbst gefahren: `pnpm world` in allen neun Schritten grün, 45 Dateien / **552 Tests** (551 plus der eine neue), `bundle` zyklenfrei trotz der Kante `EffectImpl.ts → batch.ts`.
- **Der Nachweis ist zweiteilig, und der wichtigere Teil ist die Semantik.** Bei einem Performance-Paket ist »die Suite ist grün« das erwartete Ergebnis, nicht der Beweis. Verglichen wurden deshalb nicht die Coverage-Prozente — die müssen sich bewegen, es kommen Zeilen dazu —, sondern die **ungedeckten Einheiten**: **8 / 24 / 1 / 6** vor und nach jedem einzelnen Fix, bei +11 Statements, +6 Branches, +1 Function und +8 Lines, alle gedeckt. Der Reviewer hat die Äquivalenz zusätzlich **am Code** nachvollzogen: der übersprungene Rumpf enthält nur eine nullmal laufende Schleife, ein `length = 0` auf einem leeren Array und ein `throwCollectedErrors([])`, das sofort zurückkehrt; der leere Isolations-Rahmen ist von außen nicht beobachtbar, weil keine der vier globalen Queues `retain()`t wird.
- **Wirkung, verschränkt A/B gemessen** (Median aus 5, Baseline und Fix wechseln innerhalb einer Sitzung): `fans out to 1` +20 %, `10` **+37 %**, `100` **+37 %**, leeres `batch()` **629 → 50 ns**, `batch(1 Write)` ohne Effect 5,9×, `{batchWrites: true}` ohne Downstream-Effect vom Faktor 3 auf **5 % Abstand zum Default**. Die Audit-Zusage (+27 % dynamisch, +63 % static) wird dynamisch übertroffen und auf dem Static-Pfad um ein Drittel verfehlt.
- **Das Messprotokoll war selbst ein Befund.** Der Implementierer hat gemessen, dass blockweise Bench-Läufe Nachbarfälle verschieben, und ist auf verschränkte A/B-Läufe umgestiegen — in `memo.bench.ts` liest derselbe Fall blockweise −10,2 % und verschränkt +18,6 %, eine Spanne von 29 Prozentpunkten, und ein **unberührter Kontrollfall** sieht blockweise um 6,3 % verschlechtert aus. Der Reviewer hat das nachgeprüft und **eingeschränkt**: für `signal-write.bench.ts` trägt die Drift nicht, dort war blockweise mit 1 bis 3 % Streuung das ruhigere Verfahren. Beide Absätze nennen jetzt je Datei das Verfahren, mit dem ihre Zahlen entstanden sind.
- **Der Tiefenzähler für PERF-003 hatte keinen Zeugen** — die Flag-Mutation ließ die Suite 551/551 grün. Der neue Test schließt das: grün ohne Fix, grün mit Fix, **rot unter der Flag-Mutation** als einziger. Der Reviewer hat bemerkt, dass ein Detail darin tragend ist: ohne den zusätzlichen inneren Effect liefe der verschachtelte Batch nach PERF-002 in den Early Return, ohne den Zähler anzufassen — der Test wäre dann auch unter der Mutation grün. Das steht jetzt als Kommentar daneben.
- `g_flushDepth` ist neuer Modulzustand, aber ohne Driftpfad: jeder Ausgang aus `run()` läuft durch das äußerste `finally`, das Dekrement steht hinter `endIsolatedDelivery()` in dessen eigenem `finally`. Und die Driftrichtung ist ausfallsicher — ein hängengebliebener Zähler kostet nur den Emit zurück, nie einen doppelten Effect-Lauf.
- **Runde 1 galt einem Befund, der genau das war, was das Audit anprangert.** Die neuen Baseline-Absätze in `bench/signal-write.bench.ts` trugen Zahlen aus Scratchpad-Kopien mit `{time: 2000}` — die Datei mit ihren eigenen Einstellungen liefert 31 bis 36 % andere Werte. **READ-009 in neu, in genau der Datei, in der READ-009 sitzt.** Alle drei Absätze tragen jetzt Zahlen aus der Repo-Datei selbst, je mit dem Verfahren daneben; und wo eine Zahl aus einem anderen Aufbau stammt — leeres `batch()`, Batch ohne erreichten Effect, beide gibt es in `bench/` nicht —, steht ausdrücklich dabei, dass sie von hier aus **nicht nachfahrbar** ist.
- Ebenfalls Runde 1: zwei ältere CHANGELOG-Zeilen trugen weiter die Allokations-Begründung, die PERF-002 gerade gegenstandslos gemacht hat — im selben `## Unreleased`-Block, der unter `### Performance` das Gegenteil sagt. Beide umgeschrieben. Der Plan hatte sechs Doku-Stellen genannt; es waren acht.
- **Die `batchWrites`-Begründung aus Paket 15 ist gefallen und ersetzt.** Der Allokations-Sockel ist weg; was bleibt, ist ein vollständiger Flush, sobald ein Downstream-Effect existiert — gemessen Faktor 2,83. Der Default bleibt `false`, aber aus einem anderen Grund als vor zwei Paketen.
- Der Nebenbefund aus Paket 12 ist geschlossen: das lazy allokierte Fehler-Array in `batch.ts` **bleibt** lazy. Die eager Fassung kostet nach PERF-002 gemessen rund 10 % des verbliebenen `batch()`-Preises; die Zahl steht jetzt im Kommentar.
- Die neue CHANGELOG-Rubrik `### Performance` ist vom Reviewer ausdrücklich als gerechtfertigt beurteilt — keine der bestehenden Überschriften passt auf eine reine Laufzeitverbesserung, und `Chores` würde eine nutzersichtbare Beschleunigung begraben.
- Nebenbefund für **Paket 30**: `PERF-001` bezeichnet im selben `## Unreleased`-Block jetzt zwei Dinge — unter `### Features` und `### Breaking Changes` die `batchWrites`-Option des Vor-Audits, unter `### Performance` die Fehlerliste. Und für **Paket 29**: dieselbe Kollision in `src/createMemo.spec.ts` sowie als »PERF-004« in `bench/memo.bench.ts` und `bench/batch.bench.ts`. Dazu: `bench/` enthält keinen Fall mit leerer Warteschlange — genau den Zustand, den PERF-002 adressiert.


#### [ ] 18. Die Isolations-Frame nur öffnen, wenn es etwas zu isolieren gibt
- Findings: PERF-008 (high)
- Ziel: Ein Write ohne Subscriber zahlt den Isolations-Sockel nicht mehr — über einen eigenen Zähler pro Signal-Id, nicht über eine Rückfrage an eventize.
- Bereich: `src/signal-core.ts`, `src/collect-errors.ts`
- Hängt ab von: Paket 13b (dort bekommt `destroySignal()` denselben Rahmen)
- Anmerkung (2026-08-10, aus Paket 13b): **Es sind zwei Zähler, nicht einer — und der zweite lohnt sich vermutlich nicht.** Die bisherige Formulierung (»der Zähler muss beide bedienen«) geht am Code vorbei: `writeSignal()` stellt auf `globalSignalQueue` zu, `destroySignal()` nach 13b auf `globalDestroySignalQueue`. Das sind zwei getrennte eventize-Instanzen mit zwei getrennten Abonnentenmengen pro Signal-Id, und keine Zahl der einen sagt etwas über die andere. Gemessen, wer je Id abonniert:
  - **`globalSignalQueue`**: `EffectImpl` (`on(…, signalId, priority, RECALL, this)`, `src/EffectImpl.ts:634`) und `SignalLink` (`on(…, this.source.id, …)`, `src/SignalLink.ts:118-129`) — zwei Sorten, wie in der Notiz aus Paket 11 unten.
  - **`globalDestroySignalQueue`**: `EffectImpl` (`once(…, signalId, $destroySignal, this)`, `:635`), `SignalLink` **zweimal** (`source.id` bei `:151`, `target.id` bei `:647`), `SignalGroup` (`:495`), `SignalAutoMap` (`:125`) und `createMemo` (`:123`) — **fünf** Sorten. Ein zweiter Zähler dafür müsste an sechs Stellen gebucht und an ebenso vielen Abbaupfaden gegengebucht werden.

  **Empfehlung des Planers von 13b: die Frame-Eröffnung in `destroySignal()` unbedingt lassen und PERF-008 auf `writeSignal()` beschränken.** `destroySignal()` ist kein heißer Pfad — es läuft einmal pro Signal im Leben des Signals, `writeSignal()` bei jedem `set()`. Der Sockel, den PERF-008 einspart, ist derselbe; die Häufigkeit unterscheidet sich um Größenordnungen, und der Buchhaltungsaufwand ist hier dreimal so groß.

  **Und eine harte Grenze für den Zähler, egal an welcher Queue.** Nach 13b hängt an einem offenen Frame mehr als eine Fehlersammlung: `EffectImpl[$destroySignal]` (und ebenso `[RECALL]`) parkt seinen Fehler nur, wenn `collectDeliveryError()` `true` liefert — sonst wirft er sofort und **beendet die Zustellung**. Ein Zähler, der zu niedrig steht, überspringt also nicht bloß eine Optimierung, er stellt BUG-011 beziehungsweise BUG-004 wieder her: alle Abonnenten hinter dem werfenden gehen leer aus. Der Zähler muss exakt sein, nicht konservativ in der falschen Richtung — und er muss vor der ersten Zustellung stimmen, nicht erst nach ihr. Die sechs Tests im Block `the destroy delivery is isolated, like a write (BUG-011)` fahren beide Seiten: fünf mit offenem Frame, `rethrows at the group when no delivery frame is open (soft-detach)` ohne. Ein zu eifriges Überspringen fällt dort auf — aber nur, weil dort ein Abonnent existiert; ein Zähler, der »null Abonnenten« falsch meldet, hat in dieser Datei keinen Zeugen.
- Anmerkung (2026-08-10, aus Paket 11): **Kein Schnitt, aber eine Aufrufstelle, die leicht übersehen wird.** Ein eigener Zähler pro Signal-Id muss von *jedem* Abonnenten auf `globalSignalQueue` bedient werden — und einer davon ist kein Effect, sondern `SignalLink`s Konstruktor (`src/SignalLink.ts:118-129`, `on(globalSignalQueue, this.source.id, …)`), gegengebucht in `destroy()` über `[$queueUnsubscribes]` und zusätzlich im Finalizer von `src/link.ts`. Wer nur `EffectImpl` verdrahtet, zählt für jede Quelle mit Link zu niedrig und überspringt die Isolations-Frame bei einem Write, der sehr wohl zugestellt wird. Paket 11 hat an dieser Buchung nichts geändert: die Zahl der Queue-Abos pro Link bleibt zwei (Callback-Ziel) beziehungsweise drei (Signal-Ziel).
- Anmerkung (2026-08-11, aus Paket 17): **Der Sockel, den du misst, ist nach 17 ein anderer — und dein Kronzeuge ist ausgerechnet der lauteste Benchmark.** Vier Punkte, alle gemessen.
  1. **Die Ausgangszahl bewegt sich.** Nach den drei Early Returns läuft `signal write, fans out to 1` mit 2,41 statt 1,90 Mops/s, `fans out to 10` mit 572 statt 371 kops/s. Der Isolations-Sockel, den PERF-008 einspart, ist damit ein *größerer* Anteil des verbleibenden Preises als zum Auditzeitpunkt. Die Zahlen aus dem Finding taugen als Richtung, nicht als Zielwert; **selbst messen** ist hier keine Kür.
  2. **`signal write, no consumers` ist genau dein Fall — und genau der Fall, der sich ohne Mechanismus bewegt.** Paket 17 hat ihn zweimal vor und zweimal nach den drei Fixes gemessen: 10,6 → 12,0 Mops/s (+13 %), obwohl bei diesem Benchmark kein einziger Effect existiert und keine der drei Änderungen auf dem Pfad liegt. Reines Code-Layout. Wer PERF-008 an dieser Zahl abnimmt, nimmt möglicherweise nichts ab. Das Protokoll aus 17 gilt hier doppelt: isolierte Läufe statt Volllauf der Datei (ein Nachbar-Benchmark verschiebt die Zahl gemessen um 20 %), `{time: 2000, warmupTime: 500}`, Median aus mindestens drei Wiederholungen, `hz` **und** `p75` ablesen. Ein `writeSignal()` ohne Abonnenten braucht zusätzlich einen Gegenfall mit genau einem Abonnenten im selben Lauf, sonst ist nicht zu unterscheiden, ob der Zähler wirkt oder die Halde.
  3. **Der Rahmen hat ab jetzt zwei bedingte Aufrufstellen, nicht null.** PERF-002 lässt `Batch#run()` bei leerer Warteschlange vor `beginIsolatedDelivery()` zurückkehren. Die Invariante »während einer Zustellung ist immer ein Rahmen offen« stimmt weiterhin — dort wird nichts zugestellt —, aber die Begründung dafür steht jetzt an zwei Stellen im Code und mit PERF-008 an einer dritten. Die harte Grenze aus der 13b-Notiz oben gilt für alle drei gleich: ein Rahmen, der fehlt, während doch jemand zuhört, stellt BUG-011/BUG-004 wieder her.
  4. **Und ein Formvorbild, kein Vorbild für die Buchhaltung.** 17 führt mit `g_flushDepth` in `src/batch.ts` einen zweiten Tiefenzähler nach dem Muster von `g_deliveryDepth` ein. Der ist *durch Konstruktion* exakt: er klammert einen lexikalischen Bereich, Inkrement und Dekrement stehen sechs Zeilen auseinander im selben `try`/`finally`. Dein Zähler ist das Gegenteil — Buchhaltung über sechs Anmelde- und ebenso viele Abmeldepfade hinweg. Das Muster ist übertragbar, die Sicherheit nicht.
- Modell: stärkste Stufe
- Hash: —

#### [ ] 19. Die selten benutzten Collections der SignalGroup lazy anlegen
- Findings: PERF-004 (medium)
- Ziel: Eine leere Gruppe kostet nicht mehr 2000 Bytes; sieben der neun Collections entstehen erst beim ersten Schreiben.
- Bereich: `src/SignalGroup.ts`
- Hängt ab von: Paket 9, Paket 14
- Anmerkung (2026-08-10, aus Paket 9): **Das Netz, das ab jetzt unter diesem Paket liegt.** Sieben der neun Collections entstehen künftig erst beim ersten Schreiben — betroffen ist damit alles, was sie *liest*, ohne dass jemand geschrieben hat. Drei Zusagen aus Paket 9 zeigen den Bruch sofort: `clear() emits DESTROY before it takes anything apart` prüft **alle sechs Felder** von `memberCounts` in einem `toEqual` (heute die einzige Stelle im Repo, die das im Vollstand tut) — ein `undefined.size` oder ein fehlendes Feld fällt dort auf, nicht erst beim Konsumenten; die drei `BUSY_*`-Tests laufen über `#namedSignals`, `#groups` und `#effects` einer Gruppe, die teils leer ist; und `getGroupMemberCounts()` (`src/__testing__/assert-helpers.ts:16`) plus `NO_GROUP_MEMBERS` sind der Vertrag, den eine lazy Allokation weiterhin mit **0** beantworten muss, nicht mit `undefined`. Dazu die drei Teardown-Reihenfolgen: eine Schleife über eine Collection, die es noch gar nicht gibt, ist der billigste Weg, eine davon still zu drehen.
- Anmerkung (2026-08-10, aus Paket 14): **Zwei der neun Collections werden ab jetzt aus einer Zustellung heraus geschrieben, und zwar als allererstes.** `#effects` und `#links` werden von den `once(…, DESTROY, Priority.Max, …)`-Hooks aus `attachEffect()` und `attachLink()` geleert. Nach Paket 14 hängen **beide** auf `Priority.Max` — das heißt, sie sind das Erste, was beim Zerstören eines Effects oder eines Links überhaupt läuft, vor jedem Anwendungs-Listener. Ein lazy angelegtes `#effects`, das an dieser Stelle noch `undefined` ist, wirft nicht bloß irgendwo: der Wurf steht am Kopf einer eventize-Zustellung, und eventize beendet die Zustellung am ersten werfenden Listener — jeder `DESTROY`-Listener der Anwendung ginge leer aus. Das ist derselbe Schadensmechanismus, gegen den Paket 14 angetreten ist, nur mit vertauschten Rollen. Zwei Folgerungen: die Collection muss existieren, sobald ihr Hook registriert ist (die Allokation gehört also an dasselbe `if`, das den Hook anlegt, nicht an einen Lesepfad), und der Hook ist ein `once()`, der auch **nach** einem `clear()` noch feuern kann — wer dort eine Collection freigibt statt sie zu leeren, baut genau diese Falle. Dazu kommt: `attachEffect()` wirft seit Paket 14 am Kopf, **bevor** es `#effects` anfasst; ein abgelehnter Attach darf keine Collection anlegen. Und die zwei neuen Tests in `src/SignalGroup.spec.ts` (MEM-009, CONS-006) lesen `getGroupMemberCounts(group).effects` an einer Gruppe, die *nur* einen Effect hält — die fünf übrigen Felder müssen dort mit **0** antworten, nicht mit `undefined`, ganz wie die Paket-9-Notiz oben es für den Vollstand verlangt.
- Anmerkung (2026-08-10, aus Paket 10): **Zwei Zusagen kommen dazu, und eine Lücke bleibt offen.** Dazu: `detachSignal() hands the name to the most recently bound candidate, not the first` (`src/SignalGroup.spec.ts`, TEST-025) fährt `#signals`, `#directSignals`, `#signalKeys`, `#namedSignals` und `#otherSignals` — fünf der neun Collections — durch Attach, Rebind und zwei Detaches und prüft am Ende die *Identität*, die ein Name liefert; ein lazy angelegtes `#otherSignals`, das auf dem Fallback-Pfad noch `undefined` ist, fällt dort und nicht erst beim Konsumenten. Und `the backstop leaves a group alone that is no longer registered` (`src/SignalGroup.teardown.spec.ts`, TEST-020) ruft `clear()` auf einer Gruppe, die schon abgeräumt ist — die Form, in der eine lazy Allokation sich beim zweiten Durchlauf neu anlegen und dabei werfen könnte. **Offen bleibt:** die beiden Stellen, die Paket 10 als nicht testbar gestrichen hat, liegen beide in dieser Datei — der Hüllen-`delete` im Ressourcen-Finalizer (`src/SignalGroup.ts:75-77`, samt der »Order is load-bearing«-Zusage bei `:56-58`) und die Ausnahme für selbstgeschlüsselte Gruppen (`:370-372`). Beide überleben ihre Entfernung auch nach Paket 10 folgenlos. Wer die Registrierungen im Konstruktor (`:358-372`) oder `[$groupResources]` anfasst, arbeitet dort ohne Netz und mit den Kommentaren als einziger Quelle.
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
- Anmerkung (2026-08-10, aus Paket 32): TYPE-002 (`set(fn)` ohne `{lazy:true}`) wird an `src/createSignal.lazy.spec.ts` verhandelt — der Datei, deren vier Altbestand-Tests bis Paket 32 je ein Signal stehenließen. Sie führt jetzt alle drei Zähler; wer dort Tests umschreibt, um eine Typänderung zu belegen, bekommt gesagt, wenn er dabei etwas liegenlässt.
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
- Anmerkung (2026-08-10, aus Paket 11): **Reihenfolge und Schnitt bleiben; die Berührung ist geringer, als der Dateiname vermuten lässt.** Paket 11 fasst in `src/SignalLink.ts` nur `nextValue()`, `asyncValues()` und `updateValue()` an, liest `source` nirgends neu und verändert die öffentliche Typfläche nicht: `nextValue(options?)` behält Signatur und Verhalten, die neue Fassung mit Cursor ist eine `#private`-Methode. Für dieses Paket heißt das zweierlei — die `LinkSource`-Sicht kann unverändert wie geplant an `readonly source` (`:72`) gesetzt werden, und der Cursor-Parameter bleibt privat: er ist Implementierung, keine schmale Sicht, und gehört nicht in die Typexporte. Neu unter diesem Paket liegt außerdem ein Wächter, der vorher fehlte — der TEST-022-Test zählt `getSubscriptionCount(link)` gegen eine Baseline, meldet also jedes zusätzliche oder verlorene Abo auf dem Link selbst.
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
- Hängt ab von: Paket 13a und 13b, Paket 18
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
- Anmerkung (2026-08-10, aus Paket 10): **Was das Netz ab jetzt schützt.** Die zerbrechlichste Zusage in `run()` ist nicht der Zustand, sondern die *Reihenfolge*: `const generation = ++this.#generation;` steht zwischen `runCleanupCallback()` und der Callback-Invokation, und nur dort bekommt ein äußerer Lauf, dessen Cleanup `run()` rekursiv betreten hat, die höhere Nummer. Seit Paket 10 fällt genau ein Test, wenn eine Zerlegung den Bump in eine andere Teilfunktion, vor den Cleanup oder hinter den Callback schiebt: `a cleanup that settles after the run it was superseded by does not take the slot` (`src/effects.async.spec.ts`). Der Nachbar `keeps the cleanup of the outer run when a cleanup re-enters the effect` sieht das gemessen **nicht** — wer beim Umbau nur ihn laufen lässt, hat nichts geprüft. **Nicht neu geschützt:** die Snapshot/Prune-Paarung von `#lostSignals`; die steht unverändert auf den BUG-005-Tests, die es schon gab.
- Anmerkung (2026-08-11, aus Paket 17): **Zwei Zeilen mehr in dem `try`-Block, den du zerlegst, und beide sind Zusagen.** Erstens steht der Emit auf `globalEffectCalledQueue` nach PERF-003 unter `if (isFlushingBatch())` — er bleibt zwischen `this.shouldRun = false;` und dem `#generation`-Bump, und sein Zweck ist an ein Zeitfenster gebunden, nicht an eine Stelle im Datenfluss: er zählt nur, solange `Batch#run()` liefert. Eine Zerlegung, die ihn in eine Teilfunktion schiebt, die *vor* oder *nach* dem Flushfenster läuft, macht ihn wirkungslos, ohne dass ein Test es meldet — der einzige Zeuge für den Emit überhaupt ist `src/effects.priority.spec.ts > prioritized memos should run before others`, und der prüft die Wirkung, nicht den Ort. Zweitens kehrt `destroyChildEffects()` nach PERF-001 bei leerer Kinderliste sofort zurück; wer die Methode beim Zerlegen inlinet oder in einen »teardown«-Schritt zusammenfasst, trägt den Early Return mit, sonst kommen 5,8 % der Samples zurück, die dieses Paket entfernt hat. Beide Änderungen sind je eine Zeile und beide sind in `pnpm bench` sichtbar, in keinem Test.
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
- Bereich: `bench/signal-write.bench.ts`, `src/link.ts`, `src/SignalLink.ts`, `src/EffectImpl.ts`, `src/signal-core.ts`, `scripts/publishPackage.cjs`, `CLAUDE.md`, `CONTRIBUTING.md`, `AGENTS.md`, `README.md`, `docs/architecture.md`
- Hängt ab von: Paket 27 (die Kommentare in `EffectImpl.run()` entscheiden sich dort)
- Zusätzlich aufgenommen (2026-08-09, aus Paket 2): `scripts/publishPackage.cjs:2` trägt `/* eslint-disable no-console */`, obwohl ESLint seit v0.28 aus dem Projekt raus ist — dieselbe Klasse toter Angabe wie der Rest des Pakets. Der `packageManager`-Widerspruch aus dem Nebenbefund von Paket 1 (`package.json` sagt `pnpm@11.20.0`, `CLAUDE.md:11` sagt `pnpm@11.17.0`) gehört ebenfalls hierher; `CLAUDE.md` steht bereits im Bereich.
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

Alle 71 Findings des Scopes sind genau einem Paket zugeordnet. `✓` = geschlossen und committet.

| Paket | Findings | |
| --- | --- | --- |
| 1 | BUILD-003 | ✓ |
| 2 | BUILD-002, BUILD-010 | ✓ |
| 3 | BUILD-015, BUILD-016 | ✓ |
| 4 | BUILD-001, BUILD-006, ARCH-004 | ✓ |
| 5 | BUILD-004, BUILD-011, BUILD-005, BUILD-007 | ✓ |
| 6 | BUILD-009 | ✓ |
| 7a/7b/7c1/7c2 | TEST-017 | ✓ |
| 8 | TEST-016, TEST-021 | ✓ |
| 9 | TEST-018, TEST-019 | ✓ |
| 10 | TEST-020, TEST-023, TEST-024, TEST-025 | ✓ |
| 32a/32b | — (Nebenbefund aus 7a, kein Finding) | ✓ |
| 11 | ASYNC-005, READ-002, TEST-022 | ✓ |
| 12 | ASYNC-001, BUG-012 | ✓ |
| 13a | READ-001 | ✓ |
| 13b | BUG-011, MEM-008 | ✓ |
| 31 | — (P1, P2, kein Finding) | ✓ |
| 14 | MEM-009, MEM-010, MEM-011, CONS-006 | ✓ |
| 15 | ASYNC-002, ASYNC-003 | ✓ |
| 16 | API-014, CONS-007 | ✓ |
| 17 | PERF-001, PERF-002, PERF-003 | ✓ |
| **18** | **PERF-008** | offen |
| **19** | **PERF-004** | offen |
| **20** | **TYPE-001, TYPE-003** | offen |
| **21** | **TYPE-002, TYPE-005, TYPE-004** | offen |
| **22** | **API-001, API-003, API-002, API-004** | offen |
| **23** | **API-006, API-007, API-008** | offen |
| **24** | **CONS-001** | offen |
| **25** | **ARCH-003, ARCH-001** | offen |
| **26** | **ARCH-002** | offen |
| **27** | **READ-011** | offen |
| **28** | **API-005, API-009, API-010, API-015** | offen |
| **29** | **READ-009, READ-010, READ-012, CONS-010** | offen |
| **30** | **CONS-008, CONS-009, API-016** | offen |

## Commit-Verlauf

Alle Commits dieses Laufs, jüngster zuerst. `12879f7` ist der Startpunkt.

| Hash | Paket | Commit |
| --- | --- | --- |
| `8281c28` | 17 | perf: three early returns on the hottest path |
| `8cc46e9` | 16 | fix: make two API promises hold |
| `34aec18` | 15 | fix(batch): carry out an explicitly requested run, and read memos fresh |
| `0455fc9` | 14 | fix: armour the bookkeeping hooks against a throwing listener |
| `dd27974` | 31 | fix: take the creation back when the first run throws |
| `daed7c4` | 13b | fix: isolate the destroy delivery and guard every teardown step on its own |
| `8d4f615` | 13a | refactor: fold the error-collecting idiom into a helper |
| `e10c51e` | 12 | fix: restore both frames that must survive a throwing callback |
| `12759eb` | 11 | fix(link): stop asyncValues() from replaying the retained value at itself |
| `774a9ac` | 32b | test: widen every spec's counter guards to all three resource kinds |
| `454eb94` | 32a | test: bring the five guard-less specs under the net |
| `de36cf0` | 10 | test: cover the untested half of the core logic |
| `8ae6708` | 9 | test: pin down the SignalGroup re-entrancy guards and its teardown order |
| `537dd6c` | 8 | test: pin down the two unguarded save/restore frames |
| `7b1949e` | 7c2 | test: tear down SignalGroup teardown and gc resources in a finally |
| `c04a915` | 7c1 | test: tear down SignalGroup resources in a finally |
| `ef150a9` | 7b | test: clean up per test in a finally — signals, effects, decorators |
| `e9904d0` | 7a | test: clean up per test in a finally — links and SignalAutoMap |
| `ce25766` | 6 | build: lower the engines.node floor to >=22 and prove it in CI |
| `91ab044` | 5 | build: ship JSDoc, hide internals, stop emitting maps that point nowhere |
| `5f4c363` | 4 | build: decide the tarball contents with a files allowlist |
| `c65deb4` | 3 | test: make the coverage thresholds and the GC suites fail |
| `8041bd1` | 2 | ci: run the full gate on pull requests and on main |
| `2dc2833` | 1 | build: type-check specs, benchmarks and configs with a real tsc pass |
| `12879f7` | — | docs: record the 2026-08-08 follow-up audit and its remediation plan |
