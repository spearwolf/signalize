# Remediation-Plan — @spearwolf/signalize

Quelle: ./audit.html vom 2026-08-06 (Score-Lauf 0) · Branch: `main` · erstellt: 2026-08-06

Baseline (vor Lauf-Beginn, alles grün): `pnpm world` ✓ — biome check ✓ · tsc ✓ · rollup ✓ · vitest 347 passed / 7 skipped, Coverage 97,03 · 89,38 · 96,92 · 97,58. Zusätzlich `pnpm test:gc` ✓ — 354 passed. Arbeitsbaum sauber.

Scope: 10 von 64 Findings — alle `MEM-*` (2 high, 5 medium, 3 low), vom Nutzer so benannt. Version ist `1.0.0-dev`, die 1.0.0 ist unveröffentlicht; Verhaltensänderungen sind zulässig.

## Nicht im Scope

Alles außerhalb der Kategorie »Memory Leaks & Ressourcen«: BUG-*, ASYNC-*, PKG-*/REPO-*, API-*, ARCH-*, TEST-*, TYPE-*, CONS-*, DEP-*, PERF-*, DX-*, IMPL-* und die info-Findings. Die `acknowledged`-Liste des Audits ist leer.

## Vorbestehende Fehler

Keine. Baseline auf ganzer Breite grün.

## Entscheidungen

- **MEM-004** — Der veraltete async-Cleanup wird ausgeführt statt verworfen; der JSDoc, der die Verwerfung begründet, wird auf die neue Begründung umgeschrieben. (2026-08-06)
- **MEM-007** — ~~Umbau auf schwache Haltung: WeakRef-Werte in der inneren Map plus FinalizationRegistry.~~ **Revidiert am 2026-08-06, nachdem der Paket-Planer den Umbau prototypisch durchgemessen hatte.** Der Nichtdeterminismus trifft nicht nur Callbacks ohne externe Referenz, sondern Signal-Ziele genauso: `link(a, b)` mit weggeworfenem Rückgabewert propagiert nach einer GC-Runde nicht mehr (gemessen `b = 2` statt `3`, `links = 0`) — das Kopfbeispiel aus `docs/recipes.md:496`, `README.md:281` und dem Skill. Der Fehlermodus würde von »leckt sichtbar in `getLinksCount()`« zu »hört still auf zu funktionieren« wechseln. **Gültig ist jetzt: nur die Doku korrigieren.** Der Code bleibt; die Zusage der schwachen Haltung in `src/SignalLink.ts` und in `src/link.ts` wird auf das tatsächliche Verhalten gehoben — ein Link lebt, bis `destroy()`, `unlink()` oder die Zerstörung der Quelle ihn abräumt —, und das Wachstum bei verwaisten Links wird zur dokumentierten Aufräumpflicht. (2026-08-06)
- **MEM-008** — Code-Fix: der `attach`-Zweig wird ebenfalls an den erzeugenden Effect gebunden, `docs/recipes.md` zieht nach. (2026-08-06)
- **MEM-009** — Nur `delete(key)`. Das optionale Abräumen fehlender Keys in `updateFromProps()` bleibt draußen: es würde Signale zerstören, die Aufrufer noch halten. (2026-08-06)
- **Umsetzung** — Pro Paket ein Implementierungs-Subagent plus Review, wie der Skill es vorsieht. (2026-08-06)
- **Paket 9, außerhalb des Audits** — Der werfende Teardown im FinalizationRegistry-Callback (`src/SignalGroup.ts:34-38`) beendet gemessen den Prozess (`uncaughtException`, Node bricht ab). Wird als eigenes Paket 9 aufgenommen: `try/catch` um den `clear()`-Aufruf, Meldung über `console.error` mit derselben Begründung, die `emitEffectError` ausformuliert. MEM-001 hatte auf diese Stelle gezeigt, ohne sie zu adressieren. (2026-08-07)
- **MEM-008, Folgeentscheidung** — Ein `{attach}`-Memo stirbt mit seinem erzeugenden Effect, auch wenn dieser Effect durch `group.off()` stirbt. Eine Regel statt zwei; die Alternative hätte `createMemo()` an ein internes `#busy`-Bit von `SignalGroup` gekoppelt. Die Doku-Zusage »`off()` lässt attachte Signale am Leben« (`docs/api.md:426`, `docs/recipes.md:421`) wird auf Signale präzisiert, die nicht an einem Effect hängen; der Wächter-Test `src/createMemo.spec.ts:316` wird umgedreht. (2026-08-06)

## Abschluss (2026-08-07)

**Neun Pakete erledigt, zehn von zehn MEM-Findings behoben, neun Commits.** Kein Paket blockiert, kein Stash offen.

Abschluss-Verify auf dem übergebenen Baum: `pnpm world` Exit 0 (biome check · tsc · rollup · 377 passed / 9 skipped, Coverage 96,55 · 89,90 · 97,54 · 97,04), `pnpm test:gc` Exit 0 (386 passed), `pnpm bench` Exit 0. Gegen die Baseline (347 passed / 7 skipped, alle Kommandos grün) ist nichts rot geworden. Die Coverage-Statements liegen 0,5 Punkte unter der Baseline: die neuen `catch`-Zweige in `SignalGroup` haben keinen Test, kein Gate schlägt an.

**Semver: major.** Vier Änderungen an der öffentlichen Oberfläche fallen in diese Stufe: ein veralteter async-Cleanup wird jetzt ausgeführt statt verworfen (MEM-004); ein `{attach}`-Memo aus einem Effect-Rumpf stirbt mit seinem Effect, auch über `group.off()` (MEM-008 samt Folgeentscheidung); ein hart zerstörtes, namensgebundenes Signal verliert seine Namensbindung, `hasSignal(name)` liefert danach `false` statt des toten Signals (MEM-002); und `clear()`/`off()` werfen bei mehreren Teardown-Fehlern einen `AggregateError`, wo vorher der erste Fehler den Abbau abbrach (MEM-001). Dazu ein neuer Export, `SignalAutoMap#delete(key)` — minor, aber die höchste Stufe gilt.

**Keine Versionsanhebung vorgenommen.** `package.json` steht auf `1.0.0-dev`, dem Marker für die noch unveröffentlichte 1.0.0. Genau diese Major nimmt die Breaking Changes auf; zwischen dem letzten Release `v0.31.1` und ihr gibt es nichts, wogegen zu brechen wäre. Kein Tag, kein Push, kein Publish — das gehört dem Nutzer.

**Kein CHANGELOG-Sammeleintrag.** Die Projektregel in `CLAUDE.md` verlangt eine Zeile pro Änderung unter `## Unreleased`; die stehen vollständig dort, gruppiert nach Features, Bug Fixes und Documentation.

### Wie der Plan sich bewegt hat

Der freigegebene Grobplan hatte sieben Pakete. Geworden sind es neun, in der Reihenfolge 1 → 2 → 3 → 4 → 5 → 6 → 8 → 9 → 7:

- **Paket 8** kam aus einem Nebenbefund von Paket 1: die statische `SignalGroup.clear()` hatte denselben Sammel-Fehler wie MEM-001, eine Ebene höher.
- **Paket 9** entstand beim Messen für Paket 8 und wurde vom Nutzer freigegeben: ein werfender Teardown im FinalizationRegistry-Callback beendete den Prozess. MEM-001 hatte auf diese Stelle gezeigt, ohne sie zu adressieren.
- **MEM-007 wurde mitten im Lauf revidiert.** Der beschlossene WeakRef-Umbau war prototypisch fertig gemessen, als sich zeigte, dass er nicht nur Callbacks ohne externe Referenz trifft, sondern Signal-Ziele genauso: `link(a, b)` mit weggeworfenem Rückgabewert hätte nach einer GC-Runde still aufgehört zu propagieren — das Kopfbeispiel der Doku. Der Nutzer hat auf die Doku-Korrektur umgestellt; Paket 5 wurde neu geschrieben.
- **MEM-008 brauchte eine Folgeentscheidung**, weil der Fix eine dokumentierte Zusage über `group.off()` zurücknahm.
- Kein Finding entfiel als gegenstandslos. Alle zehn wurden vom jeweiligen Paket-Planer empirisch gegen den gebauten Stand reproduziert, bevor sie behoben wurden.
- **Drei Findings behoben mehr, als sie versprachen:** MEM-006 schloss einen zweiten Zombie-Pfad (Signal wird im Callback nach dem Read zerstört), MEM-002 griff erst nach einer Runde auch auf dem Namenspfad, über den der `@signal`-Dekorator vollständig läuft, und Paket 3 nahm den synchronen Zwilling von MEM-004 mit.

### Nicht in diesem Lauf behoben

Bewusst liegengelassen, mit Fundstelle, als Eingabe fürs nächste Audit:

- **`src/SignalGroup.ts:196`** — legt ein `DESTROY`-Listener während des statischen Sweeps eine neue Gruppe an, wischt das unbedingte `allGroups.clear()` sie aus der Registry, ohne sie abzuräumen. `getSignalGroupsCount()` meldet 0, während eine voll aufgebaute Gruppe weiterlebt und kein zweiter Sweep sie erreicht.
- **`src/SignalAutoMap.ts:60-65`** — `clear()` zerstört zuerst und trägt dann aus, umgekehrt zu `delete()`. Dieselbe Re-Entrancy-Falle, ohne Wächter.
- **`src/createSignal.ts:174-177`** — `fromProps()` übernimmt ein als Prop-Wert übergebenes Signal per Identität; `clear()` zerstört damit fremdes Eigentum.
- **`stripInternal` ist nicht gesetzt** — `SignalGroup#memberCounts`, `clearGroupFromFinalizer` und `Effect#onDestroy` stehen trotz `@internal` in den ausgelieferten `lib/*.d.ts`. Kein unterstützter Importpfad erreicht sie.
- **`src/Effect.ts`** — der öffentliche Wrapper hat keinen `destroyed`-Getter, obwohl `EffectImpl` einen führt; Tests müssen über `assertEffectsCount()` gehen.
- **Coverage-Lücken ohne Test:** die neuen `catch`-Zweige in `SignalGroup` (werfendes `link.destroy()`, werfendes `childGroup.clear()`, werfender `OFF`-Listener), der Thenable-Zweig in `runOrphanedCleanupCallback()` und der `AggregateError`-Fall über den Finalizer. Alle drei per Sonde als funktionierend belegt, keiner bewacht.
- **`src/createMemo.spec.ts:13` und `:50`** — zwei Alt-Tests zerstören ihre Memos nie und verschmutzen den modulglobalen Effect-Zähler.
- **`src/SignalAutoMap.spec.ts:432-433`** — eine Zierassertion, die den Lebendigkeits-Nachweis suggeriert, den sie nicht leistet.

## Pakete

### [x] 1. SignalGroup-Teardown: Fehler einsammeln, tote Mitglieder austragen
- Findings: MEM-001 (high), MEM-002 (high) — beide behoben, Review abgenommen
- Hash: `924c687` · Verify vom Orchestrator: `pnpm world` ✓, `npx vitest run` 356 passed / 7 skipped (Baseline 347), `pnpm test:gc` 363 passed. Eine Review-Runde nötig (MEM-002 griff nicht auf dem Namenspfad).
- Ziel: `clear()` und `off()` ziehen den Abbau trotz werfender Cleanups vollständig durch, und zerstörte Effects wie Signale verlassen die Gruppen-Sets von selbst.
- Bereich: `src/SignalGroup.ts`
- Hängt ab von: —
- Modell: stärkste Stufe
- Hash: —
- Dateien: `src/collect-errors.ts` (neu), `src/EffectImpl.ts`, `src/SignalGroup.ts`, `src/SignalGroup.teardown.spec.ts` (neu)
- Verify: `npx tsc --noEmit -p tsconfig.json && npx vitest run`
- Commit: `fix(group): collect teardown errors and drop destroyed members (MEM-001, MEM-002)`
- Abgleich (2026-08-06, vom Orchestrator, Zug 0 entfällt für Paket 1): MEM-001 unverändert — `off()` bei `src/SignalGroup.ts:548-589`, `clear()` bei `595-641`, beide haben nur `finally { this.#busy &= ~BIT }`. MEM-002 unverändert — `attachEffect()` bei `473-476` ist ein nacktes `Set.add`, `#addSignal()` bei `273-285` ebenso.

- Vorgehen:
  1. **Neues Modul `src/collect-errors.ts`.** Es exportiert `throwCollectedErrors(errors: unknown[], what: string): void` mit dem Rumpf des heutigen modul-lokalen `throwCollectedErrors` aus `src/EffectImpl.ts:135-142`: bei `errors.length === 0` return, bei genau einem Fehler diesen unverändert werfen, sonst `new AggregateError(errors, \`[signalize] ${errors.length} errors while ${what}\`)`. Die Datei importiert nichts — sie ist eine Blattdatei unterhalb von `signal-core.ts` und darf nie etwas aus dem Paket importieren (`rollup.config.mjs` wirft bei `CIRCULAR_DEPENDENCY`). JSDoc der alten Fassung mitnehmen und um den `what`-Parameter ergänzen.
  2. **`src/EffectImpl.ts`**: die lokale Konstante samt JSDoc entfernen, stattdessen `import {throwCollectedErrors} from './collect-errors.js';` (mit `.js`-Endung, NodeNext). Die beiden Aufrufstellen (Zeile 640 in `destroyChildEffects()`, Zeile 794 in `destroy()`) rufen jetzt `throwCollectedErrors(errors, 'destroying an effect')` — die Fehlermeldung bleibt damit wortgleich zu heute.
  3. **`SignalGroup.clear()` (MEM-001).** Innerhalb des bestehenden `try { … } finally { this.#busy &= ~BUSY_CLEAR; }` ein `const errors: unknown[] = [];` anlegen. Jeder Aufruf, der in Anwendungscode führen kann, bekommt sein eigenes `try/catch (err) { errors.push(err); }`: `emit(this, DESTROY, this)`, jedes `childGroup.clear()`, jedes `effect.destroy()`, jedes `destroySignal(signal)`, jedes `link.destroy()`. Die Reihenfolge der heutigen Schleifen bleibt exakt erhalten. `off(this)`, die sieben `.clear()`-Aufrufe auf den eigenen Collections, `this.#parentGroup?.detachGroup(this)`, das Aufräumen von `#storeKey`, `allGroups.delete(this)` und `groupFinalizationRegistry.unregister(this)` laufen in jedem Fall. Ganz am Ende, **nach** dem vollständigen Aufräumen und noch innerhalb des `try`, `throwCollectedErrors(errors, 'clearing a signal group')`.
  4. **Iteration über Snapshots.** Weil Schritt 6 und 7 dafür sorgen, dass ein `effect.destroy()` bzw. ein `destroySignal()` das jeweilige Set während der Schleife verändert, laufen die Schleifen in `clear()` und `off()` über Kopien: `for (const effect of [...this.#effects])`, `for (const signal of [...this.#signals])`, `for (const link of [...this.#links])`, `for (const childGroup of [...this.#groups])`.
  5. **`SignalGroup.off()` (MEM-001).** Dieselbe Sammel-Strategie innerhalb des bestehenden `try`: eigenes `try/catch` je `childGroup.off()`, je `effect.destroy()`, je `link.destroy()`, je `emit(globalDestroySignalQueue, si.id, si.id, {detach: true})` und um `emit(this, OFF, this)`. `this.#effects.clear()` und `this.#links.clear()` laufen in jedem Fall, an derselben Stelle wie heute. Das `OFF`-Event wird also auch dann emittiert, wenn vorher etwas geworfen hat. Abschluss wie oben mit `throwCollectedErrors(errors, 'switching off a signal group')`.
  6. **`attachEffect()` (MEM-002).** Nur wenn der Effect noch nicht im Set ist, einen Hook registrieren, sonst wächst die Listener-Liste bei wiederholtem `attachEffect(sameEffect)`:
     ```ts
     attachEffect(effect: EffectImpl) {
       if (!this.#effects.has(effect)) {
         this.#effects.add(effect);
         once(effect, DESTROY, () => {
           this.#effects.delete(effect);
         });
       }
       return effect;
     }
     ```
     `once` aus `@spearwolf/eventize` importieren (die Datei importiert heute nur `emit`, `eventize`, `off`). `EffectImpl.destroy()` emittiert `DESTROY` auf sich selbst (`src/EffectImpl.ts:772`), bevor es `off(this)` ruft — der Hook feuert also verlässlich.
  7. **`#addSignal()` (MEM-002).** Ein neues privates Feld `readonly #signalDestroySubscriptions = new Map<ISignalImpl, () => void>();`. In `#addSignal()`, nachdem `this.#signals.add(si)` gelaufen ist und nur falls `!this.#signalDestroySubscriptions.has(si)`:
     ```ts
     const unsubscribe = on(globalDestroySignalQueue, si.id, (_id: symbol, params?: {detach?: boolean}) => {
       if (params?.detach) return;
       this.#dropSignalSubscription(si);
       this.#signals.delete(si);
       this.#directSignals.delete(si);
     });
     this.#signalDestroySubscriptions.set(si, unsubscribe);
     ```
     Bewusst `on` und nicht `once`: über dieselbe Queue läuft der Soft-Detach aus `off()` mit `{detach: true}`, und ein `once` würde von diesem Emit verbraucht, bevor die harte Zerstörung je kommt. `on` zusätzlich zu `emit`/`eventize`/`off` importieren.
  8. **Handle-Hygiene.** Eine private Methode `#dropSignalSubscription(si: ISignalImpl)`, die das Handle aus `#signalDestroySubscriptions` holt, aufruft und den Eintrag löscht. Sie wird gerufen: im Handler aus Schritt 7; in `#releaseFromName()` unmittelbar vor `this.#signals.delete(si)` (heute `src/SignalGroup.ts:312`); in `detachSignal()` unmittelbar vor `this.#signals.delete(si)` (heute `src/SignalGroup.ts:432`); und in `clear()` für alle verbliebenen Einträge, direkt vor `this.#signals.clear()` — dort über eine Kopie der Werte iterieren und die Map anschließend leeren.
  9. **Regressionstests zuerst, in `src/SignalGroup.teardown.spec.ts`.** Vier Tests, jeder muss vor dem Fix rot laufen; der rote Lauf gehört in den Report:
     - `clear()` mit einem werfenden Effect-Cleanup: Gruppe mit zwei Effects (der erste mit einem Cleanup, das wirft), einem attachten Signal und einem Link. Erwartung: `clear()` wirft, aber der Cleanup des zweiten Effects ist gelaufen, `getSignalsCount()`/`getEffectsCount()`/`getLinksCount()` sind auf dem Stand vor der Gruppe, und `getSignalGroupsCount()` ist um eins gefallen.
     - `off()` mit einem werfenden Effect-Cleanup: Erwartung: `off()` wirft, `getEffectsCount()`/`getLinksCount()` sind zurück auf Ausgangsstand, und ein `OFF`-Listener auf der Gruppe hat genau einmal gefeuert.
     - Zwei werfende Cleanups in einem `clear()`: Erwartung `AggregateError` mit beiden Fehlern in Teardown-Reihenfolge; ein einzelner Fehler wird unverändert durchgereicht.
     - MEM-002: gegen eine langlebige Gruppe 50-mal `createEffect(…, {attach: group})` anlegen und sofort zerstören sowie 50-mal `createSignal()` attachen und mit `destroySignal()` zerstören. Erwartung: die Gruppe hält danach nichts mehr — geprüft über die neue, test-only Hilfe (siehe Schritt 10), nicht über die globalen Zähler, denn die stehen ohnehin auf 0.
  10. **Test-Zugriff auf die Set-Größen.** `src/assert-helpers.ts` (test-only, nicht über `src/index.ts` exportiert) um `getGroupMemberCounts(group: SignalGroup): {signals: number; effects: number; links: number; groups: number}` ergänzen. Die Zahlen kommen aus privaten Feldern, also braucht `SignalGroup` dafür einen `/** @internal */`-Getter oder eine statische Brücke — kein `any`-Cast und keine Reflection. Wähle die Variante, die zum Stil der Datei passt, und beschreibe sie im Report.
  11. **Doku.** `CHANGELOG.md` unter `## Unreleased` → `### Bug Fixes`: je eine Zeile für den vollständigen Teardown trotz werfender Cleanups und für das Austragen zerstörter Effects/Signale aus der Gruppe. Bestehende `## v0.x.y`-Abschnitte bleiben unangetastet. Die JSDoc von `off()` und `clear()` um je einen Satz zum Fehlerverhalten ergänzen (gesammelt, `AggregateError` bei mehreren). `docs/api.md` nur anfassen, falls dort das Wurfverhalten von `clear()`/`off()` beschrieben ist.

**MEM-001 · high · src/SignalGroup.ts:595-641 · src/SignalGroup.ts:548-589** — Teardown-Fehler in `SignalGroup.clear()`/`off()` einsammeln statt abbrechen

Beide Methoden haben nur ein `finally` für das `#busy`-Bit. Wirft ein einziger Effect-Cleanup oder ein `DESTROY`-Listener, bricht der komplette Abbau ab: Geschwister-Effects bleiben aktiv und subscribed, Signale werden nicht zerstört, Links nicht abgebaut, `#effects`/`#links` nie geleert, die Gruppe bleibt in `store` und `allGroups`. Bei `off()` fehlen zusätzlich die Soft-Detach-Emits und das `OFF`-Event. `EffectImpl.destroy()` macht genau das richtig — sammeln, weitermachen, am Ende `AggregateError`; `SignalGroup` hat diesen Fix nicht mitbekommen. Besonders bitter: `clear()` läuft auch aus dem FinalizationRegistry-Callback, wo kein Anwendungscode den Wurf je auffangen kann.

Empfehlung: Dieselbe Sammel-Strategie wie `EffectImpl.destroy()`: jeder `destroy()`/`destroySignal()`/`emit()`-Aufruf unter eigenem `try`, Fehler in ein Array, Rest des Teardowns durchziehen, am Schluss gesammelt werfen.

Belegt mit: `before clear: signals=3 effects=2 links=1 groups=1` → `clear() threw: cleanup boom` → `after clear: signals=3 effects=1 links=1 groups=1` (erwartet 1/0/0/0), Geschwister-Cleanup lief nicht, Gruppe blieb registriert. Für `off()`: `after off(): effects=1 links=1 OFF emitted=0` (erwartet 0/0/1).

**MEM-002 · high · src/SignalGroup.ts:473-476 · src/SignalGroup.ts:273-285** — Zerstörte Effects und Signale aus den SignalGroup-Sets entfernen

`attachEffect()` legt den Effect in `#effects` ab und registriert keinen `DESTROY`-Hook; `#addSignal()` ebenso wenig für Signale. `SignalLink.attach()` macht es richtig (`once(this, DESTROY, () => group.detachLink(this))`) — Effects und Signale haben dieses Gegenstück nie bekommen. Eine langlebige Gruppe (Component-Host, `@signal`-dekoriertes Objekt) mit Effect-Churn sammelt daher jeden toten `EffectImpl` samt Callback-Closure und jedes zerstörte `SignalImpl` bis zum `clear()`. `getEffectsCount()` zeigt korrekt 0, der Speicher ist trotzdem weg.

Empfehlung: In `attachEffect()` ein `once(effect, DESTROY, () => this.#effects.delete(effect))` registrieren; für Signale analog über `once(globalDestroySignalQueue, si.id, …)`.

Belegt mit: 5000× create+destroy gegen eine langlebige Gruppe, `--expose-gc` — Effects: 8785 KiB gehalten bei 0 lebenden Effects, nach `group.clear()` 602 KiB. Signale: 3503 KiB gehalten, nach `clear()` 298 KiB.

#### Kleine Review-Befunde (nicht behoben, bewusst)
- Der Rumpf von `detachSignal()` sitzt jetzt in `#removeSignal(si)`, die auch der Destroy-Hook ruft — verhaltensgleich, vom Reviewer mit neun Sonden geprüft.
- `SignalGroup#memberCounts` ist `@internal`, aber `tsconfig.lib.json` setzt kein `stripInternal`; der Getter steht damit in `lib/SignalGroup.d.ts`. Gleiche Mechanik wie bei `Effect#onDestroy` — ein bekannter Nebenbefund des Vorlaufs, kein neuer Sachverhalt.
- Die CHANGELOG-Zeilen tragen keine Finding-IDs: `(MEM-001)`/`(MEM-002)` stehen im selben `## Unreleased`-Block bereits aus dem vorigen Audit mit anderer Bedeutung (`CHANGELOG.md:15,23,34-37`). Der Bezug läuft über den Commit-Titel.
- Coverage 97,03 → 96,36 Statements: die neuen `catch`-Zweige (werfendes `link.destroy()`, werfendes `childGroup.clear()`, werfender `OFF`-Listener) haben keinen Test. Kein Gate schlägt an.

Zugewiesen in Zug 0 von Paket 8 (2026-08-07): die beiden Punkte, die bis dahin nirgends standen, gehen ins **nächste Audit** — `SignalGroup#memberCounts` in `lib/*.d.ts` trotz `@internal` (eine `stripInternal`-Frage an `tsconfig.lib.json`, die mit `Effect#onDestroy` mindestens eine zweite Stelle betrifft und zusammen bewertet gehört) und die Coverage-Delle der ungetesteten `catch`-Zweige (kein Gate schlägt an; Paket 8 deckt mit seinen zwei Tests einen weiteren solchen Zweig ab, ohne dass daraus ein Test-Paket würde). Die beiden übrigen Punkte des Blocks sind Feststellungen ohne Handlungsbedarf.

#### Nebenbefunde (Eingabestapel für Zug 0 des nächsten Pakets)
- **`docs/api.md:412-424`** — beschreibt weder das neue Fehlerverhalten von `clear()`/`off()` (gesammelt, `AggregateError` in Teardown-Reihenfolge) noch die benutzersichtbare Folge des Destroy-Hooks: ein hart zerstörtes, namensgebundenes Signal verliert seinen Namen, `hasSignal(name)`/`signal(name)` liefern danach `undefined` statt des toten Signals. Für `Effect.destroy()` gibt es den Absatz bereits (`docs/api.md:141-152`). Kandidat für Paket 7.
- **`src/SignalGroup.ts:186-192`** — die statische `SignalGroup.clear()` hat dasselbe Problem wie MEM-001 eine Ebene höher: die Schleife über `[...allGroups]` sammelt keine Fehler, `allGroups.clear()` läuft bei einem Wurf nie. Nicht Teil von MEM-001.
- **`src/SignalLink.ts:344-354`** — baut die Einzelfehler-oder-`AggregateError`-Logik weiter von Hand, statt `collect-errors.ts` zu nutzen.
- **`src/SignalLink.ts:117-122`** — trägt dieselbe falsche Begründung zur eventize-Deduplizierung, die in `SignalGroup.ts` korrigiert wurde.
- **Vorbestehend, nicht vom Lauf verursacht:** `npx tsc --noEmit -p tsconfig.json` meldet 6 Fehler, alle in `node_modules` (`unplugin`/`webpack`-Typen). Kein Script fährt diese Config, daher fällt es in CI nicht auf.

Abgearbeitet in Zug 0 von Paket 2 (2026-08-06): `docs/api.md:412-424` → Paket 7. Beide `SignalLink.ts`-Befunde → Paket 5. Statisches `SignalGroup.clear()` → neues Paket 8. Der tsc-Befund → ab Paket 2 steht `pnpm world` statt `npx tsc -p tsconfig.json` in den Verify-Zeilen; nichts mehr offen aus diesem Stapel.

### [x] 2. EffectImpl: Guards gegen Zombie-Subscriptions
- Findings: MEM-003 (medium), MEM-006 (medium) — beide behoben, Review abgenommen
- Hash: `469e7d1` · Verify vom Orchestrator: `pnpm world` ✓ 360 passed / 7 skipped, `pnpm test:gc` ✓ 367 passed. Zwei Review-Runden nötig, beide an den Tests, nicht am Produktivcode.

#### Ergebnisse und Befunde
- Die als »zustandsäquivalent« geplante zweite Bedingungsänderung im Hart-Zweig ist es **nicht**: wird ein Signal innerhalb des Callbacks nach dem Read zerstört, bleibt es ohne Marker und ohne Abo in `#signals` stehen, und die alte Bedingung `1 === 2` verhinderte den Teardown. Der Fix behebt damit einen zweiten Zombie-Pfad, für den jetzt ein eigener Regressionstest existiert (`src/EffectImpl.destroy.spec.ts`).
- Klein, nicht behoben: der Titel dieses Tests hat beim Umzug sein Subjekt verloren — im Reporter liest er sich als »… > is destroyed once its last live dependency dies«. Ein »an effect« am Anfang stellt die Reihe der Nachbartests wieder her.

#### Nebenbefunde (Eingabestapel für Zug 0 des nächsten Pakets)
- **`src/EffectImpl.ts:690-698`** — vorbestehend: zerstört sich ein Effect mitten im Callback, läuft `run()` bis zum Ende durch und `storeCleanupCallback()` legt die zurückgegebene Cleanup auf der Leiche ab; `destroy()` hat `runCleanupCallback()` längst hinter sich, die Cleanup läuft nie. Gemessen: `acquired 2 / released 1`. **Paket 3 fasst denselben Pfad an — gehört dort in den Abgleich.**
- **`CLAUDE.md:45`** — dokumentiert `getSubscriptionCount(queue, event?)`; die Funktion kommt aus `@spearwolf/eventize` und nimmt nur ein Argument (`node_modules/@spearwolf/eventize/lib/index.d.ts:708`). Für die Pro-Signal-Sicht gibt es `getSubscribedEventNames(queue)`. Die Zeile führt in die Irre, liegt aber außerhalb des Scopes dieses Laufs.
- Ziel: Ein Effect legt nach seiner Zerstörung keine Subscriptions mehr an, und die Soft-Detach-Abbruchbedingung liest das ehrliche Register statt `#signals.size`.
- Bereich: `src/EffectImpl.ts` (eine Datei — `src/createEffect.ts` aus dem Grobplan existiert nicht; `createEffect()` ist die statische Methode `EffectImpl.createEffect`, `src/effects.ts` re-exportiert sie nur)
- Hängt ab von: —
- Modell: mittlere Stufe
- Hash: —
- Dateien: `src/EffectImpl.ts`, `src/EffectImpl.destroy.spec.ts`, `src/SignalGroup.off.spec.ts`, `docs/recipes.md`, `CHANGELOG.md`
- Verify: `pnpm world` (= CI: clean + biome check + tsc + rollup + vitest) und zusätzlich `pnpm test:gc`. **Nicht** `npx tsc --noEmit -p tsconfig.json`: diese Config meldet 6 vorbestehende Fehler in `node_modules` (`unplugin`/`webpack`-Typen), kein Script fährt sie. Während der Arbeit: `pnpm test -- EffectImpl.destroy.spec.ts` und `pnpm test -- SignalGroup.off.spec.ts`.
- Commit: `fix(effect): stop tracking after destroy, fix untriggerable check (MEM-003, MEM-006)`
- Abgleich (2026-08-06, Zug 0): **MEM-003 verändert — nur die Zeilennummern, der Sachverhalt steht.** Die Audit-Location `src/EffectImpl.ts:532-545 · 347-351` zeigt nach Paket 1 auf `whenSignalIsRead()` bei `src/EffectImpl.ts:516-529` (erste Anweisung ist `if (this.#suppressAutoTracking) return;`, kein `#destroyed`-Guard) und `saveSignalsFromDeps()` bei `src/EffectImpl.ts:331-335`, gerufen ungeschützt aus `EffectImpl.createEffect()` bei `src/EffectImpl.ts:385-389`. Gegenprobe gegen den `lib/`-Build von `924c687`: ein Effect, der sich mitten im eigenen Callback zerstört und danach ein weiteres Signal liest, hinterlässt `signalQ=1 destroyQ=1` bei `effects=0` (erwartet 0/0). Ein Effect mit statischen Deps, den ein `onCreateEffect`-Handler zerstört, hinterlässt ebenfalls +1/+1. **MEM-006 unverändert** — `src/EffectImpl.ts:544` `if (this.#signals.size === 0)` im Detach-Zweig, `src/EffectImpl.ts:556` `if (this.#destroyedSignals.size === this.#signals.size)` im Hart-Zweig, `hasNoLiveSignals()` bei `src/EffectImpl.ts:600-602` unbenutzt in beiden Zweigen (benutzt nur in `run()`, `src/EffectImpl.ts:473`). Gegenprobe: hart-dann-weich (`destroySignal(a)`, dann `group.off()`) hinterlässt `effects=1 effectQ=1` bei null lebenden Subscriptions — der Zombie aus der Evidenz. Paket 1 hat den Soft-Detach in `SignalGroup.off()` (`src/SignalGroup.ts:704-713`) um ein `if (!si.destroyed)` ergänzt; das ändert am Befund nichts, weil das tote Signal in `#signals` des *Effects* stehen bleibt, nicht in dem der Gruppe.

- Vorgehen:
  1. **Zuerst die roten Tests, MEM-003, in `src/EffectImpl.destroy.spec.ts`.** Die Datei hat bereits die Imports (`getSubscriptionCount`, die drei globalen Queues, `createSignal`, `createEffect`, `destroySignal`, `getEffectsCount`); `onCreateEffect` kommt aus `./effects.js` dazu. Zwei Tests am Ende des äußeren `describe`-Blocks, vor dem verschachtelten `describe('Effect#onDestroy() (internal)')`:
     ```ts
     it('an effect that destroys itself mid-callback stops tracking (MEM-003)', () => {
       const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
       const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

       const {get: a} = createSignal(1);
       const {get: b, set: setB} = createSignal(2);

       let runs = 0;
       let effect: Effect;

       // autorun:false, damit `effect` beim Lauf des Callbacks schon zugewiesen ist.
       effect = createEffect(
         () => {
           a();
           ++runs;
           effect.destroy();
           // Der Rest des Callbacks läuft weiter — der tote Effect steht
           // immer noch auf dem globalen Effect-Stack.
           b();
         },
         {autorun: false},
       );

       effect.run();

       expect(runs).toBe(1);
       expect(getEffectsCount()).toBe(0);

       // Kein Abo, das niemand mehr abbestellen kann.
       expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
       expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
         destroySubscriptions,
       );

       setB(3);
       expect(runs).toBe(1);

       destroySignal(a, b);
     });
     ```
     `Effect` per `import type {Effect} from './Effect.js';` ergänzen. Vor dem Fix ist der Test rot: beide Zähler stehen auf `baseline + 1` (gemessen 0 → 1 / 0 → 1). Der zweite Test deckt den Aufrufpfad ab, den der `whenSignalIsRead()`-Guard allein nicht sichtbar macht:
     ```ts
     it('an effect destroyed while it is being created never saves its static deps (MEM-003)', () => {
       const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
       const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

       const {get: c} = createSignal(3);

       let runs = 0;

       const unsubscribe = onCreateEffect((impl: EffectImpl) => {
         impl.destroy();
       });
       createEffect(() => {
         ++runs;
         c();
       }, [c]);
       unsubscribe();

       expect(runs).toBe(0);
       expect(getEffectsCount()).toBe(0);
       expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
       expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
         destroySubscriptions,
       );

       destroySignal(c);
     });
     ```
     Auch hier vor dem Fix `baseline + 1` auf beiden Queues. Das `unsubscribe()` muss laufen, bevor irgendein anderer Test einen Effect anlegt — sonst zerstört der Handler fremde Effects; deshalb steht es direkt hinter dem `createEffect()`-Aufruf und nicht in einem `afterEach`.
  2. **Dann der rote Test für MEM-006, in `src/SignalGroup.off.spec.ts`**, direkt hinter `it('external effect with only group signal as dep is destroyed by off()')` (Zeile 165-189), dessen Aufbau er variiert:
     ```ts
     it('external effect is destroyed by off() even after one dep was destroyed first (MEM-006)', () => {
       const host = {};
       const group = SignalGroup.findOrCreate(host);
       const a = createSignal(0, {attach: host});
       const b = createSignal(0, {attach: host});

       let runs = 0;
       let cleanupCalls = 0;

       // Nicht an die Gruppe attached — der Effect hängt nur über seine
       // Signal-Reads an ihr.
       createEffect(() => {
         runs += 1;
         a.get();
         b.get();
         return () => {
           cleanupCalls += 1;
         };
       });

       expect(runs).toBe(1);

       // Harte Zerstörung zuerst: der Effect behält `a` in #signals, nur
       // unsubscribed. Danach der Soft-Detach über off().
       a.destroy();
       group.off();

       expect(cleanupCalls).toBe(1);
       assertEffectsCount(0, 'after hard destroy then off()');

       group.clear();
     });
     ```
     Vor dem Fix rot: `cleanupCalls` bleibt `0`, `assertEffectsCount(0)` sieht `1`, und zusätzlich schlägt das `afterEach` der Datei an, weil der Zombie den globalen Effect-Zähler nicht freigibt. Zur Kontrolle bleibt der bestehende Nachbartest (weich-dann-hart) grün — er lief schon vorher.
  3. **`whenSignalIsRead()` (MEM-003).** In `src/EffectImpl.ts:516` als allererste Anweisung, vor dem `#suppressAutoTracking`-Guard:
     ```ts
     whenSignalIsRead(signalId: symbol): void {
       if (this.#destroyed) return;
       if (this.#suppressAutoTracking) return;
       // … unverändert
     ```
     Der Rest der Methode bleibt Zeichen für Zeichen stehen. Begründung als Kommentar über dem Guard: `destroy()` hat seine `off()`-Aufrufe schon hinter sich und die Unsubscribe-Handles verworfen, ein danach angelegtes Abo wäre unentfernbar.
  4. **Aufrufstelle `saveSignalsFromDeps()` (MEM-003).** In `EffectImpl.createEffect()` (`src/EffectImpl.ts:385-389`) den statischen Zweig absichern — der `emit(globalEffectQueue, $createEffect, effect)` eine Zeile darüber führt in Anwendungscode, der den frisch gebauten Effect zerstören darf:
     ```ts
     if (effect.hasStaticDeps()) {
       if (!effect.destroyed) {
         effect.saveSignalsFromDeps();
       }
     } else if (effect.autorun) {
       effect.run();
     }
     ```
     `hasStaticDeps()` und `saveSignalsFromDeps()` sind `private`, der Zugriff aus der statischen Methode derselben Klasse ist erlaubt und heute schon so geschrieben. Der `run()`-Zweig braucht nichts: `run()` prüft `#destroyed` bereits selbst (`src/EffectImpl.ts:408`). Der Guard ist nach Schritt 3 fachlich redundant — er bleibt trotzdem drin, weil er die Schleife samt `signalImpl()`-Auflösung auf einer toten Instanz spart und weil die Audit-Empfehlung genau diese zwei Stellen benennt.
  5. **`[$destroySignal]` (MEM-006).** Beide Abbruchbedingungen im Handler auf das ehrliche Register umstellen:
     - `src/EffectImpl.ts:544`: `if (this.#signals.size === 0)` → `if (this.hasNoLiveSignals())`
     - `src/EffectImpl.ts:556`: `if (this.#destroyedSignals.size === this.#signals.size)` → `if (this.hasNoLiveSignals())`

     Sonst ändert sich im Handler nichts: `#destroyedSignals` bleibt als Marker-Set erhalten, der Idempotenz-Guard `if (!this.#destroyedSignals.has(signalId))` und der Frühausstieg `if (!this.#signals.has(signalId)) return;` bleiben unverändert. Damit benutzen alle drei Stellen, die über »kann mich noch irgendwas wecken?« entscheiden, dieselbe Quelle wie `run()` (`src/EffectImpl.ts:473`).
     Zur zweiten Zeile, ohne Beschönigung: sie ist in jedem erreichbaren Zustand äquivalent zur alten Bedingung, denn `#signalSubscriptions` ist genau `#signals ∖ #destroyedSignals` — ein hart zerstörtes Signal wird nicht mehr gelesen (`createSignalReader` ruft `readSignal()` nur bei `!signal.destroyed`, `src/createSignal.ts:52-54`), landet deshalb im nächsten Lauf in `#lostSignals` und wird von `cleanupLostSignals()` aus `#signals` entfernt, bevor `#destroyedSignals.clear()` den Marker vergisst. Es gibt also **keinen** Test, der diese eine Zeile rot bekommt; sie wird aus Symmetrie geändert, wie die Audit-Empfehlung es verlangt. Keinen Alibi-Test dafür erfinden — die Absicherung ist, dass die volle Suite grün bleibt.
  6. **JSDoc.** Der Block über `hasNoLiveSignals()` (`src/EffectImpl.ts:589-599`) erklärt bisher nur, warum `run()` dieses Register liest. Einen Satz ergänzen, dass `[$destroySignal]` es in beiden Zweigen ebenfalls liest, und warum das die Korrektheit von der Teardown-Reihenfolge löst: ein hart zerstörtes Signal bleibt in `#signals` stehen, ein danach kommender Soft-Detach sähe die Menge nie leer. Bei `whenSignalIsRead()` reicht der Kommentar aus Schritt 3, ein eigener JSDoc-Block ist dort nicht nötig.
  7. **Doku.** `docs/recipes.md:411-414` beschreibt die `off()`-Zusage »An external effect whose only dependency was a group signal is destroyed automatically«. Den Satz so schärfen, dass er auf die noch lebenden Abhängigkeiten abstellt und die Reihenfolge ausdrücklich einschließt — etwa: der externe Effect wird zerstört, sobald keine lebende Abhängigkeit mehr übrig ist, unabhängig davon, ob andere Signale vorher hart zerstört wurden. `docs/api.md:421` (die `off()`-Zeile der Tabelle) bleibt unangetastet, sie ist auf dieser Flughöhe korrekt. `CHANGELOG.md` unter `## Unreleased` → `### Bug Fixes`: eine Zeile, dass ein Effect nach seiner Zerstörung keine Signal-Abos mehr anlegt, und eine Zeile, dass ein unauslösbar gewordener Effect sich unabhängig von der Teardown-Reihenfolge selbst zerstört. Keine Finding-IDs in den Changelog-Zeilen — `(MEM-003)`/`(MEM-006)` stehen im selben `## Unreleased`-Block schon aus dem vorigen Audit mit anderer Bedeutung (`CHANGELOG.md`, vgl. Review-Befund zu Paket 1); der Bezug läuft über den Commit-Titel. Released-Abschnitte bleiben unberührt.
  8. **Abschluss.** `pnpm world` und `pnpm test:gc` müssen grün sein. In den Report gehören: die roten Läufe aus Schritt 1 und 2 im Wortlaut (Zahlen, nicht »schlug fehl«), die Testzahl vor/nach (Baseline Paket 1: 356 passed / 7 skipped bei `vitest run`, 363 bei `test:gc`) und die Aussage, ob die drei neuen Tests die einzige Änderung an der Testbilanz sind.

**MEM-003 · medium · src/EffectImpl.ts:532-545 · src/EffectImpl.ts:347-351** — `whenSignalIsRead()` und `saveSignalsFromDeps()` brauchen einen `#destroyed`-Guard

`run()` und `destroy()` prüfen `#destroyed`, `whenSignalIsRead()` nicht. Zerstört sich ein Effect mitten im eigenen Callback, laufen die restlichen Signal-Reads weiter durch `getCurrentEffect()` in den bereits toten Effect und legen frische Subscriptions auf `globalSignalQueue` und `globalDestroySignalQueue` an — nachdem `destroy()`s `off()`-Aufrufe längst durch sind. Diese Subscriptions sind unentfernbar: `destroy()` kehrt sofort zurück, die Unsubscribe-Handles sind verloren. Der `EffectImpl` bleibt samt Closure für immer von den globalen Queues aus erreichbar.

Empfehlung: `if (this.#destroyed) return;` an den Anfang von `whenSignalIsRead()`; `saveSignalsFromDeps()` in `createEffect()` nur aufrufen, wenn `!effect.destroyed`.

Belegt mit: `after 1st autorun  : signalQ=2 destroyQ=2 effects=1` → `after self-destroy : signalQ=1 destroyQ=1 effects=0` (erwartet 0/0/0).

**MEM-006 · medium · src/EffectImpl.ts:560** — Soft-Detach-Abbruchbedingung auf `#signalSubscriptions` umstellen

Der Detach-Zweig von `[$destroySignal]` prüft `this.#signals.size === 0`. Hart zerstörte Signale bleiben aber in `#signals` stehen — der Nicht-Detach-Zweig entfernt sie nicht, er markiert sie nur. Ein Effect, der erst eine harte Signal-Zerstörung und danach ein `group.off()` erlebt, hat am Ende null lebende Subscriptions, aber `#signals.size === 1`; `destroyWhenUntriggerable()` läuft nie. Der Effect bleibt unauslösbar am Leben, dauerhaft auf `globalEffectQueue` gepinnt. In umgekehrter Reihenfolge räumt derselbe Code sauber auf — die Korrektheit hängt an der Teardown-Reihenfolge. Die Klasse hat mit `hasNoLiveSignals()` bereits das ehrliche Register, benutzt es an dieser Stelle aber nicht.

Empfehlung: Die Bedingung auf `this.hasNoLiveSignals()` umstellen, und aus Symmetriegründen auch die zweite Stelle im selben Handler.

Belegt mit: `soft-then-hard: effects=0 signalQ=0 effectQ=0 destroyQ=0` gegen `hard-then-soft: effects=1 signalQ=0 effectQ=1 destroyQ=0   <-- Zombie`.

Abgearbeitet in Zug 0 von Paket 3 (2026-08-06): der synchrone Zwilling aus `src/EffectImpl.ts:690-698` → in Paket 3 aufgenommen (dieselbe Methode, dieselbe Ursache; Begründung dort unter `Mitgenommen`). `CLAUDE.md:45` → Paket 7 (Doku-Paket, läuft zuletzt). Der verlorene Testtitel aus »Ergebnisse und Befunde« (`src/EffectImpl.destroy.spec.ts:444`) → Paket 3, das ohnehin zwei Zeilen darüber einen Test einfügt. Nichts mehr offen aus diesem Stapel.

### [x] 3. Veralteten async-Cleanup ausführen
- Findings: MEM-004 (medium) — behoben, samt mitgenommenem synchronem Zwilling; Review abgenommen
- Hash: `777b5f2` · Verify vom Orchestrator: `pnpm world` ✓ 362 passed / 7 skipped, `pnpm test:gc` ✓ 369 passed. Keine Nachbesserungsrunde nötig.

#### Vom Review bestätigt (Sonden gegen den gebauten Stand)
- 200 aufeinanderfolgende Supersessions geben 199 Ressourcen frei, genau eine bleibt offen (der aktuelle Run), keine Doppelfreigabe; nach `destroy()` null offen. Der synchrone Zwilling: `acquired 2 / released 2` (vorher 2/1).
- Rejection und synchroner Wurf eines verwaisten Cleanups gehen beide über `emitEffectError`, keine unhandled rejection auf irgendeinem geprüften Pfad.
- Vier Alt-Tests wurden umgedreht (drei geplant, einer in `src/effects.spec.ts:55` nachgezogen); alle behalten ihre ursprünglichen Assertionen und verlieren keine Aussage.

#### Kleine Review-Befunde → gehen an Paket 7 (Doku-Paket)
- **`CHANGELOG.md:75`** — die umgeschriebene Breaking-Changes-Zeile behauptet über den v0.31.1-Stand, ein neuerer Run habe die noch offene Cleanup eines älteren still überschrieben. Falsch: das alte `runCleanupCallback()` zog das gespeicherte Promise zu Beginn jedes `run()` und in `destroy()` heraus, der sequenzielle Pfad verlor nichts. Der einzige Überschreib-Fall war Re-Entrancy, und dort überschreibt der ältere äußere Run den neueren inneren. Die Formulierung stammt aus dem Plan, nicht vom Implementierer — steht aber in den Release-Notes.
- **`docs/api.md:180-183`** — »Only failures that surface *after* the synchronous call stack is gone arrive here« und die `phase`-Zeile »Which of the two async callbacks rejected« sind durch den Fix falsch: der synchrone Wurf eines verwaisten Cleanups landet aus `run()` heraus bei `onEffectError`, bei voll vorhandenem Stack. Die neu eingefügte Ausnahme begründet es mit »has no such caller left to throw at«, was für den Zwilling nicht zutrifft.
- **`src/effects.spec.ts:69-70`** — der Kommentar trägt die zurückgenommene Zusage weiter (»only as long as that run is still the current one«), zwölf Zeilen über der Stelle, die sie korrigiert.
- **`src/EffectImpl.ts:677-678`** — der neue JSDoc-Satz ist zur Hälfte tautologisch und sagt, `destroy()` räume hinter dem Cleanup auf, statt ihn auszuführen.
- **`src/effects.async.spec.ts:376-379`** — Schlusskommentar grammatisch entgleist und sachlich schief.
- Testlücke: der Thenable-Zweig in `runOrphanedCleanupCallback()` (`src/EffectImpl.ts:769-773`) hat keinen Test; vom Reviewer per Sonde als funktionierend bestätigt (`phases=['cleanup']`, `unhandled=0`).
- Ziel: Der Cleanup eines überholten oder zerstörten Runs gibt seine Ressource frei, statt weggeworfen zu werden.
- Bereich: `src/EffectImpl.ts`
- Hängt ab von: Paket 2 (derselbe Teardown-Pfad, sonst kollidieren die Diffs)
- Modell: mittlere Stufe (final; die Architekturfrage ist unter »Entscheidungen« erledigt, der Code unten steht wörtlich da, und die heikelste Arbeit — die Erwartungswerte der invertierten Tests — ist ausgemessen und eingetragen)
- Hash: —
- Mitgenommen (Nebenbefund aus Paket 2, 2026-08-06): der **synchrone Zwilling** von MEM-004 aus `src/EffectImpl.ts:690-698`. Begründung für die Aufnahme: dieselbe Methode, dieselbe Ursache (ein Cleanup, dessen Run niemand mehr besitzt, wird abgelegt statt ausgeführt), derselbe JSDoc-Block, der ohnehin neu geschrieben wird. Getrennt einzuplanen hieße, denselben Zwölfzeiler zweimal anzufassen und den frisch geschriebenen JSDoc gleich wieder zu korrigieren. Kein Audit-Finding, Schwere unterhalb von high — fällt damit unter die Entscheidungen, die dieses Paket selbst trifft.
- Dateien: `src/EffectImpl.ts`, `src/effects.async.spec.ts`, `src/EffectImpl.destroy.spec.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/SKILL.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Verify: `pnpm world` (= CI: clean + biome check + tsc + rollup + vitest) und zusätzlich `pnpm test:gc`. **Nicht** `npx tsc --noEmit -p tsconfig.json`: diese Config meldet 6 vorbestehende Fehler in `node_modules` (`unplugin`/`webpack`-Typen), kein Script fährt sie. Während der Arbeit: `pnpm test -- effects.async.spec.ts`, `pnpm test -- EffectImpl.destroy.spec.ts`, `pnpm test -- effects.cleanup.spec.ts`.
- Commit: `fix(effect): run the cleanup of a superseded or destroyed run (MEM-004)`
- Abgleich (2026-08-06, Zug 0): **MEM-004 unverändert — nur die Zeilennummern sind gewandert.** Die Audit-Location `src/EffectImpl.ts:704-715` zeigte auf den `Promise.resolve(result).then(…)`-Block; nach Paket 1 und 2 steht derselbe Block Zeichen für Zeichen bei `src/EffectImpl.ts:700-711` (−4 Zeilen), die Verwerfungszeile `if (this.#destroyed || generation !== this.#generation) return;` bei `src/EffectImpl.ts:702`. Der begründende JSDoc steht bei `src/EffectImpl.ts:664-689`, die Methode bei `690-711`. Paket 2 hat `EffectImpl.ts` angefasst, aber nur `whenSignalIsRead()` (`518`), die `createEffect()`-Aufrufstelle (`~385`) und den `[$destroySignal]`-Handler — `storeCleanupCallback()` ist unberührt. Gegenprobe gegen den `lib/`-Build von `469e7d1`, drei Sonden:
  - überholte Runs (Evidenz A): `setA(1); setA(2)` auf einem `async`-Callback → nach dem Flush `["run:0","run:1","run:2"]`, nach `destroy()` `[…,"cleanup:2"]`. `cleanup:0` und `cleanup:1` fallen weg.
  - `destroy()` vor dem Settle (Evidenz B): `["run:0"]`, kein `cleanup:0`.
  - synchroner Zwilling: `acquired 2 / released 1` — exakt die Zahl aus dem Nebenbefund von Paket 2.
  Der Zwilling ist damit ebenfalls unverändert und wird hier mitbehoben (siehe `Mitgenommen`).

- Vorgehen:
  1. **Zuerst die roten Tests, async-Zweig, in `src/effects.async.spec.ts` → `describe('cleanup generations')`.** Drei der vier bestehenden Tests kodieren das alte Verhalten und werden umgedreht; die Zahlen unten sind gegen `469e7d1` gemessen, nicht geschätzt.
     - **Zeile 259**, `it('discards the cleanup of a run that was superseded before it settled')` → umbenennen in `it('runs the cleanup of a run that was superseded before it settled (MEM-004)')`. Der Testkörper bleibt bis `await flush();` unverändert, danach:
       ```ts
       // Die Cleanups der überholten Runs laufen, sobald ihr Promise
       // settelt — die Ressource dieses Runs gibt sonst niemand mehr frei.
       expect(log).toEqual([
         'run:0',
         'run:1',
         'run:2',
         'cleanup:0',
         'cleanup:1',
       ]);

       effect.destroy();

       // Der Cleanup des jüngsten Runs läuft weiterhin erst beim destroy().
       expect(log).toEqual([
         'run:0',
         'run:1',
         'run:2',
         'cleanup:0',
         'cleanup:1',
         'cleanup:2',
       ]);
       ```
       Vor dem Fix rot: nach dem Flush steht dort `['run:0','run:1','run:2']`. Die Reihenfolge `cleanup:0` vor `cleanup:1` ist deterministisch — die `.then`-Handler wurden in Run-Reihenfolge registriert und alle drei Promises sind bereits beim Erzeugen resolved.
     - **Zeile 362**, `it('discards a cleanup that settles after the effect was destroyed')` → `it('runs a cleanup that settles after the effect was destroyed (MEM-004)')`. Nach dem `await flush();`:
       ```ts
       expect(log).toEqual(['run:0', 'cleanup:0']);
       expect(unhandled).toEqual([]);
       ```
       Vor dem Fix rot: `['run:0']`.
     - **Zeile 320**, `it('keeps the cleanup of the outer run when a cleanup re-enters the effect')` — bleibt vom Namen her stehen, bekommt aber die Zwischenerwartung, die ihn ebenfalls rot macht. Nach `await flush();` und vor `effect.destroy();` einfügen:
       ```ts
       // Der innere Run 2 wurde vom äußeren Run 3 überholt: sein Cleanup
       // läuft jetzt beim Settle, statt verworfen zu werden.
       expect(log).toEqual([
         'run:1:0',
         'cleanup:1',
         'run:2:99',
         'run:3:99',
         'cleanup:2',
       ]);
       ```
       Vor dem Fix rot: das `'cleanup:2'` fehlt. Die bestehende Schlussassertion `expect(log.at(-1)).toBe('cleanup:3')` bleibt unverändert und weiterhin grün — sie ist der Beweis, dass der Generationen-Vergleich nach wie vor den *richtigen* Cleanup als aktuell behält. Den Kommentarblock bei Zeile 351-354 anpassen: er begründet heute, warum der äußere Run seinen Cleanup nicht »wegwirft«; nach dem Fix wirft niemand mehr etwas weg, es geht nur noch darum, welcher Cleanup gespeichert und welcher sofort ausgeführt wird.
     - **Zeile 291**, `it('runs the cleanup of a settled run before the next run')` — unverändert, jeder Run ist beim Settle noch aktuell. Bleibt als Kontrolle grün.
  2. **Neuer Test für die Fehlerbehandlung des veralteten Cleanups**, ans Ende von `describe('cleanup generations')`. Er sichert die Zusage aus Schritt 4, dass ein verwaister Cleanup nie wirft:
     ```ts
     it('reports a throwing stale cleanup through onEffectError (MEM-004)', async () => {
       const errors: EffectErrorPayload[] = [];
       const unsubscribe = onEffectError((payload) => {
         errors.push(payload);
       });

       const {get: a, set: setA} = createSignal(0);

       const effect = createEffect(async () => {
         const value = a();
         return () => {
           if (value === 0) throw new Error(`boom:${value}`);
         };
       });

       try {
         setA(1);

         await flush();

         expect(errors).toHaveLength(1);
         expect(errors[0].phase).toBe('cleanup');
         expect((errors[0].error as Error).message).toBe('boom:0');
         expect(unhandled).toEqual([]);
       } finally {
         unsubscribe();
         effect.destroy();
         destroySignal(a);
       }
     });
     ```
     `onEffectError` und `EffectErrorPayload` sind in der Datei bereits importiert (Zeile 5 und 8). Vor dem Fix rot: `errors` bleibt leer, weil der Cleanup gar nicht erst läuft.
  3. **Dann der rote Test für den synchronen Zwilling**, in `src/EffectImpl.destroy.spec.ts`, direkt hinter `it('an effect destroyed while it is being created never saves its static deps (MEM-003)')` (Zeile 397 ff.) und vor dem Test zu MEM-006:
     ```ts
     it('a cleanup returned after a mid-callback self-destroy still runs (MEM-004)', () => {
       const {get: a, set: setA} = createSignal(0);

       let acquired = 0;
       let released = 0;
       let effect: Effect;

       effect = createEffect(() => {
         const value = a();
         acquired += 1;
         // Zweiter Lauf: der Effect zerstört sich mitten im Callback. run()
         // läuft trotzdem bis zum Ende durch und reicht den Cleanup an
         // storeCleanupCallback() weiter — destroy() hat sein
         // runCleanupCallback() da längst hinter sich.
         if (value === 1) effect.destroy();
         return () => {
           released += 1;
         };
       });

       setA(1);

       expect(acquired).toBe(2);
       expect(released).toBe(2);
       assertEffectsCount(0, 'after mid-callback self-destroy');

       destroySignal(a);
     });
     ```
     `Effect` (`import type {Effect} from './Effect.js';`) und `assertEffectsCount` sind in der Datei bereits importiert. Vor dem Fix rot: `released` ist `1` — der Cleanup des ersten Runs lief beim Start des zweiten, der des zweiten Runs verschwand auf der Leiche. Gemessen gegen `469e7d1`: `acquired 2 / released 1`.
     Bei der Gelegenheit, zwei Zeilen weiter unten (Nebenbefund aus Paket 2): der Titel von `it('is destroyed once its last live dependency dies, even when an earlier one was hard-destroyed mid-callback (MEM-006)')` bei `src/EffectImpl.destroy.spec.ts:444` hat beim Umzug sein Subjekt verloren. Ein `an effect ` am Titelanfang stellt die Reihe der Nachbartests wieder her. Sonst ändert sich an diesem Test nichts.
  4. **Neue private Hilfsmethode in `src/EffectImpl.ts`**, direkt unter `runCleanupCallback()` (heute `713-727`):
     ```ts
     /**
      * Run a cleanup whose run nobody owns anymore — the callback of a
      * superseded run settled late, or the effect was destroyed while its
      * callback was still on the stack.
      *
      * Unlike {@link runCleanupCallback} this never throws at its caller.
      * There is no caller worth throwing at: the frame is either a microtask
      * of a long-settled promise, or a `run()` whose effect is already gone.
      * A synchronous throw and a rejected async cleanup therefore take the
      * same route as every other error without a stack to land on —
      * {@link emitEffectError} with phase `cleanup`.
      */
     private runOrphanedCleanupCallback(cleanup: VoidFunc): void {
       try {
         const result = cleanup() as unknown;
         if (isThenable(result)) {
           Promise.resolve(result).catch((error) => {
             emitEffectError(this, error, 'cleanup');
           });
         }
       } catch (error) {
         emitEffectError(this, error, 'cleanup');
       }
     }
     ```
     `runCleanupCallback()` selbst bleibt **unverändert** und darf nicht auf die neue Methode umgestellt werden: dort muss ein synchroner Wurf weiterhin an den Aufrufer durchschlagen, denn `destroy()` sammelt ihn (`src/EffectImpl.ts:774-777`) und `run()` propagiert ihn. Die Duplizierung der drei Thenable-Zeilen ist der Preis für zwei verschiedene Fehlerverträge.
  5. **`storeCleanupCallback()` (MEM-004, beide Zweige).** Der neue Rumpf:
     ```ts
     private storeCleanupCallback(result: unknown, generation: number): void {
       if (!isThenable(result)) {
         // Same tolerance as the async branch below: a callback returning
         // something that is not a function has simply returned no cleanup.
         if (typeof result === 'function') {
           if (this.#destroyed) {
             this.runOrphanedCleanupCallback(result as VoidFunc);
           } else {
             this.#nextCleanupCallback = result as VoidFunc;
           }
         }
         return;
       }

       Promise.resolve(result).then(
         (cleanup) => {
           if (typeof cleanup !== 'function') return;
           if (this.#destroyed || generation !== this.#generation) {
             this.runOrphanedCleanupCallback(cleanup as VoidFunc);
             return;
           }
           this.#nextCleanupCallback = cleanup as VoidFunc;
         },
         (error) => {
           emitEffectError(this, error, 'callback');
         },
       );
     }
     ```
     Drei Dinge, die dabei bewusst *nicht* passieren: der `typeof`-Test steht im async-Zweig jetzt vorn, damit ein Nicht-Funktions-Ergebnis genau wie heute stillschweigend fällt (kein `runOrphanedCleanupCallback(undefined)`); der Rejection-Zweig behält die Phase `'callback'` — es ist der Callback, der abgelehnt hat, nicht ein Cleanup; und der synchrone Zweig prüft weiterhin **nur** `#destroyed`, nie die Generation. Der Re-Entrancy-Fall (ein Callback schreibt eine eigene Abhängigkeit, der innere Run wird vor dem äußeren fertig) bleibt damit exakt wie heute — er ist ein legitimes Fixpunkt-Muster, das der `#runDepth`-Guard ausdrücklich stützt, und ein sofort ausgeführter Cleanup des äußeren Runs würde dort synchrone Semantik ändern, die niemand beauftragt hat.
     Was ein verwaister Cleanup auslösen darf: Signal-Schreibvorgänge. Bei einem zerstörten Effect ist `run()` ein No-op, bei einem nur überholten läuft er wie bei jedem anderen Cleanup — kein Sonderfall, aber im JSDoc einen Halbsatz wert.
  6. **JSDoc über `storeCleanupCallback()` (`src/EffectImpl.ts:664-689`) vollständig ersetzen.** Der bestehende Block begründet die Verwerfung mit der »late-release half of a double-acquire bug« — diese Begründung ist falsch und darf nicht stehen bleiben. Neuer Text:
     ```ts
     /**
      * Take what the effect callback returned and remember it as the next
      * cleanup callback — or, if that cleanup arrived too late to be anyone's
      * *next* one, run it right away.
      *
      * A synchronous return value is stored as is. An `async` callback returns
      * a promise instead, and by the time it settles the world may have moved
      * on: the effect may have run again — acquiring fresh resources — or been
      * destroyed. Nothing is awaited either way: the library stays
      * synchronous, and the next run does not wait for a pending promise.
      *
      * **A stale cleanup is executed, not discarded.** It belongs to the run
      * that produced it, and it is the only thing that will ever release what
      * that run acquired: run N+1 cleans up after run N+1, `destroy()` cleans
      * up after the last stored cleanup. Dropping it — as this method used to
      * — turned every `createEffect(async () => { const c = await open();
      * return () => c.close(); })` into a leak on the ordinary unmount path,
      * where `destroy()` overtakes the first `await`. Running it late is not
      * a double-acquire: nobody else holds this run's resource.
      *
      * The same applies to the synchronous branch when the effect destroyed
      * itself in the middle of its own callback. `run()` carries on to the
      * end, but `destroy()` has already run its cleanup, so a value stored
      * here would sit on a dead instance and never be called.
      *
      * A cleanup run this way has no caller left to throw at, so it goes
      * through {@link runOrphanedCleanupCallback}: a synchronous throw and a
      * rejected async cleanup are both reported via {@link emitEffectError}
      * with phase `cleanup`. It may write signals like any other cleanup — on
      * a destroyed effect `run()` is a no-op, on a superseded one a further
      * run is triggered exactly as a regular cleanup would.
      *
      * A rejection of the *callback* promise is reported through
      * {@link emitEffectError} with phase `callback`, current run or not.
      *
      * **The synchronous branch still ignores `generation`.** There, stale
      * means re-entrancy: a callback writes a signal it depends on, the inner
      * run completes first, and the outer run then overwrites the inner
      * cleanup with its own, older one. That is how this library has always
      * behaved, and the `#runDepth` guard exists precisely because such
      * recursion is a legitimate (if bounded) fixpoint pattern here. Changing
      * it would change synchronous semantics for every self-writing effect —
      * a decision of its own, and not the resource leak this method was
      * fixed for.
      */
     ```
     Der JSDoc des Felds `#generation` (`src/EffectImpl.ts:212-217`) bleibt wörtlich stehen — er beschreibt nur, wie überholt von aktuell unterschieden wird, und das ändert sich nicht.
  7. **Doku, Prosa-Kette.** Überall gilt: die Zusage lautet jetzt »der Cleanup eines überholten oder zerstörten Runs läuft, sobald sein Promise settelt« — nicht mehr »er wird verworfen«. Die Warnung verschwindet nicht ersatzlos, sie wechselt das Thema: der Zeitpunkt bleibt unbestimmt (nichts wartet auf das Promise), und wer synchrone Freigabe braucht, nimmt weiterhin `AbortController` oder erwirbt vor dem ersten `await`.
     - `docs/recipes.md:139` — Überschrift `### \`async\` callbacks: the cleanup can be dropped` umbenennen, etwa in `### \`async\` callbacks: the cleanup runs late`. Der Absatz 141-145 und der `>`-Warnblock 152-160 werden neu geschrieben. **Der Anker wandert mit**: `docs/api.md:85` verlinkt heute `./recipes.md#async-callbacks-the-cleanup-can-be-dropped` — das ist der einzige Verweis darauf (repo-weit geprüft), er muss auf den neuen Slug zeigen.
     - `docs/api.md:78-85` — im `callback`-Absatz von `createEffect` die »**discarded**«-Zusage ersetzen; der zweite Caveat (Rejection → `onEffectError`) bleibt.
     - `docs/cheat-sheet.md:60` — `// async: cleanup of a superseded run is DISCARDED, rejections are reported` entsprechend umschreiben, eine Zeile, gleiche Länge.
     - `skills/using-signalize/SKILL.md:21` — der Spiegelstrich zu den »second-class citizens«: das `*discarded*` fällt, der Rest (nichts wird erwartet, Rejection über `onEffectError()`) bleibt.
     - `skills/using-signalize/references/pitfalls.md:33` — Pitfall **11a** neu fassen, Titel und Text. Die Nummer 11a bleibt, sie wird aus SKILL.md referenziert. Im Codebeispiel darunter den Kommentar `// ✗ may never run` korrigieren — er läuft jetzt, nur eben irgendwann; das `AbortController`-Gegenbeispiel bleibt der empfohlene Weg für alles, was synchron freigegeben werden muss.
     - `skills/using-signalize/references/api.md:127` — derselbe Satz wie in SKILL.md, ebenfalls umschreiben.
     - `README.md` und `docs/architecture.md` enthalten dazu nichts (geprüft) und bleiben unangetastet.
  8. **`CHANGELOG.md`.** Zwei Eingriffe, beide ausschließlich unter `## Unreleased`; jede `## v0.x.y`-Überschrift bleibt unberührt.
     - Die Zeile unter `### Breaking Changes` (heute `CHANGELOG.md:74`), die mit »The cleanup an `async` effect callback resolves to is discarded …« beginnt, beschreibt genau das Verhalten, das dieses Paket zurücknimmt. Sie steht unter `## Unreleased`, ist also noch nicht ausgeliefert und wird **umgeschrieben statt ergänzt** — zwei widersprüchliche Zeilen in denselben Release-Notes wären eine Falle für jeden Leser. Der neue Text muss die Netto-Änderung gegenüber `v0.31.1` benennen, und die ist nicht null: dort wurde das *Promise selbst* in `#nextCleanupCallback` abgelegt und erst beim nächsten Run bzw. beim `destroy()` aufgelöst, weshalb ein neuerer Run den noch ungenutzten Cleanup des älteren einfach überschrieb. Ab jetzt gilt: der Cleanup des aktuellen Runs wird gespeichert und geht nie verloren, der eines überholten oder zerstörten Runs läuft, sobald sein Promise settelt. Die `(ASYNC-002)`-Referenz am Zeilenende bleibt stehen.
     - Unter `### Bug Fixes` eine Zeile für den synchronen Zwilling: ein Effect, der sich mitten im eigenen Callback zerstört, verliert den von diesem Callback zurückgegebenen Cleanup nicht mehr. Keine Finding-ID in der Zeile — `(MEM-004)` steht im selben `## Unreleased`-Block bereits aus dem vorigen Audit mit anderer Bedeutung (`CHANGELOG.md:31` u. a., vgl. Review-Befund zu Paket 1); der Bezug läuft über den Commit-Titel.
  9. **Abschluss.** `pnpm world` und `pnpm test:gc` müssen grün sein. In den Report gehören: die roten Läufe aus Schritt 1 bis 3 im Wortlaut (die tatsächlich ausgegebenen Arrays und Zahlen, nicht »schlug fehl«), die Testbilanz vor/nach (Stand Paket 2: `pnpm world` 360 passed / 7 skipped, `pnpm test:gc` 367 passed), und ausdrücklich die Aussage, ob außer den umgedrehten Tests noch etwas an der Bilanz gewackelt hat — ein Test, der von der neuen Cleanup-Ausführung unbeabsichtigt profitiert oder stirbt, ist genau hier zu sehen.

**MEM-004 · medium · src/EffectImpl.ts:704-715** (nach Paket 1 und 2: `src/EffectImpl.ts:700-711`) — Abgelaufenen Async-Cleanup ausführen statt verwerfen

Settelt das Promise eines `async`-Callbacks, nachdem der Effect zerstört wurde oder ein neuerer Run gestartet ist, wird der zurückgegebene Cleanup kommentarlos weggeworfen. Der JSDoc begründet das mit der Late-Release-Hälfte eines Double-Acquire-Bugs — tatsächlich ist die späte Freigabe hier das Richtige: die Ressource dieses Runs wurde belegt, und niemand sonst gibt sie je frei. `createEffect(async () => { const c = await open(); return () => c.close(); })` leakt damit die Verbindung bei jedem `destroy()`, das das erste `await` überholt — der Normalfall bei Unmount-artigen Teardowns.

Empfehlung: Im veralteten Fall den Cleanup nicht speichern, sondern sofort ausführen, mit derselben `emitEffectError`-Behandlung für eine Rejection.

Belegt mit: `A) still-open resources after 4 runs: [1, 4]      (expected [4])` · `B) resources still open after destroy(): [100]   (expected [])`

Abgearbeitet in Zug 0 von Paket 4 (2026-08-06): die fünf Prosa-Befunde aus »Kleine Review-Befunde« (`CHANGELOG.md:75`, `docs/api.md:180-183`, `src/effects.spec.ts:69-70`, `src/EffectImpl.ts:677-678`, `src/effects.async.spec.ts:376-379`) sind jetzt namentlich in Paket 7 eingetragen — sie standen bisher nur hier als »gehen an Paket 7«, ohne Gegenstück im Zielpaket. Die Testlücke im Thenable-Zweig von `runOrphanedCleanupCallback()` (`src/EffectImpl.ts:769-773`) → **nächstes Audit**: kein offenes Paket fasst `EffectImpl` noch einmal an, der Zweig ist vom Reviewer per Sonde als funktionierend belegt (`phases=['cleanup']`, `unhandled=0`), und ein Test dafür in ein Memo- oder Link-Paket zu hängen hieße, eine fremde Datei nur für Coverage aufzumachen. Nichts mehr offen aus diesem Stapel.

### [x] 4. createMemo: Lebenszeit-Hook auf beide Zweige
- Findings: MEM-005 (medium), MEM-008 (low) — beide behoben, Review abgenommen
- Hash: `5f60bee` · Verify vom Orchestrator: `pnpm world` ✓ 365 passed / 7 skipped, `pnpm test:gc` ✓ 372 passed. Eine Review-Runde nötig, ausschließlich Doku.

#### Vom Review bestätigt (Sonden gegen den gebauten Stand)
- Die Destroy-Queue-Subscription wird in beiden Richtungen abgemeldet und nie doppelt: 50 Memos mit `{attach}`, Signal zuerst zerstört → `destroyQ 0, effects 0`; Effect zuerst über 10 Reruns → `destroyQ +4` konstant.
- Der Rebind-Mechanismus der benannten Variante bleibt intakt, ein von außen umgebundener Fremdname wird nicht mitgerissen, und `createMemo({attach})` außerhalb jedes Effects ist sauber ausgespart.
- Die Umstellung der Assertion auf `toBe(effectsBefore)` spült nichts weich: die beweisende Zeile ist die Destroy-Queue-Assertion, und die geht ohne Fix rot (`expected 32 to be 31` bzw. `expected 82 to be 32`).

#### Nebenbefunde (Eingabestapel für Zug 0 des nächsten Pakets)
- **`docs/quickstart.md:60`, `README.md:259`, `docs/cheat-sheet.md:184`, `skills/using-signalize/references/patterns.md:58`** — alle vier zeigen das Klassenfeld-Muster `class Foo { m = createMemo(…, {attach: this, name: 'm'}) }` ohne Vorbehalt. Entsteht das Objekt innerhalb eines Effect-Rumpfs, ist der Konstruktorlauf sehr wohl ein Effect-Rumpf: gemessen behielt die Gruppe des alten `foo` vor dem Fix ihr Signal (`signals 1`), danach ist sie beim Parent-Rerun leer. Kein Fehler im Code — die Konsequenz folgt aus der Folgeentscheidung zu MEM-008 —, aber die Annahme, die das Nicht-Anfassen dieser Stellen rechtfertigte, trägt nicht. **Kandidat für Paket 7.**
- **`src/createMemo.spec.ts:13` und `:50`** — zwei Alt-Tests zerstören ihre Memos nie und hinterlassen 2 Effects im modulglobalen Zähler. Testhygiene aus einer früheren Runde, kein Befund an diesem Paket.
- Ziel: Der interne Effect meldet seine Destroy-Queue-Subscription wieder ab, und ein unbenanntes `{attach}`-Memo sammelt sich nicht pro Parent-Rerun in der Gruppe an.
- Bereich: `src/createMemo.ts`, Doku-Kette zur Memo-Lebenszeit
- Hängt ab von: —
- Modell: mittlere Stufe (final; der Code steht unten wörtlich, alle Erwartungswerte sind gegen `777b5f2` ausgemessen)
- Hash: —
- Dateien: `src/createMemo.ts`, `src/createMemo.spec.ts`, `docs/recipes.md`, `docs/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Verify: `pnpm world` (= CI: clean + biome check + tsc + rollup + vitest) und zusätzlich `pnpm test:gc`. **Nicht** `npx tsc --noEmit -p tsconfig.json`: diese Config meldet 6 vorbestehende Fehler in `node_modules` (`unplugin`/`webpack`-Typen), kein Script fährt sie. Während der Arbeit: `pnpm test -- createMemo.spec.ts` und `pnpm test -- SignalGroup.spec.ts` — filtert das Muster nicht (bekannte Eigenheit des Scripts, es endet auf `vitest run --coverage`), dann `npx vitest run createMemo.spec.ts`.
- Commit: `fix(memo): release the destroy-queue subscription, bind attached memos to their creating effect (MEM-005, MEM-008)`
- Abgleich (2026-08-06, Zug 0): **beide Findings unverändert, beide Fundstellen sogar zeilengenau.** `src/createMemo.ts` hat seit dem Audit keinen Commit gesehen (`924c687`, `469e7d1`, `777b5f2` fassen `SignalGroup.ts`, `EffectImpl.ts`, `collect-errors.ts` und Specs an); die Audit-Locations `:119` und `:140` zeigen heute auf `src/createMemo.ts:119` (`once(globalDestroySignalQueue, sImpl.id, e.destroy)`) und `src/createMemo.ts:140` (`if (parentEffect != null && group == null)`) — dieselben Zeilen, unverändert. Gegenproben gegen den `lib/`-Build von `777b5f2`:
  - **MEM-005**, Einzelfall: Standalone-Memo mit einer Dependency → `nach createMemo destroyQ=2 signalQ=1 effects=1 signals=2`, nach `destroySignal(dep)` → `destroyQ=1 signalQ=0 effects=0 signals=1`. Der interne Effect ist tot, seine `once`-Subscription steht weiter auf der permanenten Modul-Queue. Volumenprobe wie im Audit: `100 memos, deps destroyed → destroyQ=100 signalQ=0 effects=0 signals=100` — Wort für Wort die Evidenz des Findings.
  - **Präzisierung zur Reichweite** (gemessen, gehört in den Report): die Subscription ist nicht unentfernbar — wird das Memo-Signal später doch zerstört, feuert das `once` und meldet sich selbst ab (`nach destroySignal(memo) destroyQ=0`). Sie hält den toten `EffectImpl` samt Closure also »nur« so lange, wie das Memo-Signal lebt. Für den Fall aus der Evidenz — ein Memo, dessen Inputs weg sind und das deshalb niemand mehr anfasst — ist das die Prozesslaufzeit. Ebenfalls gemessen: über `group.off()` läuft **kein** Leck, weil der Soft-Detach-Emit auf der Signal-ID das `once` verbraucht (`nach group.off(): destroyQ=1 effects=0`, und diese 1 ist die Gruppen-Subscription aus Paket 1, nicht die des Memos). Der verbleibende Leckpfad ist damit exakt einer: der interne Effect zerstört sich selbst, weil seine letzte lebende Dependency gestorben ist.
  - **MEM-008** unverändert: `{attach}` ohne `name` im Rumpf eines Effects, 10 Reruns → Gruppenmitglieder `signals: 1 → 11`, global `signals +3 → +13`, `destroyQ +4 → +24` (pro Leiche zwei Einträge: das `once` des Memos und die Signal-Destroy-Subscription, die Paket 1 in `#addSignal()` anlegt). `effects` bleibt bei 1 — die Effect-Hälfte hat Paket 1 geschlossen, genau wie das Finding es beschreibt. Kontrolle mit `{attach, name}`: `signals: 1` über alle 10 Reruns.
  - **Paket-1-Berührung, die den Fix erst sauber macht**: `destroySignal()` auf einem attachten Signal trägt es seit `924c687` selbsttätig aus der Gruppe aus (`attached group.signals=1` → `destroyed group.signals=0`), bei namensgebundenen ebenso samt Namensbindung. Der MEM-008-Fix hinterlässt deshalb **keine** toten Einträge in `#signals`/`#directSignals`, was vor Paket 1 noch der Fall gewesen wäre. Nachgemessen mit einem Replikat von `createMemo()` samt Fix: Gruppenmitglieder bleiben über 10 Reruns bei `signals: 1`, `destroyQ` bei `+4`, nach `parent.destroy()` `signals: 0`, nach `group.clear()` alles auf Baseline.

- Vorgehen:
  1. **Zuerst die roten Tests für MEM-005**, in `src/createMemo.spec.ts` als neuer `describe`-Block **hinter** `describe('memo signal lifecycle inside an effect body (MEM-005)')` (endet heute bei Zeile 386) und vor `describe('batchWrites option (PERF-001)')`. Die Datei hat `getSubscriptionCount`, `globalDestroySignalQueue`, `createSignal`, `createMemo`, `destroySignal`, `getSignalsCount`, `getEffectsCount` bereits importiert; neu dazu kommt nur `import type {SignalReader} from './types.js';` für die Array-Deklaration im zweiten Test.
     ```ts
     describe('destroy-queue subscription of the internal effect (MEM-005)', () => {
       it('is released when the internal effect dies with its last dependency', () => {
         const destroySubscriptionsBefore = getSubscriptionCount(
           globalDestroySignalQueue,
         );
         const signalsBefore = getSignalsCount();

         const src = createSignal(1);
         const doubled = createMemo(() => src.get() * 2);

         expect(doubled()).toBe(2);

         // The memo's own effect self-destroys here: its last live
         // dependency is gone (EffectImpl[$destroySignal]).
         destroySignal(src);

         expect(getEffectsCount()).toBe(0);
         expect(
           getSubscriptionCount(globalDestroySignalQueue),
           'the once() that ties the effect to the memo signal must go with the effect',
         ).toBe(destroySubscriptionsBefore);

         // The memo signal itself stays alive and frozen — that is the
         // documented behaviour of a memo created outside an effect body.
         expect(getSignalsCount()).toBe(signalsBefore + 1);
         expect(doubled()).toBe(2);

         destroySignal(doubled);

         expect(getSignalsCount()).toBe(signalsBefore);
       });

       it('does not accumulate on the global destroy queue over many memos', () => {
         const destroySubscriptionsBefore = getSubscriptionCount(
           globalDestroySignalQueue,
         );

         const memos: Array<SignalReader<number>> = [];

         for (let i = 0; i < 50; i++) {
           const src = createSignal(i);
           memos.push(createMemo(() => src.get() * 2));
           destroySignal(src);
         }

         expect(getEffectsCount()).toBe(0);
         expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
           destroySubscriptionsBefore,
         );

         destroySignal(...memos);
       });
     });
     ```
     Vor dem Fix rot, gemessen gegen `777b5f2`: im ersten Test steht dort `destroySubscriptionsBefore + 1`, im zweiten `destroySubscriptionsBefore + 50`. Beide roten Läufe gehören im Wortlaut in den Report. `destroySignal(...memos)` nimmt mehrere Reader — die Signatur ist variadisch (so ruft die Datei sie schon bei `destroySignal(trigger, src)`).
  2. **Dann der rote Test für MEM-008**, in den bestehenden `describe('memo signal lifecycle inside an effect body (MEM-005)')`, direkt hinter `it('a memo created with {attach} inside an effect body survives SignalGroup#off()')` (heute Zeile 316-353, wird in Schritt 3 umgeschrieben). Er braucht `getGroupMemberCounts` — Import ergänzen: `import {getGroupMemberCounts} from './assert-helpers.js';`.
     ```ts
     it('a memo created with {attach} inside an effect body is destroyed on the parent rerun instead of piling up in the group (MEM-008)', () => {
       const host = {};
       const group = SignalGroup.findOrCreate(host);
       const trigger = createSignal(0);
       const src = createSignal(1);

       const signalsBefore = getSignalsCount();
       const destroySubscriptionsBefore = getSubscriptionCount(
         globalDestroySignalQueue,
       );

       const outer = createEffect(() => {
         trigger.get();
         createMemo(() => src.get() * 2, {attach: host});
       });

       expect(getGroupMemberCounts(group).signals).toBe(1);

       for (let i = 1; i <= 10; i++) {
         trigger.set(i);
       }

       expect(
         getGroupMemberCounts(group).signals,
         'one memo signal per group, not one per parent rerun',
       ).toBe(1);
       expect(getGroupMemberCounts(group).effects).toBe(1);
       expect(getSignalsCount(), 'trigger, src and the current memo').toBe(
         signalsBefore + 1,
       );
       expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
         destroySubscriptionsBefore + 4,
       );

       outer.destroy();

       expect(
         getGroupMemberCounts(group).signals,
         'the last memo signal dies with the effect that created it',
       ).toBe(0);

       group.clear();
       destroySignal(trigger, src);

       expect(getSignalsCount()).toBe(signalsBefore - 2);
       expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
         destroySubscriptionsBefore,
       );
     });
     ```
     Zu den Zahlen, alle gegen `777b5f2` bzw. gegen ein Replikat von `createMemo()` mit dem Fix gemessen: `signalsBefore` und `destroySubscriptionsBefore` werden **nach** `createSignal(trigger)`/`createSignal(src)` genommen — nackte Signale legen keine Subscription an, die Gruppe ist zu diesem Zeitpunkt leer. Die `+4` nach dem ersten Lauf sind: die Dependency-Subscription von `outer` auf `trigger`, die des Memo-Effects auf `src`, die Gruppen-Subscription für das Memo-Signal (aus Paket 1) und das `once` des Memos selbst. Mit Fix bleiben es über alle 10 Reruns `+4`; `getSignalsCount()` bleibt bei `signalsBefore + 1` (nur das aktuelle Memo-Signal).
     Vor dem Fix rot, gemessen: `getGroupMemberCounts(group).signals` steht nach den Reruns auf `11` statt `1`, `getSignalsCount()` auf `signalsBefore + 11`, die Destroy-Queue auf `destroySubscriptionsBefore + 24` (zwei Einträge pro Leiche).
  3. **`src/createMemo.spec.ts:316-353` umdrehen.** Der Test `it('a memo created with {attach} inside an effect body survives SignalGroup#off()')` kodiert exakt die Hälfte der Bedingung, die MEM-008 abräumt — er stammt aus dem MEM-005-Fix des vorigen Laufs und wird jetzt zum Gegenteil. Neuer Titel: `it('a memo created with {attach} inside an effect body dies with the effect that created it, not with the group (MEM-008)')`. Aufbau unverändert bis `group.off();`, danach die neuen Erwartungen (gemessen gegen das Fix-Replikat):
     ```ts
     expect(
       getSignalsCount(),
       'off() destroys the group effects, and this memo signal belongs to its effect',
     ).toBe(signalsBeforeOff - 1);
     expect(
       attached(),
       'the escaped reader keeps handing out the last computed value',
     ).toBe(2);
     expect(
       group.signal('doubled'),
       'a hard-destroyed signal loses its name (MEM-002)',
     ).toBeUndefined();
     expect(group.hasSignal('doubled')).toBe(false);
     ```
     Der Kommentarkopf des Tests (heute »Covers the `group == null` half of the MEM-005 guard …«) wird ersetzt: `{attach}` nimmt einem Memo, das im Rumpf eines Effects entsteht, nicht mehr die Bindung an diesen Effect; es gibt dem Signal nur noch eine Gruppenzugehörigkeit und optional einen Namen. Dass `group.signal('doubled')` danach `undefined` ist, ist kein Nebeneffekt dieses Pakets, sondern der Destroy-Hook aus Paket 1 — im Kommentar so benennen.
  4. **Nachbartests: Verhalten bleibt, Kommentare nicht.** Alle vier wurden gegen das Fix-Replikat nachgemessen und laufen unverändert grün; die ersten beiden tragen aber Begründungen, die der Fix falsch macht:
     - `src/createMemo.spec.ts:207-237` (`'a memo attached to a group with real dependencies survives SignalGroup#off()'`) — das Memo entsteht **außerhalb** jedes Effect-Rumpfs, `parentEffect` ist `null`, der Hook greift nicht. Gemessen nach `off()`: Signalzahl unverändert, `doubled()` = 2, `group.signal('doubled')` definiert. Der Kommentar sagt heute »Regression guard for the same over-eager hook, on the off()/clear() side« — er muss jetzt die Trennlinie benennen: nicht `{attach}` entscheidet, sondern ob beim Anlegen ein Effect auf dem Stack lag.
     - `src/createMemo.spec.ts:149-165` (`'a memo already attached to a group is destroyed once, by the group, not by the MEM-005 hook'`) — bleibt grün, aber sein Kommentar »{attach} takes the signal out of the MEM-005 hook entirely« ist ab jetzt falsch. Neu: das Memo entsteht außerhalb eines Effect-Rumpfs, deshalb bleibt es Sache der Gruppe. Titel gleichfalls schärfen, etwa `'a memo attached to a group outside any effect body is destroyed once, by the group'`.
     - Ebenfalls geprüft und unverändert grün (kein Handlungsbedarf): `src/SignalGroup.spec.ts:1249-1276` (`'a named memo recreated on every effect rerun does not pile up signals'`) — der benannte Pfad läuft mit und ohne Fix identisch, weil der Rebind das Vorgängersignal ohnehin zerstört, bevor der Hook je zum Zug käme. Und `src/createMemo.spec.ts:167-205` (Standalone-Memo überlebt seine Dependencies), das die Grenze nach der anderen Seite absichert.
  5. **Der Fix in `src/createMemo.ts`.** Die Zeilen 119-142 werden zu einem Block. `once` bleibt importiert, `destroySignal` ebenfalls; kein neuer Import.
     ```ts
     const sImpl = signalImpl(si);
     sImpl.beforeRead = e.run;

     // The memo signal takes its effect down with it (a destroyed memo has
     // nothing left to compute).
     const unsubscribeFromSignalDestroy = once(
       globalDestroySignalQueue,
       sImpl.id,
       e.destroy,
     );

     e.onDestroy(() => {
       // MEM-005: … (Kommentar siehe Schritt 6)
       unsubscribeFromSignalDestroy();

       // MEM-008: … (Kommentar siehe Schritt 6)
       if (parentEffect != null) {
         destroySignal(si);
       }
     });
     ```
     Drei Festlegungen, die nicht verhandelbar sind, weil sie ausgemessen sind:
     - **Eine einzige `e.onDestroy()`-Registrierung**, nicht zwei. Zwei wären verhaltensgleich (beide Reihenfolgen wurden gemessen, identische Zahlen), kosten aber einen zweiten `once`-Listener auf jedem Memo-Effect.
     - **Erst abmelden, dann zerstören.** Andersherum liefe `destroySignal(si)` in einen Emit, der das noch registrierte `once` verbraucht und `e.destroy` re-entrant aufruft — folgenlos (der `#destroyed`-Guard aus `EffectImpl.destroy()` steigt sofort aus), aber ohne Not.
     - **`parentEffect != null` bleibt, `group == null` fällt.** Die andere Hälfte der Bedingung ist kein Rest, sondern trägt: ohne Parent-Effect ist der interne Effect das einzige, was jemals stirbt, wenn die *Inputs* des Memos zerstört werden — ein Hook dort würde das Memo-Signal mit in den Tod reißen und über jeden nachgelagerten Effect kaskadieren. `src/createMemo.spec.ts:167-205` ist genau dieser Regressionswächter und muss grün bleiben.
     `e.onDestroy()` ruft den Callback **sofort** auf, wenn der Effect bereits zerstört ist (`src/Effect.ts:49-57`) — der K1-Fall aus `src/createMemo.spec.ts:239-270`, in dem ein `onCreateEffect()`-Handler den Memo-Effect zerstört, bevor `createEffect()` zurückkehrt. Das ist gewollt und gemessen: `once` wird sofort wieder abgemeldet, das Signal sofort zerstört, Signalzahl zurück auf Baseline. Der Test bleibt grün.
  6. **Kommentare und JSDoc in `src/createMemo.ts`.** Der Erklärblock bei `src/createMemo.ts:121-139` begründet heute die Bedingung `parentEffect != null && group == null` mit zwei Aufzählungspunkten. Der zweite (»`{attach}` given: the group owns the signal's lifetime …«) beschreibt genau die Regel, die dieses Paket zurücknimmt, und darf nicht stehen bleiben. Der neue Block sitzt im `e.onDestroy()`-Rumpf und trägt drei Aussagen:
     - Zu `unsubscribeFromSignalDestroy()`: die Bindung läuft in beide Richtungen, aber `globalDestroySignalQueue` ist eine permanente Modul-Queue. Stirbt der Effect zuerst — die letzte lebende Dependency wurde zerstört, oder der Parent hat ihn als Child-Effect abgeräumt — hält die verbliebene Subscription den toten `EffectImpl` samt Closure so lange fest, wie das Memo-Signal lebt. Bei einem Memo, dessen Inputs weg sind, ist das für immer.
     - Zu `if (parentEffect != null)`: ein Memo, das im Rumpf eines Effects entsteht, gehört diesem Effect. Sein interner Effect ist dort ein Child-Effect und stirbt bei jedem Parent-Rerun; ohne dieses Gegenstück bleibt pro Rerun ein Signal zurück — unbenannt und `{attach}`-los verwaist es, mit `{attach}` sammelt es sich in der Gruppe an. Der benannte Fall ist über den Rebind seit jeher geheilt; diese Zeile zieht den unbenannten nach.
     - Zur verbliebenen Bedingung: warum `parentEffect == null` außen vor bleibt — der bestehende erste Aufzählungspunkt (`src/createMemo.ts:128-134`) ist sachlich weiterhin richtig und wird wörtlich übernommen.
     Der JSDoc über `createMemo()` (`src/createMemo.ts:56-67`) behauptet: »Pass `{attach}` to give the signal a lifetime of its own (a `SignalGroup`)« und »an attached memo only survives as a frozen value«. Beides gilt ab jetzt nur noch für Memos, die außerhalb eines Effect-Rumpfs entstehen. Neu formulieren: im Rumpf eines Effects bindet `{attach}` das Signal an die Gruppe, hebt die Bindung an den erzeugenden Effect aber nicht auf — das Signal stirbt mit dem Rerun, und `hibernate()` um die Erzeugung herum ist der einzige Weg zu einem Memo, das den Parent überlebt (gemessen: `hibernate()` leert den Effect-Stack, `getCurrentEffect()` liefert `null`, der Hook greift nicht).
  7. **Doku-Kette, Reihenfolge nach `CLAUDE.md` → »When the public API changes«.** Die Zusage lautet ab jetzt überall gleich: ein `createMemo()` im Rumpf eines Effects gehört diesem Effect — mit und ohne `{attach}`. `{attach}` gibt dem Signal eine Gruppenzugehörigkeit und optional einen Namen, keine eigene Lebenszeit; `hibernate()` ist der einzige Ausweg.
     - `docs/recipes.md:96-106` — die vom Finding namentlich benannte Stelle. Die Sätze ab »With `{attach}`, the group owns the signal instead and it survives« bis »just without losing the signal« werden ersetzt. Der Schlusssatz (`{attach}` ist kein Ausweg für ein lebendes Memo, `hibernate()` schon) bleibt inhaltlich stehen und wird stärker: `{attach}` rettet ab jetzt nicht einmal mehr den Wert.
     - `docs/recipes.md:421` — der Aufzählungspunkt »Signals stay alive, retain their values, and remain reachable by name« in den `off()`-Semantics. Eine Ausnahme ergänzen: ein Memo-Signal, das im Rumpf eines Effects mit `{attach}` entstanden ist, gehört seinem Effect und wird mit ihm zerstört, wenn `off()` die Effects der Gruppe abräumt; es verliert dabei auch seinen Namen. Gemessen an `src/createMemo.spec.ts:316` (Schritt 3).
     - `docs/api.md:118-129` — derselbe Absatz wie in `recipes.md`, wortgleich nachziehen.
     - `docs/api.md:426` — die `off()`-Zeile der Instanz-Tabelle (»signals stay alive, the group remains reusable«) bekommt denselben Halbsatz wie `recipes.md:414`, kurz gehalten; die Tabelle ist die Kurzfassung, nicht der Ort für die Begründung (Fließtext dazu steht in `recipes.md:421`).
     - `skills/using-signalize/references/pitfalls.md:23` — Pitfall **7a**, letzter Drittel: »With `{attach}` a group owns the signal instead and it survives … `{attach}` saves the value, not the computation«. Auf den neuen Stand bringen: `{attach}` rettet weder Rechnung noch Wert, wenn das Memo im Rumpf eines Effects entsteht — `hibernate()` rettet beides. Nummer 7a bleibt, sie wird aus `SKILL.md` referenziert.
     - Geprüft und **unangetastet**: `docs/cheat-sheet.md:70-86` (listet nur die Optionen, keine Aussage zur Lebenszeit), `skills/using-signalize/SKILL.md` (Punkt 4 nennt nur `lazy` und das fehlende Decorator, Zeile 49-50 spricht über Child-Effects allgemein und bleibt richtig), `skills/using-signalize/references/api.md`, `skills/using-signalize/references/patterns.md`, `README.md`, `docs/quickstart.md`, `docs/architecture.md` — alle zeigen `createMemo(..., {attach: this})` nur als Klassenfeld, und ein Konstruktorlauf ist kein Effect-Rumpf. Falls dieser Fund beim Schreiben kippt, gehört die Abweichung in den Report statt in eine stille Zusatzänderung.
  8. **`CHANGELOG.md`, ausschließlich unter `## Unreleased` → `### Bug Fixes`.** Zwei Zeilen, released Abschnitte (`## v0.x.y`) bleiben unangetastet:
     - Eine Zeile für MEM-005: der interne Effect eines Memos meldet seine Subscription auf der globalen Destroy-Queue wieder ab, wenn er stirbt, bevor sein Signal stirbt — bislang blieb pro Memo, dessen letzte Dependency zerstört wurde, ein Eintrag samt totem Effect auf einer prozessweiten Queue liegen.
     - Eine Zeile für MEM-008: `createMemo(fn, {attach})` **ohne** `name`, im Rumpf eines Effects aufgerufen, legt nicht mehr bei jedem Parent-Rerun ein weiteres Signal in der Gruppe ab; das Signal stirbt mit dem Effect, der es erzeugt hat — wie es der benannte Fall über den Rebind schon tat. Diese Zeile muss die Verhaltensänderung benennen, nicht nur das Leck: `{attach}` hält ein solches Memo-Signal nicht mehr über einen Rerun, ein `destroy()` des Parents oder ein `group.off()` hinweg am Leben.
     **Keine Finding-IDs in den Zeilen.** `(MEM-005)` steht im selben `## Unreleased`-Block bereits aus dem vorigen Audit mit anderer Bedeutung (`CHANGELOG.md:23`, und `CHANGELOG.md:50` als »follow-up to MEM-005«); der Bezug läuft über den Commit-Titel. Die bestehende Zeile `CHANGELOG.md:50` — der benannte Fall aus dem Vorlauf — bleibt stehen und wird nicht umgeschrieben: sie ist richtig, die neue Zeile ergänzt sie um den unbenannten Fall.
  9. **Abschluss.** `pnpm world` und `pnpm test:gc` müssen grün sein. In den Report gehören: die roten Läufe aus Schritt 1 bis 3 im Wortlaut (die ausgegebenen Zahlen, nicht »schlug fehl«), die Testbilanz vor/nach (Stand Paket 3: `pnpm world` 362 passed / 7 skipped, `pnpm test:gc` 369 passed), ob außer dem umgedrehten Test aus Schritt 3 noch etwas an der Bilanz gewackelt hat, und die tatsächlich gemessene Destroy-Queue-Zahl aus Schritt 2, falls sie von `+4` abweicht.

**MEM-005 · medium · src/createMemo.ts:119** — `createMemo()` muss seine Destroy-Queue-Subscription wieder abmelden

`once(globalDestroySignalQueue, sImpl.id, e.destroy)` bindet den Effect an die Zerstörung des Memo-Signals, hat aber kein Gegenstück für den umgekehrten Fall. Stirbt der interne Effect zuerst — weil seine letzte Dependency zerstört wurde oder weil er als Child-Effect eines Parent-Reruns abgeräumt wird — bleibt die Subscription unbegrenzt auf der permanenten Modul-Queue liegen. Jeder solche Memo hinterlässt einen dauerhaften Eintrag samt Effect-Wrapper und Closure; die Queue wächst monoton.

Empfehlung: Das Unsubscribe-Handle von `once()` festhalten und in `e.onDestroy(…)` aufrufen. Der Hook existiert bereits, nur die Bedingung `parentEffect != null && group == null` schränkt ihn heute auf einen Sonderfall ein.

Belegt mit: 100 Standalone-Memos, deren einzige Dependency danach zerstört wird — `baseline destroyQ=0 signalQ=0 effects=0 signals=0` gegen `100 memos, deps destroyed destroyQ=100 signalQ=0 effects=0 signals=100`.

**MEM-008 · low (vorher medium, Status `improved`) · src/createMemo.ts:140 · docs/recipes.md:101-104** — `createMemo({attach})` ohne `name` sammelt ein Signal pro Rerun in der Gruppe

Der Lebenszeit-Hook greift unter der Bedingung `parentEffect != null && group == null`. Ein `createMemo(cb, {attach: g})` *ohne* `name` im Rumpf eines Effects legt daher bei jedem Parent-Rerun ein neues Signal an, das keiner einsammelt — es hängt bis `g.clear()` in der Gruppe. Der Effect-Teil ist sauber, nur die Signale wachsen. Die benannte Variante ist über den Rebind-Mechanismus mitgeheilt. Die Doku, die exakt diese Konstellation behandelt, beschreibt sie als »the group owns the signal instead and it survives« und erwähnt die Ansammlung nicht.

Empfehlung: Den `attach`-Zweig ebenfalls an den erzeugenden Effect binden, oder die Doku-Stelle um die Ansammlung ergänzen. — Der Nutzer hat den Code-Fix gewählt (siehe »Entscheidungen«).

Belegt mit: 10 Reruns gegen `lib/` — `{attach} unnamed: signals nach 1 Run 3, nach 10 Reruns 13 | effects 2` gegen `{attach,name}: signals nach 1 Run 3, nach 10 Reruns 3 | effects 2`.

#### Offene Rückfrage an den Nutzer (blockiert die Umsetzung nicht, Vorschlag steht)

Der MEM-008-Fix nimmt eine Zusage zurück, die zwei Stellen ausdrücklich geben: `off()` lässt attachte Signale am Leben (`docs/api.md:426`, `docs/recipes.md:421`), und `src/createMemo.spec.ts:316` wurde im **vorigen** Lauf genau als Wächter dafür geschrieben (»Covers the `group == null` half of the MEM-005 guard«). Nach dem Fix zerstört `group.off()` ein Memo-Signal, das im Rumpf eines Effects mit `{attach}` entstanden ist, samt Namensbindung (gemessen: `signals 2 → 1`, `group.signal('doubled')` `undefined`).

Vorschlag: **wie geplant umsetzen.** Die Alternative wäre, den Hook zu überspringen, solange die Gruppe gerade `off()` fährt — das rettet die Zusage, koppelt `createMemo()` aber an ein internes `#busy`-Bit von `SignalGroup`, erzeugt die schwer erklärbare Regel »stirbt mit seinem Effect, außer beim Abschalten der Gruppe« und lässt pro `off()` doch wieder ein verwaistes Signal in der Gruppe stehen. Der Leckpfad, um den es geht, ist der Parent-Rerun, nicht `off()`.

Abgearbeitet in Zug 0 von Paket 5 (2026-08-06): das Klassenfeld-Muster an vier Doku-Stellen (`docs/quickstart.md:60`, `README.md:259`, `docs/cheat-sheet.md:184`, `skills/using-signalize/references/patterns.md:58`) → jetzt namentlich unter Paket 7 eingetragen; es stand bisher nur hier als »Kandidat«. Die beiden Alt-Tests ohne Teardown (`src/createMemo.spec.ts:13` und `:50`, zusammen 2 Effects im modulglobalen Zähler) → **nächstes Audit**: kein offenes Paket fasst `src/createMemo.spec.ts` noch einmal an, Paket 7 ist reine Doku, und eine fremde Spec-Datei allein für Testhygiene aufzumachen wiederholt die Begründung, mit der die Thenable-Testlücke aus Paket 3 dorthin gegangen ist. Nichts mehr offen aus diesem Stapel.


### [x] 5. link(): die tatsächliche Haltung dokumentieren
- Findings: MEM-007 (medium) — in der revidierten Fassung erledigt, Review abgenommen
- Hash: `459a140` · Verify vom Orchestrator: `pnpm world` ✓ 367 passed / 8 skipped, `pnpm test:gc` ✓ 375 passed. Eine Review-Runde nötig: die Korrektur war zunächst zu absolut geraten (»GC räumt nie ab«) und widersprach dem `gLinkFinalizer`, der genau das tut, wenn die Quelle mitfällt.

#### Vom Review bestätigt
- `src/link.ts` ist nachweislich kommentar-only: kommentar- und JSDoc-bereinigt byteidentisch zu `HEAD`.
- Alle vier Ausstiegswege einzeln nachgemessen (`link.destroy()`, `unlink()`, geleerte `{attach}`-Gruppe, `destroySignal()` auf Quelle und Ziel) — jeder bringt `signalQ`, `destroyQ` und `links` auf 0.
- Der `throwCollectedErrors`-Refactor ist verhaltensgleich, die Meldung wortgleich, beide Pfade jetzt durch Tests belegt (vorher gab es für den Mehrfachfehler-Pfad in `SignalLink` keinen).
- Sweep über `src/`, `docs/`, `skills/`, `CHANGELOG.md`: alle 18 Treffer auf `reclaim|collectib|garbage|GC alone` im Link-Kontext führen den Qualifier mit.

#### Kleine Review-Befunde → gehen an Paket 7 (Doku-Paket)
- **`src/link.ts:25-27`** — »Explicitly destroying the source (or a signal target) tears every link on it down the same way, fully«: der Quantor greift beim Signal-Ziel zu weit. Gemessen mit drei Links auf einer Quelle bringt `destroySignal(t1)` nur `links 3 → 2`; erst `destroySignal(source)` räumt alle drei ab. Die Parallelstellen (`src/link.ts:235-236`, `docs/api.md:308-309`) formulieren es ohne Quantor und sind korrekt.
- **`src/link.ts:63-65` und `:21-22`** — »Both of the link's subscriptions« trifft nur den Callback-Fall. Ein `SignalLinkToSignal` hat drei: eine auf `globalSignalQueue`, zwei auf `globalDestroySignalQueue` (Quelle und Ziel). Die zitierte 200/200-Messung stammt aus dem Callback-Szenario; für Signal-Ziele stünde 200/400.
- Ziel: Code-Kommentare und Doku sagen, was `link()` wirklich tut — ein Link wird bis zu seinem `destroy()`, einem `unlink()`, dem Abräumen seiner Gruppe oder der Zerstörung der Quelle stark gehalten —, und die Aufräumpflicht steht dort, wo Nutzer sie suchen.
- Bereich: `src/link.ts` (ausschließlich Kommentare und JSDoc), `src/SignalLink.ts`, Doku-Kette zur Link-Lebenszeit
- Hängt ab von: Paket 1 (Schritt 4 nutzt `throwCollectedErrors` aus `src/collect-errors.ts`)
- Modell: mittlere Stufe (final; der Zuschnitt ist nach der Revision der MEM-007-Entscheidung reine Prosa plus ein verhaltensgleicher Refactor und ein Test. Die Messungen, die sonst die Arbeit gewesen wären, stehen unten im `Abgleich` und sind als Belegzahlen direkt verwendbar. Was Urteil verlangt, ist die Formulierung — nicht die Mechanik.)
- Hash: —
- Mitgenommen (Nebenbefunde aus Paket 1, 2026-08-06, in Zug 0 von Paket 5 nachjustiert):
  - `src/SignalLink.ts:344-354` auf `throwCollectedErrors()` aus `src/collect-errors.ts` umstellen — dieselbe Datei, die dieses Paket ohnehin anfasst, und die letzte Stelle im Paket, die die Sammel-Logik von Hand nachbaut.
  - `src/SignalLink.ts:117-122` bleibt hier, aber **mit umgekehrtem Vorzeichen**: der Kommentar ist sachlich richtig, die als Korrektur gedachte Begründung war falsch. Gemessen gegen `@spearwolf/eventize` (`node_modules/@spearwolf/eventize/lib/index.js:533`, `isSimilarListenerType`): dedupliziert wird ausschließlich für `LISTENER_IS_OBJ` und `LISTENER_IS_NAMED_FUNC`. Ein einfacher Funktions-Listener ist von der Deduplizierung **per Typ** ausgeschlossen, nicht wegen fehlender Identität — dreimal `once(o, 'X', dieselbeFunktion)` ergibt `getSubscriptionCount(o) === 3` und bei einem `emit` zwei Aufrufe; dieselbe Registrierung als Listener-Objekt oder als `on(o, 'X', 'm', ctx)` ergibt `1`. Der Satz »a plain function listener isn't recognized as 'similar' to a previous one« stimmt also; er bekommt hier nur den tatsächlichen Mechanismus dazu. **Der falsche Kommentar steht in `src/SignalGroup.ts:542-546`** und geht an Paket 8, das diese Datei anfasst.
- Dateien: `src/link.ts`, `src/SignalLink.ts`, `src/SignalLink.spec.ts`, `src/link.gc.spec.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/SKILL.md`, `skills/using-signalize/references/pitfalls.md`, `skills/using-signalize/references/api.md`, `CHANGELOG.md`
- Verify: `pnpm world` (= CI: clean + biome check + tsc + rollup + vitest) und zusätzlich `pnpm test:gc`. **Nicht** `npx tsc --noEmit -p tsconfig.json`: diese Config meldet 6 vorbestehende Fehler in `node_modules` (`unplugin`/`webpack`-Typen), kein Script fährt sie. Während der Arbeit: `npx vitest run SignalLink.spec.ts` und `npx vitest run --config vitest.gc.config.ts link.gc.spec.ts` (beides geprüft, läuft; `pnpm test -- <datei>` filtert nicht — bekannte Eigenheit, das Script endet auf `vitest run --coverage`).
- Commit: `docs(link): describe the real link lifetime and the cleanup duty (MEM-007)`
- Abgleich (2026-08-06, Zug 0, danach revidiert): **MEM-007 unverändert, Fundstelle zeilengenau.** `src/link.ts` hat seit dem Audit keinen Commit gesehen (`924c687`, `469e7d1`, `777b5f2`, `5f60bee` fassen `SignalGroup.ts`, `EffectImpl.ts`, `createMemo.ts`, `collect-errors.ts` und Specs an); die Audit-Location `17-20,123` zeigt heute auf `const gLinks = new WeakMap<ISignalImpl<any>, Map<object | Function, SignalLink<any>>>()` (`src/link.ts:17-20`) und `links.set(targetKey, newLink)` (`src/link.ts:123`).

  Alle Zahlen unten sind gegen den `lib/`-Build von `5f60bee` gemessen. Sie sind der Beleg für die Prosa dieses Pakets — jede Aussage, die die Kommentare und die Doku künftig treffen, hat hier ihre Messung. Und sie dokumentieren, was der ursprünglich beschlossene Umbau gekostet hätte; die Entscheidung dazu ist am 2026-08-06 auf »nur Doku« revidiert worden (siehe »Entscheidungen«).

  - **Die Evidenz reproduziert Wort für Wort.**
    ```
    baseline               : signalQ=0    destroyQ=0    links=0
    after 1000 orphan links: signalQ=1000 destroyQ=1000 links=1000
    after gc               : signalQ=1000 destroyQ=1000 links=1000
    getLinksCount(src) = 1000
    1000 writes auf das Quellsignal: 64,8 ms   (Audit: 72,3 ms)
    ```
  - **Die innere `Map` ist der einzige starke Halter.** Von den globalen Queues aus ist ein Link *nicht* erreichbar — die `WeakRef`-Selbstreferenz aus `src/SignalLink.ts:63-88` und `:405-415` trägt bereits. Gemessen gegen die echte `SignalLink`-Klasse, nur den Map-Wert durch ein `WeakRef` ersetzt: 200 von 200 Links werden eingesammelt, während das Quellsignal weiterlebt; für `SignalLinkToSignal` mit seiner zusätzlichen Ziel-Subscription ebenso. Der starke Map-*Schlüssel* (Callback bzw. Ziel-`ISignalImpl`) hindert daran nichts, weil er nicht auf den Link zeigt. **Der Kommentar in `src/SignalLink.ts:63-70` beschreibt also die halbe Wahrheit**: die `WeakRef` verhindert, dass die Queues den Link festhalten — festgehalten wird er trotzdem, von `gLinks`.
  - **GC ist für Links kein Aufräumpfad, auch nicht wenn die Quelle mit fällt.** Das Szenario des bestehenden `src/link.gc.spec.ts` — 200 Links, Quelle und Callback fallen mit — bringt zwar `getLinksCount()` auf 0, lässt aber beide Queue-Subscriptions liegen:
    ```
    nach 200 Links      : signalQ=200 destroyQ=200 links=200
    nach gc (Quelle weg): signalQ=200 destroyQ=200 links=0
    ```
    Der explizite Weg räumt beides ab — `unlink(s2)` nach 200 Links: `signalQ 400 → 200`, `destroyQ 400 → 200`, `links 200 → 0`; `destroySignal(source)` ebenso. **Das ist die zentrale Aussage, die die Doku künftig transportieren muss**, und zugleich der Grund, warum der Testname in `src/link.gc.spec.ts` (»are reclaimed by GC«) zu viel verspricht: eingesammelt wird der Zähler, nicht die Subscription.
  - **Der verworfene Umbau, zur Aktenlage.** Ein Prototyp gegen eine gepatchte Kopie von `lib/` (WeakRef-Werte, `FinalizationRegistry` für Eintrag und Zähler, zweite Registry für die Queue-Handles) schloss das Leck vollständig: nach GC `signalQ=0 destroyQ=0 links=0 rawEntries=0`, und 1000 Writes auf die Quelle fielen von 64,8 ms auf 0,3 ms. Er kippte an einer Nebenwirkung, die der ursprüngliche Beschluss nicht kannte: weil ein Link stark auf sein Ziel zeigt und ein Ziel nie auf den Link, wird ein schwach gehaltener Link für **beide** Zielarten schwach.
    ```
    nach link(a,b)   : b = 1 | links = 1
    nach a.set(2)    : b = 2 | links = 1
    nach gc, a.set(3): b = 2 | links = 0     <-- erwartet 3
    ```
    `docs/recipes.md:496` zeigt genau diese Form als Kopfbeispiel. Aus »leckt sichtbar in `getLinksCount()`« wäre »hört still auf zu funktionieren« geworden — der Grund für die Revision.
  - **Rest-Beobachtung, gemessen, gehört in keinen Fix**: referenziert ein Callback seinerseits seinen Link, entsteht über den starken Map-Schlüssel ohnehin ein Zyklus, der auch bei schwachem Wert nicht eingesammelt worden wäre (0 von 200). Unter dem jetzt gültigen Weg ist das folgenlos — es gibt nichts, was einzusammeln wäre.

- Vorgehen:
  1. **`src/link.ts`, Kommentare am Modulkopf.** Kein Zeichen ausführbarer Code ändert sich in dieser Datei — wer beim Schreiben in Versuchung gerät, `WeakRef` zu tippen, liest die revidierte MEM-007-Zeile unter »Entscheidungen« noch einmal.
     - `src/link.ts:13-16` behauptet heute, die `WeakMap` lasse »an orphaned link … become collectible instead of pinned for the process lifetime«. Das stimmt nur, wenn auch die Quelle fällt. Der neue Block sagt beides: die `WeakMap` bindet die **Menge** der Links an die Lebensdauer des Quellsignals (deshalb ist sie richtig und bleibt), und die innere `Map` hält **jeden einzelnen** Link stark, samt Callback-Closure, Ziel-Referenz und den beiden Subscriptions auf den globalen Queues. Zwei Konsequenzen ausdrücklich benennen, beide mit den Zahlen aus dem `Abgleich`: `link(src, cb)` mit je frischem Callback gegen eine langlebige Quelle wächst unbegrenzt (1000 verwaiste Links bleiben 1000, auch nach `gc()`), und jeder Write auf die Quelle wird linear teurer (1000 Writes in 64,8 ms). Und der Ausweg: `link.destroy()`, `unlink(source, target?)` oder `{attach}` an eine Gruppe, die geleert wird — GC ist keiner.
     - `src/link.ts:22-36` (`gLinksCount` und `gLinkFinalizer`) bleibt inhaltlich richtig und wird nur an einer Stelle geerdet: der `FinalizationRegistry` korrigiert den **Zähler**, wenn ein Link doch einmal eingesammelt wird (nämlich sobald die Quelle mitfällt) — er räumt keine Subscription ab und ist kein Lebenszyklus. Gemessen: nach dem Einsammeln von 200 Links stehen `signalQ` und `destroyQ` unverändert auf 200.
     - JSDoc über `link()` (`src/link.ts:67-76`) bekommt einen Absatz **Lifetime**: der zurückgegebene `SignalLink` wird von der Registry gehalten, bis er zerstört wird, bis `unlink()` ihn abräumt, bis eine Gruppe, an die er attacht ist, geleert wird, oder bis Quelle bzw. Signal-Ziel zerstört werden. Den Rückgabewert wegzuwerfen ist erlaubt und ändert daran nichts — es macht den Link nur unerreichbar für den Aufrufer, nicht kurzlebiger.
     - JSDoc über `getLinksCount()` (`src/link.ts:177-184`): ein Satz dazu, dass der Zähler genau diese Haltedauer misst und deshalb das Werkzeug ist, mit dem sich die Aufräumpflicht im Test prüfen lässt (vgl. `docs/recipes.md:561`).
  2. **`src/SignalLink.ts`, Kommentare.**
     - `src/SignalLink.ts:63-70` — der Kern der falschen Zusage. Die `WeakRef` bleibt richtig und bleibt begründet: ohne sie hielten zwei prozessweite Queues den Link fest. Aber der Schlusssatz (»lets an orphaned link … become collectible«) wird auf das reduziert, was er wirklich leistet — die Queues halten den Link nicht mehr fest. Wer ihn festhält, ist `gLinks`, solange das Quellsignal lebt (Verweis auf den Kommentar in `link.ts`). Der Nachsatz über die stillen No-ops nach dem Einsammeln bleibt, er beschreibt korrekt den Zustand nach einem GC-Lauf, bei dem die Quelle mitgefallen ist.
     - `src/SignalLink.ts:29-45` (der MEM-004-Block) — die Klammer »routed through `selfRef`, so it no longer *pins* the link — see MEM-002 above« erbt die Ungenauigkeit von oben und wird auf dieselbe Formulierung gebracht: nicht mehr *von den Queues aus* gepinnt. Der lange S7-Absatz über `Object.freeze` bleibt wörtlich stehen, er ist unberührt.
     - `src/SignalLink.ts:117-122` — Aussage bleibt, Begründung wird präzise (siehe »Mitgenommen«): eventize dedupliziert über `isSimilar()` nur Listener vom Typ `LISTENER_IS_OBJ` und `LISTENER_IS_NAMED_FUNC`; ein einfacher Funktions-Listener ist per Typ ausgeschlossen, weshalb auch **dieselbe** Funktionsreferenz zweimal registriert zwei Subscriptions ergibt. Der Guard ist also nicht der Ausgleich für eine frische Arrow-Funktion, sondern für eine Deduplizierung, die für diesen Listener-Typ gar nicht stattfindet. Eine Zeile, keine Abhandlung.
  3. **`src/SignalLink.ts:347-355` auf `throwCollectedErrors()` umstellen.** `import {throwCollectedErrors} from './collect-errors.js';` ergänzen — `collect-errors.ts` ist eine Blattdatei ohne eigene Imports, es entsteht kein Zyklus (`rollup.config.mjs` wirft bei `CIRCULAR_DEPENDENCY`). Der handgebaute Block wird zu:
     ```ts
     throwCollectedErrors(
       releaseErrors,
       'releasing SignalLink destroy-queue subscriptions',
     );
     ```
     Die Meldung ist damit wortgleich zu heute (`[signalize] ${n} errors while releasing SignalLink destroy-queue subscriptions`), und ein Einzelfehler wird weiterhin unverändert durchgereicht. Der S6-Kommentar darüber (`src/SignalLink.ts:321-326`) bleibt stehen; nur der Halbsatz »Same shape as `EffectImpl.destroy()`'s cleanup collection« wird zur Tatsache statt zur Analogie — es ist ab jetzt dieselbe Funktion.
  4. **Test für den Mehrfachfehler-Pfad, in `src/SignalLink.spec.ts`.** Geprüft: der Pfad ist heute **nicht** abgedeckt — `AggregateError` kommt in den Specs nur in `src/EffectImpl.destroy.spec.ts:280` und `src/SignalGroup.teardown.spec.ts:129` vor, keine Link-Spec fasst `releaseErrors` an. Ohne Test wäre der Refactor eine unbelegte Verhaltensgleichheit. Der Zugang läuft über `protected releaseOnDestroy()` (`src/SignalLink.ts:100-102`), das eine Unterklasse im Spec bedienen darf:
     ```ts
     class ThrowingLink extends SignalLinkToCallback<number> {
       constructor(source: SignalLike<number>, target: (value: number) => void) {
         super(source, target);
         this.releaseOnDestroy(() => {
           throw new Error('release-a');
         });
         this.releaseOnDestroy(() => {
           throw new Error('release-b');
         });
       }
     }
     ```
     Ein neuer `describe`-Block am Ende der Datei mit zwei Tests, beide vor **und** nach dem Refactor grün — sie sind der Beweis der Verhaltensgleichheit, kein Regressionstest:
     - **ein werfendes Handle**: nur `release-a` registrieren, `destroy()` wirft genau diesen `Error` unverändert (`toThrow('release-a')`, **nicht** `AggregateError`), und der Teardown ist trotzdem vollständig — `isDestroyed === true`, `Object.isFrozen(link) === true`, `lastValue === undefined`, und ein vor dem `destroy()` registrierter `DESTROY`-Listener hat gefeuert.
     - **zwei werfende Handles**: `destroy()` wirft einen `AggregateError`, dessen `errors` in Registrierungsreihenfolge `['release-a', 'release-b']` tragen und dessen `message` `[signalize] 2 errors while releasing SignalLink destroy-queue subscriptions` lautet. Genau diese Meldung ist die Probe darauf, dass `what` richtig übergeben wurde.

     Beide Tests räumen ihr Quellsignal am Ende mit `destroySignal()` ab; die Datei hat `createSignal` und `destroySignal` bereits importiert, `SignalLinkToCallback` und der Typ `SignalLike` kommen dazu.
  5. **`src/link.gc.spec.ts` — die irreführende Zusage entschärfen.** Der Befund des Audits (»Der GC-Test greift nur, weil dort auch die Quelle fallengelassen wird«) trifft die Datei doppelt, und beides ist gemessen:
     - Die Testnamen `orphaned callback-target links (SignalLinkToCallback) are reclaimed by GC` und `orphaned signal-target links (SignalLinkToSignal) are reclaimed by GC` verschweigen die Bedingung. Neue Namen tragen sie, etwa `… are reclaimed by GC once their source signal is dropped too`. Der Testkörper bleibt unverändert — er ist richtig, nur sein Etikett war zu groß.
     - Der Testkommentar in beiden Tests (»drop every external reference (signals, links, callbacks)«) benennt die Bedingung zwar, zieht aber nicht den Schluss. Ein Satz dazu, dass genau dieses Mitfallen der Quelle die Voraussetzung ist und dass ein Link auf einer **lebenden** Quelle nicht eingesammelt wird.
     - Die NB am Kopf der Datei (Zeile 26-33) erklärt, warum `getSignalsCount()` hier nicht assertiert wird. Sie bekommt einen zweiten Absatz: `getLinksCount()` fällt auf 0, die beiden Queue-Subscriptions jedes Links bleiben aber liegen (gemessen: `nach gc (Quelle weg): signalQ=200 destroyQ=200 links=0`). Die Suite belegt also das Einsammeln des Zählers, nicht das der Subscriptions — deshalb steht in ihr auch keine Assertion über `getSubscriptionCount()`, und das ist Absicht, keine Lücke.
     - **Ein neuer Charakterisierungstest** im selben `gcDescribe`, der das dokumentierte Verhalten festnagelt: `const source = createSignal(0);` **außerhalb** einer IIFE, darin 100 × `link(source, () => {})`, dann `await forceGc()` und `expect(getLinksCount()).toBe(100)` sowie `expect(getLinksCount(source)).toBe(100)`. Danach `unlink(source)` → `0`, `destroySignal(source)`. Titel in der Form `links on a live source signal are held until unlink() — GC does not reclaim them (MEM-007)`, mit einem Kommentar, der ihn als bewusste Dokumentation des Verhaltens ausweist und auf die revidierte Entscheidung verweist. Er ist heute und nach diesem Paket grün; sein Wert liegt darin, dass er rot wird, wenn jemand später doch auf schwache Haltung umstellt — dann ist das eine Entscheidung und kein Nebeneffekt.
       **Determinismus**: dieser Test wartet auf nichts. Negative Erwartungen (»wurde *nicht* eingesammelt«) brauchen keinen Retry und dürfen keinen haben — dass der GC etwas Erreichbares nicht einsammelt, ist garantiert, nicht wahrscheinlich. Ein einzelnes `await forceGc()`, dann assertieren. Die bestehende Retry-Schleife `waitUntilLinksCollected()` bleibt den beiden Alt-Tests vorbehalten und wird nicht angefasst. `unlink` und `destroySignal` dafür importieren; das `afterEach` mit `assertLinksCount(0, 'afterEach')` deckt den Abschluss ab.
  6. **Doku-Kette, Reihenfolge nach `CLAUDE.md` → »When the public API changes«.** Die Zusage in einem Satz, überall gleich: **ein Link lebt, bis man ihn abräumt.** `link.destroy()`, `unlink(source, target?)`, eine geleerte `{attach}`-Gruppe oder die Zerstörung von Quelle bzw. Signal-Ziel — das sind die vier Wege, und es gibt keinen fünften. Die sechs Stellen, die für die verworfene Variante ausgemessen wurden, sind unter dem neuen Vorzeichen erneut geprüft; die Hälfte fällt dadurch weg:
     - `docs/api.md:281-287` — der Absatz zur `(source, target)`-Deduplizierung ist korrekt und bleibt. **Darunter** ein neuer Absatz »Lifetime« mit der Zusage oben, plus dem Satz, der das Finding trägt: eine langlebige Quelle sammelt jeden je auf ihr angelegten Link, weshalb wiederholtes `link(src, freshCallback)` ohne `unlink()` unbegrenzt wächst und jeden Write auf `src` linear verteuert.
     - `docs/api.md:294` (`getLinksCount(source?)`) — ein Halbsatz: der Zähler misst genau diese Haltedauer, ein Link verschwindet daraus erst durch einen der vier Wege.
     - `docs/recipes.md:491-510` — das Kopfbeispiel `link(inA, outB);` bleibt **unverändert richtig** (das war unter der verworfenen Variante anders). Die Aufzählung darunter bekommt einen Punkt zur Lebenszeit und zur Aufräumpflicht, direkt neben dem bestehenden »Destroyed when the source or target signal is destroyed«, der die Sache heute nur von einer Seite zeigt.
     - `docs/recipes.md:555-570` (der Leak-Check-Abschnitt mit `getLinksCount()`) — geprüft, ob dort ein Link-Beispiel fehlt; falls die Stelle nur Signale und Effects zeigt, ist sie der natürliche Ort für einen Zweizeiler mit `unlink()`. Eine Zeile, keine neue Sektion.
     - `docs/cheat-sheet.md:88-100` — der Block zeigt bereits `const con = link(...)` und listet `unlink`/`destroy`. Eine Kommentarzeile zur Haltedauer reicht.
     - `skills/using-signalize/references/pitfalls.md:76` — Pitfall **17**, die Stelle, an der ein Nutzer diesen Fehler tatsächlich sucht. Nummer bleibt (wird aus `SKILL.md` referenziert). Ergänzen: gehalten wird der Link bis zu einem der vier Wege; ein heißer Pfad, der immer neue Callbacks gegen dieselbe Quelle linkt, ohne aufzuräumen, wächst unbegrenzt. Pitfall 16/16a (Gruppen-Backstop) wird von Paket 7 angefasst — **nicht dieselbe Nummer anfassen**.
     - `skills/using-signalize/references/api.md:148-158` — eine Zeile im Link-Block, wortgleich zur Cheat-Sheet-Zeile.
     - `skills/using-signalize/SKILL.md:54` — »Effects and links outlive the scope that created them, and an unattached one stays reachable from the global queues indefinitely« ist unter dem gültigen Weg **inhaltlich richtig** und bleibt. Nur die Ortsangabe stimmt für Links nicht: erreichbar sind sie über die Registry `gLinks`, nicht über die globalen Queues (deren Subscriptions gehen durch eine `WeakRef`). Ein Wort, keine Umformulierung des Punktes.
     - `README.md:281-283` — dieselbe Aussage, dieselbe Prüfung, **unverändert korrekt**: »Effects and links outlive the scope that created them: pass `{attach: obj}` and dispose with `SignalGroup.delete(obj)`.« Bleibt unangetastet. (Unter der verworfenen Variante wäre genau dieser Satz falsch geworden — er ist der Grund, warum die Revision richtig ist.)
     - Geprüft und **unangetastet**: `docs/architecture.md` (Zeile 15, 97, 145 nennen Links nur strukturell), `docs/quickstart.md`, `skills/using-signalize/references/patterns.md`. Kippt einer dieser Funde beim Schreiben, gehört die Abweichung in den Report statt in eine stille Zusatzänderung.
  7. **`CHANGELOG.md`, ausschließlich unter `## Unreleased`.** Released Abschnitte (`## v0.x.y`) bleiben unangetastet. **Kein Breaking Change, kein Bug Fix** — an der Bibliothek ändert sich kein Verhalten. **Keine Finding-IDs in den Zeilen**: `(MEM-007)` steht im selben `## Unreleased`-Block bereits aus dem vorigen Audit mit anderer Bedeutung (`CHANGELOG.md:15`, zu `Effect.destroy()`); der Bezug läuft über den Commit-Titel.
     - `### Documentation`, eine Zeile: die Lebenszeit eines Links ist jetzt dokumentiert — er wird gehalten, bis `destroy()`, `unlink()`, eine geleerte `{attach}`-Gruppe oder die Zerstörung von Quelle bzw. Signal-Ziel ihn abräumt; die Kommentare in `link.ts`/`SignalLink.ts`, die eine schwache Haltung versprachen, sagen jetzt, was der Code tut.
     - Der Refactor aus Schritt 3 ist verhaltensneutral und intern — nach der CHANGELOG-Disziplin in `CLAUDE.md` bekommt er **keine** Zeile. Der neue Test aus Schritt 4 ebenso wenig; wer ihn sucht, findet ihn über den Commit.
  8. **Abschluss.** `pnpm world` und `pnpm test:gc` müssen grün sein. In den Report gehören: die Testbilanz vor/nach (Stand Paket 4: `pnpm world` 365 passed / 7 skipped, `pnpm test:gc` 372 passed), die Bestätigung, dass die beiden neuen Tests aus Schritt 4 **vor und nach** dem Refactor aus Schritt 3 grün sind (das ist ihr ganzer Zweck — den roten Lauf gibt es hier nicht, die Verhaltensgleichheit schon), der tatsächliche Wortlaut der `AggregateError`-Meldung aus dem zweiten Test, und die Aussage, ob der Charakterisierungstest aus Schritt 5 über mindestens drei aufeinanderfolgende `pnpm test:gc`-Läufe stabil war. Wer beim Schreiben der Doku auf eine Stelle stößt, die eine schwache Haltung behauptet und oben nicht gelistet ist, nimmt sie mit und nennt sie im Report.

**MEM-007 · medium · src/link.ts:17-20,123** — `link()` hält jeden erzeugten Link an der Lebensdauer des Quellsignals fest

`gLinks` ist zwar eine `WeakMap`, ihr Wert ist aber eine gewöhnliche `Map`, die jeden Link stark hält. Solange das Quellsignal lebt, lebt jeder je auf ihm angelegte Link — inklusive Callback-Closure und Queue-Subscription. Der Kommentar in `SignalLink.ts` verspricht das Gegenteil. Der GC-Test greift nur, weil dort auch die Quelle fallengelassen wird. `link(src, cb)` mit je frischem Callback in einem heißen Pfad wächst damit unbegrenzt, und jeder Write auf `src` wird linear teurer.

Empfehlung: Entweder die Doku-Aussage auf das tatsächliche Verhalten korrigieren, oder die innere `Map` auf schwache Werte umstellen (WeakRef plus FinalizationRegistry, der Map-Eintrag und Queue-Subscription mit abräumt). — Der Nutzer hat zuerst den Umbau gewählt und die Entscheidung nach dem Prototyp-Messlauf auf die erste Hälfte revidiert (siehe »Entscheidungen«).

Belegt mit: `after 1000 orphan links: signalQ=1000 destroyQ=1000 links=1000` · `after gc: signalQ=1000 destroyQ=1000 links=1000` · `1000 writes auf das Quellsignal: 72,3 ms`

Abgearbeitet in Zug 0 von Paket 6 (2026-08-06): die beiden Review-Befunde zu `src/link.ts` (der zu weit greifende Quantor bei `:25-27`, die Zwei-statt-drei-Subscriptions bei `:63-65` und `:21-22`) → jetzt namentlich unter Paket 7 eingetragen; sie standen bisher nur hier als »gehen an Paket 7«. Nichts mehr offen aus diesem Stapel.

### [x] 6. SignalAutoMap.delete()
- Findings: MEM-009 (low) — behoben, Review abgenommen
- Hash: `39eadee` · Verify vom Orchestrator: `pnpm world` ✓ 374 passed / 8 skipped, `pnpm test:gc` ✓ 382 passed. Eine Review-Runde nötig: die begründete Reihenfolge in `delete()` hatte keinen Wächter — eine Mutante mit vertauschten Zeilen ließ alle 30 Tests grün.

#### Vom Review bestätigt (Mutanten-Proben)
- Ohne `signal.destroy()` bleiben `signals=3, effects=3, signalQ +3, destroyQ +3` stehen; im Original alles auf Baseline.
- Mit vertauschter Reihenfolge fällt jetzt **genau ein** Test, der neue, und aus dem richtigen Grund: der re-entrante `get()` bekommt beim Vertauschen das Leichenobjekt (`reentrantIsCorpse=true`), und der nachlaufende `#signals.delete(key)` räumt den frisch angelegten Eintrag wieder weg.
- Unbekannter Key legt nichts an, extern zerstörter Eintrag dekrementiert nicht doppelt, Symbol-Keys tragen, `updateFromProps()` unverändert.

#### Kleiner Review-Befund (nicht behoben)
- **`src/SignalAutoMap.spec.ts:432-433`** — `reentrant!.value = 42; expect(reentrant!.value).toBe(42);` steht unter der Behauptung »das Signal ist lebendig«, unterscheidet das aber nicht: ein zerstörtes Signal speichert Writes weiterhin und gibt sie zurück. Die Leichen-Abgrenzung leistet allein `assertSignalsCount(1)` zwei Zeilen darüber.

#### Nebenbefunde (nicht im Scope, Kandidaten fürs nächste Audit)
- **`src/SignalAutoMap.ts:60-65`** — `clear()` zerstört zuerst und trägt dann aus, also umgekehrt zu `delete()`. Dieselbe Re-Entrancy-Falle, nur ohne Wächter.
- **`src/createSignal.ts:174-177`** — `fromProps()` übernimmt ein als Prop-Wert übergebenes Signal per Identität; `clear()` zerstört damit fremdes Eigentum.
- **`src/Effect.ts`** — der öffentliche `Effect`-Wrapper hat keinen `destroyed`-Getter, obwohl `EffectImpl` einen führt. Tests müssen über `assertEffectsCount()` gehen.
- Ziel: Ein einzelner Key lässt sich zerstören und austragen, ohne die ganze Map zu leeren.
- Bereich: `src/SignalAutoMap.ts`, Doku-Kette
- Hängt ab von: —
- Modell: mittlere Stufe (final; der Code steht unten wörtlich, Signatur, Rückgabewert und Reihenfolge sind entschieden und ausgemessen. Was Urteil verlangt, ist die Prosa: `docs/recipes.md:553-554` und Pitfall 18 sagen heute das Gegenteil dessen, was nach diesem Paket gilt, und beide müssen umgeschrieben statt ergänzt werden.)
- Hash: —
- Dateien: `src/SignalAutoMap.ts`, `src/SignalAutoMap.spec.ts`, `docs/api.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`
- Verify: `pnpm world` (= CI: clean + biome check + tsc + rollup + vitest) und zusätzlich `pnpm test:gc`. **Nicht** `npx tsc --noEmit -p tsconfig.json`: diese Config meldet 6 vorbestehende Fehler in `node_modules` (`unplugin`/`webpack`-Typen), kein Script fährt sie. Während der Arbeit: `npx vitest run SignalAutoMap.spec.ts` (`pnpm test -- <datei>` filtert nicht — bekannte Eigenheit, das Script endet auf `vitest run --coverage`).
- Commit: `feat(auto-map): destroy and evict a single key with delete() (MEM-009)`
- Abgleich (2026-08-06, Zug 0): **MEM-009 unverändert, Fundstelle zeilengenau, und die Evidenz reproduziert Wort für Wort.** `src/SignalAutoMap.ts` hat seit dem Audit keinen Commit gesehen — der letzte ist `3d1c3fb` aus dem Vorlauf, die fünf Commits dieses Laufs fassen `SignalGroup.ts`, `EffectImpl.ts`, `createMemo.ts`, `link.ts`/`SignalLink.ts`, `collect-errors.ts` und Specs an. Die Audit-Location `:34` zeigt heute auf `#signals = new Map<SignalAutoMapKeyType, Signal<any>>()`, unverändert. Öffentliche Oberfläche gegen den `lib/`-Build von `459a140` ausgelesen: `clear, constructor, entries, get, has, keys, signals, update, updateFromProps` plus die statische `fromProps` — identisch zur Evidenz-Zeile des Findings, kein `delete`, kein `remove`. `clear()` (`src/SignalAutoMap.ts:60-65`) ruft `sig.destroy()` über alle Werte und danach `#signals.clear()`.

  Alle Zahlen gegen den `lib/`-Build von `459a140`:
  - **Der heutige Ersatz für `delete(key)` ist ein halber Weg.** `destroySignal(map.get('a'))` bei drei Keys: `signals 3 → 2`, aber `map.has('a') === true`, `map.get('a') === sa` (dieselbe Leiche), `keys` weiterhin `a,b,c`, `[...signals()].length === 3`. Volumenprobe: 1000 Keys extern zerstört → `signals=0`, die Map hält 1000 tote Einträge. Genau das nagelt `src/SignalAutoMap.spec.ts:339-384` heute als gewolltes Verhalten fest, und `docs/recipes.md:553-554` schließt daraus »Always `clear()` … instead of destroying entries individually«. Ohne `delete()` gibt es zu diesem Rat keine Alternative — das ist das Finding.
  - **`destroySignal()` ist idempotent** (`src/signal-core.ts:81`, Guard `!signal.destroyed`): dreimal zerstören zieht den Zähler genau einmal. Ein `clear()` über eine Map mit einem bereits toten Eintrag bleibt bei `signals=0`. `delete()` auf einer Leiche kann deshalb ohne Sonderbehandlung zerstören.
  - **Paket 1 und Paket 4 ändern hier nichts.** `SignalAutoMap` legt seine Signale mit `createSignal(value)` **ohne** `{attach}` an (`src/SignalAutoMap.ts:29`, `:83`) — sie hängen an keiner Gruppe, der Destroy-Hook aus `#addSignal()` (Paket 1) hat nichts zu tun. Gegenprobe mit einem von Hand attachten Map-Signal: `group.memberCounts.signals 1 → 0` beim `destroy()`, während `map.has('g1')` **true** bleibt. Paket 1 trägt das Signal also aus der Gruppe aus, aus der Map trägt es niemand aus — der Befund steht unverändert, und `delete()` braucht dafür keine eigene Gruppen-Logik: es zerstört, der Hook aus Paket 1 räumt die Gruppenseite ab. Paket 4 betrifft `createMemo()` und berührt diese Klasse nicht.
  - **Reihenfolge im Rumpf, gemessen an einem Replikat mit beiden Varianten.** Szenario: ein Effect liest `map.get('a')`, sein Cleanup greift re-entrant auf `map.get('a')` zu (der Cleanup läuft synchron, weil das Zerstören des einzigen Deps den Effect mitnimmt — Probe: `effects 1 → 0` innerhalb des `destroy()`-Aufrufs).
    ```
    Eintrag zuerst raus, dann zerstören : signals=1 effects=0 | map.size=1 | re-entrant get() liefert ein LEBENDES Signal
    zuerst zerstören, dann Eintrag raus : signals=0 effects=0 | map.size=0 | re-entrant get() liefert die LEICHE
    ```
    Die zweite Variante reicht dem Cleanup genau das Objekt heraus, vor dem Pitfall 18 warnt, und löscht anschließend, was der re-entrante Aufruf hinterlegt hat. **Deshalb gilt: erst den Eintrag entfernen, dann zerstören.** Dieselbe Reihenfolge fährt `SignalGroup` seit Paket 1 (Handle lösen, dann `#signals.delete(si)`).
  - **Leak-Zähler über 1000 Runden**, Replikat mit der gewählten Reihenfolge: `1000 keys + 1000 effects → signals=1000 effects=1000 signalQ=1000 destroyQ=1000`, nach 1000× `delete()` → `signals=0 effects=0 signalQ=0 destroyQ=0`, `map.size=0`. Das sind die Zahlen für den Leak-Test in Schritt 3.

- Vorgehen:
  1. **Die Methode, in `src/SignalAutoMap.ts`, direkt hinter `clear()` (heute Zeile 65) und vor dem JSDoc von `has()`.** Die beiden Abbau-Methoden stehen damit beieinander. Kein neuer Import — `signal.destroy()` ist derselbe Weg, den `clear()` bei `src/SignalAutoMap.ts:62` schon geht.
     ```ts
     /**
      * Destroy the signal stored under `key` and remove its entry.
      *
      * The signal is destroyed, not merely evicted: every effect reading it is
      * notified, and an effect left without a single live dependency destroys
      * itself. Whoever still holds the `Signal` object holds a corpse — reads
      * return the last value, writes notify nobody (see `clear()` and the note
      * on externally destroyed entries).
      *
      * Deleting an unknown key is a no-op. Deleting an entry whose signal was
      * already destroyed from the outside still removes the entry and reports
      * `true`; destroying a destroyed signal is a no-op.
      *
      * @param key - The key to remove
      * @returns `true` if the key was in the map, `false` otherwise — the same
      *   contract as `Map.prototype.delete`
      */
     delete(key: SignalAutoMapKeyType): boolean {
       const signal = this.#signals.get(key);
       if (signal === undefined) return false;
       // Drop the entry *before* destroying it. The destroy emit runs effect
       // cleanups, and one of those may call get(key) again: with the entry
       // already gone that call hands out a fresh, live signal which stays in
       // the map. The other order hands out the corpse and then deletes
       // whatever the re-entrant call had just stored.
       this.#signals.delete(key);
       signal.destroy();
       return true;
     }
     ```
     Vier Festlegungen, jede mit ihrer Begründung, weil sie öffentliche Oberfläche werden:
     - **Rückgabewert `boolean`, nicht das zerstörte Signal.** Der Klassen-JSDoc nennt sie »A Map-like container« (`src/SignalAutoMap.ts:8`), und `has`/`keys`/`entries`/`clear` spiegeln alle die `Map`-Oberfläche; `Map.prototype.delete` liefert `boolean`. Das zerstörte Signal zurückzugeben hieße, ein Objekt herauszureichen, dessen einzige verbliebene legale Nutzung das Lesen von `.value` ist — genau das Muster, vor dem Pitfall 18 warnt. Wer das Signal noch braucht, holt es sich mit `get(key)` **vor** dem `delete()`. `clear()` gibt ebenfalls nichts zurück; es gibt in dieser Klasse keinen Präzedenzfall für das Herausreichen von Signalen aus einer Abbau-Methode.
     - **`true` heißt »der Key war in der Map«, nicht »ein lebendes Signal wurde zerstört«.** Ein Eintrag, dessen Signal von außen bereits zerstört wurde, liefert `true` und verschwindet; `getSignalsCount()` bewegt sich dabei nicht. Die Alternative (`false` für Leichen) würde `delete()` von `Map.prototype.delete` abkoppeln und dem Aufrufer eine Unterscheidung aufdrängen, die er nicht treffen kann — `Signal` hat nicht einmal einen `destroyed`-Getter.
     - **Unbekannter Key: `false`, keine Nebenwirkung, kein Wurf.** Kein Anlegen eines Signals — `delete()` ist die einzige Methode neben `has()`, die einen Key **nicht** auto-erzeugt, und das ist der Sinn der Sache.
     - **`get()` statt `has()` plus `get()`**: ein Lookup statt zweien. Die Map speichert ausschließlich `Signal`-Objekte, `undefined` als Wert kann nicht vorkommen, der Vergleich ist eindeutig.
  2. **Kein Anfassen von `updateFromProps()`.** Die Entscheidungszeile zu MEM-009 ist bindend: das optionale Abräumen fehlender Keys bleibt draußen, weil es Signale zerstören würde, die Aufrufer noch halten. Wer beim Schreiben in Versuchung gerät, liest sie noch einmal. Ebenso bleibt `clear()` unverändert — auch seine Reihenfolge (siehe Nebenbefunde).
  3. **Tests, in `src/SignalAutoMap.spec.ts`**, als neuer `describe('delete()')`-Block **hinter** `describe('externally destroyed signals')` (endet heute bei Zeile 384) und vor der schließenden Klammer des äußeren `describe`. Ein neuer öffentlicher Weg ist kein Bugfix: für die Methode selbst gibt es keinen »erst rot sehen«-Zwang — sie existiert vorher nicht, jeder Test wäre ein Compile-Fehler. Jede **Zusage über ihr Aufräumverhalten** braucht trotzdem ihren Test, und der Leak-Test aus dem letzten Punkt ist der, der die Zusage trägt.
     Die Datei hat `assertEffectsCount`, `assertSignalsCount`, `assertLinksCount`, `createEffect`, `SignalAutoMap`, `destroySignal` und `isSignal` bereits importiert; `beforeEach`/`afterEach` prüfen 0/0/0, absolute Zählerwerte sind in dieser Datei also aussagekräftig. Neu dazu kommen für den Leak-Test — Konvention aus `src/EffectImpl.destroy.spec.ts:1-21`:
     ```ts
     import {getSubscriptionCount} from '@spearwolf/eventize';
     import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
     ```
     `getSubscriptionCount` nimmt **genau ein** Argument; die Zwei-Argument-Form in `CLAUDE.md:45` gibt es nicht (Paket 7 korrigiert die Zeile).
     Sechs Tests:
     - `'delete() destroys the signal and removes the entry'` — `fromProps({a: 1, b: 2, c: 3})`, `assertSignalsCount(3)`, dann `expect(sm.delete('a')).toBe(true)`, `assertSignalsCount(2)`, `expect(sm.has('a')).toBe(false)`, `[...sm.keys()]` ist `['b','c']`. Abschluss `sm.clear()`.
     - `'delete() on an unknown key returns false and creates nothing'` — leere Map, `expect(sm.delete('nope')).toBe(false)`, `assertSignalsCount(0)`, `[...sm.keys()].length === 0`. Der Punkt ist das Nicht-Erzeugen: `get()` würde hier ein Signal anlegen.
     - `'get() after delete() creates a fresh signal'` — `const first = sm.get('a')`, `sm.delete('a')`, `const second = sm.get('a')`, `expect(second).not.toBe(first)`, `expect(isSignal(second.get)).toBe(true)`, `expect(second.value).toBeUndefined()`, `assertSignalsCount(1)`. Das ist die Abgrenzung zu `src/SignalAutoMap.spec.ts:345-358`, wo `get()` nach externer Zerstörung dieselbe Leiche liefert.
     - `'delete() on an entry destroyed from the outside still removes it'` — `const sig = sm.get('a')`, `destroySignal(sig)`, `assertSignalsCount(0)`, dann `expect(sm.delete('a')).toBe(true)`, `assertSignalsCount(0)` (kein zweites Dekrement), `expect(sm.has('a')).toBe(false)`.
     - `'delete() works with symbol keys'` — Aufbau wie `src/SignalAutoMap.spec.ts:307-323`: ein String- und ein Symbol-Key, `sm.delete(symKey)` liefert `true`, `sm.has(symKey)` `false`, der String-Key überlebt.
     - **Der Leak-Test**, Muster aus `CLAUDE.md` → »Verifying subscription leaks«. Zähler schnappschießen, Szenario, `delete()`, Zähler zurück auf Baseline:
       ```ts
       it('delete() leaves nothing behind — signals, effects and subscriptions (MEM-009)', () => {
         const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
         const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

         const sm = new SignalAutoMap();
         const keys = ['a', 'b', 'c'];
         let runs = 0;

         for (const key of keys) {
           sm.get(key).set(key);
           // Not attached to anything: the map entry is the only owner.
           createEffect(() => {
             runs += 1;
             sm.get(key).get();
           });
         }

         expect(runs).toBe(3);
         assertSignalsCount(3, 'three entries');
         assertEffectsCount(3, 'one effect per entry');

         for (const key of keys) {
           expect(sm.delete(key)).toBe(true);
         }

         expect([...sm.keys()].length).toBe(0);
         assertSignalsCount(0, 'after delete()');
         assertEffectsCount(
           0,
           'an effect without a single live dependency destroys itself',
         );
         expect(runs, 'destroying a dependency does not re-run the effect').toBe(3);
         expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
         expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
           destroySubscriptions,
         );
       });
       ```
       Die Zahlen sind gegen ein Replikat mit der Reihenfolge aus Schritt 1 gemessen (dort über 1000 Runden: alle vier Zähler zurück auf 0, `map.size=0`). Dass die Effects mitsterben, ist keine Erfindung dieses Pakets, sondern der Pfad, den Paket 2 (MEM-006) geradegezogen hat — der Test hält ihn für `delete()` fest.
     Das `afterEach` der Datei deckt den Abschluss ab; kein Test darf einen Eintrag stehen lassen.
  4. **Doku-Kette, Reihenfolge nach `CLAUDE.md` → »When the public API changes«.** Die Zusage in einem Satz, überall gleich: **`delete(key)` zerstört das Signal dieses Keys und entfernt den Eintrag; `true`, wenn der Key drin war.** Damit fällt die bisherige Auskunft »einzelne Einträge kann man nicht loswerden« — sie steht an zwei Stellen und wird umgeschrieben, nicht ergänzt.
     - **Quell-JSDoc** — steht in Schritt 1. Zusätzlich: der Klassen-JSDoc (`src/SignalAutoMap.ts:7-12`) bleibt inhaltlich richtig und wird nicht angefasst.
     - **`docs/api.md:474`** — in der Methoden-Tabelle eine Zeile **unter** `clear()` einfügen: `` `delete(key): boolean` `` → »Destroy the signal for `key` and drop the entry. `true` if the key was present.« Spaltenbreite der Tabelle beibehalten (Biome formatiert Markdown nicht, die Ausrichtung ist Handarbeit).
     - **`docs/api.md:476-478`** — der Blockquote zur externen Zerstörung bleibt sachlich richtig und bekommt einen Schlusssatz: `delete(key)` ist der Weg, einen Eintrag ganz loszuwerden; extern zerstörte Einträge räumt es ebenfalls ab.
     - **`docs/recipes.md:541-554`** — die inhaltlich schwerste Stelle. Das Codebeispiel (`543-551`) bleibt unverändert: es beschreibt weiterhin korrekt, was bei externer Zerstörung passiert. Der Schlussabsatz `553-554` (»Always `clear()` the map (or attach all signals to a `SignalGroup`) instead of destroying entries individually.«) wird **ersetzt**: einzelne Einträge räumt `map.delete('foo')` ab — es zerstört das Signal und entfernt den Eintrag in einem Zug, im Gegensatz zu einem `destroySignal()` von außen, das die Leiche im Cache stehen lässt. `clear()` bleibt der Weg für alles auf einmal. Zwei Zeilen Code dazu (`map.delete('foo'); // true — Signal zerstört, Eintrag weg`), damit die Sektion zeigt statt zu behaupten. Und der Satz, den der Leak-Test belegt: ein Effect, dessen einzige Abhängigkeit der gelöschte Eintrag war, zerstört sich dabei selbst.
     - **`docs/cheat-sheet.md:154`** — vor `m.clear();` eine Zeile: `m.delete('k'); // destroy that signal + drop the entry → boolean`. Eine Zeile, der Block ist eine Liste, keine Prosa.
     - **`skills/using-signalize/references/api.md:233`** — dieselbe Zeile, wortgleich zur Cheat-Sheet-Zeile, vor `m.clear();`.
     - **`skills/using-signalize/references/pitfalls.md:78`** — Pitfall **18**. Nummer bleibt (sie wird aus `SKILL.md` referenziert, und Paket 5 fasst 17 an, Paket 7 fasst 16/16a an — drei verschiedene Nummern, keine Kollision). Die Beobachtung bleibt richtig: `destroySignal()` auf einem Eintrag lässt ihn in der Map stehen. Der Rat kippt: statt »Prefer `map.clear()`, or attach the signals to a `SignalGroup`« heißt es ab jetzt, dass `map.delete(key)` der richtige Weg für einen einzelnen Eintrag ist und `clear()` der für alle; `destroySignal()` von außen ist der einzige Weg, der die Leiche im Cache hinterlässt.
     - Geprüft und **unangetastet**: `README.md:126` (die »API at a glance« nennt nur den Klassennamen in der Export-Liste, keine Methoden — hier ist nichts zu ergänzen, und eine Methodenliste einzuführen wäre eine Formatänderung, die `delete()` nicht rechtfertigt), `skills/using-signalize/SKILL.md` (`SignalAutoMap` steht dort nur in der Frontmatter-Description; die »Six behaviours« und der Cleanup-Abschnitt erwähnen die Klasse nicht), `docs/architecture.md:147`, `AGENTS.md:121,150,152`, `CONTRIBUTING.md:59` (alle nur Datei- bzw. Export-Landkarten), `docs/quickstart.md` (kein Treffer). Kippt einer dieser Funde beim Schreiben, gehört die Abweichung in den Report statt in eine stille Zusatzänderung.
  5. **`CHANGELOG.md`, ausschließlich unter `## Unreleased` → `### Features`** (der Abschnitt beginnt bei `CHANGELOG.md:5`, die neue Zeile kommt hinter die bestehende letzte bei `CHANGELOG.md:8`). Released Abschnitte (`## v0.x.y`) bleiben unangetastet. Eine Zeile, ein Fakt: `SignalAutoMap#delete(key)` zerstört das Signal dieses Keys und entfernt den Eintrag, liefert `true`, wenn der Key in der Map war — bislang gab es nur `clear()` für alles auf einmal, und ein `destroySignal()` von außen ließ den toten Eintrag im Cache stehen. **Keine Finding-ID in der Zeile**: `(MEM-009)` kommt in `CHANGELOG.md` zwar nirgends vor, aber derselbe `## Unreleased`-Block trägt `(MEM-001)` bis `(MEM-007)` bereits aus dem **vorigen** Audit mit anderer Bedeutung; eine `(MEM-009)` daneben würde auf die falsche Quelle zeigen. Der Bezug läuft, wie in allen Paketen dieses Laufs, über den Commit-Titel.
  6. **Abschluss.** `pnpm world` und `pnpm test:gc` müssen grün sein. In den Report gehören: die Testbilanz vor/nach (Stand Paket 5: `pnpm world` 367 passed / 8 skipped, `pnpm test:gc` 375 passed), die tatsächlich gemessenen Zähler aus dem Leak-Test, falls sie von den oben eingetragenen abweichen, und die Bestätigung, dass `src/SignalAutoMap.spec.ts:339-384` (die Charakterisierung der extern zerstörten Einträge) unverändert grün bleibt — dieser Block beschreibt weiterhin gültiges Verhalten und darf von `delete()` nicht angefasst werden.

**MEM-009 · low · src/SignalAutoMap.ts:34** — SignalAutoMap ohne Einzel-Eviction

Die Klasse legt in `get()`, `update()` und `updateFromProps()` für jeden unbekannten Key automatisch ein Signal an, bietet aber keine Möglichkeit, einen einzelnen Key wieder loszuwerden — nur `clear()`, das alles zerstört. Genau der beworbene Anwendungsfall (»dynamic scenarios where signal keys are not known ahead of time«) ist damit ein Cache ohne Eviction.

Empfehlung: Eine `delete(key)`-Methode ergänzen, die das Signal zerstört und den Eintrag entfernt; optional in `updateFromProps()` fehlende Keys abräumen. — Der Nutzer hat nur die `delete(key)`-Hälfte gewählt (siehe »Entscheidungen«).

Belegt mit: Öffentliche Oberfläche: `fromProps, keys, signals, entries, clear, has, get, update, updateFromProps` · `grep -n "delete|remove" src/SignalAutoMap.ts` → kein Treffer

#### Nebenbefunde (Eingabestapel für Zug 0 des nächsten Pakets)
- **`src/SignalAutoMap.ts:60-65`** — `clear()` zerstört zuerst und leert die Map danach, also genau umgekehrt zu der Reihenfolge, die für `delete()` ausgemessen wurde. Folge, gemessen: greift ein Effect-Cleanup während des Abbaus re-entrant auf `get(key)` zu, bekommt er die Leiche statt eines frischen Signals. Ein Leck entsteht nicht (die `Map`-Iteration besucht auch während des Laufs eingefügte Einträge, und `#signals.clear()` wischt am Ende alles), die Asymmetrie bleibt trotzdem. Ausdrücklich **nicht** Teil dieses Pakets: die Entscheidungszeile zu MEM-009 sagt »nur `delete(key)`«, und eine Verhaltensänderung an `clear()` wäre etwas anderes.
- **`src/SignalAutoMap.ts:29`** — `fromProps()` ruft `createSignal(value)`, und `createSignal()` gibt ein übergebenes Signal unverändert zurück (`src/createSignal.ts:174-177`). Ist ein Prop-Wert selbst ein Signal, übernimmt die Map es, ohne es zu kopieren — gemessen: `map.get('p') === foreign`, `getSignalsCount()` steigt nicht. `clear()` zerstört dieses fremde Signal heute schon mit, `delete(key)` wird es genauso tun. Kein neuer Sachverhalt, aber unbeschrieben.
- **`src/Signal.ts:14-59`** — die `Signal`-Klasse hat keinen `destroyed`-Getter; `ISignalImpl` hat einen (`src/createSignal.ts:78`). Ein Aufrufer kann ein Signal-Objekt also nicht fragen, ob es noch lebt — die Auskunft »reads return the last value« aus `docs/api.md:476-478` ist damit von außen nicht nachprüfbar. Fällt in die Kategorie `API-*`, nicht `MEM-*`, und damit außerhalb des Scopes dieses Laufs.

Abgearbeitet in Zug 0 von Paket 8 (2026-08-07): alle drei Nebenbefunde → **nächstes Audit**; kein offenes Paket fasst `src/SignalAutoMap.ts` oder `src/Signal.ts` noch einmal an (Paket 7 ist Prosa, Paket 8 ist `SignalGroup`), und alle drei sind Verhaltens- bzw. API-Fragen, keine Doku. Der `clear()`-Punkt bekommt fürs nächste Audit einen Zusatz: dieselbe Methode sammelt auch **keine Fehler** — ein werfendes `sig.destroy()` bricht den Rest des `clear()` ab, dieselbe Familie wie MEM-001 und wie Paket 8, nur in einer anderen Klasse. Der Kleine Review-Befund `src/SignalAutoMap.spec.ts:432-433` → **Paket 7**, mit der Auflage, die Assertionen nicht anzufassen. Nichts mehr offen aus diesem Stapel.

### [x] 7. Doku: Blocker der automatischen Gruppen-Bereinigung vollständig benennen
- Erledigt · Hash: `b23c22f` · Verify vom Orchestrator: `pnpm world` Exit 0, 377 passed / 9 skipped; `pnpm test:gc` Exit 0, 386 passed. Drei Nachbesserungsrunden — das Muster war jedes Mal dasselbe: eine korrigierte Aussage hatte Zwillinge außerhalb der Fundstellenliste.
  - Runde 1: die `onEffectError`-Zusage überlebte an vier weiteren Stellen, das `off()`-JSDoc in `src/SignalGroup.ts` trug die MEM-008-Ausnahme nicht, und `CONTRIBUTING.md` war die dritte Kopie der CI-Behauptung.
  - Runde 2 (frischer Implementierer, höhere Stufe): fünfter Zwilling in `src/types.ts` — in der **ausgelieferten** Typfläche, dem Tooltip auf `payload.phase` — und eine vierte in `README.md`, die im Umkehrschluss behauptete, ein grünes `pnpm world` könne CI nicht mehr reißen.
  - Runde 3: zwei Allaussagen, die dieser Lauf selbst geschrieben hatte, waren für einen dritten Pfad falsch (`src/EffectImpl.ts:479`, aufgeschobener Selbst-Destroy). Der Reviewer hat gegengezählt: `emitEffectError` hat fünf Aufrufstellen, drei davon mit synchronem Wurf — genau die drei, die jetzt genannt werden.
- In `src/` wurden ausschließlich Kommentare und JSDoc geändert; der einzige Nicht-Kommentar-Hunk ist die geplante `.map()`→`for…of`-Kosmetik in einer Spec.

#### Detailplan (Zug 0)
- Findings: MEM-010 (low)
- Ziel: Alle vier unvollständigen Stellen nennen die allgemeine Bedingung — jeder starke Pfad zurück zum Host — statt nur den Signalwert, und dieselben Absätze nennen das neue Fehlerverhalten aus Paket 9. Dazu läuft die gesamte Prosa-Nachlese des Laufs durch: neun `Mitgenommen`-Einträge plus die Inkonsistenzen, die der Endstand-Sweep in Zug 0 gefunden hat.
- Bereich: MEM-010 selbst in `docs/api.md`, `docs/architecture.md`, `skills/using-signalize/references/pitfalls.md`, `CHANGELOG.md`; dazu die mitgenommenen Textstellen in `docs/quickstart.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `.github/workflows/ci.yml`, `skills/using-signalize/SKILL.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/patterns.md` und die Kommentar-Korrekturen in `src/link.ts`, `src/EffectImpl.ts`, `src/effects.spec.ts`, `src/effects.async.spec.ts`, `src/SignalAutoMap.spec.ts`, `src/SignalGroup.teardown.spec.ts` — alles Prosa, kein Verhalten. Die Liste ist die Vereinigung der `Mitgenommen`-Einträge unten; maßgeblich sind die Fundstellen im `Abgleich`, nicht diese Aufzählung.
- Hängt ab von: alle vorherigen Pakete, **einschließlich Paket 9** (Doku zuletzt, damit sie den Endstand beschreibt — Paket 9 ändert das Fehlerverhalten der automatischen Bereinigung, die dieses Paket beschreibt)
- Modell: mittlere Stufe (final). Kein Produktivcode, keine Assertion, kein Test — aber 26 Fundstellen in 17 Dateien, und bei einem Doku-Paket ist die Formulierung die Arbeit. Der Plan gibt jede Textstelle im Wortlaut vor, die Zeilennummern sind gegen `53994f0` frisch verifiziert. Was bleibt, ist sorgfältiges Einsetzen plus das Urteil, den englischen Ton der jeweiligen Datei zu treffen. Die günstigste Stufe würde an der Menge der Fundstellen scheitern, die stärkste wäre verschwendet: das Denken steht unten.
- Hash: —
- Mitgenommen (Nebenbefund aus Paket 2, 2026-08-06): `CLAUDE.md:45` behauptet eine Signatur `getSubscriptionCount(queue, event?)`, die es nicht gibt — die Funktion aus `@spearwolf/eventize` nimmt genau ein Argument (`node_modules/@spearwolf/eventize/lib/index.d.ts:708`); die Pro-Event-Sicht liefert `getSubscribedEventNames(queue)`. Hierher, weil dies das Doku-Paket ist und zuletzt läuft, und weil die Zeile ausgerechnet die Anleitung zum Prüfen von Subscription-Leaks ist, nach der jedes Paket dieses Laufs seine Tests schreibt. Eine Zeile, kein Code.
- Mitgenommen (Kleine Review-Befunde aus Paket 3, eingetragen in Zug 0 von Paket 4, 2026-08-06): fünf Prosa-Korrekturen, die der MEM-004-Fix hinterlassen hat und die dort schon als »gehen an Paket 7« vermerkt sind — bislang ohne Gegenstück in diesem Paket. Alle fünf sind Text, kein Verhalten; Details und Begründung stehen im Abschnitt zu Paket 3.
  - `CHANGELOG.md:75` — die umgeschriebene Breaking-Changes-Zeile behauptet über den v0.31.1-Stand etwas Falsches (der sequenzielle Pfad verlor nichts; der einzige Überschreib-Fall war Re-Entrancy, und dort überschreibt der ältere äußere Run den neueren inneren). Steht unter `## Unreleased`, darf also korrigiert werden.
  - `docs/api.md:180-183` — »Only failures that surface *after* the synchronous call stack is gone arrive here« und die `phase`-Zeile sind seit dem Fix falsch; der synchrone Wurf eines verwaisten Cleanups landet bei vollem Stack bei `onEffectError`.
  - `src/effects.spec.ts:69-70` — Kommentar trägt die zurückgenommene Zusage weiter.
  - `src/EffectImpl.ts:677-678` — neuer JSDoc-Satz halb tautologisch, sagt »räumt hinter dem Cleanup auf« statt »führt ihn aus«.
  - `src/effects.async.spec.ts:376-379` — Schlusskommentar grammatisch entgleist und sachlich schief.
- Mitgenommen (Nebenbefund aus Paket 4, eingetragen in Zug 0 von Paket 5, 2026-08-06): vier Doku-Stellen zeigen das Klassenfeld-Muster `class Foo { m = createMemo(…, {attach: this, name: 'm'}) }` ohne Vorbehalt — `docs/quickstart.md:60`, `README.md:259`, `docs/cheat-sheet.md:184`, `skills/using-signalize/references/patterns.md:58`. Entsteht das Objekt im Rumpf eines Effects, *ist* der Konstruktorlauf ein Effect-Rumpf, und nach dem MEM-008-Fix aus Paket 4 stirbt das Memo-Signal mit dem Parent-Rerun (gemessen: Gruppe des alten `foo` behielt vorher ihr Signal, danach ist sie leer). Kein Fehler im Code — die Annahme, die das Nicht-Anfassen dieser Stellen in Paket 4 rechtfertigte, trägt nur nicht. Ein Halbsatz pro Stelle, kein Verhalten.
- Mitgenommen (Kleine Review-Befunde aus Paket 5, eingetragen in Zug 0 von Paket 6, 2026-08-06): zwei Quantoren-Fehler in den frisch geschriebenen Kommentaren von `src/link.ts`. Beide sind Text, kein Verhalten; Messungen und Details stehen im Abschnitt zu Paket 5.
  - `src/link.ts:25-27` — »Explicitly destroying the source (or a signal target) tears every link on it down the same way, fully« greift beim Signal-Ziel zu weit: mit drei Links auf einer Quelle bringt `destroySignal(t1)` nur `links 3 → 2`; erst `destroySignal(source)` räumt alle drei ab. Die Parallelstellen (`src/link.ts:235-236`, `docs/api.md:308-309`) formulieren es ohne Quantor und sind korrekt — an ihnen entlangschreiben.
  - `src/link.ts:63-65` und `:21-22` — »Both of the link's subscriptions« trifft nur den Callback-Fall. Ein `SignalLinkToSignal` hat drei (eine auf `globalSignalQueue`, zwei auf `globalDestroySignalQueue` für Quelle und Ziel). Die zitierte 200/200-Messung stammt aus dem Callback-Szenario; für Signal-Ziele stünde 200/400.
- Mitgenommen (Nebenbefund aus Paket 1, 2026-08-06): `docs/api.md:412-424` beschreibt weder das gesammelte Fehlerverhalten von `clear()`/`off()` (`AggregateError` in Teardown-Reihenfolge) noch die benutzersichtbare Folge des Destroy-Hooks — ein hart zerstörtes, namensgebundenes Signal verliert seinen Namen, `hasSignal(name)`/`signal(name)` liefern danach `undefined`. Vorbild ist der bestehende Absatz zu `Effect.destroy()` bei `docs/api.md:141-152`. Paket 8 legt dieselbe Zusage für das statische `SignalGroup.clear()` nach; deshalb hierher und nicht früher.
  **Abgrenzung nach Zug 0 von Paket 8 (2026-08-07):** gemeint ist der **Instanz**-Block der Sektion — die Tabelle bei `docs/api.md:433-445` und der Fließtext darunter. Den statischen Block (Tabelle `413-420` plus einen neuen Satz dahinter) schreibt Paket 8 selbst; dort ist nichts nachzuholen. Die Zeilennummern wandern durch Paket 8, also über den Inhalt suchen.
- Mitgenommen (Kleiner Review-Befund aus Paket 6, eingetragen in Zug 0 von Paket 8, 2026-08-07): **`src/SignalAutoMap.spec.ts:432-433`** — `reentrant!.value = 42; expect(reentrant!.value).toBe(42);` steht unter der Behauptung, das Signal sei lebendig, unterscheidet das aber nicht: ein zerstörtes Signal speichert Writes weiterhin und gibt sie zurück. Die Leichen-Abgrenzung leistet allein `assertSignalsCount(1)` zwei Zeilen darüber. Hierher, weil dieses Paket schon zwei Spec-Dateien nur wegen ihrer Kommentare aufmacht. **Auflage: die Assertionen bleiben unangetastet** — korrigiert wird ausschließlich der Anspruch, den der Kommentar erhebt.
- Mitgenommen (aus Zug 0 von Paket 9, 2026-08-07): **die Doku-Kette zur automatischen Bereinigung nennt das neue Fehlerverhalten nicht.** Paket 9 legt den `clear()`-Aufruf im FinalizationRegistry-Callback in ein `try/catch` und meldet über `console.error`; bis dahin beendete ein werfender Teardown dort den Prozess. Sieben Stellen beschreiben den Backstop und schweigen dazu: `docs/api.md:425-431` (der FR-Absatz hinter der statischen Tabelle — **nicht** der Instanz-Block, der weiter unten dransteht), `docs/architecture.md:110-118` (»Automatic cleanup via `FinalizationRegistry`«), `skills/using-signalize/references/pitfalls.md:70-74` (Pitfall 16a, die »Three limits«-Liste), `skills/using-signalize/SKILL.md:22,56`, `skills/using-signalize/references/api.md:218`, `docs/recipes.md:380-381`, `README.md:283-284`. Hierher, weil MEM-010 exakt diese Absätze umschreibt und Paket 7 nach Paket 9 läuft — zwei Pakete im selben Absatz sind das, was dieser Plan seit Paket 5 vermeidet. **Nicht alle sieben brauchen den Satz:** die drei ausführlichen (`docs/api.md`, `docs/architecture.md`, Pitfall 16a) tragen ihn, die vier Kurzformen nennen den Backstop in einem Halbsatz und führen auch sonst kein Fehlerverhalten. Die Zeilennummern wandern durch Paket 9 nicht, wohl aber durch Paket 7 selbst — der Reihenfolge innerhalb des Pakets folgen.
- Mitgenommen (Kleiner Review-Befund aus Paket 8, eingetragen in Zug 0 von Paket 9, 2026-08-07): **`src/SignalGroup.teardown.spec.ts:378`** — `[0, 1, 2].map(…)` mit ungenutztem Rückgabewert, ein `.map()` als `forEach`. Eine Zeile Testkosmetik ohne Assertionsbezug; hierher, weil dieses Paket mit `src/effects.spec.ts`, `src/effects.async.spec.ts` und `src/SignalAutoMap.spec.ts` ohnehin drei Spec-Dateien nur wegen ihrer Textstellen aufmacht. **Auflage: die Assertionen bleiben unangetastet.** Die Zeilennummer verschiebt sich durch den neuen Test aus Paket 9, der ans Ende derselben Datei kommt — über den Inhalt suchen.
- Mitgenommen (aus Zug 0 von Paket 8, 2026-08-07): **`CHANGELOG.md:52`** beginnt mit »`SignalGroup.clear()` and `SignalGroup.off()`« und meint die **Instanz**methoden. In der Notation dieses Projekts (`docs/api.md` führt `SignalGroup.clear()` als statisch und `clear()` als Instanzmethode) liest sich der Punkt als statischer Aufruf — und Paket 8 legt in denselben `## Unreleased`-Block eine Zeile über den tatsächlich statischen Sweep. Ein Wort genügt zur Trennung. Die Zeile steht unter `## Unreleased` und darf korrigiert werden; sie wandert durch die neuen Zeilen aus Paket 6 und 8 nach unten, also **über den Inhalt suchen, nicht über die Zeilennummer**.
- Dateien: `docs/api.md`, `docs/architecture.md`, `docs/quickstart.md`, `docs/recipes.md`, `docs/cheat-sheet.md`, `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`, `.github/workflows/ci.yml`, `skills/using-signalize/SKILL.md`, `skills/using-signalize/references/api.md`, `skills/using-signalize/references/pitfalls.md`, `skills/using-signalize/references/patterns.md`, `src/link.ts`, `src/EffectImpl.ts`, `src/effects.spec.ts`, `src/effects.async.spec.ts`, `src/SignalAutoMap.spec.ts`, `src/SignalGroup.teardown.spec.ts`
- Verify: `pnpm world` (= clean + biome check + tsc + rollup + vitest) und zusätzlich `pnpm test:gc`. **Nicht** `npx tsc --noEmit -p tsconfig.json`: diese Config meldet 6 vorbestehende Fehler in `node_modules` (`unplugin`/`webpack`-Typen), kein Script fährt sie. Erwartung: **beide Läufe unverändert gegenüber Paket 9** — `pnpm world` 377 passed / 9 skipped, `pnpm test:gc` 386 passed. Jede Abweichung ist ein Fehler dieses Pakets, denn es ändert an Code nichts als Kommentare. Während der Arbeit reicht `npx vitest run` für die vier angefassten Spec-Dateien; `pnpm check` fängt Formatierungsschäden an den Kommentaren.
- Commit: `docs: complete the cleanup-blocker docs and clear the prose backlog (MEM-010)`
- Abgleich (2026-08-07, Zug 0, gegen `53994f0`): **MEM-010 steht unverändert im Sachverhalt, zwei der vier Fundstellen sind gewandert, keine ist gegenstandslos.** Die Evidenz ist nicht nachgemessen worden — sie ist eine GC-Messung über Doku-Aussagen, und die Aussagen stehen wörtlich noch da. Nachgesehen wurde stattdessen jede einzelne Zeile:
  - **`docs/api.md:403` → verschoben auf `docs/api.md:425-432`.** Der FR-Absatz hinter der statischen Tabelle, wortgleich zum Audit: »This requires that no strong reference path from the group back to the object exists — specifically, an attached signal whose value holds a reference to the object will keep it alive and prevent the callback from firing.« Das `specifically` bei `:428` ist genau der Quantorenfehler, den MEM-010 benennt. Verschoben durch die Sektion, die Paket 8 in denselben Block geschrieben hat (`:422-423`).
  - **`docs/architecture.md:113` → unverändert.** Block `:110-118`, das »However, an attached signal whose value holds a reference to the object creates exactly such a path« steht Zeichen für Zeichen bei `:113`. Kein Commit dieses Laufs hat die Datei angefasst.
  - **`skills/using-signalize/references/pitfalls.md:70` → unverändert.** Pitfall 16a mit der »Three limits«-Liste bei `:70`, die drei Aufzählungspunkte bei `:72-74`. Die Rückreferenz ist weiterhin keiner davon. Paket 5 hat in dieser Datei Pitfall 17 (`:76`) geschrieben, Paket 6 Pitfall 18 (`:78`) — beide unterhalb, daher keine Verschiebung.
  - **`CHANGELOG.md:54` → verschoben auf `CHANGELOG.md:66`.** `### Documentation` unter `## Unreleased`; die Zeile nennt weiterhin ausschließlich den Signalwert. Verschoben durch die `### Features`-Zeile aus Paket 6 (`:9`) und die `### Bug Fixes`-Zeilen aus Paket 8 (`:61`) und Paket 9 (`:62`).
  - **Die beiden vollständigen Stellen tragen weiter beide Pfade** und bleiben die Vorlage: `docs/recipes.md:381-387` (»An attached signal whose value holds a reference to the object, **or an effect whose callback closure captures it**, creates such a path«) und `README.md:281-287` (»unless a strong reference path (e.g., an attached signal's value or an effect's closure) keeps the object alive«). Beide sind unverändert; an ihnen entlangschreiben.
  - **Paket 9 hat die Aussage selbst erweitert, nicht widerlegt.** Der Guard steht bei `src/SignalGroup.ts:46-53` (`clearGroupFromFinalizer`), die Begründung im Kommentar bei `:35-42`, und die JSDoc der Instanz-`clear()` trägt den Satz bereits (`src/SignalGroup.ts:772-774`: »there, the error is reported via `console.error` instead of escaping«). In `docs/`, `skills/` und `README.md` steht davon **nichts** — ein `grep -rn "console.error" docs/ skills/ README.md` liefert vier Treffer, alle zum `onEffectError`-Kanal, keinen zur Gruppe. Der `Mitgenommen`-Eintrag aus Paket 9 ist damit vollständig offen.

  **Eingesammelte Prosa-Befunde: 26 Fundstellen, keine gegenstandslos, drei neu in diesem Zug 0 dazugekommen.** Der Reihe nach:
  - `CLAUDE.md:45` — **unverändert, und schlimmer als gemeldet.** Nicht nur die Signatur ist falsch (`getSubscriptionCount(queue, event?)`; `node_modules/@spearwolf/eventize/lib/index.d.ts:708` deklariert `(o: object) => number`), sondern auch die Herkunft: `src/assert-helpers.ts` importiert die Funktion nur (`:1`) und exportiert sie nicht weiter — die Specs holen sie direkt aus `@spearwolf/eventize` (`src/batch.spec.ts:1`).
  - **Neu (Zug 0):** `CLAUDE.md:20` behauptet, `.github/workflows/ci.yml` fahre »`check + test`«. Die Datei fährt `pnpm check` (`:29`), `pnpm test` (`:32`), `pnpm test:gc` (`:38`) und `pnpm bench` (`:45`, `continue-on-error`). Damit ist auch die Kernaussage der Zeile falsch: `pnpm world` (`clean check compile bundle test`, `package.json`) deckt CI **nicht** ab, weil `test:gc` fehlt — genau der Grund, warum jedes Paket dieses Laufs beide Kommandos in seiner Verify-Zeile führen musste. Der Reviewer von Paket 9 hat das gemeldet.
  - **Neu (Zug 0):** `AGENTS.md:181` trägt denselben Satz (»`.github/workflows/ci.yml` runs `pnpm check && pnpm test`, so `pnpm world` is the command that matches CI«), `AGENTS.md:164` dieselbe Behauptung in der Kommandotabelle (»matches CI scope«), und `AGENTS.md:169` nennt für `pnpm test:gc` nur `SignalGroup.gc.spec.ts`. Dieselbe Korrektur, zweite Datei — `CLAUDE.md` verweist für die volle Kommandotabelle ausdrücklich auf `AGENTS.md`, eine halbe Korrektur wäre schlechter als keine.
  - `CHANGELOG.md:75` → **verschoben auf `CHANGELOG.md:82`**, `### Breaking Changes` unter `## Unreleased`. Der falsche Halbsatz steht wörtlich da: »with a newer run's still-pending cleanup silently overwriting an older, unresolved one«.
  - `docs/api.md:180-183` → **teilweise verschoben, Sachverhalt steht.** Die `phase`-Tabellenzeile »Which of the two async callbacks rejected« liegt weiterhin bei `:180`; der Absatz »Only failures that surface *after* the synchronous call stack is gone arrive here« liegt jetzt bei `:182-189`, samt der von Paket 3 nachgeschobenen Ausnahme und ihrer schiefen Begründung »has no such caller left to throw at« (`:188`).
  - `src/effects.spec.ts:69-70` → **verschoben auf `:70-71`**: »The cleanup of an async run only becomes eligible once its promise has settled — and only as long as that run is still the current one.« Die korrigierende Gegenaussage steht zwölf Zeilen tiefer bei `:79-81`.
  - `src/EffectImpl.ts:677-678` → **unverändert.** Der Satz läuft von `:675` bis `:682`; die beiden beanstandeten Hälften sind »run N+1 cleans up after run N+1« (tautologisch) und »`destroy()` cleans up after the last stored cleanup« (räumt hinter dem Cleanup auf, statt ihn auszuführen), beide bei `:677-678`.
  - `src/effects.async.spec.ts:376-379` → **verschoben auf `:374-378`.** Der Satz entgleist bei »otherwise the outer run, whose promise is the newest, its cleanup would be stored last«.
  - Klassenfeld-Muster, vier Stellen: `docs/quickstart.md:60` **unverändert**, `README.md:259` **unverändert**, `docs/cheat-sheet.md:184` → **verschoben auf `:186`**, `skills/using-signalize/references/patterns.md:58` **unverändert**. Alle vier zeigen `createMemo(…, {attach: this})` als Klassenfeld ohne Vorbehalt. **Fünfte Stelle, neu in diesem Zug 0:** `skills/using-signalize/SKILL.md:52` (Verhalten 4) sagt »There is no memo decorator — a class-bound memo is `createMemo(..., {attach: this})`« und ebenfalls ohne Vorbehalt. Die vollständige Regel steht bereits in Pitfall 7a (`skills/using-signalize/references/pitfalls.md:23`, von Paket 4 geschrieben) und in `docs/recipes.md:96` sowie `docs/api.md:262` — es fehlt nur der Verweis an den fünf Muster-Stellen.
  - `src/link.ts:25-27` → **unverändert**, wörtlich: »Explicitly destroying the source (or a signal target) tears every link on it down the same way, fully — including their global-queue subscriptions.«
  - `src/link.ts:63-65` und `:21-22` → **unverändert.** »Both of the link's subscriptions on `globalSignalQueue`/`globalDestroySignalQueue`« bei `:63-65`, »both of its subscriptions on the global queues« bei `:21-22`.
  - `docs/api.md:412-424` (Instanz-Block) → **verschoben:** die Instanz-Tabelle liegt jetzt bei `:436-448`, der Fließtext zur Wiedereintritts-Sperre bei `:450-453`, das `---` bei `:455`. Der Befund steht: ein `grep -rn "AggregateError" docs/ skills/ README.md` liefert genau drei Treffer — `docs/api.md:153-154` (`Effect.destroy()`) und `docs/api.md:423` (die statische `SignalGroup.clear()`, von Paket 8). Für die **Instanz**-`clear()`/`off()` steht das gesammelte Fehlerverhalten nirgends in der Doku, obwohl es seit Paket 1 gilt. Ebenso wenig steht dort die Namensfolge des Destroy-Hooks. Vorbild ist der Blockquote bei `docs/api.md:143-154`.
  - `src/SignalAutoMap.spec.ts:432-433` → **unverändert**, zeilengenau. Der Anspruch, den die Zeilen nicht einlösen, steht im Kommentar darüber (`:420-422`), die tragende Abgrenzung bei `:426`.
  - Paket-9-Doku-Kette, sieben Stellen, **alle offen, keine nennt `console.error`:** `docs/api.md:425-432` (identisch mit der MEM-010-Stelle — ein Absatz, zwei Befunde, eine Überarbeitung), `docs/architecture.md:110-118`, `skills/using-signalize/references/pitfalls.md:70-74`, `skills/using-signalize/SKILL.md:22` und `:56`, `skills/using-signalize/references/api.md:218`, `docs/recipes.md:381-387`, `README.md:281-287`. Die Abgrenzung aus dem `Mitgenommen`-Eintrag trägt: die drei ausführlichen Stellen bekommen den Satz, die vier Kurzformen nicht.
  - `src/SignalGroup.teardown.spec.ts:378` → **verschoben auf `:383`** (`[0, 1, 2].map((i) => {`, Rückgabewert ungenutzt), im Test bei `:382`.
  - `CHANGELOG.md:52` → **unverändert**, zeilengenau. Die Zeile beginnt mit »`SignalGroup.clear()` and `SignalGroup.off()` run the teardown to the end«; die von Paket 8 nachgelegte Zeile über den tatsächlich statischen Sweep steht bei `:61`.
  - `.github/workflows/ci.yml:36` → **unverändert im Wortlaut, aber die Zahl ist doppelt falsch.** Der Kommentar (`:35-37`) nennt nur `SignalGroup.gc.spec.ts` und »those four tests«. Ausgezählt: `src/SignalGroup.gc.spec.ts` hat **sechs** Tests (`:41, :57, :72, :98, :123, :145`), `src/link.gc.spec.ts` hat **drei** (`:59, :85, :109`) — zusammen **neun**, und beide Dateien hängen an demselben `globalThis.gc`-Guard. Die Verify-Zahlen von Paket 9 bestätigen es unabhängig: `pnpm world` 377 passed / 9 skipped, `pnpm test:gc` 386 passed, Differenz genau 9. »Vier« war schon vor diesem Lauf falsch; die »fünf« aus dem Paket-9-Review ebenfalls, dort wurde nur eine Datei gezählt.
  - **Neu (Zug 0), aus dem Endstand-Sweep über die Doku-Kette — drei überholte Zusagen:**
    - `CHANGELOG.md:48` (BUG-002, `## Unreleased`) schließt mit »it runs from the `FinalizationRegistry` callback, where a `RangeError` is out of reach for any application-level `try`/`catch` **and takes the process down**«. Seit Paket 9 fängt `clearGroupFromFinalizer` (`src/SignalGroup.ts:46-53`) jeden Wurf aus `group.clear()`, ein `RangeError` eingeschlossen. Die Zeile widerspricht damit `CHANGELOG.md:62` im selben Block.
    - `skills/using-signalize/references/pitfalls.md:66` (Pitfall 15) gibt die `off()`-Zusage weiterhin ohne Vorbehalt: »it destroys attached effects and links and drops external subscriptions but keeps the signals alive«. Die MEM-008-Folgeentscheidung ist an fünf von sechs Stellen umgesetzt — `docs/api.md:446`, `docs/recipes.md:421-424`, `docs/cheat-sheet.md:135`, `skills/using-signalize/references/api.md:199` tragen die Ausnahme, Pitfall 15 nicht. Das ist die einzige Stelle im ganzen Sweep, an der eine Zusage dieses Laufs noch unkorrigiert steht.
    - `AGENTS.md:169` — siehe oben, nennt für `pnpm test:gc` nur eine der beiden GC-Spec-Dateien.
  - **Was der Sweep ausdrücklich als sauber bestätigt hat** (kein Handlungsbedarf, damit niemand nachfasst): die `SignalAutoMap`-Kette nach Paket 6 (`docs/recipes.md:541-567`, `docs/cheat-sheet.md:154`, `skills/using-signalize/references/api.md:233`, Pitfall 18) — vollständig und untereinander widerspruchsfrei; die Link-Lebenszeit nach Paket 5 (Pitfall 17, `docs/api.md:308-309`, `README.md`, `CHANGELOG.md:67`) — der Qualifier ist überall mitgeführt, wie das Paket-5-Review es über 18 Treffer belegt hat; die statische `SignalGroup.clear()` nach Paket 8 (`docs/api.md:422-423`) — die Zusage steht; und `src/SignalGroup.ts` selbst, dessen JSDoc Paket 9 bereits auf den Endstand gehoben hat (`:772-774`). **Diese Datei fasst Paket 7 nicht an.**

- Vorgehen:
  Reihenfolge: erst die drei großen Absätze (Schritte 1 bis 4), weil dort MEM-010 und der Paket-9-Eintrag zusammenfallen und dieselben Formulierungen wiederverwendet werden; dann der Rest, Datei für Datei. **Nirgends wird eine Assertion, ein Testtitel, ein Erwartungswert oder eine Zeile Produktivcode geändert** — die vier Spec-Dateien und `src/link.ts`/`src/EffectImpl.ts` werden ausschließlich wegen ihrer Kommentare und JSDoc geöffnet. Wenn nach diesem Paket `git diff --stat` für `src/` etwas anderes als Kommentarzeilen zeigt, ist etwas schiefgegangen.

  1. **Die Referenzformulierung festlegen (kein Edit, sondern die Vorlage für Schritte 2 bis 5).** MEM-010 verlangt die allgemeine Bedingung plus zwei Beispiele; `docs/recipes.md:381-387` hat sie bereits. Kanonisch für dieses Paket ist: *jeder* starke Referenzpfad von der Gruppe zurück zum Host-Objekt verhindert die Bereinigung; die zwei gewöhnlichen sind ein attachtes Signal, dessen **Wert** das Objekt hält, und ein attachter Effect, dessen **Callback-Closure** es einfängt. Nicht »insbesondere«, nicht »vor allem« — die Messung des Audits gibt beide mit demselben Ergebnis an (`mit createSignal(host): after gc 201` gegen `mit Effect-Closure ueber host: after gc 200`, bei je 200 Gruppen). Der Paket-9-Satz lautet in seiner kurzen Form: ein Teardown, der in diesem Callback wirft, wird über `console.error` gemeldet und nie weitergeworfen, weil ein Registry-Job keinen Aufrufer hat.

  2. **`docs/api.md:425-432`** — der Absatz hinter der statischen Tabelle. Er trägt beide Befunde und wird als Ganzes ersetzt:
     ```markdown
     When a user object becomes unreachable without an explicit `clear()` / `delete()`,
     a `FinalizationRegistry` callback runs `clear()` on the orphaned group. This
     requires that no strong reference path from the group back to the object exists
     — *any* such path keeps the object alive and stops the callback from ever firing.
     Two are ordinary: an attached signal whose value holds a reference to the object,
     and an attached effect whose callback closure captures it. Measured over 200
     groups, either one blocks reclamation completely. For `@signal accessor` fields
     storing `this`, explicit `delete()` or `group.clear()` in your cleanup is the
     reliable approach. FR firing is non-deterministic — explicit cleanup remains
     preferred. If that teardown throws, the error is reported via `console.error`
     and never re-raised: a registry callback has no caller left to receive it.
     ```
     Die statische Tabelle darüber (`:413-420`) und der Satz bei `:422-423` bleiben unangetastet — die schreibt Paket 8.

  3. **`docs/architecture.md:110-118`** — der Spiegelstrich »Automatic cleanup via `FinalizationRegistry`«, ebenfalls als Ganzes ersetzt:
     ```markdown
     - **Automatic cleanup via `FinalizationRegistry`:** When the user object
       becomes unreachable, a registry callback invokes `group.clear()`. This
       requires that no strong reference path from the group back to the object
       exists — and any such path is enough to stop it. Two are ordinary: an
       attached signal whose value holds a reference to the object (the group
       holds the signal, the signal holds the value), and an attached effect
       whose callback closure captures the object (the group holds the effect,
       the effect holds the closure). Either way the object is never reclaimed
       and the callback never fires. For `@signal accessor` fields storing a
       reference to `this`, the first is the normal pattern. Explicit
       `SignalGroup.delete(obj)` or `group.clear()` in cleanup remains the
       reliable path. A teardown that throws inside the registry callback is
       reported via `console.error` rather than re-raised — there is no caller
       in that job to throw at.
     ```
     Der Verweis bei `:128-130` (»see "Automatic cleanup" above«) bleibt stehen und stimmt danach.

  4. **`skills/using-signalize/references/pitfalls.md:70-74`, Pitfall 16a.** Zwei Änderungen an einem Block. Der Einleitungssatz endet heute auf »…are reclaimed. Three limits make it insurance rather than a lifecycle:« — daraus wird »…are reclaimed; if that teardown throws, the error goes to `console.error`, because a registry callback has no caller to hand it to. **Four** limits make it insurance rather than a lifecycle:«. Und als **erster** der Aufzählungspunkte, vor dem heutigen »FR callbacks fire non-deterministically…«, kommt der fehlende Grenzfall dazu:
     ```markdown
     - Any strong reference path from the group back to its host object stops the object from ever becoming unreachable, so the callback never fires at all. An attached signal whose *value* holds the object and an attached effect whose *closure* captures it both do this, and measurement puts them on a par — 200 groups, 200 still alive after `gc()` either way. `@signal() accessor self = this` is the everyday version. The backstop covers exactly the case where nothing points back.
     ```
     Er steht bewusst zuerst: er ist der einzige der vier, der den Backstop nicht bloß unzuverlässig, sondern wirkungslos macht.

  5. **`CHANGELOG.md`, die `### Documentation`-Zeile bei `:66`** (über den Inhalt suchen: beginnt mit »Documented the condition under which automatic `SignalGroup` cleanup«). Eine Zeile, ein Fakt — der Fakt ist die Bedingung, nicht die Aufzählung der Beispiele, also bleibt sie eine Zeile:
     ```markdown
     - Documented the condition under which automatic `SignalGroup` cleanup via `FinalizationRegistry` cannot fire: any strong reference path from the group back to the user object — an attached signal whose value holds the object and an attached effect whose closure captures it are the two ordinary ones, and both block reclamation equally. For `@signal accessor` fields storing a reference to `this`, explicit `SignalGroup.delete()` or `group.clear()` in a destructor remains the reliable cleanup path (MEM-006)
     ```
     Die Kennung `(MEM-006)` bleibt stehen — sie stammt aus dem vorigen Audit und wird hier nicht umgeschrieben; neue Finding-IDs kommen nach der Konvention dieses Laufs nicht in den Changelog. **Keine** zusätzliche Zeile für das `console.error`-Verhalten: `CHANGELOG.md:62` (aus Paket 9) hat den Fakt bereits, und zwei Zeilen für einen Fakt verstößt gegen dieselbe Regel.

  6. **`CHANGELOG.md:48`, überholte Zusage** (über den Inhalt suchen: die BUG-002-Zeile, die mit »`hasSignal()`, `signal()`, `runEffects()`, `off()` and `clear()` additionally refuse to re-enter« beginnt). Nur der Schlusssatz ändert sich: aus »where a `RangeError` is out of reach for any application-level `try`/`catch` and takes the process down (BUG-002)« wird »where a `RangeError` is out of reach for any application-level `try`/`catch` — it is caught and reported there now, but the recursion would still have burnt the stack first (BUG-002)«. Der Rest der Zeile bleibt Zeichen für Zeichen stehen. Begründung: der Wiedereintritts-Schutz bleibt sinnvoll, die Folge »Prozessende« gilt seit Paket 9 nicht mehr, und die alte Fassung widerspräche `:62` im selben Block.

  7. **`CHANGELOG.md:52`, Instanz gegen statisch** (über den Inhalt suchen). Ein Wort genügt: aus »- `SignalGroup.clear()` and `SignalGroup.off()` run the teardown to the end when…« wird »- The instance methods `group.clear()` and `group.off()` run the teardown to the end when…«. Der Rest der Zeile bleibt unverändert. Damit trennt sie sich sauber von der Paket-8-Zeile bei `:61`, die mit »The static `SignalGroup.clear()`« beginnt.

  8. **`CHANGELOG.md:82`, `### Breaking Changes`** (über den Inhalt suchen: beginnt mit »The cleanup an `async` effect callback resolves to is no longer resolved lazily«). Die falsche Tatsachenbehauptung über den v0.31.1-Stand fällt weg; sie wird nicht durch die richtige ersetzt, weil der Re-Entrancy-Fall in dieser Zeile nichts zu suchen hat. Aus dem Kopf der Zeile
     »The cleanup an `async` effect callback resolves to is no longer resolved lazily at the next run or at `destroy()`, with a newer run's still-pending cleanup silently overwriting an older, unresolved one — the promise returned by the callback is followed as soon as it settles instead.«
     wird
     »The cleanup an `async` effect callback resolves to is no longer picked up lazily at the next run or at `destroy()` — the promise returned by the callback is followed as soon as it settles instead.«
     Der zweite Satz der Zeile (»The cleanup of the current run is stored and never lost; the cleanup of a superseded or destroyed run runs right then…«) bleibt unverändert; er trägt die eigentliche Aussage.

  9. **`docs/api.md`, Instanz-Block.** Zwei Ergänzungen, beide **nach** dem Wiedereintritts-Absatz (`:450-453`) und vor dem `---` bei `:455`. Zuerst das Fehlerverhalten, im Blockquote-Stil des `Effect.destroy()`-Absatzes bei `:143-154`, an dem entlangzuschreiben ist:
     ```markdown
     > **Teardown errors.** `clear()` and `off()` finish the entire teardown
     > before they report a failure. A cleanup callback that throws, or a
     > `DESTROY`/`OFF` listener that does, no longer aborts what comes after it:
     > sibling effects are still destroyed, signals still torn down, links still
     > released, the group still deregistered — and `off()` still emits its `OFF`
     > event. The failures are collected and raised afterwards: a lone one
     > unchanged, several as an `AggregateError` whose `errors` array holds them
     > in teardown order. The one place they are not raised is the
     > `FinalizationRegistry` path described above, where they go to
     > `console.error` instead.
     ```
     Danach die Namensfolge des Destroy-Hooks, als gewöhnlicher Absatz:
     ```markdown
     Destroying a signal directly — `signal.destroy()` or `destroySignal(sig)` —
     also takes it out of the group that held it, name included: `hasSignal(name)`
     turns `false` and `signal(name)` returns `undefined` rather than the destroyed
     signal. If another signal is still a candidate for that name, it takes the slot
     over by the same rule `detachSignal()` uses. The same applies to attached
     effects: a destroyed effect leaves the group's set by itself instead of sitting
     there until the next `clear()`.
     ```
     Die Instanz-Tabelle (`:436-448`) wird **nicht** angefasst — die `off()`-Zeile trägt die MEM-008-Präzisierung bereits, die `clear()`-Zeile ist auf ihrer Flughöhe korrekt.

  10. **`skills/using-signalize/references/pitfalls.md:66`, Pitfall 15.** Der Halbsatz »but keeps the signals alive« bekommt seine Ausnahme, wortgleich zum Muster, das die anderen fünf Stellen fahren: »…and drops external subscriptions but keeps the signals alive — except a memo signal `{attach}`ed inside an effect body, which belongs to that effect and dies with it, name and all (7a).« Rest der Zeile unverändert.

  11. **Das Klassenfeld-Muster, fünf Stellen.** Die vollständige Regel steht bereits in Pitfall 7a und in `docs/recipes.md:96`; hier fehlt nur der Vorbehalt. Jeweils **ein** Satz, direkt hinter dem Codeblock bzw. der Zeile, in der Sprache und Zeichensetzung der jeweiligen Datei:
      - `docs/quickstart.md`, hinter dem Codeblock der Klasse (heute endend bei `:68`): »A memo declared as a class field is created while the constructor runs — so if the instance is constructed inside an effect body, that constructor run *is* an effect body, and the memo dies with the parent effect's next rerun. `{attach}` gives it a group and a name, not a lifetime of its own (see [Recipes](./recipes.md)).«
      - `README.md`, hinter dem Codeblock bei `:262`: »Constructing such a class inside an effect body makes the constructor run part of that effect — the memo then dies with the effect's next rerun, `{attach}` or not. See [Recipes & quirks](./docs/recipes.md).«
      - `docs/cheat-sheet.md:186`, als Kommentar in derselben Zeile bzw. direkt darunter im Codeblock: `// dies with the parent effect if the instance is built inside an effect body`.
      - `skills/using-signalize/references/patterns.md:58` — der Kommentar darüber (`:57`) lautet heute »// Eager by default — attached to the instance group«. Daraus wird: `// Eager by default — attached to the instance group.` plus eine zweite Kommentarzeile `// Built inside an effect body? Then the memo dies with that effect (pitfalls 7a).`
      - `skills/using-signalize/SKILL.md:52`, Verhalten 4, Schlusssatz: aus »There is no memo decorator — a class-bound memo is `createMemo(..., {attach: this})`.« wird »There is no memo decorator — a class-bound memo is `createMemo(..., {attach: this})`, which dies with the surrounding effect if the instance is constructed inside one (`references/pitfalls.md`, 7a).«
      Mehr nicht. Der Vorbehalt wird an keiner der fünf Stellen ausformuliert — er steht an genau einer Stelle vollständig, und das bleibt Pitfall 7a.

  12. **`src/link.ts:25-27`, der zu weit greifende Quantor.** Die Parallelstellen `src/link.ts:235-236` und `docs/api.md:308-309` sind korrekt formuliert; an ihnen entlangschreiben. Aus
      »Explicitly destroying the source (or a signal target) tears every link on it down the same way, fully — including their global-queue subscriptions.«
      wird
      »Explicitly destroying the source tears down every link on it the same way, fully — including their global-queue subscriptions. Destroying a signal *target* takes down the links that point at it, not the other links on the same source: with three links on one source, `destroySignal(t1)` leaves two.«
      Die Zahl ist aus dem Paket-5-Review übernommen und gemessen.

  13. **`src/link.ts:21-22` und `:63-70`, die Zahl der Subscriptions.** Ein Link auf ein Callback-Ziel hat zwei, ein `SignalLinkToSignal` drei (eine auf `globalSignalQueue`, zwei auf `globalDestroySignalQueue` für Quelle und Ziel).
      - `:21-22`: aus »its callback closure, its target reference, both of its subscriptions on the global queues« wird »its callback closure, its target reference, all of its subscriptions on the global queues (two for a callback target, three for a signal target)«.
      - `:63-70`: aus »Both of the link's subscriptions on `globalSignalQueue`/`globalDestroySignalQueue` (see `SignalLink`'s constructor) are still registered when this fires…« wird »All of the link's subscriptions on `globalSignalQueue`/`globalDestroySignalQueue` (see `SignalLink`'s constructor) are still registered when this fires…«. Der Messsatz am Ende (`:67-70`) bekommt seinen Kontext dazu: »Measured with callback targets: after 200 links are collected this way, `getSubscriptionCount(globalSignalQueue)` and `getSubscriptionCount(globalDestroySignalQueue)` both still read 200, unchanged from immediately before the collection — for signal targets the second number would be 400.«

  14. **`src/EffectImpl.ts:675-682`, der JSDoc-Satz.** Aus »It belongs to the run that produced it, and it is the only thing that will ever release what that run acquired: run N+1 cleans up after run N+1, `destroy()` cleans up after the last stored cleanup.« wird »It belongs to the run that produced it, and it is the only thing that will ever release what that run acquired. Nobody else will: the next run's cleanup releases the next run's resources, and `destroy()` runs the one cleanup it has stored — neither of them knows about this one.« Der Rest des Blocks (`:665-674` und `:679-710`) bleibt unverändert.

  15. **`src/effects.spec.ts:70-71`, der Kommentar mit der zurückgenommenen Zusage.** Aus »The cleanup of an async run only becomes eligible once its promise has settled — and only as long as that run is still the current one.« wird »The cleanup of an async run becomes eligible once its promise has settled. Whether that run is still the current one decides *when* it runs, not *whether*: see the superseded case twelve lines down.« Assertionen, Testtitel und Erwartungswerte bleiben unangetastet.

  16. **`src/effects.async.spec.ts:374-378`, der entgleiste Schlusskommentar.** Aus dem heutigen Satz wird: »The generation must follow the order in which the callbacks *ran*, not the order in which the runs were entered. Otherwise the outer run — whose promise is the newer one — would have its cleanup stored first and the inner run's stale cleanup would be the one left standing at `destroy()`.« Die Assertion darunter (`expect(log.at(-1)).toBe('cleanup:3')`) bleibt Zeichen für Zeichen stehen.

  17. **`src/SignalAutoMap.spec.ts:432-433`, der überzogene Anspruch.** Die beiden Zeilen bleiben, wie sie sind — **die Assertionen werden nicht angefasst**. Was fehlt, ist die Einordnung: unmittelbar darüber kommt ein Kommentar, der sagt, was die zwei Zeilen belegen und was nicht:
      ```ts
      // Not a liveness check — a destroyed signal stores writes and reads them
      // back just the same (pitfall 6). This only shows the fresh entry is
      // usable; that it is alive was settled by assertSignalsCount(1) above.
      ```
      Der Kommentar bei `:420-422` bleibt unverändert; er beschreibt korrekt, was `delete()` tut.

  18. **`src/SignalGroup.teardown.spec.ts:383`, `.map()` als `forEach`.** Der Test bei `:382` baut drei Gruppen auf; der Rückgabewert des `.map()` wird nirgends gebunden. Drei Zeilen ändern sich, sonst nichts:
      - `:383` — `[0, 1, 2].map((i) => {` wird zu `for (const i of [0, 1, 2]) {`
      - `:402` — `return group;` entfällt ersatzlos (`group` wird im Rumpf bei `:385` nur für `findOrCreate` gebraucht; nach dem Wegfall des `return` prüfen, ob Biome die Variable als ungenutzt meldet — falls ja, `SignalGroup.findOrCreate(host);` ohne Zuweisung schreiben)
      - `:403` — `});` wird zu `}`
      Die Leerzeile bei `:401` fällt mit dem `return` zusammen weg. **Keine Assertion, kein Erwartungswert, kein Testtitel ändert sich**, und der Test muss danach ohne Zahlenänderung grün laufen.

  19. **`.github/workflows/ci.yml:35-37`, der Kommentar über dem `test:gc`-Schritt.** Er nennt eine Datei zu wenig und eine falsche Zahl:
      ```yaml
      # `pnpm test` skips SignalGroup.gc.spec.ts and link.gc.spec.ts because
      # `globalThis.gc` is absent without --expose-gc. Without this step those
      # nine tests never run on CI at all.
      ```
      Der `run`-Schritt darunter bleibt unverändert.

  20. **`CLAUDE.md:45`, Abschnitt »Verifying subscription leaks«.** Signatur und Herkunft sind beide falsch. Neue Fassung der Zeile:
      »For changes touching subscribe/unsubscribe paths, assert that nothing leaks: snapshot `getSubscriptionCount(queue)` (one argument, imported straight from `@spearwolf/eventize` — `src/assert-helpers.ts` uses it but does not re-export it) together with `getSignalsCount` / `getEffectsCount` / `getLinksCount` → run the scenario → destroy → assert restored. For the per-event view there is `getSubscribedEventNames(queue)`. `unsubscribeEffect.spec.ts` is the reference.«
      Begründung fürs Anfassen der Projektanweisung, gehört so in den Report: die Zeile ist die Anleitung, nach der jedes Paket dieses Laufs seine Leak-Tests geschrieben hat, und sie beschreibt einen Aufruf, den `tsc` ablehnt.

  21. **`CLAUDE.md:20`, die CI-Zusage.** Aus »- `pnpm world` — adds `check`; **this is what matches CI** (`.github/workflows/ci.yml` runs `check + test`, not `cbt`).« wird:
      »- `pnpm world` — adds `check`; the closest single command to CI, but **not** the whole of it: `.github/workflows/ci.yml` runs `check`, `test`, `test:gc` and `bench` (the last one informative, `continue-on-error`). A change touching GC or teardown paths needs `pnpm world` **and** `pnpm test:gc` before it is done.«
      Die Zeile darunter (`:22`, `pnpm test:gc`) bleibt inhaltlich richtig; sie bekommt nur die zweite Datei dazu: »— the only way the `SignalGroup.gc.spec.ts` and `link.gc.spec.ts` suites actually run; plain `pnpm test` skips all nine of their tests.« Begründung fürs Anfassen der Projektanweisung: die alte Fassung hat neun Tests unsichtbar gemacht und stand im Widerspruch zur eigenen Verify-Zeile jedes Pakets dieses Laufs.

  22. **`AGENTS.md`, dieselbe Korrektur an drei Stellen.** `:181` — aus »`.github/workflows/ci.yml` runs `pnpm check && pnpm test`, so `pnpm world` is the command that matches CI — `pnpm cbt` skips `check`.« wird »`.github/workflows/ci.yml` runs `pnpm check`, `pnpm test`, `pnpm test:gc` and `pnpm bench` (informative, non-blocking). `pnpm world` covers all but the GC suite — run `pnpm test:gc` alongside it; `pnpm cbt` additionally skips `check`.« `:164` — der Tabelleneintrag »pre-release / matches CI scope« wird zu »pre-release / CI scope minus `test:gc`«. `:169` — »adds `--expose-gc` so `SignalGroup.gc.spec.ts` runs instead of skipping« wird zu »adds `--expose-gc` so `SignalGroup.gc.spec.ts` and `link.gc.spec.ts` run instead of skipping (nine tests)«.

  23. **Abschluss.** `pnpm world` und `pnpm test:gc` müssen dieselben Zahlen liefern wie nach Paket 9 (377 passed / 9 skipped bzw. 386 passed); eine Abweichung ist ein Fehler dieses Pakets. `pnpm check` muss sauber sein — die Kommentar-Umbrüche in `src/link.ts` und `src/EffectImpl.ts` sind die wahrscheinlichste Fehlerquelle. In den Report gehören: `git diff --stat`, die Bestätigung, dass in `src/` ausschließlich Kommentar- und JSDoc-Zeilen berührt sind, und eine Liste der 26 Fundstellen mit »erledigt« oder »nicht nötig, weil …«. Kein neuer Test, kein neuer Changelog-Eintrag außer den drei Korrekturen aus den Schritten 5 bis 8.

**MEM-010 · low (vorher medium, Status `improved`) · docs/api.md:403 · docs/architecture.md:113 · skills/using-signalize/references/pitfalls.md:70 · CHANGELOG.md:54** — Doku nennt nur den Signalwert als Blocker der automatischen Gruppen-Bereinigung

Die Bedingung, unter der die FinalizationRegistry nicht feuern kann, steht jetzt an sechs Stellen — aber nicht überall vollständig. `docs/api.md` schreibt »specifically, an attached signal whose value holds a reference«, was den einen Beispielpfad als *den* Blocker liest. `pitfalls.md` zählt drei Grenzen der Registry auf, die Rückreferenz ist keine davon. Der CHANGELOG-Eintrag nennt ausschließlich den Signalwert. Nur `docs/recipes.md` und `README.md` führen beide Pfade. Gemessen blockiert eine Effect-Closure genauso hart.

Empfehlung: Die vier unvollständigen Stellen auf die allgemeine Bedingung heben, wie es `docs/recipes.md` bereits tut: jeder starke Pfad zurück zum Host, Signalwert und Effect-Closure als die zwei Beispiele.

Belegt mit: je 200 Gruppen, `--expose-gc`:
```
ohne Rueckreferenz:            base 0  created 200  after gc   1
mit createSignal(host):        base 1  created 201  after gc 201
mit Effect-Closure ueber host: base 0  created 200  after gc 200
```

#### Nicht in diesem Lauf behoben — Eingabestapel fürs nächste Audit

Über neun Pakete verteilt entschieden, hier zusammengezogen. Jeder Punkt ist von einem Reviewer belegt oder vom jeweiligen Planer gemessen; keiner ist eine Vermutung. Zeilennummern stehen auf `53994f0`.

- **`tsconfig.lib.json` setzt kein `stripInternal`** — drei mit `@internal` markierte Symbole stehen in den ausgelieferten Typen: `SignalGroup#memberCounts` (Paket 1), `clearGroupFromFinalizer` in `lib/SignalGroup.d.ts:6` (Paket 9), `Effect#onDestroy` aus dem Vorlauf. Eine Build-Config-Frage, die zusammen bewertet gehört; kein unterstützter Importpfad erreicht die Symbole heute.
- **Coverage-Delle 97,03 → 96,36 Statements** — die `catch`-Zweige in `SignalGroup.clear()`/`off()` für ein werfendes `link.destroy()`, ein werfendes `childGroup.clear()` und einen werfenden `OFF`-Listener haben keinen Test. Kein Gate schlägt an.
- **`src/EffectImpl.ts:769-773`** — der Thenable-Zweig in `runOrphanedCleanupCallback()` hat keinen Test; vom Reviewer von Paket 3 per Sonde als funktionierend belegt (`phases=['cleanup']`, `unhandled=0`).
- **Kein Test deckt den `AggregateError`-Fall über den Finalizer ab** (Paket 9). Das `catch` ist typlos, betroffen ist nur die Ausgabeform.
- **`src/SignalGroup.gc.spec.ts:145-179`** — feuert die FinalizationRegistry nicht innerhalb der 20 Runden, scheitert zusätzlich das `afterEach` am selben werfenden Cleanup. Lärmverstärker in einem ohnehin roten Lauf.
- **`src/createMemo.spec.ts:13` und `:50`** — zwei Alt-Tests zerstören ihre Memos nie und hinterlassen zusammen 2 Effects im modulglobalen Zähler. Testhygiene aus einer früheren Runde.
- **`src/SignalGroup.ts:196`** — legt ein `DESTROY`-Listener während des statischen Sweeps eine neue Gruppe an, steht sie nicht im Snapshot, wird aber vom unbedingten `allGroups.clear()` aus der Registry gewischt. Gemessen: `groups=0`, aber `SignalGroup.get(lateHost)` liefert eine voll aufgebaute Gruppe mit `signals=1 effects=1`, die kein zweiter Sweep mehr erreicht. Identisch zu `HEAD`, von Paket 8 nur im Zeitfenster vergrößert.
- **`src/SignalAutoMap.ts:60-65`** — `clear()` zerstört zuerst und trägt dann aus, also umgekehrt zu der Reihenfolge, die für `delete()` ausgemessen wurde: ein re-entranter `get(key)` aus einem Effect-Cleanup bekommt dort die Leiche. Dieselbe Methode **sammelt außerdem keine Fehler** — ein werfendes `sig.destroy()` bricht den Rest des `clear()` ab, dieselbe Familie wie MEM-001 und Paket 8, nur in einer anderen Klasse.
- **`src/SignalAutoMap.ts:29` / `src/createSignal.ts:174-177`** — `fromProps()` übernimmt ein als Prop-Wert übergebenes Signal per Identität (`map.get('p') === foreign`, `getSignalsCount()` steigt nicht). `clear()` und `delete()` zerstören damit fremdes Eigentum. Kein neuer Sachverhalt, aber unbeschrieben.
- **`src/Signal.ts:14-59` und `src/Effect.ts`** — keiner der beiden öffentlichen Wrapper hat einen `destroyed`-Getter, obwohl `ISignalImpl` (`src/createSignal.ts:78`) und `EffectImpl` je einen führen. Ein Aufrufer kann ein Objekt also nicht fragen, ob es noch lebt, und die Zusage »reads return the last value« aus `docs/api.md` ist von außen nicht nachprüfbar. Fällt in `API-*`, nicht in `MEM-*`.

### [x] 8. Statisches SignalGroup.clear(): Fehler einsammeln
- Erledigt · Hash: `8e91fc4` · Verify vom Orchestrator: `pnpm world` ✓ 376 passed / 8 skipped, `pnpm test:gc` ✓ 384 passed. Keine Nachbesserungsrunde nötig.

#### Vom Review bestätigt
- Vier Gruppen, drei werfende Cleanups: `AggregateError: [signalize] 3 errors while clearing all signal groups`, `.errors` in Sweep-Reihenfolge, danach `groups=0` und alle Hosts aus `store` verschwunden. Einzelner Fehler kommt als identische Referenz durch, kein Wrapping.
- Keine der vier bereits vergebenen `what`-Meldungen hat sich geändert; die fünfte ist rein additiv.
- Der Dedup-Kommentar stimmt jetzt und ist nachgemessen: dreimal `once()` mit derselben Funktionsreferenz ergibt 3 Subscriptions und 3 Aufrufe, Objekt-Listener dagegen 1 — `LISTENER_IS_FUNC` ist von der Dedup per Typ ausgeschlossen.
- Der FinalizationRegistry-Callback ist unangetastet und wartet auf Paket 9.

#### Kleine Review-Befunde
- **`src/SignalGroup.ts:196`, vorbestehend** — legt ein `DESTROY`-Listener während des Sweeps eine neue Gruppe an, steht sie nicht im Snapshot, wird aber vom unbedingten `allGroups.clear()` aus der Registry gewischt. Gemessen: `groups=0`, aber `SignalGroup.get(lateHost)` liefert eine voll aufgebaute Gruppe mit `signals=1 effects=1`, die kein zweiter Sweep mehr erreicht. Identisch zu `HEAD`; der Fix vergrößert nur das Zeitfenster. **Kandidat fürs nächste Audit.**
- **`src/SignalGroup.teardown.spec.ts:378`** — `[0,1,2].map(…)` mit ungenutztem Ergebnis, ein `.map()` als `forEach`. → Paket 7.

#### Detailplan (Zug 0)
- Findings: keines aus dem Audit — Nebenbefund aus dem Review von Paket 1 (`src/SignalGroup.ts:186-192`), aufgenommen weil es MEM-001 eine Ebene höher ist: die Schleife über `[...allGroups]` sammelt keine Fehler, bei einem Wurf läuft `allGroups.clear()` nie und die Registry bleibt mit halb abgebauten Gruppen zurück. Ein Paket statt eines Anhängsels an Paket 1, weil dessen Hash steht und Paketnummern nicht neu vergeben werden.
- Ziel: `SignalGroup.clear()` (statisch) zieht den Abbau aller registrierten Gruppen trotz werfender Teardowns durch und meldet die Fehler gesammelt, wie die Instanzmethode seit Paket 1.
- Bereich: `src/SignalGroup.ts`, `src/SignalGroup.teardown.spec.ts`, `docs/api.md`, `CHANGELOG.md`
- Hängt ab von: Paket 1 (nutzt `throwCollectedErrors` aus `src/collect-errors.ts`); läuft **vor** Paket 7, damit die Doku den Endstand beschreibt
- Modell: mittlere Stufe (final; der Produktivcode steht unten wörtlich und ist zehn Zeilen, alle Erwartungswerte sind gegen den Build von `39eadee` ausgemessen. Was Urteil verlangt, ist der Ersatz für den falschen Dedup-Kommentar: er muss den eventize-Mechanismus richtig treffen, ohne länger zu werden als der Guard, den er begründet. Die günstigste Stufe würde daran scheitern.)
- Hash: —
- Dateien: `src/SignalGroup.ts`, `src/SignalGroup.teardown.spec.ts`, `docs/api.md`, `CHANGELOG.md`
- Verify: `pnpm world` (= CI: clean + biome check + tsc + rollup + vitest) und zusätzlich `pnpm test:gc`. **Nicht** `npx tsc --noEmit -p tsconfig.json`: diese Config meldet 6 vorbestehende Fehler in `node_modules` (`unplugin`/`webpack`-Typen), kein Script fährt sie. Während der Arbeit: `npx vitest run SignalGroup.teardown.spec.ts` (`pnpm test -- <datei>` filtert nicht — bekannte Eigenheit, das Script endet auf `vitest run --coverage`).
- Commit: `fix(group): collect teardown errors in the static clear() sweep`
- Mitgenommen (Nebenbefund aus Paket 1, umgeleitet in Zug 0 von Paket 5, 2026-08-06; Messung in Zug 0 von Paket 8 korrigiert): der Begründungskommentar bei **`src/SignalGroup.ts:542-546`** ist falsch. Er sagt, eventize könne hier nicht deduplizieren, weil »`add()` compares listeners via `isSimilar()`, and every `once()` call below builds a fresh arrow function«. Gemessen (`node_modules/@spearwolf/eventize/lib/index.js:533`, `isSimilarListenerType`, und `:368-378`, `detectListenerType`): dedupliziert wird nur für `LISTENER_IS_OBJ` und `LISTENER_IS_NAMED_FUNC` — und `LISTENER_IS_NAMED_FUNC` heißt nicht »benannte Funktion«, sondern »Methodenname als String oder Symbol«. Eine Funktion ist immer `LISTENER_IS_FUNC` und damit per Typ von der Deduplizierung ausgeschlossen. Die frische Arrow-Funktion ist also nicht der Grund; der Guard wäre mit einer festgehaltenen Referenz genauso nötig. Hierher und nicht in Paket 5, weil dieses Paket `src/SignalGroup.ts` ohnehin anfasst. Ein Kommentar, kein Verhalten. Der gleichlautende Kommentar in `src/SignalLink.ts:117-122` ist dagegen **richtig** und wurde in Paket 5 nur um den Mechanismus ergänzt.
  Korrektur an der Vorgänger-Messung: dort stand »bei einem `emit` zwei Aufrufe«. Nachgemessen sind es **drei** — dreimal `once(o, 'X', fn)` mit derselben Referenz ergibt `getSubscriptionCount(o) === 3`, ein `emit` ruft `fn` dreimal und lässt 0 Subscriptions zurück; drei frische Arrows ergeben ebenfalls 3/3. Gegenprobe mit einem Objekt-Listener: dreimal registriert, `getSubscriptionCount(o) === 1`. Die Zahl ändert an der Schlussfolgerung nichts, sie gehört nur richtig in den Kommentar, falls der Implementierer sie zitiert.
- Abgleich (2026-08-07, Zug 0): **Sachverhalt unverändert, Fundstelle gewandert.** Die statische `clear()` steht nach Paket 1 nicht mehr bei `src/SignalGroup.ts:186-192`, sondern bei **`src/SignalGroup.ts:178-187`** (JSDoc ab 178, Rumpf 181-187); der Rumpf ist Zeichen für Zeichen der alte: `for (const group of [...allGroups]) { group.clear(); }` gefolgt von `allGroups.clear()`, kein `try`, kein `errors`-Array. `throwCollectedErrors` ist in der Datei bereits importiert (`src/SignalGroup.ts:9`) — der Fix braucht **keinen** neuen Import.

  Alle Zahlen gegen den `lib/`-Build von `39eadee` (frisch mit `pnpm compile` erzeugt), Aufbau exakt in der Form des geplanten Tests: drei Hosts, je ein attachtes Signal, ein attachter Effect und ein attachter Callback-Link, der Cleanup der **zuerst** angelegten Gruppe wirft (`allGroups` ist eine `Set` in Einfügereihenfolge, die Abbruchstelle ist damit deterministisch).
  - **Der Befund reproduziert.** `before: groups=3 signals=3 effects=3 links=3` → `SignalGroup.clear()` wirft `Error: cleanup boom 0` → `after: groups=2 signals=2 effects=2 links=2, siblingCleanups=0`. Die Gruppen 2 und 3 stehen vollständig da (`memberCounts` je `{signals:1, effects:1, links:1}`) und sind weiter über ihren Host auffindbar (`SignalGroup.get(host) !== undefined`). Erst der zweite, dritte … Aufruf drainiert die Registry — der Aufrufer muss `SignalGroup.clear()` heute in einer Schleife rufen, um sicher zu sein, dass sie leer ist.
  - **Der Instanz-Fix aus Paket 1 fängt den Fall zur Hälfte ab, und die bessere Hälfte.** Die werfende Gruppe selbst ist am Ende vollständig abgebaut und deregistriert (`memberCounts` komplett 0, `SignalGroup.get(host0) === undefined`) — Paket 1 zieht ihren Teardown durch und wirft erst danach. Verloren geht ausschließlich der **Rest der Schleife**. Ohne Paket 1 stünde zusätzlich die werfende Gruppe halb abgebaut in der Registry.
  - **Zwei werfende Gruppen** (Position 1 und 3): heute wirft `SignalGroup.clear()` nur `Error: cleanup boom 0`, `isAggregate=false`, danach `groups=2`; der zweite Fehler taucht erst beim nächsten Aufruf auf. Mit dem Fix (im Probe-Skript originalgetreu nachgebaut): `AggregateError: [signalize] 2 errors while clearing all signal groups`, `.errors` = `['cleanup boom 0', 'cleanup boom 2']` in Sweep-Reihenfolge, `after: groups=0 signals=0 effects=0 links=0`.
  - **Keine weitere statische Methode hat dasselbe Muster.** `SignalGroup.delete(object)` (`src/SignalGroup.ts:174-176`) ist `store.get(object)?.clear()` — eine einzige Gruppe, keine Schleife, nichts zu sammeln; ein Wurf gehört dort unverändert an den Aufrufer und bleibt so. `SignalGroup.destroy(object)` (`:163-168`) delegiert nach einem `console.warn` auf `delete()`. `runEffects()` ist eine Instanzmethode und kein Teardown. Der einzige weitere Ort im Paket, an dem ein Abbau ohne Sammeln über mehrere Objekte läuft, ist `SignalAutoMap.clear()` (`src/SignalAutoMap.ts:60-65`) — nicht `SignalGroup`, nicht in diesem Paket, als Kandidat fürs nächste Audit unter Paket 6 vermerkt.
  - **Re-Entranz geprüft** (weil Schritt 1 `allGroups.clear()` stehen lässt): ruft ein `DESTROY`-Listener der gerade abgebauten Gruppe seinerseits `SignalGroup.clear()`, räumt der innere Lauf die übrigen Gruppen ab und wischt `allGroups` — die äußere Gruppe steht zu dem Zeitpunkt wegen `BUSY_CLEAR` übersprungen darin. Der äußere Lauf beendet sie danach regulär. Endstand gemessen: `groups=0 signals=0`, alle `memberCounts` 0, `SignalGroup.get(host0) === undefined`, ein einziger innerer Aufruf. Der Fix ändert daran nichts, weil er nur ein `try/catch` um denselben Aufruf legt.

- Vorgehen:
  1. **Zuerst die roten Tests, in `src/SignalGroup.teardown.spec.ts`**, als zwei neue `it()` am Ende des bestehenden `describe('SignalGroup teardown robustness')` (der letzte Test endet heute bei Zeile 328, die schließende Klammer des `describe` steht bei 330). Die Datei hat `SignalGroup`, `getSignalGroupsCount`, `createSignal`, `createEffect`, `getEffectsCount`, `getSignalsCount`, `link`, `getLinksCount`, `getGroupMemberCounts` und `NO_GROUP_MEMBERS` bereits importiert — **kein neuer Import**. Aufbau beider Tests wie im ersten Test der Datei (`:34-80`), nur über drei Hosts statt einen; die werfende Gruppe ist die zuerst angelegte.
     - `it('static SignalGroup.clear() sweeps every group even when one of them throws')` — drei Hosts, je `createSignal(0, {attach: host})`, ein `createEffect(…, {attach: host})` dessen Cleanup bei Host 0 `throw new Error('cleanup boom')` macht und sonst einen Zähler hochzählt, dazu `link(sig, () => {}, {attach: host})`. Dann:
       ```ts
       expect(() => {
         SignalGroup.clear();
       }).toThrow('cleanup boom');

       expect(siblingCleanupCalls, 'the groups after the throwing one must still be torn down').toBe(2);
       expect(getSignalGroupsCount(), 'the registry is empty after one sweep').toBe(0);
       expect(getEffectsCount()).toBe(0);
       expect(getSignalsCount()).toBe(0);
       expect(getLinksCount()).toBe(0);
       for (const group of groups) {
         expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
       }
       ```
       Vor dem Fix rot, gemessen: `siblingCleanupCalls` steht auf `0`, `getSignalGroupsCount()` auf `2`, `getEffectsCount()`/`getSignalsCount()`/`getLinksCount()` je auf `2`, und die `memberCounts` der Gruppen 2 und 3 stehen auf `{signals: 1, effects: 1, links: 1}`.
     - `it('static SignalGroup.clear() reports every failing group, AggregateError for several')` — gleicher Aufbau, aber Host 0 **und** Host 2 werfen (`'cleanup boom 0'` / `'cleanup boom 2'`). Erwartung: ein `AggregateError`, dessen `errors` beide Fehler in Sweep-Reihenfolge trägt, und ein leerer Endstand. Das Muster für die Assertion steht bereits in der Datei bei `it('reports every teardown error: …')` (`:129`) — daran entlangschreiben statt neu erfinden. Der Einzelfehler-Fall ist durch den ersten Test abgedeckt und braucht hier keine zweite Hälfte.
       Vor dem Fix rot, gemessen: geworfen wird `Error: cleanup boom 0`, **kein** `AggregateError`; danach `groups=2 signals=2 effects=2 links=2`, `siblingCleanups=0`.
     **Zum roten Lauf, damit der Implementierer nicht stolpert:** beide Tests scheitern vor dem Fix an ihren Assertionen und lassen dabei Gruppen stehen. Das `afterEach` der Datei ruft selbst `SignalGroup.clear()` — im zweiten Test wirft dieser Aufruf dann seinerseits (`'cleanup boom 2'`), Vitest meldet also zusätzlich einen Hook-Fehler. Das ist erwartet und verschwindet mit dem Fix; es gehört als Beobachtung in den Report, nicht als zusätzliche Reparatur in den Test. Keine Drain-Schleife in den Testkörper bauen: eine gescheiterte Assertion bricht den Körper ab, die Schleife liefe nie.
  2. **Der Fix, `src/SignalGroup.ts:181-187`.** Dieselbe Sammel-Strategie wie in der Instanzmethode, dieselbe Reihenfolge, keine weitere Änderung am Rumpf:
     ```ts
     static clear() {
       const errors: unknown[] = [];
       // Snapshot — each group.clear() mutates `allGroups`.
       for (const group of [...allGroups]) {
         try {
           group.clear();
         } catch (err) {
           errors.push(err);
         }
       }
       allGroups.clear();
       throwCollectedErrors(errors, 'clearing all signal groups');
     }
     ```
     Vier Festlegungen:
     - **`what` ist `'clearing all signal groups'`.** Es muss sich von `'clearing a signal group'` (Instanz-`clear()`, `src/SignalGroup.ts:819`) unterscheiden, sonst ist der Sweep in der Meldung nicht mehr von einer einzelnen Gruppe zu trennen. Die vier bestehenden Werte — `'destroying an effect'`, `'clearing a signal group'`, `'switching off a signal group'`, `'releasing SignalLink destroy-queue subscriptions'` — bleiben **unverändert**; es kommt einer dazu, es ändert sich keiner. Ergebnis der Formulierung: `[signalize] 2 errors while clearing all signal groups`.
     - **`allGroups.clear()` bleibt stehen, an derselben Stelle, vor dem Wurf.** Nach dem Fix trägt sich zwar jede Gruppe im eigenen `clear()` selbst aus (`src/SignalGroup.ts:814`), auch auf dem werfenden Pfad — der Aufruf ist im Normalfall also ein No-op. Er trägt trotzdem: eine Gruppe, die wegen `BUSY_CLEAR` übersprungen wurde (re-entranter Aufruf aus einem `DESTROY`-Listener, oben gemessen), verlässt die Menge sonst nicht. Nicht »aufräumen«.
     - **Der Wurf steht zuletzt**, nach `allGroups.clear()`, aus demselben Grund wie in der Instanzmethode: erst vollständig abgebaut, dann melden.
     - **Kein neuer Import.** `throwCollectedErrors` steht bereits in `src/SignalGroup.ts:9`.
  3. **JSDoc der statischen `clear()`** (`src/SignalGroup.ts:178-180`, heute eine Zeile »Clear and delete all SignalGroups in the global store.«). Einen Absatz anhängen, an der Formulierung der Instanzmethode (`src/SignalGroup.ts:735-740`) entlang, aber auf den Sweep gemünzt: eine Gruppe, deren Teardown wirft, stoppt den Durchlauf nicht; jeder Fehler wird gesammelt, die übrigen Gruppen werden abgeräumt, danach wird gemeldet — ein einzelner Fehler unverändert, mehrere als `AggregateError` in Sweep-Reihenfolge. Kein zweiter Absatz zur FinalizationRegistry: die statische Methode läuft nicht von dort (der Callback bei `src/SignalGroup.ts:34-38` ruft die Instanzmethode).
  4. **Der falsche Dedup-Kommentar, `src/SignalGroup.ts:542-546`** (siehe `Mitgenommen`). Der Guard `if (!this.#effects.has(effect))` bleibt Zeichen für Zeichen stehen — er ist richtig, nur seine Begründung nicht. Der neue Kommentar sagt: eventize dedupliziert diesen Listener nicht, weil `add()` nur Listener vom Typ `LISTENER_IS_OBJ` (ein Objekt) und `LISTENER_IS_NAMED_FUNC` (ein Methodenname als String oder Symbol) vergleicht; eine Funktion ist keines von beidem und wird deshalb bei jedem `once()` erneut aufgenommen — eine festgehaltene Referenz genauso oft wie eine frische Arrow-Funktion. Der Schlusssatz des heutigen Kommentars (ohne Guard wächst die `DESTROY`-Listenerliste des Effects unbegrenzt) bleibt inhaltlich stehen. Was **nicht** hineingehört: der Satz über die frische Arrow-Funktion als Ursache. Nicht länger werden als heute; fünf Zeilen sind das Maß.
  5. **`docs/api.md`, ausschließlich der statische Teil.** Zwei Stellen, beide klein:
     - Die Tabellenzeile `docs/api.md:418` (`` `SignalGroup.clear()` `` → »Clear all groups globally.«) um einen Halbsatz ergänzen: der Sweep läuft auch dann bis ans Ende, wenn der Teardown einer Gruppe wirft. Spaltenausrichtung der Tabelle von Hand nachziehen (Biome formatiert Markdown nicht).
     - Direkt **nach** der statischen Tabelle und **vor** dem `FinalizationRegistry`-Absatz (heute `docs/api.md:422`) ein Satz: die Fehler der einzelnen Gruppen werden gesammelt und nach dem vollständigen Sweep gemeldet — einer unverändert, mehrere als `AggregateError` in Sweep-Reihenfolge.
     **Abgrenzung zu Paket 7, verbindlich:** Paket 8 fasst in `docs/api.md` **nur** den statischen Block an (Tabelle `413-420` plus der neue Satz danach). Der Instanz-Teil — das Fehlerverhalten von `clear()`/`off()` und die Namensfolge des Destroy-Hooks, Zeilen `433-445` und der Fließtext darunter — bleibt Paket 7, das ihn als mitgenommenen Nebenbefund aus Paket 1 ohnehin auf der Liste hat. Zwei Pakete, zwei Blöcke, keine Kollision.
     Geprüft und **unangetastet**, mit Begründung: `docs/cheat-sheet.md:124` (`SignalGroup.clear(); // global`) und `skills/using-signalize/references/api.md:190` (`// global reset`) sind Einzeiler in einer Befehlsliste; das Fehlerverhalten eines Teardowns ist dort eine Detailtiefe, die die Zeilen daneben auch nicht führen. `skills/using-signalize/references/pitfalls.md` bekommt keine neue Nummer: der Sachverhalt ist keine Falle, sondern die Beseitigung einer. `README.md` nennt die statische `clear()` nicht. Kippt einer dieser Funde beim Schreiben, gehört die Abweichung in den Report statt in eine stille Zusatzänderung.
  6. **`CHANGELOG.md`, ausschließlich unter `## Unreleased` → `### Bug Fixes`** (der Block endet heute bei `CHANGELOG.md:60`, die neue Zeile kommt dahinter). Released Abschnitte (`## v0.x.y`) bleiben unangetastet. Eine Zeile, ein Fakt: der **statische** `SignalGroup.clear()` räumt alle registrierten Gruppen ab, auch wenn der Teardown einer von ihnen wirft; bislang brach der Sweep an der ersten werfenden Gruppe ab und ließ die übrigen vollständig aufgebaut und registriert zurück, sodass der Aufrufer die Methode in einer Schleife hätte rufen müssen. Fehler werden gesammelt und danach gemeldet, einer unverändert, mehrere als `AggregateError`.
     **Das Wort »statisch« ist nicht schmückend, sondern trennend:** die bestehende Zeile `CHANGELOG.md:52` beginnt mit »`SignalGroup.clear()` and `SignalGroup.off()`« und meint die **Instanz**methoden — in der Notation dieses Projekts (`docs/api.md:418` gegen `:444`) liest sich der Punkt aber als statischer Aufruf. Diese Zeile wird von Paket 8 **nicht** angefasst (die Präzisierung steht auf Paket 7s Liste, siehe dort); die neue Zeile muss sich deshalb aus eigener Kraft davon unterscheiden. Keine Finding-ID in der Zeile: dieses Paket hat keine, und der `## Unreleased`-Block trägt `(MEM-001)` bis `(MEM-007)` bereits aus dem vorigen Audit mit anderer Bedeutung. Der Bezug läuft, wie im ganzen Lauf, über den Commit-Titel.
  7. **Abschluss.** `pnpm world` und `pnpm test:gc` müssen grün sein. In den Report gehören: die roten Läufe aus Schritt 1 im Wortlaut (die ausgegebenen Zahlen, nicht »schlug fehl«), die Testbilanz vor/nach (Stand Paket 6: `pnpm world` 374 passed / 8 skipped, `pnpm test:gc` 382 passed; erwartet werden 376 / 8 bzw. 384), die Bestätigung, dass `src/SignalGroup.spec.ts:96` (`'SignalGroup.clear() removes all groups'` — der einzige bestehende Test der statischen Methode) unverändert grün bleibt, und ob außer den zwei neuen Tests etwas an der Bilanz gewackelt hat.

**Nebenbefund (kein Audit-Finding) · src/SignalGroup.ts:181-187** — die statische `SignalGroup.clear()` sammelt keine Teardown-Fehler

Herkunft: Review von Paket 1, dort als Nebenbefund notiert (`src/SignalGroup.ts:186-192`, vor der Umnummerierung durch den Fix). Kein `MEM-*`-Finding des Audits — MEM-001 nennt ausdrücklich die beiden Instanzmethoden `clear()` und `off()` und lässt den statischen Sweep aus.

Die Methode läuft über eine Kopie von `allGroups` und ruft für jede Gruppe deren `clear()`. Kein `try`, kein Fehler-Array. Wirft der Teardown einer Gruppe — ein Effect-Cleanup, ein `DESTROY`-Listener, ein Link —, verlässt der Fehler die Schleife und reißt den Rest des Sweeps mit: jede Gruppe, die in `allGroups` nach der werfenden steht, bleibt vollständig aufgebaut, mit laufenden Effects, lebenden Signalen, subscribten Links, und bleibt über ihren Host auffindbar. Auch `allGroups.clear()` wird nie erreicht. Das ist MEM-001 eine Ebene höher: dort brach der Abbau *einer* Gruppe an einem werfenden Mitglied ab, hier bricht der Abbau *aller* Gruppen an einer werfenden Gruppe ab. Der Fix aus Paket 1 hat den Sachverhalt gemildert, aber nicht beseitigt — er sorgt dafür, dass die werfende Gruppe selbst noch vollständig abgebaut und deregistriert wird, bevor der Fehler nach oben geht; für alles danach ändert er nichts.

Der Aufrufer hat heute keinen verlässlichen Weg, die Registry leerzubekommen: er müsste `SignalGroup.clear()` in einer Schleife rufen und jeden Wurf schlucken, bis `getSignalGroupsCount()` auf 0 steht. Die Methode ist außerdem der Standard-Teardown in vier Spec-Dateien dieses Projekts (`beforeEach`/`afterEach` in `SignalGroup.spec.ts`, `SignalGroup.off.spec.ts`, `SignalGroup.teardown.spec.ts`, `SignalGroup.gc.spec.ts`) — ein werfender Cleanup in einem Test lässt dort den nächsten Test auf fremdem Zustand aufsetzen.

Belegt mit (Build von `39eadee`, drei Gruppen mit je einem Signal, Effect und Link, der Cleanup der ersten wirft): `before: groups=3 signals=3 effects=3 links=3` → `SignalGroup.clear() threw: Error: cleanup boom 0` → `after: groups=2 signals=2 effects=2 links=2, siblingCleanups=0` (erwartet `0/0/0/0` und `siblingCleanups=2`). Die überlebenden Gruppen: `memberCounts = {signals:1, namedSignals:0, otherSignals:0, effects:1, links:1, groups:0}` je, `SignalGroup.get(host) !== undefined`. Zwei werfende Gruppen: geworfen wird nur der erste Fehler, `isAggregate=false`; der zweite erscheint erst beim nächsten Aufruf.

Empfehlung: Dieselbe Sammel-Strategie wie in der Instanzmethode seit Paket 1 — jedes `group.clear()` unter eigenem `try`, Fehler in ein Array, Sweep zu Ende ziehen, danach `throwCollectedErrors(errors, 'clearing all signal groups')`.

#### Offene Rückfrage an den Nutzer — **beantwortet am 2026-08-07: der Vorschlag ist Paket 9**

Beim Vermessen des Umfelds ist ein Sachverhalt aufgetaucht, der **nicht** zu diesem Paket gehört und den ein Paket-Planer nicht allein entscheidet, weil er Schwere »high« hat: **ein werfender Teardown in einer Gruppe, die von der FinalizationRegistry eingesammelt wird, beendet den Prozess.**

Der FR-Callback (`src/SignalGroup.ts:34-38`) ruft `group.clear()` ungeschützt. Paket 1 hat dafür gesorgt, dass der Abbau vollständig durchläuft — der Fehler wird am Ende trotzdem geworfen, und zwar in einen FinalizationRegistry-Job hinein, in dem kein Aufrufer steht. Gemessen mit `--expose-gc` gegen den Build von `39eadee`: eine Gruppe mit einem Effect, dessen Cleanup wirft, deren Host fallengelassen und per GC eingesammelt wird → `uncaughtException: Error: cleanup boom from FR`, Node bricht ab. Genau diesen Fall benennt der Finding-Text von MEM-001 als »besonders bitter« und die JSDoc der Instanz-`clear()` (`src/SignalGroup.ts:739-740`) als »out of reach of any application try/catch« — behoben wurde die Vollständigkeit des Abbaus, nicht das Ziel des Wurfs. Die Ursache ist nichtdeterministisch (GC-Zeitpunkt), der Schaden maximal (Prozessende), die Auslösebedingung realistisch (ein werfender Cleanup irgendwo in einer vergessenen Komponente).

Vorschlag: **als eigenes Paket 9 aufnehmen**, nicht hier anhängen — es ist eine Verhaltensänderung an einer anderen Methode, mit eigener Entscheidung und eigenem Test (der nur unter `pnpm test:gc` läuft, wie `SignalGroup.gc.spec.ts`). Inhaltlich: den `clear()`-Aufruf im FR-Callback in ein `try/catch` legen und den Fehler über `console.error` melden, mit derselben Begründung, die `emitEffectError` in `src/EffectImpl.ts:80-98` schon ausformuliert — ein stiller Schlucker wäre schlimmer als der Absturz, ein erneuter Wurf ist hier aber sinnlos, weil niemand ihn fangen kann. Der `onEffectError`-Kanal selbst scheidet aus: `emitEffectError` verlangt einen `EffectImpl` für seine Payload, eine Gruppe hat keinen. Alternative, falls kein weiteres Paket gewünscht ist: als Finding ins nächste Audit, mit dem Vermerk, dass die Messung schon vorliegt.

Abgearbeitet in Zug 0 von Paket 8 (2026-08-07) — der Eingabestapel aus Paket 6, dazu eine Nachlese über die Stapel der Pakete 1 bis 5:
- **`src/SignalAutoMap.spec.ts:432-433`** (Kleiner Review-Befund aus Paket 6) → **Paket 7**. Der Punkt ist eine irreführende Behauptung im Testkommentar, nicht die Assertion selbst; Paket 7 korrigiert ohnehin Kommentare in zwei Spec-Dateien (`src/effects.spec.ts:69-70`, `src/effects.async.spec.ts:376-379`), das ist dieselbe Sorte Arbeit. Mit Auflage: **die Assertionen bleiben unangetastet**, korrigiert wird der Anspruch, den der Kommentar erhebt.
- **Die drei Nebenbefunde aus Paket 6** (`src/SignalAutoMap.ts:60-65` — `clear()` zerstört vor dem Austragen; `src/SignalAutoMap.ts:29` — `fromProps()` übernimmt ein fremdes Signal per Identität; `src/Signal.ts:14-59` — kein `destroyed`-Getter) → **nächstes Audit**. Kein offenes Paket fasst `src/SignalAutoMap.ts` oder `src/Signal.ts` noch einmal an, Paket 7 ist Prosa und Paket 8 ist `SignalGroup`; alle drei sind Verhaltens- oder API-Fragen, keine Doku. Dieselbe Begründung, mit der die Thenable-Testlücke aus Paket 3 und die beiden Alt-Tests aus Paket 4 dorthin gegangen sind. Der `clear()`-Punkt bekommt fürs nächste Audit den Zusatz, dass dieselbe Methode auch **keine Fehler sammelt** — ein werfender `sig.destroy()` bricht dort den Rest des `clear()` ab, dieselbe Familie wie MEM-001 und wie dieses Paket, nur in einer anderen Klasse.
- **Nachlese Paket 1, »Kleine Review-Befunde«** — zwei Punkte waren nie zugewiesen: `SignalGroup#memberCounts` steht trotz `@internal` in `lib/SignalGroup.d.ts`, weil `tsconfig.lib.json` kein `stripInternal` setzt → **nächstes Audit** (eine Build-Config-Frage, kein Doku-Satz, und sie betrifft mit `Effect#onDestroy` mindestens eine zweite Stelle aus dem Vorlauf — das gehört zusammen bewertet, nicht einzeln nachgezogen). Und die Coverage-Delle 97,03 → 96,36 durch ungetestete `catch`-Zweige (werfendes `link.destroy()`, werfendes `childGroup.clear()`, werfender `OFF`-Listener) → **nächstes Audit**; kein Gate schlägt an, und die zwei Tests aus Schritt 1 dieses Pakets decken einen weiteren solchen Zweig ab, ohne dass daraus ein Test-Paket würde.
- **Nachlese Paket 3** — die Übergabezeile am Ende von Paket 3 spricht von »vier Prosa-Befunden« und zählt dann fünf auf; Paket 7 führt sie richtig mit fünf. Zahl in Paket 3 korrigiert, sonst nichts.
- **Neu für Paket 7 aufgenommen:** die Zeile `CHANGELOG.md:52` beginnt mit »`SignalGroup.clear()` and `SignalGroup.off()`« und meint die Instanzmethoden, liest sich in der Notation dieses Projekts aber als statischer Aufruf — spätestens neben der neuen Zeile aus Paket 8, die den statischen Sweep beschreibt, ist das eine Verwechslung mit Ansage. Die Zeile steht unter `## Unreleased` und darf korrigiert werden; Paket 7 hat mit `CHANGELOG.md:75` ohnehin ein Ziel in derselben Datei.
- Nichts mehr offen aus den Stapeln der Pakete 1 bis 6.

### [x] 9. FinalizationRegistry-Callback: den Wurf melden statt den Prozess beenden
- Erledigt · Hash: `53994f0` · Verify vom Orchestrator: `pnpm world` Exit 0, 377 passed / 9 skipped; `pnpm test:gc` Exit 0, 386 passed. Keine Nachbesserungsrunde nötig.

#### Vom Review bestätigt
- Der Guard fängt beide Wurfarten (durchgereichter Einzelfehler, `AggregateError`) und alle ungeschützten Zwischenschritte von `clear()`; Registrierung und `unregister()` sind unverschoben, der Uncaught-Stack des roten Laufs endet nachweislich auf dem neuen `clearGroupFromFinalizer`.
- Er greift nicht zu breit: `SignalGroup.delete()`, die statische `clear()`, der rekursive Kind-Pfad und das deprecated `destroy()` werfen weiterhin an ihren Aufrufer.
- Beide Tests wurden vom Reviewer ohne Guard nachgefahren und sind rot; Test A ruft dieselbe Modul-Konstante, die die Registry hält, keine Attrappe.

#### Kleine Review-Befunde
- **`.github/workflows/ci.yml:36`** — der Kommentar spricht von »those four tests«, die Datei hat jetzt fünf. → Paket 7. Nebenbei bestätigt: CI fährt `pnpm test:gc` sehr wohl, anders als `CLAUDE.md` behauptet.
- **`lib/SignalGroup.d.ts:6`** — `clearGroupFromFinalizer` steht in den ausgelieferten Typen, weil `stripInternal` nicht gesetzt ist. Kein unterstützter Importpfad erreicht ihn (selektiver Reexport, keine Wildcard in der `exports`-Map, im Bundle nicht exportiert). Bekannter, vertagter Nebeneffekt.
- **`src/SignalGroup.gc.spec.ts:145-179`** — feuert die FR nicht innerhalb der 20 Runden, scheitert zusätzlich das `afterEach` am selben werfenden Cleanup. Lärmverstärker in einem ohnehin roten Lauf.
- Kein Test deckt den `AggregateError`-Fall über den Finalizer ab; das `catch` ist typlos, betroffen ist nur die Ausgabeform.

#### Detailplan (Zug 0)
- Findings: **keines aus dem Audit.** Nebenbefund, gemessen in Zug 0 von Paket 8 und dort als »Offene Rückfrage« vorgelegt; vom Nutzer am 2026-08-07 als eigenes Paket freigegeben (siehe »Entscheidungen«). MEM-001 zeigt im Finding-Text ausdrücklich auf diese Stelle (»besonders bitter: `clear()` läuft auch aus dem FinalizationRegistry-Callback, wo kein Anwendungscode den Wurf je auffangen kann«), adressiert sie in seiner Empfehlung aber nicht — Paket 1 hat den Abbau vollständig gemacht, nicht das Ziel des Wurfs.
- Ziel: Ein werfender Teardown in einer Gruppe, die die FinalizationRegistry einsammelt, wird gemeldet statt in einen Job ohne Aufrufer geworfen, wo er den Prozess beendet.
- Bereich: `src/SignalGroup.ts` (der FR-Callback bei `:34-38`, sonst nichts an der Klasse)
- Hängt ab von: Paket 1 (der Wurf, um den es geht, ist der von `throwCollectedErrors` am Ende der Instanz-`clear()`); läuft **vor** Paket 7, damit die Doku den Endstand beschreibt
- Modell: mittlere Stufe (final. Der Produktivcode steht unten wörtlich und ist zwölf Zeilen, der Meldungstext ist festgelegt, alle Erwartungswerte sind gegen den `lib/`-Build von `8e91fc4` ausgemessen. Was Urteil verlangt, ist die Reihenfolge von Extraktion, rotem Lauf und Guard — der rote Lauf des GC-Tests sieht anders aus als in jedem anderen Paket dieses Laufs, und wer das nicht versteht, repariert den Test statt den Code. Die günstigste Stufe würde daran scheitern.)
- Hash: —
- Dateien: `src/SignalGroup.ts`, `src/SignalGroup.teardown.spec.ts`, `src/SignalGroup.gc.spec.ts`, `CHANGELOG.md`
- Verify: `pnpm world` (= CI: clean + biome check + tsc + rollup + vitest) und zusätzlich `pnpm test:gc`. **Nicht** `npx tsc --noEmit -p tsconfig.json`: diese Config meldet 6 vorbestehende Fehler in `node_modules` (`unplugin`/`webpack`-Typen), kein Script fährt sie. Während der Arbeit: `npx vitest run SignalGroup.teardown.spec.ts` und `npx vitest run --config vitest.gc.config.ts` (`pnpm test -- <datei>` filtert nicht — bekannte Eigenheit, das Script endet auf `vitest run --coverage`).
- Commit: `fix(group): report a throwing teardown from the FinalizationRegistry instead of crashing`
- Abgleich (2026-08-07, Zug 0): **Sachverhalt reproduziert, Fundstelle unverändert.** Der Callback steht weiter bei `src/SignalGroup.ts:34-38` und ist Zeichen für Zeichen der aus Zug 0 von Paket 8: `new FinalizationRegistry<SignalGroup>((group) => { if (allGroups.has(group)) group.clear(); })`, kein `try`. Paket 8 hat nur die statische `clear()` (`:186-198`) angefasst und den Callback ausdrücklich stehen lassen.

  Alle Zahlen gegen den `lib/`-Build von `8e91fc4`, frisch mit `pnpm dist` erzeugt, Node 25.9.0, `--expose-gc`.
  - **Der Crash reproduziert.** Eine Gruppe mit einem Effect, dessen Cleanup wirft, Host fallengelassen, GC-Schleife (5× `gc()` + `setImmediate`, bis zu 20 Runden): `before drop: groups = 1` → Node bricht ab mit `Error: cleanup boom from FR 0`, **Exit-Code 1**, ohne dass irgendein Anwendungs-`try` erreichbar wäre. Der Stack nennt den Weg vollständig: `at EffectImpl.runCleanupCallback` → `at EffectImpl.destroy` → `at SignalGroup.clear` → `at file:///…/lib/SignalGroup.js:10:15`, und das ist der FR-Callback. Der Wurf selbst kommt aus `lib/collect-errors.js:5` (`throw errors[0]`).
  - **Mit einem `process.on('uncaughtException')` gegengeprüft**, um zu sehen, was ankommt: bei **einem** werfenden Cleanup `Error | cleanup boom from FR 0`, bei **zwei** `AggregateError | [signalize] 2 errors while clearing a signal group` mit `.errors = ['cleanup boom from FR 0', 'cleanup boom from FR 1']` in Teardown-Reihenfolge. Beide Male steht danach `groups = 0` — Paket 1 zieht den Abbau durch, der Prozess stirbt trotzdem.
  - **Der Abbau ist zum Zeitpunkt des Wurfs vollständig**, gemessen an einer lebenden Gruppe in exakt der Form des geplanten Tests (ein Signal, zwei Effects — der erste wirft im Cleanup, der zweite zählt —, ein Callback-Link): `before: {signals:1, effects:2, links:1}` → `try { group.clear() } catch` fängt `Error: cleanup boom from FR` → `sibling cleanup ran: 1`, `memberCounts` komplett `0`, `groups/signals/effects/links` alle zurück auf Baseline, `SignalGroup.get(host) === undefined`. Ein `catch` verliert hier also nichts außer dem Wurf.
  - **Die Gruppe hat im FR-Callback keine Identität, die man melden könnte.** Gemessen: `Object.keys(group)` ist leer (alle Felder sind `#private`), das Prototyp-Inventar enthält kein `id` und kein `name` (`'id' in group === false`, `'name' in group === false`), `String(group)` ist `[object Object]`. Und `#storeKey` hilft nicht: eine `WeakRef` auf den Host, aus einem `DESTROY`-Listener während des FR-getriebenen `clear()` heraus gemessen, derefert bereits zu `undefined` — der Host ist per Definition weg, sonst wäre der Callback nie gelaufen. Konsequenz für Schritt 4: keine Gruppen-Kennung in die Meldung. Was den Ort tatsächlich benennt, ist der Stack des Fehlers, und den gibt `console.error` als zweites Argument ohnehin aus.
  - **Kein zweiter Ort dieser Art im Paket.** Ein Sweep über `src/` nach `FinalizationRegistry`, `WeakRef`, `queueMicrotask`, `setTimeout`, `setImmediate`, `process.nextTick` und `.then(` (ohne Specs) liefert genau vier Treffer, von denen keiner ein zweites Paket 9 ist:
    - `src/link.ts:71` — der zweite `FinalizationRegistry` des Pakets. Sein Callback ist `if (gLinksCount > 0) { gLinksCount -= 1; }`: eine Zahl, kein Aufruf, kein Anwendungscode. Er kann nicht werfen. **Kein Handlungsbedarf**, und das ist kein Zufall, sondern der ausdrückliche Zuschnitt aus MEM-007 — der Kommentar bei `src/link.ts:59-70` sagt selbst, dass dies Buchführung ist und kein Aufräumpfad.
    - `src/EffectImpl.ts:723` — der `Promise.resolve(result).then(…)`-Block, ebenfalls ein Kontext ohne Aufrufer. Er ist bereits versorgt: beide Zweige gehen über `emitEffectError` (`src/EffectImpl.ts:99-126`), also `onEffectError` mit `console.error` als Rückfall. Das ist genau das Muster, das dieses Paket auf die Gruppe überträgt. **Kein Handlungsbedarf.**
    - `src/SignalLink.ts:79` und `:417` — `WeakRef`s in Listener-Closures, keine Registry, kein Callback ohne Aufrufer. Die Closures laufen aus einem `emit()` heraus, also mit einem Aufrufer im Stack. **Kein Handlungsbedarf.**
  - **Was der `catch` fangen muss, ist abschließend bekannt.** Aus `clear()` kommen heraus: der von `throwCollectedErrors` durchgereichte Einzelfehler, der `AggregateError` bei mehreren (beides oben gemessen), ein `RangeError` aus einer entarteten Gruppen-Rekursion (der Grund, aus dem `BUSY_CLEAR` überhaupt existiert, siehe `src/SignalGroup.ts:48-68`) — und theoretisch ein Fehler aus den ungeschützten internen Schritten zwischen den Schleifen. Die sind durchgesehen und führen sämtlich in keinen Anwendungscode: `off(this)`, die sieben `.clear()`-Aufrufe auf den eigenen Collections, die `unsubscribe()`-Handles, `this.#parentGroup?.detachGroup(this)` (`src/SignalGroup.ts:274-280` — zwei `Set`-Operationen), `store.delete`, `allGroups.delete`, `groupFinalizationRegistry.unregister`. Ein typloses `catch (err)` deckt die Menge vollständig ab; es braucht **keine** Fallunterscheidung nach `AggregateError`.

- Vorgehen:
  1. **Zuerst extrahieren, ohne etwas zu ändern.** Der Callback wird aus dem `new FinalizationRegistry(…)`-Ausdruck herausgezogen und bekommt einen Namen — noch **ohne** `try/catch`. Das ist ein reiner Refactor, die Suite bleibt grün, und erst dadurch kann Schritt 2 einen echten roten Lauf zeigen statt eines Compile-Fehlers.
     ```ts
     /**
      * … (JSDoc kommt in Schritt 5)
      * @internal Exported for the regression test in `SignalGroup.teardown.spec.ts`.
      */
     export const clearGroupFromFinalizer = (group: SignalGroup): void => {
       if (allGroups.has(group)) {
         group.clear();
       }
     };

     const groupFinalizationRegistry = new FinalizationRegistry<SignalGroup>(
       clearGroupFromFinalizer,
     );
     ```
     Drei Festlegungen dazu:
     - **Die Reihenfolge im Modul ist zwingend**: `clearGroupFromFinalizer` ist eine `const`-Arrow und muss **vor** `groupFinalizationRegistry` stehen, sonst liest die Initialisierung in die TDZ. `allGroups` (`src/SignalGroup.ts:27`) steht bereits darüber. Der bestehende Erklärkommentar bei `:29-33` bleibt, wo er ist, und behält seinen Inhalt.
     - **`export` plus `@internal`, kein Eintrag in `src/index.ts`.** `src/index.ts:23` exportiert aus dieser Datei selektiv (`export {getSignalGroupsCount, SignalGroup}`), nicht per `*` — die öffentliche Oberfläche des Pakets ändert sich also nicht. Präzedenzfall ist `SignalGroup#memberCounts` (`src/SignalGroup.ts:625`), ebenfalls `@internal` und ebenfalls nur für `src/assert-helpers.ts` da. Bekannter Nebeneffekt, **kein neuer Sachverhalt**: `tsconfig.lib.json` setzt kein `stripInternal`, der Name landet damit in `lib/SignalGroup.d.ts`. Genau das ist der Punkt, der aus Paket 1 fürs nächste Audit vorgemerkt ist; er wird hier nicht schlimmer und **nicht** nebenbei mitrepariert.
     - **Kein Umweg über `src/assert-helpers.ts`.** Diese Datei kann Modul-privaten Zustand von `SignalGroup.ts` nicht erreichen; ein Wrapper dort würde nur eine Zeile mehr Indirektion um denselben Import legen. Der Test importiert direkt aus `./SignalGroup.js`.
  2. **Roter Test A — deterministisch, in `src/SignalGroup.teardown.spec.ts`**, als neues `it()` am Ende des bestehenden `describe('SignalGroup teardown robustness')` (der letzte Test endet nach Paket 8 bei Zeile 415, die schließende Klammer des `describe` bei 417 — Zeilen prüfen, nicht glauben). Er ruft den in Schritt 1 extrahierten Callback direkt auf und wartet damit auf **keine** GC. Neu zu importieren: `clearGroupFromFinalizer` in die bestehende Zeile `import {getSignalGroupsCount, SignalGroup} from './SignalGroup.js';` (`:16`) und `import type {MockInstance} from 'vitest';` — das Spy-Muster steht wortgleich in `src/createSignal.spec.ts:1,20,24`; hier auf `console.error` statt `console.warn`. Der Spy gehört in dieses eine `it()` und wird am Ende per `mockRestore()` zurückgenommen, **nicht** in das gemeinsame `beforeEach`/`afterEach` des `describe` — die Nachbartests sollen ihre `console.error`-Ausgaben behalten.
     Aufbau wie im ersten Test der Datei (`:34-80`): ein Host, ein attachtes Signal, zwei attachte Effects (der erste wirft im Cleanup, der zweite zählt hoch), ein attachter Callback-Link. Dann:
     ```ts
     const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
     try {
       expect(() => {
         clearGroupFromFinalizer(group);
       }, 'the finalizer must never let a teardown error escape').not.toThrow();

       expect(errorSpy).toHaveBeenCalledTimes(1);
       expect(errorSpy.mock.calls[0][0]).toContain('FinalizationRegistry');
       expect(errorSpy.mock.calls[0][1]).toBeInstanceOf(Error);
       expect((errorSpy.mock.calls[0][1] as Error).message).toBe('cleanup boom');
     } finally {
       errorSpy.mockRestore();
     }

     expect(siblingCleanupCalls, 'sibling cleanup must still run').toBe(1);
     expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
     expect(getSignalGroupsCount(), 'groups after the finalizer').toBe(groupsBefore);
     expect(getEffectsCount()).toBe(effectsBefore);
     expect(getSignalsCount()).toBe(signalsBefore);
     expect(getLinksCount()).toBe(linksBefore);
     ```
     Vor dem Fix rot, und zwar an der ersten Assertion: `clearGroupFromFinalizer()` wirft `Error: cleanup boom` durch, `console.error` wird nie gerufen. Alles darunter ist nach dem `catch` bereits heute erfüllt — oben gemessen: `sibling cleanup ran: 1`, `memberCounts` komplett `0`, alle vier Zähler auf Baseline, `SignalGroup.get(host) === undefined`. Diese Zeilen sind der Nachweis, dass der Guard nichts verschluckt, was Paket 1 aufgebaut hat; sie sind nicht der rote Teil.
     **Das `finally` um den Spy ist nicht Zierde:** scheitert eine der Spy-Assertionen, bricht der Testkörper ab, und ein nicht zurückgenommener `console.error`-Spy verschluckt danach die Ausgaben jedes weiteren Tests in derselben Datei. `clearMocks: true` in `vitest.config.ts` setzt Aufrufzähler zurück, es stellt die Original-Implementierung nicht wieder her.
  3. **Roter Test B — das echte GC-Ende, in `src/SignalGroup.gc.spec.ts`**, als neues `it()` am Ende des bestehenden `gcDescribe`-Blocks (der letzte Test endet bei Zeile 142). Er belegt die Zusage dort, wo sie gilt: am tatsächlichen FinalizationRegistry-Job. Neu zu importieren: `createEffect` steht bereits (`:9`), dazu `import type {MockInstance} from 'vitest';`.
     ```ts
     it('a throwing teardown in an FR-collected group is reported, not thrown', async () => {
       const baselineGroups = getSignalGroupsCount();
       const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

       try {
         let host: object | null = {marker: 'fr-throwing-cleanup'};
         SignalGroup.findOrCreate(host);
         createEffect(
           () => () => {
             throw new Error('cleanup boom from FR');
           },
           {attach: host},
         );

         host = null;

         for (let i = 0; i < 20 && getSignalGroupsCount() > baselineGroups; i += 1) {
           await forceGc();
         }

         expect(getSignalGroupsCount()).toBe(baselineGroups);
         expect(errorSpy).toHaveBeenCalledTimes(1);
         expect((errorSpy.mock.calls[0][1] as Error).message).toBe(
           'cleanup boom from FR',
         );
       } finally {
         errorSpy.mockRestore();
       }
     });
     ```
     **Der rote Lauf dieses Tests sieht anders aus als jeder andere in diesem Plan — bitte lesen, bevor du ihn für kaputt hältst.** Gemessen (Vitest 4.1.10, `pool: 'forks'`, `execArgv: ['--expose-gc']`, ein Nachbau dieses Tests gegen den `lib/`-Build von `8e91fc4`): Vitest fängt den `uncaughtException` selbst ab und meldet ihn als `⎯⎯ Unhandled Errors ⎯⎯ / Uncaught Exception: Error: cleanup boom from FR`, mit einem Stack, der über `EffectImpl.runCleanupCallback → EffectImpl.destroy → SignalGroup.clear → src/SignalGroup.ts:36` läuft. Die Ausgabe zählt dabei `Test Files 1 passed`, `Tests 2 passed`, `Errors 1 error` — **und der Prozess endet mit Exit-Code 1**. Der rote Beweis ist also der Exit-Code plus der Unhandled-Errors-Block, nicht eine fehlgeschlagene Assertion. Zwei Folgerungen: der Lauf gatet, `pnpm test:gc` schlägt vor dem Fix fehl (das ist der Punkt); und die Assertion auf den Spy ist trotzdem nötig, weil ohne sie nach dem Fix nichts mehr die neue Zusage prüfen würde.
     **Warum das nicht deterministisch geht und Test A trotzdem nicht reicht:** einen FinalizationRegistry-Job kann kein Testcode auslösen — `gc()` ist ein Hinweis, kein Befehl, und ob der Callback innerhalb des Budgets läuft, entscheidet V8. Test A prüft deshalb die Zusage (der Callback lässt nichts entkommen) an der Funktion, Test B prüft, dass diese Funktion auch wirklich diejenige ist, die die Registry ruft. Ohne A hinge alles am GC-Timing, ohne B könnte die Extraktion am Registrierungspunkt vorbeigehen und niemand merkte es. Das Retry-Budget (20 Runden `forceGc()`) ist wortgleich das der drei bestehenden FR-Tests der Datei (`:87`, `:114`) und wird nicht neu erfunden.
     **Eine Beobachtung fürs Protokoll, keine Zusatzreparatur:** feuert die FR im roten Lauf nicht innerhalb des Budgets, bleibt die Gruppe stehen, und das `afterEach` der Datei (`:34`, `SignalGroup.clear()`) wirft dann seinerseits `cleanup boom from FR`. Vitest meldet das als Hook-Fehler. Erwartet, verschwindet mit dem Fix, gehört in den Report — **nicht** in eine Drain-Schleife im Testkörper.
  4. **Der Fix, `src/SignalGroup.ts`.** Der in Schritt 1 extrahierte Rumpf bekommt seinen Guard, sonst ändert sich nichts:
     ```ts
     export const clearGroupFromFinalizer = (group: SignalGroup): void => {
       if (!allGroups.has(group)) return;
       try {
         group.clear();
       } catch (err) {
         console.error(
           '[signalize] a SignalGroup teardown threw in the FinalizationRegistry callback, where no caller can catch it:',
           err,
         );
       }
     };
     ```
     Fünf Festlegungen:
     - **Der Wortlaut steht so, wie er dasteht.** Er folgt der Hausform von `emitEffectError` (`src/EffectImpl.ts:122-125`): Präfix `[signalize] `, danach klein weiter, Doppelpunkt am Ende, der Fehler als **zweites** Argument statt interpoliert. Das zweite Argument ist nicht Kosmetik — es sorgt dafür, dass Node den vollen Stack ausgibt, und bei einem `AggregateError` zusätzlich das ausgeklappte `[errors]`-Array mit je eigenem Stack (nachgemessen). Deshalb auch **kein** `${err}` und kein `err.message` im Template.
     - **Keine Gruppen-Kennung in der Meldung.** Es gibt keine: kein `id`, kein `name`, `String(group)` ist `[object Object]`, und die `WeakRef` auf den Host ist zum Zeitpunkt des Callbacks bereits leer (alles im `Abgleich` gemessen). Ein mitgegebenes `group`-Objekt druckte `SignalGroup {}` — alle Felder sind `#private` — und wäre reines Rauschen. Wer wissen will, welche Gruppe es war, liest den Stack des Fehlers; der nennt Cleanup, Effect und Aufrufweg. Falls dir beim Schreiben doch eine tragfähige Kennung auffällt, gehört sie in den Report, **nicht** still in die Meldung.
     - **Typloses `catch (err)`, keine Fallunterscheidung.** Es kommen Einzelfehler, `AggregateError` und im Extremfall ein `RangeError` an; die Aufzählung im `Abgleich` ist vollständig. Ein `instanceof`-Zweig würde nur die Meldung verdoppeln, ohne etwas hinzuzufügen.
     - **Der `allGroups.has()`-Guard bleibt außerhalb des `try`** und wird zum Frühausstieg umgestellt (`if (!…) return;`). Er ist eine `Set`-Abfrage und kann nicht werfen; ihn mit einzuschließen wäre nicht falsch, aber der Guard und die Fehlerbehandlung sind zwei verschiedene Dinge, und die freigegebene Fassung sagt »`try/catch` um den `clear()`-Aufruf«.
     - **Kein Weg über `onEffectError`.** `emitEffectError` verlangt einen `EffectImpl` für `effect` und `effectId` in seiner Payload (`src/EffectImpl.ts:99-110`, Typ `EffectErrorPayload`); eine Gruppe hat keinen, und der werfende Cleanup gehört unter Umständen zu keinem der Effects, die sie hielt. Ein synthetischer Effect nur für die Payload wäre eine Lüge im Typ. `console.error` ist hier nicht der zweitbeste Kanal, sondern derselbe, auf den `emitEffectError` mangels Handler ohnehin zurückfällt.
  5. **Der Erklärkommentar.** Der Block bei `src/SignalGroup.ts:29-33` beschreibt heute, *warum* es die Registry gibt (Auto-Cleanup, FR-Timing nichtdeterministisch, verhindert den Worst-Case-Leak). Er bleibt inhaltlich stehen und wandert an die neue Funktion. Dazu kommt ein Absatz, der den Guard begründet — an der Argumentation von `emitEffectError` (`src/EffectImpl.ts:79-98`) entlang, aber auf diesen Fall gemünzt: seit Paket 1 zieht `clear()` den Abbau vollständig durch und wirft erst danach; geworfen wird dabei in einen FinalizationRegistry-Job, in dem kein Aufrufer steht, und ein `uncaughtException` von dort beendet den Prozess. Ein erneuter Wurf wäre also genau der Absturz, aus dem wir kommen — und stilles Schlucken wäre schlimmer als der Absturz, weil ein werfender Cleanup dann für immer unsichtbar bliebe. Deshalb: melden, nie weiterwerfen. Ein Satz gehört dazu, den es sonst nirgends gibt: dies ist der einzige Pfad im Paket, auf dem `clear()` ohne Aufrufer läuft — auf jedem anderen bekommt der Aufrufer seinen Fehler unverändert. **Nicht länger als der Block, den er ersetzt, plus diesen Absatz.**
     Nachzuziehen ist außerdem der JSDoc-Halbsatz der Instanz-`clear()` bei `src/SignalGroup.ts:750-751` (»This matters most where nobody is listening: `clear()` also runs from the FinalizationRegistry callback, out of reach of any application try/catch.«). Der Satz bleibt richtig, ist aber ab jetzt unvollständig: er soll sagen, dass der Fehler von dort nicht ins Leere geht, sondern auf `console.error` landet. Ein Halbsatz, keine Umschreibung des Absatzes.
  6. **`CHANGELOG.md`, ausschließlich unter `## Unreleased` → `### Bug Fixes`.** Der Block endet nach Paket 8 mit der Zeile über den statischen `SignalGroup.clear()`-Sweep, direkt vor `### Documentation`; die neue Zeile kommt dahinter — **über den Inhalt suchen, nicht über die Zeilennummer**, sie ist durch Paket 6 und 8 gewandert. Released Abschnitte (`## v0.x.y`) bleiben unangetastet. Eine Zeile, ein Fakt: wirft der Teardown einer Gruppe, die die `FinalizationRegistry` einsammelt, beendet das nicht mehr den Prozess — der Fehler wird über `console.error` gemeldet, weil ein Registry-Callback keinen Aufrufer hat, dem man ihn geben könnte. Keine Finding-ID: dieses Paket hat keine, und derselbe `## Unreleased`-Block trägt `(MEM-001)` bis `(MEM-007)` bereits aus dem **vorigen** Audit mit anderer Bedeutung. Der Bezug läuft, wie im ganzen Lauf, über den Commit-Titel.
     Die bestehende Zeile weiter oben im selben Block (»…`clear()`: it runs from the `FinalizationRegistry` callback, where a `RangeError` is out of reach for any application-level `try`/`catch` and takes the process down (BUG-002)«) wird **nicht** angefasst: sie beschreibt einen anderen Fix aus einem anderen Lauf, und der `RangeError`, den sie meint, kommt nach diesem Paket ebenfalls auf `console.error` — die Zeile wird dadurch nicht falsch, nur älter.
  7. **Prosa: nichts, alles an Paket 7.** In `docs/`, `skills/` und `README.md` beschreiben sieben Stellen die automatische Bereinigung (`docs/api.md:425-431`, `docs/architecture.md:110-118`, `skills/using-signalize/references/pitfalls.md:70-74` — Pitfall 16a mit seiner »Three limits«-Liste —, `skills/using-signalize/SKILL.md:22,56`, `skills/using-signalize/references/api.md:218`, `docs/recipes.md:380-381`, `README.md:283-284`). Keine davon fasst dieses Paket an. Grund: **Paket 7 (MEM-010) schreibt genau diese Absätze ohnehin um** — sein Auftrag ist, die Blocker der automatischen Bereinigung vollständig zu benennen —, es läuft nach diesem Paket und beschreibt damit den Endstand. Zwei Pakete im selben Absatz sind genau das, was dieser Plan seit Paket 5 vermeidet. Der Eintrag steht namentlich unter Paket 7 (`Mitgenommen`, aus Zug 0 von Paket 9). **Falls beim Schreiben des Codes auffällt, dass eine dieser Stellen durch den Fix nicht nur unvollständig, sondern falsch wird, gehört das in den Report** — dann entscheidet der Orchestrator, ob die Stelle vorgezogen wird.
  8. **Abschluss.** `pnpm world` und `pnpm test:gc` müssen grün sein. In den Report gehören: der rote Lauf aus Schritt 2 im Wortlaut (welche Assertion, mit welchem Fehler), der rote Lauf aus Schritt 3 in der oben beschriebenen Form (Unhandled-Errors-Block plus Exit-Code, nicht »schlug fehl«), die Testbilanz vor/nach (Stand Paket 8: `pnpm world` 376 passed / 8 skipped, `pnpm test:gc` 384 passed; erwartet werden **377 passed / 9 skipped** bzw. **386 passed** — Test A läuft in beiden Suiten, Test B nur unter `test:gc` und erhöht in `pnpm world` deshalb die Skip-Zahl, nicht die Pass-Zahl; die 8 Skips von heute sind genau die beiden `*.gc.spec.ts`-Dateien), die Bestätigung, dass die vier bestehenden Tests in `src/SignalGroup.gc.spec.ts` unverändert grün bleiben, und ob außer den zwei neuen Tests etwas an der Bilanz gewackelt hat.

**Nebenbefund (kein Audit-Finding) · src/SignalGroup.ts:34-38** — ein werfender Teardown im FinalizationRegistry-Callback beendet den Prozess

Herkunft: gemessen in Zug 0 von Paket 8 beim Vermessen des Umfelds, dort als »Offene Rückfrage an den Nutzer« vorgelegt, weil die Schwere »high« über dem liegt, was ein Paket-Planer allein aufnimmt. Am 2026-08-07 vom Nutzer als eigenes Paket freigegeben. Kein `MEM-*`-Finding: MEM-001 nennt die Stelle in seinem Fließtext (»besonders bitter«), seine Empfehlung und seine Belegzahlen betreffen aber ausschließlich die Vollständigkeit des Abbaus.

Der Callback ist `(group) => { if (allGroups.has(group)) group.clear(); }` — kein `try`. Seit Paket 1 zieht `clear()` den Abbau vollständig durch und wirft erst am Ende, gesammelt; nur landet dieser Wurf in einem FinalizationRegistry-Job, und dort steht kein Aufrufer. Ein Anwendungs-`try/catch` kann ihn nicht erreichen: nicht um die Stelle, an der das Objekt fallengelassen wurde (die ist längst verlassen), nicht um irgendeinen anderen Frame, denn die Registry ruft aus einem eigenen Job heraus. Node behandelt das als `uncaughtException` und beendet den Prozess. Die Auslösebedingung ist alltäglich — irgendein Effect-Cleanup in irgendeiner vergessenen Komponente wirft —, der Zeitpunkt ist unvorhersagbar (GC), und der Schaden ist maximal. Paket 1 hat den Fall dabei nicht verschlimmert, sondern die bessere Hälfte schon behoben: die Gruppe wird vollständig abgebaut, bevor der Prozess stirbt.

Belegt mit (Build von `8e91fc4`, Node 25.9.0, `--expose-gc`; eine Gruppe mit einem Effect, dessen Cleanup wirft, Host fallengelassen): `before drop: groups = 1` → Node bricht ab mit `Error: cleanup boom from FR 0`, Exit-Code 1, Stack `EffectImpl.runCleanupCallback → EffectImpl.destroy → SignalGroup.clear → lib/SignalGroup.js:10:15` (der FR-Callback), geworfen aus `lib/collect-errors.js:5`. Mit einem `uncaughtException`-Handler gegengeprüft: bei einem werfenden Cleanup `Error: cleanup boom from FR 0`, bei zweien `AggregateError: [signalize] 2 errors while clearing a signal group` mit beiden Fehlern in `.errors`; beide Male steht danach `groups = 0`. Unter Vitest (`pool: 'forks'`, `--expose-gc`) erscheint derselbe Wurf als `Unhandled Errors / Uncaught Exception`, alle `it()` gelten als bestanden, und der Lauf endet trotzdem mit Exit-Code 1.

Empfehlung (vom Nutzer freigegeben): `try/catch` um den `clear()`-Aufruf, Meldung über `console.error` mit derselben Begründung, die `emitEffectError` (`src/EffectImpl.ts:79-98`) bereits ausformuliert — ein erneuter Wurf ist sinnlos, weil niemand ihn fangen kann, ein stiller Schlucker wäre schlimmer als der Absturz. Der `onEffectError`-Kanal scheidet aus: seine Payload verlangt einen `EffectImpl`, eine Gruppe hat keinen.

#### Abgearbeitet in Zug 0 von Paket 9 (2026-08-07) — der Eingabestapel aus Paket 8
- **`src/SignalGroup.ts:196`** (»Kleine Review-Befunde« zu Paket 8) — legt ein `DESTROY`-Listener während des Sweeps eine neue Gruppe an, wischt das unbedingte `allGroups.clear()` sie aus der Registry, obwohl kein Sweep sie je abgebaut hat. → **nächstes Audit**, wie vom Reviewer vorgeschlagen. Kein offenes Paket fasst die statische `clear()` noch einmal an (Paket 9 ist der FR-Callback, Paket 7 ist Prosa), der Befund ist identisch zu `HEAD` und damit nicht von diesem Lauf verursacht, und eine Reparatur wäre eine Verhaltensentscheidung über die Sichtbarkeit spät angelegter Gruppen — kein Anhängsel.
- **`src/SignalGroup.teardown.spec.ts:378`** — `[0,1,2].map(…)` mit ungenutztem Ergebnis, ein `.map()` als `forEach`. → **Paket 7**, dort jetzt namentlich eingetragen. Es ist eine Zeile Testkosmetik ohne Assertionsbezug, und Paket 7 macht mit `src/effects.spec.ts`, `src/effects.async.spec.ts` und `src/SignalAutoMap.spec.ts` ohnehin drei Spec-Dateien nur wegen ihrer Textstellen auf. Auflage wie dort: die Assertionen bleiben unangetastet.
- **Die »Offene Rückfrage« unter Paket 8 ist beantwortet** — sie ist dieses Paket. Der Abschnitt bleibt als Herkunftsnachweis stehen.
- Nichts mehr offen aus dem Stapel von Paket 8.

Laufreihenfolge der offenen Pakete: 5 → 6 → 8 → 7 (Stand nach Paket 4). Schnitt und Reihenfolge bleiben auch nach der Revision der MEM-007-Entscheidung unverändert — Paket 5 fasst als einziges `src/link.ts`/`src/SignalLink.ts` an, alle »Hängt ab von«-Zeilen bleiben gewahrt, und die Abhängigkeit auf Paket 1 (`throwCollectedErrors`) besteht weiter, weil der Refactor an `src/SignalLink.ts:347-355` im Paket bleibt. Die Revision hat Paket 5 leichter gemacht, nicht anders geschnitten: derselbe Bereich, dieselbe Position, kleineres Modell. Zwei Berührungspunkte, die die Reihenfolge nicht ändern, aber im jeweiligen Zug 0 zu prüfen sind: `skills/using-signalize/references/pitfalls.md` wird von Paket 5 (Pitfall 17, Links) und Paket 7 (Pitfall 16/16a, Gruppen-Backstop) angefasst — verschiedene Nummern, keine Kollision, und Paket 7 läuft ohnehin zuletzt. Und Paket 7 beschreibt in `docs/api.md` den Endstand: die Link-Lebenszeit gehört dort nicht noch einmal hin, sie steht bereits in Schritt 6 von Paket 5. Geändert hat sich am Eingabestapel: der falsche Dedup-Kommentar steht jetzt namentlich unter Paket 8 statt unter Paket 5 (das Vorzeichen war vertauscht — die richtige Fassung stand in `SignalLink.ts`, die falsche in `SignalGroup.ts`); nichts mehr offen aus dem Stapel von Paket 4.

Laufreihenfolge der offenen Pakete nach Zug 0 von Paket 6 (2026-08-06): **6 → 8 → 7, unverändert.** Paket 6 ist als einziges Paket dieses Laufs an `src/SignalAutoMap.ts` und seiner Spec, es hängt von nichts ab, und keine seiner Doku-Stellen kollidiert mit den beiden verbleibenden Paketen: in `docs/api.md` schreibt es die `SignalAutoMap`-Sektion (`454-478`), Paket 7 den Gruppen-Teil (`412-424`) und Paket 8 das statische `clear()`; in `pitfalls.md` fasst es Nummer 18 an, Paket 5 hatte 17, Paket 7 hat 16/16a. Zwei Punkte, die die Reihenfolge nicht ändern, aber im jeweiligen Zug 0 zu beachten sind: Paket 7 muss seine `docs/api.md`-Sektion **nicht** um `SignalAutoMap` erweitern — Paket 6 schreibt dort bereits den Endstand. Und Paket 7 hat mit `CHANGELOG.md:75` ein Ziel, das durch die neue `### Features`-Zeile aus Paket 6 und die `### Bug Fixes`-Zeile aus Paket 8 nach unten wandert: dort **über den Inhalt suchen, nicht über die Zeilennummer**.

Laufreihenfolge der offenen Pakete nach Zug 0 von Paket 8 (2026-08-07): **8 → 7, unverändert.** Paket 8 ist das letzte Code-Paket dieses Laufs; danach bleibt nur die Prosa. Die Schnittkanten sind geprüft und tragen: in `src/SignalGroup.ts` fasst Paket 7 nichts an, in `src/SignalGroup.teardown.spec.ts` ebenso wenig, und `docs/api.md` teilen sich beide sauber nach Blöcken (Paket 8 den statischen, Paket 7 den Instanz-Teil; Paket 6 hat die `SignalAutoMap`-Sektion bereits geschrieben). In `CHANGELOG.md` schreibt Paket 8 eine neue `### Bug Fixes`-Zeile und fasst keine bestehende an; Paket 7 korrigiert dort zwei bestehende (`:75` und die neu aufgenommene `:52`) — beide **über den Inhalt suchen**, weil die Zeilennummern durch Paket 6 und 8 verrutschen. Paket 7 ist damit vollständig beschickt: MEM-010 plus sieben `Mitgenommen`-Einträge aus den Paketen 1 bis 6, jeder mit Datei und Zeile, zusammen fünfzehn Fundstellen. Der Volltext von MEM-010 fehlt noch — den trägt der Planer von Paket 7 in seinem eigenen Zug 0 nach, wie es jedes Paket dieses Laufs für sein eigenes Finding getan hat.

~~Nicht in diesem Lauf entschieden: der werfende Teardown im FinalizationRegistry-Callback (`src/SignalGroup.ts:34-38`)…~~ **Entschieden am 2026-08-07:** der Nutzer hat den Vorschlag angenommen, er ist **Paket 9** — `try/catch` um den `clear()`-Aufruf, Meldung über `console.error`. Der Sachverhalt ist in Zug 0 von Paket 9 gegen den Build von `8e91fc4` nachgemessen und reproduziert.

Laufreihenfolge der offenen Pakete nach Zug 0 von Paket 9 (2026-08-07): **9 → 7.** Paket 9 ist damit das letzte Code-Paket des Laufs, danach bleibt nur die Prosa. Begründung der Position: Paket 9 ändert das Fehlerverhalten der automatischen Gruppen-Bereinigung, und genau die beschreibt Paket 7 (MEM-010) — Doku zuletzt, damit sie den Endstand trifft. Die Schnittkanten sind geprüft und tragen:
- **`src/SignalGroup.ts`** — Paket 9 fasst ausschließlich den FR-Callback (`:29-38`) und einen JSDoc-Halbsatz bei `:750-751` an; Paket 7 fasst die Datei nicht an. Keine Kollision mit dem Bereich von Paket 8 (statische `clear()` bei `:186-198`), der bereits committed ist.
- **`src/SignalGroup.teardown.spec.ts`** — Paket 9 hängt einen Test ans Ende, Paket 7 korrigiert bei `:378` eine `.map()`-Zeile in einem älteren Test. Verschiedene Stellen; Paket 7 sucht dort ohnehin über den Inhalt, weil die Nummer durch den neuen Test wandert.
- **`src/SignalGroup.gc.spec.ts`** — nur Paket 9. Diese Datei läuft ausschließlich unter `pnpm test:gc`; das gehört in beide Verify-Läufe, nicht nur in `pnpm world`.
- **`CHANGELOG.md`** — Paket 9 schreibt eine neue `### Bug Fixes`-Zeile und fasst keine bestehende an. Paket 7 korrigiert dort zwei bestehende (die `CHANGELOG.md:75`-Zeile und die `SignalGroup.clear()`/`off()`-Zeile aus `:52`) — beide **über den Inhalt suchen**, die Nummern verrutschen jetzt durch Paket 6, 8 und 9.
- **`docs/`, `skills/`, `README.md`** — Paket 9 fasst nichts davon an, ausdrücklich (Schritt 7). Die gesamte Prosa zur automatischen Bereinigung ist als `Mitgenommen`-Eintrag an Paket 7 übergeben, mit allen sieben Fundstellen.

Paket 7 ist damit vollständig beschickt: MEM-010 plus **neun** `Mitgenommen`-Einträge aus den Paketen 1 bis 6, 8 und 9, jeder mit Datei und Zeile, zusammen dreiundzwanzig Fundstellen. Der Volltext von MEM-010 fehlt weiterhin — den trägt der Planer von Paket 7 in seinem eigenen Zug 0 nach, wie es jedes Paket dieses Laufs für sein eigenes Finding getan hat. Nichts mehr offen aus den Stapeln der Pakete 1 bis 8.

#### Zug 0 von Paket 7 (2026-08-07) — der letzte Zug des Laufs

Detailplan geschrieben, MEM-010 im Volltext nachgetragen, alle neun `Mitgenommen`-Einträge einzeln gegen `53994f0` verifiziert. **Keiner ist gegenstandslos geworden**, sechs Fundstellen sind gewandert (`docs/api.md:403 → 425-432`, `CHANGELOG.md:54 → 66`, `CHANGELOG.md:75 → 82`, `src/effects.spec.ts:69-70 → 70-71`, `src/effects.async.spec.ts:376-379 → 374-378`, `docs/cheat-sheet.md:184 → 186`, `src/SignalGroup.teardown.spec.ts:378 → 383`), der Rest steht zeilengenau. Aus dreiundzwanzig geplanten Fundstellen sind **sechsundzwanzig** geworden; drei kamen aus dem Endstand-Sweep über die Doku-Kette dazu:

- `skills/using-signalize/references/pitfalls.md:66` (Pitfall 15) gibt die `off()`-Zusage weiterhin ohne die MEM-008-Ausnahme — die einzige der sechs Stellen, an der die Folgeentscheidung aus Paket 4 nicht angekommen ist. Fünf Stellen tragen sie, diese nicht.
- `CHANGELOG.md:48` behauptet über den FinalizationRegistry-Callback »takes the process down« und widerspricht damit `:62` aus Paket 9 im selben `## Unreleased`-Block.
- `CLAUDE.md:20` und `AGENTS.md:164,169,181` behaupten, CI fahre `check + test` und `pnpm world` decke das ab. CI fährt zusätzlich `test:gc` und `bench`; die neun GC-Tests aus `SignalGroup.gc.spec.ts` und `link.gc.spec.ts` fallen bei `pnpm world` unter den Tisch. Damit ist auch die Zahl »four« in `.github/workflows/ci.yml:36` doppelt falsch — sie war es schon vor diesem Lauf.

Nachträglich korrigiert: der Kleine Review-Befund aus Paket 9 spricht von »fünf« Tests in `SignalGroup.gc.spec.ts`; es sind sechs, und die zweite GC-Spec-Datei war dort nicht mitgezählt. Die belastbare Zahl ist neun und steht unabhängig in den Verify-Zeilen von Paket 9 (`377 passed / 9 skipped` gegen `386 passed`).

Keine Rückfrage an den Nutzer: keine der sechsundzwanzig Textstellen kehrt eine Zeile aus »Entscheidungen« um — Pitfall 15 und `CHANGELOG.md:48` **vollziehen** die MEM-008-Folgeentscheidung und Paket 9 nach, statt ihnen zu widersprechen —, kein neuer critical- oder high-Befund, und keine Änderung berührt Verhalten. Der Eingabestapel fürs nächste Audit steht unter Paket 7 gesammelt: zehn Punkte, jeder mit Datei, Zeile und Begründung. Nichts mehr offen aus den Stapeln der Pakete 1 bis 9.
