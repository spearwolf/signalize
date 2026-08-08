# Remediation-Plan — @spearwolf/signalize

Quelle: ./audit.html vom 2026-08-07 · Branch: `main` · erstellt: 2026-08-07
Baseline: check ✓ · compile ✓ · test ✓ (377 passed, 9 skipped, Branch 89,9 %) · test:gc ✓ (386 passed) · bundle ✓
Scope: 32 von 108 Findings — alle `TEST-*` (15), `BUG-*` (10), `MEM-*` (7), inklusive der vier `info`-Findings
Ausgenommen: `ASYNC-*`, `PERF-*`, `BUILD-*`, `API-*`, `TYPE-*`, `ARCH-*`, `CONS-*`, `READ-*`, `DEP-*`, `DX-*`, `IMPL-*`, `SEC-*`, `INF-*` — 76 Findings, vom Nutzer nicht beauftragt
`acknowledged` im Audit: leer

Die Reihenfolge der drei Sprints ist vom Nutzer vorgegeben: erst TEST, dann BUG, dann MEM.

## Entscheidungen

- Alle vier `info`-Findings (MEM-006, MEM-007, TEST-014, TEST-015) bleiben im Scope (2026-08-07)
- Implementiert werden TEST-008 (dist/-Smoke-Test), TEST-012 (fast-check Property-Tests) und MEM-005 (Dev-Mode-Warnung) (2026-08-07)
- TEST-013 (Browser-Smoke-Test) wird **nicht** gebaut; stattdessen wandert der bewusste Verzicht als dokumentierte Entscheidung nach `AGENTS.md` (2026-08-07)
- BUG-004: Effect-Callbacks werden isoliert, alle Geschwister laufen fertig, danach wirft der Write die gesammelten Fehler (`AggregateError` bei mehreren). `set()` wirft weiterhin — nur nach vollständiger Zustellung statt mittendrin (2026-08-07)
- MEM-003: Die Gruppenwurzeln werden jetzt auf `WeakRef` umgebaut, statt beim dokumentierten Vorbehalt aus `b23c22f` zu bleiben (2026-08-07) — **überholt durch die Korrektur vom 2026-08-08 zwei Punkte weiter unten**; die dortige Rückfrage ist beantwortet, Weg A ist freigegeben.
- BUG-001: primäre Empfehlung — nach `action(value)` erneut `isDestroyed` prüfen. `Object.freeze(this)` bleibt (2026-08-07)
- BUG-010: primäre Empfehlung — `beQuiet<T>()` gibt das Ergebnis zurück (rückwärtskompatible Erweiterung von `void` auf `T`); das Rezept bleibt, wie es ist (2026-08-07)
- MEM-006 / MEM-007: primäre Empfehlung — Code-Korrektur über `FinalizationRegistry` bzw. `globalDestroySignalQueue`, nicht nur Doku (2026-08-07)
- **MEM-003, Korrektur der Entscheidung vom 2026-08-07** (2026-08-08): Der Planer von Paket 15 hat die Empfehlung des Audits wörtlich umgesetzt und gemessen — **sie bewegt keine einzige Zahl.** Fall B bleibt bei 500 überlebenden Hosts, der Dekorator-Fall bei 1000, auch bei vollständig entferntem `FinalizationRegistry` und `store`. Die Ursache liegt woanders als im Finding beschrieben: `src/EffectImpl.ts:319` registriert jeden Effect unbedingt auf `globalEffectQueue` mit der Instanz als Listener, jeder lebende Effect ist damit selbst eine GC-Wurzel, und seine Callback-Closure hält den Host (gemessen ohne jede Gruppe: 200 freie Effects, `groups=0`, 200/200 Hosts überleben; nach `destroy()` 0/200). Der Nutzer hat **Weg A** gewählt: die drei Modul-Wurzeln werden schwach gehalten plus ein zweiter Finalizer auf der Gruppe — gemessene Wirkung Dekorator-Fall 1000 → 0 und 2000 hängende Destroy-Queue-Subscriptions → 0. Fall B bleibt und wird als benannte Grenze dokumentiert, mit der gemessenen statt der vermuteten Ursache. Der Weg über schwache Effect-Listener ist verworfen: er kostet den Reaktivitätsvertrag (ein `createEffect(cb)` ohne aufgehobenes Handle hört nach dem nächsten GC auf zu laufen).
- **Reihenfolgeänderung** (2026-08-08): **Paket 16 läuft vor Paket 15.** Weg A lässt eine still eingesammelte Gruppe ohne `clear()` zurück; ohne die Selbstkorrektur des Signalzählers aus MEM-006 stünde `getSignalsCount()` zu hoch, und `assertSignalsCount()` steht in fast jeder Spec-Wache. Die Paketnummern bleiben, wie sie sind.
- **MEM-007, Folge der Entscheidung vom 2026-08-07** (2026-08-08): Der Fix ändert eine dokumentierte Rückgabe. `SignalAutoMap#delete(key)` meldet für einen von außen zerstörten Eintrag ab jetzt `false` statt `true` — der Eintrag ist zum Zeitpunkt des Aufrufs schon weg. Die `Map.prototype.delete`-Semantik bleibt unangetastet, nur die Vorbedingung entfällt. Die Zeile aus MEM-009 (»still removes the entry and reports `true`«) beschreibt das Symptom, das MEM-007 beseitigt; sie wird an fünf Stellen nachgezogen (Paket 16, Schritt 22).
- **Scope-Erweiterung um genau ein Finding:** `BUILD-008` (`pnpm checkPkgTypes` endet mit Exit 1, weil `attw` node10 und CJS prüft, die ein ESM-only-Paket bewusst nicht bedient) wird in Paket 6 mitgenommen — `attw --pack --profile esm-only` plus ein CI-Schritt hinter dem Smoke-Test. Begründung: Paket 6 prüft die `exports`-Map und die `.d.ts` zur Laufzeit, `attw` prüft dieselben zwei Artefakte statisch; getrennt wäre die Hälfte der Zusicherung ohne Prüfer geblieben. Scope damit 33 Findings (2026-08-07)

## Vorbestehende Fehler

Keine. Die Baseline ist auf allen fünf Kommandos grün.

## Querbezüge, die während des Laufs gelten

- Jede benutzersichtbare Änderung bekommt eine Zeile unter `## Unreleased` im `CHANGELOG.md` — Projektregel aus `CLAUDE.md`.
- Pakete, die Teardown- oder GC-Pfade berühren (8, 9, 10, 11, 13, 14, 15, 16), sind erst mit `pnpm world` **und** `pnpm test:gc` verifiziert.
- Paket 5 friert Coverage-Schwellen pro Datei ein. Die Sprints 2 und 3 dürfen nicht darunter fallen; beim Abschluss wird der Ist-Stand gegen die Schwellen gegengeprüft.
- Sprint-1-Tests an `SignalGroup.off()` (Paket 2) und an den Effect-Pfaden können in Sprint 2 nachziehen müssen, wenn BUG-003 und BUG-004 das Verhalten ändern. Das ist erwartet, kein Regressionsbefund. — **Eingelöst, für beide Findings ohne eine einzige Nachführung** (2026-08-07): Paket 10 hat alle 427 vorhandenen Tests unverändert grün gelassen, Paket 11 alle 439 (gemessen mit eingebautem Fix, siehe dort Schritt G). Die Ankündigung ist damit erledigt; wird ein Test dieser Dateien in Sprint 2 rot, ist es ein Regressionsbefund.
- Paket 4 schärft den ASYNC-005-Test auf dem geteilten Retain-Slot von `asyncValues()`. Paket 14 (MEM-004) baut genau diesen Mechanismus um — `src/SignalLink.ts:282` und der `finally`-Block `:312-317`. Wird der Test dort rot, ist das ein Regressionsbefund an der Geschwister-Zusage, keine erwartete Nachführung: der Makrotask-Marker schlägt ausschließlich bei einem hängenden Read an (2026-08-07). — **Eingelöst, ohne eine einzige Nachführung** (2026-08-07, beim Abgleich von Paket 14 mit eingebautem Fix gemessen): der ASYNC-005-Test ist grün, wie alle 454 vorhandenen. Paket 14 baut seinen MEM-004-Regressionstest trotzdem bewusst anders: er schreibt **nach** dem letzten Iterator und behauptet, dass nichts hängen bleibt. — **Korrektur (2026-08-07, vom Reviewer von Paket 14 gemessen): der Nebenbefund aus Paket 4 ist durch Paket 14 erledigt.** Er lautete, der ASYNC-005-Test könne seine Kernbehauptung nicht widerlegen, weil `retainClear()` nur den Wert löscht und die Retain-Policy stehen lässt. Genau das behebt MEM-004: seit dem Wechsel auf `unretain` tötet der Mutant `#activeAsyncValuesCount === 0` → `>= 0` den ASYNC-005-Test **isoliert** (`expected 'TIMEOUT' to deeply equal {value: 3, done: false}`), während er auf `HEAD` grün bleibt. Der Test hat seine Zähne bekommen, statt sie zu behalten.
- Paket 2 fasst `src/SignalGroup.ts` an (nur der `@internal`-Testzugang `$setParentGroup`, additiv, ohne Verhaltensänderung). Die Pakete 12 und 15 arbeiten später in derselben Datei; eine Reihenfolgeabhängigkeit entsteht dadurch nicht, weil Paket 2 vor beiden liegt und nichts von dem berührt, was sie ändern (2026-08-07).
- Paket 5 stellt die Schwellen auf `perFile: true` und staffelt sie in drei Stufen. **Luft** haben danach: `EffectImpl.ts` (Pakete 9, 10, 11) bei Zweigen — heute 4 von 91 ungedeckt, erlaubt sind 13 — sowie je ein zusätzliches ungedecktes Statement und eine Zeile; `SignalGroup.ts` (11, 12, 14, 15) mit 2 weiteren Statements, 3 Zweigen und 3 Zeilen; `createSignal.ts` mit 5 weiteren Zweigen. **Keine Luft** haben: `signal-core.ts` bei Zweigen (12/14 = 85,71 % gegen die 85-%-Stufe — jeder neue ungedeckte Zweig kippt sie, betrifft Paket 10 und 16), `EffectImpl.ts` und `link.ts` bei Funktionen (jede neue Funktion muss von einem Test aufgerufen werden, betrifft 9, 10, 11, 13) und `SignalLink.ts` (Pakete 8, 13, 14), das auf Statements, Funktionen und Zeilen bei 100 % steht und nur zwei ungedeckte Zweige verträgt (2026-08-07).
- Stößt ein späteres Paket an eine dieser Schwellen, **ohne** dass ein Test fehlt — ein Verteidigungszweig, der sich nicht auslösen lässt —, wandert die betroffene Datei aus Stufe 2 oder 3 in die globale Stufe 1, mit einer Begründungszeile im Detailplan des betroffenen Pakets. Was nicht passiert: die Schwelle still absenken. Nach Paket 16 wird gegengemessen und werden alle drei Stufen auf den dann erreichten Stand nachgezogen (2026-08-07).
- Ab Paket 5 enthält `pnpm world` den Schritt `test:gc`, und `pnpm test` führt die neun GC-Tests selbst aus. Für die Pakete 8 bis 16 lautet die Verify-Zeile damit `pnpm world` allein; der Zusatz `&& pnpm test:gc` aus der Zeile weiter oben bleibt richtig, ist aber redundant (2026-08-07).
- **Paket 6 und Paket 7 teilen keine Struktur.** Der Smoke-Test aus Paket 6 läuft bewusst ohne Vitest (`tsc` + `node --test`, Verzeichnis `smoke/`), weil jede Transform-Pipeline zwischen Quelle und Artefakt genau das verfälscht, was er messen soll. Die fast-check-Property-Tests aus Paket 7 sind gewöhnliche Specs in `src/` und laufen im `unit`-Projekt mit. Keine Reihenfolgeabhängigkeit, keine gemeinsame Konfiguration; die einzige Berührung ist `package.json` — Paket 6 ändert Skripte, Paket 7 die `devDependencies` (2026-08-07).
- **Ab Paket 6 enthält `pnpm world` die Schritte `test:smoke` und `checkPkgTypes`.** Die Verify-Zeile `pnpm world` der Pakete 8 bis 16 prüft damit ohne weiteres Zutun mit, ob eine Änderung an `src/` das Bundle, die `exports`-Map oder die ausgelieferten Deklarationen bricht — der Smoke-Fixture wird gegen `lib/*.d.ts` typgeprüft und gegen `dist/` ausgeführt, `attw` beschreibt dieselben Artefakte statisch. Reißt er in einem dieser Pakete, ist das ein Befund am Artefakt, keine erwartete Nachführung. Kein Paket muss dafür seine Verify-Zeile ändern (2026-08-07).
- **CI-Reihenfolge, ab Paket 6 bindend:** `pnpm clean` löscht `coverage/`, und `pnpm dist` ruft `clean`. Jeder Schritt in `.github/workflows/ci.yml`, der baut, gehört deshalb **vor** `pnpm test` — dahinter nimmt er dem abschließenden `Publish coverage summary`-Schritt seine Datei weg. Gilt für alles, was später noch in diese Datei kommt (2026-08-07).

- **Paket 7 spannt ein Reihenfolge-Netz unter die Pakete 9, 10 und 11.** Die sieben Properties benutzen ausschließlich lesende, nicht werfende Effect-Callbacks, keine Static Deps und keine `SignalGroup` — also genau die drei Dinge nicht, die Sprint 2 ändert. Keine der sieben kann durch BUG-003, BUG-004, BUG-005, BUG-006 oder BUG-007 **erwartbar** rot werden; wird eine rot, ist das ein Regressionsbefund an der Reihenfolge-Zusage, keine erwartete Nachführung. Umgekehrt erbt Paket 10 eine fertige Prüfstelle: P1 (»jeder auf das geschriebene Signal abonnierte Effect läuft genau einmal, in monoton fallender Priorität«) ist wörtlich die Aussage, die BUG-004 für den Fall eines werfenden Geschwisters erst herstellt — die Erweiterung um einen werfenden Callback gehört dann in `src/ordering.property.spec.ts`, nicht in eine neue Datei (2026-08-07).
- **Was die Pakete 13 und 14 von Paket 8 erben.** Beide fassen `src/SignalLink.ts` an, nachdem Paket 8 dort drei Stellen umgebaut hat (2026-08-07):
  - **Zeilennummern verschieben sich.** Paket 8 fügt ein privates Feld hinter `#activeAsyncValuesCount` ein und schreibt `destroy()` und `updateValue()` samt Kommentaren neu. Die im Plan genannten Fundstellen von MEM-004 (`:282` für `retain(this, VALUE)`, der `finally`-Block `:312-317`) rutschen um die Länge des neuen Feldblocks nach unten; die Fundstellen in `destroy()` und `updateValue()` verschieben sich zusätzlich. Paket 13 und 14 machen ihren eigenen Abgleich über die Symbolnamen, nicht über die Zeilen aus dem Audit.
  - **`destroy()` setzt `isDestroyed` jetzt als Erstes** (BUG-002), direkt hinter dem Guard. Alles, was Paket 13 (Finalizer meldet Queue-Subscriptions ab) und Paket 14 (Gegenkante zur Gruppe, Retain-Abschaltung) in diesen Teardown hängen, läuft also mit bereits gesetztem Flag. Zwei Folgen: ein neuer Schritt im Teardown darf sich nicht darauf verlassen, dass `isDestroyed` noch `false` ist, und ein DESTROY-Listener, der `link.attach(obj)` ruft, wirft jetzt (`SignalGroup.attachLink()` lehnt zerstörte Links ab) — relevant für die MEM-002-Gegenkante, die genau in einem DESTROY-Listener sitzt.
  - **`updateValue()` schreibt nach `action()` nichts mehr, wenn der Link tot ist** (BUG-001). Damit fällt ein Pfad weg, der heute den geteilten VALUE-Retain-Slot **nach** dem `retainClear(this, VALUE)` in `destroy()` wieder befüllt: ein Link, den sein eigener Callback zerstört, emittiert anschließend kein VALUE mehr. Das erledigt MEM-004 **nicht** — der Kern des Findings ist, dass `retainClear()` nur den Wert löscht und nicht die Retain-Policy, und das bleibt unverändert —, nimmt aber eine Störquelle aus jedem Regressionstest, den Paket 14 auf dem Retain-Slot baut.
  - Kein Finding aus 13 oder 14 wird durch Paket 8 gegenstandslos, und keines der offenen Pakete 9 bis 12, 15, 16 berührt `SignalLink.ts`. Die Reihenfolge der Restliste bleibt, wie sie ist.
- **Was die Pakete 10 und 11 von Paket 9 erben.** Beide fassen `src/EffectImpl.ts` an, nachdem Paket 9 dort drei Stellen umgebaut hat (2026-08-07):
  - **Zeilennummern verschieben sich, und zwar zweistufig.** Paket 9 fügt eine Import-Zeile ein (`isQuiet` aus `./bequiet.js`, hinter Zeile 10) und schreibt den `else`-Zweig in `run()` sowie `storeCleanupCallback()` neu. Alles oberhalb von `run()` rutscht um **+1**, alles zwischen `run()` und `storeCleanupCallback()` um **+11**, alles darunter um **+16**; die Datei wächst von 843 auf 859 Zeilen. Gemessen: `saveSignalsFromDeps()` 331 → 332, `createEffect()`s `effect.saveSignalsFromDeps()` 387 → 388, `run()` 409 → 410, `[RECALL]()` 511 → 522, `whenSignalIsRead()` 518 → 529, `[$destroySignal]()` 536 → 547, `destroyWhenUntriggerable()` 586 → 597, `hasNoLiveSignals()` 612 → 623, `cleanupLostSignals()` 616 → 627, `storeCleanupCallback()` 710 → 721, `destroy()` 801 → 817. Paket 10 und 11 machen ihren Abgleich über die Symbolnamen, nicht über die Zeilen aus dem Audit. Neue Felder gibt es **keine** — `isTracking` ist eine lokale `const` im Rumpf von `run()`; neu ist genau eine private Methode, `acceptCleanupCallback()`, zwischen `storeCleanupCallback()` und `runCleanupCallback()`.
  - **Der dynamische Zweig von `run()` hat jetzt eine Reihenfolge, die man nicht mehr frei erweitern kann.** Der Callback-Aufruf steckt in einem `try`, das Abräumen der verlorenen Signale im zugehörigen `finally`, und beide Hälften hängen an derselben lokalen `const isTracking`. Wer dort einen Schritt ergänzt, entscheidet zuerst, ob er zum Lauf gehört (`try`) oder zur Buchführung danach (`finally`) — und ob er im Quiet-Frame überhaupt stattfinden darf. Der `hasStaticDeps()`-Zweig daneben bleibt bewusst unverändert; Paket 11 findet ihn genau so vor, wie das Audit ihn beschreibt.
  - **Paket 11 (BUG-003) erbt eine geprüfte Zusage.** `saveSignalsFromDeps()` → `whenSignalIsRead()` ist **nicht** quiet-gated — nur `readSignal()` in `src/signal-core.ts:34` ist es. Eine Wiederanmeldung aus dem Soft-Detach-Zweig heraus funktioniert deshalb auch innerhalb eines `beQuiet()`-Frames, und das ist mit der Entscheidung aus Paket 9 konsistent (ein Quiet-Frame verändert keine Dependency-Menge, er baut aber auch keine ab). Zweitens liest `[$destroySignal]()` in beiden Zweigen `hasNoLiveSignals()`; nach BUG-006 steht `#signalSubscriptions` am Ende **jedes** Laufs korrekt — auch nach einem werfenden —, die Wache arbeitet also nicht mehr auf einem Zwischenstand.
  - **Paket 10 (BUG-004) erbt eine Voraussetzung und eine Fußangel.** Voraussetzung: BUG-006 muss vor BUG-004 liegen. Sobald ein werfender Effect seine Geschwister nicht mehr abwürgt, überlebt er viele Writes am Stück — und jeder dieser Läufe hätte ohne den `finally` eine tote Subscription hinterlassen. Fußangel: der Regressionstest `a throwing callback still releases the dependency it stopped reading (BUG-006)` assertiert `expect(() => setCond(false)).toThrow('boom')` mit genau **einem** scheiternden Effect. Die »Entscheidungen« halten fest, dass `set()` weiterhin wirft und ein einzelner Fehler unverändert durchgereicht wird (`throwCollectedErrors`); solange Paket 10 das einhält, bleibt der Test grün. Wird er rot, weil auch ein einzelner Fehler in einem `AggregateError` ankommt, ist das eine Abweichung von der Entscheidungszeile, keine erwartete Nachführung. Dazu: `runOrphanedCleanupCallback()` läuft nach BUG-007 auch **synchron mitten in einem Lauf** — es ist damit eine zweite Stelle, an der Anwendungscode innerhalb der Zustellung ausgeführt wird, und Paket 10 sollte sie bei der Isolierung mitdenken.
  - Kein Finding aus 10 oder 11 wird durch Paket 9 gegenstandslos, und keines der offenen Pakete 12 bis 16 berührt `src/EffectImpl.ts`. Die Reihenfolge der Restliste bleibt, wie sie ist. Umgekehrt erledigt Paket 9 auch nichts von 10 oder 11 mit: BUG-004 hängt an der Zustellschleife von eventize, nicht am Abräumen der Dependencies, und BUG-003 sitzt im Static-Deps-Zweig, den Paket 9 nicht anfasst.
- **Paket 9 und Paket 12 teilen sich den `beQuiet`-Abschnitt der Doku, ohne sich zu überschneiden.** Paket 9 hängt einen Absatz über Dependency-Mengen hinter `docs/api.md:399` und lässt die Überschrift `### beQuiet(callback)` (Zeile 396) sowie jede Aussage über den Rückgabewert weg — das ist BUG-010. `docs/recipes.md:334` (`const peek = beQuiet(…)`) und `docs/cheat-sheet.md:111` sowie `skills/using-signalize/references/api.md:181` bleiben von Paket 9 unberührt, damit Paket 12 dort freie Hand hat (2026-08-07).
- **Korrektur an der Zeilentabelle im Paket-9-Querbezug** (2026-08-07, beim Abgleich von Paket 10 gemessen): die dort genannten neuen Zeilennummern für `src/EffectImpl.ts` stimmen nicht — die Datei ist **931** Zeilen lang, nicht 859. Ist-Stand: `hasStaticDeps()` 337, `saveSignalsFromDeps()` 341, `createEffect()`s `effect.saveSignalsFromDeps()` 397, `run()` 419, `[RECALL]()` **566**, `whenSignalIsRead()` 573, `[$destroySignal]()` 592, `destroyWhenUntriggerable()` 642, `hasNoLiveSignals()` 668, `cleanupLostSignals()` 672, `storeCleanupCallback()` 756, `acceptCleanupCallback()` 811, `destroy()` 889. Ebenfalls falsch: »Neue Felder gibt es keine« — Paket 9 hat `#trackedReads` (Zeile 176) eingeführt, und die beiden lokalen Bindungen `readsBefore`/`completed` im dynamischen Zweig von `run()` hängen daran. Für Paket 11 gilt unverändert: Abgleich über die Symbolnamen, nie über Zeilennummern aus dem Audit oder aus diesem Plan.
- **Was Paket 11 (BUG-003) von Paket 10 erbt** (2026-08-07):
  - **`[RECALL]()` ist umgebaut**, `run()` nicht. Paket 10 fasst ausschließlich `[RECALL]` an (aus vier Zeilen werden neun) und lässt den `hasStaticDeps()`-Zweig in `run()` sowie `saveSignalsFromDeps()` und `[$destroySignal]()` unberührt — Paket 11 findet die Stellen, die es ändert, exakt so vor, wie das Audit sie beschreibt. Alles unterhalb von `[RECALL]` rutscht um rund fünf Zeilen nach unten; `saveSignalsFromDeps()` (341) und `hasStaticDeps()` (337) bleiben, wo sie sind.
  - **Ein werfender Teardown-Schritt im Soft-Detach ist nicht isoliert.** Der Zustellrahmen von Paket 10 hängt am Write (`writeSignal()`) und am Batch-Flush, nicht an `destroySignal()`/`SignalGroup.off()`. Eine Wiederanmeldung, die Paket 11 in den `{detach: true}`-Zweig hängt, läuft also ungeschützt in der Zustellschleife der Destroy-Queue — wirft sie, bleiben die folgenden Abonnenten dieses Signals stehen. Was Paket 11 dort ergänzt, darf nicht werfen (oder muss selbst sammeln).
  - **Tests mit mehreren Effects werden aussagekräftiger.** Nach Paket 10 laufen in einem BUG-003-Test alle Effects eines Writes, auch wenn einer scheitert; ein `expect(() => set(…)).toThrow(…)` prüft ab jetzt den Zustand **nach** vollständiger Zustellung. Ein Test, der zwei Fehler in einem Write erzeugt, bekommt einen `AggregateError`.
- **Nebenbefund aus Paket 10, für Sprint 3 notiert** (2026-08-07): `destroySignal()` hat dasselbe Abbruchverhalten wie ein Write — `emit(globalDestroySignalQueue, …)` bedient Effects (`[$destroySignal]`, bis in `destroy()` und fremden Cleanup-Code) und Links in einer einzigen Schleife ohne `try`. Ein werfender Cleanup dort lässt die restlichen Abonnenten dieses Signals mit einer toten Subscription zurück. Das Audit führt dafür kein Finding, und BUG-004 beschreibt ausdrücklich nur die Write-Zustellung; die Pakete 13 bis 16 arbeiten aber in genau diesen Teardown-Pfaden und sollten es wissen, statt es neu zu entdecken.
- **Was Paket 16 (MEM-006) von Paket 10 in `signal-core.ts` vorfindet** (2026-08-07): `writeSignal()` besteht danach aus dem unveränderten `if (!isQuiet())` plus einem `try`/`catch`/`finally`. **Es kommt kein einziger Zweig hinzu** — die Datei bleibt bei 12 von 14 gedeckten Zweigen (85,71 % gegen die 85-%-Stufe), gemessen nach dem Umbau. Der Verteidigungs-`catch` kostet ein Statement und eine Zeile und ist durch Test 6 aus Paket 10 gedeckt; Statements und Zeilen stehen danach wieder auf 100 %. Für MEM-006 heißt das: der Zählerabgleich darf in `getSignalsCount()`/`destroySignal()` sitzen, aber jeder neue Zweig in dieser Datei braucht einen Test, der ihn in beide Richtungen auslöst.
- **Paket 7 bewegt die Coverage um keine Zelle** (gemessen: 99,01 / 94,03 / 99,51 / 99,59 vor und nach der Suite, identische Uncovered-Tabelle). Sprint 1 endet damit auf demselben Stand, auf den Paket 5 seine drei Stufen gesetzt hat; keine Stufe muss beim Sprint-Abschluss nachgezogen werden, und die enge Stelle bleibt, wo sie war — `signal-core.ts` bei 12/14 Zweigen gegen die 85-%-Stufe (2026-08-07).
- **Was die Pakete 12 bis 16 von Paket 11 erben — fast nichts, und das mit Absicht** (2026-08-07, beim Abgleich von Paket 11 entschieden und gemessen):
  - **`src/SignalGroup.ts` bleibt unangetastet.** Paket 11 weicht von der Empfehlung des Audits ab und hängt die Wiederanmeldung in `run()` statt in den `{detach: true}`-Zweig; `off()` behält damit exakt die Gestalt, die Paket 2 ihm gegeben hat, samt seiner acht Sammelstellen. Die Pakete 12 (BUG-009, `clear()`), 14 (MEM-002) und 15 (MEM-003, `allGroups` auf `WeakRef`) finden die Datei so vor, wie Paket 2 sie hinterlassen hat — Zeilennummern inbegriffen. Der Warnhinweis aus dem Paket-10-Querbezug (»ein werfender Teardown-Schritt im Soft-Detach ist nicht isoliert«) bleibt damit ein Hinweis, kein Erbe: es kommt kein Statement in diese Schleife.
  - **Sprint 3 fasst `src/EffectImpl.ts` nicht mehr an.** Paket 11 ist das letzte Paket in dieser Datei. Für die Pakete 13 bis 16 heißt das: jede Abweichung dort ist ein Regressionsbefund, keine erwartete Nachführung.
  - **Paket 16 (MEM-006) berührt eine Annahme, die Paket 11 neu belastet.** Der Guard in `saveSignalsFromDeps()` entscheidet über `signal.destroyed` — das Flag aus `destroySignal()`, nicht der Zähler `g_signalsCount`. MEM-006 korrigiert den Zähler und lässt das Flag in Ruhe; solange das so bleibt, gibt es keine Berührung. Wer dort anfängt, das Flag anzufassen, hat einen zweiten Leser.
  - **Kein Finding aus 12 bis 16 wird durch Paket 11 gegenstandslos**, und Paket 11 erledigt keines mit. Die Reihenfolge der Restliste bleibt, wie sie ist.
- **Was Paket 15 (MEM-003) von Paket 12 erbt** (2026-08-07, beim Abgleich von Paket 12 gemessen):
  - **`allGroups` hat danach vier Berührungspunkte statt fünf**: `add` im Konstruktor (Zeile 244), `delete` am Ende der Instanz-`clear()` (867), `has` im Guard von `clearGroupFromFinalizer()` (47) und `size` in `getSignalGroupsCount()` (66). Die fünfte, `allGroups.clear()` im statischen `clear()`, ist gestrichen — für den `WeakRef`-Umbau ist damit keine Wisch-Semantik nachzubauen, und der Sweep besteht nur noch aus einem Snapshot plus der Selbstaustragung jeder Gruppe.
  - **Die Invariante, die Paket 12 herstellt und Paket 15 halten muss**: Mitgliedschaft in `allGroups` deckt sich mit der in `store`, über die ganze Lebenszeit einer Gruppe — auch für eine, die während eines Sweeps entstanden ist. Genau daran hing BUG-009.
  - **Zwei Stellen werden durch den Umbau nicht-trivial.** `getSignalGroupsCount()` muss tote Referenzen überspringen, statt `size` zu melden, sonst zählt es Gruppen, die es nicht mehr gibt. Und der Guard `allGroups.has(group)` im Finalizer-Callback bekommt eine Gruppe, keinen `WeakRef` — mit einem `Set<WeakRef<SignalGroup>>` ist das kein Lookup mehr, sondern ein Scan oder ein zweiter, per Instanz gehaltener Marker. Paket 12 lässt beide Stellen inhaltlich unverändert, macht sie aber erstmals durch Tests beobachtbar.
  - **Der Backstop-Test aus Paket 12 ist der Kanarienvogel**: er ruft `clearGroupFromFinalizer(group)` direkt für eine Gruppe, die einen Sweep überlebt hat. Kippt er in Paket 15, hat der `WeakRef`-Umbau den Guard verloren, nicht die Gruppe.
  - **Kein Konflikt mit Paket 14** (MEM-002, dieselbe Datei): Paket 12 fasst ausschließlich `static clear()` an. Die Instanzpfade um `attachLink()`/`clear()`, an denen 14 arbeitet, bleiben Zeile für Zeile, wie Paket 2 sie hinterlassen hat — sie rutschen nur um eine Zeile nach oben.
- **Nebenbefund aus Paket 12, für die Pakete 14 und 15 notiert** (2026-08-07): die Schleife über `#signalDestroySubscriptions.values()` in `SignalGroup#clear()` (Zeile 843-847) ist die einzige Stelle des Teardowns **ohne** `try`. Wirft ein eventize-`unsubscribe` dort, verlässt `clear()` den Rumpf vor der Selbstaustragung aus `store`/`allGroups` und vor `throwCollectedErrors()` — die Gruppe bleibt halb abgebaut in beiden Registern. Das Audit führt dafür kein Finding, und Paket 12 baut es nicht um; wer in diesem Teardown eine neunte Sammelstelle ergänzt, sollte hier anfangen.

- **Was die Pakete 14, 15 und 16 von Paket 13 erben** (2026-08-07, beim Abgleich von Paket 13 gemessen):
  - **`src/SignalLink.ts` bekommt ein symbolgeschlüsseltes Feld und verliert ein privates.** `#unsubscribe` entfällt ersatzlos, `#releaseOnDestroy` heißt `[$queueUnsubscribes]` (neue Konstante in `src/constants.ts`) und hält ab jetzt **alle drei** Queue-Handles, nicht nur die beiden Destroy-Hooks. `protected releaseOnDestroy(unsubscribe)` bleibt als Zugang für Unterklassen erhalten, `SignalLinkToSignal` ist unverändert. `destroy()` verliert die zwei Zeilen vor der Freigabeschleife; alles darunter rutscht nach oben. Paket 14 gleicht in dieser Datei ausschließlich über Symbolnamen ab, nie über Zeilennummern.
  - **Das Label des Sammeltopfs in `destroy()` heißt jetzt `'tearing down a SignalLink'`** (vorher `'releasing SignalLink destroy-queue subscriptions'`), und `src/SignalLink.spec.ts:529` ist mitgezogen. Damit ist der `klein`-Nebenbefund aus Paket 8 eingelöst. Wer in diesem Teardown eine weitere Sammelstelle ergänzt — MEM-004 hängt `unretain(this, VALUE)` genau dort hinein —, findet die Reihenfolge unverändert vor: Handle-Schleife, DESTROY-Emit, `retainClear`, `off(this)`, Freeze, `throwCollectedErrors()`.
  - **Paket 14 wird von Paket 13 nicht berührt.** MEM-004 sitzt in `asyncValues()`s `finally` und im `retainClear(this, VALUE)` von `destroy()`; beides bleibt Zeile für Zeile stehen. MEM-002 sitzt in `SignalGroup#attachLink()`; auch dort ändert sich nichts. Zusatz für MEM-002 aus der Analyse von Paket 13: ein Link, der an einer Gruppe hängt, ist **nie** einsammelbar — `SignalGroup#links` hält ihn stark. Der Finalizer-Pfad und die fehlende Gegenkante schneiden sich also nicht; ein über `attachLink()` hängengebliebener Link wird von MEM-001 nicht mitgeheilt.
  - **Für Paket 15 (MEM-003) ist das Held-Value-Muster in der Regel wiederverwendbar, in der Gestalt nicht.** Wiederverwendbar ist die Regel: der Held-Value darf keinen starken Pfad zurück auf das registrierte Objekt haben, und jeder Pfad, der doch dorthin führen muss, geht über eine `WeakRef`. Nicht übertragbar ist die konkrete Lösung — bei einem Link braucht der Callback das Objekt gar nicht mehr, er räumt fremde Register auf (drei Unsubscribe-Handles, deren Closures den Link nur über `WeakRef` kennen), also reicht ein reiner Ressourcen-Held-Value. Bei einer Gruppe **ist** die Gruppe die Ressource: `clear()` muss auf ihr laufen. Deshalb bleibt es dort bei der Empfehlung des Audits, `WeakRef<SignalGroup>` plus separates Token — und Paket 15 muss zusätzlich sicherstellen, dass die Kette Gruppe → `#effects` → Closure → Host nicht schon anderweitig pinnt, was für einen Link nicht gilt. Belegt ist damit nur eines: dass ein Held-Value dieser Bauart den Finalizer weiterhin feuern lässt (gemessen, Paket 13, Schritt A.4).
  - **`off(queue, eventName)` ist auf den globalen Queues eine Abrissbirne** — notiert für jedes Paket, das dort aufräumen will. Unter einer Signal-ID abonnieren `EffectImpl` (`:635`), `SignalGroup` (`:363`), `createMemo` (`:123`) und jeder Link auf demselben Signal. `off(globalDestroySignalQueue, id)` entfernt sie alle, auch wenn das Signal noch lebt. Wer eine einzelne Subscription lösen will, braucht ihr Handle — Paket 13 hat deshalb die zweite Empfehlung des Audits genommen und nicht die erste.
  - **Kein Finding aus 14 bis 16 wird durch Paket 13 gegenstandslos**, und Paket 13 erledigt keines mit. Die Reihenfolge der Restliste bleibt, wie sie ist.

- **Was Paket 15 (MEM-003) von Paket 14 erbt** (2026-08-07, beim Abgleich von Paket 14 gemessen):
  - **`src/SignalGroup.ts` bekommt ein Feld und einen Zweig, beide weit weg von `allGroups`.** Neu ist `#linksWithDestroyHook`, ein `WeakSet<SignalLink>` direkt unter `#links` (Zeile 147), und in `attachLink()` ein `if`, das die DESTROY-Gegenkante genau einmal pro (Link, Gruppe) registriert. Alles ab `#parentGroup` rutscht um zwei Zeilen nach unten, alles ab `detachLink()` um sieben. Die fünf Berührungspunkte von `allGroups`, die der Paket-12-Querbezug auflistet — Konstruktor, Instanz-`clear()`, Finalizer-Guard, `getSignalGroupsCount()` —, sind inhaltlich unangetastet; Paket 15 gleicht über Symbolnamen ab, nicht über die Zeilennummern von dort.
  - **Der `WeakRef`-Umbau muss das neue Feld nicht mitnehmen.** `#linksWithDestroyHook` ist bereits schwach und rein instanzlokal; es taucht in keinem Sweep, keinem Snapshot und keinem Zähler auf. MEM-003 betrifft die Wurzeln, die eine Gruppe von außen festhalten, nicht die, die eine Gruppe von innen hält.
  - **Eine Kante zeigt jetzt vom Link auf die Gruppe.** Die Closure der Gegenkante (`() => this.#links.delete(link)`) hängt als DESTROY-Listener am **Link** und hält die Gruppe stark. Für die Erreichbarkeitsrechnung von MEM-003 ändert das nichts an der entscheidenden Richtung — der Host bleibt das, was die Gruppe am Leben hält —, aber wer für Paket 15 die Pfade Gruppe → Host durchzählt, sollte wissen, dass es ab jetzt auch Link → Gruppe gibt: ein Link, den irgendein Fremdregister festhält, hält seine Gruppe mit. Dieselbe Kante lag vorher in `SignalLink.attach()`, sie ist also nicht neu, sondern nur umgezogen und gilt jetzt auch für den direkten `attachLink()`-Weg.
  - **Die Coverage-Lage von `SignalGroup.ts` verbessert sich leicht** — von `97,8 / 87,71 / 100 / 99,22` auf `97,84 / 87,93 / 100 / 99,24`, gemessen. Die Luft, die Paket 5 der Datei zugestanden hat (2 Statements, 3 Zweige, 3 Zeilen), ist unangetastet; Paket 15 findet sie vollständig vor.
  - **Kein Finding aus 15 oder 16 wird durch Paket 14 gegenstandslos**, und Paket 14 erledigt keines mit. Die Reihenfolge der Restliste bleibt, wie sie ist.

- **Was Paket 16 (MEM-006, MEM-007) von Paket 15 wissen muss** (2026-08-07 gemessen, 2026-08-08 nach der Reihenfolgeentscheidung umgeschrieben). **Paket 16 läuft jetzt vor Paket 15** und ist damit das einzige Paket dieses Laufs, das für ein *nachfolgendes* vorarbeitet, ohne dessen Code zu sehen:
  - **Warum die Reihenfolge gedreht wurde.** Der `WeakRef`-Umbau der Gruppenwurzeln erzeugt einen Pfad, auf dem eine Gruppe samt ihrer Signale eingesammelt wird, **ohne** dass `clear()` je läuft. `getSignalsCount()` steht danach dauerhaft zu hoch — gemessen 2000 für 1000 dekoratorförmige Hosts. `assertSignalsCount()` steht in den `beforeEach`/`afterEach`-Wachen praktisch jeder Spec-Datei, ein einziger solcher Test würde also die Restsuite vergiften. Die Selbstkorrektur aus MEM-006 ist die Voraussetzung dafür, dass Paket 15 seinen Beweis überhaupt als Test schreiben kann.
  - **Damit das zusammenpasst, muss MEM-006 zwei Dinge einhalten** — beides ergibt sich aus der Empfehlung des Findings, keines steht dort ausdrücklich: **(1)** die Korrektur muss an einem `FinalizationRegistry` auf dem `SignalImpl` hängen, nicht an `destroySignal()`. Der stille Pfad ruft `destroySignal()` nie; eine Korrektur, die nur »von außen zerstört« bemerkt, sieht ihn nicht. **(2)** Der Held-Value dieses Registry darf **nicht** auf das `SignalImpl` zeigen — dieselbe Falle wie in Paket 13 und dieselbe wie in MEM-003 selbst. Ein `SignalImpl` hält seinen Wert, und im Dekorator-Muster ist dieser Wert der Host; ein Held-Value, der das Signal hält, hielte also genau den Host fest, den Paket 15 freibekommt, und zöge den ganzen Umbau zurück. Ein Zähler-Delta oder ein `WeakRef` reicht als Held-Value; das Unregister-Token darf das `SignalImpl` sein (Token sind schwach — 200 Registrierungen gemessen, 0 überlebende Token).
  - **Was Paket 16 als Prüfstelle bekommt.** Nach dem Fix muss gelten: 1000 dekoratorförmige Hosts fallenlassen, `gc()`, und `getSignalsCount()` fällt auf die Baseline zurück — heute steht es bei 2000, und zwar unabhängig davon, ob Paket 15 schon gebaut ist. Der Test dafür gehört zu MEM-006, nicht zu MEM-003; Paket 15 setzt nur darauf auf.
  - **`src/signal-core.ts` bleibt eng.** Der Querbezug aus Paket 10 gilt unverändert — 12 von 14 Zweigen gegen die 85-%-Stufe, jeder neue ungedeckte Zweig kippt sie.
  - **Warnung für MEM-007.** Die Empfehlung lautet, `SignalAutoMap` möge »den Destroy-Event jedes erzeugten Signals abonnieren«. Das ist eine Subscription auf `globalDestroySignalQueue`, also auf einem Modul-Objekt — und genau die Bauform, die MEM-003 als dritte Wurzel entlarvt hat (`src/SignalGroup.ts:371-378`). Hält die Listener-Closure die Map oder das Signal **stark**, ist jede `SignalAutoMap` samt aller ihrer Signalwerte ab der ersten Registrierung von einer GC-Wurzel aus erreichbar. Die Closure darf Map und Signal nur über `WeakRef` kennen; die Vorlage steht in Schritt 11 des Detailplans von Paket 15. Sonst baut Paket 16 dasselbe Leck neu ein, das Paket 15 danach ausbaut.
  - **Sonst berührt Paket 15 nichts von Paket 16:** `SignalAutoMap.ts` und `signal-core.ts` stehen in keiner seiner Dateilisten.

- **Was Paket 15 (MEM-003) von Paket 16 erbt** (2026-08-08, bei der Planung von Paket 16 gemessen):
  - **Auflage 1 ist eingelöst.** Die Korrektur hängt an einem `FinalizationRegistry` auf dem `SignalImpl`, registriert im selben `incSignalsCount(signal)`-Aufruf, der hochzählt (`src/signal-core.ts`). Sie sieht den stillen Pfad, weil sie nichts anderes sieht: `destroySignal()` kommt darin nur als `unregister()` vor.
  - **Auflage 2 ist eingelöst, und zwar ersatzlos.** Der Held-Value ist `undefined` — der Callback braucht nichts außer der Modulvariablen, die er ohnehin schließt. Es gibt keinen Pfad zurück auf das `SignalImpl`, weil es keinen Held-Value gibt. Das Unregister-Token bleibt das `SignalImpl` und ist schwach. Gegengemessen an einer groben Weg-A-Vorschau: mit `undefined` fällt der Dekorator-Fall auf `Hosts 0/1000, groups=0, Zähler 2000 → 0`; mit einem Held-Value `{sig: signal}` stehen dieselben Zahlen auf `1000/1000, groups=1000` — ein falscher zweiter Parameter in `signal-core.ts` zöge diesen ganzen Umbau zurück, ohne dass eine Zeile in `SignalGroup.ts` falsch wäre.
  - **Korrektur an der Prüfstelle** aus dem Querbezug darüber. Dort steht, nach dem MEM-006-Fix müsse gelten: 1000 dekoratorförmige Hosts fallenlassen, `gc()`, `getSignalsCount()` fällt auf die Baseline — »unabhängig davon, ob Paket 15 schon gebaut ist«. Das stimmt nicht, und es kann nicht stimmen: die `+2000` sind heute keine Buchhaltungslücke, sondern echte Erreichbarkeit (die Gruppe hält die Signale, `allGroups` hält die Gruppe). Gemessen mit eingebautem MEM-006 und ohne Paket 15: `2000 → 2000`, Hosts `1000/1000`. **Die Prüfstelle gehört damit zu Paket 15, nicht zu Paket 16**, und sie ist dort erfüllbar: mit beiden zusammen `2000 → 0`. Paket 16 beweist stattdessen dieselbe Zusage an nackten, fallengelassenen Signalen — 2000 → 0 bei `0/2000` überlebenden `WeakRef`s.
  - **Die Reihenfolgeentscheidung ist damit besser begründet als vorher.** Ohne MEM-006 sammelt Weg A den Dekorator-Fall zwar ein (Hosts `0/1000`, `groups=0`), aber `getSignalsCount()` steht danach bei 4000 und **kommt nicht mehr herunter** — auch nicht durch `SignalGroup.clear()`, weil es keine Gruppe mehr gibt, die etwas zu zerstören hätte. Nicht »zu hoch«, sondern dauerhaft und unheilbar zu hoch.
  - **Schritt 20 von Paket 15 bleibt gültig, wie er dasteht.** Test 1 darf `getSignalsCount() === signalBaseline` als zweite Abbruchbedingung in die Budget-Schleife nehmen; gemessen fällt der Zähler im selben Sweep wie `getSignalGroupsCount()`.
  - **Die Vorlage für Schritt 11 steht jetzt zweimal gebaut da.** `SignalAutoMap#create()` (Paket 16) hat exakt die Gestalt, die Paket 15 für den Per-Signal-Listener braucht: `on` statt `once` mit `detach`-Wache, eine `WeakRef` auf den Besitzer, sonst nur primitive Captures, genau eine innere Funktion im Scope, und ein Ressourcen-Finalizer, der die Handles einer still eingesammelten Instanz freigibt. Gemessen für diese Bauform: naive Fassung 200/200 überlebende Instanzen und 400 dauerhafte Subscriptions, `WeakRef`-Fassung 0/200 und Freigabe auf die Baseline.
  - **Ein Detail, das Paket 15 nicht übernehmen darf.** Paket 16 verzichtet im Listener auf einen Identitätswächter, weil sein Listener nachweislich der **erste** Abonnent seiner Signal-ID ist (die ID entsteht in derselben Anweisung) und eventize nicht an einen währenddessen abgemeldeten Listener zustellt (gemessen). Für `SignalGroup#addSignal()` gilt das erste nicht — dort wird ein fremdes, möglicherweise längst abonniertes Signal angehängt. Der `signal !== undefined`-Deref-Wächter aus Schritt 11 bleibt also nötig.
  - **`SignalAutoMap.ts` und `signal-core.ts` sind nach Paket 16 fertig**; keine Datei aus Paket 15s Liste wird von Paket 16 angefasst, und kein Finding von Paket 15 wird gegenstandslos. Umgekehrt gemessen: die volle Suite bleibt mit dem MEM-006-Fix grün, auch unter 4 × `gc()` vor und nach jedem einzelnen Test (461/461, drei Läufe) — Paket 15 findet keine vergiftete Wache vor.

## Pakete

### Sprint 1 — Testabdeckung und Messung

#### [x] 1. Das Sicherungsnetz selbst reparieren
- Findings: TEST-007 (medium), TEST-010 (medium)
- Ziel: Der Zähl-Helper rechnet richtig, und die als Referenz benannte Spec zeigt tatsächlich das Muster, das die Doku verlangt.
- Bereich: `src/assert-helpers.ts`, `src/unsubscribeEffect.spec.ts`, `AGENTS.md`, `CLAUDE.md`
- Hängt ab von: —
- Modell: mittlere Stufe
- Hash: `ee813cc`
- Ergebnis (2026-08-07): TEST-007 und TEST-010 behoben, Review ohne Qualitätsbefund. Verify selbst gelaufen: check ✓ (78 Dateien) · compile ✓ · test ✓ 379 passed / 9 skipped (Baseline 377/9). Regressionstest war rot mit `expected 1 to be 2`.
- Nebenbefunde: keine
- Dateien: `src/assert-helpers.ts`, neu `src/assert-helpers.spec.ts`, `src/unsubscribeEffect.spec.ts`, `CHANGELOG.md`
- Vorgehen:
  1. **Zuerst der rote Test.** Neue Datei `src/assert-helpers.spec.ts` mit einem `describe('assertEffectSubscriptionsCountChange')`. Der Test muss eine **von null verschiedene** Baseline erzeugen, denn genau dort bricht der Helper:
     - einen `createSignal()` anlegen und einen `createEffect(() => { … get() … })` darauf — damit steht `getSubscriptionCount(globalEffectQueue)` über 0;
     - `saveEffectSubscriptionsCount(true)` rufen (setzt `g_initialEffectCount` auf diesen Wert ungleich 0);
     - ein zweites Signal plus zweiten Effect anlegen (`+1` Subscription);
     - `assertEffectSubscriptionsCountChange(1)` muss durchgehen;
     - den zweiten Effect `destroy()`en, `assertEffectSubscriptionsCountChange(-1)` muss durchgehen;
     - am Ende beide Effects zerstören und beide Signale mit `destroySignal()` abräumen, damit die Datei nichts stehen lässt.
     Import von `getSubscriptionCount` direkt aus `@spearwolf/eventize`, `globalEffectQueue` aus `./global-queues.js` — `assert-helpers.ts` re-exportiert `getSubscriptionCount` nicht.
     Dieser Test **muss vor der Korrektur rot sein**: der Helper erwartet heute `beforeCount + g_initialEffectCount + deltaCount`, also `g_initialEffectCount + 1` statt `1`. Die Ausgabe des roten Laufs gehört in den Report.
  2. `src/assert-helpers.ts:92` — den Erwartungswert von `beforeCount + g_initialEffectCount + deltaCount` auf `beforeCount + deltaCount` ändern. `g_initialEffectCount` ist in `beforeCount` (Zeile 83) und `count` (Zeile 84) bereits herausgerechnet; die dritte Addition ist der Fehler.
  3. `src/assert-helpers.ts:85-92` — die Fehlermeldung auf dieselben Größen umstellen, die verglichen werden. Statt `…change delta should be ${deltaCount} but is ${count - beforeCount}` lautet sie: `${namespacePrefix(namespace)}Effect subscriptions count should be ${beforeCount + deltaCount} but is ${count}`. Die Argumentreihenfolge `expect(count, msg).toBe(erwartet)` bleibt wie sie ist — Ist-Wert zuerst.
  4. Prüfen, dass der bestehende Aufrufer `src/createSignal.destroySignal.spec.ts` (Zeilen 48, 61, 82, 91) unverändert grün bleibt. Er zieht die Baseline bei 0, für ihn ändert sich nichts.
  5. `src/unsubscribeEffect.spec.ts` — den vorhandenen `it()`-Block **unverändert lassen** und einen zweiten `it()` im selben `describe` ergänzen, der das in `CLAUDE.md` und `AGENTS.md` beschriebene Muster tatsächlich vorführt: Snapshot → Szenario → Teardown → wiederhergestellt. Konkret:
     - vor dem Szenario `getSubscriptionCount(globalEffectQueue)`, `getSubscriptionCount(globalDestroySignalQueue)`, `getEffectsCount()`, `getSignalsCount()` und `getLinksCount()` in Konstanten festhalten;
     - dasselbe verschachtelte Szenario aufbauen wie im ersten Test (äußerer Effect liest `a`, innerer `createEffect` liest `b`), den Rückgabewert von `createEffect` als `Effect` festhalten;
     - `setB(…)` und `setA(…)` je einmal auslösen, damit der innere Effect mindestens einmal neu entsteht;
     - **während** des Szenarios assertieren, dass die Zahlen tatsächlich gewachsen sind (`getEffectsCount()` und die Queue-Subscriptions über dem Snapshot) — eine Bilanz ohne Ausschlag beweist nichts;
     - den äußeren Effect `destroy()`en und beide Signale mit `destroySignal()` zerstören;
     - alle fünf Zahlen wieder gegen den Snapshot assertieren.
     Als Vorbild für den Stil dient `src/EffectImpl.destroy.spec.ts:34-69`.
  6. `CHANGELOG.md` — eine Zeile unter der bestehenden Überschrift `### Tests` (Zeile 75), englisch, ein Fakt: dass `assertEffectSubscriptionsCountChange()` die Baseline doppelt gezählt hat und dass `unsubscribeEffect.spec.ts` jetzt die Subscription-Bilanz führt, auf die beide Agenten-Dokumente verweisen.
  7. `AGENTS.md` und `CLAUDE.md` werden **nicht** geändert. Ihre Aussage über `unsubscribeEffect.spec.ts` wird durch Schritt 5 wahr, statt umgeschrieben zu werden.
- Verify: `pnpm check && pnpm compile && pnpm test`
- Commit: `test(helpers): fix the subscription-count arithmetic and prove the leak-balance pattern (TEST-007, TEST-010)`
- Abgleich (2026-08-07): TEST-007 unverändert an `src/assert-helpers.ts:92` · TEST-010 unverändert, `src/unsubscribeEffect.spec.ts` enthält keinen einzigen `getSubscriptionCount`-Aufruf; die Verweise stehen in `CLAUDE.md:45` und `AGENTS.md:192`

**TEST-007 · medium · src/assert-helpers.ts:92** — Die Arithmetik in `assertEffectSubscriptionsCountChange` reparieren
Der Helper mischt relative und absolute Zählstände: `beforeCount` und `count` sind beide gegen `g_initialEffectCount` normalisiert, der Erwartungswert addiert es aber noch einmal dazu. Korrekt wäre `beforeCount + deltaCount`, genau so wie es das Schwestermodell im selben File macht. Unauffällig bleibt es nur, weil der einzige Aufrufer die Baseline bei 0 zieht — der Helper ist durch Zufall richtig, nicht durch Konstruktion. Die Fehlermeldung nennt zudem eine andere Größe als die verglichene.
Empfehlung: Das `+ g_initialEffectCount` streichen und die Meldung auf dieselben Größen umstellen, die verglichen werden.

**TEST-010 · medium · src/unsubscribeEffect.spec.ts:1-92 · AGENTS.md:192 · CLAUDE.md:45** — Die Referenz-Spec für Leak-Verifikation verifiziert selbst keine Subscriptions
`CLAUDE.md` und `AGENTS.md` nennen diese Datei wörtlich als »die Referenz« für die Verifikation von Subscription-Leaks. Sie enthält keinen einzigen `getSubscriptionCount`-Aufruf, nur Mock-Call-Counts, und ist seit `ace8b85` unverändert. Wer der Anweisung folgt und sich das Vorbild ansieht, findet dort nicht das Muster, das die Anweisung verlangt.
Empfehlung: Die Datei um Subscription-Bilanzen ergänzen oder in beiden Dokumenten auf ein echtes Vorbild verweisen — `src/EffectImpl.destroy.spec.ts:34-69` oder `src/nested-effects-staticDeps.spec.ts:50-96`.

#### [x] 2. SignalGroup: die blinden Tests sehend machen
- Findings: TEST-001 (high), TEST-004 (medium), TEST-009 (medium)
- Ziel: Detach, Fehleraggregation in `off()`/`clear()` und der zweite Zweig der Zyklus-Erkennung werden geprüft statt behauptet.
- Bereich: `src/SignalGroup.spec.ts`, `src/SignalGroup.teardown.spec.ts`, `src/SignalGroup.ts` (nur ein `@internal`-Testzugang, siehe Schritt 9)
- Hängt ab von: —
- Modell: mittlere Stufe
- Hash: `dabbf8d`
- Ergebnis (2026-08-07): TEST-001, TEST-004 und TEST-009 behoben, Review ohne Qualitätsbefund. Der Reviewer hat die Mutationsprobe für beide TEST-001-Tests und die 1:1-Zuordnung Test→Sammelstelle über isolierte Coverage-Läufe gegengeprüft. Verify selbst gelaufen: check ✓ · compile ✓ · test ✓ 389 passed / 9 skipped · test:gc ✓ 398 passed. `src/SignalGroup.ts` von 82,45 % auf 86,84 % Branch, ungedeckt nur noch `236, 240` (private Konstruktor-Returns, kein Finding dieses Laufs). Gesamt-Branch 89,9 % → 91,05 %.
- Nebenbefunde: keine
- Dateien: `src/SignalGroup.spec.ts`, `src/SignalGroup.teardown.spec.ts`, `src/SignalGroup.ts`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Der Coverage-Lauf vom 2026-08-07 (`pnpm test`, nach Paket 1) meldet für `src/SignalGroup.ts` genau diese ungedeckten Zeilen: `224, 228, 271, 272, 274, 275, 711, 731, 746, 757, 788, 798, 814, 822, 829`. Die acht Zeilen aus TEST-004 stehen alle darin, dazu die Zeilen aus TEST-009 (271–275) und eine neunte Sammelzeile in `clear()` (829), die das Audit nicht nennt — Schritt 7 nimmt sie mit. `224`/`228` (private Konstruktor-Rückgaben) gehören zu keinem Finding dieses Pakets und bleiben liegen.

  **A — TEST-001: die zwei assertionsfreien Tests (`src/SignalGroup.spec.ts`)**

  1. Import-Zeile 2–6 erweitern: `getGroupMemberCounts` und `NO_GROUP_MEMBERS` zusätzlich aus `./assert-helpers.js` holen (die Datei importiert dort bisher nur `assertEffectsCount`, `assertLinksCount`, `assertSignalsCount`).
  2. `src/SignalGroup.spec.ts:323`, `it('detachGroup() removes child group')` — Body vollständig ersetzen. Das Re-Attach-Argument fällt weg; es beweist nichts, weil `attachGroup()` ohnehin selbstständig umhängt (Zeilen 283–286 in `SignalGroup.ts`). Neuer Body:
     ```ts
     const parent = SignalGroup.findOrCreate({});
     const child = SignalGroup.findOrCreate({});

     parent.attachGroup(child);
     expect(getGroupMemberCounts(parent).groups, 'child is attached').toBe(1);

     parent.detachGroup(child);
     expect(getGroupMemberCounts(parent).groups, 'child is detached').toBe(0);

     // The parent has no hold left, so clearing it must not reach the child.
     const signal = createSignal(42);
     child.attachSignal(signal);

     parent.clear();
     assertSignalsCount(1, 'the detached child was not cleared with its parent');

     child.clear();
     assertSignalsCount(0, 'clearing the detached child destroys its signal');
     ```
     Damit stirbt der Mutant zweimal: `memberCounts.groups` direkt, und die Folge daraus (`parent.clear()` erreicht das Kind nicht mehr). `createSignal(42)` ohne `attach` erzeugt genau ein Signal; die `afterEach`-Bilanz der Datei (`assertSignalsCount(0)`) bleibt gewahrt.
  3. `src/SignalGroup.spec.ts:616`, `it('clear() detaches from parent group')` — Body vollständig ersetzen:
     ```ts
     const parent = SignalGroup.findOrCreate({});
     const child = SignalGroup.findOrCreate({});

     parent.attachGroup(child);
     expect(getGroupMemberCounts(parent).groups, 'child is attached').toBe(1);

     child.clear();

     expect(
       getGroupMemberCounts(parent).groups,
       'clear() must take the child out of its parent',
     ).toBe(0);
     expect(getGroupMemberCounts(child)).toEqual(NO_GROUP_MEMBERS);

     parent.clear();
     ```

  **B — TEST-009: die ungedeckte Hälfte der Zyklus-Erkennung (`src/SignalGroup.spec.ts`, `describe('cyclic group graphs (BUG-002)')` ab Zeile 1074)**

  Wichtig, weil das Audit hier eine Zeile zu grob zeichnet: der `throw` in Zeile 269 **ist** gedeckt — `it('attachGroup() rejects a transitive cycle')` (Zeile 1092) läuft genau dort hinein. Ungedeckt sind der *Durchfall* an Zeile 269 und damit die Zeilen 271, 272, 274 und der `throw` in 275–277. Die beiden neuen Tests treffen genau das.

  4. Neuer Test hinter Zeile 1104 (nach `rejects a transitive cycle`), `it('attachGroup() walks a parent chain deeper than two links', () => {…})`:
     ```ts
     const root = SignalGroup.findOrCreate({});
     const a = SignalGroup.findOrCreate({});
     const b = SignalGroup.findOrCreate({});
     const c = SignalGroup.findOrCreate({});
     const unrelated = SignalGroup.findOrCreate({});

     root.attachGroup(a);
     a.attachGroup(b);
     b.attachGroup(c);

     // c → b → a → root: only from the third level up does the guard take its
     // second Floyd step at all.
     expect(() => c.attachGroup(root)).toThrow(
       'Cannot attach a group to one of its own descendants',
     );
     expect(getGroupMemberCounts(c).groups, 'the rejected edge was not added').toBe(0);

     // Same depth, legal edge — the walk must run out at the root and let it through.
     expect(() => c.attachGroup(unrelated)).not.toThrow();
     expect(getGroupMemberCounts(c).groups).toBe(1);

     root.clear();
     ```
     Ablauf für `c.attachGroup(root)`: `slow=c`, `fast=b` → 264 nein → 266 `fast=a` → 267 nicht null → 269 nein (**der Durchfall**) → 271 `fast=root` → 272 `slow=b` → 274 `root !== b` → nächste Runde → 264 `fast === group` → `throw`. Für `c.attachGroup(unrelated)` läuft dieselbe Runde und bricht in Runde 2 bei 267 mit `break` ab. Damit sind 271, 272 und beide Operanden von 274 gedeckt.
  5. Neuer Test direkt danach, `it('attachGroup() rejects an already cyclic parent chain instead of hanging', () => {…})`:
     ```ts
     const a = SignalGroup.findOrCreate({});
     const b = SignalGroup.findOrCreate({});
     const x = SignalGroup.findOrCreate({});
     const z = SignalGroup.findOrCreate({});

     a.attachGroup(x); // x → a
     b.attachGroup(a); // a → b

     // Break the forest invariant on purpose: the public API cannot produce
     // this state, attachGroup() rejects every edge that would close a cycle.
     // The Floyd guard exists for the case where it happens anyway.
     b[$setParentGroup](a); // a ↔ b

     try {
       expect(() => x.attachGroup(z)).toThrow(
         'Cannot attach a group: the parent chain of this group is already cyclic',
       );
       expect(getGroupMemberCounts(x).groups, 'the rejected edge was not added').toBe(0);
     } finally {
       b[$setParentGroup](undefined);
     }

     b.clear();
     z.clear();
     ```
     Ablauf: `slow=x`, `fast=a` → 264 nein → 266 `fast=b` → 267 nicht null → 269 nein → 271 `fast=a` → 272 `slow=a` → 274 `fast != null && fast === slow` → `throw`. Das `finally` muss den Zyklus in jedem Fall auflösen, sonst räumt die `afterEach` der Datei über einen kaputten Graphen. Import von `$setParentGroup` aus `./SignalGroup.js` ergänzen.
  6. Ohne Schritt 9 ist Test 5 nicht schreibbar: `#parentGroup` ist ein privates Klassenfeld und aus keiner Spec erreichbar, und über die öffentliche API lässt sich kein zyklischer Elternpfad herstellen — die Wache lehnt jede Kante ab, die einen schließen würde. Die Audit-Empfehlung »über die interne API einen zyklischen Elternpfad konstruieren« beschreibt eine interne API, die es noch nicht gibt.

  **C — TEST-004: die acht Sammelstellen (`src/SignalGroup.teardown.spec.ts`)**

  Alle neuen Tests kommen in ein neues, verschachteltes `describe('every teardown step collects instead of aborting', () => {…})` am Ende von `describe('SignalGroup teardown robustness')` (nach Zeile 481). Die `beforeEach`/`afterEach` der äußeren Suite gelten mit. Zusätzlich zu importieren: `DESTROY` aus `./constants.js` (bisher nur `OFF`) und `signalImpl` aus `./signal-core.js` (bisher nur `destroySignal`, `getSignalsCount`). Alles andere (`on`, `getSubscriptionCount`, `link`, `getLinksCount`, `createEffect`, `getEffectsCount`, `createSignal`, `globalDestroySignalQueue`, `getGroupMemberCounts`, `NO_GROUP_MEMBERS`, `getSignalGroupsCount`) ist schon da.

  Drei Mechaniken, auf denen alle acht Tests aufsitzen — sie stimmen, sind aber nicht offensichtlich:
  - **Ein werfender `DESTROY`-Listener auf einem `SignalLink` bringt `link.destroy()` zum Werfen.** `SignalLink.destroy()` (Zeile 349) emittiert `DESTROY` ungeschützt. Die Buchhaltung von `link()` (`once(newLink, DESTROY, …)`, `link.ts:179`) wurde zuerst registriert und läuft deshalb zuerst — eventize sortiert bei gleicher Priorität nach Registrierungsreihenfolge (`sortByPriorityAndId`). `getLinksCount()` fällt also trotz des Wurfs korrekt zurück; `#unsubscribe` und die `#releaseOnDestroy`-Handles sind vor dem Emit freigegeben (Zeilen 323, 340–347). Was liegen bleibt: `isDestroyed` bleibt `false` und der Link wird nicht eingefroren. Deshalb **nie ein zweites `destroy()`** auf einen solchen Link, und `isDestroyed` an ihm nicht assertieren.
  - **Reihenfolge in `clear()`: Signale (810) vor Links (818).** `destroySignal()` reißt jeden Link auf diesem Signal über dessen `once(globalDestroySignalQueue, source.id, …)` mit. Ein Link, dessen Quelle am Selben Group hängt, ist beim Erreichen von Zeile 818 also längst tot. Für Zeile 822 braucht es deshalb einen Link auf einer **gruppenfremden** Quelle. In `off()` ist es umgekehrt: dort laufen die Links (727) vor dem Soft-Detach (741) und es wird kein Signal zerstört — Zeile 731 lässt sich mit einer ganz normalen Gruppenquelle treffen.
  - **Reihenfolge auf `globalDestroySignalQueue`.** Die gruppeneigene Abmeldung wird in `#addSignal()` beim Anhängen registriert. Ein Listener, der *vorher* registriert wurde, läuft *vor* ihr — Schritt 7 nutzt genau das, um `#removeSignal()` gar nicht erst stattfinden zu lassen und damit Zeile 829 zu erreichen. Jeder solche Listener wird über den Rückgabewert von `on()` in einem `finally` wieder abgemeldet.

  Die acht Tests, jeder mit einem Geschwister-Zeugen, der beweist, dass der Teardown nach dem Wurf weiterlief:

  | # | Testname | trifft | Konstruktion |
  | --- | --- | --- | --- |
  | 1 | `off() collects a throwing child group and still tears down its own members` | 711, 757 | `parent.attachGroup(child)`; `on(child, OFF, () => { throw new Error('child off boom'); })`; am Parent ein Effect mit zählendem Cleanup; `expect(() => parent.off()).toThrow('child off boom')`; danach `cleanupCalls === 1`, `getEffectsCount() === 0`; `parent.clear()`. Der Wurf entsteht in der `emit(this, OFF)`-Sammelstelle des Kindes (757) und wird vom Parent in 711 aufgefangen. |
  | 2 | `off() collects a throwing link teardown and still destroys the sibling link` | 731 | Quelle `sig` mit `{attach: host}`; `boomLink = link(sig, () => {}, {attach: host})` plus `on(boomLink, DESTROY, () => { throw new Error('link teardown boom'); })`; danach `sibling = link(sig, (v) => v, {attach: host})` mit zählendem `DESTROY`-Listener (zwei verschiedene Callback-Instanzen ⇒ zwei Links); `expect(() => group.off()).toThrow('link teardown boom')`; danach `siblingDestroyed === 1`, `sibling.isDestroyed === true`, `getLinksCount() === 0`; `group.clear()`. |
  | 3 | `off() collects a throwing detach listener and still notifies the remaining signals` | 746 | `first` und `second` je `{attach: host}`; auf `signalImpl(first).id` ein Listener `(_id, params?: {detach?: boolean}) => { if (params?.detach) throw new Error('detach boom'); }`, auf `signalImpl(second).id` ein zählender Zeuge mit derselben Signatur; `expect(() => group.off()).toThrow('detach boom')`; `secondDetachEvents === 1`; `first.value === 0` (das Signal überlebt `off()`); beide `on()`-Handles im `finally` abmelden, dann `group.clear()`. |
  | 4 | `off() collects a throwing OFF listener after the teardown is complete` | 757 | Ein Effect mit zählendem Cleanup und ein `link(sig, () => {}, {attach: host})`; `on(group, OFF, () => { throw new Error('off listener boom'); })`; `expect(() => group.off()).toThrow('off listener boom')`; danach `cleanupCalls === 1`, `getEffectsCount() === 0`, `getLinksCount() === 0`, `sig.value === 0`; `group.clear()`. Deckungsgleich zu 757 aus Test 1, aber als eigene Aussage: der `OFF`-Listener wird zuletzt bedient und reißt nichts mit. |
  | 5 | `clear() collects a throwing DESTROY listener and still dismantles the group` | 788 | Signal, Effect mit zählendem Cleanup, Link, alle `{attach: host}`; `on(group, DESTROY, () => { throw new Error('destroy listener boom'); })`; `expect(() => group.clear()).toThrow('destroy listener boom')`; danach `cleanupCalls === 1`, `getGroupMemberCounts(group)` gleich `NO_GROUP_MEMBERS`, `getEffectsCount()`/`getSignalsCount()`/`getLinksCount()` je 0 und `getSignalGroupsCount()` zurück auf dem zu Testbeginn genommenen `groupsBefore`. |
  | 6 | `clear() collects a throwing child group and still clears its own members` | 798 | Wie Test 1, aber `on(child, DESTROY, …)` und `parent.clear()`; danach `cleanupCalls === 1`, `getGroupMemberCounts(parent)` und `getGroupMemberCounts(child)` je `NO_GROUP_MEMBERS`, `getSignalsCount() === 0`, `getSignalGroupsCount() === groupsBefore`. |
  | 7 | `clear() collects a throwing destroy-queue listener and still releases its subscriptions` | 814, **829** | `const destroyQueueBaseline = getSubscriptionCount(globalDestroySignalQueue)`; `first`/`second` **ohne** `attach` anlegen; **zuerst** `on(globalDestroySignalQueue, signalImpl(first).id, () => { throw new Error('destroy queue boom'); })`, **danach** `group.attachSignal(first)` und `group.attachSignal(second)`; `expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destroyQueueBaseline + 3)`; im `try`: `expect(() => group.clear()).toThrow('destroy queue boom')` und `expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destroyQueueBaseline + 1)`; im `finally` das Boom-Handle abmelden; danach `getSubscriptionCount(globalDestroySignalQueue) === destroyQueueBaseline`, `getSignalsCount() === 0`, `signalImpl(second).destroyed === true`, `getGroupMemberCounts(group)` gleich `NO_GROUP_MEMBERS`. Weil der Boom-Listener vor der Gruppenabmeldung registriert ist, läuft `#removeSignal(first)` nie — und `clear()` muss dessen Queue-Handle über die Schleife in 826–831 loswerden. Das ist die Aussage, die Zeile 829 deckt. |
  | 8 | `clear() collects a throwing link teardown on a foreign source` | 822 | `const external = createSignal(0)` **ohne** `attach`; `boomLink = link(external, () => {}, {attach: host})` mit werfendem `DESTROY`-Listener, dazu `sibling = link(external, (v) => v, {attach: host})` mit zählendem Zeugen; zusätzlich ein `{attach: host}`-Signal, damit die Signalschleife vor der Linkschleife überhaupt etwas tut; `expect(() => group.clear()).toThrow('link clear boom')`; danach `siblingDestroyed === 1`, `getLinksCount() === 0`, `getGroupMemberCounts(group)` gleich `NO_GROUP_MEMBERS`; zum Schluss `destroySignal(external)` und `expect(getSignalsCount()).toBe(0)`, damit die `afterEach`-Bilanz stimmt. |

  **D — der Testzugang und der Abschluss**

  9. `src/SignalGroup.ts` — einziger Eingriff in Produktionscode, additiv, ohne Verhaltensänderung. Neben `clearGroupFromFinalizer` (Zeile 43–56), das denselben Zweck für `SignalGroup.teardown.spec.ts` erfüllt, ein zweiter `@internal`-Zugang:
     ```ts
     /**
      * @internal Test seam for the cycle guard in `attachGroup()`.
      *
      * The guard rejects every edge that would close a cycle, so a cyclic parent
      * chain cannot be built through the public API — and the Floyd branch that
      * catches one anyway would stay forever untested. This is the only way in.
      * Never call it from production code.
      */
     export const $setParentGroup = Symbol.for(
       '@spearwolf/signalize/setParentGroup',
     );
     ```
     direkt über `type SignalNameType` (Zeile 68), und in der Klasse — hinter `detachGroup()`, also nach Zeile 302 — die Methode:
     ```ts
     /** @internal See {@link $setParentGroup}. */
     [$setParentGroup](parent: SignalGroup | undefined): void {
       this.#parentGroup = parent;
     }
     ```
     Symbolgetastete interne Methoden sind Hausstil (`EffectImpl[$destroySignal]`, `src/EffectImpl.ts:536`), und `const` + `Symbol.for()` liefert TypeScript den `unique symbol`, den ein berechneter Klassenmember braucht. Das Symbol bleibt **in `SignalGroup.ts`** und wandert nicht nach `constants.ts`: dort stehen die Schlüssel, die in Produktion Modulgrenzen überqueren. Und es wird **nicht** in `src/index.ts` re-exportiert — `index.ts:23` exportiert aus dieser Datei namentlich nur `getSignalGroupsCount` und `SignalGroup`, die Öffentlichkeit sieht davon nichts.
  10. `CHANGELOG.md` — eine Zeile unter der bestehenden Überschrift `### Tests`, englisch, ein Fakt: dass die beiden `SignalGroup`-Tests für Detach jetzt `memberCounts` assertieren statt über einen Re-Attach zu argumentieren, dass jede Sammelstelle in `off()`/`clear()` einen eigenen werfenden Teardown hat, und dass der Floyd-Zweig der Zyklus-Wache über einen `@internal`-Testzugang erreichbar geworden ist. Finding-IDs `(TEST-001, TEST-004, TEST-009)` ans Ende.
  11. Kein Eintrag in `docs/`, `AGENTS.md` oder `skills/using-signalize/`: die öffentliche API ändert sich nicht, `$setParentGroup` ist kein Teil davon.
  12. Gegenprobe vor dem Commit: der Coverage-Lauf muss für `src/SignalGroup.ts` von den fünfzehn ungedeckten Zeilen nur noch `224, 228` übrig lassen. Bleibt eine der Zielzeilen stehen, greift die zugehörige Konstruktion nicht — dann liegt der Fehler an der Reihenfolgeannahme in der jeweiligen Mechanik, nicht am Test.
- Verify: `pnpm check && pnpm compile && pnpm test && pnpm test:gc`
- Commit: `test(group): cover the teardown error collection, the detach assertions and the cycle guard (TEST-001, TEST-004, TEST-009)`
- Abgleich (2026-08-07): TEST-001 unverändert — `src/SignalGroup.spec.ts:323` (`detachGroup() removes child group`) und `:616` (`clear() detaches from parent group`) enthalten weiterhin kein einziges `expect()` · TEST-004 unverändert — alle acht `errors.push(err)` stehen noch auf `src/SignalGroup.ts:711,731,746,757,788,798,814,822`, und der Coverage-Lauf vom 2026-08-07 weist exakt diese acht als ungedeckt aus (dazu eine neunte, vom Audit nicht genannte Stelle in `clear()`: Zeile 829) · TEST-009 unverändert im Kern, aber in der Fundstelle zu grob: der `throw` in `src/SignalGroup.ts:269` **ist** gedeckt, `src/SignalGroup.spec.ts:1092` (`attachGroup() rejects a transitive cycle`) läuft dort hinein; ungedeckt sind sein Durchfall und die Zeilen 271, 272, 274, 275

**TEST-001 · high · src/SignalGroup.spec.ts:323 · src/SignalGroup.spec.ts:616** — Die zwei assertionsfreien SignalGroup-Tests ersetzen
`detachGroup() removes child group` und `clear() detaches from parent group` enthalten keine einzige Assertion. Beide prüfen ihre Behauptung indirekt über »danach kann das Kind woanders angehängt werden« — genau das kann es aber ohnehin, wie der unmittelbar folgende Test beweist: `attachGroup()` hängt selbstständig um. Beide Tests bleiben grün, wenn man `detachGroup()` und die Detach-Logik in `clear()` zu No-ops macht. Der passende Prüfstein liegt daneben und wird nicht benutzt.
Empfehlung: Nach dem Detach `expect(getGroupMemberCounts(parent).groups).toBe(0)` assertieren, statt über einen Re-Attach zu argumentieren.

**TEST-004 · medium · src/SignalGroup.ts:711,731,746,757,788,798,814,822** — Die Fehleraggregation in SignalGroup.off() und clear() testen
Beide Teardown-Methoden umschließen jeden Schritt mit `try/catch` und sammeln die Fehler in einem Array, das am Ende als `AggregateError` geworfen wird. Acht dieser `errors.push(err)`-Zeilen sind unbedeckt — kein Test lässt in `off()` oder `clear()` einen Destroy-Hook, ein Child-Group-Teardown, ein `destroySignal()` oder ein `link.destroy()` werfen. Die zugesagte Eigenschaft »ein werfender Teardown-Hook bricht den Rest nicht ab« ist für Gruppen damit teilweise unbewiesen, während sie im CHANGELOG als Bugfix steht.
Empfehlung: Je einen Test für `off()` und `clear()` mit einem werfenden `link.destroy()` bzw. einem werfenden Child-Group-Teardown ergänzen.

**TEST-009 · medium · src/SignalGroup.ts:271** — Die untestete Hälfte der Zyklus-Erkennung in attachGroup() schließen
Die Parent-Kette wird mit einem Hase-Igel-Verfahren auf Zyklen geprüft. Der erste Abbruch ist bedeckt, der zweite Schritt und die daraus folgende Erkennung eines bereits zyklischen Elternpfads — inklusive des `throw` — nie. Ein Schutzmechanismus gegen eine Endlosschleife, der noch nie ausgelöst hat, ist ein Schutzmechanismus mit unbekanntem Verhalten, und der Fehlerfall ist hier eine hängende Traversierung, kein sauberer Fehler.
Empfehlung: Über die interne API einen zyklischen Elternpfad konstruieren und den erwarteten `Error` assertieren.

#### [x] 3. Die dokumentierte, aber ungetestete API abdecken
- Findings: TEST-003 (high), TEST-002 (high)
- Ziel: `Signal#muted`, `findObjectSignals()`, `readAsValue`, die `[obj, name]`-Überladung von `touch()` und der Prioritäts-Splice in `batch()` bekommen Tests.
- Bereich: neu `src/object-signals.spec.ts`, dazu `src/decorators.signal.spec.ts`, `src/createSignal.mutedWrites.spec.ts`, `src/batch.spec.ts`
- Hängt ab von: —
- Modell: mittlere Stufe
- Hash: `43e76dd`
- Ergebnis (2026-08-07): TEST-002 und TEST-003 behoben, Review ohne Qualitätsbefund. Der Reviewer hat den Splice-Zweig gegen die `push`-Mutation gegengeprüft (Reihenfolge kippt, Test bricht) und die Isolation der neuen Spec-Datei per Einzellauf bestätigt. Verify selbst gelaufen: check ✓ (79 Dateien) · compile ✓ · test ✓ 402 passed / 9 skipped. `Signal.ts`, `object-signals.ts`, `decorators.ts`, `touch.ts` und `batch.ts` fallen vollständig aus der Uncovered-Tabelle. Gesamt-Branch 91,05 % → 93,57 %, Statements 97,83 % → 98,82 %. Kein Produktionscode angefasst.
- Nebenbefunde: keine. Der Doku-Abgleich über `docs/api.md`, `docs/cheat-sheet.md`, `docs/recipes.md`, `README.md` und die `touch()`-JSDoc ergab keinen Widerspruch zum Code — die fünf Verhaltensweisen waren korrekt beschrieben, nur nie geprüft.
- Dateien: neu `src/object-signals.spec.ts`, `src/decorators.signal.spec.ts`, `src/createSignal.mutedWrites.spec.ts`, `src/batch.spec.ts`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Kein Produktionscode wird angefasst — dieses Paket schreibt ausschließlich Tests. Der Coverage-Lauf vom 2026-08-07 (`pnpm test`, nach Paket 2) meldet für die fünf Dateien dieses Pakets:

  | Datei | ungedeckte Zeilen | ungedeckte Zweige (lcov `BRDA`) | was dort steht |
  | --- | --- | --- | --- |
  | `src/Signal.ts` | 45, 49 | — | `get muted()` und `set muted()` |
  | `src/object-signals.ts` | 28, 29, 30, 32, 42 | 29/1/0, 29/1/1, 39/2/1, 57/3/1, 59/4/1 | `findObjectSignals()` komplett; `return undefined` in `findObjectSignalNames()`; beide Negativzweige von `destroyObjectSignals()` |
  | `src/decorators.ts` | 32 | 29/2/1, 30/3/0 | `return undefined` im Getter; der `readAsValue === true`-Ast des Ternärs |
  | `src/touch.ts` | — (18-22 im Textreport = Zweigbereich) | 18/0/1, 22/1/1 | der `[obj, name]`-Zweig des Ternärs; der Else-Fall der Wächter-`if` |
  | `src/batch.ts` | 22, 23 | 18/1/1, 40/2/1 | der Splice-Einfügepfad; der Nicht-`RECALL`-Fall des Catch-all-Listeners in `run()` |

  Fünf dieser Zweige nennt das Audit nicht: `object-signals.ts` 57 und 59, `touch.ts` 22 und `batch.ts` 40 (dazu `decorators.ts` 29). Sie werden mitgenommen — sie liegen in denselben Funktionen, kosten je zwei bis vier Zeilen und heben die fünf Dateien geschlossen auf 100 %, was Paket 5 als Schwellenwert einfrieren kann.

  **A — die neue Datei `src/object-signals.spec.ts` (TEST-003)**

  Die Datei deckt vier Funktionen ab: `findObjectSignals()`, `findObjectSignalNames()` (nur dessen `undefined`-Rückgabe, der Positivfall ist über `decorators.signal.spec.ts:149` schon gedeckt), `destroyObjectSignals()` (beide Negativzweige) und die `[obj, name]`-Überladung von `touch()`. `storeAsObjectSignal()` ist der Weg, ohne Dekorator einen Objekt-Store anzulegen; die Datei importiert direkt aus `./object-signals.js`, weil `storeAsObjectSignal` nicht über `src/index.ts` re-exportiert wird (`SignalGroup.teardown.spec.ts:16` importiert genauso).

  1. Kopf der neuen Datei:
     ```ts
     import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
     import {createSignal} from './createSignal.js';
     import {
       destroyObjectSignals,
       findObjectSignalByName,
       findObjectSignalNames,
       findObjectSignals,
       storeAsObjectSignal,
     } from './object-signals.js';
     import {touch} from './touch.js';

     describe('object signals', () => {
       beforeEach(() => {
         assertEffectsCount(0, 'beforeEach');
         assertSignalsCount(0, 'beforeEach');
       });

       afterEach(() => {
         assertEffectsCount(0, 'afterEach');
         assertSignalsCount(0, 'afterEach');
       });
     ```
     `describe`, `it`, `expect`, `vi` sind global (Vitest `globals`), werden also nicht importiert.
  2. `it('findObjectSignals() and findObjectSignalNames() return undefined for an object without a store')` — trifft `object-signals.ts:29` (Else) → `32` und `39` (Else) → `42`, jeweils über den Weg »die `WeakMap` kennt das Objekt gar nicht«:
     ```ts
     const host: Record<string, unknown> = {alreadyAPlainProperty: 1};

     expect(findObjectSignals(host)).toBeUndefined();
     expect(findObjectSignalNames(host)).toBeUndefined();
     expect(findObjectSignalByName(host, 'alreadyAPlainProperty')).toBeUndefined();
     ```
  3. `it('findObjectSignals() lists the signals of an object in insertion order')` — trifft `28`, `29` (Then), `30`:
     ```ts
     const host: Record<string | symbol, unknown> = {};
     const sym = Symbol('xyz');

     const foo = createSignal(1);
     const bar = createSignal('a');
     const xyz = createSignal(true);

     storeAsObjectSignal(host, 'foo', foo);
     storeAsObjectSignal(host, 'bar', bar);
     storeAsObjectSignal(host, sym, xyz);

     const signals = findObjectSignals(host);

     expect(signals).toHaveLength(3);
     expect(signals[0]).toBe(foo);
     expect(signals[1]).toBe(bar);
     expect(signals[2]).toBe(xyz);

     // the names come from the same Map, symbol keys included
     expect(findObjectSignalNames(host)).toEqual(['foo', 'bar', sym]);

     destroyObjectSignals(host);
     ```
     Identität statt `toEqual` auf den `Signal`-Instanzen: ein Deep-Compare über `Signal` zieht die ganze `ISignalImpl` mit und sagt nichts über die Reihenfolge aus.
  4. `it('destroyObjectSignals() destroys the signals and drops the map')` — trifft den zweiten Weg in `29` (Else) → `32` und `39` (Else) → `42`: der Store existiert weiter, `store.signals` ist `undefined`:
     ```ts
     const host: Record<string, unknown> = {};
     const foo = createSignal(1);
     const bar = createSignal('a');

     storeAsObjectSignal(host, 'foo', foo);
     storeAsObjectSignal(host, 'bar', bar);
     assertSignalsCount(2, 'after storeAsObjectSignal');

     destroyObjectSignals(host);

     assertSignalsCount(0, 'after destroyObjectSignals');
     expect(findObjectSignals(host)).toBeUndefined();
     expect(findObjectSignalNames(host)).toBeUndefined();
     expect(findObjectSignalByName(host, 'foo')).toBeUndefined();
     ```
  5. `it('destroyObjectSignals() ignores an unknown object and a second call')` — trifft `57` (Else) und `59` (Else):
     ```ts
     // never seen by the WeakMap at all
     expect(() => destroyObjectSignals({neverStored: true})).not.toThrow();

     const host: Record<string, unknown> = {};
     storeAsObjectSignal(host, 'foo', createSignal(1));

     destroyObjectSignals(host);
     assertSignalsCount(0, 'after the first call');

     // the store survives in the WeakMap, only its map is gone — the second
     // call must fall through both guards instead of dereferencing undefined
     expect(() => destroyObjectSignals(host)).not.toThrow();
     assertSignalsCount(0, 'after the second call');
     ```
  6. `it('touch([obj, name]) notifies through the object store')` — trifft den `false`-Ast des Ternärs in `touch.ts:18`, also die per JSDoc zugesagte zweite Überladung:
     ```ts
     const host: Record<string, unknown> = {};
     const foo = createSignal(1);
     storeAsObjectSignal(host, 'foo', foo);

     const onChange = vi.fn();
     const unsubscribe = foo.onChange(onChange);

     touch([host, 'foo']);

     expect(onChange).toHaveBeenCalledTimes(1);
     expect(onChange).toHaveBeenCalledWith(1);

     unsubscribe();
     destroyObjectSignals(host);
     ```
     `onChange()` ist ein Static-Deps-Effect und läuft bei der Erzeugung **nicht** an (`EffectImpl.ts:385-391`) — die erste Zählung stammt garantiert vom `touch()`. Der Aufruf `touch([host, 'foo'])` wählt die zweite Überladung, weil ein Array `SignalLike` (`types.ts:68`, verlangt `[$signal]`) nicht erfüllt; dasselbe Muster steht als `value([foo, 'foo'])` schon in `decorators.signal.spec.ts:38`.
  7. `it('touch([obj, name]) is a no-op when no signal is stored under that name')` — trifft den Else-Fall der Wächter-`if` in `touch.ts:22` über `signal == null`:
     ```ts
     const host: Record<string, unknown> = {};
     const foo = createSignal(1);
     storeAsObjectSignal(host, 'foo', foo);

     const onChange = vi.fn();
     const unsubscribe = foo.onChange(onChange);

     // the name is not in the store …
     expect(() => touch([host, 'bar'])).not.toThrow();
     // … and this object has no store at all
     expect(() => touch([{other: 1}, 'other'])).not.toThrow();

     expect(onChange).not.toHaveBeenCalled();

     unsubscribe();
     destroyObjectSignals(host);
     ```
     `findObjectSignalByName()` liefert `undefined`, `signalImpl(undefined)` ist wegen `sig?.[$signal]` (`signal-core.ts:64`) ebenfalls `undefined` — der Wächter fängt es ab, statt zu werfen. Genau das ist die Zusage, die hier geprüft wird.

  **B — `src/createSignal.mutedWrites.spec.ts` (TEST-003, `Signal.ts:45,49` und `touch.ts:22`)**

  Beide neuen Tests kommen ans Ende des bestehenden `describe('writes on muted or destroyed signals')` (nach Zeile 137). Die `beforeEach`/`afterEach`-Bilanz der Datei gilt mit; `muteSignal`, `unmuteSignal`, `destroySignal`, `createSignal` sind schon importiert, nichts kommt hinzu.

  8. `it('Signal#muted reads and writes the same flag as muteSignal()/unmuteSignal()')`:
     ```ts
     const sig = createSignal(1);
     const onChange = vi.fn();
     const unsubscribe = sig.onChange(onChange);

     expect(sig.muted).toBe(false);

     sig.muted = true;
     expect(sig.muted).toBe(true);

     sig.set(2);
     sig.touch(); // touch() is suppressed on a muted signal too
     expect(onChange).not.toHaveBeenCalled();

     // the free functions and the accessor read and write the same flag
     unmuteSignal(sig);
     expect(sig.muted).toBe(false);
     muteSignal(sig);
     expect(sig.muted).toBe(true);

     sig.muted = false;
     expect(sig.muted).toBe(false);

     // now touch() gets through and pushes the value written while muted
     sig.touch();
     expect(onChange).toHaveBeenCalledTimes(1);
     expect(onChange).toHaveBeenCalledWith(2);

     unsubscribe();
     destroySignal(sig);
     ```
     Der Getter (`Signal.ts:45`) wird sechsmal gelesen, der Setter (`Zeile 49`) dreimal geschrieben; das `sig.touch()` im gemuteten Zustand trifft den Else-Fall von `touch.ts:22` über `!signal.muted`. Die Zusage steht wörtlich in der JSDoc von `muteSignal()` (`signal-core.ts:95`: »only the notification is suppressed — as is `touch()`«) und in `docs/api.md:39`.
  9. `it('touch() on a destroyed signal does not notify')` — dritter Wächter, `!signal.destroyed`:
     ```ts
     const sig = createSignal(1);
     const onChange = vi.fn();
     const unsubscribe = sig.onChange(onChange);

     sig.set(2);
     expect(onChange).toHaveBeenCalledTimes(1);

     destroySignal(sig);

     sig.touch();
     expect(onChange).toHaveBeenCalledTimes(1);

     unsubscribe();
     ```
     `unsubscribe()` am Ende ist idempotent und hält die `afterEach`-Bilanz auch dann, wenn `destroySignal()` den Effect nicht schon selbst abgeräumt hat.

  **C — `src/decorators.signal.spec.ts` (TEST-003, `decorators.ts:29,30,32`)**

  Beide neuen Tests kommen ans Ende des bestehenden `describe('@signal is a class accessor decorator')` (nach Zeile 154). Die Dekorator-Klasse wird — wie in allen vier vorhandenen Tests der Datei — **im Rumpf des `it()`** deklariert. Das trägt: die Spec läuft unter Vitest, und `vitest.config.ts` setzt `oxc: false` und registriert `unplugin-swc` mit `decoratorVersion: '2022-03'` (`AGENTS.md:183`). SWC senkt die TC39-Dekoratoren, `tsc` sieht diese Datei im Testlauf nicht. Eine separate Datei oder ein Umzug nach oben ist nicht nötig und wäre ein Bruch mit dem Stil der Datei.

  10. Die Import-Liste aus `./index.js` (Zeilen 3–11) um `createEffect` und `createSignal` erweitern.
  11. `it('readAsValue: true makes the property getter an untracked read')` — trifft `decorators.ts:30`, Ast `readAsValue === true`:
      ```ts
      class Foo {
        @signal({readAsValue: true}) accessor foo = 1;
      }

      const foo = new Foo();

      expect(foo.foo).toBe(1);
      assertSignalsCount(1, 'after new Foo');

      const tick = createSignal(0);
      const runs: number[] = [];

      const eff = createEffect(() => {
        tick.get();
        runs.push(foo.foo);
      });

      expect(runs).toEqual([1]);

      // the write notifies the property's own signal, but the effect never
      // subscribed to it — with the default (tracking) getter it would rerun
      foo.foo = 2;
      expect(foo.foo).toBe(2);
      expect(runs).toEqual([1]);

      // a tracked dependency does rerun it, and the untracked read then shows
      // the value that was written in between
      tick.set(1);
      expect(runs).toEqual([1, 2]);

      eff.destroy();
      destroyObjectSignals(foo);
      destroySignal(tick);
      ```
      Der `tick`-Read ist nicht Dekoration, sondern Konstruktion: ein Effect ohne jede getrackte Abhängigkeit räumt sich seit `469e7d1` am Ende des äußersten Laufs selbst ab, und die Aussage »der Property-Read hat nichts abonniert« wäre ohne einen zweiten, echten Trigger nicht von »der Effect ist tot« zu unterscheiden. Mutationsprobe: entfernt man `readAsValue: true`, liest der Getter über `si.get()`, `foo.foo = 2` löst einen Rerun aus und `expect(runs).toEqual([1])` schlägt fehl.
  12. `it('the property getter returns undefined once the object signals are destroyed')` — trifft den Else-Ast von `decorators.ts:29` und damit Zeile `32`:
      ```ts
      class Foo {
        @signal() accessor foo = 1;
      }

      const foo = new Foo();
      expect(foo.foo).toBe(1);

      destroyObjectSignals(foo);

      // the store is empty, so the accessor has nothing left to read from
      expect(foo.foo).toBeUndefined();

      // and the setter falls through its optional chain instead of throwing
      expect(() => {
        foo.foo = 42;
      }).not.toThrow();
      expect(foo.foo).toBeUndefined();
      ```

  **D — `src/batch.spec.ts` (TEST-002, `batch.ts:22,23` und Zweig `40`)**

  Alle drei Tests kommen in ein neues, verschachteltes `describe('effect priority inside a batch (TEST-002)', () => {…})` am Ende von `describe('batch')` (nach Zeile 289). Zusätzlich zu importieren: `createMemo` aus `./createMemo.js`. `batch`, `createSignal`, `createEffect`, `destroySignal` sind schon da.

  Die Mechanik, auf der die ersten beiden Tests aufsitzen: `Batch#batch()` hält `delayedEffects` absteigend nach Priorität sortiert und läuft die Liste von vorn durch — `prio > priority` überspringt, `prio === priority` sammelt ein, und erst `prio < priority` splict den neuen Eintrag **vor** den kleineren (Zeile 22). Innerhalb *eines* Signal-Writes stellt eventize schon nach Priorität zu, der höher priorisierte Effect steht also immer zuerst in der Liste und die Schleife läuft in den `push` am Ende. Der Splice braucht deshalb **zwei verschiedene Signale in einem Batch**, das niedrig priorisierte zuerst geschrieben. Genau daran scheitert der bestehende Batch-Test in `effects.priority.spec.ts:58` — er schreibt nur `a`.

  13. `it('a higher-priority effect is spliced in front of one already queued')` — der deterministische Mutationskiller:
      ```ts
      const low = createSignal(0);
      const high = createSignal(0);

      const callQueue: string[] = [];

      const lowEffect = createEffect(
        () => {
          low.get();
          callQueue.push('low');
        },
        {priority: 0},
      );

      const highEffect = createEffect(
        () => {
          high.get();
          callQueue.push('high');
        },
        {priority: 1000},
      );

      expect(callQueue).toEqual(['low', 'high']);
      callQueue.length = 0;

      batch(() => {
        low.set(1); // queued first at priority 0
        high.set(1); // priority 1000 → must be spliced in front of that bucket
      });

      expect(callQueue).toEqual(['high', 'low']);

      lowEffect.destroy();
      highEffect.destroy();
      destroySignal(low, high);
      ```
      Ablauf im Batch: `low.set(1)` → `delayedEffects = [[0, {low}]]`; `high.set(1)` → `i=0`, `0 > 1000` nein, `0 === 1000` nein → `splice(0, 0, [1000, {high}])`. Der Flush läuft die Liste von vorn: `high`, dann `low`. Ersetzt man den Splice durch einen `push`, ist die Reihenfolge `['low', 'high']` und der Test fällt.
  14. `it('a memo queued after a plain effect still recomputes first')` — dieselbe Zeile, aber als die vom Audit benannte Alltagskombination (Memos laufen auf `Priority.C` = 1000, gewöhnliche Effects auf 0):
      ```ts
      const source = createSignal(1);
      const other = createSignal('a');

      const callQueue: string[] = [];

      const memo = createMemo(() => {
        callQueue.push('memo');
        return source.get() * 10;
      });

      const eff = createEffect(() => {
        other.get();
        callQueue.push('effect');
      });

      expect(callQueue).toEqual(['memo', 'effect']);
      expect(memo()).toBe(10);
      callQueue.length = 0;

      batch(() => {
        other.set('b'); // the plain effect goes into the queue first
        source.set(2); // the memo has to jump the queue
      });

      expect(callQueue).toEqual(['memo', 'effect']);
      expect(memo()).toBe(20);

      eff.destroy();
      destroySignal(source, other, memo);
      ```
      Der Memo ist nicht `lazy`, sein interner Effect läuft also bei der Erzeugung an und wird bei `source.set(2)` regulär über `[RECALL]` in den Batch eingereiht. `expect(memo())` steht jeweils **nach** der `callQueue`-Assertion, damit ein etwaiger Nachrechen-Read die Erwartung nicht verfälscht.
  15. `it('Batch.run() ignores queue events that are not a RECALL')` — trifft den vom Audit nicht genannten Else-Zweig in `batch.ts:40`:
      ```ts
      const a = createSignal(0);
      const inner = createSignal('x');
      const seen: string[] = [];

      const outer = createEffect(() => {
        const v = a.get();
        // born during the flush: createEffect() emits $createEffect on
        // globalEffectQueue, and the wildcard listener Batch.run() installs
        // sees it with actionType === undefined
        createEffect(() => {
          seen.push(`${v}:${inner.get()}`);
        });
      });

      expect(seen).toEqual(['0:x']);

      batch(() => {
        a.set(1);
      });

      expect(seen).toEqual(['0:x', '1:x']);

      outer.destroy();
      destroySignal(a, inner);
      ```
      Warum das trägt: `Batch.run()` abonniert `globalEffectQueue` als Wildcard (`on(globalEffectQueue, fn)`), und Wildcard-Function-Listener bekommen in eventize **nicht** den Event-Namen, sondern nur die Emit-Argumente. `emit(globalEffectQueue, effectId, effectId, RECALL)` liefert `(effectId, RECALL)`, `emit(globalEffectQueue, $createEffect, effect)` (`EffectImpl.ts:383`) dagegen nur `(effect)` — `actionType` ist `undefined`, die `if`-Bedingung greift nicht, und nichts darf in `alreadyBeenCalled` landen. Der innere Effect läuft im Flush sofort an, weil `batch()` `Batch.current` im `finally` löscht, **bevor** es `curBatch.run()` aufruft (`batch.ts:126-131`). `outer.destroy()` nimmt den Kind-Effect mit.

  **E — Abschluss**

  16. `CHANGELOG.md` — eine Zeile unter der bestehenden Überschrift `### Tests` (Zeile 75, letzter Aufzählungspunkt heute Zeile 79), englisch, ein Fakt: dass `Signal#muted`, `findObjectSignals()`, die `undefined`-Rückgaben von `object-signals.ts`, die Dekorator-Option `readAsValue`, die `[obj, name]`-Überladung von `touch()` samt ihrer Wächter und der Prioritäts-Splice in `batch()` jetzt Tests haben, und dass `src/object-signals.spec.ts` die bis dahin fehlende Spec-Datei zu diesem Modul ist. Finding-IDs `(TEST-002, TEST-003)` ans Ende.
  17. Keine Änderung an `docs/`, `README.md`, `AGENTS.md` oder `skills/using-signalize/`: die öffentliche API bleibt unverändert. Alle fünf getesteten Verhaltensweisen sind bereits dokumentiert — `docs/api.md:39` (`muted`), `:525` (`findObjectSignals`), `:546` (`readAsValue`), `docs/cheat-sheet.md:26,165,179`, `docs/recipes.md:573`, `README.md:129`, `src/touch.ts:5-11` (Tupel-Überladung). Der Abgleich am 2026-08-07 hat zwischen diesen Stellen und dem Code **keinen** Widerspruch ergeben. Falls beim Schreiben doch einer auftaucht — ein Test, der die Doku nur grün bekommt, wenn er von ihr abweicht —, ist das ein Befund für den Report und wird **nicht** still in der Doku oder im Test geglättet.
  18. Gegenprobe vor dem Commit: der Coverage-Lauf muss `src/Signal.ts`, `src/object-signals.ts`, `src/decorators.ts`, `src/touch.ts` und `src/batch.ts` auf je 100 % Statements/Branches/Functions/Lines zeigen — für diese fünf Dateien darf keine Zeile mehr in der Spalte »Uncovered Line #s« stehen. Bleibt eine stehen, greift die zugehörige Konstruktion nicht; der Fehler liegt dann in der Reihenfolgeannahme des jeweiligen Tests, nicht im Produktionscode. Die Ist-Werte dieser fünf Dateien gehören in den Report, weil Paket 5 sie als Schwellen einfriert.
- Verify: `pnpm check && pnpm compile && pnpm test`
- Commit: `test(api): cover muted, object signals, readAsValue, the touch() tuple and the batch priority splice (TEST-002, TEST-003)`
- Abgleich (2026-08-07): TEST-002 unverändert — `src/batch.ts:22` ist weiterhin der Splice, `grep -c priority src/batch.spec.ts` liefert `0`, und der Coverage-Lauf nach Paket 2 weist `22,23` als ungedeckt aus; ergänzend zur Audit-Fundstelle ist auch der Else-Zweig von `src/batch.ts:40` ungedeckt (Schritt 15) · TEST-003 unverändert in allen vier Fundstellen — `src/Signal.ts:44` (`get muted()`, ungedeckt `45,49`), `src/object-signals.ts:25` (`findObjectSignals`, ungedeckt `28-32`), `src/decorators.ts:30` (`readAsValue`-Ternär, `true`-Ast ungedeckt) und `src/touch.ts:18` (`isSignal`-Ternär, `false`-Ast ungedeckt); die Fundstellenliste des Audits ist dabei zu knapp: ungedeckt sind zusätzlich `object-signals.ts:39,57,59`, `decorators.ts:29` und der Else-Fall von `touch.ts:22`, alle in denselben Funktionen

**TEST-003 · high · src/Signal.ts:44 · src/object-signals.ts:25 · src/decorators.ts:30 · src/touch.ts:18** — Die dokumentierten, aber ungetesteten API-Teile abdecken
Vier öffentlich dokumentierte Verhaltensweisen ohne jeden Test. `Signal#muted` (Getter und Setter) taucht in keiner Spec auf. `findObjectSignals()` steht in README und `docs/api.md`, wird aber in keiner Spec importiert; sein kompletter Rumpf ist unbedeckt. Die Dekorator-Option `readAsValue` ist an vier Doku-Stellen beschrieben und ihr `true`-Zweig unbedeckt. Und die zweite Überladung von `touch()` für `[obj, name]`-Tupel ist per JSDoc zugesagt, aber nie aufgerufen. `object-signals.ts` hat entgegen der Projektkonvention überhaupt keine Spec-Datei.
Empfehlung: Eine `src/object-signals.spec.ts` anlegen und die vier Pfade dort bzw. in `decorators.signal.spec.ts` und `createSignal.mutedWrites.spec.ts` abdecken.
Evidenz (Audit): `lcov uncovered: Signal.ts 45,49 · object-signals.ts 28,29,30,32,42 · decorators.ts 32 (Branch 29,30) · touch.ts Branch 18`

**TEST-002 · high · src/batch.ts:22 · src/batch.spec.ts** — Die Prioritätsordnung in batch() testen — der Einfügepfad ist unbedeckt
`Batch#batch()` fügt Effects sortiert nach Priorität ein; der Splice-Zweig für »neue Priorität ist höher als eine bereits eingereihte« wird von keinem Test erreicht. `batch.spec.ts` enthält das Wort `priority` kein einziges Mal. Damit ist ausgerechnet die Kombination zweier beworbener Kernzusagen ungetestet — prioritätsgeordnete Effects (Memos bei 1000, Effects bei 0) und »batch() lässt eine Gruppe von Writes wie eine Transaktion aussehen«. Ein Memo, das in einem Batch nach einem gewöhnlichen Effect eingereiht wird, läuft genau durch diesen Zweig.
Empfehlung: Einen Test ergänzen, der in einem `batch()` erst einen Effect mit Priorität 0 und dann ein Memo auslöst, und die Ausführungsreihenfolge nach dem Flush assertieren.
Evidenz (Audit): `lcov: batch.ts uncovered lines 22,23 · grep -n "priority" src/batch.spec.ts -> keine Treffer`

#### [x] 4. SignalLink.spec: Wanduhr raus, Rejection-Prüfungen anheben
- Findings: TEST-011 (low), TEST-015 (info)
- Ziel: Keine Assertion hängt mehr an einer Echtzeitschwelle, und alle zehn Rejection-Prüfungen der Datei sind gleich streng.
- Bereich: `src/SignalLink.spec.ts`
- Hängt ab von: —
- Modell: mittlere Stufe
- Hash: `96dff42`
- Ergebnis (2026-08-07): TEST-011 und TEST-015 behoben. Eine Review-Runde: der erste Anlauf überzeichnete im Kommentar die Beweiskraft des ASYNC-005-Tests (`wichtig`), Runde 1 hat den Kommentar auf das zurückgezogen, was der Test zeigt; der Reviewer hat gegengeprüft, dass nur der Kommentartext gewandert ist. Der Test lief 25× isoliert grün. Verify selbst gelaufen: check ✓ · compile ✓ · test ✓ 402 passed / 9 skipped · test:gc ✓ 411 passed. Kein Produktionscode angefasst. `grep "setTimeout\|toBeDefined" src/SignalLink.spec.ts` ist leer.
- Nebenbefunde: **Der bestehende ASYNC-005-Test kann seine Kernbehauptung nicht widerlegen.** Implementierer und Reviewer haben unabhängig voneinander die Mutation `src/SignalLink.ts:314` (`this.#activeAsyncValuesCount === 0` → `>= 0`) gefahren und den Test grün gesehen: `retainClear()` aus eventize löscht nur den gespeicherten Wert, nicht die Retain-Policy, und das `sigA.set(3)` in `src/SignalLink.spec.ts:438` befüllt den Slot zwischen `iter1.return()` und `iter2.next()` ohnehin neu. Das ist derselbe Mechanismus, den **MEM-004** beschreibt — der Nebenbefund gehört damit zu **Paket 14** und ist dort beim Detailplan zu berücksichtigen: der Regressionstest für MEM-004 darf nicht auf dieser Konstruktion aufsetzen.
- Dateien: `src/SignalLink.spec.ts`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Kein Produktionscode wird angefasst — drei Assertionen in einer Spec-Datei, sonst nichts. Beide Findings wurden am 2026-08-07 am Code nachgeprüft, die Zeilennummern stimmen unverändert. Zwei Punkte, die das Audit offen lässt, sind vorab gegen `lib/` (Stand `c6ccd0b`) gemessen worden; die Messergebnisse tragen die Schritte 1 bis 3 und werden dort jeweils genannt.

  **A — TEST-015: die zwei laxen Rejection-Prüfungen**

  `nextValue()` hat genau drei Ablehnungsgründe, und die beiden Abort-Pfade werfen beide exakt `signal.reason` weiter: `src/SignalLink.ts:172` (bereits abgebrochen, früher `return` aus dem Promise-Executor) und `src/SignalLink.ts:222` (`onAbort` während des Wartens). Der dritte Pfad — Zerstörung — wirft einen frisch gebauten `Error` (`:184`, `:214`). Der Kommentar in `asyncValues()` (`src/SignalLink.ts:300-305`) baut auf genau dieser Unterscheidung auf. Gemessen am 2026-08-07: beide Abort-Pfade liefern `err === controller.signal.reason` → `true`, die `reason` ist die `DOMException` mit `name === 'AbortError'`, die `controller.abort()` ohne Argument erzeugt. `controller` ist an beiden Fundstellen im Scope (deklariert in `:118` bzw. `:134`). Die Audit-Empfehlung trägt also wörtlich, ohne Message-Fallback.

  1. `src/SignalLink.spec.ts:121-123`, im `it('nextValue({signal}) rejects immediately when the signal is already aborted')` — die drei Zeilen ersetzen:
     ```ts
     await expect(con.nextValue({signal: controller.signal})).rejects.toBe(
       controller.signal.reason,
     );
     ```
     Der Umbruch ist der von Biome bei `lineWidth: 80` erzwungene und deckt sich mit der Form, die `:195-199` in derselben Datei schon hat.
  2. `src/SignalLink.spec.ts:142`, im `it('nextValue({signal}) rejects once the signal aborts while pending, …')` — eine Zeile:
     ```ts
     await expect(pending).rejects.toBe(controller.signal.reason);
     ```
     Die beiden `getEventListeners(controller.signal, 'abort').length`-Assertionen dieses Tests (`:138`, `:143`) bleiben unangetastet — sie prüfen den Leak, nicht die Ablehnung.
  3. Nichts sonst in diesen beiden Tests anfassen. Insbesondere **nicht** die naheliegenden Erweiterungen: kein `getEventListeners(...).toBe(0)` im ersten Test (der Früh-Return registriert nie einen Listener, das ist eine andere Aussage als die des Findings), keine zusätzliche `name`/`message`-Prüfung auf der `DOMException` (die beiden Vorbilder `:309` und `:327` machen sie auch nicht, und Gleichstand ist hier das Ziel), und keine Beweisführung für das »immediately« im Testnamen. TEST-015 ist ein Rigorositäts-Angleich, kein Ausbau.

  **B — TEST-011: die Wanduhr im ASYNC-005-Test**

  Der Test in `src/SignalLink.spec.ts:406-450` behauptet mehr, als ein blankes `await` behaupten kann: dass `iter2.next()` **gewinnt**. Der Ausfallmodus, gegen den er sichert, ist ein Read, der nie auflöst — wenn `iter1.return()` den geteilten Retain-Slot fälschlich leerte, hat `iter2` nichts mehr synchron nachzuspielen und hängt bis zu einer Emission, die in diesem Test nicht mehr kommt. Das Rennen ist deshalb die richtige Form; falsch ist nur der Gegner.

  Die Empfehlung des Audits (`await iter2.next()` mit `it(…, {timeout: 2000})`) wird **nicht** übernommen. Sie senkt die Aussage auf »löst irgendwann auf« und macht aus einem sofortigen `expected 'TIMEOUT' to equal {value: 3, done: false}` einen zwei Sekunden späten Vitest-Timeout ohne Bezug zur eigentlichen Behauptung. Stattdessen tritt an die Stelle der 200-ms-Schwelle ein Makrotask-Marker: `setImmediate` kann erst laufen, wenn die Microtask-Queue leer ist, und der Read von `iter2` wird ausschließlich über Microtasks fertig — der retainte `VALUE` wird synchron im `once(this, VALUE, …)` innerhalb von `nextValue()` nachgespielt (`src/SignalLink.ts:233-239`, dazu der K1-Kommentar `:194-209`); auf dem ganzen Weg steht kein einziges Timer- oder I/O-`await`. Damit ist der Ausgang des Rennens durch die Event-Loop-Ordnung festgelegt statt durch die Laufzeit eines geteilten CI-Runners. Gemessen am 2026-08-07 gegen `lib/`: der Marker verliert, `raced` ist `{value: 3, done: false}`.

  4. `src/SignalLink.spec.ts:440-443` — den `Promise.race`-Block ersetzen:
     ```ts
     const raced = await Promise.race([
       iter2.next(),
       // Not a wall-clock threshold: a macrotask can only run once the
       // microtask queue is drained, and this read settles purely in
       // microtasks — the retained VALUE replays synchronously inside
       // nextValue()'s own `once(this, VALUE, ...)`. So this sentinel wins
       // in exactly one case: iter2 having nothing left to replay and
       // hanging, which is the failure ASYNC-005 is about.
       new Promise((resolve) => setImmediate(() => resolve('TIMEOUT'))),
     ]);
     ```
     `setImmediate` ist unter `environment: 'node'` (`vitest.config.ts:30`) global und wird in `src/link.gc.spec.ts:15` und `src/SignalGroup.gc.spec.ts:22` genauso ohne Import benutzt. Kein `import` ergänzen.
  5. Der Erklärkommentar oberhalb des Blocks (`:428-437`, warum `sigA.set(3)` und nicht die Wiederholung der `2`) bleibt **wörtlich stehen**. Er begründet den Testaufbau, nicht die Schwelle.
  6. Die drei naheliegenden Alternativen sind geprüft und fallen aus:
     - **Tick-Zählen** (`await Promise.resolve()` ein- oder mehrfach, dann den Zustand prüfen) — am 2026-08-07 gemessen: nach einem Microtask-Tick ist der Read noch **nicht** fertig. Die Kettenlänge (Generator-Resume, `await`-Fortsetzung, `yield`) ist ein Implementierungsdetail und würde bei jeder Umformulierung von `asyncValues()` kippen.
     - **Vitests Fake-Timer** (`vi.useFakeTimers()`) — der Timer feuert dann nur noch auf `vi.advanceTimersByTime()`. Das Rennen wird dadurch nicht deterministisch, sondern gegenstandslos: der Marker kann gar nicht mehr gewinnen, und der Test sagt wieder nur »löst auf«. Dazu käme die Fake-Timer-Installation als einzige ihrer Art in 37 Spec-Dateien.
     - **`setTimeout(…, 0)`** — funktioniert genauso (Timer sind Makrotasks), nennt aber eine Zahl, die als Schwelle missverstanden werden kann. `setImmediate` sagt »nächster Durchlauf«, ohne eine Dauer zu behaupten.
  7. Das `{timeout: 1000}` in `:407` bleibt, wie es ist. Es ist der Vitest-Backstop des Tests, keine Assertion, und die Angleichung an die `500` der übrigen dreizehn `it()`s dieser Datei wäre Rauschen im Diff.

  **C — Abschluss**

  8. `CHANGELOG.md` — eine Zeile unter der bestehenden Überschrift `### Tests` (Zeile 75, letzter Aufzählungspunkt heute Zeile 79), englisch, ein Fakt: dass die einzige Assertion des Projekts, die an einer Echtzeitschwelle hing, jetzt gegen einen Makrotask-Marker statt gegen 200 ms läuft, und dass die beiden verbliebenen `rejects.toBeDefined()` in `SignalLink.spec.ts` nun wie die acht anderen Rejection-Prüfungen der Datei den konkreten Grund festnageln. Finding-IDs `(TEST-011, TEST-015)` ans Ende.
  9. Keine Änderung an `docs/`, `README.md`, `AGENTS.md` oder `skills/using-signalize/`: weder die öffentliche API noch eine dokumentierte Zusage bewegt sich.
  10. Mutationsproben vor dem Commit, alle drei am Arbeitsbaum durchgespielt und wieder zurückgenommen:
      - `src/SignalLink.ts:314` — die Bedingung `this.#activeAsyncValuesCount === 0` auf `>= 0` ziehen, so dass `iter1.return()` den geteilten Retain-Slot leert. Der ASYNC-005-Test muss dann mit `expected 'TIMEOUT' to equal {value: 3, done: false}` fallen, und zwar sofort, nicht nach einem Timeout. Fällt er nicht, greift der Marker nicht und der Test beweist weiterhin nichts.
      - `src/SignalLink.ts:172` — `reject(signal.reason)` durch `reject(new Error('nope'))` ersetzen. Der Test aus Schritt 1 muss fallen; unter `toBeDefined()` wäre er grün geblieben.
      - `src/SignalLink.ts:222` — dieselbe Ersetzung. Der Test aus Schritt 2 muss fallen.
  11. `src/SignalLink.spec.ts` darf danach kein `setTimeout` und kein `toBeDefined()` mehr enthalten: `grep -n "setTimeout\|toBeDefined" src/SignalLink.spec.ts` liefert null Treffer. Das ist die Abnahmeprobe des Pakets.
- Verify: `pnpm check && pnpm compile && pnpm test && pnpm test:gc`
  `pnpm test:gc` gehört hier dazu, obwohl kein GC-Pfad angefasst wird: die gc-Config erbt die Includes der Basis, führt also dieselbe Datei unter `pool: 'forks'` und `fileParallelism: false` aus. Der Makrotask-Marker soll auch dort verlieren — genau das ist die Zusage, die an die Stelle der Wanduhr tritt. Dazu ein Einzellauf `pnpm test -- SignalLink.spec.ts` für die Mutationsproben aus Schritt 10.
- Commit: `test(link): replace the wall-clock race with a macrotask sentinel and tighten the abort rejections (TEST-011, TEST-015)`
- Abgleich (2026-08-07): TEST-011 unverändert — `src/SignalLink.spec.ts:442` ist weiterhin `new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 200))` im `Promise.race` des ASYNC-005-Tests, und `grep -rn "setTimeout" src/*.spec.ts` bestätigt die Aussage des Audits: die übrigen sechs Treffer (`batch.spec.ts:246`, `effects.async.spec.ts:12,13`, `effects.cleanup.spec.ts:7`, `effects.spec.ts:14`) sind sämtlich `setTimeout(resolve, 0)`-Yields ohne Schwelle · TEST-015 unverändert — `rejects.toBeDefined()` steht noch auf `:123` und `:142`, die strengere Form auf `:309` und `:327`; ergänzend geklärt, was das Audit offen lässt: `controller` ist an beiden Fundstellen im Scope, und beide Abort-Pfade von `nextValue()` (`src/SignalLink.ts:172`, `:222`) lehnen mit exakt `signal.reason` ab — `rejects.toBe(controller.signal.reason)` trägt wörtlich, ein Message-Fallback wird nicht gebraucht

**TEST-011 · low · src/SignalLink.spec.ts:442** — Die 200-ms-Wanduhr-Race in SignalLink.spec.ts ersetzen
Der Test rennt `iter2.next()` gegen ein `setTimeout(…, 200)` und assertiert, dass der Iterator gewinnt. Die Absicht ist sauber, aber die Schwelle ist eine Echtzeitannahme auf einem geteilten CI-Runner. Es ist die einzige Stelle in 37 Spec-Dateien, an der eine Assertion von der Wanduhr abhängt; alle anderen `setTimeout`-Verwendungen sind reine Makrotask-Yields.
Empfehlung: Auf Vitests eingebautes Test-Timeout umstellen (`await iter2.next()` direkt, mit `it(…, {timeout: 2000})`).

**TEST-015 · info · src/SignalLink.spec.ts:123 · src/SignalLink.spec.ts:142** — Inkonsistente Rigorosität bei Rejection-Assertions im selben File
Von zehn Rejection-Assertions in dieser Datei prüfen acht die konkrete Fehlerart oder -meldung; zwei begnügen sich mit `rejects.toBeDefined()`. Für genau deren Abort-Fall führt derselbe File in `:309` und `:327` die strengere Form bereits vor — die beiden laxen Stellen sind damit ein Rest, kein Muster.
Empfehlung: Beide auf `rejects.toBe(controller.signal.reason)` bzw. eine Message-Prüfung anheben.

#### [x] 5. Coverage messen, wo sie entsteht, und pro Datei absichern
- Findings: TEST-005 (medium), TEST-006 (medium), TEST-014 (info)
- Ziel: Der GC-Lauf zählt zur Coverage, die Schwellen greifen pro Datei, und die neun GC-Tests laufen in der Standardschleife mit.
- Bereich: `vitest.config.ts`, `vitest.gc.config.ts`, `package.json`, `.github/workflows/ci.yml`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, die Kopfkommentare der beiden GC-Specs
- Hängt ab von: Paket 2, 3 (heben die Ist-Werte, gegen die die Schwellen gesetzt werden)
- Modell: mittlere Stufe (Runde 2 auf der stärksten Stufe)
- Hash: `f51ccfb`
- Ergebnis (2026-08-07): TEST-005, TEST-006 und TEST-014 behoben. Zwei Review-Runden. Runde 0 ließ die `README.md` als fünftes Dokument aus und trug an sechs Stellen eine gemessen falsche Begründung für `pnpm test:gc` (»one forked worker, surfaces cross-file state«) — Vitest 4 gibt jeder Spec-Datei ohnehin einen eigenen Kindprozess. Runde 1 korrigierte vier der sechs Stellen, Runde 2 (frischer Implementierer, stärkste Stufe) die restlichen zwei und ergänzte in allen vier Kommandotabellen den Hinweis, dass ein gefilterter Lauf am Per-File-Gate mit Exit 1 endet. Der Reviewer hat alle drei Schwellenstufen einzeln scharf gestellt gesehen (Stufe 1 über `link.gc.spec.ts`, Stufe 2 über `hibernate.spec.ts`, Stufe 3 über `SignalLink.spec.ts` — je rot, je zurückgebaut) und die Glob-Negation gegen eine neue Datei in `src/` und in `src/sub/` geprüft. Verify selbst gelaufen: `pnpm world` Exit 0, 39 Dateien / **411 Tests, 0 übersprungen** (vorher 402 passed / 9 skipped). Statements 98,82 → 99,01 %, Branch 93,57 → 94,03 %, Functions 99,02 → 99,51 %, Lines 99,38 → 99,59 %. `link.ts` steht durch den mitlaufenden GC-Lauf auf 100 % Statements statt 96,07 %.
- Nebenbefunde:
  - **Für den Nutzer beim Abschluss:** CI und `pnpm world` fahren dieselben 411 Tests jetzt zweimal — einmal parallel, einmal seriell mit `--expose-gc`. Kostet rund 4 s. Die Begründung ist auf das zurückgezogen, was gilt (serielle Ausführung, `--expose-gc` für die ganze Suite). Ob der zweite Lauf bleibt, ist eine offene Entscheidung.
  - `pnpm test -- <datei>` filtert unter pnpm 11.20.0 nicht — das literale `--` landet in der vitest-argv und beendet dort die Positionsargumente. **Vorbestehend**, per `git stash` gegen die Alt-Konfiguration bestätigt. In diesem Paket in allen vier Dokumenten auf `pnpm test <datei>` korrigiert.
  - `klein`, offen: `vitest.config.ts:36-37` sagt »that flag only survives in a forked worker« — im Kern richtig (`execArgv` greift nur im `forks`-Pool), der Singular transportiert aber das widerlegte Bild weiter.
  - `klein`, offen und der lohnendere: `AGENTS.md:165` und `CLAUDE.md` sagen »roots = `src/`« bzw. »Vitest is rooted at `src/` only«, während `vitest.config.ts:33` `root: '.'` setzt und die Eingrenzung über die `include`-Patterns läuft. Wer das glaubt, schreibt eine Schwellen-Glob ohne `src/`-Präfix — die trifft dann nichts und prüft klaglos nichts. Genau die Falle, gegen die dieses Paket gebaut wurde.
  - `klein`, offen: die Namen in der Stufe-2-Negation sind pfadlos; ein künftiges `src/sub/link.ts` fiele aus Stufe 2 heraus. Heute gegenstandslos, `src/` ist flach.
  - `CLAUDE.md:17` nennt `pnpm@11.17.0`, `package.json` steht auf `11.20.0`.
- Hinweis aus Paket 3 (2026-08-07): Paket 3 hebt `src/Signal.ts`, `src/object-signals.ts`, `src/decorators.ts`, `src/touch.ts` und `src/batch.ts` auf je 100 % in allen vier Metriken — für diese fünf Dateien darf die Schwelle voll gesetzt werden. Ungedeckt bleiben danach nur `EffectImpl.ts 771-772`, `SignalGroup.ts 236,240`, `createSignal.ts` (Zweige 47, 110), `link.ts 77-78` und `signal-core.ts` (Zweige 104-117); alle fünf liegen in Dateien, die die Sprints 2 und 3 noch anfassen, ihre Schwellen also besser knapp unter dem Ist-Stand.
- Dateien: `vitest.config.ts`, `vitest.gc.config.ts`, `package.json`, `.github/workflows/ci.yml`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, `src/link.gc.spec.ts`, `src/SignalGroup.gc.spec.ts`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Kein Produktionscode wird angefasst — Konfiguration, Skripte, Doku und zwei Kopfkommentare. Alle Zahlen unten sind am 2026-08-07 nach Paket 4 (`96dff42`) selbst gemessen; die Prototypen, mit denen gemessen wurde, sind wieder entfernt.

  **Messung 1 — `pnpm test`, wie es heute steht.** 37 Dateien bestanden, 2 übersprungen; 402 Tests bestanden, 9 übersprungen. Gesamt 98,82 % Statements · 93,57 % Branch · 99,02 % Functions · 99,38 % Lines. Dauer 0,6 s.

  **Messung 2 — `vitest run --config vitest.gc.config.ts --coverage`.** 39 Dateien, 411 Tests, alle bestanden. Gesamt 99,01 / 94,03 / 99,51 / 99,59. Dauer 5,0 s.

  **Messung 3 — der Zellenvergleich, und warum es nichts zu mergen gibt.** Beide Konfigurationen haben dieselbe `include`-Angabe; `vitest.gc.config.ts` erbt sie über `mergeConfig`. Es sind nicht zwei Läufe über zwei Codemengen, sondern **derselbe Lauf über dieselben 39 Spec-Dateien**, bei dem im zweiten Fall neun zusätzliche Tests tatsächlich ausgeführt statt übersprungen werden. Der Zellenvergleich über alle 26 Quelldateien und alle vier Metriken bestätigt das: der GC-Lauf liegt nirgends unter dem Standardlauf und nur an zwei Stellen darüber — `link.ts` (96,07/86,11/80/96,07 → 100/88,88/100/100) und `SignalGroup.ts` bei Zweigen (99/114 → 100/114). Ein lcov-Merge wäre damit eine Vereinigung, deren eine Hälfte in der anderen enthalten ist, also eine Nulloperation mit Werkzeugbedarf.

  Daraus folgt der Weg: **nicht mergen, sondern die Trennung auflösen.** Die Empfehlung des Audits (`--coverage --coverage.reportsDirectory=coverage-gc` plus lcov-Merge) wird nicht übernommen — sie verfestigt zwei Reports, zwei Verzeichnisse und zwei Zahlen für eine Testmenge, die es nur einmal gibt, und bräuchte ein Merge-Werkzeug, das im Projekt nicht vorhanden ist. Stattdessen werden die beiden Ausführungsmodelle als **zwei Vitest-`projects` in einer Konfiguration** geführt. Es entsteht **keine neue Dependency**, kein `coverage-gc/`, kein `.gitignore`-Eintrag.

  **Messung 4 — der Prototyp mit `projects`.** 39 Dateien, 411 Tests bestanden, **null übersprungen**, ein Coverage-Report mit exakt den Zahlen aus Messung 2. Dauer 1,4 s — schneller als der heutige GC-Lauf (5,0 s) und 0,8 s langsamer als der heutige Standardlauf. Der Report enthält `link.ts` bei 100 % Statements/Functions/Lines; die `FinalizationRegistry`-Rückrufe in `src/link.ts:77-78` und `src/SignalGroup.ts:58` sind damit gemessen statt dauerhaft rot.

  **Messung 5 — `vitest.gc.config.ts` bleibt tragfähig.** Gegen eine Basis-Config **mit** `projects` getestet, Datei unverändert: 39 Dateien, 411 Tests, 3,9 s. Die Wurzel-Optionen `pool: 'forks'`, `execArgv` und `fileParallelism: false` erreichen über `extends: true` beide Projekte. `pnpm test:gc` behält damit seine Bedeutung — die **vollständige** Suite in einem einzigen, seriellen Fork —, und keine der Verify-Zeilen der Pakete 8 bis 16 wird ungültig. `mergeConfig` verdoppelt das `projects`-Array nicht, weil die GC-Config selbst keines definiert.

  **Messung 6 — wie Vitest 4 Schwellen wirklich auswertet** (`node_modules/vitest/dist/chunks/coverage.DM_a_rWm.js:816-905`, gelesen statt vermutet). Drei Eigenschaften tragen den Entwurf unten:
  - Glob-Schlüssel im `thresholds`-Objekt bilden **zusätzliche** Gruppen. Der Kommentar in `:837` sagt es wörtlich: »Global threshold is for all files, even if they are included by glob patterns«. Eine Glob-Gruppe kann also nur **verschärfen**, nie lockern. Eine Ausnahmeregel für eine schwache Datei ist über Globs nicht formulierbar — die globale Stufe muss unter dem Minimum aller Dateien liegen.
  - `perFile: true` wirkt in **jeder** Gruppe, auch in den Glob-Gruppen (`:861`).
  - Mit `perFile: true` entfällt die aggregierte Prüfung ersatzlos. Der Gesamtschnitt wird nicht mehr geprüft, sondern jede Datei einzeln. Deshalb übernimmt Stufe 2 unten die Aufgabe, die der Gesamtschnitt bisher schlecht erfüllt hat.

  **Messung 7 — die Negations-Glob greift.** Mit einer absichtlich unerreichbaren Schwelle (101 %) auf der Stufe-2-Glob nennt der Lauf exakt die 17 vorgesehenen Dateien und keine der neun ausgenommenen. Picomatch verarbeitet sowohl `!(a|b|c)` als auch `{a,b}` in dieser Position; die Pfade werden relativ zu `root` verglichen, also als `src/batch.ts`.

  **Messung 8 — die Bodenschwelle beißt.** `branches` versuchsweise von 85 auf 86 gezogen: `ERROR: Coverage for branches (85.71%) does not meet global threshold (86%) for src/signal-core.ts`. Die Stufe ist also keine Dekoration.

  **Messung 9 — die dokumentierten Filter überleben.** `vitest run --config <proto> createSignal.spec.ts` → 1 Datei, 13 Tests. `vitest run --config <proto> link.gc.spec.ts` → 1 Datei, **3 Tests bestanden statt übersprungen**. Die in `CLAUDE.md` beschriebenen Aufrufe `pnpm test -- <file>` und `pnpm test -- -t "<name>"` funktionieren unverändert. `vitest.bench.config.ts` erbt nichts von `vitest.config.ts` (eigener Root, eigene `include`) — `pnpm bench` ist nicht betroffen.

  **A — die Konfiguration (`vitest.config.ts`)**

  1. Die Wurzel-Angabe `include: ['src/**/*.{spec,test}.ts']` (heute Zeile 34) **entfernen** und durch einen `projects`-Block an derselben Stelle ersetzen. `globals`, `environment`, `clearMocks`, `root`, `oxc: false` und das `plugins`-Array bleiben, wo sie sind — beide Projekte erben sie über `extends: true`, und genau daran hängt, dass SWC auch im GC-Projekt die Dekoratoren senkt:
     ```ts
     /*
      * Two projects, one run. The GC suites need `--expose-gc`, and that flag
      * only survives in a forked worker — so they get their own project here
      * instead of a second config that is invoked separately and, until now,
      * measured separately. `pnpm test` runs all 411 tests and produces a
      * single coverage map over both, which is what makes the per-file
      * thresholds below mean anything: the FinalizationRegistry callbacks in
      * link.ts and SignalGroup.ts are reachable from the gc project alone.
      */
     projects: [
       {
         extends: true,
         test: {
           name: 'unit',
           include: ['src/**/*.{spec,test}.ts'],
           exclude: ['src/**/*.gc.spec.ts'],
         },
       },
       {
         extends: true,
         test: {
           name: 'gc',
           include: ['src/**/*.gc.spec.ts'],
           pool: 'forks',
           execArgv: ['--expose-gc'],
           fileParallelism: false,
         },
       },
     ],
     ```
     Das `exclude` des `unit`-Projekts überschreibt Vitests Vorgabeliste (`**/node_modules/**` und Verwandte). Das ist unschädlich, weil `include` bereits auf `src/` unterhalb von `root: '.'` verankert ist; der Prototyp hat für `unit` die erwarteten 37 Dateien eingesammelt.
  2. `coverage.thresholds` (heute `vitest.config.ts:41-46`) vollständig ersetzen. Die Formatierung unten ist genau die, die Biome bei `lineWidth: 80` erzeugt — `biome check` lief auf dem Prototyp ohne Korrektur durch:
     ```ts
     thresholds: {
       perFile: true,
       statements: 97,
       branches: 85,
       functions: 96,
       lines: 98,
       'src/!(EffectImpl|SignalGroup|SignalLink|SignalAutoMap|bequiet|collect-errors|createSignal|link|signal-core).ts':
         {statements: 100, branches: 100, functions: 100, lines: 100},
       'src/{SignalLink,SignalAutoMap,bequiet,collect-errors}.ts': {
         statements: 100,
         branches: 95,
         functions: 100,
         lines: 100,
       },
     },
     ```
  3. Über den Block einen Kommentar setzen, der die drei Stufen benennt — ohne ihn ist die Staffelung in sechs Wochen nicht mehr rekonstruierbar:
     ```ts
     /*
      * Three tiers, because a single per-file number would have to clear the
      * weakest file in the tree and would then protect nothing else.
      *
      * Tier 1 (the plain numbers) is the floor under every file. It is set by
      * the weakest cell in the tree, integer-rounded at or below the current
      * value minus 0.5.
      * Tier 2 (the negated glob) pins every file no remaining audit package
      * touches at 100 % — including files that do not exist yet, which is the
      * point: new code arrives covered or it arrives named in an error.
      * Tier 3 covers the four files that are at 100 % today but are still on
      * the worklist; they keep statements, functions and lines at 100 and get
      * two uncovered branches of slack for defensive guards.
      *
      * Glob groups can only add constraints, never relax them (see Vitest's
      * resolveThresholds: the global tier applies to every file regardless of
      * glob membership). So tier 1 cannot be raised above the weakest file —
      * that is signal-core.ts at 12/14 branches.
      */
     ```

  **B — die Zahlen und woher sie kommen**

  4. Die Stufe-1-Werte sind die Minima über alle 26 Dateien im zusammengeführten Lauf, ganzzahlig auf oder unter »Ist minus 0,5«:

     | Metrik | Ist-Minimum | Datei | Schwelle | Abstand |
     | --- | --- | --- | --- | --- |
     | statements | 97,81 % (268/274) | `SignalGroup.ts` | **97** | −0,81 |
     | branches | 85,71 % (12/14) | `signal-core.ts` | **85** | −0,71 |
     | functions | 96,55 % (28/29) | `EffectImpl.ts` | **96** | −0,55 |
     | lines | 98,91 % (183/185) | `EffectImpl.ts` | **98** | −0,91 |

     Die alten Werte (85/85/95/95) waren global gemeint und werden **nicht** einfach übernommen: `branches: 85` sieht identisch aus, bedeutet aber ab jetzt etwas anderes — nicht mehr »der Schnitt über 436 Zweige«, sondern »jede einzelne Datei«. `functions` steigt von 85 auf 96, `lines` von 95 auf 98, `statements` von 95 auf 97.

  5. Stufe 2 ist die Liste der neun Dateien, die die Pakete 8 bis 16 laut ihren `Bereich`-Zeilen noch anfassen — `EffectImpl.ts` (9, 10, 11), `SignalGroup.ts` (11, 12, 14, 15), `SignalLink.ts` (8, 13, 14), `SignalAutoMap.ts` (16), `bequiet.ts` (12), `collect-errors.ts` (10), `createSignal.ts`, `link.ts` (13), `signal-core.ts` (9, 10, 16) —, negiert. Die verbleibenden 17 Dateien stehen heute auf 100 % in allen vier Metriken (Messung 4) und werden dort festgenagelt. Weil die Glob negativ formuliert ist, fällt auch **jede neue Datei in `src/`** automatisch unter die 100-%-Pflicht.
  6. Stufe 3 sind die vier Dateien aus der Neun-Liste, die heute schon bei 100 % stehen. Ohne diese Stufe fielen sie auf die Stufe-1-Werte zurück, und `SignalLink.ts` dürfte 6 seiner 43 Zweige und 3 seiner 120 Statements verlieren, ohne dass etwas piept — genau der Effekt, den TEST-006 anprangert. `branches: 95` erlaubt 2 von 43 ungedeckten Zweigen (41/43 = 95,35 % besteht, 40/43 = 93,02 % nicht); für die drei kleinen Dateien (`bequiet.ts` 9 Statements, `collect-errors.ts` 6, `SignalAutoMap.ts` 36) ist jede Prozentschwelle über ~89 gleichbedeutend mit 100 %, was hier gewollt ist.
  7. Die Grenzen dieses Entwurfs, damit sie später niemand für einen Fehler hält: mit `perFile: true` prüft Vitest den **Gesamtschnitt nicht mehr**. Die 94,03 % Branch aus Messung 4 sind ab jetzt eine Zahl für den CI-Bericht und für Menschen, keine Zusicherung. Getragen wird die Zusicherung von den 17 Dateien auf 100 % plus den Böden über den restlichen neun.

  **C — `pnpm test:gc` und `pnpm world`**

  8. `vitest.gc.config.ts` bleibt **funktional unverändert** (Messung 5). Nur der Kopfkommentar wird ersetzt, weil seine erste Zeile ab Schritt 1 falsch ist — die GC-Specs überspringen sich im Standardlauf nicht mehr:
     ```ts
     /*
      * The gc project in vitest.config.ts already runs `SignalGroup.gc.spec.ts`
      * and `link.gc.spec.ts` under --expose-gc, so this config is no longer
      * what makes those suites run. What it still does is run the *whole*
      * suite the way the gc project runs its two files: one forked worker,
      * no file parallelism. That is a different signal — it surfaces
      * cross-file state that the parallel default run hides — and it is why
      * `pnpm test:gc` stays in CI and in `pnpm world`.
      */
     ```
  9. `package.json:42` — `test:gc` in `world` aufnehmen:
     ```json
     "world": "run-s -sn clean check compile bundle test test:gc"
     ```
     `pnpm world` deckt damit exakt den blockierenden CI-Umfang ab (`check`, `test`, `test:gc`; `bench` ist `continue-on-error`). Kosten: rund 4 s auf einen Lauf, der ohnehin `clean`, `compile` und `bundle` enthält. `package.json:38` (`test:gc`) und `:35` (`test`) bleiben unverändert — insbesondere bekommt `test:gc` **kein** `--coverage`: gemessen wird in `pnpm test`, und ein zweiter Report über dieselben 411 Tests wäre genau die Doppelung, die dieses Paket abschafft.
  10. `pnpm cbt` bleibt unverändert. Es ist die schnelle Schleife; `pnpm test` führt die GC-Tests dort ab sofort mit aus, was der eigentliche Inhalt von TEST-014 ist.

  **D — die Aussagen, die durch Schritt 1 falsch werden**

  Alles unten ist reine Textkorrektur, aber sie ist nicht optional: vier Dokumente behaupten, `pnpm test` überspringe die neun GC-Tests. Ab Schritt 1 stimmt das nicht mehr, und ein Agent, der sich darauf verlässt, zieht die falsche Schlussfolgerung.

  11. `.github/workflows/ci.yml` — der dreizeilige Kommentar über dem `pnpm test:gc`-Schritt (»`pnpm test` skips SignalGroup.gc.spec.ts and link.gc.spec.ts … those nine tests never run on CI at all«) wird ersetzt durch die neue Begründung des Schritts: `pnpm test` deckt die neun Tests jetzt selbst ab, dieser Schritt fährt die vollständige Suite zusätzlich seriell in einem Fork. Der Schritt selbst bleibt. Im `Publish coverage summary`-Block die Zeile `'_Threshold: branches ≥ 85%, functions ≥ 85%, lines ≥ 95%, statements ≥ 95%._'` auf die neue Staffelung umschreiben — Vorschlag: `'_Per-file thresholds: statements ≥ 97%, branches ≥ 85%, functions ≥ 96%, lines ≥ 98%; files outside the audit worklist ≥ 100%._'`. Der Pfad `coverage/coverage-summary.json` bleibt richtig, es gibt weiterhin genau ein Coverage-Verzeichnis.
  12. `CLAUDE.md` — zwei Aufzählungspunkte im Abschnitt »Commands«:
      - der `pnpm world`-Punkt: `world` ist ab jetzt der vollständige blockierende CI-Umfang, nicht mehr »not the whole of it«; der Nachsatz »A change touching GC or teardown paths needs `pnpm world` **and** `pnpm test:gc`« fällt weg, weil `world` den Schritt enthält.
      - der `pnpm test:gc`-Punkt: die Behauptung »the only way the `SignalGroup.gc.spec.ts` and `link.gc.spec.ts` suites actually run; plain `pnpm test` skips all nine of their tests« ist falsch und wird ersetzt durch die Rolle aus Schritt 8 (vollständige Suite, ein Fork, seriell).
  13. `AGENTS.md` — drei Stellen: die `pnpm world`-Zeile der Kommandotabelle (`:164`), die `pnpm test:gc`-Zeile (`:169`) und der Fließtext `:181` (»`pnpm world` covers `check` and `test` only — add `pnpm test:gc` alongside it for the GC suite it skips«). Wenn die Datei einen Abschnitt zur Testkonfiguration führt, dort zusätzlich die Zwei-Projekte-Struktur nennen; sonst nicht erweitern.
  14. `CONTRIBUTING.md` — die Kommandotabelle (`pnpm world` = »CI scope minus `test:gc`«, `pnpm test` = »Run tests only«, `pnpm test:gc` = »Adds `--expose-gc` … nine tests otherwise skipped«), der Absatz darunter (»`pnpm world` alone does not cover the GC suite«) und der Kommentar im Abschnitt »Running Tests« (»Run the GC suites (SignalGroup and link), which plain `pnpm test` skips«). Alle vier sagen dasselbe Falsche und werden auf denselben neuen Stand gezogen.
  15. `src/link.gc.spec.ts:6-8` und `src/SignalGroup.gc.spec.ts:13-15` — der identische Kopfkommentar (»`globalThis.gc` is only available when Node is launched with --expose-gc (e.g. via `pnpm test:gc`)«) nennt ab jetzt das `gc`-Projekt aus `vitest.config.ts` als Quelle des Flags. Die `hasGc`-Wache selbst (`link.gc.spec.ts:9`, `SignalGroup.gc.spec.ts:16`) **bleibt unverändert**: sie ist die Absicherung dafür, dass diese Tests nie stillschweigend grün werden, wenn die Datei einmal über eine Konfiguration ohne `execArgv` läuft. Nur Kommentare, kein Code.

  **E — Abschluss und Gegenproben**

  16. `CHANGELOG.md` — zwei Zeilen unter `## Unreleased`, englisch, je ein Fakt. Unter `### Build System`: dass `pnpm test` die GC-Suiten jetzt über ein eigenes Vitest-Projekt mitfährt, damit in einem Lauf und einem Report misst, und dass `pnpm world` den Schritt `test:gc` enthält. Unter `### Tests`: dass die Coverage-Schwellen pro Datei gelten und in drei Stufen gestaffelt sind. Finding-IDs `(TEST-005, TEST-006, TEST-014)` ans Ende der jeweiligen Zeile. Existiert keine `### Build System`-Überschrift unter `## Unreleased`, wird sie angelegt — `CLAUDE.md` nennt sie als eine der zulässigen.
  17. Gegenproben vor dem Commit, in dieser Reihenfolge:
      - `pnpm test` meldet **39 Dateien, 411 Tests, null übersprungen** und keine einzige `ERROR: Coverage …`-Zeile. Steht dort noch »9 skipped«, greift `execArgv` im `gc`-Projekt nicht.
      - `coverage/coverage-summary.json` weist für `src/link.ts` 100 % Statements, Functions und Lines aus. Das ist die Abnahmeprobe für TEST-005: die Zeilen `77-78` sind der Beleg, den das Finding nennt.
      - Glob-Probe für Stufe 2: die 100-Werte der Stufe-2-Glob versuchsweise auf `101` ziehen, laufen lassen, die Fehlerliste zählen. Sie muss **exakt 17 Dateien** nennen und keine der neun aus Schritt 5. Danach zurücksetzen. Ohne diese Probe ist nicht unterscheidbar, ob die Glob greift oder ins Leere zeigt — eine Glob ohne Treffer prüft klaglos nichts.
      - Schwellen-Probe für Stufe 1: `branches` versuchsweise auf `86` ziehen; der Lauf muss mit `does not meet global threshold (86%) for src/signal-core.ts` scheitern. Danach zurücksetzen.
      - `pnpm test -- createSignal.spec.ts` → 1 Datei; `pnpm test -- link.gc.spec.ts` → 1 Datei, 3 Tests **bestanden**, nicht übersprungen.
      - `pnpm test:gc` → 39 Dateien, 411 Tests, unverändert grün.
      - `pnpm bench` bleibt lauffähig (eigene Config, eigener Root — nur zur Sicherheit einmal angefahren).
- Verify: `pnpm world` (enthält ab Schritt 9 `check`, `compile`, `bundle`, `test` und `test:gc`), dazu die sieben Gegenproben aus Schritt 17
- Commit: `build(coverage): run the GC suites as a second Vitest project and gate coverage per file (TEST-005, TEST-006, TEST-014)`
- Abgleich (2026-08-07):
  - **TEST-005 unverändert.** `package.json:38` lautet weiterhin `"test:gc": "vitest run --config vitest.gc.config.ts"`, ohne `--coverage` (die Fundstelle des Audits nennt `package.json:40`, die Zeile ist seither auf 38 gewandert). `vitest.gc.config.ts` erbt den `coverage`-Block samt Schwellen über `mergeConfig` (`:10-11`), wertet ihn ohne `--coverage` aber nie aus. Der Beleg des Findings stimmt zeilengenau: `src/link.ts:76` ist `const gLinkFinalizer = new FinalizationRegistry(...)`, sein Rumpf `77-78` steht im Standardlauf als ungedeckt in der Tabelle und im GC-Lauf nicht. Ergänzend zum Audit gemessen: es ist nicht nur `link.ts`, sondern auch `SignalGroup.ts` bei einem Zweig (99/114 → 100/114); und die Aussage »die berichtete Zahl stammt aus einem Lauf, in dem 9 von 386 Tests gar nicht liefen« stimmt weiterhin, nur lauten die Zahlen nach den Paketen 1 bis 4 »9 von 411«.
  - **TEST-006 in der Mechanik unverändert, in den Beispielen überholt.** Die Fundstelle `vitest.config.ts:37` zeigt heute auf `provider: 'v8'`; der Schwellenblock steht auf `:41-46` und kennt weiterhin kein `perFile`. Von den vier namentlich genannten Dateien ist keine mehr auffällig: `object-signals.ts` (50 % → 100 %), `touch.ts` (71,42 % → 100 %) und `decorators.ts` (75 % → 100 %) hat Paket 3 geschlossen, `SignalGroup.ts` hat Paket 2 von 82,45 % auf 86,84 % Branch gehoben (87,71 % im GC-Lauf) — alle vier liegen jetzt über der 85-%-Schwelle. Der strukturelle Kern des Findings besteht unverändert: die Schwellen gelten nur global, und der zweite Halbsatz ist sogar schärfer geworden, weil der Puffer gewachsen ist — 93,57 % Branch gegen 85 % heißt bei 436 Zweigen, dass heute **37** Zweige still verlorengehen dürfen, bevor CI etwas merkt, nicht 21.
  - **TEST-014 in der Sache unverändert, in einer der beiden Empfehlungshälften gegenstandslos.** Die vier Fundstellen stimmen: `src/SignalGroup.ts:58` (`groupFinalizationRegistry`), `src/link.ts:76` (`gLinkFinalizer`), `src/SignalGroup.gc.spec.ts:16` und `src/link.gc.spec.ts:9` (je `const hasGc = … ; const gcDescribe = hasGc ? describe : describe.skip`). `pnpm world` (`package.json:42`) enthält `test:gc` nicht. Die zweite Empfehlungshälfte ist jedoch bereits erfüllt und war es beim Audit schon: `CONTRIBUTING.md` benennt den Schritt wörtlich als Pflicht (»add `pnpm test:gc` alongside it for anything touching GC or teardown paths«), ebenso `CLAUDE.md` und `AGENTS.md:181`. Umgesetzt wird deshalb die erste Hälfte — und zwar doppelt: `test:gc` kommt in `world` (Schritt 9), und die Standardschleife berührt die Registry-Pfade ab Schritt 1 ohnehin selbst, was die Kernaussage des Findings (»die lokale Standardschleife berührt die Pfade nicht«) endgültig auflöst. Der Preis ist Schritt 11 bis 15: vier Dokumente und zwei Kopfkommentare behaupten das Gegenteil und müssen mit.

**TEST-005 · medium · vitest.gc.config.ts:9 · package.json:40** — Coverage auch über den GC-Lauf messen
`test:gc` ist `vitest run --config vitest.gc.config.ts` — ohne `--coverage`. Die Schwellen der Basis-Config werden geerbt, aber nie ausgewertet, und es gibt keine Zusammenführung der beiden Läufe. Code, den ausschließlich die GC-Suiten erreichen, gilt dauerhaft als unbedeckt und drückt die Zahl grundlos — sichtbar an `link.ts:77-78`. Umgekehrt stammt die berichtete Zahl aus einem Lauf, in dem 9 von 386 Tests gar nicht liefen.
Empfehlung: `--coverage --coverage.reportsDirectory=coverage-gc` an `test:gc` hängen und die beiden lcov-Reports mergen.

**TEST-006 · medium · vitest.config.ts:37** — Coverage-Schwellen pro Datei setzen — der globale Schnitt deckt SignalGroup.ts zu
Die Schwellen gelten nur global. `SignalGroup.ts` liegt bei 82,45 % Branch, `object-signals.ts` bei 50 %, `touch.ts` bei 71,42 %, `decorators.ts` bei 75 % — alle unter der Schwelle, alle unauffällig, weil kleine 100-%-Dateien den Schnitt heben. Dazu der Puffer: 89,9 % Branch gegen eine 85-%-Schwelle heißt, dass rund 21 Branches still verlorengehen dürfen, bevor CI etwas merkt.
Empfehlung: `thresholds: {perFile: true, …}` aktivieren und die globalen Werte auf den Ist-Stand minus 0,5 Punkte nachziehen.

**TEST-014 · info · src/SignalGroup.ts:58 · src/link.ts:76 · src/SignalGroup.gc.spec.ts:16 · src/link.gc.spec.ts:9** — FinalizationRegistry-Callbacks bleiben im Standard-Testlauf ungemessen
Beide GC-Suiten überspringen sich selbst ohne `--expose-gc` (`const gcDescribe = hasGc ? describe : describe.skip`), im Default-Lauf bleiben die Registry-Callbacks also unbeobachtet. Der Blindflug ist inzwischen weitgehend zu: `ci.yml:38` fährt `pnpm test:gc`, `link.gc.spec.ts` ist dazugekommen, und der Skip ist im Spec-Kommentar begründet. Es bleibt, dass die lokale Standardschleife die Pfade nicht berührt.
Empfehlung: `pnpm test:gc` in `pnpm world` aufnehmen oder in `CONTRIBUTING.md` als Pflichtschritt für Änderungen an Teardown-Pfaden benennen.

#### [x] 6. Gegen das testen, was ausgeliefert wird
- Findings: TEST-008 (medium), BUILD-008 (medium)
- Ziel: Zwei Prüfer auf dieselben zwei Artefakte. **Dynamisch:** ein Smoke-Test lädt über die `exports`-Map, was Konsumenten bekommen — `dist/index.js` und `dist/decorators.js` —, und führt eine `@signal() accessor`-Klasse aus, deren Dekorator **tsc** gesenkt hat statt SWC. Zum ersten Mal überhaupt. **Statisch:** `attw` bekommt ein Profil, das zur Bauart des Pakets passt, endet damit erstmals grün und wird in CI eingehängt — es prüft dieselbe `exports`-Map und dieselben `.d.ts` über alle Auflösungsmodi, die der Laufzeittest nicht durchspielen kann.
- Bereich: neu `smoke/dist-smoke.test.ts` und `smoke/tsconfig.json`, `package.json`, `biome.json`, `.npmignore`, `.github/workflows/ci.yml`, die vier Kommandotabellen, `CHANGELOG.md`
- Hängt ab von: —
- Modell: mittlere Stufe
- Hash: `3477ac9`
- Ergebnis (2026-08-07): TEST-008 und BUILD-008 behoben. Zwei Review-Runden. Der Smoke-Test läuft über `tsc` + `node --test` statt Vitest, weil unter Vitest die Anwendungsstelle des Dekorators wieder fremdgesenkt würde — der **tsc-gesenkte** `@signal() accessor` wird hier zum ersten Mal überhaupt ausgeführt (`__esDecorate`, `kind: "accessor"` im Emittat belegt). Import über den Paketnamen, damit die `exports`-Map mitgeprüft wird. Der Reviewer hat vier Mutationsproben am gebauten Artefakt gefahren: No-op-Setter in `dist/decorators.js` reißt zwei Tests, simuliert verlorenes Code-Splitting reißt genau Test 3, ein auf `any` degradiertes `lib/createSignal.d.ts` löst die `@ts-expect-error`-Wache mit TS2578 aus. Runde 1 behob zwei Befunde: `node --test` meldete bei leerer Glob Exit 0 mit null Tests (`wichtig`), und die `readAsValue`-Zusicherung hatte keine Fangwirkung, weil sie außerhalb eines Effects gelesen hat. Runde 2 zog die eine Doku-Stelle nach, die den Befehlsstring wörtlich führt. Verify selbst gelaufen: `pnpm world` Exit 0 über `clean check compile bundle test:smoke checkPkgTypes test test:gc`, Smoke 3/3, `attw` beide Subpfade 🟢 für `node16 (from ESM)` und `bundler`, 411 Tests, Coverage unverändert.
- Nebenbefunde:
  - **Prämisse des Audits korrigiert:** »Rollup nimmt `lib/*.js` als Input, also tsc-gesenkte Dekoratoren« trifft nicht zu — in `src/` wird nirgends ein Dekorator *angewendet*, `lib/decorators.js` enthält nur die Fabrik. Ungeprüft war die Senkung an der **Anwendungsstelle beim Konsumenten**. Das entwertet das Finding nicht, es bestimmt, wo der Test ansetzen muss.
  - `klein`, offen: die Glob-Wache in `package.json` ist ein rund 300 Zeichen langes `node -e`-Inline-Skript in einem JSON-String — die einzige Logik des Repos, die weder Biome noch `tsc` je sieht. Funktioniert nachweislich, aber jeder künftige Eingriff daran ist bis zur Laufzeit ungeprüft.
  - Für einen späteren Lauf, außerhalb dieses Scopes: CI fährt weder `tsc` noch Rollup als eigenen Schritt (BUILD-002/BUILD-003). Paket 6 schließt die Lücke beiläufig mit, weil der Smoke-Test sein Artefakt braucht, erhebt darauf aber keinen Anspruch.
- Dateien: neu `smoke/dist-smoke.test.ts`, neu `smoke/tsconfig.json`, `package.json`, `biome.json`, `.npmignore`, `.github/workflows/ci.yml`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Kein Produktionscode wird angefasst. Alle Aussagen unten sind am 2026-08-07 gegen den Stand `f51ccfb` und ein gebautes `dist/`/`lib/` selbst gemessen; der Prototyp, mit dem gemessen wurde, ist wieder entfernt.

  **Messung 1 — die schärfste Zeile des Findings stimmt so nicht.** `grep -rn "accessor \|@signal" --include=*.ts src | grep -v spec` liefert genau einen Treffer, und der steht in einem Kommentar (`src/SignalGroup.ts:543`). **Nirgends in `src/` wird ein Dekorator angewendet.** `lib/decorators.js` enthält also keinen tsc-gesenkten Dekorator, sondern nur die Fabrik `signal()` — gewöhnlichen Code. Was ungetestet ist, ist nicht die Senkung *in* der Bibliothek, sondern die Senkung an der **Anwendungsstelle**: jede der fünf Dekorator-Anwendungen im Projekt (`src/decorators.signal.spec.ts`, `bench/`) läuft durch SWCs `decoratorVersion: '2022-03'`, und keine durch die Senkung, die ein Konsument mit tsc erzeugt. Der Kern des Findings bleibt damit richtig und wird sogar präziser: `signal()` gibt ein `{get, set, init}` zurück, dessen Vertrag zwischen der 2022-03-Fassung und der finalen Proposal-Fassung nur *vermutet* übereinstimmt — der Kommentar in `vitest.config.ts:8-10` sagt das selbst. Genau diese Vermutung prüft dieses Paket, und sie prüft sich nur mit einem tsc-gesenkten Aufrufer.

  **Messung 2 — der Selbstbezug trägt, in beide Richtungen.** Ein `import {createSignal} from '@spearwolf/signalize'` aus einer Datei außerhalb von `src/` löst über die `exports`-Map des eigenen `package.json` auf: tsc (NodeNext) nimmt die `types`-Bedingung → `lib/index.d.ts`, Node nimmt die `import`-Bedingung → `dist/index.js`. Kein `paths`-Mapping, kein Alias, kein Symlink in `node_modules`. Damit prüft **ein einziger Import beide Hälften des Findings**: die `.d.ts` beim Kompilieren, das Bundle beim Ausführen. Ein relativer `../dist/index.js`-Import — die wörtliche Empfehlung des Audits — würde die `exports`-Map gerade nicht anfassen und obendrein typlos bleiben.

  **Messung 3 — der Prototyp lief.** `tsc --project smoke/tsconfig.json` 0,37 s, `node --test` 0,06 s, drei Tests grün. Der emittierte Code enthält tsc' `__esDecorate`-Helfer mit `kind: "accessor"` und dem finalen `context`-Objekt (`access.has/get/set`, `metadata`) — also nachweislich die andere Senkung als die getestete.

  **Messung 4 — fehlt `dist/`, scheitert es laut.** `ERR_MODULE_NOT_FOUND: Cannot find module '/…/dist/index.js' imported from /…/smoke/build/dist-smoke.test.js`, Exit 1. Fehlt `lib/`, scheitert schon tsc. Beide Meldungen nennen die fehlende Datei beim Namen.

  **Messung 5 — die `.d.ts`-Wache ist scharf.** Ersetzt man das falsch typisierte Argument hinter dem `@ts-expect-error` durch ein richtiges, endet der Lauf mit `error TS2578: Unused '@ts-expect-error' directive.` und Exit 1. Ein Deklarationssatz, der zu `any` verfällt, fällt damit auf — genau der Ausfall, den eine reine Laufzeitprüfung nie sieht.

  **Messung 6 — `pnpm clean` löscht `coverage/`.** `package.json:29` ist `rimraf build types tests dist lib coverage`. Da `pnpm dist` = `clean + compile + bundle` ist, **muss** jeder Schritt, der baut, in CI **vor** `pnpm test` liegen; sonst findet der abschließende `Publish coverage summary`-Schritt (`ci.yml`, `if: always()`) kein `coverage/coverage-summary.json` mehr. Das ist die einzige echte Falle dieses Pakets.

  **Messung 7 — `npm pack` würde die Smoke-Quelle ausliefern.** `npm pack --dry-run` listet `smoke/dist-smoke.test.ts` im Tarball. `.npmignore` hat zwar `*.spec.ts`, aber die Datei heißt `.test.ts`; `smoke/build/` fällt bereits unter den vorhandenen `build`-Eintrag. Deshalb Schritt 8.

  **Messung 8 — beide Entries teilen sich einen Chunk.** `dist/decorators.js:21` importiert `./signalize.Bkzoj87P.js`, `dist/index.js` denselben. Ein Effect aus `"."`, der auf ein Signal reagiert, das der Dekorator aus `"./decorators"` angelegt hat, ist deshalb eine echte Zusicherung und kein Beiwerk: verlöre Rollup jemals das Code-Splitting, hätten beide Entries eigene Modulzustände und der Effect bliebe stumm.

  **Messung 9 — Biome nimmt die Datei, wie sie unten steht.** Mit dem Include aus Schritt 8 meldet `biome check smoke/` »Checked 1 file, No fixes applied«. Der Quelltext in Schritt 2 ist also bereits die Formatierung, die `lineWidth: 80`, einfache Anführungszeichen und `bracketSpacing: false` erzeugen — er wird übernommen, nicht nachformatiert.

  **A — warum kein Vitest, und was daraus für die Coverage folgt**

  Die Empfehlung des Audits (»ein Smoke-**Spec**«) wird in der Bauform nicht übernommen, in der Sache vollständig. Grund: unter Vitest wäre die Anwendungsstelle des Dekorators wieder fremdgesenkt. Mit `unplugin-swc` misst man erneut SWC — also nichts Neues; ohne das Plugin reicht Vite 8s oxc-Pass die TC39-Dekoratoren unverändert durch und Node scheitert an `@signal() accessor foo` (`vitest.config.ts:4-11`). Ein Testläufer, der zwischen Quelle und Artefakt eine eigene Transformation schiebt, kann über das Artefakt nichts aussagen. Also: **`tsc` kompiliert, `node --test` führt aus.** Keine neue Dependency — `node:test` ist seit Node 18 eingebaut, das Projekt verlangt ohnehin `>=24.13`.

  Daraus fällt die Coverage-Frage von selbst weg, dreifach abgesichert:
  - `node --test` erzeugt keinen Coverage-Report und wird nie mit `--coverage` aufgerufen. Es gibt keine zweite Messung, die mit der ersten zu verrechnen wäre.
  - Die Dateien liegen in `smoke/`, nicht in `src/`. Weder `include: ['src/**/*.{spec,test}.ts']` des `unit`-Projekts (`vitest.config.ts:49`) noch `coverage.include: ['src/**/*.ts']` (`:67`) noch die Stufe-2-Glob `src/**/!(…).ts` (`:95`) kann sie sehen.
  - Umgekehrt gilt: die Dateien dürfen **nicht** nach `src/` wandern. Eine `src/*.smoke.spec.ts` liefe im normalen `pnpm test` mit — gegen ein `dist/`, das dort nicht existieren muss — und fiele zusätzlich unter die 100-%-Pflicht der Stufe 2, sobald sie keine Spec-Endung trüge.

  Der Preis ist ein zweiter Testläufer im Projekt. Er ist der Punkt, nicht der Betriebsunfall: dieser eine Test soll ohne Bundler, ohne Plugin und ohne Transform-Pipeline laufen, weil genau die die Konfundierung sind, um die es geht.

  **B — die beiden neuen Dateien**

  1. `smoke/tsconfig.json` — erbt die Wurzel-Config und überschreibt nur, was hier anders ist. `types: ["node"]` statt `["vitest/globals", "node"]`, damit in diesem Verzeichnis kein globales `expect` herumliegt, das niemand benutzen soll; `noEmitOnError`, damit nie ein veralteter Build ausgeführt wird:
     ```json
     {
       "extends": "../tsconfig.json",
       "include": ["**/*.ts"],
       "compilerOptions": {
         "rootDir": ".",
         "outDir": "build",
         "types": ["node"],
         "noEmitOnError": true
       }
     }
     ```
     Die Wurzel-`tsconfig.json` bleibt **unverändert**: `smoke/**/*.ts` wird dort **nicht** in `include` aufgenommen. Sonst beanspruchten zwei Konfigurationen mit verschiedenen `types` dieselbe Datei, und welche die IDE nimmt, wäre Zufall. Die lokale Config ist die nähere und gewinnt ohnehin.
  2. `smoke/dist-smoke.test.ts` — wörtlich der Prototyp aus Messung 3, von Biome unverändert durchgewinkt (Messung 9 unten):
     ```ts
     /*
      * Smoke test for what consumers actually get: the `exports` map, the
      * generated `.d.ts` and the rolled-up bundle. It runs on plain Node
      * (`node --test`) against `dist/`, deliberately without Vitest — every other
      * spec in this repo is transformed by unplugin-swc, and SWC's
      * `decoratorVersion: '2022-03'` is the one lowering that is never shipped.
      * Here tsc lowers the decorator, which is what a consumer's compiler does.
      */
     import assert from 'node:assert/strict';
     import test from 'node:test';

     import {
       createEffect,
       createSignal,
       type Effect,
       findObjectSignals,
       type Signal,
       SignalGroup,
     } from '@spearwolf/signalize';
     import {signal} from '@spearwolf/signalize/decorators';

     test('the "." subpath resolves and the bundle works', () => {
       const sig: Signal<number> = createSignal(1);
       const seen: number[] = [];

       const eff: Effect = createEffect(() => {
         seen.push(sig.get());
       });

       sig.set(2);
       assert.deepEqual(seen, [1, 2]);

       eff.destroy();
       sig.destroy();

       // @ts-expect-error the shipped declarations must still reject a wrong value
       // type; if they ever degrade to `any`, tsc fails on the unused directive
       // (TS2578) and this file never runs.
       createSignal<number>('nope').destroy();
     });

     test('the "./decorators" subpath resolves and tsc lowers the accessor', () => {
       class Foo {
         @signal() accessor foo = 1;
         @signal({readAsValue: true}) accessor bar = 'a';
       }

       const obj = new Foo();

       assert.equal(obj.foo, 1);
       assert.equal(obj.bar, 'a');

       obj.foo = 2;
       obj.bar = 'b';

       assert.equal(obj.foo, 2);
       assert.equal(obj.bar, 'b');

       SignalGroup.delete(obj);
     });

     test('both entry points share one module instance', () => {
       class Foo {
         @signal() accessor foo = 1;
       }

       const obj = new Foo();
       const seen: number[] = [];

       // createEffect comes from ".", the signal behind `foo` from "./decorators":
       // if rollup ever stopped sharing the core chunk between the two entries,
       // this effect would never see the write.
       const eff = createEffect(() => {
         seen.push(obj.foo);
       });

       obj.foo = 2;
       assert.deepEqual(seen, [1, 2]);
       assert.equal(findObjectSignals(obj)?.length, 1);

       const group: SignalGroup = SignalGroup.findOrCreate(obj);

       eff.destroy();
       group.clear();
       SignalGroup.delete(obj);
     });
     ```
  3. Was diese drei Tests zusichern, einzeln benannt — eine Instanziierung allein wäre in der Tat dünn:

     | # | Zusicherung | Ausfall, den sie fängt |
     | --- | --- | --- |
     | 1 | Der Subpfad `"."` löst über die `exports`-Map auf und lädt in reinem Node. | Kaputte `exports`-Map, ein Bundle mit ungültiger Syntax, ein nicht auflösbarer `@spearwolf/eventize`-Import (Rollup führt es als `external`). |
     | 2 | `createSignal`/`createEffect` arbeiten im Bundle: Erstlauf plus Rerun nach `set()`, in der richtigen Reihenfolge. | `treeshake: 'smallest'` hat etwas Lebendiges für tot gehalten. Ein Modul-Auswertungszyklus, den Rollup zwar nicht meldet, der aber zur Laufzeit zuschlägt. |
     | 3 | Die ausgelieferten Deklarationen tragen die Generik: `Signal<number>`, `Effect`, `SignalGroup` sind als Typen importierbar und annotierbar. | Ein Deklarations-Build, der die Typen verliert oder auf `any` zurückfällt. |
     | 4 | Die Deklarationen **lehnen** einen falschen Wert weiterhin ab (`@ts-expect-error` + TS2578-Gegenprobe). | Dieselbe `any`-Erosion, aber von der anderen Seite: ein Typtest, der nur Positives prüft, bleibt grün, wenn alles zu `any` wird. |
     | 5 | Der Subpfad `"./decorators"` löst auf, und ein **tsc-gesenkter** `@signal() accessor` durchläuft `init` → `get` → `set`. | Die Vermutung aus `vitest.config.ts:8-10` — dass 2022-03 und die finale Fassung sich über den `{get, set, init}`-Vertrag einig sind — trifft nicht zu. Bis heute ungeprüft. |
     | 6 | Auch die Option `readAsValue: true` überlebt den Weg durch Bundle und Deklaration. | Ein zweiter Dekorator-Pfad, der nur in der Quelle getestet ist. |
     | 7 | Ein Effect aus `"."` sieht ein Signal, das der Dekorator aus `"./decorators"` angelegt hat; `findObjectSignals()` aus `"."` findet es. | Verlorenes Code-Splitting: zwei Entries mit je eigenem Modulzustand. Kein Test in `src/` kann das sehen, weil dort beide Seiten dasselbe Modul sind. |

     Was **nicht** hineingehört: eine Nachbildung der Suite aus `src/`. Der Smoke-Test prüft den Weg, nicht das Verhalten — das Verhalten prüfen 411 Tests eine Ebene tiefer. Wächst er über eine Bildschirmseite, ist er falsch abgebogen.

  **C — Skripte, Lint, Packaging**

  4. `package.json` — zwei neue Skripte hinter `test:gc` (`:38`):
     ```json
     "test:smoke": "tsc --project smoke/tsconfig.json && node --test \"smoke/build/*.test.js\"",
     "smoke": "run-s -sn dist test:smoke",
     ```
     Die Arbeitsteilung ist die Antwort auf »baut der Test selbst oder nicht«: **`test:smoke` baut nicht**, es raucht das Artefakt, das da ist — so kann es in `world` und in CI hinter einen Bau gehängt werden, ohne ihn zu wiederholen. **`smoke` baut**, es ist der Einstieg für Menschen und für den Implementierer dieses Pakets. Der Anführungszeichen-Escape um die Glob ist nötig: die Shell darf sie nicht expandieren, `node --test` bringt seine eigene Glob-Auflösung mit. Ein Verzeichnis statt der Glob funktioniert **nicht** — `node --test smoke/build/` versucht das Verzeichnis als Modul zu laden und scheitert mit `MODULE_NOT_FOUND` (gemessen).
  5. `package.json:29` — `clean` um das Build-Verzeichnis erweitern, sonst überlebt ein gelöschter Smoke-Test als kompilierte Leiche im nächsten Lauf:
     ```json
     "clean": "rimraf build types tests dist lib coverage smoke/build"
     ```
  6. `package.json:42` — `checkPkgTypes` und `test:smoke` in `world` einhängen, **zwischen `bundle` und `test`**:
     ```json
     "world": "run-s -sn clean check compile bundle test:smoke checkPkgTypes test test:gc"
     ```
     Die Position ist nicht Geschmack: beide brauchen `lib/` und `dist/` (also nach `bundle`) und dürfen nicht nach `test` stehen, weil dort niemand mehr baut, wohl aber die Coverage entsteht, die keiner anfassen soll. Die Reihenfolge untereinander folgt der Entscheidung vom 2026-08-07 — `checkPkgTypes` hinter dem Smoke-Test; funktional ist sie in beide Richtungen gleichwertig, beide Schritte lesen dasselbe unveränderte Artefakt. Kosten gemessen: `test:smoke` 0,43 s, `checkPkgTypes` 0,78 s. `world` bleibt damit das, was die vier Kommandotabellen versprechen: der vollständige blockierende CI-Umfang.
  7. `pnpm cbt` bleibt **unverändert**. Es ist die schnelle Schleife; `pnpm world` ist der Vollzug. Dieselbe Linie hat Paket 5 für `test:gc` gezogen. Wer will, ruft `pnpm smoke` einzeln — es kostet 0,4 s plus den Bau.
  8. `biome.json` — `"smoke/**/*.ts"` in `files.includes` aufnehmen, direkt hinter `"bench/**/*.ts"` (Zeile 11). Ohne diesen Eintrag ignoriert `pnpm check` die neue Datei stillschweigend, und die einzige Datei des Projekts ohne Formatprüfung wäre ausgerechnet die neue. `smoke/build/` braucht keine Negation: `.gitignore` enthält `build` ohne Pfadanker, das greift auf jeder Ebene, und Biome liest die Datei (`vcs.useIgnoreFile: true`).
  9. `.npmignore` — eine Zeile `smoke` ergänzen (Messung 7). Sie gehört neben `bench` und `src`; ausgeliefert wird das Artefakt, nicht seine Prüfung.

  **D — CI**

  10. `package.json:26` — `checkPkgTypes` bekommt das Profil, das die Bauart des Pakets beschreibt (**BUILD-008**):
      ```json
      "checkPkgTypes": "attw --pack --profile esm-only",
      ```
      Das ist keine gesenkte Latte, sondern eine nachgetragene Tatsache. `attw` prüft ohne Profil vier Auflösungsmodi, von denen zwei für dieses Paket gar nicht gelten: `node10` kennt keine `exports`-Map und findet den Subpfad `./decorators` folgerichtig nicht, und `node16 (from CJS)` bekommt ESM, weil das Paket `"type": "module"` ist, nur eine `import`-Bedingung anbietet und `engines.node >= 24.13` verlangt. Ein Prüfer, dessen Rot in beiden Fällen »ja, ESM-only« bedeutet, prüft nichts — er steht deshalb heute in keiner Workflow-Datei. `--profile esm-only` blendet exakt diese zwei Modi aus (`(ignoring resolutions: 'node10', 'node16-cjs')`) und lässt die beiden übrig, die zählen: `node16 (from ESM)` und `bundler`, beide für beide Subpfade auf 🟢. Die vom Audit genannte Langform `--ignore-rules cjs-resolves-to-esm no-resolution` täte dasselbe, nennt aber Symptome statt der Ursache; das Profil sagt, was das Paket **ist**.
  11. `.github/workflows/ci.yml` — drei neue Schritte, **zwischen `pnpm check` und `pnpm test`**, mit dem Kommentar, der die Reihenfolge festhält (Messung 6):
      ```yaml
      # Both checks below need the artifact they check, and `pnpm dist` is
      # `clean + compile + bundle` — `clean` deletes `coverage/`. All three
      # steps therefore run *before* `pnpm test`; behind it, the final
      # "Publish coverage summary" step would find nothing left to publish.
      - run: pnpm dist
        name: Build the shipped artifact (lib/ + dist/)

      - run: pnpm test:smoke
        name: Smoke-test dist/ on plain Node (tsc-lowered decorator)

      - run: pnpm checkPkgTypes
        name: Check the exports map and the shipped types (attw, esm-only)
      ```
      Reihenfolge wie in `world`: bauen, ausführen, beschreiben. Kein `if:`-Guard, kein `continue-on-error` — alle drei blockieren wie `check` und `test`. `attw --pack` ruft intern `npm pack`; das ist in CI vorhanden (`actions/setup-node`), dauert gemessen 0,78 s und lässt kein Tarball im Arbeitsbaum zurück.
  12. Der `pnpm dist`-Schritt ist die Vorbedingung, nicht das Ziel: CI fährt heute weder `tsc` noch Rollup, ein Typfehler in `src/` oder ein Importzyklus käme also gar nicht erst an einem Gate vorbei. Das ist **BUILD-002/BUILD-003**, außerhalb des Auftrags — dieses Paket schließt die Lücke beiläufig für `src/`, erhebt aber keinen Anspruch darauf und lässt beide Findings offen stehen.
  13. Was `attw` und der Smoke-Test **nicht** teilen, damit später niemand einen für redundant hält: der Smoke-Test führt einen Auflösungsmodus aus (`node16 (from ESM)`) und beweist, dass hinter der Auflösung Code steht, der arbeitet. `attw` führt nichts aus, deckt dafür alle Modi ab und sieht Fehlerbilder, die zur Laufzeit gar nicht auftreten können — eine `types`-Bedingung an falscher Stelle in der `exports`-Map etwa fällt einem ESM-Import nie auf. Zwei Prüfer, zwei Blickwinkel, ein Artefakt.

  **E — Doku und CHANGELOG**

  14. Die vier Kommandotabellen, die Paket 5 auf einen Stand gezogen hat, ziehen mit — sie stehen und fallen gemeinsam: `AGENTS.md:163-179` (Tabelle) und `:183` (der Fließtext, der die CI-Schritte aufzählt), `CLAUDE.md:19-22`, `CONTRIBUTING.md:31-43`, `README.md:326-339`. Jeweils zwei Zeilen für `pnpm smoke` und `pnpm test:smoke`, die `pnpm world`-Zeile um `checkPkgTypes` und `test:smoke` erweitert, die vorhandene `pnpm checkPkgTypes`-Zeile (`AGENTS.md:178`) um das Profil und den Hinweis, dass sie jetzt in CI blockiert, und in den CI-Aufzählungen `dist` + `checkPkgTypes` + `test:smoke` vor `test` einsortiert. Ein Satz muss überall vorkommen, weil er der eigentliche Inhalt ist: dieser Test ist der einzige, der nicht unter Vitest läuft, und der einzige, der `dist/` statt `src/` importiert.
  15. `AGENTS.md` — zusätzlich in der Quelldatei-Übersicht bzw. im Testabschnitt das Verzeichnis `smoke/` nennen, mit einem Satz zur Begründung (tsc statt SWC an der Anwendungsstelle des Dekorators). Wenn die Datei keinen solchen Abschnitt führt, nicht erfinden — dann reicht die Tabelle.
  16. `CHANGELOG.md` — drei Zeilen unter `## Unreleased`, englisch, je ein Fakt. Unter `### Tests`: dass ein Smoke-Test in `smoke/` das gebaute `dist/` über die `exports`-Map auf reinem Node lädt und dabei zum ersten Mal einen tsc-gesenkten `@signal() accessor` ausführt, während alle übrigen Dekorator-Tests durch SWCs `2022-03` laufen; Finding-ID `(TEST-008)`. Unter `### Build System` zwei Zeilen: dass `pnpm world` und CI die neuen Schritte `checkPkgTypes` und `test:smoke` enthalten, `pnpm smoke` den Smoke-Test samt Bau einzeln fährt und `pnpm clean` `smoke/build` mit aufräumt — und dass `pnpm checkPkgTypes` auf `attw --pack --profile esm-only` steht und damit erstmals bestehbar ist, weil `node10` und `node16 (from CJS)` für ein ESM-only-Paket keine Aussage tragen; Finding-ID `(BUILD-008)`.
  17. Keine Änderung an `docs/` oder `skills/using-signalize/`: die öffentliche API bewegt sich nicht um ein Zeichen.

  **F — Gegenproben vor dem Commit**

  18. `pnpm smoke` → drei Tests grün, Exit 0. Danach `pnpm world` → Exit 0, `411` Tests unverändert, kein `ERROR: Coverage …`, und `coverage/coverage-summary.json` existiert danach noch. Der letzte Punkt ist die Probe auf Messung 6.
  19. **Die Dekorator-Probe.** Ohne sie ist nicht unterscheidbar, ob der Test die tsc-Senkung ausführt oder nur irgendeine: im erzeugten `smoke/build/dist-smoke.test.js` muss `__esDecorate` stehen und `kind: "accessor"` mit einem `context`-Objekt, das `access` und `metadata` führt. Steht dort stattdessen `_ts_decorate` oder SWC-Helferwerk, hat sich eine Transform-Pipeline dazwischengeschoben und der Test misst wieder das Falsche.
  20. **Die `.d.ts`-Probe.** Das falsch typisierte Argument hinter dem `@ts-expect-error` versuchsweise korrigieren; der Lauf muss mit `TS2578: Unused '@ts-expect-error' directive` scheitern. Danach zurücknehmen. Eine Wache, die nie ausgelöst hat, ist keine.
  21. **Die Artefakt-Probe.** `dist/` wegschieben und `pnpm test:smoke` fahren: der Lauf muss mit `ERR_MODULE_NOT_FOUND` scheitern und den Pfad `dist/index.js` nennen. Danach zurückschieben. Das ist die bewusste Entscheidung dieses Pakets gegen einen Skip: ein Test, der sich beim Fehlen seines Prüfgegenstands selbst überspringt, ist genau der Ausfallmodus, den Paket 5 gerade bei den GC-Suiten abgeräumt hat (TEST-014). Fehlt das Artefakt, ist die Antwort »rot«, nicht »grau«.
  22. **Die attw-Probe, und sie ist Pflicht im Report.** Ein Schritt, der von rot auf grün wechselt, weil das Prüfkriterium gewechselt wurde, braucht den Nachweis, dass er überhaupt noch prüft. Also beides fahren und beides festhalten: `git stash`-frei genügt ein direkter Aufruf **vor** der Änderung — `npx attw --pack` → **Exit 1**, mit `💀 Resolution failed` für `"@spearwolf/signalize/decorators"` unter `node10` und `⚠️ ESM (dynamic import only)` unter `node16 (from CJS)`. **Nach** der Änderung — `pnpm checkPkgTypes` → **Exit 0**, Kopfzeile `(ignoring resolutions: 'node10', 'node16-cjs')`, und in der Tabelle **beide** Subpfade (`"@spearwolf/signalize"` und `"@spearwolf/signalize/decorators"`) auf 🟢 in **beiden** verbliebenen Zeilen (`node16 (from ESM)`, `bundler`). Steht dort auch nur ein `(ignored)` in einer der beiden verbliebenen Zeilen, ist das Profil zu breit gewählt und die Änderung ist eine Vertuschung statt einer Beschreibung. Beide Läufe gehören mit ihrer Ausgabe in den Report.
  23. `pnpm check` → Exit 0 und die neue Datei tatsächlich geprüft (`biome check smoke/` meldet `Checked 1 file`, nicht `Checked 0 files`). Eine Include-Glob ohne Treffer prüft klaglos nichts — dieselbe Falle wie bei den Coverage-Globs in Paket 5.
  24. `npm pack --dry-run | grep smoke` → keine Ausgabe. `attw --pack` selbst lässt keinen Tarball im Arbeitsbaum zurück (gemessen), `git status` ist nach dem Lauf sauber.
  25. `pnpm test` allein (ohne vorherigen Bau) → unverändert 39 Dateien, 411 Tests, kein Versuch, irgendetwas in `smoke/` einzusammeln. Das ist die Probe darauf, dass die neue Testsorte die alte nicht anfasst.
- Verify: `pnpm world` (enthält ab Schritt 6 `checkPkgTypes` und `test:smoke`), dazu die Gegenproben 19 bis 25
- Commit: `test(dist): smoke-test the built artifact on plain Node and make the attw check pass (TEST-008, BUILD-008)`
- Abgleich (2026-08-07): **TEST-008 unverändert in der Sache, in einer Fundstelle verschoben und in einem Detail der Begründung falsch.**
  - Die Fundstelle `vitest.config.ts:32` zeigt seit Paket 5 (`f51ccfb`) nicht mehr auf die `include`-Zeile; `:32` ist heute leer. Die gemeinte Angabe steht jetzt in der `unit`-Projektdefinition auf `vitest.config.ts:49` (`include: ['src/**/*.{spec,test}.ts']`), dazu `:57` für das `gc`-Projekt. Die Aussage des Findings gilt unverändert: beide Projekte sind auf `src/` verankert, `coverage.include` (`:67`) ebenso. Kein Spec-File importiert etwas aus `dist/` oder `lib/` — `grep -rn "dist/\|\.\./lib" src/*.spec.ts` ist leer.
  - `rollup.config.mjs:18-22` unverändert: `input: {index: 'lib/index.js', decorators: 'lib/decorators.js'}`. Der Auslieferungspfad läuft weiterhin über `lib/`.
  - **Korrektur:** »Rollup nimmt `lib/*.js` als Input, also tsc-gesenkte TC39-Dekoratoren« trifft nicht zu. In `src/` wird kein einziger Dekorator angewendet (Messung 1), `lib/decorators.js` enthält nur die Fabrik. Der ungeprüfte Unterschied liegt an der Anwendungsstelle beim Konsumenten, nicht in der Bibliothek. Das entwertet das Finding nicht, es verschiebt nur, wo der Test ansetzen muss — und es ist der Grund, warum die Fixture-Klasse zwingend von tsc kompiliert werden muss und nicht von Vitest.
  - Ergänzend, vom Audit nicht genannt und hier mitgenommen: die `exports`-Map ist über den Selbstbezug in einem Zug mitprüfbar (Messung 2), und das geteilte Rollup-Chunk zwischen beiden Entries ist eine eigene, aus `src/` prinzipiell unsichtbare Zusicherung (Messung 8).

**TEST-008 · medium · vitest.config.ts:32 · rollup.config.mjs:18** — Den Bau-Artefakt-Pfad testen — kein Test läuft gegen dist/ oder lib/
Vitest ist auf `src/**/*.spec.ts` beschränkt, und alle Specs importieren Quelldateien. Nichts von dem, was Konsumenten bekommen, ist geprüft: die `exports`-Map, die generierten `.d.ts`, das Rollup-Bundle. Besonders scharf beim Dekorator: Rollup nimmt `lib/*.js` als Input, also **tsc**-gesenkte TC39-Dekoratoren, während jeder Dekorator-Test durch **SWCs** `decoratorVersion: '2022-03'` läuft. Der Kommentar in `vitest.config.ts` nennt die Annahme selbst — getestet wird sie nirgends, ausgeliefert wird die andere Variante.
Empfehlung: Ein Smoke-Spec ergänzen, das nach `pnpm dist` gegen `dist/index.js` und `dist/decorators.js` importiert und mindestens eine `@signal() accessor`-Klasse instanziiert.

**BUILD-008 · medium · package.json:26 · .github/workflows/ci.yml:29** — pnpm checkPkgTypes bestehbar machen und in CI einhängen
`attw --pack` läuft ohne Profil und schlägt strukturell fehl: node10 kann den `./decorators`-Subpfad nicht auflösen, und CJS-Konsumenten bekommen erwartungsgemäß ESM. Beides ist bei einem ESM-only-Paket gewollt, führt aber zu Exit-Code 1. Ein Check, der immer rot ist, wird nie ausgeführt — er steht folgerichtig in keiner Workflow-Datei.
Empfehlung: `attw --pack --profile esm-only` (bzw. `--ignore-rules cjs-resolves-to-esm no-resolution`) verwenden und den Schritt in `ci.yml` nach `pnpm dist` einhängen.
Evidenz (Audit): `pnpm checkPkgTypes -> node10 | 🟢 | 💀 Resolution failed · node16 (from CJS) | ⚠️ ESM (dynamic import only)` / `[ELIFECYCLE] Command failed with exit code 1.`
Abgleich (2026-08-07): unverändert. `package.json:26` lautet weiterhin `"checkPkgTypes": "attw --pack"`, der Lauf endet mit Exit 1 und exakt den beiden Meldungen aus der Evidenz; `.github/workflows/ci.yml` enthält den Schritt nicht. Die empfohlene Fassung ist gemessen: Exit 0, beide Subpfade 🟢 für `node16 (from ESM)` und `bundler`, Laufzeit 0,78 s, keine Rückstände im Arbeitsbaum. Aufgenommen in den Scope durch die Entscheidung des Nutzers vom 2026-08-07; Paket 6 ist sein Ort, weil beide Findings dieselben zwei Artefakte prüfen — die `exports`-Map und die generierten `.d.ts`, das eine zur Laufzeit, das andere statisch.

#### [x] 7. Property-Tests für die Reihenfolge-Invarianten
- Findings: TEST-012 (low), TEST-013 (low, als dokumentierter Verzicht)
- Ziel: fast-check prüft Prioritätsordnung, Batch-Dedup und Verschachtelung generativ; der Verzicht auf einen Browser-Smoke-Test steht begründet in `AGENTS.md`.
- Bereich: neu `src/ordering.property.spec.ts`, `package.json`, `pnpm-lock.yaml`, `AGENTS.md`, `CHANGELOG.md`
- Hängt ab von: —
- Modell: mittlere Stufe
- Hash: `7155066`
- Ergebnis (2026-08-07): TEST-012 gebaut, TEST-013 als begründeter Verzicht dokumentiert. Eine Review-Runde. Sieben Invarianten in fünf `it`-Blöcken, `fast-check@4.9.0` als devDependency, fester Seed `20260807` — der Reviewer hat den Determinismus mit einer absichtlich umgedrehten Assertion über zwei Läufe belegt (identischer `path`, identisches Gegenbeispiel; mit anderem Seed ändern sich beide) und die Generatorverteilung per `fc.sample` reproduziert: 174/500 Läufe mit Prioritätsgleichstand, 397/500 mit mehr als einem Bucket. **Sieben von sieben Mutanten getötet**, jeder einzeln nachgefahren. Runde 1 gab zwei Assertionen Zähne: P5a tastete die Sperre nach dem letzten Write nie ab (der `else`-Mutant fiel deshalb nur an der Äquivalenz-Assertion, jetzt auch an der Sperre selbst), und P1 prüfte »jeder Effect genau einmal« allein über die Array-Länge statt über Mengengleichheit. Verify selbst gelaufen: `pnpm world` Exit 0, 40 Dateien / **416 Tests**, Coverage zellengleich 99,01 / 94,03 / 99,51 / 99,59 — keine Schwelle aus Paket 5 gestreift. `pnpm test` 1,44 s → 1,72 s.
- Nebenbefunde:
  - **Eine Abweichung vom Plan, vom Reviewer gegen den Code bestätigt:** P2 prüft keinen Erzeugungsreihenfolge-Tiebreak. Im Batch entscheidet bei Prioritätsgleichstand die Reihenfolge, in der ein *Write* den Effect zuerst trifft (`src/batch.ts:19` fügt in ein `Set` ein, aufgerufen aus `src/EffectImpl.ts:413-417`), nicht die Erzeugungsreihenfolge. Der geplante Tiebreak-Assert wäre eine Fehlmeldung über die Bibliothek gewesen. Ohne Batch, auf demselben Signal, gilt die Erzeugungsreihenfolge weiterhin — P1 prüft sie dort.
  - Korrektur an der Mutationstabelle des Plans: der Splice→Push-Mutant tötet nur P2/P3/P4, nicht zusätzlich P7. `sImpl.beforeRead = e.run` (`src/createMemo.ts:118`) erzwingt den Memo-Wert unabhängig von der Bucket-Reihenfolge — genau der Mechanismus, den P7 prüft.
  - Bewusst **keine** Property für Effect-Callbacks, die selbst schreiben (Begründung im Detailplan, `src/batch.ts:75`). Damit das beim nächsten Audit nicht als Lücke zurückkommt.
- Dateien: neu `src/ordering.property.spec.ts`, `package.json`, `pnpm-lock.yaml`, `AGENTS.md`, `CHANGELOG.md`. **Nicht** `pnpm-workspace.yaml` (Schritt 19), **nicht** `vitest.config.ts` (Schritt 12), **nicht** `docs/quickstart.md` (Schritt 23), **nicht** `CONTRIBUTING.md`/`CLAUDE.md` (Schritt 25).
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Kein Produktionscode wird angefasst — eine neue Spec, eine devDependency, ein Doku-Abschnitt. Alle Zahlen unten sind am 2026-08-07 gegen den Stand `3477ac9` selbst gemessen; der Prototyp ist wieder entfernt, `package.json` und `pnpm-lock.yaml` sind danach bytegleich (md5 `2ad9960a…` bzw. `f785a3e3…`), `pnpm test` steht wieder bei 39 Dateien / 411 Tests.

  **Messung 1 — die Suite kostet fast nichts.** Die fünf `it()`-Blöcke (sieben Properties, P2/P3/P4 werten dasselbe Szenario aus) brauchen bei `numRuns: 500` 190 ms reine Testzeit (95 ms bei 200, 320 ms bei 1000; die Reihe ist linear, der Fixkostenanteil liegt bei ~160 ms Transform + Import). `pnpm test` steigt von 1,44 s auf 1,68 s, `pnpm world` läuft in 9,5 s mit Exit 0 durch. 40 Dateien, 416 Tests.

  **Messung 2 — die Coverage bewegt sich um keine einzige Zelle.** Vor und nach der Suite: Gesamt 99,01 % Statements · 94,03 % Branch · 99,51 % Functions · 99,59 % Lines, und in der Uncovered-Tabelle unverändert `EffectImpl.ts 771-772`, `SignalGroup.ts 236,240`, `createSignal.ts` Zweige 47/110, `link.ts 77,185,218,254`, `signal-core.ts` Zweige 104-117. Die Suite berührt ausschließlich Pfade, die schon gedeckt waren. Für die drei Stufen aus Paket 5 heißt das: **keine Schwelle wird gestreift, keine muss nachgezogen werden**, und `signal-core.ts` bleibt bei seinen 12/14 Zweigen gegen die 85-%-Stufe genau so knapp wie vorher.

  **Messung 3 — die Dependency.** `fast-check@4.9.0`, veröffentlicht 2026-07-08, MIT, `"type": "module"` mit dualem `exports` (ESM + CJS), `engines.node >= 12.17.0`, genau eine transitive Abhängigkeit: `pure-rand@8.4.2`. Keines der beiden Pakete hat ein `preinstall`/`install`/`postinstall`/`prepare`-Skript — die publizierten `scripts` von fast-check sind reine Autorenskripte (`build`, `typecheck`, `api-extractor`, …). `pnpm add -D` meldete folgerichtig keinen ignorierten Build. Lock-Delta: 16 Zeilen.

  **Messung 4 — die Generatoren treffen, was sie treffen sollen** (500 Läufe, Seed `20260807`). Szenariengenerator: 174/500 mit mindestens einem Prioritäts­gleichstand (der Tie-Break-Fall), 397/500 mit mehr als einem Prioritäts-Bucket, 77/500 mit nur teilweise betroffenen Effects, 18/500 ohne einen einzigen betroffenen Effect (der Leerlauf-Fall). Programmbaum für die geschachtelten Batches: Schachtelungstiefe 0/1/2/3 in 245/68/71/116 Fällen, nie null Writes, bis zu 16 Writes je Baum. Diese Zahlen gehören in den Report — ein Generator, der nie einen Gleichstand erzeugt, lässt die Tie-Break-Hälfte von P1 leer durchlaufen, ohne dass irgendetwas rot wird.

  **Messung 5 — die Mutationsproben.** Jeder Mutant einzeln scharf gestellt, Lauf, zurückgebaut; die Quelldateien sind danach bytegleich. Keine Property ist ungetötet geblieben:

  | Mutant | Ort | tötet |
  | --- | --- | --- |
  | `Batch.batch()` hängt neue Buckets nur noch an, statt sie per `splice` einzusortieren | `src/batch.ts:11-26` | P2, P7 |
  | `on(globalSignalQueue, signalId, RECALL, this)` — das `this.priority`-Argument entfällt | `src/EffectImpl.ts:530` | P1 |
  | der `else {curBatch = undefined}`-Zweig in `batch()` entfällt (innere Batches flushen selbst) | `src/batch.ts:112-114` | P5 |
  | `destroyChildEffects()` als No-op | `src/EffectImpl.ts:633-637` | P6 |
  | `Batch.run()` iteriert nur den ersten Bucket | `src/batch.ts:49` | P2/P3/P4 |
  | `run()` ignoriert den offenen Batch und läuft sofort | `src/EffectImpl.ts:413-417` | P2/P3/P4, P5, P7 |
  | `sImpl.beforeRead = e.run` entfällt | `src/createMemo.ts:109` | P7 |

  **Messung 6 — und der Befund, den Messung 5 erst zutage gefördert hat.** Die erste Fassung von P7 ließ die Effect-Prioritäten nur im Bereich −5…0 laufen, also durchweg unter der Memo-Priorität `Priority.C = 1000`. In dieser Fassung **überlebte** P7 den `beforeRead`-Mutanten: das Memo lief ohnehin in einem früheren Bucket, der Zwangs-Recompute beim Lesen wurde nie gebraucht. Erst mit Prioritäten **oberhalb** von 1000 (`Priority.High`, `Priority.Critical`, `1001`) wird der lesende Effect vor dem Memo-Bucket ausgeführt, und erst dann ist `beforeRead` der einzige Grund, warum er keinen veralteten Wert sieht. Der Wertebereich in Schritt 7 ist deshalb keine Kosmetik, sondern die Bedingung dafür, dass P7 überhaupt etwas prüft.

  **A — die Invarianten**

  Sieben Sätze, jeder muss wahr sein, egal was der Generator liefert. Alle sieben sind heute grün gemessen; keiner davon steht heute als Eigenschaft irgendwo, alle sieben hängen heute an ein bis zwei Beispielen.

  1. **P1 — Prioritätsordnung ohne Batch.** *Schreibt man ein Signal, das k Effects lesen, läuft jeder dieser k Effects genau einmal, und die Folge ihrer Prioritäten in Aufrufreihenfolge ist monoton fallend; bei gleicher Priorität entscheidet die Reihenfolge, in der die Effects erzeugt wurden.*
     Generator: `fc.array(priorityArb, {minLength: 1, maxLength: 8})` — die Prioritätenliste **ist** das Szenario, jeder Eintrag wird zu einem Effect auf demselben Signal. Heute geprüft von `effects.priority.spec.ts:70-107` mit genau drei Effects und den Prioritäten −100 / 1000 / 0, ohne einen einzigen Gleichstand.
  2. **P2 — Prioritätsordnung im Batch.** *Egal in welcher Reihenfolge die Signale innerhalb eines `batch()` geschrieben werden — die Folge der Prioritäten der im Flush laufenden Effects ist monoton fallend.*
     Heute geprüft von `batch.spec.ts:293-328` mit zwei Effects und zwei Signalen, wobei der Schreibreihenfolge genau ein Fall abgerungen wird (niedrig zuerst, hoch danach).
  3. **P3 — Dedup im Batch.** *Im Flush läuft kein Effect zweimal, und es läuft genau die Menge der Effects, deren Dependency-Menge mindestens eines der geschriebenen Signale enthält — nicht mehr und nicht weniger.*
     Der zweite Halbsatz ist der, den heute nichts prüft: dass ein Effect, dessen Signale unangetastet blieben, **nicht** läuft. 18 von 500 Läufen erzeugen den Extremfall, in dem gar kein Effect betroffen ist.
  4. **P4 — Keine Zwischenstände.** *Jeder im Flush laufende Effect liest von jedem seiner Signale den Endwert des Batches, nie einen Zwischenwert.*
     Das ist die eigentliche Zusage von `batch()` und heute nur implizit über `toHaveBeenCalledWith(456)`-Assertionen in `batch.spec.ts:50-51` belegt. Die Property prüft es für jeden gelaufenen Effect und jedes seiner Signale, bei bis zu 8 Writes auf bis zu 4 Signale — jeder Write mit einem neuen Wert, damit die Gleichheitsprüfung in `set()` nie stillschweigend einen Write verschluckt.
  5. **P5 — Verschachtelte Batches.** *Ein beliebig geschachtelter Baum aus `batch()`-Aufrufen und Writes verhält sich wie ein einziges flaches `batch()` mit derselben Write-Folge: bis zur Rückkehr des äußersten `batch()` ist kein Effect gelaufen, und danach ist die Aufruffolge identisch zu der des flachen Batches.*
     Zwei Assertionen in einer: die Sperre (`peek() === 0` innerhalb des äußersten `batch()`) und die Äquivalenz (`nested` gleich `flat`, zwei frisch aufgebaute Szenarien mit denselben Effects). Heute geprüft von `batch.spec.ts:62-126` an genau einer Schachtelung der Tiefe 2.
  6. **P6 — Verschachtelte Effects.** *Bei einer Kette verschachtelter Effects der Tiefe d ist die Aufruffolge auf jedem Rerun der äußeren Kette die Pre-Order 0, 1, …, d, und `getEffectsCount()` steht nach jedem Rerun wieder auf d+1.*
     Heute geprüft von `nested-effects-staticDeps.spec.ts:25-45` bei fester Tiefe 1 und fünf Reruns; die Property fährt Tiefe 0…4 gegen 1…5 Reruns.
  7. **P7 — Ein Memo im Flush ist nie veraltet.** *Ein Memo, das während des Flushs gelesen wird, liefert immer den aus den Endwerten des Batches berechneten Wert — auch dann, wenn der lesende Effect eine höhere Priorität hat als das Memo und deshalb vor dessen eigenem Bucket läuft.*
     Das ist die einzige Property, die `beforeRead` erreicht, den Mechanismus hinter der Glitch-Freiheit. Heute geprüft von `batch.spec.ts:330-360` und `effects.priority.spec.ts:19-68`, beide mit einem Memo, einem Effect und der Standardpriorität — also nie in der Konstellation, in der `beforeRead` überhaupt gebraucht wird (Messung 6).

  **Was bewusst keine Property wird**, damit es beim nächsten Audit nicht als Lücke zurückkommt: Effect-Callbacks, die selbst Signale **schreiben**. `batch.ts:75` sagt es im Code — »`batch()` is a _hint_ not a _guarantee_«. Ein Write aus einem Callback heraus geschieht bei geschlossenem Batch (`Batch.current` ist vor `curBatch.run()` bereits `undefined`, `batch.ts:128-129`) und stellt seine Effects sofort zu, außerhalb jeder Bucket-Ordnung; ein Memo, das ein höher priorisierter Effect liest, lässt diesen Effect re-entrant ein zweites Mal laufen (genau das dokumentiert `effects.priority.spec.ts:50-51`). Eine Property darüber müsste die vollständige Re-Entrancy-Semantik modellieren — das ist eine Spezifikationsarbeit, kein Test. Die sieben Properties setzen deshalb ausschließlich lesende, nicht werfende Callbacks ein, und das ist eine Grenze mit Begründung, keine Auslassung.

  **B — die Datei**

  8. Neue Datei `src/ordering.property.spec.ts`. Name nach Hausbrauch (`effects.priority.spec.ts`, `nested-effects-staticDeps.spec.ts`): Gegenstand, Bauart, Endung. Sie muss auf `.spec.ts` enden — daran hängen sowohl die `include` des `unit`-Projekts (`vitest.config.ts:49`) als auch die `coverage.exclude` (`:68`), und ohne die zweite fiele sie unter die 100-%-Pflicht der Stufe-2-Glob (`:95`).
     Kopf und Generatoren, gemessen und von Biome unverändert durchgewinkt (Schritt 22):
     ```ts
     import {Priority} from '@spearwolf/eventize';
     import fc from 'fast-check';
     import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
     import {batch} from './batch.js';
     import {createMemo} from './createMemo.js';
     import {createSignal} from './createSignal.js';
     import {createEffect, getEffectsCount} from './effects.js';
     import {destroySignal} from './signal-core.js';

     const FC = {seed: 20260807, numRuns: 500} as const;

     const priorityArb = fc.oneof(
       {arbitrary: fc.integer({min: -3, max: 3}), weight: 3},
       {
         arbitrary: fc.constantFrom(
           Priority.Min,
           Priority.Low,
           Priority.Normal,
           Priority.Medium,
           Priority.High,
           Priority.Max,
         ),
         weight: 1,
       },
     );

     /** Infinity-safe: `b - a` is NaN for two infinities of the same sign. */
     const byPriorityThenCreation = (
       a: readonly [number, number],
       b: readonly [number, number],
     ): number => (a[0] === b[0] ? a[1] - b[1] : a[0] > b[0] ? -1 : 1);
     ```
     Der schmale Bereich −3…3 ist der Grund, warum überhaupt Gleichstände entstehen (174 von 500, Messung 4); die `constantFrom`-Hälfte zieht die realen Werte der Bibliothek herein, `Priority.Min`/`Priority.Max` eingeschlossen — und **die** sind der Grund für den `byPriorityThenCreation`-Vergleicher: `b - a` ist für zwei gleichsinnige Unendlichkeiten `NaN`, und ein `NaN` liefernder Comparator macht `Array#sort` zur Zufallsquelle. Der Fehler säße dann im Erwartungswert des Tests, nicht in der Bibliothek — das ist die unangenehmste Sorte.
  9. `describe('ordering invariants (property based)')` mit `beforeEach`/`afterEach`, die `assertEffectsCount(0, …)` und `assertSignalsCount(0, …)` prüfen — Hausstil, und hier besonders nötig: eine Property, die 500 Szenarien aufbaut, muss jedes einzeln wieder abräumen. **Jedes Szenario räumt in einem `finally` ab** (Effects `destroy()`, Signale `destroySignal()`), damit auch der erste fehlschlagende Lauf keinen Rest hinterlässt, an dem anschließend die `afterEach`-Bilanz scheitert und die eigentliche Fehlermeldung unter einem Folgefehler verschwindet.
  10. Die vier Szenariengeneratoren, mit den gemessenen Wertebereichen:
      - **P1:** `fc.array(priorityArb, {minLength: 1, maxLength: 8})`.
      - **P2/P3/P4** (ein `it`, drei Assertionsblöcke, weil sie dasselbe Szenario auswerten):
        ```ts
        fc.integer({min: 1, max: 4}).chain((numSignals) =>
          fc.record({
            numSignals: fc.constant(numSignals),
            effects: fc.array(
              fc.record({
                priority: priorityArb,
                deps: fc.uniqueArray(fc.integer({min: 0, max: numSignals - 1}), {
                  minLength: 1,
                  maxLength: numSignals,
                }),
              }),
              {minLength: 1, maxLength: 6},
            ),
            writes: fc.array(fc.integer({min: 0, max: numSignals - 1}), {
              minLength: 1,
              maxLength: 8,
            }),
          }),
        )
        ```
        `chain` statt `record`, weil der Wertebereich der Signal-Indizes von `numSignals` abhängt — mit einem flachen `record` wären Indizes und Signalanzahl unabhängig gezogen und die Hälfte der Fälle unbrauchbar.
      - **P5:** derselbe Generator (Effects auf 1…5 begrenzt), dazu ein `fc.letrec`-Programmbaum:
        ```ts
        fc.letrec<{node: Node}>((tie) => ({
          node: fc.oneof(
            {maxDepth: 3, depthSize: 'small'},
            fc.record({
              type: fc.constant('write' as const),
              sig: fc.integer({min: 0, max: numSignals - 1}),
            }),
            fc.record({
              type: fc.constant('batch' as const),
              body: fc.array(tie('node'), {minLength: 1, maxLength: 4}),
            }),
          ),
        })).node
        ```
        `maxDepth: 3` und `depthSize: 'small'` sind beide nötig: ohne `maxDepth` ist die Rekursion unbegrenzt, ohne `depthSize` kippt die Verteilung fast vollständig auf Tiefe 0. Gemessen ergibt sich 245/68/71/116 über die Tiefen 0…3. `minLength: 1` bei `body` garantiert, dass jeder Baum mindestens einen Write trägt (gemessen: nie null Writes) — ein Baum ohne Write würde die Property leer durchlaufen lassen.
      - **P6:** zwei unabhängige Integer, `fc.integer({min: 0, max: 4})` für die Tiefe und `fc.integer({min: 1, max: 5})` für die Zahl der Reruns.
      - **P7:** `numSignals` 1…3, `memoDeps` als `fc.uniqueArray` darüber (`minLength: 1`), 1…4 Effects mit `readsMemo: fc.boolean()`, `deps` als `fc.uniqueArray` mit `minLength: 0` (ein Effect, der **nur** das Memo liest, ist der interessanteste Fall), `writes` 1…6, und für die Priorität:
        ```ts
        priority: fc.oneof(
          fc.integer({min: -5, max: 0}),
          fc.constantFrom(Priority.High, Priority.Critical, 1001),
        ),
        ```
        Die zweite Hälfte liegt bewusst **über** der Memo-Priorität `Priority.C = 1000` — siehe Messung 6. `1001` steht explizit daneben, weil `Priority.High` und `Priority.Critical` weit darüber liegen und der Grenzfall »ein Punkt über dem Memo« sonst nie gezogen würde.
  11. Alle fünf `fc.assert`-Aufrufe bekommen dasselbe `FC`-Objekt als zweites Argument. Kein `fc.configureGlobal()` am Modulanfang: das wirkt worker-weit und würde eine spätere zweite Property-Datei im selben Worker stillschweigend mitkonfigurieren.

  **C — wo die Suite lebt, und was sie mit der Coverage macht**

  12. Der Querbezug vom 2026-08-07 trägt, gemessen: die Datei ist eine gewöhnliche Spec im `unit`-Projekt. `vitest.config.ts` wird **nicht** angefasst — kein drittes Projekt, keine eigene `include`, kein Timeout. Der Prototyp lief unter `vitest run --project unit src/ordering.property.spec.ts` und in `pnpm test` gleichermaßen.
  13. Die Laufzeitsorge aus dem Auftrag ist gemessen unbegründet: 190 ms bei `numRuns: 500`, gegen 594 ms Testzeit der übrigen 39 Dateien. Der Unterschied zwischen 200 und 1000 Läufen beträgt 225 ms — es gibt hier keinen Grund, an der Zahl zu sparen. **500** ist gewählt, weil bei 200 Läufen die interessanten Fälle des Szenariengenerators (teilweise betroffene Effects, gar keine betroffenen) auf 31 bzw. 7 Vorkommen fallen; bei 500 sind es 77 und 18.
  14. Coverage: Messung 2 — keine Zelle bewegt sich. Die Suite kann keine Schwelle reißen, weil sie nur Pfade betritt, die schon gedeckt sind, und weil sie als `*.spec.ts` selbst nicht gemessen wird. Die drei Stufen aus Paket 5 bleiben unverändert; es gibt in diesem Paket keinen Anlass, eine Datei aus Stufe 2 oder 3 in Stufe 1 zu schieben.
  15. `pnpm compile` sieht die Datei nie (`tsconfig.lib.json` hat `exclude: ["src/**/*.spec.ts"]`), fast-check erreicht damit weder `lib/` noch `dist/`; `.npmignore` schließt `src` ohnehin aus. Der Smoke-Test aus Paket 6 und `checkPkgTypes` sind nicht betroffen — eine devDependency taucht in der `exports`-Map nicht auf.

  **D — die Dependency**

  16. `package.json`, `devDependencies` — `"fast-check": "^4.9.0"` einsortiert zwischen `"@vitest/coverage-v8"` und `"npm-run-all2"` (alphabetisch, wie der ganze Block). Caret-Range wie bei allen übrigen devDependencies des Projekts; die eine Ausnahme wäre ein Grund, der hier fehlt.
  17. Begründung für den Plan und für den Report: fast-check ist die einzige Property-Testing-Bibliothek des JS-Ökosystems mit Shrinking, die ESM-nativ ausgeliefert wird (`"type": "module"`, dualer `exports`-Block), keine Peer-Abhängigkeit auf einen Testläufer hat — sie ist Testläufer-agnostisch und arbeitet in Vitest über gewöhnliche `it()`-Blöcke — und mit genau einer transitiven Abhängigkeit auskommt (`pure-rand`, vom selben Autor, ebenfalls reines JS). `engines.node >= 12.17.0` ist mit dem `>=24.13` dieses Projekts verträglich; gemessen unter Node 25.9.0.
  18. `pnpm-lock.yaml` — Ergebnis von `pnpm add -D fast-check`, 16 Zeilen. Nicht von Hand editieren.
  19. `pnpm-workspace.yaml` bleibt **unverändert**. `allowBuilds` ist nur für Pakete mit Build-Skript nötig (heute genau `@swc/core`); weder `fast-check` noch `pure-rand` bringen ein `preinstall`/`install`/`postinstall`/`prepare` mit, und `pnpm add` meldete keinen ignorierten Build. Die Gegenprobe dazu steht in Schritt 23.

  **E — Determinismus**

  20. Der Schalter ist die **`seed`-Option von `fc.assert(property, {seed, numRuns})`**, hier fest auf `20260807`. Kein `Date.now()`, keine Env-Variable.
      Der Grund ist der, den Paket 4 schon einmal in derselben Codebasis durchgesetzt hat, als es die Wanduhr aus `SignalLink.spec.ts` warf: ein CI-Fehlschlag muss mit demselben Befehl reproduzierbar sein. fast-check druckt beim Fehlschlag `{seed, path, endOnFailure}` und den geschrumpften `Counterexample`; mit festem Seed genügt ein erneuter Lauf, ohne dass jemand einen Seed aus einem Log fischen muss, das der nächste Push überschreibt. Gemessen: alle sieben Mutanten aus Messung 5 lieferten einen deterministischen, geschrumpften Gegenbeleg (etwa `[{"numSignals":3,"effects":[{"priority":Number.NEGATIVE_INFINITY,"deps":[0]},{"priority":0,"deps":[1]}],"writes":[0,1,0]}]` für den Splice-Mutanten).
      Was damit aufgegeben wird, gehört genannt: die Suite untersucht bei jedem Lauf dieselben 500 Eingaben je Property. Der Gewinn gegenüber beispielbasierten Tests liegt aber nicht in der Zufälligkeit, sondern in den 500 maschinell gewählten Eingaben statt zwei handverlesenen — und die prüfen jede künftige Fassung des Codes. Wer breiter suchen will, zieht lokal `numRuns` hoch oder ändert den Seed; in der Datei bleibt beides fest.
      Verworfen: ein Override über `process.env`. Das gäbe der CI einen Weg, per Konfiguration unreproduzierbar zu werden — genau der Ausfallmodus, gegen den der feste Seed gesetzt wird.

  **F — der TEST-013-Verzicht in `AGENTS.md`**

  21. **Ort:** eine neue Unterüberschrift `### Deliberately not tested` im Abschnitt `## Development workflow`, **hinter** dem SWC-Absatz (`AGENTS.md:187`) und unmittelbar **vor** `## Repo conventions` (`:189`). Begründung für genau diese Stelle: die drei Absätze davor (`:183`, `:185`, `:187`) sagen, was die Pipeline prüft und in welcher Reihenfolge — die Frage »und was prüft sie bewusst nicht« stellt sich dort und nirgends sonst. Verworfen: ein Aufzählungspunkt unter `## Repo conventions` (`:189-197`). Dort stehen Regeln für das Schreiben von Code (`Edit only src/`, `.js`-Endungen, keine defensiven `?:`), keine Aussagen über den Prüfumfang; der `smoke/`-Punkt (`:194`) ist das Vorbild für den **Ton** dieses Absatzes, nicht für seinen Ort.
  22. **Der Text** muss vier Aussagen tragen, sonst meldet das nächste Audit dieselbe Lücke erneut. Alle vier sind am 2026-08-07 gemessen und gehören mit ihrer Fundstelle in den Absatz:
      1. **Was nicht existiert:** kein Browser-Testlauf, kein Playwright, kein `@vitest/browser`, kein jsdom/happy-dom, kein zweiter CI-Job. Beide Workflows fahren einen Job auf `ubuntu-latest` (`ci.yml:10-12`, `main.yml:12-14`), `vitest.config.ts:30` steht auf `environment: 'node'`. Das ist eine Entscheidung, kein Versäumnis.
      2. **Warum das reicht:** `src/` benutzt keine plattformabhängige API. Gemessen: ein `grep` über `src/*.ts` ohne Specs nach `node:`, `process.`, `Buffer`, `setTimeout`, `setInterval`, `queueMicrotask`, `structuredClone`, `globalThis` und `require(` liefert **keinen** Treffer außer drei Kommentarzeilen. Die einzigen nicht-trivialen Laufzeitobjekte sind `WeakRef` (`src/SignalLink.ts:79`, `:417`, `src/SignalGroup.ts:156`, `:242`) und `FinalizationRegistry` (`src/link.ts:76`, `src/SignalGroup.ts:58`), dazu `console.error` — alles ECMAScript, in jeder ES2023-Engine gleich. Ein Browserlauf würde dieselbe engine-unabhängige Logik ein zweites Mal ausführen.
      3. **Wo das Umgebungsrisiko tatsächlich sitzt, und wer es prüft:** in der Auflösung, nicht in der Ausführung. Die `exports`-Map und die Deklarationen prüft `attw --pack --profile esm-only` unter anderem im Modus `bundler` — genau der Weg, über den ein Browser-Konsument dieses Paket bezieht —, und `smoke/dist-smoke.test.ts` führt das gebaute `dist/` aus. Die TC39-Dekorator-Senkung leistet der Compiler des Konsumenten, nicht die Engine; genau diese Senkung fährt der Smoke-Test mit tsc.
      4. **Warum ein Browserlauf ausgerechnet den Rest nicht abdeckte:** das einzige, was in einer anderen Engine anders ausfallen könnte, ist das GC-Timing um `WeakRef`/`FinalizationRegistry` — und die neun Tests, die es prüfen, hängen an `--expose-gc` (`vitest.config.ts:58`), das ein portabler Browser-Harness nicht liefert. Ein Browser-Smoke-Test würde ausgerechnet die Tests überspringen, deren Antwort er ändern könnte.
      Dazu ein Schlusssatz, der die Entscheidung überprüfbar macht statt sie bloß zu behaupten: **was sie umstoßen würde** — die erste Zeile in `src/`, die eine DOM- oder Node-API anfasst, oder ein eigener Browser-Entry in der `exports`-Map.
  23. `docs/quickstart.md:10` (»ESM-only. Requires Node `>=24.13` or a modern browser. Targets ES2023.«) bleibt **unverändert**, ebenso die gleichlautende Stelle in `skills/using-signalize/SKILL.md:8` (»Node `>=24.13` or any modern browser«), die das Audit nicht nennt. Nach der Messung aus Schritt 22.2 ist die Aussage wahr: sie behauptet Lauffähigkeit, nicht einen Browser-Testlauf. Ein Zusatz wie »ungetestet« wäre eine Warnung ohne Anlass in zwei Dokumenten für Konsumenten — und die Begründung, warum es keinen Browserlauf braucht, gehört ins Agenten-Dokument, nicht in den Quickstart. Sollte Schritt 22 den Absatz anders formulieren, als hier vorgesehen, gilt: der Absatz muss zu diesen beiden Zeilen passen, nicht umgekehrt.

  **G — CHANGELOG und Gegenproben**

  24. `CHANGELOG.md` — zwei Zeilen unter `## Unreleased`, englisch, je ein Fakt. Unter `### Tests` (`:75`): dass eine fast-check-Property-Suite die Reihenfolge-Zusagen — Prioritätsordnung mit und ohne Batch, Dedup und Endwerte im Flush, geschachtelte Batches, geschachtelte Effects, das Memo im Flush — über generierte Szenarien mit festem Seed prüft; Finding-ID `(TEST-012)`. Unter `### Chores` (`:69`): dass `fast-check` als devDependency dazugekommen ist. Für den `AGENTS.md`-Absatz **keine** Zeile: an der Bibliothek ändert sich nichts, was ein Konsument sehen könnte, und `CLAUDE.md` erlaubt für rein interne Änderungen das Auslassen.
  25. `CONTRIBUTING.md` und `CLAUDE.md` bleiben unverändert. Es kommt kein Skript hinzu, keine Kommandotabelle ändert sich, und die Konvention »Tests sind `*.spec.ts` neben der Implementierung« gilt für diese Datei genauso wie für die 39 anderen — sie ist keine neue Testsorte, anders als `smoke/` in Paket 6.
  26. Gegenproben vor dem Commit, in dieser Reihenfolge:
      - `pnpm test` → **40 Dateien, 416 Tests**, keine einzige `ERROR: Coverage …`-Zeile, und `coverage/coverage-summary.json` zellengleich zu Messung 2 (99,01 / 94,03 / 99,51 / 99,59). Weicht eine Zelle ab, hat die Suite ungewollt Produktionscode neu berührt — kein Fehler, aber der Anlass, die drei Stufen aus Paket 5 nachzurechnen, bevor der Commit steht.
      - **Die Mutationsprobe, Pflicht im Report.** Mindestens drei der sieben Mutanten aus Messung 5 einzeln scharf stellen, laufen lassen, die Ausgabe (`Property failed after N tests` samt `Counterexample`) festhalten, zurückbauen. Bei generierten Eingaben ist der Verdacht größer als sonst, dass der Generator am Prüfgegenstand vorbeizielt: eine Property, die nie rot war, ist keine.
      - **Die Seed-Probe.** Eine Assertion absichtlich umdrehen und die Datei zweimal hintereinander laufen lassen: beide Läufe müssen denselben `Counterexample` und denselben `path` melden. Danach zurücknehmen. Ohne diese Probe ist nicht unterscheidbar, ob der Seed greift oder ob fast-check ihn stillschweigend ignoriert.
      - **Die Verteilungsprobe.** Die Zahlen aus Messung 4 einmal reproduzieren (Gleichstände, teilweise betroffene Effects, Baumtiefen). Ein Generator, der nie einen Prioritätsgleichstand erzeugt, lässt die Tie-Break-Hälfte von P1 leer durchlaufen; ein Programmbaum ohne Schachtelung macht P5 zur Tautologie.
      - `pnpm check` → Exit 0, und die neue Datei ist tatsächlich erfasst: `biome check src/ordering.property.spec.ts` meldet `Checked 1 file`. Gemessen: Biome besteht auf der Importsortierung (`createMemo` vor `createSignal`) — einmal `pnpm fix`, danach läuft die Datei unverändert durch.
      - `pnpm world` → Exit 0, gemessen 9,5 s.
      - `pnpm install` gibt **keine** »Ignored build scripts«-Warnung aus; `pnpm-workspace.yaml` ist unverändert (Schritt 19).
- Verify: `pnpm world`, dazu die sieben Gegenproben aus Schritt 26
- Commit: `test(ordering): pin the priority, batch and nesting invariants with fast-check, and record the browser-test decision (TEST-012, TEST-013)`
- Abgleich (2026-08-07):
  - **TEST-012 unverändert in der Sache, in der Fundstelle verschoben.** Die Angabe `package.json:44-58` zeigte im Audit auf den `devDependencies`-Block; nach den Paketen 5 und 6 (`test:smoke`, `smoke`, `world`, `checkPkgTypes --profile esm-only`) steht er auf `:46-60`. Der Befund gilt zeilengenau weiter: `grep -rin "fast-check|property-based|property based|fuzz"` über `src/`, `docs/`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `package.json` und `pnpm-lock.yaml` liefert **null Treffer** — also weder eine Property-Suite noch eine dokumentierte Entscheidung dagegen. Die Kernaussage des Findings ist nach Sprint 1 sogar schärfer geworden: die Pakete 1 bis 6 haben 39 Tests ergänzt, keiner davon generativ, und die beiden Dateien, an denen die Reihenfolge-Zusage hängt (`batch.spec.ts`, `effects.priority.spec.ts`), stehen weiter bei zwei bis drei handverlesenen Prioritätskombinationen.
  - **TEST-013 unverändert in der Sache, in beiden Fundstellen verschoben.** `.github/workflows/ci.yml:9-11` zeigt weiterhin auf den einzigen Job (`jobs.test`, `runs-on: ubuntu-latest`), die Zeilen haben sich durch Paket 5 und 6 nicht verschoben; `main.yml:11-14` führt denselben einen Job, was das Audit nicht nennt. `vitest.config.ts:36` zeigt seit Paket 5 (`f51ccfb`) nicht mehr auf `environment: 'node'` — die Angabe steht heute auf `:30`, `:36` liegt im `plugins`-Block. Der Zustand selbst ist unverändert: kein playwright, kein jsdom, kein happy-dom, kein `@vitest/browser` im Lockfile, und `docs/quickstart.md:10` nennt »a modern browser« weiterhin als Zielumgebung. Ergänzend gemessen und vom Audit nicht genannt: `skills/using-signalize/SKILL.md:8` erhebt denselben Anspruch, und `src/` enthält keine einzige plattformabhängige API (Schritt 22.2) — was die Empfehlung nicht entwertet, aber ihre Kosten-Nutzen-Rechnung entscheidet und der Grund ist, warum der Verzicht dokumentiert statt umgesetzt wird.

**TEST-012 · low · package.json:44-58 · src/\*\*/\*.spec.ts** — Keine Property-Based-Tests für Scheduler-Reihenfolgen
Kein fast-check im Lockfile, kein Treffer für »property-based« oder »fuzz« in `src/`, `docs/` oder den Agenten-Dokumenten — und auch keine dokumentierte Entscheidung dagegen. Für eine Bibliothek, deren Kernzusage eine deterministische Ausführungsreihenfolge unter Prioritäten, Batches und Verschachtelung ist, wäre genau das der Bereich, in dem beispielbasierte Tests systematisch Lücken lassen.
Empfehlung: Eine kleine fast-check-Suite für die Reihenfolge-Invarianten aufsetzen (Prioritätsordnung, Dedup im Batch, Nesting) — oder die bewusste Entscheidung dagegen in `AGENTS.md` festhalten.

**TEST-013 · low · .github/workflows/ci.yml:9-11 · vitest.config.ts:36** — Kein Browser-Smoke-Test
Beide Workflows fahren genau einen Job auf `ubuntu-latest`/Node 24; kein playwright, jsdom, happy-dom oder `@vitest/browser` im Lockfile, und `environment: 'node'` in der Vitest-Config. `docs/quickstart.md:10` nennt »a modern browser« ausdrücklich als Zielumgebung — geprüft wird sie nie.
Empfehlung: Einen minimalen Browser-Smoke-Test über `@vitest/browser` oder Playwright ergänzen, der das gebaute `dist/` in einer echten Engine lädt.
Entscheidung des Nutzers (2026-08-07): **nicht bauen.** Der Verzicht wandert als begründete Entscheidung nach `AGENTS.md` — Ort und Inhalt in Schritt 21 und 22.

### Sprint 2 — Korrektheit

#### [x] 8. SignalLink: schreiben, nachdem der Link tot ist
- Findings: BUG-001 (critical), BUG-002 (high), BUG-008 (medium)
- Ziel: `updateValue()` und `destroy()` überstehen Selbstzerstörung aus dem Callback und re-entrante Propagation, ohne zu werfen oder einen veralteten Wert nachzuschieben.
- Bereich: `src/SignalLink.ts`, zugehörige Specs
- Hängt ab von: —
- Modell: stärkste Stufe
- Hash: `d44427d`
- Ergebnis (2026-08-07): BUG-001, BUG-002 und BUG-008 behoben. Eine Review-Runde. Alle drei Fehler wurden vom Planer, vom Implementierer und vom Reviewer je einzeln reproduziert, wortgleich zur `evidence` des Audits (`TypeError: Cannot assign to read only property 'lastValue'` für beide Link-Varianten, `RangeError: Maximum call stack size exceeded`, `[2,1]` statt `[2]`). BUG-008 wurde **nicht** nach der Audit-Empfehlung gefixt: Nachlesen von `this.source.value` beseitigt den veralteten Wert, dupliziert aber die Emission und meldet im Stumm-Fall einen Wert, den der Link nicht hätte sehen dürfen. Umgesetzt ist die zweite vom Audit genannte Variante, eine Propagationsgeneration pro Link — gemessen über drei Verschachtelungsebenen (`[3,2,1]` → `[3]`), zwei Links auf derselben Quelle, `touch()`, `mute()` und 2000 Frames am Stück. Runde 1 behob einen `wichtig`: das vorgezogene `isDestroyed` machte einen halb zerstörten Link **dauerhaft** — warf ein DESTROY-Listener, liefen `retainClear`, `off(this)` und `Object.freeze(this)` nie, und der Guard verhinderte, dass ein zweites `destroy()` das nachholt. Der Emit steckt jetzt im selben Sammelmuster wie die `#releaseOnDestroy`-Schleife. Der Reviewer hat eine vollständige 4×5-Mutationsmatrix gefahren: jeder der fünf Tests fällt genau bei seiner eigenen Teil-Rücknahme, keiner deckt einen fremden Fix mit ab. Verify selbst gelaufen: `pnpm world` Exit 0, 40 Dateien / **421 Tests** (Baseline 416). `src/SignalLink.ts` bleibt auf 100 % in allen vier Metriken (128/128 Statements, 47/47 Zweige) — die Schwelle aus Paket 5 hält ohne Luftverbrauch.
- Breaking Changes (im CHANGELOG festgehalten, für die Semver-Bewertung beim Abschluss):
  - Ein `'destroy'`-Listener sieht `isDestroyed === true`. Jede Methode mit Flag-Wache verhält sich von dort aus wie auf einem toten Link: `attach()` wirft, `mute()`/`unmute()`/`toggleMute()` ändern nichts und emittieren nichts, `touch()` propagiert nicht, `nextValue()` rejectet sofort (BUG-002).
  - Ein von einer Rückkopplung überholter Propagationsdurchlauf verschluckt seine `VALUE`-Emission — pro Schreibvorgang kann eine Emission weniger ankommen (BUG-008).
- Nebenbefunde:
  - **Für Paket 14 relevant:** eventize bricht bei einem werfenden Listener die restliche Zustellung ab. Ist der Werfer **vor** `attach()` registriert, behält die Gruppe den zerstörten, gefrorenen Link dauerhaft in ihrem `#links`-Set (gemessen: `memAfter: 1`; Werfer nach `attach()` → `memAfter: 0`). `getLinksCount()` ist nie betroffen, weil `src/link.ts` seinen Buchhaltungs-Listener immer zuerst registriert. Vorbestehend, ohne Per-Listener-Isolation in eventize nicht behebbar — trifft aber genau die MEM-002-Gegenkante.
  - `klein`, offen: der Kommentar in `src/SignalLink.ts:376-387` sagt, der Emit trete »the same collect-and-carry-on pattern as the release loop above« bei. Die Release-Schleife isoliert jedes Handle einzeln, der Emit hat ein `try` um den ganzen Aufruf — die Zusage greift weiter als der Code trägt.
  - `klein`, offen: das Label von `throwCollectedErrors` in `destroy()` spricht weiterhin nur von Queue-Subscriptions, während der Topf jetzt auch Listener-Fehler enthält. Eine Umformulierung bricht die Wortlaut-Zusicherung in `src/SignalLink.spec.ts:528`.
- Dateien: `src/SignalLink.ts`, `src/SignalLink.spec.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Alle drei Fehler wurden am 2026-08-07 gegen `lib/` (Stand `7155066`, frisch kompiliert) reproduziert; die Ausgaben decken sich wörtlich mit den `evidence`-Feldern des Audits:

  ```
  BUG-001 A: THROWS -> TypeError: Cannot assign to read only property 'lastValue' of object '#<SignalLinkToCallback>'
  BUG-001 B: THROWS -> TypeError: Cannot assign to read only property 'lastValue' of object '#<SignalLinkToSignal>'
  BUG-002:   THROWS -> RangeError: Maximum call stack size exceeded
  BUG-008:   VALUE order: [2,1]   lastValue: 1   source: 2   target: 2
  ```

  Die Zielfassung aus Schritt 1 bis 3 wurde in einer Arbeitskopie des Baums (außerhalb des Projekts) vollständig durchgemessen: `vitest run` 40 Dateien / 420 Tests grün (Baseline 416), `vitest run --config vitest.gc.config.ts` ebenfalls 420 grün, `tsc --project tsconfig.lib.json` ohne Befund, `biome check src/SignalLink.ts src/SignalLink.spec.ts` sauber. **`src/SignalLink.ts` bleibt bei 100 % auf allen vier Metriken**: 126/126 Statements, 47/47 Zweige (vorher 43/43), 32/32 Funktionen, 121/121 Zeilen. Die vier neuen Zweige sind die beiden Nachgucker in `updateValue()`, je in beiden Richtungen — die Tests aus Schritt 5 führen beide `return`-Zweige aus. Die Schwelle aus Paket 5 (`SignalLink.ts`: Statements/Funktionen/Zeilen 100, Zweige 95) hält damit ohne Luftverbrauch; die »zwei ungedeckten Zweige« Spielraum bleiben unangetastet.

  **A — die Zielfassung, als Ganzes**

  Die drei Fixes greifen in dieselben zehn Zeilen. Sie werden **nicht** nacheinander gepatcht, sondern in einem Zug geschrieben. Reihenfolge im Code: erst das neue Feld (Schritt 1), dann `destroy()` (Schritt 2), dann `updateValue()` (Schritt 3).

  1. `src/SignalLink.ts` — neues privates Feld direkt hinter `#activeAsyncValuesCount` (heute Zeile 52), vor `readonly source`:
     ```ts
     // BUG-008: bumped once per `updateValue()` frame, before control goes
     // to `action()`. Only ever compared for equality — the absolute value
     // carries no meaning, and no path reads it from outside this class.
     #propagationGeneration = 0;
     ```
     Ein privates Klassenfeld, kein `Object.freeze`-Problem: der S7-Kommentar in Zeile 39–43 hält bereits fest, dass `Object.freeze(this)` private Felder gar nicht erreicht. Ein `#`-Feld ist außerdem nicht Teil der öffentlichen Oberfläche und braucht keinen Doku-Eintrag.

  2. `src/SignalLink.ts:320-324` — `this.isDestroyed = true` an den Anfang von `destroy()` ziehen (BUG-002). Aus
     ```ts
     destroy() {
       if (this.isDestroyed) return;

       this.#unsubscribe?.();
     ```
     wird
     ```ts
     destroy() {
       if (this.isDestroyed) return;

       // BUG-002: flag first, teardown second — same rule and the same
       // reason as `EffectImpl.destroy()` (`src/EffectImpl.ts:804-807`).
       // Everything below reaches application code: `emit(this, DESTROY,
       // this)` serves every listener, and an `on()` listener — unlike a
       // `once()` one — is still subscribed while it runs. One that calls
       // `destroy()` again used to walk into an unguarded teardown and
       // recurse until the stack blew; the guard above now catches it. It
       // also makes `isDestroyed` tell the truth *inside* a DESTROY
       // listener, which is what `updateValue()`'s post-`action()` check
       // relies on when the callback destroys the link.
       this.isDestroyed = true;

       this.#unsubscribe?.();
     ```
     und die alte Zuweisung im Rumpf (heute Zeile 355, zwischen `this.lastValue = undefined;` und `Object.freeze(this)`) **entfällt ersatzlos**. `this.lastValue = undefined;` und `Object.freeze(this)` bleiben in dieser Reihenfolge stehen, ebenso `throwCollectedErrors(...)` am Ende.

     Was sich dadurch beobachtbar ändert: ein `on(link, DESTROY, …)`-Listener sieht `link.isDestroyed === true` statt `false`, und `link.attach(obj)` aus einem DESTROY-Listener heraus wirft jetzt `Cannot attach a destroyed link to a group` (`src/SignalGroup.ts:630`), statt einen toten Link stumm in eine Gruppe zu hängen. Beides ist die Korrektur, nicht ihr Preis. Geprüft: keine Spec liest `isDestroyed` in einem DESTROY-Listener (`grep -rn "isDestroyed" src/*.spec.ts` schneidet keine solche Stelle), `SignalGroup.detachLink()` (`:646-652`) hat keine `isDestroyed`-Wache, und die Buchhaltung in `src/link.ts:179-188` liest das Flag nicht.

  3. `src/SignalLink.ts:396-403` — `updateValue()` vollständig ersetzen (BUG-001 + BUG-008):
     ```ts
     protected updateValue(action: (value: ValueType) => void) {
       if (!this.#muted && !this.isDestroyed) {
         // BUG-008: claim a generation *before* handing control over. Every
         // line below the `action()` call can have been re-entered by then;
         // this counter is how the outer frame finds out that it was.
         const generation = ++this.#propagationGeneration;

         const {value} = this.source;

         action(value);

         // BUG-001: `action()` is application code — the link callback, or
         // the target signal's write plus every effect it triggers. Tearing
         // this link down from in there is the normal case ("take the first
         // value, then unsubscribe"), and `destroy()` ends with
         // `Object.freeze(this)`, so the assignment below would raise a
         // TypeError in strict mode — out of a plain `signal.set()`,
         // aborting the rest of that write's delivery. Nothing is lost by
         // leaving now: `destroy()` has already emitted DESTROY and run
         // `off(this)`, so there is no VALUE listener left to serve, and it
         // set `lastValue` to `undefined` on purpose.
         if (this.isDestroyed) return;

         // BUG-008: a nested `updateValue()` ran to completion while
         // `action()` was on the stack — a feedback loop wrote the source
         // again. That frame read a newer value, emitted it and stored it.
         // `value` is stale on both signals by now; emitting it here would
         // announce a state that exists nowhere, and announce it *after*
         // the newer one. Dropping the superseded frame is the only order
         // that keeps VALUE monotonic without emitting before `action()`.
         if (this.#propagationGeneration !== generation) return;

         emit(this, VALUE, value);
         this.lastValue = value;
       }
     }
     ```
     Die Wächter-`if` in Zeile 397 bleibt in ihrer heutigen Form (`if (!this.#muted && !this.isDestroyed) { … }`) und wird **nicht** in Frühausstiege umgeschrieben. Grund ist die Coverage-Schwelle: `#muted === true` erreicht `updateValue()` heute ausschließlich über `touch()` auf einem stummgeschalteten Link (`src/link.spec.ts:221-236`) — als eigene `if (this.#muted) return;`-Zeile wäre der Rumpf zwar gedeckt, der Umbau kostet aber ohne Gegenwert ein Statement und zwei Zweige an einer Datei, die auf 100 % steht.

  **B — warum die Empfehlung des Audits zu BUG-008 nicht reicht**

  4. Die Audit-Empfehlung lautet: »`this.source.value` nach `action()` erneut lesen«. Beide Kandidaten wurden am 2026-08-07 gegen dieselbe Reproduktion gemessen (Quelle → Ziel, ein Effect auf dem Ziel schreibt die Quelle erneut; Quelle geht 0 → 1 → 2):

     | Fassung | VALUE-Reihenfolge | `lastValue` |
     | --- | --- | --- |
     | heute | `[2, 1]` | `1` |
     | Audit-Empfehlung (Nachlesen) | `[2, 2]` | `2` |
     | Propagationsgeneration | `[2]` | `2` |

     Das Nachlesen repariert `lastValue` und räumt den veralteten Wert weg — aber es dupliziert die Emission. Der äußere Rahmen meldet denselben Wert ein zweites Mal, den der innere gerade gemeldet hat. Das Finding beschreibt ausdrücklich ein Reihenfolgeproblem (»der neuere Wert wird VOR dem älteren emittiert«), und aus `[2, 1]` ein `[2, 2]` zu machen heißt, den falschen Wert durch einen überzähligen zu ersetzen. Ein `for await`-Konsument bekäme dann eine Wiederholung serviert, die auf keinen Schreibvorgang zurückgeht.

     Zweitens ist das Nachlesen im Stumm-Fall aktiv schädlich: schaltet `action()` den Link stumm und schreibt danach die Quelle, läuft kein verschachtelter Rahmen (der Handler in `:83` prüft `!self.#muted`), und der äußere Rahmen würde einen Wert melden, der eintraf, **während** der Link stumm war. Die Generation lässt ihn in genau diesem Fall den Wert melden, der noch legitim in der Zustellung war.

     Deshalb wird die zweite, im Audit ebenfalls genannte Variante umgesetzt — die Propagationsgeneration pro Link — und **nicht** nachgelesen. `this.source.value` wird weiterhin genau einmal gelesen, vor `action()`.

  5. Die dritte denkbare Fassung — `emit` und `lastValue` **vor** `action()` ziehen, was `[1, 2]` ergäbe — wird nicht gebaut. Sie ist die einzige, die beide Emissionen erhält, dreht dafür aber die dokumentierte Zusage um: VALUE feuerte dann, bevor das Zielsignal geschrieben und bevor der Link-Callback gelaufen ist. `nextValue()` löste auf, bevor das Ziel den Wert trägt. Das ist eine Breaking Change am beobachtbaren Verhalten und gehört nicht in ein Bugfix-Paket.

  **C — die Regressionstests, rot zuerst**

  6. Alle vier Tests kommen in ein neues, verschachteltes `describe('BUG-001/002/008: destroy and re-entrancy during propagation', () => {…})` am Ende von `describe('SignalLink')` in `src/SignalLink.spec.ts`, direkt hinter dem `describe('S6: …')`-Block (nach Zeile 532). Die `beforeEach`/`afterEach`-Bilanz der Datei (`assertEffectsCount(0)`, `assertSignalsCount(0)`, `assertLinksCount(0)`) gilt mit — jeder Test räumt am Ende vollständig ab.

     Drei Imports sind zu ergänzen, sonst nichts:
     - Zeile 2: `on` in den eventize-Import → `import {getSubscriptionCount, on, once} from '@spearwolf/eventize';`
     - neue Zeile vor dem `global-queues.js`-Import: `import {DESTROY, VALUE} from './constants.js';`
     - Zeile 9: `createEffect` ergänzen → `import {createEffect, createSignal, destroySignal, link} from './index.js';`
     - Zeile 10: den Typ ergänzen → `import {type SignalLink, SignalLinkToCallback} from './SignalLink.js';`

  7. **Die vier Tests, biome-formatiert (`lineWidth: 80`) und in dieser Fassung durchgemessen:**
     ```ts
     describe('BUG-001/002/008: destroy and re-entrancy during propagation', () => {
       it('a callback destroying its own link mid-propagation lets the rest of the delivery finish', () => {
         const sigA = createSignal(1);

         const received: number[] = [];
         const con: SignalLink<number> = link(sigA, (value: number) => {
           received.push(value);
           if (value === 2) {
             con.destroy();
           }
         });

         const sibling: number[] = [];
         const witness = link(sigA, (value: number) => {
           sibling.push(value);
         });

         expect(
           received,
           'the constructor touch delivered the first value',
         ).toEqual([1]);
         expect(sibling).toEqual([1]);

         expect(() => {
           sigA.set(2);
         }).not.toThrow();

         expect(received, 'the callback saw the value it destroyed on').toEqual([
           1, 2,
         ]);
         expect(con.isDestroyed).toBe(true);
         expect(
           con.lastValue,
           'destroy() cleared it and nothing wrote it back',
         ).toBeUndefined();
         expect(
           sibling,
           'the second link on the same source was still served',
         ).toEqual([1, 2]);

         witness.destroy();
         destroySignal(sigA);
       });

       it('a link-to-signal whose target effect destroys the source mid-propagation does not throw', () => {
         const src = createSignal(0);
         const dst = createSignal(0);
         const con = link(src, dst);

         const {destroy: destroyEffect} = createEffect(() => {
           if (dst.get() === 42) {
             destroySignal(src);
           }
         });

         expect(() => {
           src.set(42);
         }).not.toThrow();

         expect(con.isDestroyed).toBe(true);
         expect(con.lastValue).toBeUndefined();
         expect(dst.value, 'the target did receive the value').toBe(42);

         destroyEffect();
         destroySignal(dst);
       });

       it('an on() DESTROY listener calling destroy() again is a no-op instead of a stack overflow', () => {
         const sigA = createSignal(1);
         const con = link(sigA, () => {});

         let destroyEvents = 0;
         let flagSeenByListener: boolean | undefined;
         on(con, DESTROY, () => {
           destroyEvents += 1;
           flagSeenByListener = con.isDestroyed;
           con.destroy();
         });

         expect(() => {
           con.destroy();
         }).not.toThrow();

         expect(destroyEvents, 'DESTROY is emitted exactly once').toBe(1);
         expect(
           flagSeenByListener,
           'the flag is already set when the listener runs',
         ).toBe(true);
         expect(con.isDestroyed).toBe(true);
         expect(Object.isFrozen(con)).toBe(true);

         destroySignal(sigA);
       });

       it('a feedback write during propagation does not emit the superseded value afterwards', () => {
         const src = createSignal(0);
         const dst = createSignal(0);
         const con = link(src, dst);

         const emitted: number[] = [];
         on(con, VALUE, (value: number) => {
           emitted.push(value);
         });

         let bounced = false;
         const {destroy: destroyEffect} = createEffect(() => {
           const v = dst.get();
           if (v === 1 && !bounced) {
             bounced = true;
             src.set(2);
           }
         });

         src.set(1);

         expect(emitted, 'only the value that survived is announced').toEqual([2]);
         expect(con.lastValue).toBe(2);
         expect(src.value).toBe(2);
         expect(dst.value).toBe(2);

         destroyEffect();
         con.destroy();
         destroySignal(src);
         destroySignal(dst);
       });
     });
     ```

     Zuordnung Test → Finding → Aussage nach dem Fix:

     | Test | Finding | die Assertion, die erst nach dem Fix etwas sagt |
     | --- | --- | --- |
     | `a callback destroying its own link mid-propagation …` | BUG-001 (Variante A, Callback-Link) | `expect(sibling, …).toEqual([1, 2])` — der zweite Link auf derselben Quelle wird noch bedient. Das ist die Aussage »die Zustellung bricht nicht ab«, nicht bloß »wirft nicht mehr«. Dazu `received` = `[1, 2]` (der Callback hat den Wert bekommen) und `con.lastValue === undefined` (nichts hat ihn nach dem `destroy()` zurückgeschrieben). |
     | `a link-to-signal whose target effect destroys the source …` | BUG-001 (Variante B, Signal-Link) | `expect(dst.value, …).toBe(42)` — der Wert ist beim Ziel angekommen, obwohl die Quelle mitten in der Zustellung gestorben ist; dazu `con.isDestroyed === true` und `lastValue === undefined`. |
     | `an on() DESTROY listener calling destroy() again …` | BUG-002 | `expect(destroyEvents, …).toBe(1)` — DESTROY wird genau einmal emittiert, statt endlos. Und `expect(flagSeenByListener, …).toBe(true)` — die eigentliche Ursache: der Listener sieht das Flag bereits gesetzt. |
     | `a feedback write during propagation …` | BUG-008 | `expect(emitted, …).toEqual([2])` — die Reihenfolge, nicht nur der Endzustand; dazu `con.lastValue === 2`. |

  8. **Der rote Lauf gehört in den Report.** Gemessen am 2026-08-07 gegen den unveränderten `src/`-Stand, jeder Test einzeln über `pnpm test -- SignalLink.spec.ts -t "<name>"`:
     - `lets the rest of the delivery finish` → `AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot assign to read only…' was thrown` / `"TypeError: Cannot assign to read only property 'lastValue' of object '#<SignalLinkToCallback>'"`
     - `target effect destroys the source` → dieselbe Meldung mit `'#<SignalLinkToSignal>'`
     - `no-op instead of a stack overflow` → `AssertionError: expected [Function] to not throw an error but 'RangeError: Maximum call stack size e…' was thrown`
     - `does not emit the superseded value` → `AssertionError: only the value that survived is announced: expected [ 2, 1 ] to deeply equal [ 2 ]`

     Einzeln laufen lassen ist hier kein Stilmittel, sondern nötig: im gemeinsamen roten Lauf reißt jeder der vier Tests seine Aufräumzeilen mit (der Wurf springt darüber hinweg), und die `beforeEach`-Bilanz der Datei färbt die jeweils folgenden Tests mit einem `Number of active signals should be 0 but is 1` ein. Das ist Folgeschaden des roten Laufs, kein zweiter Befund — nach dem Fix laufen alle vier gemeinsam grün.

  9. Zwei Gegenproben nach dem Fix, jeweils am Arbeitsbaum durchgespielt und zurückgenommen:
     - `src/SignalLink.ts` — die Zeile `if (this.#propagationGeneration !== generation) return;` streichen. Der BUG-008-Test muss mit `expected [ 2, 1 ] to deeply equal [ 2 ]` fallen; die drei anderen bleiben grün. Belegt, dass die Generation und nicht der BUG-001-Wächter die Reihenfolge herstellt.
     - `src/SignalLink.ts` — `this.isDestroyed = true;` wieder ans Ende von `destroy()` schieben. Der BUG-002-Test muss mit dem `RangeError` fallen **und** die beiden BUG-001-Tests mit dem `TypeError` — der Nachgucker in `updateValue()` hängt daran, dass das Flag zu diesem Zeitpunkt schon steht. Das ist die Kopplung, wegen der die drei Fixes ein Paket sind und keine drei.

  **D — die Dokumentation, in der Reihenfolge aus `CLAUDE.md`**

  10. **Quell-JSDoc.** Die drei Kommentarblöcke aus Schritt 1 bis 3 sind die Begründung im Code. Dazu bekommt das öffentliche Feld `lastValue` (`src/SignalLink.ts:56`) einen Doc-Kommentar, weil sich seine Zusage verengt:
      ```ts
      /**
       * The last value this link actually announced — i.e. the value of the
       * most recent `updateValue()` frame that ran to completion.
       *
       * Two frames deliberately leave it alone: one whose `action()`
       * destroyed this link (`destroy()` sets it to `undefined` and that
       * stands, BUG-001), and one that a nested, re-entrant frame superseded
       * while `action()` was running — the nested frame's newer value is the
       * one that stays (BUG-008).
       */
      lastValue?: ValueType;
      ```
  11. **`docs/api.md`.** Drei Stellen:
      - Zeile 319, die Tabellenzeile `lastValue` — `Last value propagated.` wird zu `Last value announced — see the note below on re-entrant propagation.`
      - Zeile 356, die `**Events**`-Zeile — dahinter ein Satz: dass ein `'destroy'`-Listener den Link bereits mit `isDestroyed === true` sieht, und dass ein `on()`-Listener, der `destroy()` erneut ruft, deshalb ein No-op auslöst statt einer Rekursion.
      - Zwischen dem `asyncValues()`-Sampler-Absatz (endet Zeile 354) und der `**Events**`-Zeile ein neuer Absatz »Re-entrant propagation«: Wenn `action()` — der Link-Callback oder ein Effect auf dem Zielsignal — die Quelle erneut schreibt, läuft der verschachtelte Durchlauf zuerst fertig. Der äußere gibt still auf: er emittiert kein `'value'` und schreibt `lastValue` nicht, weil sein Wert auf keinem der beiden Signale mehr existiert. Ein Konsument sieht die Werte deshalb monoton in Schreibreihenfolge und nie einen Rückfall. Zerstört `action()` den Link, gilt dasselbe — der Link wirft dann nicht mehr aus dem `signal.set()` heraus, und `lastValue` bleibt `undefined`.
  12. **`docs/recipes.md`.** Ein neuer Aufzählungspunkt hinter dem `asyncValues()`-Retain-Punkt (endet Zeile 539), im Ton der Nachbarpunkte: dass »ersten Wert nehmen, dann `destroy()`« aus dem Link-Callback heraus ein unterstützter Weg ist — der Aufruf von `set()`, der die Zustellung gestartet hat, kommt normal zurück, die übrigen Links auf derselben Quelle werden noch bedient, und `lastValue` bleibt `undefined`. Dazu der Rückkopplungsfall in einem Satz.
  13. **`docs/cheat-sheet.md`.** Zeile 94 (`con.lastValue; con.isMuted; con.isDestroyed;`) bekommt einen nachgestellten Kommentar in der Form der Nachbarzeilen: `// lastValue = last announced value; a frame superseded by a re-entrant write, or one whose callback destroyed the link, does not set it`.
  14. **`skills/using-signalize/`.** Zwei Dateien:
      - `references/api.md`, Zeile 166 (`A link is an eventize object and emits …`) — dahinter zwei Sätze mit demselben Inhalt wie der neue `api.md`-Absatz, in der knapperen Skill-Diktion.
      - `references/pitfalls.md` — ein neuer Punkt **17a** direkt hinter 17 (Zeile 77): dass ein Link-Callback sich selbst zerstören darf und dass eine Rückkopplung (Callback oder Ziel-Effect schreibt die Quelle erneut) den äußeren Durchlauf verschluckt, nicht den inneren. Ein Konsument von `nextValue()`/`asyncValues()` sieht deshalb pro Schreibvorgang höchstens einen Wert, und nie einen alten nach einem neuen.
      - `SKILL.md` wird **nicht** geändert: die Top-Sechs-Liste dort führt die Modellfragen, nicht das Verhalten eines einzelnen Link-Rahmens.
  15. **`README.md`** wird **nicht** geändert. Die »API at a glance«-Liste nennt in Zeile 119–120 nur `link, unlink, getLinksCount` ohne Lebenszyklus-Detail; es gibt dort nichts nachzuziehen.
  16. **`CHANGELOG.md`** — drei Zeilen am Ende der Liste unter `### Bug Fixes` (letzter Aufzählungspunkt heute Zeile 62), englisch, je ein Fakt, Finding-ID in Klammern am Zeilenende:
      - dass ein Link-Callback, der seinen eigenen Link zerstört, keinen `TypeError` mehr aus dem auslösenden `signal.set()` wirft und die restliche Zustellung nicht mehr abbricht (BUG-001);
      - dass `SignalLink.destroy()` sein `isDestroyed` jetzt vor dem DESTROY-Emit setzt, womit ein `on()`-Listener, der `destroy()` erneut ruft, ein No-op auslöst statt eines Stack-Überlaufs (BUG-002);
      - dass ein von einer Rückkopplung überholter Propagationsdurchlauf seinen veralteten Wert nicht mehr nachschiebt — `'value'` und `lastValue` tragen den Wert, der überlebt hat (BUG-008).
- Verify: `pnpm world`
  Zusätzlich vor dem Commit: `pnpm exec vitest run --project unit src/SignalLink.spec.ts -t "<name>"` einzeln für die vier neuen Tests, und die beiden Gegenproben aus Schritt 9. **Korrektur (2026-08-07, nach der Messung):** Die im Plan zitierte Form `pnpm test -- <datei> -t "<name>"` filtert nicht nach Testnamen — das `--` landet bei vitest, das alles dahinter als Dateifilter liest. Und die **zweite Gegenprobe aus Schritt 9 trägt nicht**: Implementierer und Reviewer haben unabhängig gemessen, dass das Zurückschieben von `this.isDestroyed = true` ans Ende von `destroy()` **nur** den BUG-002-Test tötet, nicht auch die beiden BUG-001-Tests. Grund: schon die alte Fassung setzte das Flag vor `Object.freeze(this)`, der Nachgucker in `updateValue()` sieht es also in beiden Reihenfolgen gesetzt. Damit ist auch die Begründung hinfällig, mit der Schritt 9 die Bündelung der drei Fixes rechtfertigt — die Bündelung bleibt sinnvoll (eine Datei, eine Methode, ein Commit), die behauptete technische Kopplung existiert nicht. `pnpm world` enthält seit Paket 5 `test:gc` und seit Paket 6 `test:smoke` und `checkPkgTypes`; die Zeile deckt damit auch ab, dass die geänderte Datei durch Bundle, `exports`-Map und ausgelieferte Deklarationen kommt.
- Commit: `fix(link): stop writing to a destroyed or superseded link frame (BUG-001, BUG-002, BUG-008)`
- Abgleich (2026-08-07): `src/SignalLink.ts` ist seit `8c8f13d` unangetastet (`git log 8c8f13d..HEAD -- src/SignalLink.ts` leer), alle drei Fundstellen stimmen unverändert · BUG-001 unverändert — `updateValue()` steht auf `:396-403`, `emit(this, VALUE, value)` auf `:400` und `this.lastValue = value` auf `:401` nach dem `action(value)` in `:399`; `Object.freeze(this)` auf `:357` · BUG-002 unverändert — `destroy()` auf `:320-363`, `emit(this, DESTROY, this)` auf `:349`, `off(this)` auf `:351`, `this.isDestroyed = true` erst auf `:355` · BUG-008 unverändert — dieselben Zeilen `:396-403` · alle drei am 2026-08-07 gegen frisch kompiliertes `lib/` reproduziert, Ausgaben wörtlich wie in den `evidence`-Feldern (siehe Vorbemerkung) · **Abweichung von der Audit-Empfehlung bei BUG-008**, begründet in Schritt 4: nicht nachlesen, sondern Propagationsgeneration — das Nachlesen erzeugt `[2, 2]` statt `[2]` und meldet im Stumm-Fall einen Wert, den der Link nicht hätte sehen dürfen

**BUG-001 · critical · src/SignalLink.ts:396-403 · src/SignalLink.ts:349-357** — Eingefrorenen Link nicht mehr beschreiben, nachdem der Callback ihn zerstört hat
`updateValue()` prüft `isDestroyed` einmal am Anfang, ruft dann `action(value)` und schreibt danach `emit(this, VALUE, …)` und `this.lastValue = value`. `action()` ist Anwendungscode — der Link-Callback oder der Ziel-Signal-Write samt aller Effects, die er auslöst —, und sich von dort aus zu zerstören ist der Normalfall: »ersten Wert nehmen, dann abmelden«. `destroy()` endet mit `Object.freeze(this)`, die nachlaufende Zuweisung trifft also eine read-only Property und wirft im Strict Mode. Der `TypeError` verlässt das schlichte `signal.set()`, das die Propagation gestartet hat, und bricht den Rest der Zustellung ab. `SignalLink.ts` zeigt 100 % Statement- und Branch-Coverage genau deshalb, weil dieser Pfad nie betreten wird.
Empfehlung: Nach `action(value)` erneut `this.isDestroyed` prüfen und `emit` plus Zuweisung überspringen — oder `Object.freeze(this)` aus `destroy()` streichen, es schützt nichts, was die `isDestroyed`-Guards nicht schon abdecken.

**BUG-002 · high · src/SignalLink.ts:320-363** — SignalLink.isDestroyed vor dem DESTROY-Emit setzen, nicht danach
`destroy()` beginnt mit `if (this.isDestroyed) return;`, setzt das Flag aber erst auf der vorletzten Zeile — nach `emit(this, DESTROY, this)` und `off(this)`. Ein mit `on()` statt `once()` registrierter DESTROY-Listener, der erneut `destroy()` ruft, betritt damit einen ungeschützten Teardown und rekursiert bis zum Stack-Überlauf. `EffectImpl.destroy()` macht es richtig und begründet es ausdrücklich (»Flag first, unsubscribe second«), `SignalGroup.clear()` hat sein `BUSY_CLEAR`-Bit. `SignalLink` hat keines von beidem.
Empfehlung: `this.isDestroyed = true` an den Anfang von `destroy()` ziehen, direkt hinter den Guard — analog zu `EffectImpl.destroy()`.

**BUG-008 · medium · src/SignalLink.ts:396-403** — lastValue und die VALUE-Reihenfolge unter re-entranter Propagation korrigieren
`updateValue()` liest `this.source.value` vorab, ruft `action(value)` und emittiert erst danach `VALUE` und speichert `lastValue`. Löst `action()` eine Rückkopplung aus, die die Quelle erneut schreibt, läuft das verschachtelte `updateValue()` mit dem neueren Wert zuerst zu Ende — und der äußere Rahmen legt anschließend den älteren obendrauf. Der Link meldet einen Wert, den es auf keinem der beiden Signale mehr gibt; `nextValue()`- und `asyncValues()`-Konsumenten sehen eine Wertregression, die nie stattgefunden hat.
Empfehlung: `this.source.value` nach `action()` erneut lesen, bevor emittiert und zugewiesen wird — oder den Schreibvorgang mit einer Propagationsgeneration pro Link absichern.

#### [x] 9. EffectImpl.run(): Dependencies und Cleanups über den Lauf retten
- Findings: BUG-005 (high), BUG-006 (medium), BUG-007 (medium)
- Ziel: Ein Quiet-Frame löscht keine Dependencies mehr, ein werfender Rerun lässt keine tote Subscription stehen, und ein verschachtelter Lauf verwirft seinen Cleanup nicht.
- Bereich: `src/EffectImpl.ts`, zugehörige Specs
- Hängt ab von: —
- Modell: stärkste Stufe
- Hash: `cfdfc26`
- Ergebnis (2026-08-07): BUG-005, BUG-006 und BUG-007 behoben. **Zwei Review-Runden, und die erste war die wertvollste des Laufs.** BUG-005 ist über Weg 2 gefixt (`#lostSignals` unangetastet lassen, wenn der Lauf unter einem Quiet-Frame steht) — keine Breaking Change. BUG-007 wurde über das Audit hinaus um den Verdrängungspfad erweitert: ein *Cleanup*, der `run()` re-entriert, verlor seinen inneren Cleanup auch mit korrektem Generationenvergleich.
  **Der kritische Befund aus Runde 0:** Der `finally` aus BUG-006 committete auch eine Dependency-Menge, die der Lauf nie fertig aufgebaut hatte. Wirft der Callback **vor** seinem ersten getrackten Read, galt »noch nicht gelesen« als »nicht mehr gelesen« — der Effect verlor alle Abhängigkeiten und blieb als tote Hülle in `getEffectsCount()` stehen (`subs 2→0`, null Läufe nach Erholung, `run()` ein No-op). Gegen `HEAD` eine Regression, und exakt der Endzustand, den BUG-005 im selben Paket beseitigt. Weder Audit noch Plan hatten den Fall betrachtet; alle vier ursprünglichen Tests warfen erst *nach* ihren Reads. Behoben über einen monotonen Zähler `#trackedReads` plus lokale Vergleichsbasis: abgeräumt wird nur, wenn der Lauf normal zurückkam **oder** mindestens einen Read registriert hat.
  Der Reviewer hat drei Kanten einzeln nachgemessen — Wurf vor dem ersten Read (hält), Wurf nach Reads (räumt ab, BUG-006 intakt), erfolgreicher Lauf mit Schrumpf auf null Reads (räumt ab, pitfall 8 intakt) — dazu Verschachtelung mit fremdem und mit demselben Effect, und die Cleanup-Generationen über vier Szenarien ohne Doppellauf und ohne Verlust. Runde 2 schloss zwei Testlücken: die `completed`-Bedingung war tragend, aber von keinem Test abgesichert (der Mutant blieb bei 417/417 grün), und die Reihenfolge in `acceptCleanupCallback()` fiel erst bei drei Bounces auf.
  Verify selbst gelaufen: `pnpm world` Exit 0, 41 Dateien / **427 Tests** (Baseline 421). `EffectImpl.ts` steigt in allen vier Metriken auf 98,03 / 95,91 / 96,66 / 98,97, ungedeckt bleibt nur der vorbestehende `.catch()`-Pfeil in `runOrphanedCleanupCallback()`. `src/ordering.property.spec.ts` grün und nachweislich betroffen — die umgeschriebene Stelle in `run()` wird von ihr 21 665-mal getroffen.
- Weitere beobachtbare Folgen (im CHANGELOG festgehalten): der synchrone Wurf eines überholten Cleanups geht jetzt an `onEffectError()` mit `phase: 'cleanup'` statt an den Aufrufer — auf `HEAD` killte derselbe Fall den Prozess aus `destroy()` heraus; und ein Cleanup, der ein Signal schreibt, löst jetzt zusätzliche Effect-Läufe aus.
- Nebenbefunde:
  - **Für die Pakete 10 und 11:** die Zeilentabelle im Querbezug stimmt nicht mehr (Datei wächst auf 906 statt 859 Zeilen, `destroy()` auf 864 statt 817). Der dort selbst empfohlene Abgleich über **Symbolnamen** bleibt richtig, der über Zeilennummern wird falsch. Außerdem gilt »neue Felder gibt es keine« nicht mehr: `#trackedReads` ist hinzugekommen, und `run()` trägt zwei lokale Bindungen (`readsBefore`, `completed`), an denen das Abräumen im `finally` hängt. Wer dort einen Schritt ergänzt, entscheidet zu dritt: gehört er in den `try`, darf er im Quiet-Frame stattfinden, und überlebt er einen Callback, der vor dem ersten Read stirbt.
  - `-t` filtert nicht, wenn der Testname Klammern enthält — Vitest liest das Muster als Regex, `(BUG-005)` wird zur Gruppe und trifft nichts. Der Lauf meldet dann `skipped` statt eines Fehlschlags.
  - `CHANGELOG.md` führt unter `### Bug Fixes` ältere Einträge mit `(BUG-005)`, `(BUG-003)` und `(BUG-007)` aus einer früheren Audit-Runde mit anderer ID-Belegung. Dieselbe ID steht dort an zwei unverwandten Fehlern. Bewusst nicht angefasst — für den Abschluss vorgemerkt.
  - `src/EffectImpl.ts:859-860` bleibt ungedeckt (der `.catch()`-Pfeil in `runOrphanedCleanupCallback()`). Vorbestehend, kein Finding dieses Laufs.
- Breaking Changes: **keine.** Alle drei Fixes sind Reparaturen an Zuständen, die keine Doku und keine JSDoc jemals zugesagt hat. Was ein Aufrufer neu sieht: ein Cleanup, das bisher nie lief, läuft jetzt (BUG-007) — das ist die Erfüllung der Zusage »**A stale cleanup is executed, not discarded**« aus `src/EffectImpl.ts:675`, die der synchrone Zweig bisher ausdrücklich ausgenommen hat. `src/signal-core.ts` wird **nicht** angefasst; die Fundstelle `:33-37` aus BUG-005 ist nur der Ort, an dem die Ursache sichtbar wird, nicht der, an dem sie zu beheben ist (Schritt 5).
- Dateien: `src/EffectImpl.ts`, neu `src/EffectImpl.run.spec.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Alle drei Fehler wurden am 2026-08-07 gegen frisch kompiliertes `lib/` (Stand `d44427d`) reproduziert. BUG-006 und BUG-007 decken sich wörtlich mit den `evidence`-Feldern des Audits; BUG-005 hat im Audit **kein** `evidence`-Feld, die Reproduktion ist neu und liegt unter `…/scratchpad/bug005.mjs` (dazu `bug006.mjs`, `bug007.mjs`):

  ```
  BUG-005  subs after tracked run : 2 (a, b)
           subs after quiet run   : 0        <- erwartet 2
           runs after eff.run()   : 2        <- unverändert, der Effect ist taub
           effects alive          : 1
  BUG-006  subs nach erstem Lauf (cond,x): 2
           rerun threw: boom
           subs nach werfendem Rerun     : 3 -> erwartet 2 (cond,y), tatsächlich 3 (cond,x,y)
           x wird nicht gelesen, triggert den Effect aber weiterhin: ja (runs +1)
  BUG-007  belegt und nicht freigegeben nach dem Settle: [ 'res@0','res@1','res@2','res@3' ]
           nach destroy(): [ 'res@1','res@2','res@3' ]   <- nur der älteste Cleanup lief
  ```

  **Die Erreichbarkeit von BUG-005 ist enger, als das Finding klingt** — und das ist die einzige Stelle, an der die Reproduktion Arbeit gekostet hat. `run()` steigt in Zeile 411 mit `if (!this.shouldRun) return;` aus. `shouldRun` wird ausschließlich in `[RECALL]()` (`:512`) auf `true` gesetzt, und `writeSignal()` ist selbst quiet-gated — ein Write **innerhalb** des Quiet-Frames erzeugt also gar kein RECALL. Ein stummer Lauf erreicht den Tracking-Code deshalb nur, wenn `shouldRun` von **außerhalb** des Frames gesetzt wurde. Der Weg dahin ist das dokumentierte `{autorun: false}`-Muster (`src/effects.noAutorun.spec.ts`): ein Write kippt `shouldRun`, der Besitzer entscheidet, wann gelaufen wird — und wickelt diesen Lauf in `beQuiet()`, damit die Writes des Callbacks still bleiben. Genau das steht in der Reproduktion. Ein `{autorun: true}`-Effect ist auf diesem Weg **nicht** erreichbar; im Detailplan der Tests ist das der Grund, warum der BUG-005-Test `{autorun: false}` benutzt und nicht nachlässig konstruiert ist.

  **Ein benachbarter Fall, der ausdrücklich nicht dazugehört.** Ein Effect, der **innerhalb** eines Quiet-Frames geboren wird (`beQuiet(() => createEffect(cb))`), abonniert nichts und läuft nie wieder — gemessen in `bug005.mjs`, Block C: `subs: 0`, `triggers after a.set: 0`. Das ist aber kein Verlust, sondern die wörtliche Einlösung der dokumentierten Quiet-Semantik (»reads inside `callback` do not subscribe«). BUG-005 handelt vom *Verlieren* bereits aufgebauter Dependencies, und nur das wird hier repariert. Der Geburtsfall bekommt einen Doku-Satz (Schritt 17), keinen Code.

  **A — die Zielfassung von `run()`, als Ganzes**

  Die drei Fixes greifen in denselben Ablauf: `#lostSignals` aufbauen → Callback rufen → `cleanupLostSignals()` → Cleanup-Slot schreiben. Sie werden **nicht** nacheinander gepatcht. Reihenfolge im Code: Import (Schritt 1), der dynamische Zweig von `run()` (Schritt 2), die Cleanup-Annahme (Schritt 3). Die Wächter im dynamischen Zweig stehen in dieser Reihenfolge, und die Reihenfolge ist die Aussage:

  1. **`isQuiet()` zuerst, vor dem Aufbau von `#lostSignals`** (BUG-005). Der Schnappschuss und das spätere Abräumen sind ein Paar: wer nicht aufgezeichnet hat, was der Lauf verlieren könnte, darf hinterher auch nichts wegwerfen. Ein einzelner `const` bindet beide Seiten aneinander, statt `isQuiet()` zweimal zu fragen — der Callback kann den Quiet-Zustand zwischendurch ändern (`hibernate()` im Rumpf), und ein Lauf, der ohne Schnappschuss begann, darf dadurch nicht nachträglich abräumen dürfen.
  2. **`try` um den Callback, `finally` für das Abräumen** (BUG-006). Steht innen, weil es nur greift, wenn Schritt 1 überhaupt aufgezeichnet hat.
  3. **Der Generationenvergleich in der Cleanup-Annahme** (BUG-007). Steht außerhalb von `run()`, in `storeCleanupCallback()` bzw. der neuen `acceptCleanupCallback()`, weil er den asynchronen und den synchronen Zweig gleich behandeln soll und im synchronen Zweig ohnehin erst nach der Rückkehr des Callbacks etwas zu entscheiden gibt.

  Der `hasStaticDeps()`-Zweig (`:446`) bleibt **unverändert**. Er fasst `#lostSignals` nicht an, also gibt es dort nichts zu retten; und `saveSignalsFromDeps()` → `whenSignalIsRead()` ist nicht quiet-gated (nur `readSignal()` in `signal-core.ts:34` ist es), ein Static-Deps-Effect abonniert also auch im Quiet-Frame korrekt. Relevant für Paket 11, das genau diese Methode wieder anfassen wird.

  1. `src/EffectImpl.ts` — eine Import-Zeile hinter `import {getCurrentBatch} from './batch.js';` (Zeile 10):
     ```ts
     import {isQuiet} from './bequiet.js';
     ```
     Kein Zyklusrisiko: `src/bequiet.ts` hat **keine einzige** Import-Zeile, es ist ein Blatt unterhalb von `signal-core.ts` (das es seinerseits schon importiert). Die Kante `EffectImpl → bequiet` läuft damit in dieselbe Richtung wie die vorhandene `signal-core → bequiet`. `pnpm bundle` (Teil von `pnpm world`) ist der Prüfer, weil `rollup.config.mjs` bei `CIRCULAR_DEPENDENCY` wirft.

  2. `src/EffectImpl.ts:445-458` — der `else`-Zweig in `run()` wird vollständig ersetzt. Aus
     ```ts
     if (this.hasStaticDeps()) {
       this.storeCleanupCallback(this.runWithoutAutoTracking(), generation);
     } else {
       this.#lostSignals.clear();
       for (const id of this.#signals) {
         this.#lostSignals.add(id);
       }
       this.storeCleanupCallback(
         runWithinEffect(this, this.callback),
         generation,
       );
       this.cleanupLostSignals();
       this.#destroyedSignals.clear();
     }
     ```
     wird
     ```ts
     if (this.hasStaticDeps()) {
       this.storeCleanupCallback(this.runWithoutAutoTracking(), generation);
     } else {
       // BUG-005: `readSignal()` reports a read only while no quiet frame is
       // open (`src/signal-core.ts:34`), so a run inside `beQuiet()` re-reads
       // nothing this instance can hear. Filling `#lostSignals` anyway and
       // pruning afterwards would therefore unsubscribe *every* dependency
       // the effect had — permanently: nothing wakes it again, `run()` finds
       // `shouldRun === false`, and it sits in `getEffectsCount()` as a deaf
       // shell. Snapshot and prune are a matched pair; a run that could not
       // record what it might lose must not throw anything away either. Read
       // once, before control leaves this frame: the callback may open or
       // close quiet frames of its own (`hibernate()`), and the decision has
       // to be the one this run started under.
       const isTracking = !isQuiet();

       if (isTracking) {
         this.#lostSignals.clear();
         for (const id of this.#signals) {
           this.#lostSignals.add(id);
         }
       }

       try {
         this.storeCleanupCallback(
           runWithinEffect(this, this.callback),
           generation,
         );
       } finally {
         // BUG-006: the callback is application code and may throw. Without
         // this `finally` the prune was skipped while `shouldRun` was already
         // `false` and the cleanup already consumed — the effect kept a live
         // RECALL subscription on a signal it no longer reads, every write to
         // which re-triggered it into (typically) the same throw. It also
         // left `hasNoLiveSignals()` — and therefore the deferred
         // self-destruction below — reading a dependency set that no run
         // built. It healed on the next successful run, which a
         // deterministically failing callback never has.
         if (isTracking) {
           this.cleanupLostSignals();
           this.#destroyedSignals.clear();
         }
       }
     }
     ```
     `storeCleanupCallback()` steht **innerhalb** des `try`, nicht davor: auf dem Erfolgspfad bleibt die Reihenfolge damit exakt die heutige (erst Slot, dann Abräumen), und auf dem Wurfpfad wird es gar nicht erreicht — ein Callback, der wirft, hat keinen Cleanup zurückgegeben. `cleanupLostSignals()` ruft über `unsubscribeSignal()` nur eventize-Abmelder, keinen Anwendungscode; das Risiko, dass der `finally` den ursprünglichen Fehler überdeckt, ist damit auf einen Bibliotheksfehler beschränkt und wird nicht zusätzlich abgeschirmt.

  3. `src/EffectImpl.ts:710-737` — `storeCleanupCallback()` schrumpft auf die Weiche »synchron oder thenable«, beide Zweige rufen dieselbe neue Methode (BUG-007):
     ```ts
     private storeCleanupCallback(result: unknown, generation: number): void {
       if (!isThenable(result)) {
         // Same tolerance as the async branch below: a callback returning
         // something that is not a function has simply returned no cleanup.
         if (typeof result === 'function') {
           this.acceptCleanupCallback(result as VoidFunc, generation);
         }
         return;
       }

       Promise.resolve(result).then(
         (cleanup) => {
           if (typeof cleanup !== 'function') return;
           this.acceptCleanupCallback(cleanup as VoidFunc, generation);
         },
         (error) => {
           emitEffectError(this, error, 'callback');
         },
       );
     }
     ```
     und direkt dahinter, vor `runCleanupCallback()`, die neue Methode:
     ```ts
     /**
      * Take a cleanup the effect callback produced and decide where it goes:
      * into the single `#nextCleanupCallback` slot, or straight to
      * {@link runOrphanedCleanupCallback} because nobody will ever call it
      * from that slot.
      *
      * Two ways to be too late, and both used to end in a silently dropped
      * cleanup on the synchronous path (BUG-007):
      *
      * - **Superseded.** An effect that writes a signal it depends on
      *   re-enters `run()`; the `#runDepth` guard exists precisely because
      *   that is a legitimate, bounded fixpoint pattern here. Every nested
      *   run acquires its own resources and returns its own cleanup, but the
      *   *outermost* run returns last — so the oldest cleanup used to win the
      *   slot and every inner one was thrown away unrun. `destroy()` then
      *   released the resources of a long-superseded state and leaked the
      *   current one. The generation comparison the async branch already made
      *   answers this for both branches: a run whose number is no longer the
      *   current one hands its cleanup over instead of overwriting a newer.
      *
      * - **Displaced.** The slot is normally empty here, because `run()`
      *   consumes it through `runCleanupCallback()` before the callback is
      *   invoked. It is not empty when a *cleanup* re-entered `run()`: that
      *   nested run stored its cleanup after the outer one had already
      *   emptied the slot, and the outer run — the current generation, so the
      *   check above lets it through — then overwrote it. Running the
      *   displaced one is the same rule as above, applied to the other end of
      *   the collision.
      *
      * Both cases run the cleanup at the earliest moment it is known to be
      * stale, which is the best available: nobody else holds that run's
      * resource, so this is not a double release, and it is the only thing
      * that will ever release it.
      */
     private acceptCleanupCallback(cleanup: VoidFunc, generation: number): void {
       if (this.#destroyed || generation !== this.#generation) {
         this.runOrphanedCleanupCallback(cleanup);
         return;
       }

       const displaced = this.#nextCleanupCallback;
       this.#nextCleanupCallback = cleanup;
       if (displaced != null) {
         this.runOrphanedCleanupCallback(displaced);
       }
     }
     ```
     Der Slot wird **vor** dem Lauf des verdrängten Cleanups gesetzt. Ein verdrängter Cleanup darf Signale schreiben (die JSDoc von `runOrphanedCleanupCallback()` sagt das ausdrücklich zu) und damit `run()` erneut betreten; findet dieser Lauf den Slot noch alt vor, läuft derselbe Cleanup ein zweites Mal. Zuerst zuweisen, dann laufen lassen, schließt das aus.

  4. **Der JSDoc-Absatz, der weg muss.** `src/EffectImpl.ts:699-708` beginnt mit »**The synchronous branch still ignores `generation`.**« und verteidigt das als bewusste Semantik-Entscheidung (»That is how this library has always behaved … Changing it would change synchronous semantics for every self-writing effect — a decision of its own, and not the resource leak this method was fixed for«). Genau diese Entscheidung wird hier getroffen und der Absatz **ersatzlos gestrichen**; seine Aussage steht jetzt umgekehrt in der JSDoc von `acceptCleanupCallback()`. Der Rest der JSDoc von `storeCleanupCallback()` (Zeilen 664-698) bleibt Wort für Wort stehen — insbesondere der Absatz »**A stale cleanup is executed, not discarded.**«, der ab jetzt ohne Ausnahme gilt.

  **B — der gewählte Weg bei BUG-005, und warum nicht die beiden anderen**

  5. Das Audit nennt drei Wege. Umgesetzt wird **»`#lostSignals` unangetastet lassen«** (Schritt 2). Begründung, gegen den Code geprüft:

     | Weg | was er tut | warum nicht |
     | --- | --- | --- |
     | Lauf verweigern (`if (isQuiet()) return;`) | Der Callback läuft nicht. | **Beobachtbare Verhaltensänderung, und eine stille.** Wer `beQuiet(() => eff.run())` schreibt, will die Seiteneffekte des Callbacks — er will nur nicht, dass dessen Writes weiterpropagieren. Ein stiller No-op nimmt ihm genau das, wofür er den Aufruf geschrieben hat, und gibt ihm keinen Hinweis darauf. Das ist ein zweiter Fehler an der Stelle des ersten. |
     | `beQuiet()` um einen Effect-Run als Fehler behandeln | `run()` wirft im Quiet-Frame. | **Breaking Change am öffentlichen Verhalten** — und laut den Grenzen dieses Pakets eine Rückfrage, kein Alleingang. Zusätzlich trifft ein solcher Wurf nicht nur den absichtlichen Aufruf: `run()` wird auch indirekt betreten (RECALL aus einem Write, ein Cleanup, ein Batch-Flush), und ein Quiet-Frame, der irgendwo darüber liegt, würde dann aus einem völlig unbeteiligten `set()` heraus werfen. |
     | **`#lostSignals` unangetastet lassen** | Der Callback läuft, die Reads bleiben ungetrackt, die Dependency-Menge bleibt, wie sie war. | **Gewählt.** Nichts wirft, nichts entfällt, die Signatur bleibt. |

  6. **Verschiebt der gewählte Weg den Fehler nur?** Die Frage ist berechtigt und lautet ausgeschrieben: der stumme Lauf kann einen anderen Zweig genommen haben als der letzte getrackte, die erhaltene Dependency-Menge ist dann nicht die, die zum aktuellen Callback-Zustand passt. Beide Richtungen wurden durchgespielt:
     - **Überabonniert** (der stumme Lauf liest ein Signal nicht mehr): ein Write darauf weckt den Effect einmal überflüssig. Dieser Lauf ist getrackt, baut die Menge korrekt neu auf und die Abweichung ist weg. Selbstheilend, Kosten: ein Lauf.
     - **Unterabonniert** (der stumme Lauf liest ein Signal neu): der Effect verpasst Writes darauf, bis ein getrackter Lauf ihn kennenlernt. Kosten: dieselben wie bei jedem anderen ungetrackten Read, den `beQuiet()` per Definition erzeugt.

     Beides ist eine vorübergehende Ungenauigkeit, die der nächste getrackte Lauf ausräumt. Der heutige Zustand ist keine Ungenauigkeit, sondern ein Endzustand: die Menge wird **leer**, `hasNoLiveSignals()` ist `true`, und es gibt keinen Weg zurück — kein Write erreicht den Effect mehr, `run()` steigt bei `shouldRun === false` aus, und `destroyWhenUntriggerable()` wird aus `run()` nie gerufen, der Effect stirbt also nicht einmal. Aus »endgültig taub« wird »eine Runde ungenau«. Das ist eine Behebung, keine Verschiebung.

     Bestätigt hat das auch die Gegenprobe mit `hibernate()` (`bug005.mjs`, Block B): derselbe Lauf, in `hibernate()` gewickelt, behält heute schon beide Subscriptions (`subs after quiet run: 2`) und läuft danach normal weiter. `hibernate()` **ist** der heutige Workaround — und dass es einen gibt, der genau die Wirkung des Fixes hat, ist das stärkste Argument dafür, dass der Fix keine neue Semantik erfindet.

  7. **Was ausdrücklich nicht mit repariert wird:** dass die Reads des stummen Laufs ungetrackt bleiben. Das ist die Definition von `beQuiet()` und steht so in `docs/api.md:398-399`. Es wäre nur über eine Ausnahme in `readSignal()` zu ändern, und die würde `beQuiet()` als Ganzes aushöhlen.

  **C — die Regressionstests, rot zuerst**

  8. Alle vier Tests kommen in **eine neue Datei** `src/EffectImpl.run.spec.ts`, benannt nach dem Vorbild `src/EffectImpl.destroy.spec.ts`, mit dessen Bilanz-`beforeEach`/`afterEach`-Muster. Ein `describe('EffectImpl.run() lifecycle')`, vier `it()`. Die Datei in dieser Fassung wurde am 2026-08-07 in einer Arbeitskopie gegen beide Stände gemessen — rot gegen `d44427d`, grün gegen die Zielfassung:
     ```ts
     import {getSubscriptionCount} from '@spearwolf/eventize';
     import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
     import {beQuiet} from './bequiet.js';
     import {createSignal} from './createSignal.js';
     import {createEffect} from './effects.js';
     import {globalSignalQueue} from './global-queues.js';
     import {destroySignal} from './signal-core.js';

     describe('EffectImpl.run() lifecycle', () => {
       beforeEach(() => {
         assertEffectsCount(0, 'beforeEach');
         assertSignalsCount(0, 'beforeEach');
       });

       afterEach(() => {
         assertEffectsCount(0, 'afterEach');
         assertSignalsCount(0, 'afterEach');
       });

       it('a quiet run keeps the dependencies it is not allowed to re-register (BUG-005)', () => {
         const signalSubscriptions = getSubscriptionCount(globalSignalQueue);

         const {get: a, set: setA} = createSignal(0);
         const {get: b, set: setB} = createSignal(100);

         const seen: number[][] = [];
         const effect = createEffect(
           () => {
             seen.push([a(), b()]);
           },
           {autorun: false},
         );

         effect.run();
         expect(
           getSubscriptionCount(globalSignalQueue),
           'the tracked run subscribed to a and b',
         ).toBe(signalSubscriptions + 2);

         setA(1); // flips shouldRun; autorun: false, so nothing runs yet

         beQuiet(() => {
           effect.run();
         });

         expect(seen, 'the quiet run did execute the callback').toEqual([
           [0, 100],
           [1, 100],
         ]);
         expect(
           getSubscriptionCount(globalSignalQueue),
           'the quiet run left the dependency set alone',
         ).toBe(signalSubscriptions + 2);

         setB(200);
         effect.run();

         expect(seen, 'the effect is still reachable through both signals').toEqual([
           [0, 100],
           [1, 100],
           [1, 200],
         ]);

         effect.destroy();
         destroySignal(a, b);
       });

       it('a throwing callback still releases the dependency it stopped reading (BUG-006)', () => {
         const signalSubscriptions = getSubscriptionCount(globalSignalQueue);

         const {get: cond, set: setCond} = createSignal(true);
         const {get: x, set: setX} = createSignal(1);
         const {get: y} = createSignal(2);

         let boom = false;
         const seen: string[] = [];

         const effect = createEffect(() => {
           seen.push(cond() ? `x=${x()}` : `y=${y()}`);
           if (boom) throw new Error('boom');
         });

         expect(getSubscriptionCount(globalSignalQueue), 'cond and x').toBe(
           signalSubscriptions + 2,
         );

         boom = true;
         expect(() => {
           setCond(false);
         }).toThrow('boom');

         expect(
           getSubscriptionCount(globalSignalQueue),
           'x is gone and y took its place, even though the callback threw',
         ).toBe(signalSubscriptions + 2);

         boom = false;
         const runsBefore = seen.length;
         setX(99);

         expect(
           seen.length - runsBefore,
           'a write to the signal it no longer reads does not wake it',
         ).toBe(0);

         effect.destroy();
         destroySignal(cond, x, y);
       });

       it('every nested run of a self-writing effect releases its own resource (BUG-007)', () => {
         const held = new Set<string>();
         const {get: n, set: setN} = createSignal(0);

         const effect = createEffect(() => {
           const v = n();
           const res = `res@${v}`;
           held.add(res);
           if (v < 3) setN(v + 1);
           return () => {
             held.delete(res);
           };
         });

         expect(
           [...held],
           'the superseded runs handed their cleanups over instead of losing them',
         ).toEqual(['res@3']);

         effect.destroy();

         expect([...held], 'destroy() released the last one').toEqual([]);
         destroySignal(n);
       });

       it('a cleanup that re-enters run() does not drop the nested cleanup (BUG-007)', () => {
         const held = new Set<string>();
         const {get: n, set: setN} = createSignal(0);

         let bounce = true;
         let acquired = 0;

         const effect = createEffect(() => {
           n();
           const res = `handle#${acquired++}`;
           held.add(res);
           return () => {
             held.delete(res);
             if (bounce) {
               bounce = false;
               setN(99);
             }
           };
         });

         setN(1);

         expect(
           [...held],
           'the displaced cleanup ran instead of being overwritten',
         ).toEqual(['handle#2']);

         effect.destroy();

         expect([...held]).toEqual([]);
         destroySignal(n);
       });
     });
     ```

  9. Zuordnung Test → Finding → die Aussage über den **Zustand** des Effects, die erst nach dem Fix etwas bedeutet. Keiner der vier prüft »wirft nicht mehr«:

     | Test | Finding | die tragende Assertion |
     | --- | --- | --- |
     | `a quiet run keeps the dependencies …` | BUG-005 | `expect(seen, 'the effect is still reachable through both signals')` — der Effect läuft nach dem stummen Lauf noch, und zwar mit den Werten beider Signale. Die Subscription-Bilanz davor (`signalSubscriptions + 2`) sagt, *warum*; diese Zeile sagt, dass es sich beobachtbar auswirkt. Dazu `expect(seen, 'the quiet run did execute the callback')` — der Beleg, dass der gewählte Weg den Lauf nicht verweigert. |
     | `a throwing callback still releases …` | BUG-006 | `expect(seen.length - runsBefore, …).toBe(0)` — ein Write auf `x` weckt den Effect nicht mehr. Die Subscription-Bilanz allein wäre die halbe Aussage; das hier ist die Folge, um die es dem Finding geht. |
     | `every nested run of a self-writing effect …` | BUG-007 (Callback-Pfad, die Audit-Evidenz) | `expect([...held], …).toEqual(['res@3'])` — nach dem Settle hält nur noch der aktuelle Lauf eine Ressource, die drei überholten haben ihre freigegeben. Dazu `toEqual([])` nach `destroy()`. |
     | `a cleanup that re-enters run() …` | BUG-007 (Verdrängungspfad, Schritt 11) | `expect([...held], …).toEqual(['handle#2'])` — `handle#1` wurde freigegeben, statt seinen Cleanup an den Slot zu verlieren. |

  10. **Der rote Lauf gehört in den Report.** Gemessen am 2026-08-07 gegen den unveränderten `src/`-Stand, jeder Test einzeln über `pnpm exec vitest run --project unit src/EffectImpl.run.spec.ts -t "<name>"`:
      - `BUG-005` → `AssertionError: the quiet run left the dependency set alone: expected +0 to be 2`
      - `BUG-006` → `AssertionError: x is gone and y took its place, even though the callback threw: expected 3 to be 2`
      - `self-writing effect releases` → `AssertionError: the superseded runs handed their cleanups over instead of losing them: expected [ 'res@0', 'res@1', 'res@2', 'res@3' ] to deeply equal [ 'res@3' ]`
      - `re-enters run` → `AssertionError: the displaced cleanup ran instead of being overwritten: expected [ 'handle#1', 'handle#2' ] to deeply equal [ 'handle#2' ]`

      Jeder rote Lauf schleppt zusätzlich ein `afterEach: Number of active effects should be 0 but is 1` hinterher — der Wurf springt über die Aufräumzeilen des Tests. Dasselbe Folgephänomen wie in Paket 8, kein zweiter Befund; nach dem Fix laufen alle vier gemeinsam grün. Einzeln laufen lassen ist deshalb auch hier nötig, nicht Stil.

  11. **Abweichung von der Audit-Empfehlung bei BUG-007, mit eigener Messung.** Das Audit empfiehlt nur den Generationenvergleich. Der behebt den Callback-Pfad vollständig, lässt aber einen zweiten, engeren Weg offen, auf dem derselbe Effect denselben Cleanup verliert: ein **Cleanup**, der ein Signal schreibt, von dem der Effect abhängt, betritt `run()` aus `runCleanupCallback()` heraus — also *vor* dem Generation-Bump des äußeren Laufs (`src/EffectImpl.ts:436-443` erklärt, warum der Bump dort steht). Der verschachtelte Lauf trägt dann die *niedrigere* Generation, der äußere ist die aktuelle, der Vergleich lässt ihn durch, und seine Zuweisung überschreibt den Cleanup des inneren Laufs. Gemessen (`bug007.mjs`, Block B), heutiger Stand:
      ```
      belegt nach dem Settle: [ 'handle#1', 'handle#2' ]
      nach destroy()        : [ 'handle#1' ]   <- der verdrängte Cleanup lief nie
      ```
      Mit der Zielfassung ist `held` nach dem Settle `[ 'handle#2' ]` und nach `destroy()` leer. Der Titel des Findings lautet »Die inneren Cleanups eines selbstschreibenden Effects nicht mehr verwerfen« — der Verdrängungspfad ist genau das, nur über den Cleanup statt über den Callback, und er kostet drei Zeilen im selben Methodenrumpf. Deshalb mitgenommen, mit eigenem Test (Schritt 8, vierter `it`). Stellt sich bei der Umsetzung heraus, dass die Zuweisung-vor-Lauf-Reihenfolge aus Schritt 3 dafür nicht reicht, wird das **berichtet**, nicht stillschweigend zurückgebaut.

  12. **Zwei Gegenproben nach dem Fix**, jeweils am Arbeitsbaum durchspielen und zurücknehmen:
      - Den Generationenvergleich in `acceptCleanupCallback()` auf `this.#destroyed` allein zurücknehmen. Der dritte Test muss mit `expected [ 'res@0', 'res@1', 'res@2', 'res@3' ] to deeply equal [ 'res@3' ]` fallen, der vierte grün bleiben. Belegt, dass die beiden BUG-007-Tests zwei verschiedene Pfade treffen und keiner den anderen mitdeckt.
      - Den `finally` in `run()` auflösen (Abräumen wieder hinter den Callback ziehen, ohne `try`). Nur der BUG-006-Test darf fallen. Fällt auch der BUG-005-Test, hängen die beiden Wächter aneinander, und der Plan hat die Reihenfolge aus Abschnitt A falsch begründet — dann gehört das in den Report.

  13. **Die Property-Suite aus Paket 7 muss grün bleiben.** `src/ordering.property.spec.ts` (fünf `it`, fester Seed) benutzt keine werfenden Callbacks, keine Static Deps, keine `SignalGroup` und keinen Quiet-Frame — durch keinen der drei Fixes erwartbar rot. Isoliert gegen die Zielfassung gemessen: **5 passed**. Wird sie beim Implementierer trotzdem rot, ist das ein Regressionsbefund an der Reihenfolge-Zusage und gehört gemeldet, nicht nachgezogen. Für den vollen Lauf gemessen: **41 Dateien / 425 Tests** grün (Baseline 40/421), `vitest run --config vitest.gc.config.ts` ebenfalls grün.

  14. **Coverage.** `src/EffectImpl.ts` liegt allein unter der globalen Stufe 1 (Statements 97, Zweige 85, Funktionen 96, Zeilen 98). Gemessen in der Arbeitskopie:

      | Stand | Stmts | Branch | Funcs | Lines | ungedeckt |
      | --- | --- | --- | --- | --- | --- |
      | `d44427d` (Baseline) | 97,92 | 95,60 | 96,55 | 98,91 | `771-772` |
      | Zielfassung **ohne** die neuen Tests | 97,48 | 92,63 | 96,66 | 98,42 | `751, 787-788` |
      | Zielfassung **mit** den vier Tests | **97,98** | **95,78** | **96,66** | **98,95** | `787-788` |

      Jede Metrik steigt gegenüber der Baseline; keine Schwelle wird angefasst, kein Spielraum verbraucht. Die einzige verbleibende ungedeckte Stelle ist der `.catch()`-Pfeil in `runOrphanedCleanupCallback()` — vorbestehend, heute `771-772`, danach `787-788`, kein Finding dieses Laufs. Die **Funktionsschwelle** aus dem Querbezug von Paket 5 ist eingehalten: `acceptCleanupCallback()` ist die einzige neue Funktion und wird von jedem Lauf jedes Effects gerufen, die Quote steigt sogar (96,55 → 96,66). Gesamtprojekt: 99,03 / 94,14 / 99,51 / 99,59 gegen 99,01 / 94,03 / 99,51 / 99,59 nach Paket 7.

  **D — die Dokumentation, in der Reihenfolge aus `CLAUDE.md`**

  15. **Quell-JSDoc.** Die Kommentarblöcke aus Schritt 2 und 3 sind die Begründung im Code, dazu die Streichung aus Schritt 4. Sonst nichts — es kommt kein öffentliches Feld und keine öffentliche Methode hinzu.

  16. **`docs/api.md`.** Drei Stellen:
      - Zeilen 78-86, der `**callback**`-Absatz von `createEffect`. Hinter dem Satz über den asynchronen Fall (endet mit dem Link auf `recipes.md`) ein Satz zum synchronen Gegenstück: dass ein Lauf, den eine re-entrante Selbstschreibung überholt hat, seinen Cleanup ebenfalls sofort ausführt statt ihn in den Slot zu legen — ein Effect, der ein Signal schreibt, von dem er abhängt, bekommt für **jeden** verschachtelten Lauf den zugehörigen Cleanup, nicht nur für den ältesten.
      - Zeilen 182-190, der Absatz »Failures land here …«. Die Aufzählung der stale-Fälle in Zeile 187 (»one whose run was superseded or whose effect is already destroyed«) deckt den neuen Fall wörtlich schon ab; sie bekommt eine Klammer, die ihn benennt — dass »superseded« ab jetzt auch synchron gemeint ist, nämlich durch eine re-entrante Selbstschreibung. Die Tabellenzeile `phase` in Zeile 180 bleibt unverändert.
      - Zeilen 396-399, der Abschnitt `### beQuiet(callback)`. **Nur ein neuer Absatz hinter Zeile 399**, kein Eingriff in die vorhandenen zwei Zeilen: dass ein Quiet-Frame die Dependency-Menge eines Effects nicht verändert. Ein Effect, den man innerhalb des Frames laufen lässt (der `{autorun: false}`-Fall), führt seinen Callback aus und behält die Dependencies, die er hatte; seine Reads in diesem Lauf zählen wie jeder andere Read im Frame nicht, die Menge richtet sich beim nächsten getrackten Lauf wieder aus. Ein Effect, der **innerhalb** eines Quiet-Frames erzeugt wird, abonniert dagegen nichts und läuft nie wieder — `hibernate()` ist der Weg, aus einem Frame auszubrechen, wenn ein Lauf tracken soll.
      - **Was Paket 12 gehört und hier liegen bleibt:** die Überschrift `### beQuiet(callback)` in Zeile 396 und der Rückgabewert. BUG-010 hebt die Signatur von `void` auf `T` und schreibt genau diese Zeile um. Dieses Paket fasst sie nicht an, formuliert seinen neuen Absatz ohne jede Aussage über einen Rückgabewert, und lässt `docs/recipes.md:334` (`const peek = beQuiet(() => b.get());`) unberührt — laut »Entscheidungen« bleibt das Rezept, wie es ist, weil BUG-010 es wahr macht.

  17. **`docs/recipes.md`.** Zwei Stellen:
      - Ein neuer Aufzählungspunkt in `## Effects: cleanup` hinter Zeile 137, im Ton der Nachbarpunkte: dass bei einem Effect, der ein Signal schreibt, von dem er abhängt, jeder verschachtelte Lauf seinen eigenen Cleanup bekommt. Er läuft nicht als *nächster* Cleanup, sondern sofort in dem Moment, in dem der nächste Lauf ihn überholt — dieselbe Regel wie im `async`-Fall zwei Abschnitte weiter unten, nur ohne die Zeitunschärfe: hier ist der Zeitpunkt exakt und synchron.
      - Ein Satz hinter Zeile 339 (»Counter-based, so it nests.«) im Abschnitt `## Quiet reads`: dass ein Quiet-Frame keine Dependency-Menge verändert — ein darin ausgeführter `eff.run()` behält seine Dependencies, ein darin *erzeugter* Effect bekommt nie welche. Der Codeblock in Zeile 331-336 bleibt unverändert (Paket 12).

  18. **`docs/cheat-sheet.md`.** Eine Zeile, direkt über Zeile 60 (`// async: cleanup of a superseded run runs LATE …`), in derselben Kommentarform: `// self-write: each nested run's cleanup runs at once when superseded — none is dropped`. Der `beQuiet`-Block in Zeile 105-113 bleibt unangetastet: die Dependency-Nuance ist für ein Cheat-Sheet zu fein, und Zeile 111 ist Paket-12-Gebiet.

  19. **`skills/using-signalize/`.** Zwei Referenzdateien:
      - `references/api.md`, hinter Zeile 127 (»The cleanup an `async` callback resolves to runs **late** …«) ein Satz in derselben knappen Diktion: dass der synchrone Fall dieselbe Regel kennt — ein von einer re-entranten Selbstschreibung überholter Lauf gibt seinen Cleanup sofort ab, statt ihn zu verlieren (pitfall 9). Die Codeblock-Zeile 181 (`beQuiet(() => a.get()); // reads untracked, writes silent; counter-based, nests`) bleibt **unverändert** — Paket 12 wird sie voraussichtlich auf eine Zuweisung umstellen, und zwei Pakete an derselben Zeile sind ein Konflikt ohne Gegenwert.
      - `references/pitfalls.md`: Punkt **9** (Zeile 27) bekommt einen Nachsatz — dass jeder verschachtelte Lauf seinen Cleanup bekommt, sofort beim Überholtwerden statt als nächster; die Empfehlung »`beQuiet` around the self-write« bleibt richtig und unverändert, weil sie den *Write* meint, nicht den Lauf. Dazu ein neuer Punkt **9a** direkt dahinter: `beQuiet()` und Effect-Läufe. Inhalt: ein Lauf im Quiet-Frame führt seinen Callback aus und behält seine Dependencies (er kann sie nur nicht neu ausrichten, weil die Reads nicht zählen); ein im Frame *erzeugter* Effect bekommt nie welche und läuft nie wieder; `hibernate()` ist der Ausweg, wenn ein Lauf tracken soll. Punkt **11a** bleibt unverändert — er handelt vom asynchronen Fall und dessen Zeitunschärfe, die es hier nicht gibt.
      - `SKILL.md` wird **nicht** geändert. Die Top-Sechs-Liste dort führt Modellfragen; Zeile 21 nennt den asynchronen Cleanup-Fall als Beispiel für »async ist zweitklassig« und bleibt in dieser Rolle richtig.

  20. **`README.md`** wird **nicht** geändert. Die »API at a glance«-Liste nennt in Zeile 123 nur die Namen `batch, beQuiet, isQuiet, hibernate`; es gibt dort nichts nachzuziehen.

  21. **`CHANGELOG.md`** — drei Zeilen am Ende der Liste unter `### Bug Fixes`, englisch, je ein Fakt, Finding-ID in Klammern am Zeilenende:
      - dass ein Effect-Lauf innerhalb von `beQuiet()` seine Dependencies behält, statt sie abzumelden. Betroffen war das `{autorun: false}`-Muster; der Effect blieb danach dauerhaft taub und zählte weiter in `getEffectsCount()` (BUG-005).
      - dass ein werfender Effect-Callback die Signale, die er nicht mehr liest, trotzdem abmeldet — die Bereinigung liegt jetzt in einem `finally`. Bisher behielt ein deterministisch scheiternder Effect eine lebende RECALL-Subscription auf ein Signal, das er nicht mehr las, und lief bei jedem Write darauf erneut in denselben Fehler (BUG-006).
      - dass ein Effect, der ein Signal schreibt, von dem er abhängt, jetzt den Cleanup **jedes** verschachtelten Laufs ausführt statt nur den ältesten aufzuheben. Ein überholter oder verdrängter Cleanup läuft sofort, so wie der eines überholten `async`-Laufs (BUG-007).
      - Hinweis für den Implementierer: unter `### Bug Fixes` stehen bereits ältere Einträge, die `(BUG-005)`, `(BUG-003)` und `(BUG-007)` in Klammern führen — die stammen aus einer früheren Audit-Runde mit anderer ID-Belegung. Das ist bekannt und wird **nicht** angefasst; released ist noch nichts, aber Einträge umschreiben ist in diesem Lauf nicht vorgesehen.
- Verify: `pnpm world`
  Zusätzlich vor dem Commit: `pnpm exec vitest run --project unit src/EffectImpl.run.spec.ts -t "<name>"` einzeln für die vier neuen Tests (die Form `pnpm test -- <datei> -t "<name>"` filtert **nicht** nach Testnamen, siehe die Korrektur in Paket 8), `pnpm exec vitest run --project unit src/ordering.property.spec.ts` für die Paket-7-Zusage aus Schritt 13, und die beiden Gegenproben aus Schritt 12. `pnpm world` enthält seit Paket 5 `test:gc` und seit Paket 6 `test:smoke` und `checkPkgTypes`; die neue Import-Kante aus Schritt 1 läuft damit auch durch `pnpm bundle`, das bei `CIRCULAR_DEPENDENCY` wirft.
- Commit: `fix(effect): keep dependencies across a quiet or throwing run and hand over every superseded cleanup (BUG-005, BUG-006, BUG-007)`
- Abgleich (2026-08-07): `src/EffectImpl.ts` ist seit `8c8f13d` unangetastet (`git log 8c8f13d..HEAD -- src/EffectImpl.ts` leer), alle Fundstellen stimmen unverändert · BUG-005 unverändert — `readSignal()` steht auf `src/signal-core.ts:33-37` mit dem `if (!isQuiet())` in `:34`, der dynamische Zweig auf `src/EffectImpl.ts:447-458` (`#lostSignals.clear()` in `:448`, `cleanupLostSignals()` in `:456`), `cleanupLostSignals()` selbst auf `:616-621`; am 2026-08-07 erstmals reproduziert (das Audit führt kein `evidence`-Feld), Skript unter `…/scratchpad/bug005.mjs` · BUG-006 unverändert — dieselben Zeilen `:447-458`, reproduziert, Ausgabe wörtlich wie im `evidence`-Feld · BUG-007 unverändert — der synchrone Zweig von `storeCleanupCallback()` auf `:710-721`, `this.runCleanupCallback()` auf `:429`; reproduziert, Ausgabe wörtlich wie im `evidence`-Feld · **Wahl bei BUG-005: »`#lostSignals` unangetastet lassen«** (Schritt 5-7), keine Breaking Change · **Erweiterung bei BUG-007** um den Verdrängungspfad, mit eigener Messung belegt (Schritt 11) · `src/signal-core.ts` fällt aus dem Bereich dieses Pakets heraus — es wird gelesen, nicht geändert

**BUG-005 · high · src/signal-core.ts:33-37 · src/EffectImpl.ts:448-458 · src/EffectImpl.ts:616-621** — beQuiet() um einen Effect-Run räumt dessen Dependencies ab
`readSignal()` meldet einen Read nur dann beim laufenden Effect an, wenn `isQuiet()` falsch ist. Ein `beQuiet(() => eff.run())` unterdrückt damit das komplette Tracking des Laufs, während `run()` vorher `#lostSignals` mit allen bisherigen Dependencies gefüllt hat — `cleanupLostSignals()` meldet anschließend alles ab, was der stumme Lauf nicht neu gelesen hat. Der Effect verliert seine Abhängigkeiten endgültig: spätere `set()` markieren ihn nicht mehr, `run()` ist ein No-op, und er bleibt als taube Hülle in `getEffectsCount()` stehen.
Empfehlung: In `run()` das Auto-Tracking gegen einen aktiven Quiet-Frame absichern (Lauf verweigern oder `#lostSignals` unangetastet lassen), oder `beQuiet()` um einen Effect-Run explizit als Fehler behandeln.

**BUG-006 · medium · src/EffectImpl.ts:447-458** — cleanupLostSignals() in ein finally ziehen — ein werfender Rerun lässt eine tote Dependency stehen
Im dynamischen Zweig baut `run()` erst `#lostSignals` auf, ruft den Callback und meldet erst danach ab, was der Callback nicht mehr liest. Ein werfender Callback überspringt diesen Schritt vollständig, während `shouldRun` bereits auf `false` steht und der Cleanup schon verbraucht ist. Der Effect behält eine lebende RECALL-Subscription auf ein Signal, das er nicht mehr liest — Writes darauf triggern ihn erneut und damit typischerweise denselben Wurf. `hasNoLiveSignals()` ist im selben Fenster verzerrt. Es heilt beim nächsten erfolgreichen Lauf, den es bei einem deterministisch scheiternden Callback nie gibt.
Empfehlung: `cleanupLostSignals()` und `#destroyedSignals.clear()` in ein `finally` um den Callback-Aufruf ziehen.

**BUG-007 · medium · src/EffectImpl.ts:710-721 · src/EffectImpl.ts:429** — Die inneren Cleanups eines selbstschreibenden Effects nicht mehr verwerfen
Ein Effect, der ein Signal schreibt, von dem er abhängt, betritt `run()` erneut — der `#runDepth`-Guard existiert genau dafür. Jeder verschachtelte Lauf belegt seine Ressourcen und gibt einen Cleanup zurück, aber es gibt nur einen `#nextCleanupCallback`-Slot, und der äußerste Lauf schreibt zuletzt: im Slot landet der *älteste* Cleanup, jeder innere wird verworfen, ohne je gelaufen zu sein. `destroy()` gibt dann die Ressource eines überholten Zustands frei und leakt die aktuelle. Der JSDoc räumt das ein, rahmt es aber als Semantikfrage; gemessen ist es ein schlichtes Ressourcenleck.
Empfehlung: Den Generationenvergleich, den der Async-Zweig schon führt, auch im synchronen Zweig anwenden: ein Lauf, dessen Generation nicht mehr aktuell ist, gibt seinen Cleanup an `runOrphanedCleanupCallback()`, statt den neueren zu überschreiben.

#### [x] 10. Ein werfender Effect stoppt seine Geschwister nicht mehr
- Findings: BUG-004 (high)
- Ziel: Die Zustellung eines Writes läuft vollständig durch; Fehler werden gesammelt und danach geworfen — einzeln oder als `AggregateError`.
- Bereich: `src/EffectImpl.ts` (`[RECALL]`), `src/signal-core.ts`, `src/collect-errors.ts`, `src/batch.ts`, Specs, Doku
- Hängt ab von: Paket 9 (beide fassen `run()` an)
- Modell: stärkste Stufe
- Hash: `dcfaa27`
- Ergebnis (2026-08-07): BUG-004 behoben, eine Review-Runde. Die Isolation sitzt im `[RECALL]`-Listener selbst — ein `catch` um `emit()` in `writeSignal()` hätte gefangen, aber keinen Geschwister-Listener mehr gerettet, weil eventize die Zustellschleife da schon abgebrochen hat. Dazu ein zweiter Rahmen in `Batch.run()` und drei `catch`-Blöcke, damit ein *nicht* isolierter Listener (Link-Callback, Fremdlistener) die bereits gesammelten Fehler nicht mitnimmt. Gesammelt wird über einen Tiefenzähler plus lazy angelegtes Array mit save-and-restore in `src/collect-errors.ts` — kein gemeinsamer Topf, jeder verschachtelte Write bekommt seinen eigenen.
  **Die Entscheidungszeile ist buchstabengetreu eingehalten**, vom Reviewer in allen drei Ästen gemessen: ein Fehler kommt als *dasselbe Objekt* an (auch `'a string'` und `throw undefined`), mehrere als `AggregateError` mit beiden Originalen in Zustellreihenfolge, null Fehler werfen nicht. `onEffectError()` bleibt leer — der Kanal ist für Fehler ohne Aufrufer reserviert, hier bleibt der Write der Aufrufer.
  **Der `wichtig` aus Runde 0:** Das Save-and-restore der Fehlertöpfe war vollständig ungeprüft. In beiden Verschachtelungstests hatte der schreibende Effect die höchste Priorität — der äußere Topf war beim Öffnen des inneren Rahmens also immer leer, genau der Zustand, für den die Mechanik existiert, trat nie ein. Zwei Einzeiler-Mutanten überlebten die komplette Suite von 429 Tests, und einer davon (`end` stellt den äußeren Topf nicht wieder her) verschluckte den Effect-Fehler **ersatzlos**: `set()` kehrte normal zurück, obwohl ein Effect geworfen hatte. Behoben durch einen Test mit werfendem Geschwister **vor** dem Schreiber; beide Mutanten fallen jetzt, die beiden alten Tests überleben sie weiterhin — der neue ist der einzige Wächter.
  Elf Mutanten insgesamt gefahren, jeder von mindestens einem Test getötet. `src/ordering.property.spec.ts` hat P8 dazubekommen: über 500 Läufe mit festem Seed 79 ohne Werfer, 119 mit genau einem, **302 mit mehreren** (maximal 7) — alle drei Äste der Entscheidungszeile werden gezogen.
  Verify selbst gelaufen: `pnpm world` Exit 0, 42 Dateien / **439 Tests** (Baseline 427). Coverage 99,06 / 94,28 / 99,52 / 99,61, `signal-core.ts` bleibt exakt bei 12 von 14 Zweigen — die engste Schwelle aus Paket 5 hält ohne Luftverbrauch. `pnpm bundle` ohne `CIRCULAR_DEPENDENCY`, `collect-errors.ts` bleibt Blattmodul.
- Beobachtbare Verhaltensänderung (im CHANGELOG festgehalten): ein `set()` auf ein Signal mit werfendem Effect **und** werfendem `link()`-Callback wirft jetzt `AggregateError[effectErr, linkErr]`, wo vorher der Effect-Fehler allein ankam — der Link lief gar nicht erst. Ein Link-Callback ist weiterhin nicht isoliert und beendet weiterhin die Zustellung; er nimmt die vorher gesammelten Fehler nur nicht mehr mit.
- Nebenbefunde:
  - `err.errors` ist **nicht flach**: ein Effect, der den `AggregateError` eines verschachtelten Writes durchlässt, steuert das ganze Objekt als seinen einen Eintrag bei (gemessen `AggregateError[AggregateError[level3|level2], level1]`). In `docs/recipes.md` festgehalten.
  - `klein`, offen: `src/batch.ts:80` — das verschachtelte `finally` verwirft einen werfenden `unsub()`, sobald etwas gesammelt wurde.
  - **Vorbestehend, kein Befund an diesem Paket:** wirft der `batch()`-Callback und scheitert zugleich ein Effect im Flush, bekommt der Aufrufer den Effect-Fehler und der Callback-Fehler geht verloren — `batch()`s `finally` überschreibt seit jeher, gegen `HEAD` identisch gemessen.
  - **Für Sprint 3:** `src/signal-core.ts:112` — `emit(globalDestroySignalQueue, …)` in `destroySignal()` hat unverändert dasselbe Abbruchverhalten wie ein Write vor diesem Paket: ein werfender `[$destroySignal]`-Handler lässt die restlichen Abonnenten mit toter Subscription zurück. Kein Finding des Audits.
  - `klein`, offen: die neue CHANGELOG-Zeile steht unter `### Bug Fixes`, obwohl sie der Bauart nach zu `### Breaking Changes` passte. Für die Semver-Bewertung beim Abschluss vorgemerkt.
- Dateien: `src/collect-errors.ts`, `src/signal-core.ts`, `src/EffectImpl.ts`, `src/batch.ts`, neu `src/effects.errorIsolation.spec.ts`, `src/ordering.property.spec.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/SKILL.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Der komplette Umbau dieses Pakets ist am 2026-08-07 in einer Kopie des Repos unter `/tmp/.../scratchpad/trial` gebaut und gemessen worden, bevor diese Zeilen entstanden sind. Die Codeblöcke unten sind der Stand, der dort grün war — nicht ein Vorschlag:

  - **Reproduktion** (drei Effects auf einem Signal, Prioritäten 10/5/1, der oberste wirft): `s.set(1) threw -> effect A failed` / `b runs 0 c runs 0`. Danach ist der Wert 1 für b und c dauerhaft verloren. Das Audit-Evidence ist eins zu eins reproduzierbar.
  - **Warum eventize das tut:** `_emitOne()` ruft `store.forEach(eventName, applyListener, …)` und `applyListener` ruft `listener.apply(…)` ohne jeden `try` (`node_modules/@spearwolf/eventize/lib/index.js:1546-1554`). Ein werfender Listener beendet die Schleife. Ein `try/catch` **um** `emit()` fängt den Fehler, rettet aber keinen Geschwister-Listener mehr — die Isolation muss **in** den Listener, also in `[RECALL]`.
  - **Nach dem Umbau:** alle 427 vorhandenen Tests bleiben grün (`vitest run`, kein einziger musste nachgeführt werden), die zehn neuen aus Schritt 6 und die achte Property aus Schritt 8 laufen durch, und **jeder Schwellenwert aus Paket 5 hält**: `signal-core.ts` bleibt bei 100 / 85,71 / 100 / 100 (die zwölf von vierzehn Zweigen bleiben zwölf von vierzehn — es kommt kein einziger Zweig hinzu), `collect-errors.ts` und `batch.ts` stehen wieder auf 100 % in allen vier Metriken, `EffectImpl.ts` steigt bei Zweigen von 95,91 % auf 96 %. Gesamt: 99,06 / 94,28 / 99,52 / 99,61.
  - **Was ein `catch`-Block die Coverage kostet**, separat gemessen (v8-Provider, eigenes Mini-Projekt): einen **Statement** und eine **Zeile**, aber **keinen Zweig**. Deshalb ist jeder der drei neuen `catch`-Blöcke unten mit einem eigenen Test unterlegt — ohne den kippen `batch.ts` (Stufe 2, 100 %) und `signal-core.ts` (Stufe 1, ≥97 Statements / ≥98 Zeilen) sofort. Gemessen ohne die Tests: `ERROR: Coverage for statements (98.11%) … for src/batch.ts`, `ERROR: Coverage for lines (96.87%) … for src/signal-core.ts`.

  **A — der Mechanismus**

  1. `src/collect-errors.ts` — den Sammel-Topf **hier** anlegen, unter das vorhandene `throwCollectedErrors()`. Die Datei ist das Blatt unter `signal-core.ts` und importiert nichts; `EffectImpl.ts` importiert sie bereits (`import {throwCollectedErrors} from './collect-errors.js'`), `signal-core.ts` und `batch.ts` dürfen es, ohne einen Zyklus zu bauen, den `rollup.config.mjs` ablehnt. Anhängen:
     ```ts
     /*
      * The delivery frame.
      *
      * A signal write hands control to application code once per subscribed
      * effect, and eventize's dispatch loop has no `try` of its own: the first
      * throw ends the delivery and every effect behind it — every effect with a
      * lower priority — never learns that the value changed. So the failure is
      * caught at the listener (see `EffectImpl[RECALL]`) and parked here until
      * the write is done, which is the only moment at which throwing it costs
      * nobody else their notification.
      *
      * Save-and-restore rather than a stack, and a counter rather than a flag,
      * for the same reason `#suppressAutoTracking` is saved and restored: an
      * effect callback may write a signal itself. That nested write opens its
      * own frame, and it must neither empty the outer one nor add to it — its
      * errors belong to *its* `set()` call site, inside the callback. If the
      * callback lets them through, they arrive here again through the outer
      * frame's `[RECALL]`, as that effect's failure. Exactly one entry per
      * failing effect, either way.
      *
      * The array is created on the first failure, not per write: `writeSignal()`
      * is the hot path of the whole library and the overwhelming majority of
      * deliveries collect nothing.
      */
     let g_deliveryDepth = 0;
     let g_deliveryErrors: unknown[] | undefined;

     /**
      * Open a delivery frame. The return value belongs to the caller and must
      * be handed back to {@link endIsolatedDelivery} in a `finally`.
      * @internal
      */
     export const beginIsolatedDelivery = (): unknown[] | undefined => {
       g_deliveryDepth++;
       const outer = g_deliveryErrors;
       g_deliveryErrors = undefined;
       return outer;
     };

     /**
      * Close the frame opened by {@link beginIsolatedDelivery} and re-raise what
      * it collected — nothing, the single error unchanged, or an
      * `AggregateError` in delivery order.
      *
      * The state is restored *before* the throw, so the frame is intact for
      * whoever catches it — including the outer frame this one is nested in.
      * @internal
      */
     export const endIsolatedDelivery = (
       outer: unknown[] | undefined,
       what: string,
     ): void => {
       const errors = g_deliveryErrors;
       g_deliveryErrors = outer;
       g_deliveryDepth--;
       if (errors !== undefined) throwCollectedErrors(errors, what);
     };

     /**
      * Park a failure in the open delivery frame.
      *
      * @returns `false` when there is no frame — then the caller must rethrow.
      *   A `run()` invoked directly, by `effect.run()` or by `createEffect()`'s
      *   autorun, has a caller who asked for it and gets its error at once.
      * @internal
      */
     export const collectDeliveryError = (error: unknown): boolean => {
       if (g_deliveryDepth === 0) return false;
       if (g_deliveryErrors === undefined) g_deliveryErrors = [];
       g_deliveryErrors.push(error);
       return true;
     };
     ```
     Modulzustand in einem Blattmodul ist Hausstil und hier richtig: `Batch.current`, `globalEffectStack` und der `beQuiet`-Zähler machen dasselbe. Kein Export nach `src/index.ts` — das ist interne Mechanik.
  2. `src/signal-core.ts` — den Import ergänzen (Biome sortiert ihn hinter `./bequiet.js`) und `writeSignal()` umbauen. **Der `if (!isQuiet())`-Rahmen bleibt exakt wie er ist**; er ist der einzige Zweig der Funktion, und die Datei hat bei Zweigen keine Luft:
     ```ts
     import {
       beginIsolatedDelivery,
       collectDeliveryError,
       endIsolatedDelivery,
     } from './collect-errors.js';
     ```
     ```ts
     export function writeSignal(
       signalId: symbol,
       value: unknown,
       params?: SignalValueParams,
     ) {
       if (!isQuiet()) {
         const outerErrors = beginIsolatedDelivery();
         try {
           emit(globalSignalQueue, signalId, value, params);
         } catch (err) {
           // Not everything on this queue is an effect: a link callback
           // (`SignalLink`, one `on(globalSignalQueue, source.id, …)` per link)
           // is application code that is *not* isolated, and its throw does end
           // the delivery. What must not happen is that it also swallows the
           // failures the effects before it already handed in — so it joins
           // them, in the order everything ran.
           collectDeliveryError(err);
         } finally {
           endIsolatedDelivery(
             outerErrors,
             'notifying the effects of a signal write',
           );
         }
       }
     }
     ```
     Den JSDoc über `writeSignal()` von »Announce a new signal value to the global signal queue.« auf drei Sätze erweitern: dass jeder Abonnent bedient wird, bevor die Funktion zurückkommt oder wirft; dass Fehler aus Effect-Callbacks bis zum Ende der Zustellung gesammelt werden; dass ein einzelner Fehler unverändert und mehrere als `AggregateError` in Zustellreihenfolge geworfen werden.
     Weil das `catch` alles abfängt, ist in der `finally` nie eine Exception unterwegs, die `endIsolatedDelivery()` verdecken könnte — das ist die Bedingung dafür, dass diese Reihenfolge sicher ist.
  3. `src/EffectImpl.ts` — den Import auf `import {collectDeliveryError, throwCollectedErrors} from './collect-errors.js';` erweitern und `[RECALL]()` (aktuell Zeile 566, **nicht** 511 wie im Audit und nicht 522 wie in der Querbezug-Tabelle von Paket 9 — Abgleich über den Symbolnamen) umbauen:
     ```ts
     [RECALL]() {
       this.shouldRun = true;
       if (!this.autorun) return;
       try {
         this.run();
       } catch (err) {
         // BUG-004: this is the listener eventize calls, and the only place
         // where swallowing helps — one frame further out, around `emit()`,
         // the dispatch loop has already given up on the siblings. Isolation
         // is a property of the *delivery*, not of `run()`: without an open
         // frame (a direct `effect.run()`, a hand-emitted RECALL) the error
         // belongs to whoever asked for the run and is rethrown here.
         if (!collectDeliveryError(err)) throw err;
       }
     }
     ```
     Der JSDoc über `[RECALL]()` bekommt einen Absatz: ein werfender Callback beendet die Zustellung nicht mehr, sein Fehler wird bis zum Ende gesammelt, und ein `run()` außerhalb einer Zustellung wirft weiterhin sofort.
     **Nichts an `run()` selbst ändern.** Der `try`/`finally` um den Callback samt `readsBefore`/`completed`/`#trackedReads` aus Paket 9 bleibt Wort für Wort stehen: die Isolation sitzt eine Ebene darüber, das heißt jeder Lauf räumt seine Dependencies **vor** dem Sammeln des Fehlers zu Ende auf. Genau das ist die Voraussetzung, die Paket 9 hinterlassen hat — ohne sie würde ein isolierter Dauerwerfer bei jedem Write eine tote Subscription mehr hinterlassen.
  4. `src/batch.ts` — in einem Batch läuft die Zustellung nicht im Write, sondern im Flush; ohne Rahmen dort fiele der Batch-Fall aus der Zusage heraus (heute gemessen: `batch: d runs 0`, der Fehler kommt beim `batch()`-Aufrufer an, die restlichen verzögerten Effects laufen nicht). Import ergänzen (Biome sortiert `./collect-errors.js` vor `./constants.js`) und `Batch.run()` umbauen:
     ```ts
     run() {
       const alreadyBeenCalled = new Set<symbol>();

       const unsubscribe: VoidFunc[] = [];
       const outerErrors = beginIsolatedDelivery();
       try {
         unsubscribe.push(
           on(globalEffectQueue, (effectId, actionType) => {
             if (actionType === RECALL) {
               alreadyBeenCalled.add(effectId);
             }
           }),
           on(globalEffectCalledQueue, (effectId) => {
             alreadyBeenCalled.add(effectId);
           }),
         );

         for (const [, effects] of this.delayedEffects) {
           for (const effectId of effects) {
             if (alreadyBeenCalled.has(effectId)) {
               continue;
             }
             try {
               emit(globalEffectQueue, effectId, effectId, RECALL);
             } catch (err) {
               // The effect's own failure never gets this far — `[RECALL]`
               // parked it in the frame opened above. This catches whatever
               // else sits on the queue under that id, so one foreign listener
               // cannot cost the rest of the batch its flush.
               collectDeliveryError(err);
             }
           }
         }
       } finally {
         try {
           for (const unsub of unsubscribe) {
             unsub();
           }
         } finally {
           // Nested, because closing the frame is not optional: an `unsub()`
           // that threw would otherwise leave the module state one level deep
           // for the rest of the process.
           endIsolatedDelivery(outerErrors, 'flushing a batch of signal writes');
         }
       }
     }
     ```
     Der Rahmen gehört in `Batch.run()` und nicht in `batch()`: `hibernate()` ruft `savedBatch.flush()` und damit `run()` direkt. Der Fehler landet damit dort, wo er heute schon landet — beim `batch()`-Aufrufer bzw. beim `hibernate()`-Aufrufer —, nur nach vollständigem Flush. Den JSDoc von `batch()` um einen Satz ergänzen: ein Effect, der im Flush wirft, hält die anderen verzögerten Effects nicht mehr auf; sein Fehler (bzw. der `AggregateError`) kommt beim `batch()`-Aufrufer an, nachdem der Flush durch ist.
  5. **Was ausdrücklich nicht angefasst wird**, jeweils mit dem Grund, damit es im Review nicht als Lücke gelesen wird:
     - **`onEffectError()` bekommt diese Fehler nicht** — weder statt noch zusätzlich. Der Kanal ist im ganzen Projekt für Fehler reserviert, die *keinen Aufrufer mehr haben* (`emitEffectError`, `src/EffectImpl.ts:100-127`, JSDoc: »an error that surfaced after the synchronous call stack was gone«), und genau das ist hier nicht der Fall: der Write bleibt der Aufrufer, er wirft nach der Zustellung, die Entscheidungszeile hält das fest. Zusätzlich zu melden hieße, jeden synchronen Callback-Fehler doppelt auszuliefern — einmal geworfen, einmal gemeldet — und die Zusage aus `docs/api.md` (»Failures land here when there is no legitimate caller left to throw at«) sowie `references/api.md:123` (»Every other synchronous throw normally propagates to whoever triggered the run, unaffected«) zu brechen. Was stattdessen passiert: die Doku (Schritte 9–14) sagt an drei Stellen ausdrücklich, dass dieser Fall **nicht** über `onEffectError()` läuft.
     - **`hibernate()`** braucht keinen Eingriff. Es räumt `batch`, `beQuiet` und den Effect-Stack beiseite; der Zustellrahmen ist keine solche Kontextfrage, sondern die Buchführung genau eines laufenden `emit()`. Ein Write innerhalb von `hibernate()` öffnet seinen eigenen Rahmen und wirft an seiner eigenen Aufrufstelle — das ist das gewünschte Verhalten, und `savedBatch.flush()` bekommt seinen Rahmen über Schritt 4.
     - **`runOrphanedCleanupCallback()`** (Zeile 855) ist bereits isoliert: es fängt jeden synchronen Wurf und meldet ihn über `emitEffectError(…, 'cleanup')`. Es kann eine Zustellung also gar nicht abbrechen, auch nicht seit BUG-007, wo es mitten in einem Lauf synchron ausgeführt wird. Nichts zu tun; nur nicht versehentlich »absichern«.
     - **`destroySignal()`** bleibt, wie es ist. Sein `emit(globalDestroySignalQueue, …)` hat dasselbe Abbruchverhalten, und ein `[$destroySignal]`-Handler kann über `destroyWhenUntriggerable()` bis in fremden Cleanup-Code laufen. Das ist aber ein Teardown, kein Write; BUG-004 beschreibt ausschließlich die Write-Zustellung, und das Audit führt für die Destroy-Queue kein Finding. Als Nebenbefund notiert (siehe »Querbezüge«), nicht in diesem Paket erledigt.
     - **Link-Callbacks werden nicht isoliert.** Ein `SignalLink` hängt mit einem gewöhnlichen `on(globalSignalQueue, source.id, …)` an derselben Zustellung; ihn zu kapseln hieße, die Fehlersemantik von `link()` zu ändern — eine zweite Verhaltensänderung an der öffentlichen API, die niemand entschieden hat. Er bleibt der eine Fall, in dem eine Zustellung vorzeitig endet; Schritt 2 sorgt nur dafür, dass die vorher gesammelten Fehler dabei nicht verschwinden, und Test 6 in Schritt 6 friert genau das ein. `Signal#onChange()` ist von der Frage nicht betroffen: sein Callback läuft als Static-Deps-Effect (`src/Signal.ts:37-42`) und ist damit automatisch mit isoliert.

  **B — die Regressionstests, rot zuerst**

  6. Neue Datei `src/effects.errorIsolation.spec.ts`. Zehn Tests; sie sind gegen den unveränderten Stand rot (gemessen: alle zehn, zusammen mit der Property aus Schritt 8 elf rote) und gegen den Stand aus Schritt 1–4 grün. Wichtig für den roten Lauf: die Tests **einzeln** über `pnpm test -- -t "<name>"` prüfen, sonst verdeckt die `afterEach`-Bilanz eines abgebrochenen Tests die Aussage des nächsten (`beforeEach: Number of active effects should be 0 but is 3`). Der `armed`-Schalter in jedem Test ist kein Zierat: `createEffect()` führt den Callback sofort aus, ein bedingungsloser Wurf würde schon die Konstruktion sprengen.
     ```ts
     import {emit, getSubscriptionCount, on} from '@spearwolf/eventize';
     import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
     import {batch} from './batch.js';
     import {$effect, RECALL} from './constants.js';
     import {createSignal} from './createSignal.js';
     import {createEffect, getEffectsCount} from './effects.js';
     import {globalEffectQueue, globalSignalQueue} from './global-queues.js';
     import {link} from './link.js';
     import {destroySignal, getSignalsCount} from './signal-core.js';

     const effectIdOf = (effect: {[$effect]?: {id: symbol}}): symbol =>
       effect[$effect]!.id;

     describe('a throwing effect callback does not silence its siblings (BUG-004)', () => {
       beforeEach(() => {
         assertEffectsCount(0, 'beforeEach');
         assertSignalsCount(0, 'beforeEach');
       });

       afterEach(() => {
         assertEffectsCount(0, 'afterEach');
         assertSignalsCount(0, 'afterEach');
       });

       it('delivers to every effect and throws the failure afterwards', () => {
         const sig = createSignal(0);
         const order: string[] = [];
         const seen: number[] = [];
         const boom = new Error('effect A failed');
         let armed = false;

         const a = createEffect(
           () => {
             seen.push(sig.get());
             order.push('a');
             if (armed) throw boom;
           },
           {priority: 10},
         );
         const b = createEffect(
           () => {
             seen.push(sig.get());
             order.push('b');
           },
           {priority: 5},
         );
         const c = createEffect(
           () => {
             seen.push(sig.get());
             order.push('c');
           },
           {priority: 1},
         );

         order.length = 0;
         seen.length = 0;
         armed = true;

         let thrown: unknown;
         try {
           sig.set(1);
         } catch (err) {
           thrown = err;
         }

         expect(order, 'every effect ran, in priority order').toEqual([
           'a',
           'b',
           'c',
         ]);
         expect(seen, 'the siblings saw the value that was written').toEqual([
           1, 1, 1,
         ]);
         expect(thrown, 'a single failure arrives unchanged').toBe(boom);

         a.destroy();
         b.destroy();
         c.destroy();
         destroySignal(sig);
       });

       it('bundles several failures of one write into an AggregateError', () => {
         const sig = createSignal(0);
         const first = new Error('boom1');
         const second = new Error('boom2');
         const order: string[] = [];
         let armed = false;

         const a = createEffect(
           () => {
             sig.get();
             order.push('a');
             if (armed) throw first;
           },
           {priority: 10},
         );
         const b = createEffect(
           () => {
             sig.get();
             order.push('b');
             if (armed) throw second;
           },
           {priority: 5},
         );
         const c = createEffect(
           () => {
             sig.get();
             order.push('c');
           },
           {priority: 1},
         );

         order.length = 0;
         armed = true;

         let thrown: any;
         try {
           sig.set(1);
         } catch (err) {
           thrown = err;
         }

         expect(order).toEqual(['a', 'b', 'c']);
         expect(thrown).toBeInstanceOf(AggregateError);
         expect(thrown.errors, 'in delivery order').toEqual([first, second]);
         expect(thrown.message).toBe(
           '[signalize] 2 errors while notifying the effects of a signal write',
         );

         a.destroy();
         b.destroy();
         c.destroy();
         destroySignal(sig);
       });

       it('gives a nested write its own error pot', () => {
         const outerSig = createSignal(0);
         const innerSig = createSignal(0);
         const innerBoom = new Error('inner boom');
         const outerBoom = new Error('outer boom');
         let armed = false;
         let caughtInside: unknown;
         let lowRuns = 0;

         const writer = createEffect(
           () => {
             outerSig.get();
             try {
               innerSig.set(innerSig.value + 1);
             } catch (err) {
               caughtInside = err;
             }
           },
           {priority: 10},
         );
         const innerEffect = createEffect(
           () => {
             innerSig.get();
             if (armed) throw innerBoom;
           },
           {priority: 3},
         );
         const failing = createEffect(
           () => {
             outerSig.get();
             if (armed) throw outerBoom;
           },
           {priority: 5},
         );
         const low = createEffect(
           () => {
             outerSig.get();
             lowRuns++;
           },
           {priority: 1},
         );

         lowRuns = 0;
         armed = true;

         let thrown: unknown;
         try {
           outerSig.set(1);
         } catch (err) {
           thrown = err;
         }

         expect(caughtInside, 'the inner write threw at its own call site').toBe(
           innerBoom,
         );
         expect(lowRuns, 'the outer delivery went on').toBe(1);
         expect(thrown, 'the inner pot was not merged into the outer one').toBe(
           outerBoom,
         );

         writer.destroy();
         innerEffect.destroy();
         failing.destroy();
         low.destroy();
         destroySignal(outerSig, innerSig);
       });

       it('lets an uncaught nested failure become the failure of the writing effect', () => {
         const outerSig = createSignal(0);
         const innerSig = createSignal(0);
         const innerBoom = new Error('inner boom');
         const outerBoom = new Error('outer boom');
         let armed = false;
         let lowRuns = 0;

         const writer = createEffect(
           () => {
             outerSig.get();
             innerSig.set(innerSig.value + 1);
           },
           {priority: 10},
         );
         const innerEffect = createEffect(
           () => {
             innerSig.get();
             if (armed) throw innerBoom;
           },
           {priority: 3},
         );
         const failing = createEffect(
           () => {
             outerSig.get();
             if (armed) throw outerBoom;
           },
           {priority: 5},
         );
         const low = createEffect(
           () => {
             outerSig.get();
             lowRuns++;
           },
           {priority: 1},
         );

         lowRuns = 0;
         armed = true;

         let thrown: any;
         try {
           outerSig.set(1);
         } catch (err) {
           thrown = err;
         }

         expect(lowRuns).toBe(1);
         expect(thrown).toBeInstanceOf(AggregateError);
         expect(thrown.errors, 'one entry per failing effect of this write').toEqual(
           [innerBoom, outerBoom],
         );

         writer.destroy();
         innerEffect.destroy();
         failing.destroy();
         low.destroy();
         destroySignal(outerSig, innerSig);
       });

       it('runs every delayed effect of a batch before the flush throws', () => {
         const sig = createSignal(0);
         const boom = new Error('batch boom');
         let armed = false;
         let lowRuns = 0;

         const failing = createEffect(
           () => {
             sig.get();
             if (armed) throw boom;
           },
           {priority: 10},
         );
         const low = createEffect(
           () => {
             sig.get();
             lowRuns++;
           },
           {priority: 1},
         );

         lowRuns = 0;
         armed = true;

         let thrown: unknown;
         try {
           batch(() => {
             sig.set(1);
           });
         } catch (err) {
           thrown = err;
         }

         expect(lowRuns, 'the flush reached the lower priority').toBe(1);
         expect(thrown, 'and threw at the batch() caller afterwards').toBe(boom);

         failing.destroy();
         low.destroy();
         destroySignal(sig);
       });

       it('keeps the failures already collected when a link callback aborts the delivery', () => {
         const sig = createSignal(0);
         const effectBoom = new Error('effect boom');
         const linkBoom = new Error('link boom');
         let armed = false;
         let lowRuns = 0;

         const failing = createEffect(
           () => {
             sig.get();
             if (armed) throw effectBoom;
           },
           {priority: 10},
         );
         const theLink = link(sig, () => {
           if (armed) throw linkBoom;
         });
         const low = createEffect(
           () => {
             sig.get();
             lowRuns++;
           },
           {priority: -5},
         );

         lowRuns = 0;
         armed = true;

         let thrown: any;
         try {
           sig.set(1);
         } catch (err) {
           thrown = err;
         }

         expect(thrown).toBeInstanceOf(AggregateError);
         expect(
           thrown.errors,
           'the effect failure was not lost behind the link failure',
         ).toEqual([effectBoom, linkBoom]);
         expect(
           lowRuns,
           'a throwing link callback is not isolated and does end the delivery',
         ).toBe(0);

         theLink.destroy();
         failing.destroy();
         low.destroy();
         destroySignal(sig);
       });

       it('does not let a foreign listener on the effect queue stop a flush', () => {
         const sig = createSignal(0);
         const boom = new Error('foreign queue boom');
         let lowRuns = 0;

         const high = createEffect(
           () => {
             sig.get();
           },
           {priority: 10},
         );
         const low = createEffect(
           () => {
             sig.get();
             lowRuns++;
           },
           {priority: 1},
         );

         const unsubscribe = on(globalEffectQueue, effectIdOf(high), () => {
           throw boom;
         });

         lowRuns = 0;

         let thrown: unknown;
         try {
           batch(() => {
             sig.set(1);
           });
         } catch (err) {
           thrown = err;
         }

         expect(lowRuns).toBe(1);
         expect(thrown).toBe(boom);

         unsubscribe();
         high.destroy();
         low.destroy();
         destroySignal(sig);
       });

       it('throws at the caller of a direct run()', () => {
         const sig = createSignal(0);
         const boom = new Error('direct boom');
         let armed = false;

         const effect = createEffect(() => {
           sig.get();
           if (armed) throw boom;
         });

         armed = true;

         expect(() => {
           effect[$effect]!.shouldRun = true;
           effect.run();
         }).toThrow('direct boom');

         effect.destroy();
         destroySignal(sig);
       });

       it('throws at the emitter of a RECALL outside any delivery', () => {
         const sig = createSignal(0);
         const boom = new Error('unframed boom');
         let armed = false;

         const effect = createEffect(() => {
           sig.get();
           if (armed) throw boom;
         });

         armed = true;
         const id = effectIdOf(effect);

         expect(() => {
           emit(globalEffectQueue, id, id, RECALL);
         }).toThrow('unframed boom');

         effect.destroy();
         destroySignal(sig);
       });

       it('leaves nothing behind after a run of failing writes', () => {
         const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
         const effectSubscriptions = getSubscriptionCount(globalEffectQueue);
         const effects = getEffectsCount();
         const signals = getSignalsCount();

         const sig = createSignal(0);
         let armed = false;
         const failing = createEffect(() => {
           sig.get();
           if (armed) throw new Error('boom');
         });
         const sibling = createEffect(() => sig.get(), {priority: -1});

         armed = true;
         for (let i = 1; i <= 3; i++) {
           expect(() => sig.set(i)).toThrow('boom');
         }

         failing.destroy();
         sibling.destroy();
         destroySignal(sig);

         expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
         expect(getSubscriptionCount(globalEffectQueue)).toBe(effectSubscriptions);
         expect(getEffectsCount()).toBe(effects);
         expect(getSignalsCount()).toBe(signals);
       });
     });
     ```
  7. Welcher Test welche neue Zeile deckt — die drei mit einem Stern sind Pflicht, ohne sie reißt eine Schwelle aus Paket 5:
     | Test | deckt |
     | --- | --- |
     | 1 `delivers to every effect …` | die Aussage des Findings: alle laufen, in Prioritätsreihenfolge, mit dem geschriebenen Wert, ein einzelner Fehler kommt unverändert an |
     | 2 `bundles several failures …` | `throwCollectedErrors()`s `AggregateError`-Zweig auf dem Write-Pfad, samt Meldungstext und Reihenfolge |
     | 3 `gives a nested write its own error pot` | `beginIsolatedDelivery()`/`endIsolatedDelivery()` mit Verschachtelung: der innere Topf wird nicht mit dem äußeren verschmolzen |
     | 4 `lets an uncaught nested failure …` | dieselbe Verschachtelung ohne `catch` im Callback: genau **ein** Eintrag pro gescheitertem Effect, keine Dopplung |
     | 5 `runs every delayed effect of a batch …` | der Rahmen in `Batch.run()` |
     | 6 \* `keeps the failures already collected …` | das `catch` in `writeSignal()` (`signal-core.ts`) — der einzige Weg dorthin ist ein nicht isolierter Listener, praktisch ein Link-Callback |
     | 7 \* `does not let a foreign listener …` | das `catch` um `emit()` in `Batch.run()` |
     | 8 `throws at the caller of a direct run()` | die Zusage, dass ein direkter `run()` unverändert wirft |
     | 9 \* `throws at the emitter of a RECALL …` | `collectDeliveryError()`s `return false` **und** den `throw err`-Zweig in `[RECALL]` |
     | 10 `leaves nothing behind …` | die Leak-Bilanz nach mehreren gescheiterten Writes (Muster aus `CLAUDE.md`) |
  8. `src/ordering.property.spec.ts` — die Erweiterung gehört hierher, weil P1 (»jeder auf das geschriebene Signal abonnierte Effect läuft genau einmal, in monoton fallender Priorität«) wörtlich die Aussage ist, die BUG-004 für werfende Geschwister erst herstellt. Geprüft: P1 baut ausschließlich lesende Callbacks; die neue Property ist P1 plus einem `throws`-Flag pro Effect und behauptet zusätzlich, wo die Fehler landen. Als achter Block hinter P7, vor der schließenden `});` der Datei, mit demselben `FC` (Seed `20260807`, 500 Läufe) und demselben `byPriorityThenCreation`:
     ```ts
     it('P8 — a throwing effect changes nothing about who runs, or in which order', () => {
       fc.assert(
         fc.property(
           fc.array(fc.record({priority: priorityArb, throws: fc.boolean()}), {
             minLength: 1,
             maxLength: 8,
           }),
           (specs) => {
             const sig = createSignal(0);
             const calls: Array<[number, number]> = [];
             const seen: number[] = [];
             const errors = specs.map((_, i) => new Error(`boom in effect ${i}`));

             let armed = false;
             const effects = specs.map(({priority, throws}, creationOrder) =>
               createEffect(
                 () => {
                   seen.push(sig.get());
                   calls.push([priority, creationOrder]);
                   if (armed && throws) throw errors[creationOrder];
                 },
                 {priority},
               ),
             );

             try {
               calls.length = 0;
               seen.length = 0;
               armed = true;

               let thrown: any;
               try {
                 sig.set(1);
               } catch (err) {
                 thrown = err;
               }

               // Same three assertions as P1 — they must hold with a throwing
               // effect in the fan-out exactly as they do without one.
               const ranIndices = calls.map(([, creationOrder]) => creationOrder);
               const expectedRan = specs.map((_, i) => i);
               expect(new Set(ranIndices)).toEqual(new Set(expectedRan));
               expect(ranIndices).toHaveLength(new Set(ranIndices).size);

               const expected = [...calls].sort(byPriorityThenCreation);
               expect(calls).toEqual(expected);

               // Every effect, the failing ones included, saw the written value.
               expect(seen).toEqual(specs.map(() => 1));

               // The failures reach the caller of set(), in delivery order.
               const expectedErrors = expected
                 .map(([, creationOrder]) => creationOrder)
                 .filter((i) => specs[i]!.throws)
                 .map((i) => errors[i]);

               if (expectedErrors.length === 0) {
                 expect(thrown).toBeUndefined();
               } else if (expectedErrors.length === 1) {
                 expect(thrown).toBe(expectedErrors[0]);
               } else {
                 expect(thrown).toBeInstanceOf(AggregateError);
                 expect(thrown.errors).toEqual(expectedErrors);
               }
             } finally {
               for (const effect of effects) effect.destroy();
               sig.destroy();
             }
           },
         ),
         FC,
       );
     });
     ```
     Gemessen: vor dem Umbau rot (`expected Set{ +0 } to deeply equal Set{ +0, 1 }`), danach grün. Die sieben vorhandenen Properties bleiben unberührt und grün — die Zusage aus dem Querbezug zu Paket 7 hält.

  **C — die Doku, in der Reihenfolge aus `CLAUDE.md`**

  9. `docs/api.md`, Abschnitt *Signals* — hinter dem letzten Zitatblock zu `set()` (»On a muted or destroyed signal …«, Zeile 53-55) einen neuen anhängen, vor `### Top-level helpers`:
     ```md
     > **A failing effect no longer costs its siblings their notification.**
     > `set()` runs *every* subscribed effect before it returns — including the
     > ones with a lower priority than the one that threw — and only then
     > re-raises what failed: a single failure unchanged, several as an
     > `AggregateError` in delivery order. Wrap the write in `try`/`catch` if
     > effect failures are expected; the value is written and delivered either
     > way. The exception is a throwing `link()` callback, which is not an
     > effect and does end the delivery — the failures collected before it are
     > still re-raised together with it.
     ```
  10. `docs/api.md`, Abschnitt *Effects* — den `callback`-Absatz von `createEffect` (Zeile 77-89) um zwei Sätze ergänzen, direkt hinter dem Satz über den synchronen Fall: dass ein synchroner Wurf aus dem Callback bei dem ankommt, der die Ausführung ausgelöst hat (`set()`, `touch()`, `batch()`, `effect.run()`), dass er die anderen Effects desselben Writes aber nicht mehr aufhält, und dass der Effect selbst danach benutzbar bleibt — er behält seine Dependencies (Paket 9) und läuft beim nächsten Write wieder.
  11. `docs/api.md`, `### onEffectError` — in den Absatz »Failures land here when there is no legitimate caller left to throw at …« (Zeile 195-204) einen Satz einziehen: ein **synchroner** Wurf aus einem Effect-Callback landet hier ausdrücklich **nicht**; er wird bis zum Ende der Zustellung gesammelt und dann bei dem geworfen, der geschrieben hat. Wer alle Fehler an einer Stelle sehen will, fängt am Write.
  12. `docs/api.md`, `### batch(callback)` (Zeile 379) — hinter den Absatz über den synchronen Wurf am `batch()`-Aufrufer einen Satz: ein Effect, der im Flush wirft, hält die restlichen verzögerten Effects nicht mehr auf; sein Fehler kommt nach dem Flush beim `batch()`-Aufrufer an, mehrere als `AggregateError`.
  13. `docs/recipes.md` — neuer Abschnitt `## When an effect callback throws` zwischen `## Priority` (Zeile 208) und `## Recursion guard` (Zeile 219). Inhalt: das Beispiel mit drei Effects und dem werfenden obersten, die Aussage »alle laufen, der Fehler kommt am `set()` an«, der `AggregateError` bei mehreren, der Hinweis auf den verschachtelten Write (der innere Fehler gehört dem inneren `set()`), und die Abgrenzung zu `onEffectError()`. Dazu die Zeile, die im `## Batching`-Abschnitt (Zeile 299-333) fehlt: ein werfender Effect beendet den Flush nicht.
  14. `docs/cheat-sheet.md` — im Effects-Block (Zeile 57-66, direkt über der `onEffectError`-Zeile) zwei Kommentarzeilen: `// a throwing callback no longer stops the other effects of that write` und `// set() re-raises after the delivery — several failures as an AggregateError`.
  15. `skills/using-signalize/` — drei Stellen:
      - `SKILL.md`, *Mental model*: an den Aufzählungspunkt über die synchrone Propagation (Zeile 18) einen Halbsatz anhängen, dass ein werfender Effect die Zustellung nicht mehr abbricht und `set()` erst danach wirft.
      - `references/api.md`, Abschnitt *Effect errors and async callbacks* (Zeile 117-127): den Satz »Every other synchronous throw normally propagates to whoever triggered the run, unaffected.« präzisieren — er propagiert zu ihm, aber erst nachdem jeder andere Effect desselben Writes gelaufen ist; mehrere Fehler eines Writes kommen als `AggregateError`.
      - `references/pitfalls.md`, Abschnitt *Effects*: neuer Punkt **11d** hinter 11c (Zeile 52), im Stil der Nachbarn: dass ein synchroner Wurf früher die ganze Fan-out-Zustellung abgebrochen hat, dass die Geschwister davon nichts erfuhren und den Wert dauerhaft verloren, dass es jetzt isoliert ist — und was daran neu zu wissen ist: `set()` kann jetzt einen `AggregateError` werfen, und ein Link-Callback bleibt die Ausnahme.
  16. `CHANGELOG.md`, unter `## Unreleased` → `### Bug Fixes`, ans Ende der Liste, englisch, je ein Fakt pro Zeile:
      - dass ein werfender Effect-Callback die Zustellung eines Writes nicht mehr abbricht — jeder abonnierte Effect läuft, in Prioritätsreihenfolge, und die Fehler kommen danach bei dem an, der geschrieben hat: einer unverändert, mehrere als `AggregateError` in Zustellreihenfolge (BUG-004);
      - dass dasselbe für den Flush eines `batch()` gilt (BUG-004);
      - dass ein synchroner Callback-Fehler weiterhin **nicht** über `onEffectError()` läuft — der Kanal bleibt den Fehlern ohne Aufrufer vorbehalten (BUG-004).
  17. `AGENTS.md` und `README.md` bleiben unberührt: die Export-Liste ändert sich nicht, `collect-errors.ts` steht in der Dateikarte von `AGENTS.md` gar nicht, und die Zeile zu `signal-core.ts` (`AGENTS.md:112`) zählt Symbole auf, von denen keines wegfällt.
- Verify: `pnpm world` (enthält seit Paket 5/6 `test:gc`, `test:smoke` und `checkPkgTypes`). Zusätzlich vor dem Commit: `pnpm test -- src/EffectImpl.run.spec.ts` muss grün sein — dort steht der BUG-006-Test `a throwing callback still releases the dependency it stopped reading`, der `expect(() => setCond(false)).toThrow('boom')` mit genau **einem** werfenden Effect assertiert. Bleibt er grün, ist die Entscheidungszeile eingehalten; wird er rot, weil ein einzelner Fehler in einem `AggregateError` ankommt, ist der Umbau falsch, nicht der Test.
- Commit: `fix(effect): isolate effect callbacks so one failure cannot silence the delivery (BUG-004)`
- Abgleich (2026-08-07): BUG-004 unverändert vorhanden und selbst reproduziert (`s.set(1) threw -> effect A failed` / `b runs 0 c runs 0`; der Wert bleibt für b und c verloren). Die zweite Fundstelle stimmt: `writeSignal()` steht in `src/signal-core.ts:43-51`. Die erste ist überholt — `[RECALL]()` steht nach Paket 9 auf **Zeile 566**, nicht auf 511 (Audit) und nicht auf 522 (Querbezug-Tabelle von Paket 9, die durchgängig zu niedrig liegt, siehe die Korrektur unter »Querbezüge«). Paket 9 hat die Lage nicht entschärft: der `finally` in `run()` rettet die Dependencies eines werfenden Laufs, aber der Wurf verlässt `run()` unverändert und beendet die Zustellschleife von eventize genau wie zuvor.

**BUG-004 · high · src/EffectImpl.ts:511-516 (jetzt :566-571) · src/signal-core.ts:43-51** — Effect-Callbacks isolieren, damit ein werfender Effect nicht seine Geschwister verstummen lässt
`writeSignal()` stellt über ein einziges `emit(globalSignalQueue, signalId, …)` zu, und der `[RECALL]`-Handler ruft `run()` inline. Ein synchroner Wurf aus irgendeinem Effect-Callback verlässt damit die Zustellschleife von eventize: jeder Effect mit niedrigerer Priorität läuft für diesen Write nicht — und erfährt nie, dass er einen verpasst hat. Der Write selbst wirft zusätzlich beim Aufrufer von `set()`. Die Doku behandelt Fehlerbehandlung nur für asynchrone Rejections; dass ein synchroner Wurf ein Cross-Effect-Risiko ist, steht nirgends.
Empfehlung: Den `run()`-Aufruf in `[RECALL]` so kapseln, dass ein scheiternder Effect gemeldet wird, ohne die Zustellung an seine Geschwister abzubrechen — mindestens aber das Fan-out-Verhalten und seine Prioritätsabhängigkeit dokumentieren.
Evidence (2026-08-07 selbst reproduziert): `10a: s.set(1) threw -> effect A failed` / `10a: b runs 0 c runs 0 (0/0 => Geschwister verstummt)` / `10a: nach s.set(2): b 1 c 1   <- der Wert 1 ist dauerhaft verloren`.

#### [x] 11. Static-Deps-Effects überleben einen Soft-Detach
- Findings: BUG-003 (high)
- Ziel: Nach `SignalGroup.off()` meldet ein Effect mit deklarierten Dependencies seine Signale wieder an, statt dauerhaft taub zu bleiben.
- Bereich: `src/EffectImpl.ts`, `src/SignalGroup.ts`, Specs
- Hängt ab von: Paket 9, 10
- Modell: stärkste Stufe
- Hash: `07b712a`
- Ergebnis (2026-08-07): BUG-003 behoben, eine Review-Runde. **Die Empfehlung des Audits wurde gebaut, gemessen und verworfen.** Sie lautet »im Soft-Detach-Zweig `saveSignalsFromDeps()` erneut ausführen« und ist breaking: Planer und Reviewer haben unabhängig gemessen, dass `off()` damit für Static-Deps-Effects **wirkungslos** wird (`globalSignalQueue` fällt nur von 4 auf 3 statt auf 2, `a.set(3)` ergibt `static 1` statt `0`) und dass ein Effect mit alleiniger Gruppen-Dependency den Detach überlebt (`effects 1` statt `0`) — zwei dokumentierte Zusagen kippen. Umgesetzt ist stattdessen: `saveSignalsFromDeps()` wandert von *einmal bei der Konstruktion* an den *Anfang jedes Laufs*, derselbe Zeitpunkt, an dem ein dynamischer Effect durch erneutes Lesen wieder abonniert. Bilanz mit Fix 4 / 2 / **4** gegen 4 / 2 / **3** auf `HEAD`, spaltengleich mit dem dynamischen Effect. Keine Breaking Change, rein additiv. Dazu ein `destroyed`-Guard in `saveSignalsFromDeps()` — ohne ihn hinterlässt eine nach dem Detach zerstörte Dependency `effects 1 | sigQueue 1 | dstQueue 1` statt dreimal 0.
  **Die Pause bleibt eine Pause:** nach `off()` erreicht ein Write den Effect nicht, erst der nächste von anderer Seite ausgelöste Lauf meldet neu an. Der Effect, dessen **einzige** Dependency detacht wird, hat gar keinen nächsten Lauf — `hasNoLiveSignals()` greift, `destroyWhenUntriggerable()` zerstört ihn. Er ist nicht taub, er ist tot, auf dem dafür vorgesehenen Weg. Zwei aufeinanderfolgende `off()` sind symmetrisch (2 → 1 → 2 → 1 → 2).
  Runde 1 schloss zwei Lücken: die Reihenfolge, die der Kommentar ausführlich begründet (Wiederanmeldung **vor** dem Callback, damit ein werfender Callback den Effect nicht seine Subscriptions kostet), war von keinem Test gepinnt — verschob man die Zeile hinter `storeCleanupCallback()`, blieben **444 von 444 Tests grün**, während BUG-003 für jeden deterministisch werfenden Static-Deps-Effect zurückkehrte. Und der Guard verbessert nebenbei den Konstruktionsfall, ohne dass das irgendwo stand: `createEffect(cb, [bereitsZerstört, lebend])` abonnierte auf `HEAD` **beide** und überlebte das spätere `lebend.destroy()` als taube Hülle mit zwei unlöschbaren Subscriptions.
  Verify selbst gelaufen: `pnpm world` Exit 0, 42 Dateien / **445 Tests** (Baseline 439). `EffectImpl.ts` 98,11 / 96,07 / 96,66 / 99. **Kein bestehender Test musste nachziehen** — null Löschungen in beiden Spec-Dateien. Die Querbezug-Zeile aus Schritt 5, die für Sprint 2 eine Nachführung der `SignalGroup.off()`-Tests angekündigt hatte, ist damit eingelöst: null Nachführungen in Paket 10 wie in Paket 11.
- Beobachtbare Verhaltensänderung (im CHANGELOG festgehalten): eine zerstörte Dependency wird jetzt übersprungen, wenn die deklarierte Menge abonniert wird — bei der Konstruktion wie bei jedem Lauf.
- Nebenbefunde:
  - `src/EffectImpl.ts` wird ab hier von keinem weiteren Paket dieses Laufs angefasst.
  - Laufzeitkosten: `saveSignalsFromDeps()` bei jedem Lauf kostet auf dem Rerun-Pfad **+55 %** (156 → 240 ns bei drei Deps und leerem Callback, ~28 ns pro Dependency und Lauf). Irrelevant, sobald der Callback etwas tut. Kein Benchmark in `bench/` benutzt `dependencies`, der informative CI-Bench zeigt das also nie.
  - `#trackedReads` bekommt durch den neuen Aufruf einen zweiten Schreiber. Beweisbar folgenlos, weil `#dependencies` genau einmal zugewiesen wird und eine Instanz lebenslang denselben Zweig nimmt — die beiden Leser liegen im anderen. Wer den Zähler künftig zweigübergreifend auswertet, muss das wissen.
- **Bereich enger als im Kopf angekündigt** (2026-08-07, Ergebnis des Abgleichs): `src/SignalGroup.ts` wird **nicht** angefasst. `off()` bleibt Zeile für Zeile, wie Paket 2 es hinterlassen hat — samt seiner acht Sammelstellen. Der Fix sitzt allein in `src/EffectImpl.ts`; dazu Specs, Doku, CHANGELOG.
- Dateien: `src/EffectImpl.ts`, `src/SignalGroup.off.spec.ts`, `docs/api.md`, `docs/recipes.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Alle Zahlen unten sind am 2026-08-07 gegen `dcfaa27` selbst gemessen: die Reproduktion und die beiden verworfenen Varianten gegen ein frisch übersetztes `lib/` (Skripte im Scratchpad), der fertige Fix als Patch in `src/EffectImpl.ts` mit anschließendem `pnpm test` und `git checkout`. Der Arbeitsbaum ist danach sauber; im Repo steht nur diese Datei.

  - **Reproduktion** (Gruppensignal `a` + gruppenfremdes `b`, ein statischer und ein dynamischer Effect auf beiden): `a.set(3): static 0 dyn 1` — beide blind direkt nach `off()`; `b.set(11): static 1 dyn 2` — beide laufen über die überlebende Dependency; `a.set(4): static 1 dyn 3` — nur der dynamische hat sich erholt. Subscriptions auf `globalSignalQueue`: 4 vor `off()`, 2 danach, **3** nach dem Rerun — die vierte kommt nie zurück. Eins zu eins die Evidenz des Audits.
  - **Paket 9 und 10 haben die Lage nicht verändert.** Paket 9 hat den `hasStaticDeps()`-Zweig in `run()` ausdrücklich unberührt gelassen, Paket 10 nur `[RECALL]`. `saveSignalsFromDeps()` und der Soft-Detach-Zweig stehen unverändert da, wo das Audit sie beschreibt.

  **A — die Semantik: welche »Pause« hergestellt wird**

  1. **Ein `SignalGroup.on()` existiert nicht.** Die Doku nennt `off()` eine Pause (`docs/recipes.md:445` »Pausing a SignalGroup without destroying it«), es gibt aber keine Gegenoperation, die etwas wieder anmeldet — `runEffects()` läuft nur über *attachte* Effects, und die zerstört `off()` ohnehin. Die Fortsetzung ist beim dynamischen Effect ein Nebeneffekt seines nächsten Laufs: der Callback liest das Signal wieder, `whenSignalIsRead()` abonniert neu. Getestet ist genau das in `src/SignalGroup.off.spec.ts:224` (`external effect with mixed deps survives off(); group signal re-subscribes on rerun`), inklusive der Zwischenstufe »`groupSig.set(10)` → `runs` bleibt 1«.
  2. **Also wird der statische Effect an denselben Zeitpunkt gehängt: den nächsten Lauf.** `saveSignalsFromDeps()` wandert von »einmal bei der Konstruktion« zu »am Anfang jedes Laufs«. Die Wirkung von `off()` bleibt vollständig erhalten — der Effect verliert die Subscription, verpasst jeden Write auf das detachte Signal, bis ihn eine andere Dependency weckt, und meldet sich erst dann wieder an. Gemessen mit dem Fix: `a.set(3): static 0` (Pause hält), `b.set(11): static 1`, `a.set(4): static 2` (erholt), Subscriptions 4 → 2 → **4**. Spaltengleich mit dem dynamischen Effect.
  3. **Die Empfehlung des Audits wird nicht umgesetzt.** »Im Soft-Detach-Zweig `saveSignalsFromDeps()` erneut ausführen« ist gebaut und gemessen worden und ist eine Breaking Change über das Finding hinaus, in zwei Punkten:
     - `off()` wird für Static-Deps-Effects **wirkungslos**. Gemessen: `a.set(3): static 1 dyn 1` — der statische Effect verpasst nicht einen einzigen Write, während der dynamische die dokumentierte Pause erlebt. Aus der Einbahnstraße würde eine Sonderregel, keine Pause.
     - Der Effect, dessen **einzige** Dependency ein Gruppensignal ist, wird nicht mehr zerstört. Gemessen: `effects before off: 3 after off: 3` statt `3 → 2`. Das kippt die Zusage aus `docs/api.md:503` / `docs/recipes.md:470-473` (»An external effect is destroyed automatically as soon as no live dependency is left«) und den Test `external effect with only group signal as dep is destroyed by off()` (`SignalGroup.off.spec.ts:165`) — er ist dynamisch formuliert und bliebe grün, die Zusage wäre trotzdem nur noch die halbe.

     Deshalb Variante 2. Sie ist additiv: kein bestehendes Verhalten kehrt sich um, ein bisher fehlendes kommt dazu.

  **B — der Fix, zwei Stellen in `src/EffectImpl.ts`**

  4. `saveSignalsFromDeps()` (heute Zeile 341-345) bekommt einen Guard gegen zerstörte Dependencies und die JSDoc, die erklärt, warum die Methode jetzt zweimal läuft:
     ```ts
     /**
      * (Re-)declare the static dependency set.
      *
      * Called once at construction and again at the top of every run. The
      * second call is what makes `SignalGroup.off()` a pause rather than a
      * one-way door for a static-deps effect: the soft-detach drops the
      * subscription, and the effect's next run puts it back — the same moment
      * a dynamic effect re-subscribes, and by the same trigger, except that
      * this one re-declares where the other re-reads (BUG-003).
      *
      * A destroyed dependency is skipped. `whenSignalIsRead()` cannot tell the
      * difference, but the dynamic path can and does — `signalReader` reports
      * a read only while the signal is alive (`createSignal.ts`). Without the
      * same guard here, a dependency that was soft-detached and *then*
      * destroyed would be re-subscribed on the next run: the effect stopped
      * listening for that signal's destruction when it detached, so it never
      * heard it die. That subscription is unremovable short of `destroy()` —
      * `globalDestroySignalQueue` fires once per signal and already has — and
      * it keeps `hasNoLiveSignals()` false forever, so the effect no longer
      * notices when its last *live* dependency goes.
      */
     private saveSignalsFromDeps() {
       for (const sig of this.#dependencies!) {
         const signal = signalImpl(sig);
         if (signal.destroyed) continue;
         this.whenSignalIsRead(signal.id);
       }
     }
     ```
     Der Guard ist nicht kosmetisch, er ist gemessen. Ohne ihn, mit sonst identischem Fix: `off()` → `groupSig.destroy()` → `otherSig.set()` → `otherSig.destroy()` hinterlässt `effects 1 | sigQueue 1 | dstQueue 1` statt `0 | 0 | 0` — ein tauber Effect samt zwei unlöschbaren Subscriptions, der in jedem `afterEach` mit `assertEffectsCount(0)` auffliegt. Mit Guard: `0 | 0 | 0`, identisch zum heutigen Stand.
  5. Der `hasStaticDeps()`-Zweig in `run()` (heute Zeile 455-456) bekommt genau eine Zeile davor:
     ```ts
     if (this.hasStaticDeps()) {
       // Re-declare before the callback, not after: a callback that throws
       // must not cost the effect its subscriptions — the same reason the
       // dynamic branch prunes in a `finally` (BUG-006). Idempotent, because
       // `whenSignalIsRead()` subscribes only to ids it does not already
       // hold, so an ordinary rerun pays one Set lookup per declared
       // dependency and changes nothing. A run re-entered from inside this
       // effect's own callback finds `#suppressAutoTracking` set and
       // re-declares nothing — harmless, the outer run did it already.
       this.saveSignalsFromDeps();
       this.storeCleanupCallback(this.runWithoutAutoTracking(), generation);
     }
     ```
  6. **Mehr ist es nicht.** Kein neues Feld, keine neue Methode (die Funktionsschwelle von `EffectImpl.ts` hat laut Paket 5 keine Luft — sie wird nicht angerührt: 96,66 % vor und nach dem Fix), kein Eingriff in `[$destroySignal]`, keine Zeile in `src/SignalGroup.ts`.

  **C — was dadurch mit Paket 10 *nicht* passiert**

  7. Der Querbezug warnt: der Soft-Detach-Pfad läuft ungeschützt in der Zustellschleife der Destroy-Queue, ein werfender Schritt dort lässt die folgenden Abonnenten desselben Signals stehen. Weil der Fix in `run()` sitzt und nicht im `{detach: true}`-Zweig, **kommt in dieser Schleife kein einziges neues Statement dazu**. Es entsteht keine neunte Sammelstelle in `SignalGroup.off()`, und die acht Tests, die Paket 2 dafür gebaut hat, bleiben unberührt.
  8. Zur Vollständigkeit, weil die Frage sonst wiederkommt: `saveSignalsFromDeps()` **kann gar nicht werfen**. `signalImpl(sig)` ist `sig?.[$signal]` (`src/signal-core.ts:92-94`), `.destroyed` und `.id` sind einfache Property-Reads, `destroySignal()` lässt `$signal` an Ort und Stelle und setzt nur das Flag, und `#dependencies` ist nach dem Konstruktor unveränderlich — ein Effect, dessen Dependency kein Signal ist, wirft bereits beim Konstruieren. Die einzige Fremdcode-Stelle ist `on()`/`once()` von eventize auf einer lebenden Queue.
  9. Umgekehrt gilt: der neue Aufruf liegt jetzt **innerhalb** des Isolationsrahmens aus Paket 10, weil `run()` bei einer Zustellung über `[RECALL]` läuft. Ein hypothetischer Fehler von dort würde also gesammelt und nach der Zustellung geworfen — dasselbe Regime wie für den Callback. Bei einem direkten `effect.run()` kommt er beim Aufrufer an. Beides ist das gewünschte Verhalten, ohne dass dafür etwas zu tun wäre.
  10. Die Zusage aus dem Paket-9-Querbezug hält und wird mitgetestet: `whenSignalIsRead()` ist nicht quiet-gated, die Wiederanmeldung greift also auch in einem `beQuiet()`-Frame. Gemessen mit `{autorun: false}` + `beQuiet(() => eff.run())` nach einem `off()`: der Lauf im Quiet-Frame meldet an, ein anschließendes `a.set(3)` setzt `shouldRun`, der nächste `run()` führt aus. Ohne Fix bleibt er stumm.

  **D — die Tests, rot zuerst** (alle vier in `src/SignalGroup.off.spec.ts`, direkt hinter `external effect with mixed deps survives off(); group signal re-subscribes on rerun` bei Zeile 224, damit das dynamische und das statische Paar nebeneinander stehen)

  11. **Test 1 — der eigentliche Regressionstest.** Gegen `HEAD` rot an der letzten Aussage (`runs` bleibt 2 statt 3, Subscriptions bleiben bei `baseline + 1`), grün mit Schritt 5:
      ```ts
      it('static-deps effect with mixed deps survives off() and re-declares its deps on the next run (BUG-003)', () => {
        const host = {};
        const group = SignalGroup.findOrCreate(host);

        const sigQueueBaseline = getSubscriptionCount(globalSignalQueue);

        const groupSig = createSignal(0, {attach: host});
        const otherSig = createSignal(0); // NOT attached

        let runs = 0;
        let lastSeen = 0;
        // Static deps: the reads inside the callback subscribe to nothing —
        // only the two declared signals can ever trigger this effect.
        createEffect(
          () => {
            runs += 1;
            lastSeen = groupSig.get() + otherSig.get();
          },
          [groupSig, otherSig],
        );

        // Static deps do not auto-run on creation, but they do subscribe.
        expect(runs).toBe(0);
        expect(getSubscriptionCount(globalSignalQueue)).toBe(
          sigQueueBaseline + 2,
        );

        groupSig.set(1);
        expect(runs).toBe(1);

        group.off();

        assertEffectsCount(1, 'static-deps effect survives off()');
        expect(getSubscriptionCount(globalSignalQueue)).toBe(
          sigQueueBaseline + 1,
        );

        // The pause holds: the detached signal no longer reaches the effect.
        groupSig.set(10);
        expect(runs).toBe(1);

        // The surviving dependency still does — and that run re-declares the
        // static set, which re-subscribes to the group signal.
        otherSig.set(5);
        expect(runs).toBe(2);
        expect(lastSeen).toBe(15);
        expect(getSubscriptionCount(globalSignalQueue)).toBe(
          sigQueueBaseline + 2,
        );

        // ... so the group signal triggers it again.
        groupSig.set(20);
        expect(runs).toBe(3);
        expect(lastSeen).toBe(25);

        group.clear();
        otherSig.destroy();
        expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline);
      });
      ```
  12. **Test 2 — die Semantik, die nicht gewählt wurde.** Grün gegen `HEAD` und grün nach dem Fix; er fällt genau dann, wenn jemand später doch die Audit-Empfehlung einbaut (gemessen: `assertEffectsCount(0)` schlägt fehl, der Effect überlebt). Ohne diesen Test ist Punkt A.3 eine Behauptung im Plan und sonst nirgends:
      ```ts
      it('static-deps effect whose only dep is a group signal is still destroyed by off() (BUG-003)', () => {
        const host = {};
        const group = SignalGroup.findOrCreate(host);
        const sig = createSignal(0, {attach: host});

        let runs = 0;
        let cleanupCalls = 0;
        createEffect(
          () => {
            runs += 1;
            return () => {
              cleanupCalls += 1;
            };
          },
          [sig],
        );

        sig.set(1);
        expect(runs).toBe(1);

        group.off();

        expect(cleanupCalls).toBe(1);
        assertEffectsCount(0, 'sole static dep detached => effect destroyed');

        // and it stays gone — the detached signal cannot wake it
        sig.set(2);
        expect(runs).toBe(1);

        group.clear();
      });
      ```
  13. **Test 3 — der Guard aus Schritt 4.** Grün gegen `HEAD`, **rot gegen Schritt 5 ohne Schritt 4** (gemessen: `effects 1 | sigQueue 1 | dstQueue 1` statt dreimal 0), grün mit beiden. Er ist der Grund, das Paket in dieser Reihenfolge zu implementieren: erst Test 1 rot sehen, Schritt 5 einbauen, dann Test 3 rot sehen, Schritt 4 einbauen:
      ```ts
      it('a static dep destroyed while detached is not re-subscribed on the next run (BUG-003)', () => {
        const host = {};
        const group = SignalGroup.findOrCreate(host);

        const sigQueueBaseline = getSubscriptionCount(globalSignalQueue);
        const destroyQueueBaseline = getSubscriptionCount(
          globalDestroySignalQueue,
        );

        const groupSig = createSignal(0, {attach: host});
        const otherSig = createSignal(0);

        let runs = 0;
        createEffect(
          () => {
            runs += 1;
          },
          [groupSig, otherSig],
        );

        group.off();

        // The effect dropped its `once` on the destroy queue when it
        // detached, so it never hears this one.
        groupSig.destroy();

        otherSig.set(1);
        expect(runs).toBe(1);

        // The destroyed dependency was skipped — only otherSig is subscribed.
        expect(getSubscriptionCount(globalSignalQueue)).toBe(
          sigQueueBaseline + 1,
        );

        // ... so losing the last live dependency still ends the effect.
        otherSig.destroy();
        assertEffectsCount(0, 'last live dep destroyed => effect destroyed');
        expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline);
        expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
          destroyQueueBaseline,
        );

        group.clear();
      });
      ```
  14. **Test 4 — die Wiederanmeldung im Quiet-Frame.** Pinnt die Zusage aus dem Paket-9-Querbezug an eine Assertion. Braucht einen zusätzlichen Import (`import {beQuiet} from './bequiet.js';`) in `SignalGroup.off.spec.ts`:
      ```ts
      it('the re-declaration works inside a beQuiet() frame (BUG-003)', () => {
        const host = {};
        const group = SignalGroup.findOrCreate(host);
        const groupSig = createSignal(0, {attach: host});
        const otherSig = createSignal(0);

        let runs = 0;
        const eff = createEffect(
          () => {
            runs += 1;
          },
          [groupSig, otherSig],
          {autorun: false},
        );

        group.off();

        groupSig.set(1);
        expect(runs).toBe(0);

        // Flags shouldRun without running (autorun: false), then run the
        // whole thing inside a quiet frame. `whenSignalIsRead()` is not
        // quiet-gated, so the declared set is re-declared here.
        otherSig.set(1);
        beQuiet(() => {
          eff.run();
        });
        expect(runs).toBe(1);

        // The group signal reaches the effect again.
        groupSig.set(2);
        eff.run();
        expect(runs).toBe(2);

        eff.destroy();
        group.clear();
        otherSig.destroy();
      });
      ```
  15. Bilanzhelfer wie in `unsubscribeEffect.spec.ts` und im Nachbartest `restores subscription baselines on the global signal queues` (Zeile 369): `getSubscriptionCount(queue)` direkt aus `@spearwolf/eventize` (die Datei importiert es bereits in Zeile 1), dazu `assertEffectsCount` aus `src/assert-helpers.ts`. `globalDestroySignalQueue` ist ebenfalls schon importiert. Die Baselines werden **vor** dem ersten `createSignal({attach})` genommen, sonst zählt der gruppeneigene Destroy-Hook mit, den `off()` bewusst behält (MEM-002).

  **E — die Doku, in der Reihenfolge aus `CLAUDE.md`**

  16. Source-JSDoc: erledigt in den Schritten 4 und 5.
  17. `docs/api.md`, Abschnitt *Effects* — an den Absatz über die Kurzform und den fehlenden Autorun (Zeile 117-121, endet mit »call `.run()` once manually if you need an initial pass«) zwei Sätze anhängen: dass der deklarierte Satz zu Beginn **jedes** Laufs neu angemeldet wird, eine per `SignalGroup.off()` weggenommene Subscription also mit dem nächsten Lauf des Effects zurückkommt — genau dann, wann ein dynamischer Effect sie durch erneutes Lesen zurückholt; und dass eine zwischenzeitlich **zerstörte** Dependency dabei übersprungen wird, weil ein zerstörtes Signal niemanden mehr weckt.
  18. `docs/api.md`, Instanztabelle *SignalGroup*, Zeile `off()` (503) — den Halbsatz »drop all external subscriptions on group signals« um den Nachsatz ergänzen, dass ein Effect, der die Detach überlebt, mit seinem nächsten Lauf wieder abonniert, statische wie dynamische Deps.
  19. `docs/recipes.md`, Abschnitt `## Pausing a SignalGroup without destroying it (off())`, der dritte Aufzählungspunkt (Zeile 470-474) — der Klammerzusatz »(dynamic-deps self-healing)« ist nach diesem Paket falsch und wird ersetzt. Neu, sinngemäß: eine Dependency außerhalb der Gruppe lässt den Effect überleben, und sein **nächster Lauf** abonniert das Gruppensignal wieder — ein dynamischer Effect, indem er es erneut liest, ein Static-Deps-Effect, indem er seine `dependencies` erneut anmeldet. Bis zu diesem Lauf bleibt er für das detachte Signal taub; genau das macht `off()` zur Pause und nicht zum Kappen. Eine Dependency, die inzwischen zerstört (nicht nur detacht) wurde, kommt in keinem der beiden Fälle zurück.
  20. `docs/cheat-sheet.md` bleibt unberührt: die einzige `off()`-Zeile (138) ist ein Einzeiler über das, was `off()` zerstört, und wird von diesem Paket nicht falsch. Ein zweiter Kommentar dort wäre die Ausnahme, nicht die Regel — die Detailaussage steht in `recipes.md`.
  21. `skills/using-signalize/references/pitfalls.md`, Punkt **7** (Zeile 21) — einen Satz anhängen: der deklarierte Satz wird bei jedem Lauf neu angemeldet, ein Static-Deps-Effect, der ein `SignalGroup.off()` überlebt, hört das detachte Signal ab seinem nächsten Lauf wieder. `SKILL.md` Punkt 3 und `references/api.md` bleiben unberührt — beide sagen, was Static Deps *abschalten*, und das ändert sich nicht.
  22. `CHANGELOG.md`, unter `## Unreleased` → `### Bug Fixes`, ans Ende, englisch, ein Fakt pro Zeile:
      - dass ein Effect mit statischen Dependencies, der ein `SignalGroup.off()` überlebt, sein detachtes Gruppensignal ab seinem nächsten Lauf wieder hört. Er meldet seinen deklarierten Satz jetzt zu Beginn jedes Laufs an statt nur bei der Konstruktion; bisher blieb er für dieses Signal dauerhaft taub, weil sein Callback ohne Auto-Tracking läuft und nichts nachträglich anmeldet (BUG-003);
      - dass `off()` dabei eine Pause bleibt: bis zu diesem nächsten Lauf verpasst der Effect jeden Write auf das detachte Signal, und ein Effect, dessen einzige Dependency ein Gruppensignal war, wird weiterhin von `off()` zerstört (BUG-003);
      - dass eine zerstörte Dependency bei dieser Wiederanmeldung übersprungen wird — ein Signal, das nach dem Detach zerstört wurde, wird nicht erneut abonniert (BUG-003).
  23. `README.md` und `AGENTS.md` bleiben unberührt: es ändert sich kein Export, keine Signatur und keine Datei in der Dateikarte.

  **F — Coverage** (gemessen, `pnpm test` gegen `dcfaa27` und gegen denselben Baum mit dem Fix, ohne die neuen Tests)

  24. Baseline: gesamt 99,06 / 94,28 / 99,52 / 99,61, `EffectImpl.ts` 98,07 / 96 / 96,66 / 98,98, ungedeckt `873-874`. Mit dem Fix und **ohne** neue Tests: 98,97 / 94,09 / 99,52 / 99,61, `EffectImpl.ts` 97,64 / 95,09 / 96,66 / 99, ungedeckt `876-877`. Der Fix bringt vier Statements (drei davon sofort gedeckt) und zwei Zweige (einer gedeckt) mit; ungedeckt bleibt allein der `continue` aus Schritt 4 samt seinem Zweig. Selbst in diesem Zwischenzustand hält jede Schwelle aus Paket 5 (Stufe 1 für `EffectImpl.ts`: ≥97 / ≥85 / ≥96 / ≥98). **Funktionen bewegen sich nicht** — 96,66 % vorher wie nachher, die Stelle ohne Luft wird nicht berührt.
  25. Test 3 aus Schritt 13 deckt den `continue` und seinen Zweig; damit steht `EffectImpl.ts` wieder mindestens auf dem Ausgangsstand. Keine Datei muss aus Stufe 2 oder 3 in Stufe 1 wandern. `signal-core.ts` wird nicht angefasst — die engste Schwelle des Laufs (12 von 14 Zweigen) bleibt unberührt.

  **G — welche bestehenden Tests nachziehen müssen**

  26. **Keiner.** Der Fix ist am 2026-08-07 vollständig in `src/EffectImpl.ts` eingebaut und `pnpm test` gefahren worden: **439 von 439 grün**, dieselbe Zahl wie die Baseline aus Paket 10, kein einziger Test musste angefasst werden. Namentlich geprüft, weil der Auftrag sie nennt bzw. weil sie plausible Kandidaten wären:
      - `src/SignalGroup.off.spec.ts` — alle `it`-Blöcke grün. (**Korrektur 2026-08-07:** es waren 15, nicht 16; nach dem Paket 20. Und die acht Sammelstellen-Tests aus Paket 2 liegen in `src/SignalGroup.teardown.spec.ts`, Describe »every teardown step collects instead of aborting«, nicht in dieser Datei — sie laufen ebenfalls grün, aber die Zuordnung im Satz unten ist falsch.) Der Nachbar `external effect with mixed deps survives off(); group signal re-subscribes on rerun` (224) ist dynamisch und bleibt Wort für Wort gültig; `external effect with only group signal as dep is destroyed by off()` (165) und `external effect is destroyed by off() even after one dep was destroyed first (MEM-006)` (191) sind ebenfalls dynamisch. Die acht Sammelstellen-Tests aus Paket 2 laufen gegen eine unveränderte `SignalGroup.off()`. Die im Querbezug angekündigte Nachführung von Sprint-1-Tests **tritt für BUG-003 nicht ein**.
      - `src/nested-effects-staticDeps.spec.ts` — alle grün (**Korrektur 2026-08-07:** es sind 9 `it`-Blöcke, nicht elf), insbesondere `still does not auto-track signals read in the callback (pitfall 7)` (101) und `keeps auto-tracking off after a re-entrant run returns (pitfall 7)` (124). Die neue Anmeldung liegt außerhalb des Suppression-Fensters, meldet aber ausschließlich Signale aus `#dependencies` an — sie trackt keinen einzigen Read. Die Datei kennt kein `off()`.
      - `src/effects-and-groups.spec.ts` — zwei `it`-Blöcke, keiner benutzt `off()`, beide grün.
      - `src/ordering.property.spec.ts` — alle sechs Properties grün. Die Suite benutzt weder Static Deps noch `SignalGroup`; das Reihenfolge-Netz aus Paket 7 hält.
      - `src/EffectImpl.run.spec.ts` — grün, inklusive des BUG-006-Tests, den Paket 10 als Fußangel führt.
- Verify: `pnpm world` (enthält seit Paket 5/6 `test:gc`, `test:smoke` und `checkPkgTypes`). Zusätzlich vor dem Commit: `pnpm test -- src/SignalGroup.off.spec.ts` und `pnpm test -- src/nested-effects-staticDeps.spec.ts` einzeln grün, und die Gesamtzahl muss **443** lauten (439 aus Paket 10 plus die vier neuen). Weicht sie ab, fehlt ein Test oder es ist einer stillschweigend übersprungen worden.
- Commit: `fix(effect): re-declare static deps on every run so off() pauses instead of deafens (BUG-003)`
- Abgleich (2026-08-07): BUG-003 unverändert vorhanden und selbst reproduziert (`a.set(4): static 1 dyn 3` — nur der dynamische Effect erholt sich; Subscriptions auf `globalSignalQueue` 4 → 2 → 3). **Alle vier Fundstellen bestehen, alle vier sind verschoben** — die Symbole stehen nach den Paketen 8 bis 10 auf: `[$destroySignal]()` **606-636** (Audit `:536-554`), der `{detach: true}`-Zweig darin **609-624**; `saveSignalsFromDeps()` **341-345** (Audit `:331-335`), `hasStaticDeps()` **337**; der Static-Deps-Zweig in `createEffect()` **395-401** (Audit `:385-388`); die Soft-Detach-Schleife in `SignalGroup.off()` **753-766** (Audit `:741-749`, verschoben durch die Fehlersammlung aus Paket 2). `src/EffectImpl.ts` ist 945 Zeilen lang; der Static-Deps-Zweig in `run()` steht auf 455-456. Weder Paket 9 noch Paket 10 haben die Lage entschärft: Paket 9 hat den `hasStaticDeps()`-Zweig ausdrücklich unberührt gelassen, Paket 10 nur `[RECALL]`. **Abweichung von der Empfehlung des Audits**, begründet und gemessen in Schritt A.3: die Wiederanmeldung sitzt in `run()`, nicht im Soft-Detach-Zweig, weil letzteres `off()` für Static-Deps-Effects wirkungslos machen und die dokumentierte Selbstzerstörung bei alleiniger Gruppen-Dependency aufheben würde. **Bereich enger als angekündigt**: `src/SignalGroup.ts` wird nicht angefasst.

**BUG-003 · high · src/EffectImpl.ts:536-554 (jetzt :606-636) · src/EffectImpl.ts:331-335 (jetzt :341-345) · src/EffectImpl.ts:385-388 (jetzt :395-401) · src/SignalGroup.ts:741-749 (jetzt :753-766)** — Static-Deps-Effects nach einem Soft-Detach wieder anmelden
`SignalGroup.off()` emittiert `{detach: true}`, und der Soft-Detach-Zweig kommentiert, ein späteres `whenSignalIsRead()` melde sauber wieder an. Das gilt nur für dynamisch getrackte Effects. Ein Static-Deps-Effect meldet sich ausschließlich über `saveSignalsFromDeps()` an, und das ruft `createEffect()` genau einmal bei der Konstruktion; sein Callback läuft mit `#suppressAutoTracking`, kein Read registriert also etwas nach. Hat der Effect eine zweite, gruppenfremde Dependency, überlebt er den Detach und läuft weiter — für den detachten Signal aber für den Rest seines Lebens taub. Die Doku verkauft `off()` als Pause; für Static-Deps-Abonnenten ist es eine Einbahnstraße.
Empfehlung: Im Soft-Detach-Zweig `saveSignalsFromDeps()` erneut ausführen (oder gezielt die betroffene ID neu abonnieren), wenn `hasStaticDeps()` gilt.
Evidence (2026-08-07 selbst reproduziert): `11b: signalQueue subs  before off: 4  after off: 2  after a rerun: 3` / `11b: a.set(3): static 0 dyn 1   <- beide blind direkt nach off()` / `11b: b.set(11): static 1 dyn 2  <- beide laufen über die überlebende Dep` / `11b: a.set(4): static 1 dyn 3   <- nur der dynamische hat sich erholt`.

#### [x] 12. Zwei Einzeiler: der Sweep und der stille Rückgabewert
- Findings: BUG-009 (low), BUG-010 (low)
- Ziel: Das statische `clear()` verliert keine während des Sweeps entstandene Gruppe mehr — sie bleibt gezählt, finalisierbar und für den nächsten Sweep erreichbar —, und `beQuiet()` gibt zurück, was seine Action liefert.
- Bereich: `src/SignalGroup.ts`, `src/bequiet.ts`, `smoke/`, Specs, `docs/`, `skills/`
- Hängt ab von: —
- Modell: mittlere Stufe. Beide Fixes sind je eine Zeile, beide Varianten sind vor der Planung gebaut und gemessen; das Restrisiko liegt in der Doku-Reihenfolge und in der Testplatzierung, nicht im Code.
- Hash: `6f211d7`
- Ergebnis (2026-08-07): BUG-009 und BUG-010 behoben, **keine Review-Runde nötig** — das Review meldet »Qualität: keine«. BUG-009 wurde gestrichen statt auf den Snapshot beschränkt: die Snapshot-Variante trifft eine leere Menge, weil jede gesweepte Gruppe sich vor ihrem eigenen `throwCollectedErrors()` selbst austrägt, und ihre einzige Wirkung wäre schädlich gewesen. Die gewählte Semantik ist vom Reviewer in allen drei Teilen nachgemessen: eine während des Sweeps entstandene Gruppe wird gezählt, von `findOrCreate()` als dieselbe Instanz herausgegeben, und ihr FinalizationRegistry-Callback ist kein No-op mehr. **Ein Endlos-Sweep ist ausgeschlossen** — der Snapshot `[...allGroups]` ist ein fixiertes Array, eine im Sweep geborene Gruppe läuft nie in denselben Sweep hinein; ein rekursiv nachlegender DESTROY-Listener terminiert sofort.
  BUG-010 ist rückwärtskompatibel, von Planer und Reviewer unabhängig über `tsc --noEmit` gegen einen `git worktree` von `HEAD` belegt: dieselben drei vorbestehenden Meldungen, alle elf `beQuiet`-Aufrufer unberührt. Zwei benannte Typränder: `beQuiet(async …)` kompiliert nicht mehr — das ist der Zweck der `NonThenable`-Verengung und zeigt einen bestehenden Fehler an, weil die stille Zone heute am ersten `await` abbricht; und `beQuiet(() => undefined)` scheitert mit TS7011, was `hibernate()` identisch trifft.
  Verify selbst gelaufen: `pnpm world` Exit 0, 42 Dateien / **448 Tests** (Baseline 445), Smoke 4/4. `SignalGroup.ts` 97,8 / 87,71 / 100 / 99,22, `bequiet.ts` 100 in allen vier — Stufe 3 hält ohne Luftverbrauch.
- **Nebenbefund von Tragweite, für den Abschluss vorgemerkt:** **Nichts im Projekt typprüft die Specs.** `tsconfig.lib.json` schließt `src/**/*.spec.ts` aus, `pnpm check` ist Biome, Vitest läuft ohne `typecheck`-Option. Ein `@ts-expect-error` in einer Spec ist damit Dekoration — das in `src/batch.spec.ts:223` etwa prüft nichts. Deshalb liegt die Typzusicherung für BUG-010 in `smoke/dist-smoke.test.ts`, dem einzigen Fixture, den `tsc` mit `noEmitOnError` gegen die ausgelieferten `.d.ts` übersetzt; der Reviewer hat gegengeprüft, dass sie dort greift (alte Signatur → `test:smoke` bricht mit TS2322 und TS2578 ab, bevor ein Test läuft). Kein Finding des Audits, aber die Sorte Lücke, die dieser Lauf sonst überall geschlossen hat.
- Dateien: `src/SignalGroup.ts`, `src/bequiet.ts`, `src/SignalGroup.teardown.spec.ts`, `src/bequiet.spec.ts`, `smoke/dist-smoke.test.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Alle Zahlen unten sind am 2026-08-07 gegen `07b712a` selbst gemessen: die Reproduktionen gegen das frisch übersetzte `lib/`, die beiden BUG-009-Varianten gegen eine **Kopie** von `lib/` im Scratchpad (Zeile herausgepatcht), die Typmatrix zu BUG-010 gegen eine Kopie von `src/` mit `tsc 7.0.2` und der Projekt-`tsconfig`. Am Projektcode ist nichts angefasst worden; im Repo steht nur diese Datei.

  - **Reproduktion BUG-009** (Gruppe A mit einem Signal, DESTROY-Listener erzeugt während des Sweeps Gruppe B mit einem Signal): `vor statischem clear(): groups = 1 | signals = 1` → `nach statischem clear(): groups = 0 | signals = 1`, `b in store: true`, `findOrCreate(hostB) === b`, `memberCounts {signals: 1, …}`. Dazu die beiden Folgeschäden, die das Audit nennt, ebenfalls gemessen: `clearGroupFromFinalizer(b)` lässt `memberCounts` unverändert (dauerhafter No-op), und ein **zweites** `SignalGroup.clear()` erreicht die Gruppe nicht mehr (`signals` bleibt 1). Nur der explizite Weg räumt noch auf (`b.clear()` → `signals = 0`).
  - **Reproduktion BUG-010**: `docs/recipes.md:384  const peek = beQuiet(() => b.get()) → undefined`, während `hibernate(() => b.get()) → 23` liefert. Eins zu eins die Aussage des Findings.

  **A — BUG-009: welche der beiden Varianten**

  1. **Was das statische `clear()` heute tut** (`src/SignalGroup.ts:220-232`): Snapshot über `allGroups`, `group.clear()` je Eintrag in einem `try`, danach `allGroups.clear()`, danach `throwCollectedErrors()`. Die Instanz-`clear()` trägt sich in Zeile 867 selbst aus `allGroups` aus — **vor** dem `throwCollectedErrors()` ihres eigenen Rumpfes (872). Eine Gruppe, deren Teardown wirft, ist also genauso ausgetragen wie eine, die sauber durchläuft. Der Snapshot ist danach restlos abgearbeitet; `allGroups.clear()` sieht nur noch, was **während** des Sweeps dazugekommen ist.
  2. **Gewählt: die Zeile ersatzlos streichen.** Die Snapshot-Variante wäre `for (const g of snapshot) allGroups.delete(g)` — und trifft nachweislich eine leere Menge, weil jeder gesweepte Eintrag sich bereits selbst ausgetragen hat, im Erfolgs- wie im Fehlerfall. Sie wäre also toter Code mit einer Ausnahme, und ausgerechnet die ist schädlich: sie würde eine Gruppe, deren `clear()` **vor** Zeile 867 abbricht (dazu Schritt 6), aus der Registry werfen, obwohl sie halb abgebaut weiterlebt — genau die Klasse von Schaden, die BUG-009 beschreibt. Streichen ist die kleinere und die richtige Änderung.
  3. **Was mit einer während des Sweeps entstandenen Gruppe passieren soll: überleben, vollständig registriert.** Sie ist kein Überbleibsel, sondern neuer Zustand, den ein Listener bewusst aufgebaut hat, nachdem der Abbau seines Erzeugers begonnen hatte — `store` gibt sie ohnehin weiter heraus, und diese Entscheidung ist mit `findOrCreate()` nicht verhandelbar. Also wird sie gezählt, ist finalisierbar und wird vom nächsten Sweep erwischt. Die Alternative — bis `allGroups` leer ist im Kreis sweepen — ist ausdrücklich **nicht** gewollt: ein Listener, der bei jedem Abbau eine Gruppe erzeugt, hätte damit eine Endlosschleife statt eines auffälligen Zählerstands. Der Sweep bleibt einmalig und endlich.
  4. **Der Fix** — `src/SignalGroup.ts`, in `static clear()` entfällt Zeile 230, und der Kommentar über der Schleife sagt, warum dort nichts nachläuft:
     ```ts
     static clear() {
       const errors: unknown[] = [];
       // Snapshot — each group.clear() mutates `allGroups`, and it also takes
       // itself out of the set (before its own throw, so a failing teardown
       // deregisters just like a clean one). Nothing sweeps up afterwards: an
       // `allGroups.clear()` here would only ever hit groups created *during*
       // the sweep — by a DESTROY listener — and those are live groups, still
       // in `store` and still handed out by `findOrCreate()`. Wiping them out
       // of the set alone would leave them uncounted by
       // `getSignalGroupsCount()`, out of reach of the next sweep, and with a
       // FinalizationRegistry callback that can never fire again, because it
       // starts with `allGroups.has(group)` (BUG-009). They survive the sweep
       // instead, fully registered. Deliberately no loop-until-empty: a
       // listener that recreates a group on every teardown would turn that
       // into a hang.
       for (const group of [...allGroups]) {
         try {
           group.clear();
         } catch (err) {
           errors.push(err);
         }
       }
       throwCollectedErrors(errors, 'clearing all signal groups');
     }
     ```
  5. **Was sich dadurch *nicht* ändert**, beide gegen HEAD und gegen die gepatchte Kopie gemessen und spaltengleich:
     - **Der gewöhnliche Sweep, auch mit werfender Gruppe**: drei Gruppen, die erste wirft im DESTROY-Listener → `groups = 0 | signals = 0 | Fehler: boom`, vorher wie nachher. Die beiden Tests aus Paket 2 in `src/SignalGroup.teardown.spec.ts:336` und `:382` (»the registry is empty after one sweep«, `expect(getSignalGroupsCount()).toBe(0)`) bleiben grün, weil jede der drei Gruppen sich selbst ausgetragen hat.
     - **Das re-entrante statische `clear()`** (ein DESTROY-Listener ruft `SignalGroup.clear()` erneut auf): `groups = 0 | signals = 0 | store: false,false,false`, vorher wie nachher. Der `BUSY_CLEAR`-Bit lässt die Gruppe, in deren Listener man steckt, im inneren Sweep aus; sie trägt sich beim Verlassen des äußeren Laufs selbst aus. **Achtung bei der Messung:** ein Skript, das mehrere Fälle in einem Prozess prüft, verschleppt das Leck aus Fall 1 in die Folgefälle und erzeugt dort einen Unterschied, den es nicht gibt. Zwischen den Fällen aufräumen und den Restzustand ausgeben.
  6. **Ein Randfall, der bleibt und beim Streichen besser wird**: die Schleife über `#signalDestroySubscriptions.values()` (Zeile 843-847) läuft als einzige Stelle in `clear()` **ohne** `try`. Wirft dort ein eventize-`unsubscribe`, verlässt `clear()` den Rumpf vor Zeile 867 — die Gruppe bleibt halb abgebaut in `allGroups` und in `store`. Ohne die gestrichene Zeile bleibt sie damit zählbar und für den nächsten Sweep erreichbar, statt still aus der Registry zu fallen. Das ist kein Ziel dieses Pakets und bekommt keinen Test; es ist der Grund, warum Variante 2 aus Schritt 2 die schlechtere ist.

  **B — BUG-010: die Signatur**

  7. **Die Vorlagen.** `hibernate<T>(callback: () => T): T` (`src/hibernate.ts:21`) gibt das Ergebnis zurück; `batch<T>(callback: () => NonThenable<T>): void` (`src/batch.ts:131`) verwirft es, weist aber thenable-liefernde Callbacks schon per Typ ab. `NonThenable<T> = T extends PromiseLike<unknown> ? never : T` existiert (`src/types.ts:15`) und hat genau einen Nutzer, `batch()`. Übernommen wird **beides**: der Rückgabewert von `hibernate()`, die Callback-Verengung von `batch()` — so steht es auch wörtlich in der Empfehlung des Audits.
  8. **Der Fix** — `src/bequiet.ts:14`, drei Zeilen, plus JSDoc:
     ```ts
     import type {NonThenable} from './types.js';
     …
     /**
      * …
      * Returns whatever `action` returns — the untracked read is the point of
      * the frame, and throwing its result away made the documented recipe
      * (`const peek = beQuiet(() => b.get())`) silently evaluate to
      * `undefined` (BUG-010). Same shape as `hibernate()`.
      *
      * `action` must be synchronous, and its signature rejects anything typed
      * to return a `Promise`/`PromiseLike` at `tsc` time: the quiet frame is
      * closed by the `finally` below the moment an `async` action returns its
      * pending promise at the first `await`, so every read and write after
      * that point is tracked and loud again — and the promise handed back
      * would resolve outside the frame that appeared to produce it. Unlike
      * `batch()`, there is no runtime check for a duck-typed thenable.
      *
      * @param action - Synchronous function to execute in quiet mode
      * @returns The action's return value
      */
     export function beQuiet<T>(action: () => NonThenable<T>): T {
       g_numberOfBeQuietRequests++;
       try {
         return action();
       } finally {
         g_numberOfBeQuietRequests--;
       }
     }
     ```
     `return action()` braucht **keinen** Cast: `tsc` akzeptiert `NonThenable<T>` als `T`, weil beide Zweige des Conditional (`never` und `T`) nach `T` zuweisbar sind. Gemessen an der `src`-Kopie, keine Fehlermeldung in dieser Datei.
  9. **Rückwärtskompatibilität, gemessen** — und die Entscheidungszeile hält:
     - **Laufzeit**: unverändert. Der Zähler wird in `try`/`finally` gehoben und gesenkt wie bisher; der Rückgabewert wird vor dem `finally` ausgewertet.
     - **`void` → `T`**: kompatibel in jeder geprüften Richtung. Ein Aufrufer, der den Wert ignoriert, kompiliert unverändert; `takesVoid(() => beQuiet(cb))` kompiliert; die Zuweisung an den **alten** Typ `const f: (action: () => any) => void = beQuiet` kompiliert (Rückgabe `T` → `void` ist zulässig, und `() => any` ist nach `() => NonThenable<T>` zuweisbar).
     - **Inferenz**: `T` wird durch das Conditional hindurch korrekt inferiert — `beQuiet(() => n.get())` ist `number`, `beQuiet(() => {})` ist `void`. Belegt über absichtliche Fehlzuweisungen: `Type 'number' is not assignable to type 'string'` bzw. `Type 'void' is not assignable to type 'string'`. Kein `unknown`.
     - **Der Bestand kompiliert unverändert**: `src/` als Kopie, einmal mit und einmal ohne den Fix durch `tsc -p` — beide Male **exakt dieselben drei** (vorbestehenden, von keinem Projektkommando geprüften) Meldungen aus `SignalGroup.teardown.spec.ts:528`, `:739` und `ordering.property.spec.ts:116`. Alle elf `beQuiet`-Aufrufstellen im Repo sind unberührt.
  10. **Zwei Callback-Formen kompilieren nicht mehr**, beide gemessen, beide vertretbar — sie werden im CHANGELOG genannt, nicht verschwiegen:
      - `beQuiet(async () => …)` und alles, was auf `Promise`/`PromiseLike` typisiert zurückgibt: `Argument of type '() => Promise<void>' is not assignable to parameter of type '() => never'`. Das ist der Zweck der Verengung, und es zeigt einen **bestehenden** Fehler am Aufrufort an: gemessen bricht die stille Zone heute mitten im Callback ab — `vor await: isQuiet = true`, `nach await: isQuiet = false`, und der Write nach dem `await` löst den Effect aus (`Effect-Läufe nach dem "quiet" Frame: 1`). Wortgleiches Vorgehen wie bei `batch()`/ASYNC-003.
      - `beQuiet(() => undefined)` und `beQuiet(() => null)`: `TS7011 — Function expression, which lacks return-type annotation, implicitly has an 'any' return type`. Das ist **kein** Effekt von `NonThenable`, sondern von der Generik: `hibernate<T>(cb: () => T): T` verhält sich heute identisch (gegengemessen), die als deckungsgleich benannte Funktion trägt den Zug also längst. Im Repo kommt die Form kein einziges Mal vor, und die Reparatur beim Aufrufer ist `() => { }` bzw. eine Annotation.
  11. **Kein Laufzeit-Guard.** `batch()` wirft zusätzlich `TypeError` bei einem duck-typed Thenable — das gehört zu ASYNC-003, und die `ASYNC-*`-Findings sind vom Nutzer ausdrücklich nicht beauftragt. BUG-010 ist der Rückgabewert; die Typverengung fällt dabei als Nebenprodukt der Empfehlung an, ein neuer Wurf wäre eine eigenständige Verhaltensänderung. Notiert als Nebenbefund.
  12. **Kein Import-Zyklus.** `types.ts` importiert `SignalGroup` als **Wert**, `bequiet.ts` ist heute importfrei, und `EffectImpl.ts` importiert seit Paket 9 `isQuiet` — ein Laufzeit-Import auf `./types.js` würde also `bequiet → types → SignalGroup → EffectImpl → bequiet` schließen, und `rollup.config.mjs` bricht bei `CIRCULAR_DEPENDENCY` ab. `import type` löscht `tsc` restlos: `lib/batch.js` enthält trotz derselben Konstruktion keinen `./types.js`-Import. Also `import type`, wie in `batch.ts:9` — und beim Verify ist `pnpm bundle` (in `pnpm world` enthalten) der Prüfer.

  **C — die Tests, rot zuerst**

  13. **Test 1 und 2 — BUG-009**, beide in `src/SignalGroup.teardown.spec.ts`, direkt hinter `static SignalGroup.clear() reports every failing group, AggregateError for several` (Zeile 382-419), damit die drei Aussagen über den statischen Sweep beieinanderstehen. Die Datei importiert `clearGroupFromFinalizer`, `getSignalGroupsCount`, `DESTROY` und `on` bereits (Zeilen 1-22); nichts kommt hinzu.
      - **Test 1 — die Registry verliert die Gruppe nicht.** `it('static SignalGroup.clear() keeps a group created during the sweep registered (BUG-009)')`: Host A mit angehängtem Signal, `on(groupA, DESTROY, …)` erzeugt `SignalGroup.findOrCreate(hostB)` samt angehängtem Signal, dann `SignalGroup.clear()`. Assertions: `getSignalGroupsCount()` ist `groupsBefore + 1` (HEAD: `groupsBefore`, **rot**); `SignalGroup.get(hostB)` ist dieselbe Instanz; `getGroupMemberCounts(groupB)` zeigt `signals: 1`. Danach ein **zweites** `SignalGroup.clear()` und die zweite rote Aussage: `getSignalsCount()` ist wieder `signalsBefore` und `getSignalGroupsCount()` wieder `groupsBefore` (HEAD: das Signal überlebt). Kein zusätzliches Aufräumen nötig — der zweite Sweep *ist* das Aufräumen, und das `afterEach` der Datei (`SignalGroup.clear()` + `assertSignalsCount(0)`) fängt jeden Rest.
      - **Test 2 — der Backstop lebt wieder.** `it('the FinalizationRegistry backstop still works for a group created during the sweep (BUG-009)')`: derselbe Aufbau, nach dem Sweep `clearGroupFromFinalizer(groupB)` und danach `getGroupMemberCounts(groupB)` gleich `NO_GROUP_MEMBERS` sowie `getSignalsCount()` gleich `signalsBefore`. Auf HEAD ist der Aufruf ein No-op und der Test **rot**. Er pinnt genau die Aussage, die die gestrichene Zeile kaputt gemacht hat: der Guard `if (!allGroups.has(group)) return` (Zeile 47) darf nur »schon aufgeräumt« heißen, nie »aus der Registry gewischt«.
  14. **Test 3 — BUG-010, der Rückgabewert**, in `src/bequiet.spec.ts` (heute ein einziger `it`-Block): `it('returns what the action returns, so an untracked peek is usable (BUG-010)')`. Zwei Signale, ein Effect, der `a` liest und `b` in einem `beQuiet`-Frame liest; der Rückgabewert des Frames wird in einer Variablen festgehalten und assertiert (HEAD: `undefined`, **rot**). Dazu die beiden Aussagen, die der Rückgabewert nicht kaputt machen darf: der Effect läuft bei `setB` **nicht** erneut (der Read bleibt untracked), und der Zähler ist nach dem Frame wieder bei null (`isQuiet()` ist `false`). Aufräumen wie im Nachbartest, das `afterEach` prüft Effekt- und Signalzahl.
  15. **Die Typzusicherung gehört nicht in eine Spec.** Gemessen: **nichts im Projekt typprüft `src/**/*.spec.ts`** — `pnpm compile` nutzt `tsconfig.lib.json` mit `exclude: ["src/**/*.spec.ts"]`, `pnpm check` ist Biome, und Vitest läuft ohne `typecheck`. Ein `// @ts-expect-error` in einer Spec ist Dekoration (das in `batch.spec.ts:223` ebenso). Der eine Ort, an dem `tsc` mit `noEmitOnError` über einen Fixture läuft und in `pnpm world` hängt, ist `smoke/` (Paket 6) — dort gegen die **ausgelieferten** `lib/*.d.ts`. Also ein kleiner Block in `smoke/dist-smoke.test.ts`, im Muster der Zeile 36 (`@ts-expect-error` plus die Begründung, dass `tsc` bei einer nutzlos gewordenen Direktive mit TS2578 abbricht und die Datei dann gar nicht mehr läuft):
      ```ts
      test('the shipped declarations hand back beQuiet()\'s result', () => {
        const sig = createSignal(21);

        // Pins the return type on the shipped `.d.ts`: if `beQuiet()` ever
        // degrades to `void` again, this assignment stops compiling and the
        // smoke suite never runs (BUG-010).
        const peek: number = beQuiet(() => sig.get() * 2);
        assert.equal(peek, 42);

        // @ts-expect-error an async action is rejected by the declarations —
        // the quiet frame closes at the first `await`. If that narrowing is
        // ever lost, tsc fails on the unused directive (TS2578).
        beQuiet(async () => sig.get());

        sig.destroy();
      });
      ```
      `beQuiet` kommt dafür in den Import aus `@spearwolf/signalize` (Zeile 13-19). Der `await`-lose `async`-Callback ist Absicht: geprüft wird der Typ, nicht die Laufzeit — er läuft ohnehin, weil `@ts-expect-error` nur den Compiler betrifft, und hinterlässt nichts.

  **D — die Doku, in der Reihenfolge aus `CLAUDE.md`**

  16. Source-JSDoc: erledigt in den Schritten 4 und 8.
  17. `docs/api.md`, Abschnitt *SignalGroup → Static*, Zeile 477: die Zelle zu `SignalGroup.clear()` (»Clear all groups globally. Sweeps to the end even if a group's teardown throws.«) bekommt einen Halbsatz — dass eine Gruppe, die **während** des Sweeps entsteht (typisch aus einem `DESTROY`-Listener), ihn überlebt und registriert bleibt; sie wird von `getSignalGroupsCount()` weiter gezählt und vom nächsten `clear()` erfasst. Eine Zeile, keine neue Sektion.
  18. `docs/api.md`, Zeile 430: die Überschrift `### beQuiet(callback)` wird zu `### beQuiet(callback): T` — die Konvention der Datei ist, den Rückgabetyp zu nennen, wo es einen gibt (`### hibernate(callback): T`, Zeile 452). Dazu **ein** Satz direkt unter die Überschrift, vor den Absatz, den Paket 9 dort angehängt hat (»Wrapping a **whole effect run** …«, Zeilen 434-446 — der bleibt Wort für Wort stehen): `beQuiet()` gibt zurück, was `callback` zurückgibt, und lehnt — wie `batch()` — ein `async`/thenable-lieferndes `callback` schon zur Übersetzungszeit ab, weil der stille Rahmen am ersten `await` schließt.
  19. `docs/recipes.md`, Abschnitt *Quiet reads*: **das Rezept selbst bleibt unverändert** (Entscheidungszeile) — mit dem Fix stimmt `const peek = beQuiet(() => b.get()); // untracked` in Zeile 384 endlich. Der Prosaabsatz darunter (ab Zeile 388, »Inside `beQuiet()`, all reads are untracked **and** all writes are silent.«) bekommt den fehlenden Satz: der Rahmen reicht den Rückgabewert des Callbacks durch, wie `hibernate()`, und ein `async` Callback wird vom Typ abgewiesen, weil er die stille Zone am ersten `await` verlässt. Diese vier Stellen hat Paket 9 ausdrücklich für dieses Paket liegen gelassen (Querbezug oben); Paket 9s eigene Absätze zur Dependency-Semantik werden nicht angefasst.
  20. `docs/cheat-sheet.md`, Zeile 114: `beQuiet(() => a.get()); // no track, no notify` wird zu `const v = beQuiet(() => a.get()); // no track, no notify; returns the callback's result`. Eine Zeile, das Format der Datei.
  21. `skills/using-signalize/references/api.md`, Zeile 183: dieselbe Änderung im Block *Context modes* (`beQuiet(() => a.get()); // reads untracked, writes silent; counter-based, nests` → mit Zuweisung und dem Zusatz »returns the callback's result«). `SKILL.md` und `references/pitfalls.md` bleiben unberührt: Pitfall 9/9a reden über Dependency-Mengen und über Effect-Läufe im Rahmen, keine Silbe über einen Rückgabewert, und beides bleibt richtig.
  22. `CHANGELOG.md`, unter `## Unreleased` → `### Bug Fixes`, ans Ende, englisch, ein Fakt pro Zeile:
      - dass `beQuiet(action)` jetzt zurückgibt, was `action` zurückgibt (bisher `void`) — der dokumentierte untracked Peek war immer `undefined`, ohne Typfehler; die Erweiterung ist zur Laufzeit und für jeden Aufrufer, der den Wert ignoriert, unverändert (BUG-010);
      - dass die Signatur dabei — wie `batch()` — ein `async`/thenable-lieferndes `action` zur Übersetzungszeit ablehnt: der stille Rahmen endet am ersten `await`, jeder Read und Write danach ist wieder getrackt und laut. Kein Laufzeit-Check, anders als bei `batch()` (BUG-010);
      - dass `SignalGroup.clear()` (statisch) eine Gruppe, die während des Sweeps entsteht — etwa in einem `DESTROY`-Listener —, nicht mehr aus der Registry wirft. Sie blieb in `store` und wurde von `findOrCreate()` weiter herausgegeben, zählte aber nicht mehr in `getSignalGroupsCount()`, war für keinen weiteren Sweep erreichbar, und ihr `FinalizationRegistry`-Backstop konnte nie mehr feuern (BUG-009).
  23. `README.md` bleibt unberührt: die »API at a glance« listet unter *context modes* nur die Namen (`batch, beQuiet, isQuiet, hibernate`, Zeile 123), keine Signaturen. `AGENTS.md` ebenfalls — die Zeilen 98, 125 und 151 nennen Wirkung, Datei und Export, und alle drei bleiben richtig. `docs/architecture.md:87` sagt dasselbe in Tabellenform und bleibt ebenfalls stehen.

  **E — Coverage**

  24. **Keine Bewegung an einer engen Stelle.** `bequiet.ts` liegt in Stufe 3 (100/95/100/100) und hat laut Paket 5 keine Luft — es kommt aber weder ein Statement (`action();` → `return action();`) noch ein Zweig noch eine Funktion hinzu, und die neue `import type`-Zeile verschwindet in der Übersetzung. `SignalGroup.ts` **verliert** ein gedecktes Statement (die gestrichene Zeile); die Luft von 2 Statements, 3 Zweigen und 3 Zeilen wird nicht angetastet, neue Zweige entstehen keine. Keine Datei muss aus Stufe 2 oder 3 in Stufe 1 wandern; `signal-core.ts` (12 von 14 Zweigen, die engste Schwelle des Laufs) wird nicht berührt.

  **F — welche bestehenden Tests nachziehen müssen**

  25. **Erwartung: keiner.** Namentlich geprüft, weil sie die plausiblen Kandidaten sind:
      - `src/SignalGroup.teardown.spec.ts:336` und `:382` — die beiden Sweep-Tests aus Paket 2 assertieren `getSignalGroupsCount() === 0` nach einem Sweep über drei Gruppen, von denen eine wirft. Gemessen bleibt das Ergebnis spaltengleich (Schritt A.5), weil jede Gruppe sich selbst austrägt.
      - `src/SignalGroup.spec.ts:98` (`SignalGroup.clear() removes all groups`) — prüft `SignalGroup.get(obj)` auf `undefined`, also `store`, nicht `allGroups`; die Instanz-`clear()` bleibt unverändert.
      - `src/SignalGroup.gc.spec.ts` — vier Tests um `getSignalGroupsCount()` herum, alle über den FinalizationRegistry-Pfad einer *nicht* gesweepten Gruppe. Laufen nur unter `pnpm test:gc` bzw. seit Paket 5 im zweiten Vitest-Projekt; im Verify enthalten.
      - die elf `beQuiet`-Aufrufstellen im Repo (`bequiet.spec.ts`, `hibernate.spec.ts`, `EffectImpl.run.spec.ts:42`, `SignalGroup.off.spec.ts:408`) — alle ignorieren den Rückgabewert und kompilieren nachweislich unverändert (Schritt B.9).
      Wird trotzdem einer rot, ist das ein Regressionsbefund, keine erwartete Nachführung.
- Verify: `pnpm world` (enthält seit Paket 5/6 `test:gc`, `test:smoke` und `checkPkgTypes` — `bundle` ist dabei der Prüfer für den Import-Zyklus aus Schritt B.12, `test:smoke` der einzige echte Typprüfer für Schritt C.15). Die Gesamtzahl im `unit`+`gc`-Lauf muss **448** lauten (445 aus Paket 11 plus drei neue); der Smoke-Test kommt mit `node --test` separat dazu. Weicht die Zahl ab, fehlt ein Test oder es ist einer stillschweigend übersprungen worden.
- Commit: `fix(group,quiet): keep a group born during the sweep registered, and hand back beQuiet()'s result (BUG-009, BUG-010)`
- Abgleich (2026-08-07): **beide Findings unverändert vorhanden und selbst reproduziert.** BUG-009: `src/SignalGroup.ts:220-232` (statisches `clear()`, die Zeile steht auf **230**) und `:46-47` (`clearGroupFromFinalizer` mit `if (!allGroups.has(group)) return`) — Paket 11 hat die Datei wie angekündigt nicht angefasst, die Fundstellen des Audits stimmen bis auf die Verschiebung durch Paket 2. Gegenkante dazu: `allGroups.delete(this)` in Zeile **867**, `getSignalGroupsCount()` in Zeile **66**. BUG-010: `src/bequiet.ts:14` unverändert, das Rezept steht inzwischen in `docs/recipes.md:384` (Audit `:334`), die Doku-Stellen von Paket 9 auf `docs/api.md:430`, `docs/cheat-sheet.md:114` und `skills/using-signalize/references/api.md:183`. Paket 9 hat in `docs/api.md` den Absatz 434-446 über Dependency-Mengen ergänzt und über den Rückgabewert erwartungsgemäß nichts gesagt. **Keine Abweichung von den Empfehlungen des Audits**; bei BUG-009 ist von den beiden angebotenen Varianten die erste gewählt (streichen), mit Begründung in Schritt A.2.

**BUG-009 · low · src/SignalGroup.ts:208-220 (jetzt :220-232) · src/SignalGroup.ts:46-47** — Das unbedingte `allGroups.clear()` aus dem statischen `SignalGroup.clear()` entfernen
Jedes `group.clear()` trägt sich bereits selbst aus `allGroups` aus, das nachlaufende `allGroups.clear()` trifft also nur Gruppen, die *während* des Sweeps entstanden sind — etwa durch einen DESTROY-Listener. Eine solche Gruppe bleibt in `store` und wird von `findOrCreate()` weiter herausgegeben, steht aber nicht mehr in `allGroups`: `getSignalGroupsCount()` meldet sie nicht, und ihr FinalizationRegistry-Callback wird durch `if (!allGroups.has(group)) return` zum dauerhaften No-op.
Empfehlung: Die `allGroups.clear()`-Zeile streichen oder auf den tatsächlich gesweepten Snapshot beschränken.
Evidence (2026-08-07 selbst reproduziert): `vor statischem clear(): groups = 1 | signals = 1` / `nach statischem clear(): groups = 0 | signals = 1`, `store gibt die Gruppe weiter heraus: true`, `memberCounts: {"signals":1,"namedSignals":0,"otherSignals":0,"effects":0,"links":0,"groups":0}` / `nach clearGroupFromFinalizer(b): memberCounts unverändert (No-op)` / `nach zweitem statischem clear(): signals = 1`. Mit gestrichener Zeile: `groups = 1` nach dem Sweep, Finalizer wirksam, zweiter Sweep räumt auf (`signals = 0`).

**BUG-010 · low · docs/recipes.md:334 (jetzt :384) · src/bequiet.ts:14** — Das `beQuiet()`-Rezept korrigieren, sein Rückgabewert ist immer `undefined`
`beQuiet(action: () => any): void` verwirft, was die Action zurückgibt. Das projekteigene Rezept für stille Reads schreibt trotzdem `const peek = beQuiet(() => b.get());` und präsentiert `peek` als den ungetrackten Wert. Es ist immer `undefined`, ohne Typfehler, weil das Zuweisungsziel inferiert wird. Entweder die Doku oder die Signatur ist falsch.
Empfehlung: `beQuiet<T>(action: () => NonThenable<T>): T` das Ergebnis zurückgeben lassen — eine Zeile, und deckungsgleich mit `hibernate()`; sonst das Rezept auf eine Zuweisung im Rumpf umstellen.
Evidence (2026-08-07 selbst reproduziert): `const peek = beQuiet(() => b.get()) → undefined`, `hibernate(() => b.get()) → 23`.

### Sprint 3 — Speicher und Ressourcen

#### [x] 13. Der eingesammelte Link räumt seine Queues ab
- Findings: MEM-001 (high), MEM-005 (low)
- Ziel: Der Finalizer meldet die Queue-Subscriptions ab, statt nur den Zähler zu korrigieren; eine Warnung macht ein wachsendes Link-Register pro Quelle sichtbar.
- Bereich: `src/link.ts`, `src/SignalLink.ts`, `src/constants.ts`, Specs, `docs/`, `skills/`
- Hängt ab von: —
- Modell: stärkste Stufe. Die Zielfassung ist vor der Planung vollständig gebaut und gemessen (Suite, `tsc`, Coverage, GC-Verhalten), das Restrisiko liegt in der Doku-Reihenfolge — die Fallhöhe bleibt trotzdem hoch: ein Held-Value, der falsch zeigt, macht den Finalizer still zum Dauerleck, und kein Test im Standardlauf würde das melden.
- Hash: `63cfedd`
- Ergebnis (2026-08-07): MEM-001 und MEM-005 behoben, eine Review-Runde ohne `kritisch` und ohne `wichtig`. **Die Audit-Empfehlung zu MEM-001 wurde verworfen und ersetzt.** Sie lautet, dem Finalizer die Signal-ID mitzugeben und `off(globalSignalQueue, id)` zu rufen — per Event-Namen träfe das auf `globalDestroySignalQueue` auch `EffectImpl`, `SignalGroup`, `createMemo` und fremde Links, und bei der **Ziel**-ID ein Signal, das noch lebt. Der Reviewer hat das gegengeprüft: 50 lebende Zielsignale mit fremden Effects behalten unter der umgesetzten Fassung ihre Subscriptions exakt (`sigQ=50 destQ=50` nach dem Sweep, genau der Setup-Stand), mit der Audit-Variante wären sie mitgerissen worden. Umgesetzt ist stattdessen das Array der drei Unsubscribe-Handles als Held-Value.
  **Der Held-Value hat nachweislich keinen starken Pfad zurück auf den Link** — gemessen, nicht gelesen: 50 Links über `WeakRef` beobachtet, 50 lebendig vor `gc()`, 0 danach, bei gleichzeitig `getLinksCount()=0`. Die Kausalität ist über einen Mutanten belegt: ersetzt man in der Konstruktor-Closure `selfRef.deref()` durch `this`, wird kein einziger Link mehr eingesammelt und sieben GC-Tests fallen.
  Gemessene Wirkung, beide Link-Varianten, 10 000 fallengelassene Paare: Callback-Ziel `sigQ/destQ 10 000 → 0`, Heap **25,4 → 4,9 MB**; Signal-Ziel `destQ 20 000 → 0`, Heap **39,4 → 4,9 MB**. Alle fünf expliziten Teardown-Pfade (`link.destroy()`, `destroySignal(source)`, `destroySignal(target)`, `unlink()`, `group.clear()`) ohne Rückschritt. Neun Mutanten gefahren, acht getötet.
  MEM-005 ist ein `console.warn` ohne Schalter, Schwelle **1000 Links pro Quelle**, höchstens einmal je Quelle über ein `WeakSet`. `process.env` scheidet aus — `src/` benutzt keine plattformabhängige API, in einer ESM-Browser-Bibliothek wäre `process` ein `ReferenceError`. Der Reviewer hat Schwelle (999 schweigt, 1000 warnt), Einmaligkeit (1001/1002 schweigen, auch nach vollständigem Neuaufbau derselben Quelle) und Zählung pro Quelle statt global einzeln nachgemessen; das `WeakSet` leckt nicht.
  Runde 1 schloss drei Doku- und Testlücken: der neue Absatz in `docs/recipes.md` hätte Leser zu genau dem flakigen Test angeleitet, vor dem dasselbe Dokument warnt (jetzt mit `--expose-gc`, Retry-Schleife und Verweis auf `src/link.gc.spec.ts`); `AGENTS.md` und `CLAUDE.md` trugen acht veraltete Fundstellen und eine falsche Testzahl, alle vom Reviewer einzeln per `grep -n` nachgezählt; und das Aufräumen der beiden neuen MEM-005-Tests stand hinter dem `try`/`finally` statt darin, wodurch ein einzelner echter Fehlschlag zwei rote Tests erzeugte.
  Verify selbst gelaufen: `pnpm world` Exit 0, 42 Dateien / **454 Tests** (Baseline 448). `link.ts` 100 / 88,88 / 100 / 100 → **100 / 90 / 100 / 100**, `SignalLink.ts` bleibt bei 100 in allen vier. GC-Tests 20× beim Implementierer, 20× beim Reviewer, je ohne Schwankung.
- Nachziehender Test: genau einer, wie geplant — die Wortlaut-Zusicherung in `src/SignalLink.spec.ts` auf `'[signalize] 2 errors while tearing down a SignalLink'`. Damit ist zugleich der Paket-8-Nebenbefund eingelöst, der eine Umbenennung des Labels an dieser Zusicherung scheitern sah.
- Nebenbefunde:
  - **Für Paket 14:** `src/SignalLink.ts` — der Sammeltopf in `destroy()` deckt jetzt Handle-Schleife und DESTROY-Emit ab, aber `retainClear(this, VALUE)` und `off(this)` stehen weiterhin ungeschützt dahinter. Wirft eines davon, werden `Object.freeze(this)` und `throwCollectedErrors()` übersprungen. Kein Finding des Audits, aber Paket 14 arbeitet genau dort.
  - `klein`, offen: In `src/link.spec.ts` steht das Aufräumen auch außerhalb der beiden neuen Tests hinter den Assertions statt in einem `finally` — ein Fehlschlag kaskadiert über die `beforeEach`-Wache in den nächsten Test. Betrifft die ganze Datei.
  - `klein`, offen: Die Wache `if (gLinksCount > 0)` im Finalizer (`src/link.ts`) ist einer von vier ungedeckten Zweigen der Datei und lässt sich nicht auslösen, ohne den Zähler künstlich zu verbiegen.
  - Die Determinismus-Begründung im Kommentar behauptete zunächst mehr, als sie trägt: die Reihenfolge »Handles vor Zähler« stimmt, ist aber nicht die Ursache der Stabilität — dreht man sie um, bleibt die Suite grün, weil der Finalizer-Callback ohnehin synchron durchläuft. In Runde 1 auf die tatsächliche Ursache zurückgezogen (die Budget-Schleife).
- Dateien: `src/constants.ts`, `src/SignalLink.ts`, `src/link.ts`, `src/link.gc.spec.ts`, `src/link.spec.ts`, `src/SignalLink.spec.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Alle Zahlen unten sind am 2026-08-07 gegen `6f211d7` selbst gemessen: die Reproduktionen gegen das frisch übersetzte `lib/`, die Zielfassung gegen eine **Kopie** von `src/` im Scratchpad, gefahren mit der projekteigenen `vitest.config.ts` (nur `root` auf die Kopie absolut gesetzt — ohne das läuft Vitest gegen das Original und meldet fröhlich 448 grüne Tests, die nichts beweisen) und mit `tsc --project tsconfig.lib.json`. Am Projektcode ist nichts angefasst worden; im Repo steht nur diese Datei.

  - **Reproduktion MEM-001** (`node --expose-gc`, 8× `gc()` + Timer-Settle, Callback-Ziele):
    ```
    baseline                            links=0  signals=0      sigQ=0      destQ=0      heap=4.3MB
    nach 2000 fallengelassenen Paaren   links=0  signals=2000   sigQ=2000   destQ=2000   heap=9.0MB
    nach 6000                           links=0  signals=6000   sigQ=6000   destQ=6000   heap=17.6MB
    nach 10000                          links=0  signals=10000  sigQ=10000  destQ=10000  heap=26.2MB
    Kontrolle link.destroy():      delta sigQ=0  delta destQ=0
    Kontrolle destroySignal(src):  delta sigQ=0  delta destQ=0
    ```
    Eins zu eins die `evidence` des Audits: ~2,19 KB Heap pro Paar, `getLinksCount()` durchgehend 0. Mit Signal-Zielen steht `destQ` bei **20000** für dieselben 10000 Links — die zweite Destroy-Subscription aus `SignalLinkToSignal` (Schritt 2). Der mitlaufende `signals=`-Wert ist MEM-006 und gehört Paket 16.
  - **Reproduktion MEM-005** (dieselbe Maschine, eine lebende Quelle, `1000` Writes je Zeile):
    ```
    0 Links: 0.60 ms | 100: 8.34 ms | 500: 23.54 ms | 1000: 58.28 ms | 2000: 126.48 ms
    2000 Links nach 8× gc() + Settle: links(src)=2000  sigQ=2000  destQ=2000
    nach unlink(src): links=0, 1000 Writes: 0.05 ms
    ```
    Ebenfalls deckungsgleich (Audit: 2000 Links, 140,49 ms). Der Rückstand wird linear pro Write bezahlt, und `gc()` bewegt ihn um keine Zelle.

  **A — MEM-001: welcher Held-Value, und warum nicht der aus der Empfehlung**

  1. **Was heute registriert wird** (`src/link.ts:177`): `gLinkFinalizer.register(newLink, undefined, newLink)` — Held-Value `undefined`, Unregister-Token `newLink`. Der Callback (`:76-80`) kann deshalb gar nichts anderes tun als den Zähler korrigieren, und der Kommentar darüber (`:62-75`) hält das seit dem letzten Lauf ausdrücklich fest, inklusive der Messung, die MEM-001 jetzt zum Finding macht.
  2. **Welche Subscriptions ein Link hält** — am Code abgezählt, nicht aus dem Audit übernommen:
     | Subscription | wo registriert | Ablage | Callback-Ziel |
     | --- | --- | --- | --- |
     | `on(globalSignalQueue, source.id, …)` | `SignalLink`-Konstruktor | `#unsubscribe` | `SignalLink` und `SignalLinkToSignal` |
     | `once(globalDestroySignalQueue, source.id, …)` | `SignalLink`-Konstruktor | `#releaseOnDestroy[0]` | beide |
     | `once(globalDestroySignalQueue, target.id, …)` | `SignalLinkToSignal`-Konstruktor, über `releaseOnDestroy()` | `#releaseOnDestroy[1]` | **nur** `SignalLinkToSignal` |
     Also **zwei** pro `SignalLinkToCallback`, **drei** pro `SignalLinkToSignal` — gemessen bestätigt (10000 Signal-Ziel-Links: `sigQ=10000`, `destQ=20000`). Alle drei muss der Finalizer abmelden. Nicht betroffen sind die Subscriptions **auf dem Link selbst**: der `once(this, DESTROY, …)` aus `attach()` und der Buchhaltungs-Hook aus `link()` (`:179`) leben in der Event-Ablage des Links und sterben mit ihm. Ein an eine Gruppe angehängter Link wird ohnehin nie eingesammelt — `SignalGroup#links` hält ihn stark; der Finalizer sieht ausschließlich ungebundene Links.
  3. **Die erste Empfehlung des Audits — `off(globalSignalQueue, id)` / `off(globalDestroySignalQueue, id)` — wird nicht umgesetzt.** `off(queue, eventName)` entfernt *jeden* Abonnenten dieses Namens, und auf `globalDestroySignalQueue` abonnieren unter einer Signal-ID auch `EffectImpl` (`:635`), `SignalGroup` (`:363`), `createMemo` (`:123`) und andere Links. Für die **Quell**-ID wäre das gerade noch vertretbar: der Link ist nur einsammelbar, wenn der Eintrag in der inneren `Map` unerreichbar ist, und der lebt genau so lange wie das Quellsignal — wer dort noch abonniert wäre, redete mit einem Signal, das es nicht mehr gibt. Für die **Ziel**-ID ist es falsch: das Ziel kann weiterleben, während Quelle und Link fallen (gemessen, Test 3 in Schritt C), und `off(globalDestroySignalQueue, target.id)` risse dann die Aufräum-Hooks fremder Effects, Gruppen und Memos eines **lebenden** Signals ab. Umgesetzt wird die zweite, vom Audit gleichrangig genannte Variante: die Unsubscribe-Handles selbst als Held-Value. Sie trifft ausschließlich die eigenen drei Subscriptions.
  4. **Warum der Held-Value den Link nicht am Leben hält** — die Falle, an der MEM-003 in Paket 15 hängt, und hier am eventize-Code nachgelesen statt vermutet: `makeOnUnsubscribe(host, listeners)` (`eventize/lib/index.mjs:1641`) hält `{host, listeners}`, `makeOnceUnsubscribe(host, obligation)` hält `{host, obligation}` und setzt das Feld beim Einlösen auf `null`. Von dort geht es weiter auf `EventListener.listener` — und das ist in allen drei Fällen die Pfeilfunktion aus dem Konstruktor, die den Link ausschließlich über `new WeakRef(this)` erreicht (`SignalLink.ts:94`, `:483`). Es gibt keinen starken Pfad Held-Value → Link; `EventListener.detach()` nullt die Felder beim Entfernen zusätzlich. **Gemessen statt behauptet**: mit dem Umbau feuert der Finalizer unverändert, `links=0`, und `sigQ`/`destQ` fallen auf den Ausgangswert, der Heap bleibt bei 4,9 MB statt auf 26,2 MB zu wachsen:
     ```
     nach 2000 fallengelassenen Paaren   links=0  sigQ=0  destQ=0  heap=4.8MB
     nach 6000                           links=0  sigQ=0  destQ=0  heap=4.9MB
     nach 10000                          links=0  sigQ=0  destQ=0  heap=4.9MB
     ```
     Mit Signal-Zielen dieselbe Tabelle (`destQ=0` statt 20000).
  5. **Der Umbau in `src/SignalLink.ts`.** Die drei Handles brauchen einen Ort, den `link()` erreichen kann. Ein privates `#`-Feld ist aus einem fremden Modul unerreichbar, ein `public`-Feld wäre eine neue benannte Oberfläche — also ein symbolgeschlüsseltes Feld, das Muster, das `constants.ts` für `$destroySignal`/`$effect`/`RECALL` bereits trägt. `src/constants.ts` bekommt eine Zeile:
     ```ts
     export const $queueUnsubscribes = Symbol.for('@spearwolf/signalize/queueUnsubscribes');
     ```
     `tsc` leitet daraus `unique symbol` ab (Voraussetzung für einen berechneten Feldnamen; gegengeprüft: `lib/constants.d.ts` deklariert `export declare const $queueUnsubscribes: unique symbol`). In `SignalLink` ersetzt es die beiden heutigen Ablagen:
     - `#unsubscribe?: () => void` **entfällt**,
     - `#releaseOnDestroy: (() => void)[]` wird zu `readonly [$queueUnsubscribes]: (() => void)[] = []`,
     - der Konstruktor pusht **beide** eigenen Handles hinein (erst `globalSignalQueue`, dann `globalDestroySignalQueue` — die Reihenfolge bleibt, wie sie ist),
     - `protected releaseOnDestroy(unsubscribe)` bleibt als einziger Zugang für Unterklassen bestehen und pusht in dasselbe Array; sein JSDoc verliert die Begründung »private Klassenfelder sind aus einem Unterklassenrumpf nicht erreichbar« (stimmt für ein Symbol-Feld nicht mehr) und bekommt dafür die neue: alles, was hier landet, wird sowohl von `destroy()` als auch vom Finalizer freigegeben,
     - `destroy()` verliert die beiden Zeilen `this.#unsubscribe?.(); this.#unsubscribe = undefined;` und lässt die Schleife über `this[$queueUnsubscribes]` laufen.
     Zwei Folgen, beide gewollt: die `globalSignalQueue`-Abmeldung wandert damit aus dem ungeschützten Vorlauf **in** das Sammelmuster aus Paket 8 (wirft sie, läuft der Rest des Teardowns trotzdem zu Ende — genau die S6-Begründung, die Paket 8 für die anderen Handles geschrieben hat), und die Reihenfolge der Freigaben bleibt unverändert. Ein `Object.freeze(this)`-Problem entsteht nicht: `.length = 0` läuft weiter vor dem Einfrieren, und das Array ist ohnehin ein eigenes, nicht eingefrorenes Objekt einen Hop weiter.
  6. **Der Umbau in `src/link.ts`** — Registry-Typ, Callback, Registrierung:
     ```ts
     const gLinkFinalizer = new FinalizationRegistry<(() => void)[]>(
       (queueUnsubscribes) => {
         // MEM-001: a link that is only dropped never runs destroy(), so
         // these handles are the *only* thing left that can take its
         // subscriptions off the two module-level queues. Releasing them
         // first and correcting the counter afterwards is load-bearing for
         // the tests: `getLinksCount() === 0` then means "every release has
         // already run", so a GC test needs no second settle step.
         for (const unsubscribe of queueUnsubscribes) {
           try {
             unsubscribe();
           } catch (err) {
             // A throw out of a FinalizationRegistry callback has no caller
             // to reach — it would take the process down. Same channel and
             // same reason as `SignalGroup`'s finalizer.
             console.error(
               '[signalize] link: releasing the queue subscriptions of a collected link failed',
               err,
             );
           }
         }
         queueUnsubscribes.length = 0;
         if (gLinksCount > 0) {
           gLinksCount -= 1;
         }
       },
     );
     ```
     und `gLinkFinalizer.register(newLink, newLink[$queueUnsubscribes], newLink);`. Das Unregister-Token bleibt `newLink`, der Buchhaltungs-Hook in `once(newLink, DESTROY, …)` bleibt Zeile für Zeile, wie er ist — ein explizit zerstörter Link meldet sich weiterhin ab, bevor der Finalizer ihn je sieht, und sein Array ist zu diesem Zeitpunkt bereits leer. Doppelte Freigabe ist damit zweifach ausgeschlossen, und eventize-Handles sind ohnehin idempotent (`held = null` beim ersten Aufruf).
  7. **Die eine Zeichenkette, die sich mitändert.** Der Sammeltopf in `destroy()` heißt heute `'releasing SignalLink destroy-queue subscriptions'`. Er enthält seit Paket 8 auch Fehler von DESTROY-Listenern und ab jetzt zusätzlich die `globalSignalQueue`-Abmeldung — beides deckt das Label nicht mehr. Es wird zu `'tearing down a SignalLink'`. Das löst zugleich den `klein`-Nebenbefund aus Paket 8 ein (»das Label spricht weiterhin nur von Queue-Subscriptions … eine Umformulierung bricht die Wortlaut-Zusicherung in `src/SignalLink.spec.ts:528`«) — die Zusicherung wird in Schritt F nachgeführt, sie ist die einzige.
  8. **Was der GC-Pfad danach immer noch nicht ist.** Er meldet die drei Queue-Subscriptions ab und korrigiert den Zähler. Er emittiert **kein** DESTROY, ruft `destroy()` nicht, trägt nichts aus einer Gruppe aus (ein Gruppen-Link ist nicht einsammelbar, Schritt 2) und rührt das Ziel nicht an. Er bleibt nicht terminierbar und nicht beobachtbar. Die Doku sagt danach also nicht »es gibt einen fünften Teardown-Weg«, sondern: der Rückstand, den ein fallengelassener Link auf den globalen Queues hinterließ, ist weg — die vier expliziten Wege bleiben die einzigen, die man einplanen kann.

  **B — MEM-005: was »Dev-Mode« hier heißt**

  9. **Es gibt keinen, und es kommt keiner.** Geprüft: `process.env.NODE_ENV` scheidet aus. `AGENTS.md:193` hält als geprüfte Zusage fest, dass `src/` keine plattformabhängige API benutzt — `process` wäre die erste, und in einer ESM-Bibliothek, die im Browser ohne Bundler laufen soll, ist jeder ungeschützte Zugriff darauf ein `ReferenceError`. Ein `typeof process !== 'undefined'`-Vorbau wäre zwar sicher, aber tree-shaked nirgends weg, und er verlagert die Entscheidung auf einen Bundler, den diese Bibliothek nicht voraussetzen darf. Ein expliziter Schalter (`setLinkWarningThreshold()`, eine Options-Funktion) wäre **neue öffentliche API** und damit eine Produktentscheidung — laut Auftrag Rückfrage statt Alleingang. Beides wird nicht gebaut.
      **Entschieden: die Warnung greift immer, ohne Schalter, höchstens einmal pro Quellsignal.** Das ist vertretbar, weil sie erst bei 1000 Links auf *einer* Quelle anspringt (Schritt 10) und danach für diese Quelle für immer schweigt: im schlimmsten Fall eine Zeile auf der Konsole pro Prozess und Quelle. `console.warn` ist im Ton der Bibliothek zulässig — `console.error` steht bereits in `SignalGroup`s Finalizer und ist in `AGENTS.md:193` als eine der drei benutzten Laufzeit-APIs benannt.
  10. **Die Schwelle: 1000, per Quelle.** Begründung aus der eigenen Messung (Schritt »Reproduktion MEM-005«): bei 1000 Links auf einer Quelle kosten 1000 Writes 58 ms statt 0,60 ms — Faktor 97, und jeder weitere Link verteuert jeden weiteren Write linear. Unterhalb davon ist ein großes Fan-out noch eine plausible Absicht (ein Store-Signal in mehrere hundert Komponenten ist ein Entwurf, keine Panne); 1000 verschiedene Ziele an einer Quelle hat niemand vorgehabt. Die Schwelle ist eine Diagnosemarke, keine Grenze: es wird **nicht** geworfen und nichts abgelehnt — eine Bibliothek, die bei Link 1000 wirft, legt laufende Anwendungen lahm, um auf ein Leck hinzuweisen.
  11. **Der Code** — `src/link.ts`, zwei Modulkonstanten und vier Zeilen in `link()`, direkt hinter `links.set(targetKey, newLink)`:
      ```ts
      // MEM-005: `gLinks` is weak on the source but strong on the inner Map,
      // so every link ever created against a still-reachable source stays
      // alive — and every write to that source pays for the backlog
      // (measured: 1000 writes cost 0.60 ms with no links, 58 ms with 1000).
      // Dropping the `SignalLink` and waiting for GC does not help; only the
      // four explicit teardown routes do. There is no dev-mode flag to hang
      // this off and no runtime switch to add (that would be public API), so
      // it fires at most once per source signal, for good.
      const LINK_COUNT_WARN_THRESHOLD = 1000;
      const gWarnedSources = new WeakSet<ISignalImpl<any>>();
      …
      if (
        links.size >= LINK_COUNT_WARN_THRESHOLD &&
        !gWarnedSources.has(sourceSignal)
      ) {
        gWarnedSources.add(sourceSignal);
        console.warn(
          `[signalize] link(): ${links.size} links on a single source signal. A link is held until destroy(), unlink(), a cleared {attach} group, or the destruction of source/target — garbage collection alone does not reclaim one on a live source. If this is a hot path creating fresh callbacks, tear the old links down; getLinksCount(source) is the number to watch.`,
        );
      }
      ```
      `WeakSet` statt eines Gleichheitsvergleichs (`links.size === THRESHOLD`) ist Absicht: der Vergleich braucht zwar keinen Zustand, aber eine Anwendung, die Links an der Schwelle sauber auf- und abbaut, bekäme bei jedem Neuanlegen wieder eine Zeile — eine Warnung über korrektes Verhalten. Der `WeakSet` hält nichts fest (schwach auf das Quellsignal, wie `gLinks` selbst) und gibt die klarere Zusage: höchstens einmal pro Quelle, für die Lebensdauer des Prozesses.

  **C — die Tests, rot zuerst**

  12. **Vier GC-Tests in `src/link.gc.spec.ts`**, hinter den drei vorhandenen. Die Datei bringt `forceGc()`, `waitUntilLinksCollected()` und die `beforeEach`/`afterEach`-Wachen bereits mit; neu im Import sind `getSubscriptionCount` aus `@spearwolf/eventize` (einargumentig, wie in `CLAUDE.md` beschrieben), die beiden Queues aus `./global-queues.js` und für Test 4 `$queueUnsubscribes` aus `./constants.js`.
      **Determinismus, und warum kein zusätzliches Settle nötig ist:** der Finalizer-Callback gibt die Handles frei **bevor** er den Zähler senkt (Schritt 6). `waitUntilLinksCollected()` wartet auf `getLinksCount() === 0`, und dieser Zustand impliziert damit, dass jede Freigabe schon gelaufen ist — die Subscription-Zusicherung braucht keinen eigenen Timer und keine Wiederholung. Die vorhandene Budget-Schleife (20 × 5 `gc()` + `setImmediate`) bleibt unverändert; der Zusatz »8× gc() + Timer-Settle« aus der `evidence` des Audits ist das Vorgehen des Messskripts, nicht das der Suite.
      - **Test 1 — `a collected callback-target link releases both of its queue subscriptions (MEM-001)`**: `sigBefore`/`destBefore` schnappschussen, 100 Paare in einer IIFE anlegen, `+100` auf beiden Queues assertieren, `waitUntilLinksCollected()`, dann `getLinksCount() === 0` **und** beide Zähler zurück auf den Ausgangswert. Auf `6f211d7` **rot**, gemessen: `expected 100 to be +0`.
      - **Test 2 — `a collected signal-target link releases all three of its queue subscriptions (MEM-001)`**: dasselbe mit 100 Signal-Zielen, die mitfallen. `destBefore + 200` vor dem Sammeln (der Beleg für die dritte Subscription), danach beide Zähler auf dem Ausgangswert. Auf `6f211d7` **rot**, gemessen: `expected 200 to be 100`.
      - **Test 3 — `a collected link releases the destroy hook on a target signal that is still alive (MEM-001)`**: die 100 Ziel-Signale werden in einem Array **festgehalten**, nur Quellen und Links fallen. Nach dem Sammeln stehen beide Zähler auf dem Ausgangswert; anschließend werden alle Ziele beschrieben und gelesen (`targets[7].value === 7`), bevor sie zerstört werden. Dieser Test ist die Gegenprobe zu Schritt A.3 — mit `off(globalDestroySignalQueue, target.id)` wären die Ziele hier beschädigt worden, mit den Handles sind sie unversehrt.
      - **Test 4 — `a throwing release handle is reported and does not stop the rest (MEM-001)`**: ein Link, dann `l[$queueUnsubscribes].unshift(() => { throw new Error('release-boom') })` — der Werfer steht damit **vor** den echten Handles, was die Aussage überhaupt erst prüfbar macht. `console.error` wird gespiegelt (`vi.spyOn`), nach dem Sammeln gilt: genau ein `console.error`, `getLinksCount() === 0` (der Zähler wird trotz Wurf korrigiert), beide Queue-Zähler auf dem Ausgangswert. Der Test deckt zugleich den `catch`-Zweig aus Schritt 6 ab, den sonst nichts erreicht — und er ist der Grund, warum `link.ts` auf 100 % Statements bleibt (Schritt E und 12a). Auf `6f211d7` gibt es das Symbol nicht; der Test ist dort nicht übersetzbar und wandert mit dem Fix zusammen ein.
  12a. **Was Test 4 kostet, wenn man ihn weglässt** — gemessen, weil die Versuchung groß ist, einen GC-Test mit Spy für Ziererei zu halten: ohne ihn fällt `link.ts` auf 98,36 % Statements und 98,36 % Zeilen (ungedeckt bleibt das `console.error` im `catch`). Die Stufe-1-Schwelle für Zeilen steht auf 98 — das hielte gerade noch, mit 0,36 Prozentpunkten Luft. Der Test bleibt trotzdem, denn genau dieser Zweig entscheidet, ob ein werfendes Handle im Finalizer den Prozess mitnimmt.
  13. **Zwei Warn-Tests in `src/link.spec.ts`**, als eigener `describe('MEM-005: …')` am Ende, innerhalb der vorhandenen Zähler-Wachen (jeder Test räumt mit `unlink(src)` + `destroySignal(src)` auf, sonst schlägt `afterEach` zu).
      - **Test 4 — `stays silent below the threshold and warns once when a source reaches it`**: 999 Links auf einer Quelle, `console.warn` gespiegelt, `not.toHaveBeenCalled()`; der 1000. löst genau eine Warnung aus; der 1001. und 1002. lösen keine weitere aus.
      - **Test 5 — `counts per source, not globally`**: 600 Links auf `a` und 600 auf `b`, `getLinksCount() === 1200`, keine Warnung. Pinnt, dass die Schwelle pro Quelle zählt und nicht am globalen Zähler hängt.
      Beide laufen zusammen in 20 ms — 1000 Links sind billig, solange niemand die Quelle beschreibt. Gemessen: mit dem Fix grün, ohne ihn ist Test 4 rot (es gibt keine Warnung).
  14. **Keine `@ts-expect-error`-Dekoration.** Der Befund aus Paket 12 gilt: nichts im Projekt typprüft die Specs. Dieses Paket braucht auch keine Typzusicherung — `$queueUnsubscribes` ist interne Oberfläche, kein Versprechen an Aufrufer, und `smoke/` bleibt unberührt.

  **D — die Doku, in der Reihenfolge aus `CLAUDE.md`**

  15. **Source-JSDoc und Kommentare** (erledigt in den Schritten 5, 6, 11; hier steht, was darüber hinaus umgeschrieben werden **muss**, weil es nach dem Fix schlicht falsch ist):
      - `src/link.ts:32-36` (der `gLinks`-Absatz »… `gLinkFinalizer` below does eventually correct `getLinksCount()` … it is not equivalent to the three explicit ways above«) — bleibt richtig, bekommt aber den Zusatz, dass der Finalizer jetzt auch die Queue-Subscriptions freigibt.
      - `src/link.ts:55-75` (der `gLinkFinalizer`-Kommentar) — der zweite Absatz (»This is bookkeeping, not a cleanup path (MEM-007) … stays registered for good … Measured with callback targets: after 200 links are collected this way, `getSubscriptionCount(…)` both still read 200«) beschreibt exakt den behobenen Zustand und wird ersetzt.
      - `src/link.ts:121-127` (`link()`, »Lifetime«) und `:237-247` (`getLinksCount()`) — beide sagen »without releasing those subscriptions«. Nachziehen, ohne die Kernaussage zu verwässern: GC bleibt kein fünfter Teardown-Weg (Schritt 8).
      - `src/SignalLink.ts:30-47` (der `#releaseOnDestroy`-Block) — Name, Zweck und der zweite Leser (der Finalizer) gehören hinein; die S7-Notiz zu `Object.freeze` bleibt.
      - `src/SignalLink.ts:80-93` (der `selfRef`-Block) — der Absatz »It does not, on its own, make an orphaned link collectible« bleibt wahr, aber der `WeakRef` ist jetzt zusätzlich die Bedingung dafür, dass der Held-Value trägt (Schritt 4). Das gehört dazu, sonst entfernt es der nächste Leser als Redundanz.
      - `src/link.gc.spec.ts:40-51` — der Kommentarblock begründet, warum die Suite **keine** `getSubscriptionCount()`-Zusicherung hat. Ab jetzt hat sie drei; der Block wird zur Gegenrichtung umgeschrieben.
  16. `docs/api.md:320-328` (**Lifetime** unter `link<T>(source, target, options?)`): der Satz »Garbage collection alone is not a fifth way« bleibt. Ergänzt wird ein Halbsatz — wird ein Link gemeinsam mit seiner Quelle unerreichbar, gibt der Finalizer inzwischen auch seine Subscriptions auf den globalen Queues frei, nicht nur den Zähler. Dazu ein Satz zur Warnung: ab 1000 Links auf einer Quelle meldet sich `link()` einmalig über `console.warn`.
  17. `docs/api.md:334-342` (`getLinksCount(source?)`): der Nebensatz »but nondeterministically and without releasing those subscriptions — see `link.ts`'s `gLinkFinalizer`« wird zu »nondeterministisch, aber inzwischen samt Subscriptions«. Der Verweis auf `gLinkFinalizer` bleibt.
  18. `docs/recipes.md:567-573` (»Held until torn down, not until unreachable«): unverändert richtig — dort wird nur die neue Warnung genannt, als das, was einem diesen Absatz zur Laufzeit vorliest.
  19. `docs/recipes.md:658-660` (Abschnitt *Leak detection*): »Links need their own explicit `unlink(source)` … a link on a still-live source is not reclaimed by dropping references alone« bleibt wörtlich stehen; ergänzt wird, dass ein `getSubscriptionCount(queue)`-Vergleich um den Szenario-Block herum jetzt auch den GC-Fall abdeckt (das Muster aus `CLAUDE.md` → »Verifying subscription leaks«).
  20. `docs/cheat-sheet.md:104`: hinter `getLinksCount(); getLinksCount(src);` ein Kommentar in der Zeilenform der Datei — `// warns once per source at 1000 links`. Eine Zeile, keine neue Sektion.
  21. `skills/using-signalize/references/pitfalls.md:81` (Pitfall 17): der Klammersatz am Ende (»… but that only corrects the count — its queue subscriptions stay behind«) ist ab dem Fix falsch und wird zu »… corrects the count *and* releases its queue subscriptions; it still is not a teardown you can schedule«. Dazu ein Satz zur Warnschwelle, weil dieser Pitfall genau den Hot-Path beschreibt, den sie meldet. `SKILL.md` und `references/patterns.md` bleiben unberührt: die Lebenszyklus-Aussage in `SKILL.md:22` und das Leak-Muster in `patterns.md:81` bleiben Wort für Wort richtig.
  22. `skills/using-signalize/references/api.md:153-155`: dieselbe Ergänzung wie im Cheat-Sheet, im Format des Blocks (`getLinksCount(); getLinksCount(src);` → mit dem Warn-Hinweis als Zeilenkommentar).
  23. `CHANGELOG.md`, unter `## Unreleased` → `### Bug Fixes` ans Ende, englisch, ein Fakt pro Zeile:
      - dass ein Link, der gemeinsam mit seinem Quellsignal unerreichbar wird, jetzt auch seine Subscriptions auf `globalSignalQueue`/`globalDestroySignalQueue` freigibt statt nur den Zähler zu korrigieren — zwei pro Callback-Ziel, drei pro Signal-Ziel; gemessen blieben 10 000 fallengelassene Paare vorher mit 10 000 Einträgen auf jeder Queue und ~2,2 KB Heap pro Paar zurück, während `getLinksCount()` 0 meldete (MEM-001);
      - dass ein werfendes Handle dabei über `console.error` gemeldet wird, statt den Prozess zu beenden, und die übrigen Freigaben trotzdem laufen (MEM-001);
      - dass die Fehlermeldung eines fehlgeschlagenen `SignalLink`-Teardowns jetzt `[signalize] N errors while tearing down a SignalLink` lautet (vorher »… while releasing SignalLink destroy-queue subscriptions«) — der Topf enthält seit dem letzten Lauf auch Fehler von `DESTROY`-Listenern (MEM-001);
      - und unter `### Features` oder, falls dort unpassend, ebenfalls unter `### Bug Fixes`: dass `link()` einmalig pro Quellsignal warnt, sobald 1000 Links an einer Quelle hängen — mit dem Hinweis auf die vier Teardown-Wege (MEM-005).
  24. `README.md` und `AGENTS.md` bleiben unberührt: die »API at a glance« (`README.md:120`) und die Exporttabellen (`AGENTS.md:118`, `:148`) nennen nur Namen. `AGENTS.md:193` bleibt ebenfalls richtig — `console.warn` tritt neben `console.error`, die Aussage »kein `process`, kein `node:`« hält, und das ist genau der Grund aus Schritt 9.

  **E — Coverage**

  25. **Gemessen, mit allen sechs neuen Tests, gegen die Schwellen aus Paket 5:**
      | Datei | vorher | nachher | Schwelle |
      | --- | --- | --- | --- |
      | `link.ts` | 100 / 88,88 / 100 / 100 (32 von 36 Zweigen) | 100 / **90** / 100 / 100 (36 von 40) | Stufe 1: 97 / 85 / 96 / 98 |
      | `SignalLink.ts` | 100 / 100 / 100 / 100 (47 Zweige) | 100 / 100 / 100 / 100 (47 Zweige, 126 statt 128 Statements) | Stufe 3: 100 / 95 / 100 / 100 |
      | `constants.ts` | 100 in allen vier | 100 in allen vier | Stufe 2: 100 in allen vier |
      **Keine neue Funktion in `link.ts`** — der Finalizer-Callback war schon eine, der Rumpf wächst nur; die Funktionszahl bleibt bei 5/5, und damit die Stelle ohne Luft (Querbezug aus Paket 5) unangetastet. Die vier neuen Zweige sind alle gedeckt; die vier ungedeckten Zweige der Datei sind dieselben wie vorher (die `gLinksCount > 0`-Wachen und die beiden `null`-Zweige in `unlink()`/`getLinksCount()`). `SignalLink.ts` **verliert** zwei Statements (die gestrichenen `#unsubscribe`-Zeilen) und keinen Zweig. Keine Datei muss aus einer Stufe wandern, `signal-core.ts` (12/14 Zweige, die engste Stelle des Laufs) wird nicht berührt.

  **F — welche bestehenden Tests nachziehen müssen**

  26. **Genau einer, und er ist benannt.** `src/SignalLink.spec.ts:529` sichert den Wortlaut `'[signalize] 2 errors while releasing SignalLink destroy-queue subscriptions'` zu und wird auf `'… while tearing down a SignalLink'` gezogen (Schritt 7). Der Titel des umgebenden `describe` (»S6: destroy() reports every failing destroy-queue release«) wird sinngemäß mitgezogen; die beiden Testrümpfe bleiben unverändert, `releaseOnDestroy()` existiert weiter und die Reihenfolge der Fehler (`release-a`, `release-b`) auch.
  27. **Alles andere bleibt grün, gemessen statt erwartet**: die vollständige Suite gegen die Zielfassung ist `42 Dateien / 448 Tests` grün, mit den sechs neuen `44 Dateien / 454 Tests`. Namentlich geprüft, weil sie die plausiblen Kandidaten wären: die drei vorhandenen Tests in `src/link.gc.spec.ts` (der dritte — »links on a live source are held until unlink()« — prüft die negative Aussage, die MEM-005 dokumentiert, und bleibt wörtlich richtig), `src/link.spec.ts` (636 Zeilen, darunter die Subscription-Bilanzen aus Paket 3), `src/unsubscribeEffect.spec.ts`, `src/SignalGroup.*.spec.ts`. Wird trotzdem einer rot, ist das ein Regressionsbefund, keine erwartete Nachführung.
- Verify: `pnpm world` (enthält seit Paket 5/6 `test:gc`, `test:smoke` und `checkPkgTypes`; `bundle` prüft mit, dass die neue Kante `link.ts → constants.ts` — die es ohnehin schon gibt — keinen Zyklus schließt). Die Gesamtzahl im `unit`+`gc`-Lauf muss **454** lauten (448 aus Paket 12 plus sechs neue). Weicht sie ab, fehlt ein Test oder es ist einer stillschweigend übersprungen worden. Zusätzlich, weil es ein Speicher-Finding ist: das Messskript aus der Vorbemerkung noch einmal gegen das gebaute `lib/` laufen lassen — `sigQ`/`destQ` müssen bei 10 000 fallengelassenen Paaren auf 0 stehen und der Heap unter 5 MB bleiben.
- Commit: `fix(link): release a collected link's queue subscriptions, and warn on an unbounded link register (MEM-001, MEM-005)`
- Abgleich (2026-08-07): **beide Findings unverändert vorhanden und selbst reproduziert** (Zahlen in der Vorbemerkung). MEM-001: die Fundstellen des Audits stimmen bis auf die Verschiebung durch Paket 8 — `gLinkFinalizer` steht auf `src/link.ts:76-80` (Audit `:76-80`), die Registrierung auf `:177`, der Konstruktor mit den ersten beiden Subscriptions auf `src/SignalLink.ts:75-112` (Audit `:81-96`), die dritte in `SignalLinkToSignal` auf `:475-490` (Audit `:417-422`). Paket 8 hat wie angekündigt `destroy()` umgebaut: `isDestroyed` steht jetzt als Erstes (`:348`), der DESTROY-Emit sitzt im Sammelmuster (`:384-388`), und `#propagationGeneration` (`:57`) sowie der zweite `isDestroyed`-Guard nach `action()` (`:455`) sind neu — nichts davon berührt die Subscription-Buchführung, der Abgleich lief ausschließlich über Symbolnamen. MEM-005: `gLinks` auf `src/link.ts:46-49` (Audit `:46-49`), die Registrierung in `link()` auf `:175-188` (Audit `:175-188`) — unverändert, inklusive des ausführlichen Kommentars, den das Finding zitiert. **Eine Abweichung von den Empfehlungen des Audits**, begründet in Schritt A.3: bei MEM-001 wird von den beiden gleichrangig angebotenen Varianten die zweite gewählt (Handles als Held-Value statt `off(queue, id)`), weil `off()` per Event-Namen auf einem **lebenden** Zielsignal fremde Abonnenten träfe. Bei MEM-005 keine Abweichung; die dort offene Frage »Dev-Mode« ist in Schritt B.9 entschieden, ohne neue öffentliche API.

**MEM-001 · high · src/link.ts:76-80 · src/SignalLink.ts:81-96 (jetzt :75-112) · src/SignalLink.ts:417-422 (jetzt :475-490)** — Die Queue-Subscriptions eines eingesammelten Links freigeben
Werden Link und Quellsignal gemeinsam unerreichbar, korrigiert `gLinkFinalizer` zwar `getLinksCount()` auf 0, aber niemand meldet die `on(globalSignalQueue, …)`- und `once(globalDestroySignalQueue, …)`-Subscriptions ab. Beide Queues sind Modul-Singletons und leben so lange wie der Prozess. Jeder explizite Teardown-Pfad räumt korrekt ab — nur der GC-Pfad nicht.
Empfehlung: dem `gLinkFinalizer` einen Held-Value mit der Signal-ID mitgeben und im Callback `off(globalSignalQueue, id)` / `off(globalDestroySignalQueue, id)` rufen, oder die Unsubscribe-Handles selbst als Held-Value registrieren.
Evidence (2026-08-07 selbst reproduziert): 10 000 fallengelassene Paare → `links=0 signals=10000 sigQ=10000 destQ=10000 heap=26,2MB` gegen `heap=4,3MB` in der Baseline; mit Signal-Zielen `destQ=20000`. Kontrollen (`link.destroy()`, `destroySignal(source)`): je `delta sigQ=0 delta destQ=0`. Mit der Zielfassung: `sigQ=0 destQ=0 heap=4,9MB`.

**MEM-005 · low · src/link.ts:46-49 · src/link.ts:175-188** — Das Link-Register gegen eine langlebige Quelle begrenzen
`gLinks` ist schwach auf die Quelle, aber stark auf die innere `Map`: jeder je angelegte Link bleibt am Leben, solange die Quelle erreichbar ist. `link(src, freshCallback)` auf einem heißen Pfad gegen eine langlebige Quelle wächst unbegrenzt, und jeder Write auf die Quelle bezahlt den Rückstand.
Empfehlung: Wenn das Design so bleibt, das Verhalten zur Laufzeit sichtbar machen: eine Dev-Mode-Warnung aus `link()`, sobald die Linkzahl pro Quelle eine Schwelle überschreitet.
Evidence (2026-08-07 selbst reproduziert): 1000 Writes auf eine Quelle kosten 0,60 ms ohne Links, 8,34 ms mit 100, 23,54 ms mit 500, 58,28 ms mit 1000 und 126,48 ms mit 2000; nach 8× `gc()` + Settle stehen die 2000 Links unverändert (`links(src)=2000 sigQ=2000 destQ=2000`), nach `unlink(src)` kosten dieselben 1000 Writes 0,05 ms.

#### [x] 14. Die fehlenden Gegenkanten beim Link-Teardown
- Findings: MEM-002 (medium), MEM-004 (medium)
- Ziel: Ein über `attachLink()` angehängter Link trägt sich beim Zerstören aus der Gruppe aus, und der letzte `asyncValues()`-Iterator schaltet das VALUE-Retainen wirklich ab.
- Bereich: `src/SignalGroup.ts`, `src/SignalLink.ts`, Specs, `docs/`, `skills/`
- Hängt ab von: —
- Modell: mittlere Stufe. Beide Fixes sind klein und vor der Planung vollständig gebaut und gemessen (Suite, `tsc`, Biome, Rollup, Smoke, Coverage, zwei Mutanten). Die Fallhöhe liegt nicht im Code, sondern in zwei Entscheidungen, die über den Wortlaut der Empfehlungen hinausgehen — die Gegenkante zieht von `SignalLink.attach()` nach `SignalGroup.attachLink()` um, und sie bekommt eine Priorität. Beide sind unten begründet und gegengemessen.
- Hash: `0063c52`
- Ergebnis (2026-08-07): MEM-002 und MEM-004 behoben, zwei Review-Runden. **Zwei Abweichungen von den Empfehlungen, beide an der eventize-Quelle belegt.** (a) Im `finally` steht `unretain` **allein** statt zusätzlich zu `retainClear` — `unretain` ruft `keeper.remove(name)`, das die Policy löscht **und** selbst `clear()` aufruft. (b) In `destroy()` entfällt die `retainClear`-Zeile ersatzlos, weil die Folgezeile `off(this)` schon `keeper.removeAll()` ruft; der Reviewer hat das an `lib/index.mjs:1732-1735` und `:240-243` nachgelesen und mit einem DESTROY-Listener gegengemessen, der `retain` neu setzt und ein VALUE nachschiebt (`names=[] count=0`).
  Bei MEM-002 trug der Dedup-Guard von `attachEffect()` nicht: `detachLink()` existiert, ein `#links.has()`-Guard wäre nach jedem Detach wieder offen. Stattdessen ein `WeakSet` neben `#links`, und **die Gegenkante zieht ganz von `SignalLink.attach()` nach `SignalGroup#attachLink()` um**; `#attachedGroups` entfällt (nachgewiesen: kein zweiter Leser). Der Reviewer hat den Umzug in sechs Formen geprüft — Link an mehreren Gruppen (trägt sich aus allen aus), fünf Detach/Attach-Zyklen (genau ein Hook), beide Routen an dieselbe und an verschiedene Gruppen, und dass das `WeakSet` nicht leckt.
  **Der Nebenbefund aus Paket 8 ist erledigt.** Die Gegenkante läuft mit `Priority.Max`; ein werfender DESTROY-Listener, der **vor** `attach()` registriert wurde, ließ die Gruppe bisher dauerhaft einen zerstörten, gefrorenen Link halten. Alle vier Kombinationen aus Route und Registrierungsreihenfolge, von Implementierer und Reviewer unabhängig gemessen: **1/1/1/0 → 0/0/0/0**.
  **Der Nebenbefund aus Paket 4 ist ebenfalls erledigt, und zwar nebenbei.** Er lautete, der ASYNC-005-Test könne seine Kernbehauptung nicht widerlegen, weil `retainClear()` die Retain-Policy stehen lässt. Genau das behebt MEM-004: seit dem Wechsel auf `unretain` tötet der Mutant `#activeAsyncValuesCount === 0` → `>= 0` den Test **isoliert**, während er auf `HEAD` grün bleibt. Der Test hat seine Zähne bekommen, statt sie zu behalten.
  **Drei überlebende Mutanten gefunden, zwei davon geschlossen.** `WeakSet` → `Set` überlebte alle 446 Tests und hätte jeden je angehängten Link dauerhaft festgehalten — MEM-002 in einer anderen Tasche; jetzt von einem GC-Test gedeckt, der in beide Richtungen beißt (fällt mit `Set` **und** mit ganz entfernter Gegenkante). `Priority.Max` → `Priority.Critical` überlebte alle 460 Tests und hätte das Schluckfenster von »Gleichstand, vorher registriert« auf »alles ab Critical, jederzeit« geöffnet; jetzt von einem Test mit `Number.MAX_SAFE_INTEGER` gedeckt. Der dritte (die tote `retainClear`-Zeile in `destroy()`) ist folgenlos.
  Verify selbst gelaufen: `pnpm world` Exit 0, 42 Dateien / **461 Tests** (Baseline 454). `SignalLink.ts` bleibt 100 in allen vier, `SignalGroup.ts` 97,8 / 87,71 → 97,84 / 87,93. GC-Tests je zehnmal beim Implementierer und beim Reviewer, ohne Schwankung.
- Beobachtbare Verhaltensänderungen (im CHANGELOG festgehalten): ein `'destroy'`-Listener sieht den Link jetzt **immer** schon ohne Gruppe, unabhängig von der Registrierungsreihenfolge; und ein selbst gesetztes `retain(link, 'value')` überlebt einen `asyncValues()`-Lauf nicht mehr.
- Dokumentierte Grenze: die `Priority.Max`-Zusage reicht genau so weit wie die Priorität. `Priority.Max` ist `+Infinity` und kein exklusiver Slot — ein Listener, der bei derselben Priorität **vor** dem Attach registriert wird und wirft, schluckt die Gegenkante weiterhin (gemessen `links=1`). Steht im CHANGELOG und im Quellkommentar.
- Nebenbefunde:
  - **Neu, aus Paket 14:** die Notiz aus Paket 8, `getLinksCount()` sei von einem werfenden DESTROY-Listener nie betroffen, weil `src/link.ts` seinen Buchhaltungs-Listener zuerst registriert, gilt **nur bei Prioritätsgleichstand**. Ein werfender Listener oberhalb von `Priority.Normal` überholt ihn und lässt den globalen Zähler dauerhaft zu hoch stehen (`src/link.ts:242`).
  - `attachEffect()` (`src/SignalGroup.ts:602`) hat dieselbe Lücke, die `Priority.Max` für Links schließt: ein werfender DESTROY-Listener, vor `attachEffect()` registriert, lässt den toten Effect in `#effects` stehen. Bewusst ausgeklammert.
  - `off(link)` von außen löscht die Gegenkante; der geschlossene `WeakSet`-Guard verhindert eine neue, und `destroy()` hinterlässt `links=1`. Vorbestehend im Muster — der alte `#attachedGroups`-Guard verhielt sich genauso. Kein CHANGELOG-Eintrag.
  - Marken-Kollision: `src/SignalLink.ts` und der `## Unreleased`-Block des CHANGELOG tragen `MEM-001`, `MEM-002` und `MEM-004` in je zwei Bedeutungen — aus dem Audit vom 2026-08-06 und dem vom 2026-08-07. Für den Abschluss vorgemerkt.
  - `src/SignalLink.ts` — nach diesem Paket steht genau eine Zeile ungeschützt hinter dem Sammeltopf von `destroy()`: `off(this)`. Sie ruft nur `store.removeAllListeners()` und `keeper.removeAll()`, also keinen Anwendungscode; ein `try` darum wäre ein Zweig, den kein Test auslösen kann.
- Dateien: `src/SignalGroup.ts`, `src/SignalLink.ts`, `src/SignalGroup.spec.ts`, `src/SignalLink.spec.ts`, `src/link.spec.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Alle Zahlen unten sind am 2026-08-07 gegen `63cfedd` selbst gemessen: die Reproduktionen gegen das frisch übersetzte `lib/`, die Zielfassung gegen eine vollständige Kopie des Repos im Scratchpad (`src/` gepatcht, `node_modules` verlinkt) mit Vitest 4, `tsc 7`, Biome, Rollup und dem Smoke-Runner, die Rot-Nachweise gegen eine zweite, ungepatchte Kopie mit denselben neuen Tests, und zwei Mutanten gegen die Zielfassung. Am Projektcode ist nichts angefasst worden; im Repo steht nur diese Datei.

  - **Reproduktion MEM-002** (100 Links, `group.attachLink(l)` + `l.destroy()`): `memberCounts {"effects":0,"links":100}` bei `getLinksCount() = 0` — die Gruppe hält hundert Leichen, das globale Register keine einzige. Zum Vergleich derselbe Ablauf über `link(sig, cb, {attach: host})`: `links: 0`. Eins zu eins die Evidence des Findings.
  - **Reproduktion MEM-004** (ein `asyncValues()`-Iterator, sauber mit `.return()` geschlossen): `nach iterator close: retainedCount=0 names=["value"]` → `nach unbeobachtetem Write: retainedCount=1` → `nextValue() nach einem Makrotask: RESOLVED:3`. Der frische Aufruf wartet nicht, er bekommt den Wert, den vorher niemand gehört hat. Ebenfalls eins zu eins die Evidence.

  **A — MEM-004: `unretain` statt `retainClear`, und was in `destroy()` daraus folgt**

  1. **Was die drei eventize-Funktionen tun**, an der Quelle gelesen (`node_modules/@spearwolf/eventize/lib/index.mjs`) und danach gemessen. Der `RetainKeeper` hält zwei Container: `eventNames` (die Policy — für welche Namen ein `emit()` seinen Wert ablegt) und `events` (die abgelegten Werte).
     - `retainClear(obj, name)` → `keeper.clear(name)`: löscht **nur** den Eintrag aus `events`. Die Policy bleibt.
     - `unretain(obj, name)` → `keeper.remove(name)`: löscht den Namen aus `eventNames` **und** ruft am Ende selbst `this.clear(eventNames)`. Der gespeicherte Wert geht also mit.
     - Gemessen an einem nackten eventize-Objekt: `retain` + `emit` → `count=1 names=["x"]`; `retainClear` → `count=0 names=["x"]`; erneutes `emit` → `count=1 names=["x"]` (der Slot füllt sich wieder). Dagegen `unretain` → `count=0 names=[]`.
     - **Damit ist `retainClear` neben `unretain` überflüssig.** Es kommt genau einer der beiden in den `finally`-Block, und das ist `unretain`.
  2. **Der Fix in `asyncValues()`** — `src/SignalLink.ts`, der `finally`-Block am Ende des Generators, eine Zeile plus Kommentar:
     ```ts
     } finally {
       this.#activeAsyncValuesCount -= 1;
       if (this.#activeAsyncValuesCount === 0) {
         // MEM-004: `unretain`, nicht `retainClear`. Das eine räumt den
         // Slot, das andere nimmt die Policy mit — und nur die Policy ist
         // hier das Problem. Nach einem `retainClear()` bleibt VALUE
         // retained: jeder weitere propagierte Wert landet im Slot, ohne
         // dass irgendjemand zuhört, und der nächste `once(this, VALUE, …)`
         // — aus `nextValue()`, also aus dem eigenen Vertrag — bekommt ihn
         // synchron im Registrierungsaufruf repliziert, statt auf den
         // nächsten zu warten. `unretain` löscht den gespeicherten Wert
         // ohnehin mit (eventize: `keeper.remove()` ruft `clear()`), also
         // steht hier eines statt zweier.
         unretain(this, VALUE);
       }
     }
     ```
     Der Import wechselt entsprechend: `retainClear` fällt aus der Importliste von `src/SignalLink.ts` heraus, `unretain` kommt hinein — `retain` bleibt.
  3. **Abweichung von der Empfehlung: in `destroy()` kommt kein `unretain`, dort entfällt die Zeile ersatzlos.** Die Empfehlung verlangt den Aufruf an beiden Stellen. Gemessen ist `retainClear(this, VALUE)` in `destroy()` aber schon heute wirkungslos, weil die **nächste** Zeile `off(this)` ist und `off()` ohne Listener-Argument (`listener == null`) `keeper.removeAll()` ruft — Policy und Werte in einem Zug, für alle Namen. Beleg an der Quelle (`off()` in `lib/index.mjs`) und an der Messung: auf HEAD steht ein Link nach `destroy()` bereits auf `count=0 names=[]`, obwohl `retainClear` die Policy nicht anfasst. Eine Zeile, die nichts tut, wird nicht durch eine andere ersetzt, die ebenfalls nichts tut. Sie geht weg, und an ihre Stelle tritt ein Kommentar über `off(this)`, der sagt, warum dort nichts mehr steht.
  4. **Kein Nachlauf-Risiko am gefrorenen Link.** Wird ein Link zerstört, während ein `asyncValues()`-Iterator noch offen ist, läuft dessen `finally` erst danach — `unretain(this, VALUE)` trifft dann ein `Object.freeze`tes Objekt. Gemessen: kein Wurf, `count=0 names=[]` vorher wie nachher. Der Keeper hängt nicht am eingefrorenen Objekt selbst, und `retainClear` stand an derselben Stelle vor demselben Fall.
  5. **Ein bekannter Rand, der bleibt.** Wer selbst `retain(link, VALUE)` ruft und danach `asyncValues()` benutzt, verliert seine Policy, wenn der letzte Iterator endet. Das ist keine neue Übergriffigkeit, sondern die alte zu Ende gedacht: `asyncValues()` ruft `retain` und `retainClear` auf VALUE schon immer unbedingt und beansprucht den Namen damit für sich. Nirgends in `docs/` oder `skills/` steht ein Muster, das einem Aufrufer diesen Namen zusichert. Bekommt einen Halbsatz in `docs/api.md`, keinen Test.

  **B — MEM-002: wo die Gegenkante hingehört, und welcher Guard sie hält**

  6. **Was `attachEffect()` tut, und warum sein Guard hier nicht trägt.** `attachEffect()` (`src/SignalGroup.ts:602`) prüft `if (!this.#effects.has(effect))` und registriert im Ja-Fall `once(effect, DESTROY, …)`. Der Guard ist dort tragfähig, weil es **kein `detachEffect()` gibt** — ein lebender Effect verlässt `#effects` nie wieder, der Zustand »schon drin« ist also dauerhaft und der Hook wird genau einmal registriert. Für Links gilt das nicht: `detachLink()` ist dokumentierte öffentliche API (`docs/api.md:516`, `cheat-sheet.md:135`) und leert `#links` für einen **lebenden** Link. Ein `#links.has(link)`-Guard wäre damit nach jedem Detach wieder offen, und jeder Detach/Attach-Zyklus hinge dem Link einen weiteren DESTROY-Listener an, unbegrenzt. Genau der Fehler, vor dem der Kommentar über `attachEffect()` warnt — nur eine Ebene tiefer. **Die Empfehlung »mit demselben Dedup-Guard« geht deshalb am Code vorbei und wird nicht wörtlich umgesetzt.**
     Gemessen am Mutanten, der sie wörtlich nimmt (`const known = this.#links.has(link)` vor dem `add`): fünf Detach/Attach-Zyklen ergeben `expected 7 to be 2` — fünf zusätzliche Subscriptions auf dem Link, und der Test aus Schritt 14 fängt es.
  7. **Der Guard ist ein `WeakSet` neben `#links`.** Ein zweites `Set` wäre ein neuer starker Halter für Links, die `detachLink()` gerade losgelassen hat — die Gruppe soll sie aber loslassen. Ein `WeakSet` beantwortet die einzige Frage, die gestellt wird (»habe ich für diesen Link hier schon einen Hook?«), hält nichts fest und braucht kein Aufräumen. Neues Feld in `src/SignalGroup.ts`, direkt unter `#links`:
     ```ts
     readonly #links = new Set<SignalLink<any>>();

     // MEM-002: für welche Links diese Gruppe ihre DESTROY-Gegenkante schon
     // registriert hat. Nicht `#links.has(link)` als Guard: `detachLink()`
     // ist öffentlich und nimmt einen *lebenden* Link wieder heraus, jeder
     // Detach/Attach-Zyklus würde also einen weiteren Listener anhängen.
     // Und kein zweites `Set`: das wäre ein neuer starker Halter für genau
     // die Links, die `detachLink()` gerade freigegeben hat.
     readonly #linksWithDestroyHook = new WeakSet<SignalLink<any>>();
     ```
  8. **Die Gegenkante zieht ganz nach `attachLink()` um** — und `SignalLink.attach()` gibt seine eigene ab. Die Alternative (beide behalten je einen Hook) ist gemessen und verworfen: sie kostet pro (Link, Gruppe) zwei DESTROY-Listener statt einem, wo beide dasselbe `Set.delete` tun. `attachLink()` ist die Stelle, durch die **beide** Wege ohnehin laufen — `attach()` ruft sie unbedingt als Erstes —, also ist sie der einzige Ort, an dem eine Registrierung pro Paar garantiert werden kann.
     ```ts
     attachLink(link: SignalLink<any>) {
       if (link?.isDestroyed) {
         throw new Error('Cannot attach a destroyed link to a group');
       }

       if (link) {
         this.#links.add(link);
         if (!this.#linksWithDestroyHook.has(link)) {
           this.#linksWithDestroyHook.add(link);
           // MEM-002: die Gegenkante zu `attachEffect()`s Hook. Sie sitzt
           // hier und nicht in `SignalLink.attach()`, weil `attachLink()`
           // der gemeinsame Durchgang beider Wege ist — `link({attach})`
           // und `link.attach(obj)` kommen hier vorbei, ein direkter
           // `group.attachLink(link)` ebenso. Ohne sie blieb ein so
           // angehängter Link nach `destroy()` in `#links` stehen und hielt
           // sein Quell-SignalImpl und seine Callback-Closure für die
           // Lebensdauer der Gruppe fest.
           //
           // Priority.Max: eventize bricht die Zustellung an einem
           // werfenden Listener ab. Bei Normalpriorität entschied damit die
           // Registrierungsreihenfolge, ob diese Zeile je läuft — ein
           // Anwendungs-Listener, der vor dem Attach registriert wurde und
           // wirft, verschluckte sie. Buchführung der Gruppe geht vor
           // Anwendungscode.
           once(link, DESTROY, Priority.Max, () => {
             this.#links.delete(link);
           });
         }
       }

       return link;
     }
     ```
     `Priority` kommt dafür in den eventize-Import von `src/SignalGroup.ts`. Signatur beachten: die Priorität steht **zwischen** Eventname und Listener (`once(obj, name, priority, listener)`) — gemessen, `once(obj, priority, name, listener)` registriert stillschweigend nichts Wirksames.
  9. **`SignalLink.attach()` schrumpft auf drei Zeilen**, und das Feld `#attachedGroups` entfällt ersatzlos — es existierte ausschließlich als Guard für den Hook, der jetzt woanders wohnt:
     ```ts
     attach(to: object) {
       const group = SignalGroup.findOrCreate(to);
       group.attachLink(this);
       return group;
     }
     ```
     Der lange Kommentarblock darüber (`src/SignalLink.ts:159-177`) wandert inhaltlich nach `attachLink()` und verschwindet hier. Was von ihm sachlich richtig bleibt und drüben gebraucht wird: eventize dedupliziert Funktionslistener **nicht** (`isSimilar()` greift nur für `LISTENER_IS_OBJ` und `LISTENER_IS_NAMED_FUNC`), ein Hook braucht also einen eigenen Guard. Was wegfällt, weil es nur noch von `attachLink()` handelt: der Absatz über den unbedingten `attachLink()`-Aufruf. Der bleibt trotzdem wahr — `attach()` ruft es weiterhin unbedingt, und der Test in `src/link.spec.ts:591` prüft genau das.
  10. **Der Fall »beide Wege«, gemessen.** `link(sig, cb, {attach: host})`, danach zweimal `group.attachLink(l)`: die Zielfassung registriert **einen** Hook, weil `attach()` selbst durch `attachLink()` geht und das `WeakSet` danach zumacht. Zahlen (`getSubscriptionCount(link)`, HEAD → Zielfassung): `group.attachLink(l)` allein 1 → 2 (die Gegenkante kommt hinzu); `l.attach(host)` 2 → 2; `l.attach(host)` + 2× `attachLink(l)` 2 → 2; 5× `l.attach(host)` 2 → 2; 5× Detach+Attach 2 → 2. Kein Weg und keine Kombination wächst.
  11. **Der Paket-8-Nebenbefund ist damit erledigt, nicht nur umgangen.** Werfer vor `attach()` registriert, HEAD: `memAfter 1` über `attachLink()` und `memAfter 1` über `attach()`; Werfer danach: `memAfter 0` über `attach()`, `memAfter 1` über `attachLink()`. Zielfassung: **`memAfter 0` in allen vier Kombinationen**, der Fehler des Werfers verlässt `destroy()` unverändert (`escaped: "boom"`). Die Priorität ist der ganze Unterschied — sie ist die »Reihenfolge der Registrierung«, die man tatsächlich in der Hand hat, weil eventize nach Priorität sortiert und erst danach nach Registrierungszeitpunkt. Ohne Per-Listener-Isolation bleibt eventize für alles **andere**, was an einem werfenden DESTROY-Listener hängt, unverändert abbruchfreudig; was die Gruppenmitgliedschaft angeht, hängt nichts mehr daran.
  12. **Die eine beobachtbare Folge der Priorität**, benannt statt verschwiegen: ein DESTROY-Listener auf dem Link sieht die Gruppe jetzt **immer** ohne diesen Link, egal wann er registriert wurde. Gemessen, HEAD → Zielfassung: `user-vor-attach: 1 → 0`, `user-nach-attach: 0 → 0`. Die Änderung vereinheitlicht also einen Zustand, der bisher von der Registrierungsreihenfolge abhing. Öffentlich lesbar ist er ohnehin nicht — `SignalGroup#memberCounts` ist `@internal` und hat außer `assert-helpers.ts` keinen Konsumenten, und eine öffentliche »hängt Link X an Gruppe Y«-Abfrage gibt es nicht. Zusätzlich passt der neue Zustand zu dem, was BUG-002 aus Paket 8 hergestellt hat: `isDestroyed` ist in einem DESTROY-Listener längst `true`, eine Gruppe, die den Link zu diesem Zeitpunkt noch führt, war der Ausreißer.
  13. **`attachEffect()` bekommt die Priorität ausdrücklich nicht.** Dieselbe Lücke existiert dort — ein werfender DESTROY-Listener, der vor `group.attachEffect(effect[$effect])` registriert wurde, lässt den toten Effect in `#effects` stehen. Sie ist aber deutlich schwerer zu treffen: der übliche Weg ist `createEffect(cb, {attach})`, und dort hängt der Konstruktor den Effect an (`src/EffectImpl.ts:332`), bevor der Aufrufer die Instanz überhaupt in der Hand hält. MEM-002 handelt von Links; die Effect-Seite wandert als Nebenbefund in diesen Plan und wird hier nicht angefasst.

  **C — die Tests, rot zuerst**

  14. **Test 1 — `src/link.spec.ts`**, direkt vor `re-attach after an explicit detachLink() actually re-attaches …` (Zeile 591), weil dort schon das Zusammenspiel der beiden Attach-Wege geprüft wird: `it("no combination of the two attach routes grows the link's DESTROY listener list (MEM-002)")`. Baseline nach dem ersten `con.attach(groupObject)` festhalten, dann fünfmal die Runde `attach` → `group.attachLink` → `group.detachLink` → `attach`, danach `expect(getSubscriptionCount(con)).toBe(baseline)`. Zweite Aussage im selben Test: eine **zweite** Gruppe kostet genau einen Listener mehr (`toBe(baseline + 1)`). **Auf HEAD ist dieser Test grün** — er ist kein Regressionstest für MEM-002, sondern der Wächter gegen die zwei Fehler, die der naive Fix macht. Beide sind als Mutant gegen die Zielfassung gemessen und werden gefangen: `#links.has()`-Guard → `expected 7 to be 2`; `attach()` behält seinen eigenen Hook zusätzlich → `expected 5 to be 4`. `getSubscriptionCount` ist in der Datei bereits importiert.
  15. **Test 2 und 3 — `src/SignalGroup.spec.ts`**, im `links`-Block, vor `detachLink() removes a link from the group but does not destroy it` (Zeile 576), unter einem gemeinsamen `describe('MEM-002: a destroyed link takes itself out of the group')`:
      - `it('attachLink() alone is enough — the counter-edge does not depend on attach()')`: `group.attachLink(signalLink)`, `getGroupMemberCounts(group).links` ist 1, `signalLink.destroy()`, dann `expect(getGroupMemberCounts(group).links).toBe(0)`. Auf HEAD **rot**, gemessen `expected 1 to be +0`.
      - `it('a throwing DESTROY listener registered before the attach cannot stop it')`: `once(signalLink, DESTROY, () => { throw new Error('boom') })` **vor** `group.attachLink(signalLink)`, dann `expect(() => signalLink.destroy()).toThrow('boom')` und `expect(getGroupMemberCounts(group).links).toBe(0)`. Auf HEAD **rot**, isoliert gemessen `expected 1 to be +0` an der zweiten Assertion — das ist der Paket-8-Nebenbefund als Test. `once` kommt dafür in den eventize-Import der Datei (heute `getSubscriptionCount, on`), `DESTROY` und `getGroupMemberCounts` sind bereits da.
  16. **Test 4 und 5 — `src/SignalLink.spec.ts`**, ein neuer `describe('MEM-004: the last asyncValues() iterator switches VALUE retaining off')` zwischen dem ASYNC-005-Block (endet Zeile 459) und dem S6-Block (beginnt Zeile 461). **Bewusst nicht in der Bauart des ASYNC-005-Tests**, und der Kommentar über den beiden sagt warum: jener Test braucht sein `sigA.set(3)` zwischen `iter1.return()` und `iter2.next()`, um überhaupt etwas über den Geschwister-Iterator aussagen zu können — und genau dieser Write füllt den Slot neu, ganz gleich ob die Policy noch steht. Er kann den Unterschied nicht sehen; er sagt das inzwischen selbst, in seinem eigenen Kommentar (Zeilen 447-450). Die beiden neuen Tests sehen ihn, weil sie das Gegenteil tun: sie schreiben nach dem letzten Iterator und behaupten, dass **nichts** hängen bleibt.
      - `it('drops the retain policy, not just the stored value', {timeout: 1000})`: ein Iterator, ein Wert, `await iter.return(…)`, dann `expect(getRetainedEventNames(con)).toEqual([])` — auf HEAD **rot**, gemessen `expected [ 'value' ] to deeply equal []`. Danach ein unbeobachteter `sigA.set(3)` und `expect(getRetainedCount(con)).toBe(0)`, was dieselbe Aussage ohne Namensliste noch einmal trifft.
      - `it('so a later nextValue() waits for the next value instead of resolving with an old one', {timeout: 1000})`: derselbe Aufbau, danach `sigA.set(3)` ohne Zuhörer, dann `con.nextValue()`, ein `setImmediate`-Makrotask, und **`expect(settled).toBe('PENDING')`** — auf HEAD **rot**, gemessen `expected 3 to be 'PENDING'`. Zum Schluss `sigA.set(4)` und `await expect(pending).resolves.toBe(4)`. Das ist die Kernbehauptung des Findings, und sie hängt an keiner eventize-Interna: eine retainte Wiedergabe läuft **synchron im `once()`-Aufruf**, wäre also lange vor dem Makrotask gelandet. Derselbe Makrotask-Marker wie im ASYNC-005-Test, in die andere Richtung gelesen — dort gewinnt der Sentinel nur bei einem hängenden Read, hier nur bei einem *nicht* hängenden.
      `getRetainedCount` und `getRetainedEventNames` kommen dafür in den eventize-Import der Datei; das Muster (Zählfunktionen direkt aus eventize, nicht über `assert-helpers.ts`) ist das der `CLAUDE.md`.
  17. **Ein Hinweis für den Rot-Lauf.** Alle vier roten Tests hinterlassen im Fehlerfall ihr Signal, weil die Aufräumzeilen hinter der scheiternden Assertion stehen; die `beforeEach`/`afterEach`-Wächter der Dateien melden das als Folgefehler in den Nachbartests. Beim Rot-Nachweis einzeln laufen lassen (`pnpm test -- -t "…"`), sonst liest man Kollateralschaden statt Befund.

  **D — die Doku, in der Reihenfolge aus `CLAUDE.md`**

  18. Source-JSDoc: erledigt in den Schritten 2, 3, 7, 8 und 9. Dazu drei Kommentare in `src/SignalLink.ts`, die heute `retainClear()` als das benennen, was am Ende eines Iterators passiert, und auf `unretain()` umgeschrieben werden müssen: das Feldkommentar über `#activeAsyncValuesCount` (Zeile 63-65), der Caveat-Absatz im JSDoc von `asyncValues()` über nicht geschlossene Generatoren (Zeile 310-320, »so `retainClear()` never runs again for this link«) und der Absatz über den geteilten Slot (Zeile 302-308), dessen »released only once the last active iterator stops« jetzt wörtlich stimmt. Im JSDoc von `attachLink()` kommt der Satz dazu, dass ein zerstörter Link sich selbst austrägt — Vorbild ist der gleichlautende Absatz über `attachEffect()` (Zeile 595-597).
      **Achtung bei der Wortwahl in `src/SignalLink.ts`:** die Datei benutzt `MEM-002` und `MEM-004` bereits als Marken eines **früheren** Audits (Zeile 38 und 379: `destroy()` gibt die Queue-Handles frei; Zeile 94: die `WeakRef`-Selbstreferenz). Zwei Bedeutungen derselben Marke in einer Datei, dreihundert Zeilen auseinander. Die neuen Kommentare bekommen deshalb einen Zusatz, der sie unterscheidbar macht (»MEM-004 — die Retain-Policy, nicht die Queue-Handles oben«), und die bestehenden Marken bleiben unangetastet.
  19. `docs/api.md:361`, Zeile `attach(obj)` der Link-Tabelle: »Idempotent — attaching the same group again is a no-op, it does not register a second cleanup listener« wird geschärft. Wahr bleibt der zweite Halbsatz, und er gilt jetzt für **beide** Wege; der erste stimmt so nicht mehr (und stimmte seit dem Detach-Fix in `link.spec.ts:591` schon nicht): ein erneutes `attach()` stellt die Mitgliedschaft wieder her, wenn ein `detachLink()` dazwischenlag. Neuer Text in dieser Richtung, eine Zelle.
  20. `docs/api.md:385-390`, der Absatz über den geteilten Retain-Slot: »released once the last of them stops« bleibt, bekommt aber den Satz dazu, dass danach **nicht mehr retaint** wird — ein `nextValue()` nach dem letzten Iterator wartet auf den nächsten Wert und löst nicht mit einem alten auf. Dazu der Rand aus Schritt 5: `asyncValues()` beansprucht die Retain-Policy des `'value'`-Events für sich und gibt sie am Ende ab, ein selbst gesetztes `retain(link, VALUE)` überlebt das nicht.
  21. `docs/api.md:516`, die `SignalGroup`-Zeile `attachLink(link)` / `detachLink(link)`: »Track / untrack a link« bekommt den Zusatz, dass ein zerstörter Link sich selbst austrägt, gleich über welchen Weg er angehängt wurde. Die Nachbarzeile `attachEffect(eff)` (515) sagt das über Effects heute ebenfalls nicht — sie bleibt trotzdem unberührt, weil Schritt 13 die Effect-Seite ausdrücklich nicht anfasst.
  22. `docs/recipes.md:599-603`, der Aufzählungspunkt zum geteilten Slot: »it's cleared only once the last iterator stops« → dass er dann **abgeschaltet** wird, samt der Folge für ein späteres `nextValue()`. Ein Satz, kein neuer Punkt.
  23. `docs/cheat-sheet.md:102`, der Kommentar hinter der `asyncValues()`-Zeile (`… shared retain across parallel iterators; abort THROWS, destroy ends quietly`): `shared retain` → `shared retain, dropped after the last iterator`. `docs/cheat-sheet.md:135` (`g.attachLink(l);   g.detachLink(l);`) bekommt am Zeilenende den Zusatz, dass ein zerstörter Link sich selbst austrägt.
  24. `skills/using-signalize/references/api.md:175-178` (der Absatz über den geteilten Slot) und `:204` (`g.attachLink(l);    g.detachLink(l);`) analog zu den Schritten 20 und 21. `references/pitfalls.md:81` (Pitfall 17) sagt bereits »Re-passing the same group (on a cache hit, or via a direct `link.attach(g)` call) is itself idempotent and safe to do every render or effect rerun« — das ist nach dem Umbau **gemessen** wahr geblieben und wird um `group.attachLink(l)` als dritten Weg ergänzt. `SKILL.md` bleibt unberührt: keine der sechs Kernaussagen redet über Retain-Slots oder Gruppen-Mitgliedschaft einzelner Links.
  25. `README.md` und `AGENTS.md` bleiben unberührt — `attachLink` kommt in beiden nicht vor, und die »API at a glance« nennt weder `nextValue()` noch `asyncValues()` mit einer Zusage über ihr Timing.
  26. `CHANGELOG.md`, unter `## Unreleased` → `### Bug Fixes`, ans Ende, englisch, ein Fakt pro Zeile:
      - dass ein Link, der über `SignalGroup#attachLink()` angehängt wurde, sich beim Zerstören aus der Gruppe austrägt — bisher tat das nur ein über `link(…, {attach})` oder `link.attach(obj)` angehängter, und ein direkt angehängter blieb samt Quell-`SignalImpl` und Callback-Closure für die Lebensdauer der Gruppe in `#links` stehen (MEM-002);
      - dass diese Gegenkante mit `Priority.Max` zugestellt wird und deshalb auch dann läuft, wenn ein anderer `'destroy'`-Listener desselben Links wirft — eventize bricht die Zustellung an einem werfenden Listener ab, und bis hierher entschied die Registrierungsreihenfolge darüber, ob die Gruppe ihren toten Link losbekam. Nebenwirkung, ausdrücklich genannt: ein `'destroy'`-Listener sieht den Link jetzt in keinem Fall mehr in der Gruppe (MEM-002);
      - dass der letzte `asyncValues()`-Iterator das Retainen von `'value'` abschaltet statt nur den gespeicherten Wert zu löschen. Bis hierher schaltete der erste `asyncValues()`-Aufruf einen Link dauerhaft in den Retain-Modus: jeder weitere propagierte Wert landete im Slot, ohne Zuhörer, und ein späteres `nextValue()` löste synchron mit diesem alten Wert auf, statt auf den nächsten zu warten (MEM-004).
      Die Marken kollidieren im selben `## Unreleased`-Block mit denen des Audits vom 2026-08-06 (die dortigen MEM-002- und MEM-004-Zeilen meinen anderes). Das ist Bestand — der Block trägt schon zwei Bedeutungen von MEM-001 —, und dieses Paket erfindet dafür keine neue Konvention; es steht als Nebenbefund für den Abschluss unten.

  **E — Coverage**

  27. **Gemessen, nicht geschätzt** (voller Lauf mit `--coverage`, `unit` + `gc`, Baseline gegen Zielfassung): global unverändert `99,07 / 94,36 / 99,52 / 99,61`, Branch-Gesamtzahl beide Male 461. `SignalLink.ts` taucht in keiner der beiden Uncovered-Tabellen auf, steht also weiter auf 100 in allen vier — die enge Stelle aus Paket 5 (»nur zwei ungedeckte Zweige«) wird nicht angerührt, weil der neue Zweig in `SignalGroup.ts` sitzt und die beiden alten in `SignalLink.attach()` mit dem Feld verschwinden. `SignalGroup.ts` **verbessert** sich von `97,8 / 87,71 / 100 / 99,22` auf `97,84 / 87,93 / 100 / 99,24`; die Luft von 2 Statements, 3 Zweigen und 3 Zeilen bleibt unberührt. Keine Datei muss aus Stufe 2 oder 3 in Stufe 1 wandern, keine Schwelle schlägt an, und `signal-core.ts` (12 von 14 Zweigen) wird nicht berührt.

  **F — welche bestehenden Tests nachziehen müssen**

  28. **Erwartung: keiner, und das ist gemessen** — voller Lauf der Zielfassung: 42 Dateien, **459** Tests, alle grün, gegen 454 auf der Baseline. Namentlich geprüft, weil sie die plausiblen Kandidaten sind:
      - `src/SignalLink.spec.ts:407` (ASYNC-005, der geteilte Retain-Slot) — **grün**. Das ist die Zusage aus dem Querbezug oben: der Makrotask-Marker schlägt nur bei einem hängenden Read an, und `iter2` liest weiterhin, solange es lebt. Wäre er rot geworden, wäre das ein Regressionsbefund gewesen.
      - `src/SignalLink.spec.ts:207` (K1, synchrone Retain-Wiedergabe in `nextValue({signal})`) und `:266` (keine anhäufenden Abort-Listener bei retaintem VALUE) — beide arbeiten **innerhalb** einer laufenden Iteration, wo VALUE unverändert retaint ist. Grün.
      - `src/link.spec.ts:565-589` (`attach()` auf dem `link()`-Cache-Hit-Pfad, `getSubscriptionCount(con1)` gegen eine Baseline) und `:591` (Re-Attach nach `detachLink()`) — beide grün. Der Kommentar des zweiten erklärt sich heute über `#attachedGroups`, das Feld, das dieses Paket löscht; er wird mitgezogen, die Aussage des Tests bleibt Wort für Wort dieselbe.
      - `src/SignalGroup.spec.ts:544-620` (`attachLink`/`detachLink`/`clear()`) und `:887-901` (`attachLink(null)`, `detachLink(undefined)`) — grün; der neue Block liegt hinter dem `if (link)`-Guard.
      - `src/SignalGroup.gc.spec.ts` und `src/link.gc.spec.ts` — grün, im vollen Lauf enthalten. Die neue Gegenkante hält über ihre Closure die Gruppe fest, aber am Link, und ein Link an einer Gruppe war nach dem Paket-13-Querbezug ohnehin nie einsammelbar; für den umgekehrten Fall (Link detached und fallengelassen) verschwindet mit dem Link auch seine Subscription.
      - `smoke/dist-smoke.test.ts` — 4/4 grün gegen das frisch gebaute `dist/`; `pnpm bundle` läuft ohne `CIRCULAR_DEPENDENCY` (der neue `Priority`-Import kommt aus eventize, kein neuer paketinterner Rand), `tsc -p tsconfig.lib.json` sauber, `biome check src` ohne Befund an den Quelldateien.
      Wird trotzdem einer rot, ist das ein Regressionsbefund, keine erwartete Nachführung.
- Verify: `pnpm world` (enthält seit Paket 5/6 `test:gc`, `test:smoke` und `checkPkgTypes`). Die Gesamtzahl im `unit`+`gc`-Lauf muss **459** lauten (454 aus Paket 13 plus fünf neue); der Smoke-Test kommt mit `node --test` separat dazu (4). Weicht die Zahl ab, fehlt ein Test oder es ist einer stillschweigend übersprungen worden.
- Commit: `fix(group,link): take a destroyed link out of its group, and stop retaining VALUE after the last asyncValues() iterator (MEM-002, MEM-004)`
- Abgleich (2026-08-07): **beide Findings unverändert vorhanden und selbst reproduziert.** Die Fundstellen sind über Symbolnamen abgeglichen, wie es die Querbezüge zu den Paketen 8 und 13 verlangen. MEM-002: `SignalGroup#attachLink()` steht auf `src/SignalGroup.ts:640-650` (Audit `:612-622`, das ist heute `attachEffect()`s Hook plus `runEffects()`), die Gegenkante in `SignalLink.attach()` auf `src/SignalLink.ts:156-188` (Audit `:112-144`). MEM-004: `retain(this, VALUE)` steht auf `src/SignalLink.ts:326` (Audit `:282`), der `finally`-Block auf `:356-361` (Audit `:312-317`), das `retainClear(this, VALUE)` in `destroy()` auf `:423`. Paket 13 hat wie angekündigt keine der vier Stellen inhaltlich angefasst. **Zwei Abweichungen von den Empfehlungen des Audits**, beide oben begründet und gemessen: der Dedup-Guard ist ein `WeakSet` statt `#links.has()` (Schritt 6), und in `destroy()` entfällt `retainClear(this, VALUE)` ersatzlos, statt durch `unretain` ersetzt zu werden (Schritt 3). Dazu eine Erweiterung über die Empfehlung hinaus: die Gegenkante wird mit `Priority.Max` registriert (Schritte 11 und 12), was den Nebenbefund aus Paket 8 erledigt.
- **Nebenbefund 1, für den Abschluss vorgemerkt:** `attachEffect()` hat dieselbe Lücke, die die Priorität für Links schließt — ein werfender DESTROY-Listener, der **vor** `group.attachEffect(effect[$effect])` registriert wurde, lässt den toten Effect in `#effects` stehen. Sie ist schwerer zu treffen als die Link-Variante, weil der übliche Weg `createEffect(cb, {attach})` den Effect im Konstruktor anhängt (`src/EffectImpl.ts:332`), bevor der Aufrufer die Instanz hat. Das Audit führt dafür kein Finding, und dieses Paket fasst die Effect-Seite nicht an.
- **Nebenbefund 2, für den Abschluss vorgemerkt:** die Findings-Marken des Audits vom 2026-08-07 kollidieren mit denen vom 2026-08-06, sowohl in den Quellkommentaren (`src/SignalLink.ts` trägt zwei Bedeutungen von `MEM-002` und `MEM-004`) als auch im `## Unreleased`-Block des `CHANGELOG.md` (dort zusätzlich zwei Bedeutungen von `MEM-001`). Der Bestand schreibt die Marken nackt, dieses Paket bricht damit nicht; ein Leser, der einer Marke folgt, landet trotzdem mit 50 % Wahrscheinlichkeit beim falschen Befund.
- **Nebenbefund 3, klein:** nach diesem Paket steht in `SignalLink.destroy()` genau eine Zeile ungeschützt hinter dem Sammeltopf, `off(this)`. Sie bleibt dort, mit Begründung: `off(obj)` ohne Listener-Argument läuft in `store.removeAllListeners()` und `keeper.removeAll()`, beides reine Buchführung ohne einen einzigen Aufruf von Anwendungscode (an der eventize-Quelle geprüft). Ein `try` darum wäre ein Zweig, den kein Test auslösen kann — auf einer Datei, die bei den Zweigen laut Paket 5 genau zwei Ausfälle verträgt und heute keinen hat. Der Nebenbefund aus Paket 13 ist damit zur Hälfte eingelöst (`retainClear` ist weg) und zur Hälfte beantwortet.

**MEM-002 · medium · src/SignalGroup.ts:612-622 (jetzt :640-650) · src/SignalLink.ts:112-144 (jetzt :156-188)** — Zerstörte Links aus einer Gruppe entfernen, die sie über `attachLink()` bekommen hat
`attachEffect()` registriert einen `once(effect, DESTROY, …)`-Hook, damit ein zerstörter Effect sich selbst austrägt. `attachLink()` hat keinen — die Gegenkante lebt in `SignalLink.attach()` und läuft nur, wenn der Link über `link(…, {attach})` oder `link.attach(obj)` angehängt wurde. `SignalGroup#attachLink(link)` ist dokumentierte öffentliche API, und ein so angehängter Link bleibt nach `destroy()` in `#links` stehen und hält sein Quell-`SignalImpl` und seine Callback-Closure für die Lebensdauer der Gruppe erreichbar.
Empfehlung: Denselben `once(link, DESTROY, () => this.#links.delete(link))`-Hook in `attachLink()` registrieren, den `attachEffect()` bereits nutzt, mit demselben Dedup-Guard.
Evidence (2026-08-07 selbst reproduziert): `1) attachLink + destroy -> memberCounts {"effects":0,"links":100} | global links = 0` / `2) link({attach}) + destroy -> memberCounts {"effects":0,"links":0}`. Dazu selbst gemessen, was die Empfehlung nicht sagt: `detachLink()` ist öffentlich, ein `#links.has()`-Guard wäre nach jedem Detach wieder offen (Mutant: fünf Zyklen → fünf zusätzliche DESTROY-Listener), und ein Werfer **vor** dem Attach verschluckt die Gegenkante bei Normalpriorität (`memAfter 1`), bei `Priority.Max` nicht mehr (`memAfter 0`, in allen vier Kombinationen aus Route und Reihenfolge).

**MEM-004 · medium · src/SignalLink.ts:282 (jetzt :326) · src/SignalLink.ts:312-317 (jetzt :356-361)** — VALUE nicht mehr retainen, wenn der letzte `asyncValues()`-Iterator endet
`asyncValues()` ruft beim Eintritt `retain(this, VALUE)` und im `finally` `retainClear(this, VALUE)`, sobald der Iterator-Zähler 0 erreicht. `retainClear` verwirft aber nur den gespeicherten Wert — es schaltet das Retainen nicht ab, das täte `unretain`. Der erste `asyncValues()`-Aufruf schaltet VALUE damit dauerhaft in den Retain-Modus: jeder weitere propagierte Wert landet im Retain-Slot, ohne dass jemand zuhört, und ein späteres `nextValue()` löst *synchron mit diesem alten Wert* auf, statt auf den nächsten zu warten — im Widerspruch zum eigenen Vertrag.
Empfehlung: Im `#activeAsyncValuesCount === 0`-Zweig und in `destroy()` `unretain(this, VALUE)` rufen statt (oder zusätzlich zu) `retainClear`.
Evidence (2026-08-07 selbst reproduziert): `nach iterator close: retainedCount=0 names=["value"]` / `nach unbeobachtetem Write: retainedCount=1` / `nextValue() nach einem Makrotask: RESOLVED:3` (ein frischer Aufruf müsste warten). Dazu an der eventize-Quelle geprüft: `unretain` → `keeper.remove()` löscht Policy **und** Wert, `retainClear` daneben ist überflüssig; und `off(this)` in `destroy()` ruft bereits `keeper.removeAll()`, weshalb das dortige `retainClear` ersatzlos entfällt statt ersetzt zu werden.

#### [x] 16. Zähler und AutoMap bemerken fremde Zerstörung
- Findings: MEM-006 (info), MEM-007 (info)
- Ziel: `getSignalsCount()` korrigiert sich wie `getLinksCount()`, und `SignalAutoMap` wirft einen von außen zerstörten Eintrag hinaus.
- Bereich: `src/signal-core.ts`, `src/constants.ts`, `src/createSignal.ts`, `src/SignalAutoMap.ts`, Specs, `docs/`, `skills/`, `CHANGELOG.md`
- Hängt ab von: — (aber **arbeitet für Paket 15 vor**, das seit dem 2026-08-08 dahinter liegt: zwei Auflagen an den Held-Value und eine Warnung zu MEM-007 stehen im Querbezug »Was Paket 16 (MEM-006, MEM-007) von Paket 15 wissen muss«; beide vor der Planung lesen)
- Modell: mittlere Stufe (bestätigt). Die beiden Stellen, an denen dieses Paket mit bloßem Auge falsch aussehen könnte — der Held-Value und die Listener-Closure —, sind in der Planung gebaut und gegen Mutanten gemessen (Schritte 6, 7 und 9). Was bleibt, ist Übertragung plus eine große, aber gewöhnliche Doku-Nachführung.
- Hash: `1814165`
- Ergebnis (2026-08-08): MEM-006 und MEM-007 behoben, zwei Review-Runden. **Beide Auflagen aus Paket 15 sind eingelöst**, und der Reviewer hat das mit einer geschärften Messung belegt statt mit einer Lesart: er hat die Unsubscribe-Handles vor dem Fallenlassen aus dem Held-Value entfernt, damit der Ressourcen-Finalizer nichts freigeben **kann** und die Subscription dauerhaft auf der Queue stehenbleibt — was die Closure dann hält, hält sie für immer. Ergebnis `0/200` für Map, `SignalImpl` und Host-Wert. Dieselbe Messung zeigt den Mutanten mit `this` in der Closure bei `200/200` und den mit einer zweiten inneren Funktion im selben Scope bei `0/200 · 200/200 · 200/200` — sie ist also scharf genug für die V8-Context-Falle.
  Der Held-Value für MEM-006 ist **`undefined`**: der Callback braucht nichts außer der Modulvariablen, die er ohnehin schließt. Die Doppelsenkung verhindert allein `signalFinalizer.unregister(signal)` in `destroySignal()`, bewusst **ohne** die `if (count > 0)`-Wache aus `link.ts` — die wäre ein in beide Richtungen untestbarer Zweig in der einen Datei ohne Zweig-Luft. Der Reviewer hat sieben Proben gefahren (doppeltes und vierfaches `destroySignal()`, zerstören-dann-fallenlassen, fallenlassen-dann-einsammeln, Wechselrunden, `createSignal(existingSignal)`, `SignalGroup.delete()`, ein Soak über 20 Runden): Delta immer 0, der Zähler geht nie unter die Baseline. »Einsammeln, dann zerstören« ist konstruktiv unerreichbar.
  **Gemessene Wirkung:** Signale `2000 → 0` nach `gc()` bei `WeakRef` `0/2000`; `SignalAutoMap` `keys 1000 → 0` nach externen Destroys, Maps `0/200` eingesammelt, `destQ 400 → 0`. Der Dekoratorfall bleibt bei Paket 15 — dort erfüllbar (`2000 → 0`), hier nicht, weil die `+2000` heute echte Erreichbarkeit sind und keine Buchhaltungslücke.
  **Eine Abweichung, und sie war ein Fund:** der Codeblock aus Schritt 12 kompiliert nicht (`TS18030`, optionale Verkettung mit privaten Namen), und die ausgeschriebene Wache kostet einen Zweig, an dem `SignalAutoMap.ts` die Stufe-3-Schwelle gerissen hätte. Statt die Schwelle abzusenken ist der Zweig **getestet** — und der Reviewer hat nachgewiesen, dass das Fenster »Map eingesammelt, ausgegebenes Signal lebt noch« real ist: ohne den Testgriff, nur mit `gc()` plus Job-Grenze, wirft die ungeschützte Fassung in **Runde 0**, in zwei unabhängigen Läufen.
  **Vier überlebende Mutanten gefunden, alle vier geschlossen.** Die Ein-Funktions-Invariante (»There is exactly one inner function here — keep it that way«) hielt 200 von 200 `SignalImpl`s am Leben und ließ 469 von 469 Tests grün — besonders schwer, weil Paket 15 angewiesen ist, genau diese Bauform zu kopieren. Dazu die Reihenfolgen in `clear()` und `delete()` (je eine hängende Destroy-Queue-Subscription plus ein verworfener re-entranter Eintrag) und die Buchführungszeile in `#drop()` (5000 tote Unsubscribe-Closures über 5000 Zyklen). Der neue Invariantentest greift beidseitig — er tötet die zweite Closure **und** die grobe Umstellung auf `this`.
  Verify selbst gelaufen: `pnpm world` Exit 0, 44 Dateien / **474 Tests** (Baseline 461). `signal-core.ts` bleibt exakt bei 12 von 14 Zweigen — **null neue Zweige** in der Datei ohne Luft. `SignalAutoMap.ts` 100 / 100 / 100 / 100. Flakiness: 8× volle Suite beim Reviewer, 3× beim Implementierer, 10× die GC-Dateien einzeln, dazu 4× die volle Suite unter einem Setup, das vor **und** nach jedem Test viermal `gc()` ruft — alles grün, keine Schwankung. `tsc --removeComments` belegt für Runde 1, dass jedes emittierte Modul der ganzen `lib` identisch geblieben ist.
- Beobachtbare Vertragsänderungen (im CHANGELOG unter `### Breaking Changes`): `getSignalsCount()` zählt danach **erreichbare** statt erzeugte Signale und wird eventual consistent; `SignalAutoMap#delete(key)` meldet für einen von außen zerstörten Eintrag `false` statt `true`, weil der Eintrag dann schon weg ist.
- Nachziehende Tests: genau die zwei aus dem Plan, beide im gepinnten `externally destroyed signals`-Block. Kein dritter, in keiner Datei — vom Reviewer gegengerechnet (461 Bestandstests unverändert grün).
- Nebenbefunde:
  - **Für Paket 15:** die Bauform der Listener-Closure ist jetzt durch einen Test geschützt, der beidseitig greift. Wer sie kopiert, kopiert auch den Wächter.
  - `src/SignalAutoMap.ts` — die Zusicherung »der Listener ist immer der erste Abonnent seiner Signal-ID« trägt auf dem `fromProps`-Pfad nicht, weil `createSignal()` ein übergebenes Signal unverändert zurückgibt. Folge ist ein stale read in einer Ecke, nach der niemand gefragt hat: kein Leck, kein Wurf, Zähler und `destQ` sauber. Im Kommentar benannt statt behauptet.
  - Der Reviewer hat einen **zweiten Weg** zu einem toten Eintrag gefunden, mit öffentlicher API reproduziert: ein lebendes Fremdsignal aus `fromProps()`, dessen Destroy-Emit ein werfender früherer Abonnent abbricht. Derselbe Code räumt auch das korrekt ab — der Fix trägt weiter als sein Kommentar behauptete, die Kommentare sind nachgezogen.
- **Abgleich (2026-08-08): beide Findings unverändert vorhanden, beide selbst reproduziert.** Fundstellen über Symbolnamen abgeglichen:
  - MEM-006: `g_signalsCount`/`incSignalsCount()`/`getSignalsCount()` in `src/signal-core.ts:17-32` (Audit `:12-27`), die einzige Senkung in `destroySignal()` `:111`, die einzige Erhöhung im `SignalImpl`-Konstruktor `src/createSignal.ts:141`. Die Vergleichsstelle `src/link.ts:53-80` ist durch Paket 13 auf `:52-106` gewachsen: `gLinkFinalizer` hält als Held-Value das `[$queueUnsubscribes]`-Array, und der Doppelsenkungs-Wächter ist zweiteilig — `gLinkFinalizer.unregister(newLink)` im `once(newLink, DESTROY, …)`-Hook (`:247`) plus ein `if (gLinksCount > 0)` in beiden Hälften. Genau diese Bauform ist die Vorlage, mit einer bewussten Abweichung (Schritt 5).
  - MEM-007: `#signals` `src/SignalAutoMap.ts:34`, `get()` `:117-124` — beide wörtlich so, wie das Audit sie beschreibt. `delete()` aus MEM-009 (`39eadee`, Vorrunde) steht darüber und ist die einzige Änderung an der Datei seither; `get()` ist unberührt.
  - Kein früheres Paket dieses Laufs hat eine der beiden Dateien angefasst. `signal-core.ts` steht auf dem Stand, den der Paket-10-Querbezug ankündigt: 14 Zweige, 12 gedeckt, 9 Funktionen, alle gedeckt. `SignalAutoMap.ts` steht auf 100 / 100 / 100 / 100 bei 12 Zweigen.
- Dateien: `src/signal-core.ts`, `src/constants.ts`, `src/createSignal.ts`, `src/SignalAutoMap.ts`, `src/signal-core.gc.spec.ts` (neu), `src/SignalAutoMap.gc.spec.ts` (neu), `src/SignalAutoMap.spec.ts`, `src/link.gc.spec.ts` (nur ein Kommentar), `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `README.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Alle Zahlen unten sind am 2026-08-08 gegen `0063c52` selbst gemessen, mit `node --expose-gc`, 8 × `gc()` plus je 6 ms Settle. Die Reproduktionen laufen gegen ein frisch gebautes `lib/`, die Varianten gegen **Kopien von `lib/` bzw. `src/` im Scratchpad** mit verlinktem `node_modules`. Am Projektcode ist nichts angefasst worden. Die Suite-Läufe der Schritte 13 und 20 laufen gegen eine vollständige `src/`-Kopie samt Specs unter einer eigenen Vitest-Konfiguration — dieselbe Bauform wie das Original, nur mit einem Setup-File, das vor **und** nach jedem einzelnen Test viermal `gc()` ruft.
  **Die Messfalle aus Paket 15 gilt hier genauso** und ist an einer Stelle scharf: die Listener-Closure in `SignalAutoMap#create()` darf außer ihrer `WeakRef` und primitiven Werten nichts aus ihrem Scope kennen. V8 legt einen Context pro Scope an; eine zweite innere Funktion im selben Rumpf, die `this` oder `signal` liest, zieht beides über die Context-Kette zurück und macht den `WeakRef` still wirkungslos. Es gibt dort genau eine innere Funktion — das muss so bleiben.

  **A — die Reproduktion**

  1. **MEM-006, gegen `lib/`.** 2000 Signale in einer IIFE erzeugt, jedes mit einer `WeakRef` beobachtet, kein `destroySignal()`:
     ```
     nach dem Erzeugen   signals=2000  groups=0  sigQ=0  destQ=0
     nach gc()           signals=2000  groups=0  sigQ=0  destQ=0
     WeakRef lebendig    0/2000        <- die Signale sind weg, der Zähler nicht
     ```
     Deckungsgleich mit der `evidence` des Findings, und die `WeakRef`-Beobachtung sagt zusätzlich, was die dortige Zahl nur nahelegt: es ist wirklich der Zähler, der falsch steht, nicht der Speicher.
  2. **MEM-007, gegen `lib/`.** `SignalAutoMap` mit 1000 dynamischen Keys, jedes Signal von außen zerstört: `keys=1000`, `signals=0`. Deckungsgleich mit der `evidence`. Dazu die Gegenprobe, die das Finding nicht macht und die für den Fix bindend ist: **eine fallengelassene `SignalAutoMap` ist heute einsammelbar** — 200 Maps mit je zwei Einträgen, nach `gc()` `0/200` lebendig, `destQ=0`. Die Klasse hält heute keine einzige Subscription auf einer Modul-Queue. Das ist die Zusage, die MEM-007 nicht kosten darf.
  3. **Der Dekorator-Fall, und eine Korrektur an der Prüfstelle aus dem Paket-15-Querbezug.** 1000 Hosts, je ein einfaches und ein auf den Host zeigendes `{attach: host}`-Signal: `signals=+2000`, `groups=1000`, nach `gc()` **1000/1000 Hosts lebendig**. Die `+2000` sind heute **keine** GC-Buchhaltungslücke, sondern echte Erreichbarkeit — die Gruppe hält die Signale, `allGroups` hält die Gruppe. Daraus folgt: **die Prüfstelle »1000 Hosts fallenlassen, `gc()`, `getSignalsCount()` fällt auf die Baseline« ist von Paket 16 allein nicht einlösbar** und gehört zu Paket 15. Gemessen mit eingebautem MEM-006-Fix und ohne Paket 15: `2000 -> 2000`, Hosts `1000/1000`. Mit beiden: `2000 -> 0` (Schritt 7). Der Querbezug wird entsprechend berichtigt; an der Reihenfolgeentscheidung ändert das nichts, im Gegenteil (Schritt 8).

  **B — MEM-006: der Umbau in `src/signal-core.ts`**

  4. **Der Held-Value ist `undefined`.** Der Callback braucht nichts, um den Zähler zu senken — der Zähler ist eine Modulvariable im selben Scope. Damit ist die zweite Auflage aus dem Paket-15-Querbezug nicht nur erfüllt, sondern gegenstandslos: es gibt keinen Pfad zurück auf das `SignalImpl`, weil es keinen Held-Value gibt. Die Sprache selbst zieht hier übrigens eine Linie, die vorher niemand erwähnt hat: `register(target, target, …)` wirft `TypeError: target and holdings must not be same`. Der interessante Mutant ist deshalb nicht `signal`, sondern `{sig: signal}` — und der ist gemessen (Schritt 6).
     ```ts
     // MEM-006: the counter's second half. `destroySignal()` is the only
     // place that decrements, and a signal that is merely dropped never gets
     // there — measured: 2000 signals collected (0 of 2000 WeakRefs survive
     // a gc()) while the counter stayed at 2000, for the life of the
     // process. `getLinksCount()` has had this correction since MEM-001; the
     // signal counter is advertised for exactly the same job and was the one
     // place that quietly misled, in the opposite direction.
     //
     // The held value is `undefined`, and that is the whole design: this
     // callback needs nothing but the module-level counter it closes over.
     // A held value that reaches the SignalImpl would keep it alive, and a
     // SignalImpl holds its value — in the decorator pattern that value *is*
     // the host object. Measured against the group rework of MEM-003: with
     // `{sig: signal}` as the held value, 1000 of 1000 hosts survive and the
     // registry never fires; with `undefined`, 0 of 1000.
     const signalFinalizer = new FinalizationRegistry<undefined>(() => {
       --g_signalsCount;
     });
     ```
     Registriert wird im selben Aufruf, der hochzählt — die beiden gehören zusammen und dürfen nicht auseinanderlaufen:
     ```ts
     /**
      * Register a newly created signal with the global instance counter, and
      * with the finalizer that corrects it if the signal is dropped instead
      * of destroyed.
      * @internal
      */
     export const incSignalsCount = (signal: ISignalImpl<any>): void => {
       ++g_signalsCount;
       // The unregister token is the signal itself: tokens are held weakly,
       // so this adds no reachability (measured in Paket 15, step 6: 200
       // registrations, 0 surviving tokens). `destroySignal()` uses it to
       // take the registration back out.
       signalFinalizer.register(signal, undefined, signal);
     };
     ```
     `ISignalImpl` ist in dieser Datei bereits als Typ importiert; ein Laufzeit-Import kommt nicht dazu, die Leaf-Schicht bleibt Leaf. Der einzige Aufrufer ist `src/createSignal.ts:141`, im `SignalImpl`-Konstruktor: `incSignalsCount(this)`. Der Name bleibt, obwohl die Funktion jetzt zwei Dinge tut; die JSDoc sagt beide. Ein Umbenennen kostete eine Zeile in `AGENTS.md:112` und brächte nichts.
  5. **Die Doppelsenkung wird durch das Unregister-Token verhindert, nicht durch eine Wache.** In `destroySignal()`, unmittelbar vor der bestehenden Senkung:
     ```ts
     signal.destroyed = true;
     signal.beforeRead = undefined;
     // Take the registration back out before decrementing: a signal that is
     // explicitly destroyed and *then* collected must not be counted down
     // twice. Deliberately not the `if (gLinksCount > 0)` belt-and-braces
     // that `link.ts` carries next to its own `unregister()` — a second
     // guard here would be a new branch in the one file that has no branch
     // headroom left (12 of 14 covered against the 85 % tier), and it would
     // be a branch no test can drive in both directions. The token is
     // sufficient: it is checked synchronously, it removes the cell even if
     // the target has already been collected, and nobody can call this
     // function on a signal that no longer exists.
     signalFinalizer.unregister(signal);
     --g_signalsCount;
     ```
     Der `!signal.destroyed`-Guard darüber trägt den zweiten Fall (zweimal `destroySignal()` auf demselben Signal) unverändert. Gemessen: 500 Signale erzeugt, zerstört, fallengelassen, `gc()` — der Zähler bleibt, wo er war.
  6. **Die drei Messungen, die das tragen** (`v1` = `lib/` plus dieser Umbau, sonst nichts):
     | Variante | bare 2000 dropped | destroy+drop 500 | Dekorator 1000 Hosts |
     | --- | --- | --- | --- |
     | `lib/` (HEAD) | 2000 → **2000** | 0 → 0 | Hosts 1000/1000, Zähler 2000 |
     | `v1` (Held-Value `undefined`) | 2000 → **0** | 0 → 0, keine Doppelsenkung | Hosts 1000/1000, Zähler 2000 |
     | `v1` mit Held-Value `{sig: signal}` | 2000 → **2000**, WeakRef **2000/2000** lebendig | 0 → 0 | Hosts 1000/1000, Zähler 2000 |
     Der Mutant tötet die Aussage vollständig: mit einem Held-Value, der das `SignalImpl` erreicht, wird nicht einmal mehr das nackte Signal eingesammelt. Das ist die Meßlatte aus Paket 13 — `WeakRef`-Beobachtung plus Mutant —, nicht das Argument.
  7. **Die Gegenprobe mit einer Vorschau auf Paket 15.** Auf `v1` zusätzlich Weg A grob nachgebaut (`allGroups` als `Set<WeakRef>`, Held-Value des Host-Finalizers als `WeakRef`, der Per-Signal-Listener mit zwei `WeakRef`s) — nicht als Vorwegnahme des Umbaus, sondern als Prüfung, ob MEM-006 ihn trägt:
     ```
     v15        = v1 + Weg-A-Vorschau                Dekorator: Zähler 2000 -> 0,  Hosts 0/1000, groups=0
     v15_mutant = v15, Held-Value {sig: signal}      Dekorator: Zähler 4000,        Hosts 1000/1000, groups=1000
     v15_nofix  = Weg-A-Vorschau ohne MEM-006        Dekorator: Zähler 4000,        Hosts 0/1000, groups=0
     ```
     Drei Aussagen in drei Zeilen. Erstens: **beide Auflagen sind eingelöst** — die Korrektur hängt an einem `FinalizationRegistry` auf dem `SignalImpl` und feuert auf dem stillen Pfad, und ihr Held-Value nimmt Paket 15 nichts weg. Zweitens: hätte MEM-006 den falschen Held-Value, zöge es Paket 15 **vollständig** zurück — 1000 überlebende Hosts, 1000 überlebende Gruppen, aus einem Feld, das nur den Zähler senken sollte. Drittens: ohne MEM-006 sammelt Weg A zwar ein, aber `getSignalsCount()` steht danach bei 4000 und kommt nicht mehr herunter — auch `SignalGroup.clear()` bringt es nicht zurück, weil es keine Gruppe mehr gibt, die etwas zu zerstören hätte.
  8. **Damit ist die Reihenfolgeentscheidung schärfer begründet als bisher.** Sie ruht nicht auf »der Zähler stünde zu hoch«, sondern auf: der Zähler stünde **dauerhaft und unheilbar** zu hoch, und zwar für jede Spec-Datei, die nach einem solchen Test noch etwas prüft.

  **C — MEM-007: der Umbau in `src/SignalAutoMap.ts`**

  9. **Warum die naive Fassung nicht geht, gemessen statt zitiert.** Zwei Klassen mit identischem Verhalten, je 200 Instanzen mit zwei Einträgen, fallengelassen, `gc()`:
     ```
     A  once(globalDestroySignalQueue, id, () => this.#signals.delete(key))
        -> Maps lebendig 200/200,  destQ 0 -> 400 -> 400   (dauerhaft)
     B  WeakRef auf die Map, sonst nur primitive Captures, plus Ressourcen-Finalizer
        -> Maps lebendig 0/200,    destQ 400 -> 800 -> 400 (vollständig freigegeben)
     ```
     Die Warnung aus dem Paket-15-Querbezug trifft also exakt: die Empfehlung des Audits, wörtlich umgesetzt, macht jede `SignalAutoMap` ab dem ersten Eintrag unsterblich — samt aller ihrer Signalwerte. Variante B evictet dabei genauso zuverlässig: 1000 von außen zerstörte Signale, `keys=0`, `destQ` zurück auf der Baseline.
  10. **Das Symbol gehört in `src/constants.ts`, nicht in `SignalAutoMap.ts`.** `src/index.ts:22` macht `export * from './SignalAutoMap.js'` — ein `export const $autoMapResources` in dieser Datei wäre damit öffentliche Oberfläche. `src/constants.ts` wird von `index.ts` nicht re-exportiert; `$queueUnsubscribes` aus Paket 13 sitzt aus genau diesem Grund dort. Das ist der Unterschied zu Paket 15, das `$groupResources` in `SignalGroup.ts` legen darf, weil `index.ts` von dort namentlich exportiert.
      ```ts
      export const $autoMapResources = Symbol.for(
        '@spearwolf/signalize/autoMapResources',
      );
      ```
  11. **Der Modulkopf von `SignalAutoMap.ts`.** Neue Laufzeit-Imports: `on` aus `@spearwolf/eventize`, `globalDestroySignalQueue`, `signalImpl`. Kein Zyklus — die Datei wird von nichts außer `index.ts` importiert.
      ```ts
      type AutoMapResources = {unsubs: Set<() => void>};

      // MEM-007: what has to happen when a map is collected without its
      // `clear()` ever running. The held value is resources only — the
      // unsubscribe handles of the per-entry destroy-queue subscriptions.
      // None of them reaches the map: each handle closes over the listener,
      // and the listener knows its map through a WeakRef (see `#create`), so
      // this registration does not undo what that WeakRef achieves. Without
      // it the leak only moves: measured over 200 collected maps with two
      // entries each, 400 listeners stay on `globalDestroySignalQueue` for
      // the lifetime of the process.
      const autoMapResourceFinalizer = new FinalizationRegistry<AutoMapResources>(
        (resources) => {
          for (const unsubscribe of resources.unsubs) {
            try {
              unsubscribe();
            } catch (err) {
              // A throw out of a FinalizationRegistry callback has no caller
              // to reach — it would take the process down. Same channel and
              // same reason as the link and group finalizers.
              console.error(
                '[signalize] releasing the destroy-queue subscriptions of a collected SignalAutoMap failed:',
                err,
              );
            }
          }
          resources.unsubs.clear();
        },
      );
      ```
      `AutoMapResources` bleibt un-exportiert, sonst wandert der Typ über `export *` mit nach draußen.
  12. **Die Felder, der Konstruktor und die eine Stelle, an der Einträge entstehen.** Bisher legt die Klasse an zwei Stellen an — `get()` und `fromProps()`, das an `#signals` vorbei direkt setzt. Beide laufen ab jetzt durch `#create()`, sonst bekämen `fromProps()`-Einträge keinen Hook und die Klasse verhielte sich je nach Herkunft des Eintrags anders.
      ```ts
      readonly [$autoMapResources]: AutoMapResources = {unsubs: new Set()};

      #signals = new Map<SignalAutoMapKeyType, Signal<any>>();
      #unsubs = new Map<SignalAutoMapKeyType, () => void>();
      #selfRef = new WeakRef(this);

      constructor() {
        autoMapResourceFinalizer.register(this, this[$autoMapResources], this);
      }

      #create<T>(key: SignalAutoMapKeyType, initialValue?: unknown): Signal<T> {
        const signal = createSignal<T>(initialValue as T);
        this.#signals.set(key, signal);
        // MEM-007: `on`, not `once` — the same queue carries the soft-detach
        // emit from `SignalGroup#off()`, and a `once` would be consumed by
        // that one, leaving nobody to hear the real destruction later.
        //
        // Both captures are deliberate: `selfRef` is a WeakRef and `key` is
        // a primitive. `globalDestroySignalQueue` is a module-level object
        // and holds this listener for as long as the subscription lives, so
        // a strong `this` would make every SignalAutoMap — and every value
        // it stores — reachable from a GC root. Measured: 200 of 200 maps
        // survive with a strong `this`, 0 of 200 through the WeakRef.
        //
        // Nothing else from this scope may end up in the closure. V8
        // allocates one context per scope, shared by every inner function,
        // so a second closure referencing `signal` or `this` would drag them
        // back in and quietly undo this. There is exactly one inner function
        // here — keep it that way.
        const selfRef = this.#selfRef;
        const unsubscribe = on(
          globalDestroySignalQueue,
          signalImpl(signal).id,
          (_id: symbol, params?: {detach?: boolean}) => {
            if (params?.detach) return;
            selfRef.deref()?.#drop(key);
          },
        );
        this.#unsubs.set(key, unsubscribe);
        this[$autoMapResources].unsubs.add(unsubscribe);
        return signal;
      }

      // Remove an entry and its subscription, without destroying the signal.
      #drop(key: SignalAutoMapKeyType): void {
        // Invariant: every key in `#signals` has a handle in `#unsubs`. Both
        // are written only in `#create()` and removed only here.
        const unsubscribe = this.#unsubs.get(key);
        unsubscribe();
        this.#unsubs.delete(key);
        this[$autoMapResources].unsubs.delete(unsubscribe);
        this.#signals.delete(key);
      }
      ```
      `get()` wird zu `if (!this.#signals.has(key)) return this.#create<T>(key); return this.#signals.get(key)!;`, `fromProps()` zu `sm.#create(key as any, value)`. `delete()` tauscht sein `this.#signals.delete(key)` gegen `this.#drop(key)` — die Reihenfolge (erst austragen, dann zerstören) bleibt, wie MEM-009 sie hergestellt hat, und ist jetzt doppelt begründet: sie hält die Re-Entrancy-Zusage **und** meldet den Hook ab, bevor der eigene Destroy ihn feuern lassen könnte. `clear()` wird zu »erst alle Schlüssel `#drop()`en, dann die geschnappschusste Signalliste zerstören«.
  13. **Kein Identitätswächter in der Closure, und warum das keine Nachlässigkeit ist.** Der erste Entwurf gab dem Listener die Signal-ID mit und verglich sie vor dem Austragen mit dem, was gerade unter `key` steht — gegen den Fall, dass ein früherer Abonnent desselben Destroy-Emits per `get(key)` schon einen frischen Eintrag angelegt hat. Der Zweig ist gestrichen, aus zwei gemessenen Gründen. Erstens liefert eventize **nicht** an einen Listener, der während desselben `emit()` abgemeldet wurde (gemessen: zwei Abonnenten, der erste meldet den zweiten ab, zugestellt wird nur der erste) — und `#drop()` meldet ab, bevor irgendetwas anderes passieren kann. Zweitens ist der Listener aus `#create()` **immer** der erste Abonnent für seine Signal-ID: die ID entsteht in derselben Anweisung, niemand kann vorher etwas darauf abonniert haben, und keine der vier Registrierungsstellen auf dieser Queue (`EffectImpl`, `SignalGroup`, `createMemo`, `SignalLink`) benutzt eine Priorität. Der Wächter wäre also toter Code — auf einer Datei, die bei Statements, Funktionen und Zeilen auf 100 % steht und dort keine Luft hat; dieselbe Begründung, mit der Paket 15 seinen `effects`-Eintrag im Held-Value gestrichen hat. Was die Aussage trotzdem festhält, ist Test 6: kippt die Reihenfolge je, wird er rot.
  14. **Was `SignalAutoMap` dabei bewusst nicht lernt.** Keine Erkennung beim Lesen (`get()` prüft nicht, ob ein vorhandener Eintrag zerstört ist — nach dem Fix gibt es diesen Zustand nicht mehr), kein Sweep, keine öffentliche Prune-Methode. Der Eintrag verschwindet im selben synchronen Zug wie die Zerstörung; `has(key)` ist unmittelbar nach `destroySignal(sig)` `false`.

  **D — hängen die beiden zusammen? Nein, und das ist die halbe Antwort auf beide**

  15. Ein gemeinsamer Mechanismus lohnt nicht, weil die beiden Findings dieselbe Frage aus entgegengesetzten Richtungen stellen. **MEM-006 braucht den GC, weil es kein Ereignis gibt:** ein fallengelassenes Signal emittiert nichts, niemand kann es abonnieren, nur der Einsammler weiß Bescheid. **MEM-007 braucht das Ereignis, weil es keinen GC gibt:** die Map hält ihr Signal stark, ein `FinalizationRegistry` auf dem Signal feuerte nie, solange der Eintrag existiert — und wenn er nicht mehr existierte, hätte man das Problem schon gelöst. Umgekehrt hilft MEM-007s Weg für MEM-006 nicht, weil `destroySignal()` auf dem stillen Pfad nie läuft. Zwei Mechanismen also, aber **eine** geteilte Regel, und die ist inzwischen dreimal bezahlt worden (Paket 13, Paket 15, hier): kein Held-Value und keine Listener-Closure auf einem Modul-Objekt darf einen starken Pfad zurück auf das haben, dessen Tod sie bemerken soll. Die zweite Gemeinsamkeit ist ein Nebenprodukt: der Ressourcen-Finalizer aus Schritt 11 ist die Bauform aus Paket 13, und Paket 15 baut dieselbe noch einmal für die Gruppe.

  **E — die Tests, rot zuerst**

  16. **Test 1, der Beweis für MEM-006 — neue Datei `src/signal-core.gc.spec.ts`**, in der Bauart von `src/link.gc.spec.ts` (`hasGc`-Wächter, `gcDescribe`, `forceGc()` mit 5 × `gc()` plus `setImmediate`). `it('a signal dropped without destroySignal() stops being counted (MEM-006)')`: `getSignalsCount()`, `getSubscriptionCount(globalSignalQueue)` und `…(globalDestroySignalQueue)` als Baseline; 200 Signale in einer IIFE, jedes in einer `WeakRef`; `expect(getSignalsCount()).toBe(baseline + 200)`; dann die Budget-Schleife `for (let i = 0; i < 20 && getSignalsCount() > baseline; i += 1) await forceGc();`; danach vier Zusicherungen: Zähler auf der Baseline, **kein** `deref()` liefert noch etwas, beide Queue-Zähler unverändert. Auf HEAD rot: `expected 200 to be +0`.
      **Verlässlich wird er durch die Budget-Schleife statt eines festen Settles** — dieselbe Zusage, die Paket 13 für `getLinksCount()` gebaut hat: wer auf `getSignalsCount() === baseline` wartet, weiß, dass jeder Callback gelaufen ist. Gemessen: zehn Läufe hintereinander, keine Schwankung.
      **Die `WeakRef`-Zusicherung ist nicht dekorativ.** Ohne sie wäre der Test auch von einer Implementierung zu befriedigen, die den Zähler beim Lesen rät; mit ihr steht dort, dass die Objekte wirklich weg sind. Der Mutant `{sig: signal}` tötet ihn an genau dieser Stelle (2000/2000 lebendig).
  17. **Test 2, der Wächter gegen die Doppelsenkung** — dieselbe Datei: `it('a signal destroyed and then collected is not counted down twice (MEM-006)')`. 200 Signale in einer IIFE erzeugen und **darin** zerstören, Baseline vergleichen, fünfmal `forceGc()`, wieder vergleichen. Auf HEAD grün (es gibt nichts, was doppelt senken könnte) — er ist kein Regressionstest, sondern der Mutantenfänger für ein vergessenes `signalFinalizer.unregister(signal)`. Ohne das `unregister()` läuft der Zähler ins Negative, und zwar erst irgendwann später; genau die Sorte Fehler, die man sonst in einer fremden Spec-Datei wiederfindet.
  18. **Die MEM-007-Tests in `src/SignalAutoMap.spec.ts`.** Der vorhandene `describe('externally destroyed signals')`-Block hält die alte Zusage fest und lädt in seinem Kommentar ausdrücklich dazu ein, sie zu ersetzen (»If this ever changes (e.g. auto-recreate on destroy), update this test to match«). Genau das passiert:
      | # | Test | Was daraus wird |
      | --- | --- | --- |
      | 3 | `an externally destroyed signal drops out of the map (MEM-007)` | ersetzt `get() returns the same destroyed signal after destroySignal()`. Nach `destroySignal(sig)`: `has('a')` ist `false`, `get('a')` liefert ein **anderes**, lebendes Signal, `assertSignalsCount(1)`. |
      | 4 | `1000 externally destroyed entries leave no keys behind (MEM-007)` | neu, die Messung des Findings als Test: `keys` 0, `assertSignalsCount(0)`, und der Destroy-Queue-Zähler zurück auf der Baseline — die zweite Hälfte ist die eigentliche Aussage, denn sie verbietet, das Leck von der Map auf die Queue zu verschieben. |
      | 5 | `a soft detach does not evict the entry (MEM-007)` | neu, und der Grund für `on` statt `once`. Echte Gruppe: `SignalGroup.findOrCreate(host).attachSignal(sig)`, dann `SignalGroup.get(host)!.off()` — der Eintrag muss stehen bleiben und `get('a')` dasselbe Signal liefern. Mit `once` ist er rot, und danach wäre die echte Zerstörung unbemerkt geblieben. |
      | 6 | `a re-entrant get() during an external destroy keeps the fresh entry (MEM-007)` | neu, das Gegenstück zum vorhandenen `delete()`-Re-Entrancy-Test. Ein Effect, dessen Cleanup `sm.get('a')` ruft, wird durch `destroySignal(sig)` mitgerissen; danach ist der frische Eintrag in der Map und lebt. Er ist zugleich der Wächter für die Reihenfolgeannahme aus Schritt 13. |
      | 7 | `delete() on an entry destroyed from the outside reports false (MEM-007)` | ersetzt `… still removes it`. Der Eintrag ist bereits weg, also `has('a') === false` und `delete('a') === false`. **Das ist eine Vertragsänderung an öffentlicher API** (Schritt 22). |
      | 8 | `reads from a destroyed signal return the last value, writes are silent` | bleibt dem Namen nach, ändert aber seine Mitte: nach `sig.destroy()` ist der Eintrag weg, `sm.get('a')` legt frisch an, und die Aussage über die Leiche wird direkt an `sig` geprüft statt über die Map. Ohne diese Nachführung testet er stillschweigend etwas anderes als sein Name sagt — gemessen ist er nämlich auch **ohne** Änderung grün. |
  19. **Die GC-Tests für MEM-007 — neue Datei `src/SignalAutoMap.gc.spec.ts`**, gleiche Bauart:
      - **Test 9, `a dropped map is collected and releases its destroy-queue subscriptions (MEM-007)`**: 50 Maps mit je zwei Einträgen in einer IIFE, `WeakRef` auf jede. Vorher: `expect(destQ).toBe(base + 2 * 50)` und `getSignalsCount()` auf `base + 100`. Budget-Schleife mit **zwei** Abbruchbedingungen (Queue-Zähler **und** Signalzähler zurück auf der Baseline), danach: keine `WeakRef` lebt mehr, beide Zähler auf der Baseline. Der Test prüft damit beide Findings auf einmal — die Signale in einer eingesammelten Map werden nie zerstört, ihr Zähler kommt nur über MEM-006 zurück. Auf HEAD rot schon an der ersten Zusicherung (`expected +0 to be 100`), weil es die Subscriptions dort noch nicht gibt; das ist ein ehrliches Rot, aber die eigentliche Aussage steht dahinter.
      - **Test 10, `a throwing release handle in a collected map is reported, not thrown (MEM-007)`**: Vorbild ist Test 4 aus Paket 13 und Test 2 aus Paket 15. Ein Werfer wird **vor** die echten Handles in `sm[$autoMapResources].unsubs` gesetzt (ein Werfer am Ende bewiese nichts über die davor), `console.error` gespiegelt, Map fallenlassen, Budget-Schleife: genau ein `console.error`, und der Queue-Zähler trotzdem auf der Baseline. `$autoMapResources` kommt dafür aus `./constants.js` in den Import — es ist der Grund, warum das Symbol existiert.
  20. **Was der Rot-Lauf braucht, und was schon gemessen ist.** Die neuen GC-Tests einzeln laufen lassen (`pnpm test -- -t "…"`); sie hinterlassen im Fehlerfall Signale, und die `beforeEach`/`afterEach`-Wachen melden das als Folgefehler in den Nachbartests. Gegen eine vollständige, gepatchte `src/`-Kopie ist der Endzustand bereits gemessen: **468 Tests grün in drei aufeinanderfolgenden Läufen**, die beiden neuen GC-Dateien zehnmal ohne Schwankung, und mit einem Setup-File, das vor und nach jedem Test viermal `gc()` ruft. Zwischenstand mit MEM-006 allein: 461 von 461 grün, ebenfalls unter dem GC-Hammer, drei Läufe. Zwischenstand mit beiden Fixes und **ohne** die Testnachführung: genau zwei rote Tests, beide aus Schritt 18 (Zeile 357 und Zeile 469) — kein dritter, in keiner anderen Datei.
  21. **Die Mutanten, die die Suite töten müssen.** Held-Value `{sig: signal}` → Test 1 (gemessen 2000/2000 lebendig). `unregister()` weggelassen → Test 2. Listener-Closure mit `this` statt `WeakRef` → Test 9 (gemessen 200/200 überlebende Maps). Ressourcen-Finalizer weggelassen → Test 9 an der Queue-Zusicherung (gemessen: 400 hängende Subscriptions). `once` statt `on` → Test 5.

  **F — die Zusage, die sich ändert**

  22. **`delete()` verliert eine dokumentierte Rückgabe.** MEM-009 aus der Vorrunde hat festgeschrieben: »Deleting an entry whose signal was already destroyed from the outside still removes the entry and reports `true`«. Diesen Zustand gibt es nicht mehr — der Eintrag ist zum Zeitpunkt des Aufrufs schon weg, `delete()` meldet `false`. Rückwärtskompatibel ist das nicht, benutzersichtbar sehr wohl, und es steht an fünf Stellen: `src/SignalAutoMap.ts` (JSDoc von `delete()`), `docs/api.md:580-588`, `docs/recipes.md:614-641`, `skills/using-signalize/references/pitfalls.md`, Pitfall 18, und im Testnamen aus Schritt 18. Der Vertrag bleibt in der Sache derselbe (`Map.prototype.delete`-Semantik: `true`, wenn der Key da war), nur trifft die Vorbedingung nicht mehr zu. Kein Grund für eine Rückfrage: die Zeile ist die Beschreibung des Symptoms, das MEM-007 beseitigt.
  23. **`getSignalsCount()` zählt danach erreichbare statt erzeugte Signale.** Der Zähler wird eventual consistent — er fällt irgendwann, nicht zu einem beobachtbaren Zeitpunkt. Wer sich darauf verlassen hat, dass ein fallengelassenes Signal für immer mitzählt, hat ein Problem. **Gemessen, wer das ist: niemand.** Eine Sonde über die ganze Suite (ein `afterEach`/`afterAll`-Setup, das den Zähler mitschreibt) findet neun Spec-Dateien, die mit lebenden Signalen enden — `batch.spec.ts` (5), `createMemo.spec.ts` (6), `createSignal.compareFn.spec.ts` (1), `createSignal.lazy.spec.ts` (4), `effects-and-groups.spec.ts` (1), `effects.spec.ts` (14), `link.gc.spec.ts` (701), `nested-effects-isolation.spec.ts` (1), `unsubscribeEffect.spec.ts` (2). Davon lesen den Zähler nur drei: `createMemo.spec.ts` (27 Stellen, durchweg als `signalsBefore`/`toBe(signalsBefore)`-Paar), `unsubscribeEffect.spec.ts` (3) und `link.gc.spec.ts` (nur in einem Kommentar). Genau diese Kombination — Reste liegenlassen **und** zwei absolute Lesungen vergleichen — wäre die Flake, und sie tritt nicht ein: drei volle Läufe mit 4 × `gc()` vor und nach **jedem** Test, 461 von 461 grün. Die Reste sind über lebende Effects noch erreichbar; der Einsammler kommt gar nicht an sie heran.
  24. **Der Kommentar, der dadurch falsch wird.** `src/link.gc.spec.ts:35-41` sagt: »Standalone signals have no GC-based count bookkeeping (unlike SignalGroup-attached ones), so their count would stay elevated«. Beide Hälften stimmen nach diesem Paket nicht mehr — die zweite stimmte auch vorher nicht, denn eine Gruppe hat kein GC-basiertes Zählwerk, sie hält ihre Signale nur fest. Der Absatz wird umgeschrieben: die Suite lässt Quellsignale bewusst fallen, deren Zähler korrigiert sich seit MEM-006 selbst, und der Grund, warum die Datei ihn trotzdem nicht zusichert, ist ein anderer — er ist orthogonal zu dem, was MEM-002 misst, und eine zweite Abbruchbedingung in der Budget-Schleife würde den Test nur langsamer machen, nicht schärfer.

  **G — die Doku**

  25. **MEM-006, in dieser Reihenfolge** (die Regel aus `CLAUDE.md` → »When the public API changes«):
      - `src/signal-core.ts`, JSDoc von `getSignalsCount()`: was gezählt wird (lebende, erreichbare, nicht zerstörte Signale), dass ein fallengelassenes Signal irgendwann herausfällt, und dass »irgendwann« nicht zusicherbar ist. Dazu die Gegenrichtung, die für Tests zählt: `0` heißt nicht »alles aufgeräumt«, sondern »nichts mehr erreichbar«.
      - `docs/api.md:75`, Zeile `getSignalsCount()`: der Halbsatz, dass der Zähler sich nach einem Einsammeln selbst korrigiert.
      - `docs/recipes.md:651-665` (»Leak detection«): das Rezept bleibt, bekommt aber denselben Vorbehalt, den der Absatz für Links schon hat — die Gegenprobe braucht weiterhin expliziten Teardown; ein grüner Vergleich ist kein Beleg für den Finalizer, und ein roter kann durch einen zwischenzeitlichen `gc()` grün werden.
      - `docs/cheat-sheet.md:29/197` und `skills/using-signalize/references/api.md:81/282`: je ein Halbsatz, nicht mehr.
      - `skills/using-signalize/references/pitfalls.md`, Pitfall 16a, letzter Spiegelstrich: dort steht heute »a passing `getSignalsCount()` check cannot be attributed to the registry«. Der Satz bleibt richtig und bekommt seinen zweiten Halbsatz: ab jetzt gibt es zwei Registries, die ihn beeinflussen können.
      - `README.md:82`: die Zeile über die Zähler nennt die Selbstkorrektur.
  26. **MEM-007, in derselben Reihenfolge:**
      - `src/SignalAutoMap.ts`: Klassen-JSDoc (was mit einem von außen zerstörten Eintrag passiert) und `delete()`-JSDoc (der Absatz aus Schritt 22).
      - `docs/api.md:580-588`: der Hinweisblock kehrt sich um. Aus »the map still holds a reference: reads return its last value« wird »der Eintrag verschwindet im selben Zug; `get(key)` legt danach frisch an«. Der zweite Absatz über die `delete()`-Re-Entrancy bleibt Wort für Wort.
      - `docs/recipes.md:614-641` (»SignalAutoMap with destroyed entries«): das Codebeispiel zeigt heute genau das Verhalten, das wegfällt, und muss neu geschrieben werden. Die Überschrift kann bleiben.
      - `docs/cheat-sheet.md:142-160` und `skills/using-signalize/references/api.md:231-245`: je eine Zeile in der Methodenliste.
      - `skills/using-signalize/references/pitfalls.md`, **Pitfall 18**: der Titel »`SignalAutoMap` retains destroyed signals — unless you use `delete()`« ist die Beschreibung des behobenen Fehlers. Der Pitfall verschwindet nicht, er dreht sich: was jetzt überrascht, ist, dass ein von außen zerstörter Eintrag **verschwindet** — wer eine `Signal`-Referenz aufgehoben hat, hält danach eine Leiche, die nicht mehr in der Map steht, und ein `get(key)` liefert etwas Neues statt derselben Leiche. Dazu die neue, kleine Grenze: eine `SignalAutoMap`, die fallengelassen wird, ohne `clear()` gesehen zu haben, gibt ihre Queue-Subscriptions über einen Finalizer frei — zu einem Zeitpunkt, den niemand kennt; ihre Signale werden dabei nicht zerstört, sondern nur eingesammelt.
      - `docs/architecture.md:153`: die Tabellenzeile beschreibt die Datei in fünf Wörtern und bleibt.
  27. `CHANGELOG.md`, unter `## Unreleased` → `### Bug Fixes`, englisch, ein Fakt pro Zeile: (a) `getSignalsCount()` korrigiert sich über einen `FinalizationRegistry`, wenn ein Signal fallengelassen statt zerstört wurde (MEM-006, gemessen 2000 → 0), und zählt damit erreichbare statt erzeugte Signale; (b) `SignalAutoMap` wirft einen von außen zerstörten Eintrag hinaus, statt ihn als Leiche zu behalten (MEM-007, gemessen 1000 tote Keys → 0); (c) **breaking, klein**: `delete(key)` meldet für einen solchen Eintrag jetzt `false` statt `true`, weil er zum Zeitpunkt des Aufrufs nicht mehr da ist; (d) eine fallengelassene `SignalAutoMap` gibt ihre Destroy-Queue-Subscriptions selbst frei (gemessen 400 → 0) und bleibt einsammelbar.

  **H — Coverage**

  28. **Gemessen, mit allen Tests aus E, gegen die gepatchte Kopie:**
      | Datei | vorher | nachher | Stufe |
      | --- | --- | --- | --- |
      | `signal-core.ts` | 100 / 85,71 / 100 / 100 · 14 Zweige, 9 Funktionen | **100 / 85,71 / 100 / 100** · 14 Zweige, 10 Funktionen | Stufe 1 (Zweige 85) — gehalten |
      | `SignalAutoMap.ts` | 100 / 100 / 100 / 100 · 12 Zweige, 14 Funktionen | **100 / 100 / 100 / 100** · 14 Zweige, 19 Funktionen | Stufe 3 (100/95/100/100) — gehalten |
      `signal-core.ts` bekommt **keinen einzigen neuen Zweig** — die enge Stelle bleibt exakt, wo Paket 10 sie hinterlassen hat, 12 von 14. Die eine neue Funktion ist der Finalizer-Callback, und Test 1 ruft ihn (aus dem `gc`-Projekt, dessen Coverage in dieselbe Karte fließt — genau der Grund, aus dem Paket 5 die beiden Projekte in einen Lauf gelegt hat). `SignalAutoMap.ts` gewinnt fünf Funktionen und zwei Zweige (die `detach`-Wache), alle gedeckt; keine Schwelle muss angefasst werden, und die Datei bleibt in Stufe 3.
      **Das war nicht die erste Fassung.** Mit dem Identitätswächter aus Schritt 13 und einer `if (unsubscribe)`-Wache in `#drop()` stand die Datei auf 98,5 / 94,44 / 100 / 100 — unter der Stufe-3-Schwelle, bei zwei nachweislich unerreichbaren Zweigen. Die Regel aus dem Querbezug (Datei in Stufe 1 verschieben, mit Begründungszeile) wäre der zugelassene Ausweg gewesen; der bessere war, die toten Zweige nicht zu schreiben. Das ist der Grund, warum Schritt 13 so ausführlich begründet ist: er ist eine Coverage-Entscheidung, die zufällig auch die richtige Korrektheitsentscheidung ist.
- Verify: `pnpm world` (enthält seit Paket 5/6 `test:gc`, `test:smoke` und `checkPkgTypes`), dazu die fünf Mutanten aus Schritt 21, die beiden neuen GC-Dateien zehnmal ohne Schwankung, und die Coverage-Gegenmessung aus Schritt 28. Die Gesamtzahl der Tests steigt um sieben (461 → 468: zwei in `signal-core.gc.spec.ts`, zwei in `SignalAutoMap.gc.spec.ts`, drei neue in `SignalAutoMap.spec.ts`; drei weitere werden dort umgeschrieben, nicht ergänzt). Zusätzlich, weil keine Suite es sieht: **das Messskript aus Schritt 6 gegen die gebaute Fassung** — 2000 fallengelassene Signale müssen auf `signals=0` bei `WeakRef alive 0/2000` stehen, und 200 fallengelassene `SignalAutoMap`s auf `0/200` bei `destQ` gleich der Baseline.
- Commit: `fix: correct the signal counter from a finalizer, and evict externally destroyed SignalAutoMap entries (MEM-006, MEM-007)`

#### [x] 15. Gruppenwurzeln schwach halten
- Findings: MEM-003 (medium)
- Ziel: Die drei Modul-Wurzeln, die eine Gruppe von außen festhalten, halten sie nur noch schwach, und ein zweiter Finalizer räumt auf, was eine still eingesammelte Gruppe sonst auf `globalDestroySignalQueue` liegen ließe. Wirkung: ein Host, dessen einzige Rückverbindung ein Signalwert ist — das Alltagsmuster `@signal() accessor self = this` —, wird eingesammelt.
- Bereich: `src/SignalGroup.ts`, `src/SignalGroup.gc.spec.ts`, `docs/`, `skills/`, `CHANGELOG.md`
- Hängt ab von: **Paket 16, zwingend und davor** (Entscheidung vom 2026-08-08; die Begründung steht in Schritt 20 und im Querbezug »Was Paket 16 (MEM-006, MEM-007) von Paket 15 wissen muss«). Dazu Paket 12 (BUG-009 hat `allGroups` von der Wisch-Semantik befreit — siehe »Was Paket 15 (MEM-003) von Paket 12 erbt«) und, ohne Reihenfolgezwang, Paket 14 (dieselbe Datei, aber weit weg von `allGroups`).
- Modell: stärkste Stufe. Der Code ist klein — vier Stellen in einer Datei plus ein Finalizer —, aber jede einzelne davon ist mit bloßem Auge nicht zu verifizieren: ob ein Umbau die Wurzel wirklich löst, sagt nur die Messung, und zwei Fassungen dieses Umbaus haben in der Planung genau daran gescheitert, ohne dass ein Test es gemerkt hätte.
- Hash: `a3d5519`
- Ergebnis (2026-08-08): MEM-003 im reduzierten Auftrag **erfüllt**, eine Review-Runde. Gemessene Wirkung, vom Reviewer gegen `git archive HEAD src` unabhängig reproduziert: **Dekoratorfall `1000/1000 → 0/1000`**, `groups 1000 → 0`, `signals +2000 → 0`, **`destQ 2000 → 0`**. Fall A und C bleiben sauber, Fall B bleibt bei `500/500` — die benannte Grenze.
  **Fall B hängt an `EffectImpl`, an nichts sonst**, mit zwei unabhängigen Gegenproben belegt: 200 Effects ganz ohne Gruppe pinnen 200 von 200 Hosts, nach `destroy()` null; und in Fall B selbst bringt allein `effect.destroy()` Hosts, Gruppen, Signale, Effects und beide Queues in einem Zug auf 0. Ein vierter starker Pfad existiert nicht — auch ein von einem fremden Register gehaltener Link blockiert nicht.
  Jede der drei Wurzeln wurde einzeln auf stark zurückgedreht und pinnt allein 1000 von 1000: `allGroups`, der Registry-Held-Value, die Per-Signal-Closure. Dazu die **V8-Context-Falle**: eine zweite innere Funktion im Scope von `#addSignal()`, die nie aufgerufen wird, genügt — Test 1 tötet auch diesen Mutanten. Der Reviewer hat zusätzlich die geschärfte Messung aus Paket 16 gefahren (Handles vor dem Fallenlassen entfernt, damit die Subscription dauerhaft stehenbleibt): `0/200` für Hosts wie für `SignalImpl`.
  **Das `Set` wächst nicht.** 5000 still eingesammelte Gruppen ohne einen einzigen Zähleraufruf → `size=0`; 2000 Gruppen ganz ohne Signal → `size=0`; 3000 `attach`/`delete`-Zyklen → `size=0`. Entsorgt wird primär vom Gruppen-Finalizer, ersatzweise von den Deref-Filtern. Die Invariante `allGroups` ↔ `store` hält auf allen vier Pfaden, inklusive der im Sweep geborenen Gruppe aus BUG-009.
  **Die neue Grenze greift mit Paket 16 zusammen**, gemessen: 200 still eingesammelte Hosts → `groups=0`, **null `DESTROY`-Events**, `signals 200 → 0`. Der Zähler kommt allein über den Per-Signal-Finalizer aus MEM-006 zurück; ohne Paket 16 stünde er dauerhaft zu hoch. Genau dafür lag Paket 16 davor.
  Runde 1 behob drei `wichtig`: `docs/architecture.md` und `skills/using-signalize/references/api.md` sagten dreißig Zeilen neben dem korrigierten Absatz weiterhin, ein Dekoratorfeld mit `this` verhindere die automatische Bereinigung — also genau das, was dieses Paket behebt. Und die Buchführungszeile in `#dropSignalSubscription()` war ungetestet: ersatzlos gestrichen blieben **477 von 477 Tests grün**, während 5000 + 5000 Churn-Zyklen 10 000 tote Closures im Held-Value hinterließen. Es war wörtlich derselbe Mutant, den Paket 16 in `SignalAutoMap#drop()` gefunden und dort geschlossen hatte — die Zeile war kopiert worden, der Wächter nicht.
  Verify selbst gelaufen: `pnpm world` Exit 0, 44 Dateien / **478 Tests** (Baseline 474). GC-Suite achtmal beim Reviewer, zehnmal beim Implementierer, ohne Schwankung.
- **Alle vier `b23c22f`-Korrekturen sind sachlich bestätigt.** Der vorherige Lauf hatte den richtigen Vorbehalt mit der falschen Begründung dokumentiert: er nannte den Signalwert als Blocker (gilt nicht mehr) und die globale Effekt-Queue als Randnotiz (ist die eigentliche Ursache). Beides steht jetzt richtig in `docs/api.md`, `docs/architecture.md`, `docs/recipes.md`, `README.md` und Pitfall 16a.
- Nebenbefunde:
  - **Coverage-Warnung für jedes künftige Paket:** `SignalGroup.ts` hat **null** Statements und **null** Zeilen Reserve — 304 von 313 Statements (97,12 % gegen die 97-%-Schwelle) und 294 von 299 Zeilen (98,32 % gegen 98 %). Ein einziges weiteres ungedecktes Statement ergibt 96,80 %, eine einzige weitere Zeile 97,99 %; bei den Zweigen bleibt genau einer Reserve. Ungedeckt sind die drei GC-rennenabhängigen Hüllen-Filter und die zwei vorbestehenden Konstruktor-Frühausstiege. Wer die Datei als Nächstes anfasst, läuft ohne Vorwarnung in die Schwelle.
  - `klein`, offen: der Hüllen-`delete` im Ressourcen-Finalizer ist ungetestet, und seine Reihenfolge-Begründung (»Order is load-bearing«) trägt nicht — der Zähler-Sweep entfernt die Hülle unabhängig davon selbst. Kosten der Streichung: 3000 Hüllen bleiben liegen, bis irgendjemand zählt oder sweept.
  - Bestätigt und nicht angefasst: die Schleife über `#signalDestroySubscriptions.values()` in `clear()` ist unverändert die einzige Teardown-Stelle ohne `try` (Nebenbefund aus Paket 12).
  - Unter Paket 15 feuert der Zähler-Sweep in der gesamten Suite nie — der Finalizer ist immer schneller. Das ist genau eine der drei ungedeckten Zeilen.
- **Abgleich (2026-08-07): MEM-003 unverändert vorhanden, alle vier Szenarien selbst reproduziert.** Fundstellen über Symbolnamen abgeglichen: `allGroups` `src/SignalGroup.ts:28` (Audit `:27`), Finalizer-Guard `:48`, `getSignalGroupsCount()` `:67`, `allGroups.add(this)` `:264` und `groupFinalizationRegistry.register(object, this, this)` `:269` (Audit `:58-60`), Selbstaustragung in `clear()` `:923-924` (Audit `:230-238`). Paket 12 und 14 haben keine davon inhaltlich angefasst.
  **Die Empfehlung des Audits, wörtlich umgesetzt, bewegt keine einzige Zahl** (Schritt 2). Der Nutzer hat daraufhin am 2026-08-08 Weg A freigegeben: die drei tatsächlichen Wurzeln schwach halten, den Fall B als benannte Grenze dokumentieren. Der Weg über schwache Effect-Listener ist verworfen (Schritt 4).
- Dateien: `src/SignalGroup.ts`, `src/SignalGroup.gc.spec.ts`, `docs/api.md`, `docs/architecture.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Vorgehen:

  **Vorbemerkung zur Beweislage.** Alle Zahlen unten sind am 2026-08-07 gegen `c6ccd0b` selbst gemessen, mit `node --expose-gc`, 8 × `gc()` plus je 6 ms Settle. Die Reproduktionen laufen gegen das aktuelle `lib/`, die Varianten gegen **Kopien von `lib/` im Scratchpad** mit verlinktem `node_modules` — sechzehn Stück, jede genau eine Wurzel weiter. Am Projektcode ist nichts angefasst worden.
  **Zwei Messfallen sind dabei aufgeflogen; wer diesen Plan umsetzt, läuft in dieselben.** Erstens: ein `deref()` **vor** einem Heap-Snapshot legt sein Ziel in die `weak_refs_keep_during_job`-Liste, und der Snapshot zeigt dann einen Root (`(Strong root list) --weak_refs_keep_during_job-->`), den es nicht gibt. Snapshots deshalb ohne vorheriges `deref()` aufnehmen. Zweitens: eine Closure, die ihr Ziel auf `WeakRef` umstellt, schleppt über die V8-Context-Kette trotzdem alles mit, was **andere** Closures desselben Scopes referenzieren. Die erste Fassung des Effect-Umbaus hing so am `const group` des `EffectImpl`-Konstruktors und maß 200/200 überlebende Hosts, obwohl der `WeakRef` korrekt war. Ein `WeakRef`-Umbau gilt erst als erledigt, wenn er als Mutant gegengemessen ist — nicht, wenn er richtig aussieht.

  **A — die Reproduktion, vier Szenarien**

  1. Gegen `lib/`, je 500 bzw. 1000 Hosts:
     ```
     A (nur ein angehängtes Signal)        groups=0     signals=0     effects=0    <- eingesammelt
     B (Effect schließt über obj)          groups=500   signals=500   effects=500  <- nie eingesammelt
     C (Effect ohne obj-Capture)           groups=0     signals=0     effects=0    <- eingesammelt
     Dekorator A (1000 einfache Werte)     groups=0     signals=0
     Dekorator B (ein Wert -> Host, 1000)  groups=1000  signals=2000
     ```
     Deckungsgleich mit der `evidence`; die dort stehende `1` bei A und C ist die Resthost-Gruppe des dortigen Messskripts, die Richtung ist identisch. `SignalGroup.clear()` bringt alle Zeilen auf 0.

  **B — welche Wurzel welchen Fall hält**

  2. Gemessen wurde jede Wurzel einzeln und in Kombination (Zahl = überlebende Hosts nach `gc()`):
     | Variante | `allGroups` | Held-Value | Gruppen-Listener auf `globalDestroySignalQueue` | B | C | D |
     | --- | --- | --- | --- | --- | --- | --- |
     | v0 (HEAD) | stark | stark | stark | 500/500 | 0/500 | 1000/1000 |
     | v1 | **schwach** | stark | stark | 500 | 0 | 1000 |
     | v2 | stark | **WeakRef** | stark | 500 | 0 | 1000 |
     | v3 = **die Empfehlung des Audits** | **schwach** | **WeakRef** | stark | **500** | 0 | **1000** |
     | v7 | stark | stark | **schwach** | 500 | 0 | 1000 |
     | v5 = **Weg A ohne zweiten Finalizer** | **schwach** | **WeakRef** | **schwach** | 500 | 0 | **0** |
     | w9 / w10 / w11 (v5 ohne FR-Registrierung / ohne `store`-Eintrag / ohne beides) | schwach | — | schwach | **500** | 0 | 0 |
     **Die Empfehlung, wörtlich umgesetzt, bewegt nichts.** Erst die dritte Wurzel — die Closure, mit der die Gruppe pro angehängtem Signal auf `globalDestroySignalQueue` hört (`src/SignalGroup.ts:371-378`) und die `this` **und** `si` stark hält — macht den Dekorator-Fall frei. Fall B bleibt selbst dann bei 500, wenn man `FinalizationRegistry` und `store`-Eintrag **ganz entfernt** (w11).
  3. **Warum Fall B nicht an der Gruppe hängt.** Gegenprobe ohne jede Gruppe: 200 freie Effects (`createEffect(cb)`, kein `attach`), deren Callback ein Objekt liest — `groups=0`, und trotzdem **200 von 200 Hosts lebendig**. Nach `effect.destroy()`: 0 von 200. Der Retainer-Pfad aus dem Heap-Snapshot, ungekürzt:
     ```
     globalEffectQueue[Object] --property:<symbol eventize>--> EventStore --property:namedBuckets-->
     Map --internal:table--> Array --element:0--> EventListener --property:listenerObject-->
     EffectImpl --property:callback--> [closure] --context--> Host
     ```
     Die Quelle steht in `src/EffectImpl.ts:319`: `on(globalEffectQueue, this.id, RECALL, this)`, unbedingt im Konstruktor, Listener ist die Instanz. **Jeder lebende Effect ist selbst eine GC-Wurzel**, und jeder Host, den seine Callback-Closure erreicht, hängt daran. Dieselbe Bauart in `:634-635` für die Per-Signal-Abonnements. Das ist kein Versehen, sondern der Zustellweg — der Batch ruft einen Effect über seine ID auf der Queue auf.
  4. **Warum Fall B trotzdem nicht behoben wird** (Entscheidung vom 2026-08-08, hier nur noch als Begründung, nicht als Option): schwache Effect-Listener lösen ihn — gemessen, 500 → 0 —, kosten aber den Reaktivitätsvertrag. Ein `createEffect(cb)`, dessen Handle niemand aufhebt, läuft heute weiter; mit schwachen Listenern hört er nach dem nächsten `gc()` still auf. Gemessen, zwei Writes nach einem `gc()`: **HEAD `runs=3`, mit schwachen Listenern `runs=1`.** Dazu verlöre `off(globalEffectQueue, this)` in `destroy()` seinen Angriffspunkt (die Identität des Listener-Objekts). Fall B wird deshalb dokumentiert, nicht gefixt (Schritte 21-24).
  5. **Eine vierte Wurzel, die im Audit nicht vorkommt — und die den Umbau trägt statt ihn zu stören.** `attachEffect()` registriert `once(effect, DESTROY, () => this.#effects.delete(effect))` (`src/SignalGroup.ts:617-619`); die Closure hält die Gruppe stark und liegt in der Event-Ablage des Effects. Über den unsterblichen Effect ist damit **auch die Gruppe** erreichbar, sobald ein lebender Effect an ihr hängt. Daraus folgt die Invariante, auf der Schritt 12 ruht: **eine Gruppe mit mindestens einem lebenden angehängten Effect ist nicht einsammelbar.** Gemessen (w9, Fall C ohne Host-FR): `groups=500 effects=500` bleiben stehen, nachdem alle Hosts weg sind. Der Backstop für Fall C funktioniert also weiterhin, gerade weil diese Kante existiert — der schwache Held-Value findet seine Gruppe dort immer noch vor.
  6. **Der Held-Value-Mechanismus, isoliert nachgemessen** (200 Registrierungen, ohne signalize):
     ```
     register(target, held, target) mit held.back = target              -> targets_alive=200/200, callbacks=0
     register(target, held, target) mit held.back = new WeakRef(target) -> targets_alive=0/200,   callbacks=200
     ```
     Kontrolle für das Unregister-Token: 200 Token registriert, Targets fallengelassen — **0 von 200 Token leben**. Das Token ist schwach und bleibt `this`; nur der zweite Parameter wird umgebaut.

  **C — der Umbau in `src/SignalGroup.ts`**

  7. **Der Modulkopf.** `allGroups` hält ab jetzt `WeakRef`s, und daneben steht der zweite Finalizer. Der Ressourcen-Typ ist die Held-Value-Bauform aus Paket 13, auf eine Gruppe übertragen: er hält **nur** Abmelde-Handles und die eigene `WeakRef`, nichts davon zeigt stark auf die Gruppe oder den Host.
     ```ts
     // Iteration set: holds a WeakRef per live SignalGroup so the static
     // `clear()` can walk all groups. Weak, not strong (MEM-003): a plain
     // `Set` here is a module-level GC root for every group ever created,
     // and a group reaches its host through anything attached to it — an
     // `@signal accessor` whose value is `this` was enough to keep 1000 of
     // 1000 hosts alive. Dead husks are dropped by the group's own resource
     // finalizer below, and skipped by the two readers as a safety net.
     const allGroups = new Set<WeakRef<SignalGroup>>();

     type GroupResources = {
       selfRef?: WeakRef<SignalGroup>;
       unsubs: Set<() => void>;
     };

     /**
      * @internal Test seam for the resource finalizer in `SignalGroup.gc.spec.ts`.
      */
     export const $groupResources = Symbol.for(
       '@spearwolf/signalize/groupResources',
     );

     // MEM-003: what has to happen when a group is collected *without* its
     // `clear()` ever running — the price of holding the two roots above
     // weakly. The held value is resources only: the unsubscribe handles of
     // the group's per-signal destroy-queue subscriptions, plus the WeakRef
     // this group is filed under. Neither reaches the group (the listener
     // closures know it through a WeakRef, see `#addSignal`), so this
     // registration does not undo what the WeakRefs achieve. Without it the
     // leak only moves: measured over 1000 collected groups, 2000 listeners
     // stay on `globalDestroySignalQueue` for the lifetime of the process.
     //
     // Order is load-bearing: handles first, husk second. A GC test that
     // waits for `getSignalGroupsCount()` to fall back to its baseline then
     // knows every release has already run and needs no second settle step.
     const groupResourceFinalizer = new FinalizationRegistry<GroupResources>(
       (resources) => {
         for (const unsubscribe of resources.unsubs) {
           try {
             unsubscribe();
           } catch (err) {
             // A throw out of a FinalizationRegistry callback has no caller
             // to reach — it would take the process down. Same channel and
             // same reason as `clearGroupFromFinalizer` below.
             console.error(
               '[signalize] releasing the destroy-queue subscriptions of a collected SignalGroup failed:',
               err,
             );
           }
         }
         resources.unsubs.clear();
         if (resources.selfRef != null) {
           allGroups.delete(resources.selfRef);
         }
       },
     );
     ```
  8. **Der Guard des Host-Finalizers und der Zähler.** Der Guard bekommt weiterhin eine Gruppe (die Signatur bleibt, `SignalGroup.teardown.spec.ts` ruft sie direkt auf) und fragt über die instanzeigene `WeakRef` nach — kein Scan.
     ```ts
     export const clearGroupFromFinalizer = (group: SignalGroup): void => {
       const selfRef = group[$groupResources].selfRef;
       if (selfRef == null || !allGroups.has(selfRef)) return;
       try {
         group.clear();
       } catch (err) {
         console.error(
           '[signalize] a SignalGroup teardown threw in the FinalizationRegistry callback, where no caller can catch it:',
           err,
         );
       }
     };

     const groupFinalizationRegistry = new FinalizationRegistry<
       WeakRef<SignalGroup>
     >((groupRef) => {
       // MEM-003: the held value is a WeakRef, not the group. As the group
       // itself, it kept the group alive, the group kept the host alive
       // through anything attached to it, and this callback never ran.
       // Measured in isolation: 200 registrations whose held value points at
       // the target produce 200 survivors and 0 callbacks; through a WeakRef,
       // 0 survivors and 200 callbacks.
       const group = groupRef.deref();
       if (group !== undefined) clearGroupFromFinalizer(group);
     });

     export const getSignalGroupsCount = (): number => {
       let count = 0;
       for (const ref of allGroups) {
         if (ref.deref() === undefined) {
           allGroups.delete(ref);
         } else {
           count += 1;
         }
       }
       return count;
     };
     ```
     `Set.prototype.delete` während der eigenen Iteration ist spezifiziert und sicher. Der Zähler bleibt damit exakt: eine eingesammelte Gruppe wird nicht mehr mitgezählt, auch bevor ihr Finalizer gelaufen ist.
  9. **Der statische Sweep** (`static clear()`) — der Snapshot filtert tote Hüllen und entsorgt sie gleich mit. Der lange Kommentarblock aus Paket 12 (`:231-243`) bleibt Wort für Wort stehen; er handelt von Gruppen, die *während* des Sweeps entstehen, und daran ändert sich nichts.
     ```ts
     for (const ref of [...allGroups]) {
       const group = ref.deref();
       if (group === undefined) {
         allGroups.delete(ref);
         continue;
       }
       try {
         group.clear();
       } catch (err) {
         errors.push(err);
       }
     }
     ```
  10. **Das Feld und der Konstruktor.** Das Ressourcen-Objekt ist ein symbolgeschlüsseltes Feld — dasselbe Muster wie `$queueUnsubscribes` in Paket 13, aus demselben Grund: ein `#`-Feld ist aus dem Modul-Scope (Finalizer, Guard) nicht erreichbar, ein `public`-Feld wäre neue benannte Oberfläche.
      ```ts
      readonly [$groupResources]: GroupResources = {unsubs: new Set()};
      ```
      Im Konstruktor, an die Stelle von `allGroups.add(this)`:
      ```ts
      this.#storeKey = new WeakRef(object);
      store.set(object, this);

      const selfRef = new WeakRef(this);
      this[$groupResources].selfRef = selfRef;
      allGroups.add(selfRef);
      groupResourceFinalizer.register(this, this[$groupResources], this);

      // Register for auto-cleanup if the user object becomes unreachable
      // without an explicit clear/delete. Skip self-registration (when
      // object === this) — a group used as its own key cannot outlive itself.
      if (object !== this) {
        groupFinalizationRegistry.register(object, selfRef, this);
      }
      eventize(this);
      ```
      Dieselbe `WeakRef` dient als Element in `allGroups`, als Held-Value des Host-Finalizers und als Rückweg für den Guard — drei Verwendungen, ein Objekt, keine davon stark. Der Ressourcen-Finalizer wird **unbedingt** registriert, auch für eine selbstgeschlüsselte Gruppe: die bekommt zwar bewusst keinen Host-Backstop, hält aber genauso Handles auf `globalDestroySignalQueue`, und die gibt ab jetzt jemand frei. Beides steht hinter den beiden frühen `return`s des Konstruktors, eine Gruppe wird also weiterhin genau einmal registriert.
  11. **Die dritte Wurzel: der Per-Signal-Listener in `#addSignal()`.** Er ist die einzige Stelle, an der der Umbau eine Verhaltensfrage berührt — und die einzige, an der die Context-Falle aus der Vorbemerkung zuschlägt.
      ```ts
      if (!this.#signalDestroySubscriptions.has(si)) {
        // Deliberately `on`, not `once`: the same queue carries the
        // soft-detach emit from `off()` with `{detach: true}`, and a `once`
        // would be consumed by that one — leaving nobody to hear the real
        // destruction later.
        //
        // MEM-003: both captures are WeakRefs. `globalDestroySignalQueue`
        // is a module-level object and holds this listener for as long as
        // the subscription lives, so a strong `this` made every group with
        // an attached signal reachable from a GC root — and through the
        // group, its host. That is the third of the three roots; without it
        // the other two are worth nothing (measured: 1000 of 1000 hosts
        // survive with either one left strong).
        //
        // Nothing else in this scope may end up in the closure. V8 allocates
        // one context per scope, shared by every inner function, so a second
        // closure referencing `si` or `this` would drag them back in through
        // the context chain and quietly undo this. There is exactly one
        // inner function here — keep it that way.
        const groupRef = this[$groupResources].selfRef!;
        const siRef = new WeakRef(si);
        const unsubscribe = on(
          globalDestroySignalQueue,
          si.id,
          (_id: symbol, params?: {detach?: boolean}) => {
            if (params?.detach) return;
            const signal = siRef.deref();
            if (signal !== undefined) {
              groupRef.deref()?.#removeSignal(signal);
            }
          },
        );
        this.#signalDestroySubscriptions.set(si, unsubscribe);
        this[$groupResources].unsubs.add(unsubscribe);
      }
      ```
      `obj?.#priv(…)` ist gültiges ES2022 und innerhalb des Klassenrumpfs erlaubt. Ein Verhaltensunterschied entsteht nur in einem Fall, den es nicht gibt: wenn die Gruppe eingesammelt ist, während ihr Signal noch lebt und zerstört wird — dann gibt es niemanden mehr, dem das Entfernen etwas nützt.
  12. **Kein `effects`-Eintrag im Held-Value, und warum nicht.** Der erste Entwurf hielt zusätzlich `WeakRef`s auf die angehängten Effects, um sie beim stillen Einsammeln zu zerstören. Er ist gestrichen: nach der Invariante aus Schritt 5 ist eine Gruppe mit lebendem angehängtem Effect gar nicht einsammelbar, der Zweig wäre also toter Code — und toter Code auf einer Datei, die bei den Funktionen auf 100 % steht und dort keine Luft hat. Für Links gilt dasselbe aus der Gegenrichtung: ein eingesammelter Link gibt seine Queue-Subscriptions seit Paket 13 selbst frei und korrigiert `getLinksCount()` selbst; stirbt die Gruppe, stirbt der Link mit ihr, und sein eigener Finalizer räumt auf. Zu tun bleibt genau das, was Schritt 7 tut.
  13. **`#dropSignalSubscription()` trägt aus beiden Registern aus** — sonst wächst das `Set` im Held-Value bei Signal-Churn mit toten Handles:
      ```ts
      #dropSignalSubscription(si: ISignalImpl) {
        const unsubscribe = this.#signalDestroySubscriptions.get(si);
        if (unsubscribe) {
          unsubscribe();
          this.#signalDestroySubscriptions.delete(si);
          this[$groupResources].unsubs.delete(unsubscribe);
        }
      }
      ```
  14. **Die Selbstaustragung in `clear()`** (`:923-924`) — drei Zeilen statt zwei, plus das Leeren des Held-Values. Die Handles selbst sind eine Schleife weiter oben schon freigegeben worden.
      ```ts
      allGroups.delete(this[$groupResources].selfRef!);
      this[$groupResources].unsubs.clear();
      groupFinalizationRegistry.unregister(this);
      groupResourceFinalizer.unregister(this);
      ```
      Damit bleibt die Invariante aus Paket 12 unangetastet: Mitgliedschaft in `allGroups` deckt sich mit der in `store`, über die ganze Lebenszeit. Eingetragen wird beides im Konstruktor, ausgetragen beides hier — und auf dem neuen, stillen Weg fallen beide zugleich weg, weil der `store`-Eintrag mit seinem Schlüssel verschwindet und die Hülle vom Ressourcen-Finalizer entsorgt wird. Der Nebenbefund aus Paket 12 (die ungeschützte `unsubscribe`-Schleife bei `:899-903`) wird **nicht** mit angefasst: er ist eine eigene Entscheidung über eine neunte Sammelstelle, und dieses Paket hat genug offene Zweige.

  **D — die Tests, rot zuerst**

  15. **Test 1, der Beweis — `src/SignalGroup.gc.spec.ts`**, hinter den vorhandenen, in der Bauart von `src/link.gc.spec.ts`: `it('a host whose only back-reference is a signal value is reclaimed (MEM-003)')`. 50 Hosts in einer IIFE, je ein `createSignal(host, {attach: host})` — der Wert zeigt auf den Host, das Dekorator-Muster —, `WeakRef` auf jeden. Vorher `getSubscriptionCount(globalDestroySignalQueue)` und `getSignalGroupsCount()` als Baseline schnappschussen. Dann die vorhandene Budget-Schleife (`for (let i = 0; i < 20 && getSignalGroupsCount() > baseline; i += 1) await forceGc();`), danach drei Zusicherungen: kein `deref()` liefert mehr etwas, `getSignalGroupsCount()` ist auf der Baseline, und der Queue-Zähler ebenfalls. Auf `HEAD` **rot** an der ersten Zusicherung (gemessen 1000/1000 Hosts lebendig; mit 50 dieselbe Richtung).
      **Verlässlich wird er durch zweierlei:** die Budget-Schleife statt eines festen Settles, und die Reihenfolge im Ressourcen-Finalizer (Handles vor Hülle, Schritt 7) — wer auf `getSignalGroupsCount() === baseline` wartet, weiß damit, dass die Freigabe gelaufen ist, und die Queue-Zusicherung braucht keinen eigenen Timer. Dieselbe Zusage, die Paket 13 für `getLinksCount()` gebaut hat.
      **Drei Mutanten müssen ihn töten**, alle drei sind als Variante bereits gemessen: `allGroups` wieder stark (v1), Held-Value wieder `this` (v2), Per-Signal-Closure wieder stark (v7) — je 1000/1000 überlebende Hosts.
  16. **Test 2 — der `catch` des Ressourcen-Finalizers**: `it('a throwing release handle in a collected group is reported, not thrown (MEM-003)')`. Ein Host mit einem angehängten Signal; über `group[$groupResources].unsubs.add(() => { throw new Error('release-boom') })` ein Werfer dazu, `console.error` gespiegelt (`vi.spyOn`), Host fallenlassen, Budget-Schleife. Danach: genau ein `console.error`, `getSignalGroupsCount()` auf der Baseline (die Hülle geht trotz Wurf weg), Queue-Zähler auf der Baseline (die echten Handles laufen trotz des Werfers). Vorbild ist Test 4 aus Paket 13. `$groupResources` kommt dafür in den Import der Spec — es ist der Grund, warum das Symbol exportiert wird.
  17. **Test 3 — die Gegenrichtung, damit der Backstop nicht still verschwindet**: `it('a group whose host dies while an effect keeps it alive is still cleared (MEM-003)')`. Genau der Fall C aus Schritt 1, aber mit der Zusicherung, die heute niemand ausspricht — dass `clear()` gelaufen ist und nicht bloß eingesammelt wurde: ein `DESTROY`-Listener auf der Gruppe setzt eine Marke, und nach der Budget-Schleife ist die Marke gesetzt **und** `assertSignalsCount(0)`/`assertEffectsCount(0)` halten. Auf HEAD grün; er ist der Wächter dagegen, dass ein späterer »Aufräumschritt« den Held-Value-Deref oder die Kante aus Schritt 5 wegoptimiert und den Backstop damit in einen No-op verwandelt — der teuerste Fehler, den dieses Paket machen kann, und der einzige, den die Suite sonst nicht sieht.
  18. **Die vorhandenen GC-Tests, namentlich durchgegangen.** `src/SignalGroup.gc.spec.ts:75` (»FR clears the orphaned group and its attached resources«) hat einen angehängten Effect — die Gruppe überlebt den Host (Schritt 5), der Deref trägt, der Test bleibt grün. `:101` (»re-entrant clear from a DESTROY listener«) hat **nur** ein Signal, hält seine Gruppe aber über die Closure des `on(group, DESTROY, …)` im Testscope; grün, aber er ist der Kandidat, an dem eine spätere Umformulierung kippen kann. `:125` (»explicit clear() unregisters from FinalizationRegistry«) prüft, dass nichts doppelt feuert — mit `unregister()` für **beide** Registries (Schritt 14) bleibt das so. `:149` (»throwing teardown in an FR-collected group«) hat einen Effect, siehe oben. `src/SignalGroup.teardown.spec.ts` ruft `clearGroupFromFinalizer()` direkt (der Kanarienvogel aus Paket 12): die Signatur bleibt, der Guard fragt nur woanders nach — grün, und wenn nicht, ist der Guard verloren, nicht die Gruppe.
  19. **Was der Rot-Lauf braucht.** Test 1 und 2 einzeln laufen lassen (`pnpm test -- -t "…"`). Beide hinterlassen im Fehlerfall Signale, und die `beforeEach`/`afterEach`-Wachen der Datei melden das als Folgefehler in den Nachbartests — man liest sonst Kollateralschaden statt Befund.
  20. **Die Zählerfrage, und warum Paket 16 davor liegt.** Eine still eingesammelte Gruppe zerstört ihre Signale nicht, sie werden mit ihr eingesammelt: `getSignalsCount()` steht danach dauerhaft zu hoch (gemessen 2000 für 1000 Dekorator-Hosts). `assertSignalsCount()` steht in den `beforeEach`/`afterEach`-Wachen praktisch jeder Spec-Datei — Test 1 würde also nicht nur selbst scheitern, sondern die Restsuite vergiften. Mit MEM-006 davor korrigiert sich der Zähler selbst, und Test 1 nimmt `getSignalsCount() === signalBaseline` als **zweite** Abbruchbedingung in seine Budget-Schleife auf. Was Paket 16 dafür liefern muss, steht im Querbezug oben; die kurze Fassung: einen Finalizer auf dem `SignalImpl` mit einem Held-Value, der nicht auf das `SignalImpl` zeigt.

  **E — die Doku: den Vorbehalt aus `b23c22f` nachziehen, nicht löschen**

  21. **Was `b23c22f` gebaut hat und was daran jetzt falsch ist.** Der Commit hat die Bedingung, unter der der Backstop nicht feuert, an sechs Stellen vereinheitlicht; drei davon tragen die Aussage: `docs/api.md:426-436`, `docs/architecture.md:110-122` und `skills/using-signalize/references/pitfalls.md`, Pitfall 16a mit seinen vier Grenzen. Faktisch falsch ist danach:
      - **Die Begründung der Effect-Hälfte.** Alle drei sagen sinngemäß »die Gruppe hält den Effect, der Effect hält die Closure«. Gemessen hält `globalEffectQueue` den Effect, und die Gruppe ist daran unbeteiligt — 200 freie Effects ohne jede Gruppe pinnen ihre Hosts genauso (Schritt 3). Richtig lautet der Satz: *ein Effect ist von seiner Erzeugung bis zu seiner Zerstörung über die globale Effekt-Queue erreichbar; was seine Callback-Closure hält, hält damit die Queue.* Die Gruppe kommt darin nicht vor.
      - **Die Signalwert-Hälfte stimmt nach diesem Paket nicht mehr.** »an attached signal whose value holds a reference to the object will keep it alive« war wahr; ab jetzt werden Host und Gruppe gemeinsam eingesammelt. In `docs/api.md` und `docs/architecture.md` fällt der Satz weg und wird durch die neue Zusage ersetzt, in Pitfall 16a fällt der erste Aufzählungspunkt auf die Effect-Hälfte zusammen.
      - **Die Messung in Pitfall 16a** (»measurement puts them on a par — 200 groups, 200 still alive after `gc()` either way«) gilt nur noch für die Effect-Hälfte. Neue Zahl, gemessen: Signalwert 1000 → 0, Effect-Closure 500 → 500.
      - **Grenze (3) ist keine Randnotiz.** »It only covers resources reachable through a group with a host object … anything created without `attach` … stays subscribed to the global queues until destroyed by hand« steht heute als dritter von vier Spiegelstrichen und ist tatsächlich **die** Ursache der Effect-Hälfte. Sie wird hochgezogen und mit ihr verbunden.
      Was unverändert bleibt und bleiben muss: FR-Timing ist nicht zusicherbar, eine selbstgeschlüsselte Gruppe wird bewusst nicht registriert, Leak-Assertions in Tests brauchen weiterhin expliziten Teardown, und `clear()`/`delete()` bleiben der verlässliche Weg.
  22. **Die neue, vierte Grenze — sie entsteht durch diesen Fix und gehört in dieselben drei Dateien.** Eine Gruppe, die zusammen mit ihrem Host eingesammelt wird, hat **kein `clear()` gesehen**: sie emittiert kein `DESTROY`, ihre Signale werden nicht zerstört, sondern nur eingesammelt, und `hasSignal()`/`signal()` fragt danach ohnehin niemand mehr. Wer an `DESTROY` einer Gruppe hängt, hängt damit an einem Ereignis, das der GC-Pfad nicht liefert — und wer `getSignalsCount()` als Leck-Anzeige liest, sieht ohne die Selbstkorrektur aus MEM-006 eine Zahl, die zu hoch steht. Ein Satz in `docs/api.md`, einer in `docs/architecture.md`, ein Spiegelstrich in Pitfall 16a.
  23. `docs/cheat-sheet.md`: die `SignalGroup`-Zeile zu `getSignalGroupsCount()` bekommt den Halbsatz, dass eingesammelte Gruppen nicht mitgezählt werden. Mehr nicht — das Cheat-Sheet ist keine Stelle für Erreichbarkeitsrechnungen.
  24. `CHANGELOG.md`, unter `## Unreleased` → `### Bug Fixes`, englisch, ein Fakt pro Zeile: (a) dass `allGroups` und der Held-Value des `FinalizationRegistry` die Gruppe nur noch schwach halten und der Per-Signal-Destroy-Listener sie über eine `WeakRef` kennt, sodass ein Host, dessen einzige Rückverbindung ein Signalwert ist, samt Gruppe eingesammelt wird (MEM-003, gemessen 1000 von 1000 → 0); (b) dass eine so eingesammelte Gruppe ihre Subscriptions auf `globalDestroySignalQueue` über einen eigenen Finalizer freigibt (gemessen 2000 → 0) — ohne den wäre das Leck nur gewandert; (c) die Grenze, ausdrücklich: ein angehängter Effect, dessen Callback den Host liest, verhindert das Einsammeln weiterhin, weil jeder lebende Effect über die globale Effekt-Queue erreichbar ist; (d) dass eine still eingesammelte Gruppe kein `DESTROY` emittiert und ihre Signale nicht zerstört. Die Markenkollision mit dem Audit vom 2026-08-06 ist Bestand (Nebenbefund 2 aus Paket 14) und wird hier nicht neu geregelt.

  **F — Coverage**

  25. **Die enge Stelle ist nicht die Zeilenzahl, sondern die Funktionsschwelle.** `SignalGroup.ts` steht nach Paket 14 auf `97,84 / 87,93 / 100 / 99,24`; Paket 5 lässt 2 weitere ungedeckte Statements, 3 Zweige und 3 Zeilen zu, **bei den Funktionen aber keinen einzigen Ausfall**. Neu hinzu kommen zwei Funktionen (der Callback des Ressourcen-Finalizers und der des Host-Finalizers) und fünf Zweige (Deref-Filter im Zähler, Deref-Filter im Sweep, `selfRef == null` im Guard, `signal !== undefined` im Listener, `resources.selfRef != null` im Finalizer). Test 1 löst beide Funktionen und drei der Zweige aus, Test 2 den `catch`. Ungedeckt bleiben voraussichtlich die beiden Verteidigungs-`null`-Prüfungen — sie kosten Zweige, keine Funktionen, und passen in die Luft. Reißt es trotzdem, gilt die Regel aus dem Querbezug: die Datei wandert aus Stufe 2/3 in die globale Stufe 1, mit Begründungszeile hier, statt die Schwelle still abzusenken.
- Verify: `pnpm world` (enthält seit Paket 5/6 `test:gc`, `test:smoke` und `checkPkgTypes`), dazu die drei Mutanten aus Schritt 15, die GC-Suite zehnmal ohne Schwankung, und die Coverage-Gegenmessung aus Schritt 25. Die Gesamtzahl der Tests steigt um drei gegenüber dem Stand nach Paket 16. Zusätzlich, weil der Umbau genau daran scheitern kann und keine Suite es sieht: **das Messskript aus Schritt 2 gegen die gebaute Fassung** — Dekorator-Fall muss auf `hosts_alive=0/1000`, `groups=0`, `destQ=0` stehen.
- Commit: `fix(group): hold the group roots weakly and release a collected group's queue subscriptions (MEM-003)`

## Verlauf

- 2026-08-07 — `8c8f13d` `chore: update audit` (Vorlauf, kein Paket)
- 2026-08-07 — `ee813cc` Paket 1 · TEST-007, TEST-010
- 2026-08-07 — `dabbf8d` Paket 2 · TEST-001, TEST-004, TEST-009
- 2026-08-07 — `43e76dd` Paket 3 · TEST-002, TEST-003
- 2026-08-07 — `96dff42` Paket 4 · TEST-011, TEST-015
- 2026-08-07 — `f51ccfb` Paket 5 · TEST-005, TEST-006, TEST-014
- 2026-08-07 — `3477ac9` Paket 6 · TEST-008, BUILD-008
- 2026-08-07 — `7155066` Paket 7 · TEST-012, TEST-013 — **Sprint 1 abgeschlossen**
- 2026-08-07 — `d44427d` Paket 8 · BUG-001 (critical), BUG-002, BUG-008
- 2026-08-07 — `cfdfc26` Paket 9 · BUG-005, BUG-006, BUG-007
- 2026-08-07 — `dcfaa27` Paket 10 · BUG-004
- 2026-08-07 — `07b712a` Paket 11 · BUG-003
- 2026-08-07 — `6f211d7` Paket 12 · BUG-009, BUG-010 — **Sprint 2 abgeschlossen**
- 2026-08-07 — `63cfedd` Paket 13 · MEM-001, MEM-005
- 2026-08-07 — `0063c52` Paket 14 · MEM-002, MEM-004
- 2026-08-08 — `1814165` Paket 16 · MEM-006, MEM-007 (vorgezogen)
- 2026-08-08 — `a3d5519` Paket 15 · MEM-003 — **Sprint 3 abgeschlossen**

## Abschluss (2026-08-08)

**Voller Verify-Lauf gegen die Baseline:** `pnpm world` Exit 0. `check` ✓ (85 Dateien) · `compile` ✓ · `bundle` ✓ · `test:smoke` ✓ · `checkPkgTypes` ✓ · `test` ✓ **478 passed, 0 skipped** · `test:gc` ✓ 478 passed. Baseline war 377 passed / 9 skipped bei Branch 89,9 %; jetzt 478 passed / 0 skipped bei Branch 93,73 %. Nichts ist rot, was vorher grün war. Vorbestehende Fehler gab es keine.

**Semver-Bewertung: der Lauf ist breaking.** Höchste zutreffende Stufe nach mehreren Kriterien gleichzeitig — verschärfte Typdefinition (`batch()` lehnt `async`-Callbacks jetzt zur `tsc`-Zeit ab, `beQuiet<T>()` verengt auf `NonThenable`), geänderte Gestalt geworfener Objekte (BUG-004, BUG-002), geändertes Default-Verhalten öffentlicher Funktionen (`getSignalsCount()`, `SignalAutoMap#delete()`, `createMemo()`).

**Keine Versionsanhebung.** `package.json` führt `1.0.0-dev` — kein veröffentlichter Stand, sondern ein bewusst gesetzter Marker aus `47325da chore: set version to 1.0.0-dev`. Das Projekt hat einen echten Release-Prozess (`chore: release v0.31.1`, `v0.31.0`, `v0.30.0` als eigene Commits), und die Konvention lautet: Einträge sammeln sich unter `## Unreleased`, ein eigener Release-Commit hebt Version und Datum. Der nächste Release ist nach diesem Marker 1.0.0 und damit selbst ein Major-Release — eine Anhebung von `1.0.0-dev` wäre Lärm. Die Veröffentlichung entscheidet der Nutzer.

**CHANGELOG.** Kein Sammel-Eintrag für den Lauf: die Projektregel aus `CLAUDE.md` verlangt eine Zeile je benutzersichtbarer Änderung unter `## Unreleased`, und jedes Paket hat seine gesetzt. Zum Abschluss zwei Korrekturen: die **ID-Kollision** zwischen dem Audit vom 2026-08-06 und dem vom 2026-08-07 ist aufgelöst — vierzehn Kennungen (`MEM-001` bis `MEM-007`, `BUG-002` bis `BUG-008`) standen für je zwei verschiedene Findings und tragen jetzt das Audit-Datum; 56 Zeilen berührt, nur Klammerinhalte. Und drei beobachtbare Verhaltensänderungen sind von `### Bug Fixes` zusätzlich in die Migrationsliste `### Breaking Changes` nachgetragen worden: MEM-006 (Zählersemantik), BUG-004 (Gestalt des geworfenen Objekts), MEM-004 (ein selbst gesetztes `retain()` verschwindet). Bewusst **nicht** nachgetragen: MEM-002 (nur über das `@internal`-`memberCounts` beobachtbar, einziger Konsument ist `src/assert-helpers.ts`) und BUG-003 (der alte Zustand war eine taube Hülle mit zwei unlöschbaren Subscriptions — kein vernünftiger Code verlässt sich darauf).

**Wie der Plan sich gegenüber der Freigabe bewegt hat:**

- **Scope +1:** `BUILD-008` kam auf Nutzerentscheidung in Paket 6 dazu (33 statt 32 Findings) — `attw` prüft dieselbe `exports`-Map und dieselben `.d.ts` statisch, die der Smoke-Test zur Laufzeit prüft.
- **Reihenfolge geändert:** Paket 16 lief vor Paket 15. Weg A hinterlässt eine still eingesammelte Gruppe ohne `clear()`; ohne die Selbstkorrektur des Signalzählers aus MEM-006 hätte Test 1 nicht nur selbst versagt, sondern über `assertSignalsCount()` die Restsuite vergiftet.
- **Ein Auftrag reduziert:** MEM-003 wurde auf Nutzerentscheidung auf »Wurzeln schwach halten« eingegrenzt, nachdem der Planer gemessen hatte, dass die Audit-Empfehlung für den Fall, der das Finding trägt, **keine einzige Zahl bewegt**. Fall B bleibt als benannte Grenze — er hängt an `EffectImpl`, und der Weg dorthin kostet den Reaktivitätsvertrag.
- **Kein Finding entfiel als gegenstandslos**, kein Paket wurde geteilt oder zusammengelegt, keines blieb blockiert.
- **Vier Audit-Empfehlungen wurden gemessen und verworfen**, jede mit Begründung im jeweiligen Detailplan: BUG-008 (Nachlesen dupliziert die Emission statt sie zu ordnen), BUG-003 (macht `off()` wirkungslos statt es zu reparieren), MEM-001 (`off(queue, id)` reißt fremde Abonnenten mit), MEM-003 (bewegt keine Zahl).
- **Zwei Nebenbefunde erledigten sich unterwegs:** der aus Paket 8 durch `Priority.Max` in Paket 14, und der aus Paket 4 nebenbei — der Fix für MEM-004 hat genau den Mechanismus repariert, an dem der ASYNC-005-Test gescheitert war. Er kann seine Behauptung jetzt beweisen.

**Offene Nebenbefunde: 17**, bewusst nicht mehr in diesen Lauf gezogen. Die schwersten drei:

1. **Nichts im Projekt typprüft die Specs** — `tsconfig.lib.json` schließt `src/**/*.spec.ts` aus, `pnpm check` ist Biome, Vitest läuft ohne `typecheck`. Jedes `@ts-expect-error` in einer Spec ist Dekoration.
2. **`SignalGroup.ts` hat null Statements und null Zeilen Coverage-Reserve** (304/313 gegen 97 %, 294/299 gegen 98 %). Ein einziges weiteres ungedecktes Statement reißt das Gate.
3. `AGENTS.md` und `CLAUDE.md` behaupten, Vitest sei auf `src/` gewurzelt — `root` ist `.`, die Eingrenzung läuft über `include`. Wer der Doku glaubt und eine Schwellen-Glob ohne `src/`-Präfix schreibt, bekommt eine Regel, die nichts trifft und klaglos nichts prüft.

Dazu: die ungeschützte `unsubscribe`-Schleife in `SignalGroup#clear()`, `attachEffect()` ohne die `Priority.Max`-Absicherung, die die Links jetzt haben, `getLinksCount()` gegen einen hochprioren werfenden Listener, und zehn kleinere.

**`./audit.html` ist unangetastet.** Der Folgelauf über `js-ts-project-audit` verifiziert jedes behobene Finding am Code und schreibt Score und Historie fort — wer sich selbst benotet, hat immer bestanden.
