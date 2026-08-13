# Remediation-Plan — @spearwolf/signalize

Quelle: `./audit.html` vom 2026-08-12 · Branch: `main` · erstellt: 2026-08-13
Baseline: `pnpm world` in allen neun Stufen grün — 58 Spec-Dateien, 655 Tests, Coverage 99,39 / 95,95 / 99,64 / 99,51 · keine vorbestehenden Fehler
Scope: **12 von 32 Findings**, vom Nutzer namentlich beauftragt — 1 `medium`, 6 `low`, 5 `info`
Stand (2026-08-13): **LAUF ABGESCHLOSSEN.** Alle 6 Pakete `[x]` (`a804676`, `3131523`, `49423f5`, `6b90fb6`, `bbd767e`, `dd8affb`), keines blockiert, kein Stash offen. Alle 12 beauftragten Findings sind geschlossen. `pnpm world` grün in allen neun Stufen. Offene Arbeit gibt es hier nicht — was aussteht, steht unter »Was dieser Lauf offen lässt«.

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung
läuft · `[x]` erledigt · `[!]` blockiert.

**Diese Datei ist im Repo getrackt** (aus dem vorigen Lauf, Commit `d6da498`)
und wurde von diesem Lauf überschrieben. Der alte Endstand bleibt über die
Historie erreichbar. Während des Laufs blieb sie aus **jedem** Paket-Commit
draußen — sie trägt die Hashes eben dieser Commits, und in jedem Paket-Commit
wurde ausschließlich mit expliziten Pfaden gestaged. Ins Repo geht sie einmal,
mit dem Abschluss-Commit.

## ÜBERGABE — der Lauf ist abgeschlossen

**Für einen frischen Agenten ohne Vorwissen.** Diese Datei hat einen Lauf des
Skills `js-ts-audit-remediation` geführt und hält seinen **Endstand**. Jeder
Paketblock trägt `[x]`, einen Commit-Hash und eine `Ergebnis`-Zeile mit
Messwerten. Es gibt hier keine offene Arbeit.

Wer die Datei als Erstes findet, liest in dieser Reihenfolge:

1. **»Was dieser Lauf offen lässt«** — der Eingabestapel fürs Folgeaudit.
2. **»Semver-Bewertung«** — warum der Lauf `breaking` ist und trotzdem keine
   Version angehoben hat.
3. **Die Paketblöcke** — was gemessen wurde, und an drei Stellen, wo eine
   Empfehlung des Audits am Code nicht trug.

Das Folgeaudit läuft über `js-ts-project-audit`; es verifiziert jedes Finding
am Code neu. `./audit.html` wurde von diesem Lauf **nicht** angefasst — wer
sich selbst benotet, hat immer bestanden.

## Was dieser Lauf nicht anfasst

Die übrigen 20 Findings aus `./audit.html` — darunter alle Findings der Domäne
`harness` außerhalb von TEST-026 und DX-008 sowie sämtliche `info`-Punkte, die
der Nutzer nicht genannt hat. Sie sind nicht bewertet, nicht widerlegt und
nicht zurückgestellt; sie waren schlicht nicht beauftragt. `acknowledged` ist
im Audit leer.

## Entscheidungen

- **TEST-026 geht über die Empfehlung hinaus:** alle acht genannten Wächter
  werden abgedeckt, nicht nur die zwei billigsten (2026-08-13). — Erledigt in
  Paket 1, mit einem Vorbehalt, der die Entscheidung nicht umkehrt: zwei der
  acht sind gemessen nicht beobachtbar (toter bzw. redundanter Zweig) und
  wurden als solche nachgewiesen statt fälschlich als abgedeckt verbucht. Kein
  späteres Paket greift das erneut auf.
- **Die Coverage-Schwellen in `vitest.config.ts` bleiben unangetastet.** Das
  Anheben wurde ausdrücklich nicht beauftragt (2026-08-13).
- **DX-008 wird verallgemeinert:** die `docs/`-Zeile in `CLAUDE.md` deckt
  künftig alle Dateien unter `docs/` ab, statt eine Aufzählung zu führen, die
  beim nächsten Zuwachs erneut rottet (2026-08-13).
- **READ-015 hält die Sprachregel fest:** der PERF-004-Block wird übersetzt,
  und `CONTRIBUTING.md` bekommt einen Satz, dass Code, Kommentare und Doku
  englisch sind (2026-08-13).
- **IMPL-002 wird als JSDoc-Notiz umgesetzt**, nicht als Codeänderung — der
  Empfehlung folgend ist am Zähler nichts zu reparieren, nur festzuhalten,
  dass seine prozessweite Monotonie Absicht ist (2026-08-13).
- **MEM-013 und BUG-015 beantworten die dritte offene Frage des Audits mit
  ja:** der Teardown-Vertrag (`collect()` + `throwCollectedErrors()`) gilt auch
  für `SignalAutoMap` und `destroyObjectSignals` (2026-08-13).
- **Die Plandatei wird überschrieben** statt neben einer zweiten zu stehen
  (2026-08-13).
- **Paket 6 bekommt ausnahmsweise eine dritte Runde**, begrenzt auf einen
  Handgriff: das »only« in `docs/api.md` und `src/create-signal.spec.ts` fällt,
  weil ein vordeklarierter `(v: T) => void`-Callback ohne jedes `any` durch die
  Signatur kommt (TypeScripts void-Rückgaberegel). Die Ausschließlichkeit wird
  gestrichen, die void-Form wird **nicht** dokumentiert — das Ausfüllen der
  Lücke geht ins Folgeaudit (2026-08-13).
- **`CLAUDE.md:20` wird als Teilschritt 6c mit korrigiert:** die Zeile zählt für
  `pnpm world` sieben Stufen auf, das Skript fährt neun (`clean` und
  `typecheck` fehlen). `typecheck` ist die einzige Stufe, die
  `src/**/*.spec.ts` typprüft — und damit die, auf der der Nachweis von Paket 3
  ruht. Außerhalb der zwölf beauftragten Findings, im selben Commit
  (2026-08-13).
- **READ-015 wird über sein Finding hinaus ausgeführt:** die neun weiteren
  deutschen Kommentarblöcke in `src/EffectImpl.destroy.spec.ts`,
  `src/effects.async.spec.ts` und `src/SignalGroup.off.spec.ts` werden als
  Teilschritt **4b** im selben Paket und im selben Commit mit übersetzt. Grund:
  die Sprachregel, die dasselbe Paket in `CONTRIBUTING.md` festschreibt, wäre
  sonst am Tag ihrer Niederschrift an neun Stellen unterlaufen (2026-08-13).

## Vorbestehende Fehler

Keine. Die Baseline ist in allen neun Stufen grün.

## Stehende Regeln für jedes Paket

- **CHANGELOG:** jede nach außen sichtbare Änderung bekommt eine Zeile unter
  `## Unreleased`, unter der passenden bestehenden Überschrift. Einträge unter
  released Überschriften werden nie angefasst.
- **Doku-Sync bei API-Änderungen** in der Reihenfolge aus `CLAUDE.md`:
  JSDoc → `docs/api.md` → `docs/recipes.md` → `docs/cheat-sheet.md` →
  `skills/using-signalize/` → `README.md` → `CHANGELOG.md`.
- **Verify je Paket:** `pnpm world`. Bei Änderungen an `docs/`, `README.md`
  oder `skills/` zusätzlich `pnpm check:refs`; `pnpm world` führt es über
  `check` bereits mit.
- Nur `src/` wird editiert, `lib/` und `dist/` sind generiert.

## Pakete

### [x] 1. Die Null- und Grenzwächter der öffentlichen Oberfläche abdecken
- Findings: TEST-026 (low)
- Ziel: Die im Finding genannten Wächter überleben ihre Entfernung nicht mehr unbemerkt — soweit sie überhaupt beobachtbar sind.
- Hash: `a804676`
- Ergebnis: 2 Runden, 2 Review-Durchgänge · **TEST-026 behoben, aber nicht so, wie das Finding es annahm.** 9 neue Tests, 664 statt 655 · Branch-Coverage 95,95 → 96,83 · `signal-core.ts` ist aus der Uncovered-Tabelle verschwunden (12/14 → 14/14 Branches), `link.ts` von 90 auf 95 % Branch · `pnpm world` grün in allen neun Stufen
- **Sechs der acht Wächter sind gepinnt, zwei sind es nicht — und das ist ein Messergebnis, kein Rest.** Jede Klassifizierung wurde vom Implementierer gefahren und vom Reviewer unabhängig nachgefahren: mutieren, roten Lauf sehen bzw. Grünbleiben bestätigen, exakt zurückstellen.
  - gepinnt gegen Entfernen: `signal-core.ts:226` (`muteSignal`), `signal-core.ts:239` (`unmuteSignal`), `link.ts:359` (`unlink` mit unbekanntem Target), `EffectImpl.ts:641` (`maxDepth`-Grenze, `>=` → `>` wird rot), `SignalGroup.ts:1153` (`!si.destroyed` in `off()`), `SignalGroup.ts:1228` (`#parentGroup?.detachGroup`)
  - gepinnt nur gegen Inversion: `link.ts:313-314` (`gLinks`-Entry-Cleanup). Entfernen bleibt folgenlos — der aufrufende Code verwendet die stehengebliebene leere `Map` klaglos weiter, `?.size ?? 0` liefert unverändert 0.
  - nicht pinbar: `link.ts:397` (`sourceSignal != null`) ist **tote Verteidigung** — `WeakMap.prototype.get` liefert für Nicht-Objekt-Schlüssel spezifikationsgemäß `undefined`; und `EffectImpl.ts:566` (`!effect.destroyed` vor `saveSignalsFromDeps()`) ist **redundant** zu `EffectImpl.ts:813`, dem eigenen `#destroyed`-Guard in `whenSignalIsRead()`. Beide Zweige wurden gemeinsam entfernt: 664/664 grün.
- **`EffectImpl.ts:813` ist bereits gepinnt**, und zwar durch den bestehenden `EffectImpl.destroy.spec.ts:424` — sein Entfernen macht genau diesen einen Test rot. Der in Runde 0 dafür geschriebene neue Test war ein Duplikat von `EffectImpl.destroy.spec.ts:467` und wurde wieder entfernt, statt ihn wirkungslos stehen zu lassen.
- **Für die zwei nicht pinbaren Wächter blieben Vertragstests stehen**, mit einem Kommentar, der ausdrücklich sagt, dass sie keine Mutationsabdeckung beanspruchen. `getLinksCount(nicht-Signal) === 0` ist eine öffentliche Zusage und darf festgenagelt bleiben, auch wenn kein Wächter dahinter steht.
- Die Schwellen in `vitest.config.ts` blieben unangetastet (Entscheidung 2026-08-13). Kein Produktivcode wurde angefasst; der `src`-Diff enthält ausschließlich `*.spec.ts`.
- Offene `klein`-Befunde aus dem zweiten Review, bewusst nicht nachgezogen:
  - `CHANGELOG.md:262` — die Kopfaussage nennt das „`gLinks` entry cleanup once a source's last link is destroyed" als gepinnt; beobachtbar ist nur das Gegenteil (der Eintrag fällt *nicht*, solange noch ein Link lebt). Der Klammerzusatz entschärft es, die Kopfaussage nicht.
  - `src/link.spec.ts:74` und `:807` — Kommentare zitieren harte Zeilennummern (`link.ts:397`, `link.ts:313-314`), während die Codebasis sonst Symbole und Finding-IDs referenziert.
- Nebenbefunde:
  - `src/link.ts:397` — `sourceSignal != null` ist toter Code hinter `WeakMap.prototype.get`. Meldung, keine Behebung: kein Produktivcode in einem Testpaket.
  - `src/EffectImpl.ts:566` — `!effect.destroyed` ist redundant zu `src/EffectImpl.ts:813`. `saveSignalsFromDeps()` ruft ausschließlich `whenSignalIsRead()`, der Guard ist dort vollständig absorbiert.
  - `src/link.ts:317` (`if (gLinksCount > 0)`), `src/SignalGroup.ts:456-457,466,470` und `src/EffectImpl.ts:1142-1143` bleiben unabgedeckt — Finalizer- und verwaiste-async-Cleanup-Pfade, nie Teil der acht Wächter.

### [x] 2. Der Teardown-Vertrag erreicht SignalAutoMap und destroyObjectSignals
- Findings: MEM-013 (medium), BUG-015 (low), CONS-016 (low)
- Ziel: Ein werfendes Cleanup bricht keinen Mehr-Mitglieder-Teardown mehr ab und zerreißt keine Buchführung.
- Hash: `3131523`
- Ergebnis: 1 Runde, 1 Review-Durchgang · **alle drei Findings behoben** · 8 neue Tests, 672 statt 664, neue Spec-Datei `src/SignalAutoMap.teardown.unsubscribeThrows.spec.ts` · `SignalAutoMap.ts` und `object-signals.ts` stehen in keiner Uncovered-Zeile mehr · `pnpm world` grün in allen neun Stufen
- **Test-first eingehalten und belegt:** 7 der 8 Tests waren vor dem Fix rot, jeder einzeln gefahren, jedes Fehlerbild notiert — `b.destroyed === false` bei `clear()`, `unsubs.size === 1` nach werfendem `delete()`, der zweite Host unbesucht bei `destroyObjectSignals()`. Der achte (`a single failing cleanup arrives unchanged, not wrapped`) war planmäßig schon grün; er pinnt die Einzelfall-Zusage von `throwCollectedErrors()`, die der Fix nicht brechen darf.
- **Der Reviewer hat drei Fixes einzeln zurückgedreht**, je einen pro Finding-ID: MEM-013 zurück → 3 Tests rot, CONS-016 zurück → 2 rot, BUG-015 zurück → 3 rot. Vereinigung genau 7 von 8, grün bleibt nur der angekündigte. Jede Mutation md5-verifiziert zurückgestellt.
- **Die Form ist die des Baums, nicht eine neue.** `collect()` über beide Schleifen in `clear()`, `throwCollectedErrors(errors, 'clearing a signal auto map')` zuletzt; `collect()` je Signal in `destroyObjectSignals()` mit `throwCollectedErrors(errors, 'destroying the signals of an object')` **außerhalb** der Objektschleife; `try`/`finally` in `#drop()` nach `SignalGroup#dropSignalSubscription()`. Gegen alle fünf Vorbilder geprüft — ein einzelner Fehler unverändert, mehrere als `AggregateError` in Teardown-Reihenfolge, jedes Mitglied besucht. `destroySignal()` setzt `destroyed = true` vor dem Emit, das gilt also auch für das werfende Mitglied selbst.
- **Ein Pfad bleibt bewusst außerhalb:** `SignalAutoMap#delete(key)` überspringt bei werfendem `unsubscribe()` weiterhin `signal.destroy()`, das Signal überlebt außerhalb der Map. Dieselbe Haltung wie `SignalGroup#detachSignal()`; nach dem CONS-016-Fix ist wenigstens die Buchführung dort sauber, und der neue Test hält den Zustand fest. Vom Planer entschieden, nicht vom Implementierer nebenbei.
- Doku: zwei Zeilen in `docs/api.md` im wörtlichen Wortlaut der Gruppen-Teardowns; vier `CHANGELOG.md`-Zeilen, zwei davon unter `### Breaking Changes` — ein `catch`, das bisher den Originalfehler bekam, sieht bei zwei oder mehr Fehlern jetzt einen `AggregateError`.
- `klein`-Befunde aus dem Review, nicht nachgezogen:
  - `src/object-signals.ts:124` — der Text `'destroying the signals of an object'` liest sich bei mehreren Objekten schief (»2 errors while destroying the signals of **an** object«). Wörtlich aus der Audit-Empfehlung, aber öffentliche Fehlermeldung und im Test festgenagelt.
  - `docs/api.md:966` — die Zeile zu `delete(key)` nennt den einen Pfad nicht, auf dem das Signal überlebt.
  - `src/SignalAutoMap.spec.ts` — die `finally`-Blöcke sind uneinheitlich geschützt; empirisch unschädlich, aber die Begründung im Kommentar von Test 2 gilt für Test 1 genauso.
- Nebenbefunde:
  - `src/SignalAutoMap.ts:268-281` — `delete()` als letzter Teardown-Pfad ohne den Vertrag, siehe oben. Kandidat fürs Folgeaudit.

### [x] 3. Signal.onChange mit ValueChangedCallback typisieren
- Findings: TYPE-006 (low)
- Ziel: Der Rückgabewert des Callbacks trägt seine Bedeutung im Typ, statt sie in `any` zu verschlucken.
- Hash: `49423f5`
- Ergebnis: 2 Runden, 2 Review-Durchgänge · **TYPE-006 behoben** (`src/Signal.ts:100`) · 4 `@ts-expect-error`-Direktiven plus 4 Positivtests in `src/types.public-surface.spec.ts`, 673 Tests · Doku-Kette in fünf Dateien nachgezogen · `pnpm world` grün in allen neun Stufen
- **Das Finding war zur Hälfte schon erledigt.** Der empfohlene Rückgabetyp `VoidFunc` steht seit `d5d459d` an der Signatur (`git log -S` verifiziert); zu ändern war allein der Parameter. Die Fundstelle `src/Signal.ts:37` aus dem Audit war veraltet, die Methode steht bei `:94`.
- **Der Nachweis läuft über das Typsystem, und die Rot-Grün-Reihenfolge ist umgekehrt:** erst die Direktiven, dann `pnpm typecheck` mit vier `TS2578` (»unused directive«), dann die Signatur. Vom Implementierer gefahren, vom Reviewer zweimal unabhängig reproduziert — genau vier, keine Direktive ist Dekoration.
- **Die vier abgewiesenen Formen sind die interessanten**, nicht die billigen: Ausdrucks-Body mit Wert (`TS2322`), `async`-Callback, Block-Body mit `return wert`, vorgetypte `(v: T) => unknown`-Variable (je `TS2345`). Die vier Positivtests halten die Gegenrichtung: eine testweise Verengung von `ValueChangedCallback` auf `(value: T) => VoidFunc` macht drei von ihnen rot.
- **Ein `wichtig` aus Runde 0, und es war ein echter Fehler:** Kommentar und JSDoc begründeten die `async`-Abweisung damit, dass die `Promise` »never called as a cleanup« sei. Gemessen tut `EffectImpl#storeCleanupCallback` das Gegenteil — es erkennt Thenables, wartet sie ab und übernimmt die aufgelöste Funktion über denselben `acceptCleanupCallback()`-Pfad wie den synchronen Fall. Von Implementierer und Reviewer unabhängig nachgestellt (`seen=[2,3]`, `cleaned=[2]`, nach `unsubscribe()` `cleaned=[2,3]`). Die Verengung bleibt richtig, ihre Begründung sagt jetzt den wahren Grund: `ValueChangedCallback` ist synchron, und `createEffect()` bleibt der Weg für async.
- `CHANGELOG.md` trägt den Breaking Change deshalb in zwei Zeilen — eine für die Typverengung, eine für den Verlust der `async`-Aufrufform mit Verweis auf `createEffect()`. »nothing changes at runtime« ist raus: als Aussage über den Compile-Charakter richtig, als Beschwichtigung über den Verlust falsch.
- `klein`-Befunde aus dem zweiten Review, nicht nachgezogen — **die ersten beiden gehören in den Eingabestapel von Paket 6, das genau diese Dateien anfasst**:
  - `docs/api.md:79` und `docs/cheat-sheet.md:39-40` nennen als Ausnahme »unless `cb` itself is typed `any`«; real greift die Ausnahme bei einem `any`-**Rückgabetyp** (`(v: T) => any`), so wie `CHANGELOG.md:63` und der Test es korrekt fassen.
  - `skills/using-signalize/references/api.md:83-84` — derselbe Vorbehalt fehlt dort ganz, die dritte Doku-Stelle steht absoluter als die beiden korrigierten.
  - `src/create-signal.spec.ts:313` — der Satz »and its signature allows `any`« ist seit dieser Änderung falsch und wird vier Zeilen tiefer von der neuen Direktive widersprochen.
  - `src/types.public-surface.spec.ts:637-640` — der Kommentar behauptet für alle vier Positivformen, eine künftige Verengung nähme sie unbemerkt weg; für `offConditional` und `offAnyVariable` ist das gemessen nicht so (`strictNullChecks: false` bzw. `any`).
- Nebenbefunde: keine neuen.

### [x] 4. Zwei Kommentare, die in die Irre führen — und neun, die in der falschen Sprache stehen
- Findings: READ-015 (low), READ-016 (low) · dazu Teilschritt **4b** nach Nutzerentscheidung
- Ziel: Der PERF-004-Block ist englisch und die Sprachregel steht geschrieben; `$autoMapResources` begründet sich mit dem Grund, der heute trägt.
- Hash: `6b90fb6`
- Ergebnis: 1 Runde, 1 Review-Durchgang · **beide Findings behoben**, dazu neun weitere Kommentarblöcke übersetzt · 7 Dateien, 41 Einfügungen, 36 Löschungen · 673 Tests unverändert, Coverage unverändert · `pnpm world` grün in allen neun Stufen
- **Das Finding hat sich geirrt, und der Irrtum war der Fund.** READ-015 behauptet, der PERF-004-Block sei der einzige nicht-englische Kommentar in `src/`. Gemessen: neun weitere deutsche Blöcke, 17 Zeilen, in `EffectImpl.destroy.spec.ts` (`:434`, `:440-441`, `:453`, `:523-526`), `effects.async.spec.ts` (`:285-286`, `:297`, `:370-371`) und `SignalGroup.off.spec.ts` (`:223-224`, `:237-238`). Die Sprachregel, die dasselbe Paket in `CONTRIBUTING.md` festschreibt, wäre am Tag ihrer Niederschrift an neun Stellen unterlaufen gewesen. Der Nutzer hat entschieden, sie als 4b mit zu übersetzen.
- **Übersetzung, nicht Überarbeitung — und das wurde geprüft, nicht geglaubt.** Der Reviewer hat den PERF-004-Block Satz für Satz gegen `git show HEAD:src/SignalGroup.ts` gehalten: zehn Aussagen im Original, zehn in der Übersetzung, in Reihenfolge und Umfang eins zu eins. Beide Einschränkungen erhalten, die Begründung des Schreib-Wurfs wörtlich. Für 4b hat er alle neun Blöcke geprüft statt der geforderten vier — jeder zeichengleich mit dem Zielwortlaut des Plans.
- **Technisch nachgemessen**, nicht nur sprachlich: `EmptySet.add`, `EmptyMap.set`, `EmptyWeakMap.set` und `EmptyWeakSet.add` werfen — genau die vier Operationen, die nicht-leer machen würden; `.delete()`/`.clear()` sind ererbt und auf Leerem folgenlos. Die übersetzte Begründung deckt den Code darunter.
- **Die Grenze von 4b hat gehalten:** `git diff -U0` gefiltert auf Nicht-Kommentarzeilen ist je Spec-Datei leer. Kein Testname, keine Assertion-Message, kein String-Literal, keine Zeile Testcode. Einfügungen = Löschungen je Datei (8/8, 5/5, 4/4).
- **READ-016 folgt der Empfehlung des Audits bewusst nicht wörtlich.** Sie wollte die Begründung einsetzen, die zwei Absätze weiter oben für `$queueUnsubscribes` steht — die trägt aber die Symbol-Schlüsselung, nicht die Ablage in `constants.ts`. Der neue Satz begründet die Ablage und nennt sie beim Namen: eine Vorliebe, kein Zwang (`SignalGroup.ts` führt mit `$groupResources` und `$setParentGroup` zwei eigene Symbole). Die Behauptung des Findings wurde geprüft und hält: `src/index.ts` hat keinen Stern, weder `export *` noch `export type *`.
- `CONTRIBUTING.md` trägt die Regel als ersten Punkt unter `## Code Style`, vor dem Biome-Punkt. `CHANGELOG.md` bekommt genau eine Zeile unter `### Documentation` — für `CONTRIBUTING.md`, nicht für die Kommentare: die werden von `removeComments: true` ohnehin weggeworfen und sind für keinen Konsumenten beobachtbar.
- `klein`-Befunde aus dem Review, nicht nachgezogen — **der erste gehört in den Eingabestapel von Paket 5**:
  - `src/SignalGroup.ts:216-217` — »the first thing that runs when a member is destroyed, ahead of every application listener« ist zu stark; `SignalGroup.ts:954-955` und `:1023-1027` sagen ausdrücklich, dass ein *vorher* auf `Priority.Max` registrierter Listener die Gleichstandsentscheidung gewinnt. Getreue Übersetzung einer schon im Deutschen überzogenen Klammer.
  - `CONTRIBUTING.md:140` — die Regel nennt »everything under `docs/`«, lässt die Wurzel-Markdowns (`README.md`, `AGENTS.md`, `CHANGELOG.md`) aber unerwähnt, obwohl das Finding sie als englisch führt.
  - `src/effects.async.spec.ts:285` — »their promise« klein statt des im Plan als Bezeichner gelisteten `Promise`; im Deutschen war die Großschreibung grammatisch. Die bessere Wahl, aber eine Abweichung vom Plantext.
- Nebenbefunde:
  - `src/constants.ts` hält elf `Symbol.for`-Schlüssel, nicht zehn — die Zahl im Detailplan war falsch, `CHANGELOG.md:236` zählt für `docs/architecture.md` korrekt elf.
  - Die neue Sprachregel deckt die Sprache von Fehlermeldungen, nicht ihre Grammatik: `src/object-signals.ts:124` bleibt englisch und bei mehreren Objekten schief (aus Paket 2 bekannt).

### [x] 5. Fehlende JSDoc und Kennzeichnung im Quelltext
- Findings: INF-001 (info), CONS-017 (info), IMPL-002 (info) · dazu Teilschritt **5b**, drei Kommentarkorrekturen aus den Reviews von Paket 3 und 4
- Ziel: Der einzige Export von `./decorators` erklärt sich im Editor, `storeAsObjectSignal` sagt dass es intern ist, und der ID-Zähler sagt dass seine Monotonie Absicht ist.
- Hash: `bbd767e`
- Ergebnis: 1 Runde, 1 Review-Durchgang · **alle drei Findings behoben** · 7 Dateien, 66 Einfügungen · 673 Tests und Coverage unverändert · `pnpm world` grün in allen neun Stufen
- **Neun Zusagen im neuen `signal()`-JSDoc, jede einzeln am Code nachgemessen** — vom Planer vor dem Schreiben, vom Implementierer beim Schreiben, vom Reviewer danach ein drittes Mal. Die `accessor`-Pflicht ist keine Behauptung, sondern eine gefahrene Probe: `@ts-expect-error` gegen Plain-Field, Methode und Getter greift dreimal (`TS1240`/`TS1241` plus `TS1270`), die `accessor`-Form compiliert. Die Doppelregistrierung (`storeAsObjectSignal` **und** `attachSignalByName`) hält auch mit `{attach: other}` — beide Gruppen gleichzeitig aktiv, per Laufzeitprobe.
- **Das ist die Lehre aus Paket 3, angewandt:** dort hatte ein Kommentar eine Typverengung mit einem Verhalten begründet, das die Bibliothek nicht hat. Dieses Paket schreibt keine Zusage hin, die niemand gefahren ist.
- **CONS-017 wirkt im Emit, nicht nur im Quelltext.** Nach `pnpm compile` ist `storeAsObjectSignal` aus `lib/object-signals.d.ts` verschwunden (`stripInternal: true`); übrig bleiben genau die vier öffentlichen Finder mit unverändertem JSDoc. Erreichbar war das Symbol nie — `index.ts` führt es nicht, die `exports`-Map sperrt Tiefenimporte —, aber es lag im Tarball.
- **IMPL-002 ändert am Zähler nichts** (Entscheidung 2026-08-13). Die Notiz sagt, dass die prozessweite Monotonie Absicht ist und nichts kostet: der Generator hält keines der erzeugten Symbole, die Obergrenze ist `Number.MAX_SAFE_INTEGER`.
- **5b räumt auf, was dieser Lauf selbst falsch gemacht hat:** der TYPE-006-Satz in `create-signal.spec.ts`, die Mutationsbehauptung in `types.public-surface.spec.ts` und die `Priority.Max`-Gleichstandsregel im übersetzten PERF-004-Block. Der Reviewer hat die Verengungsprobe selbst gefahren (drei von sechs Formen brechen, `offConditional` und `offAnyVariable` überleben) und die Gleichstandsregel gegen eventize 6.0.0 nachgemessen: ein zuerst registrierter `Priority.Max`-Listener läuft vor dem Gruppen-Hook. `git diff -U0 -- src/` ohne Kommentarzeilen ist für alle sechs Dateien leer.
- `CHANGELOG.md` bekommt zwei Zeilen unter `### Documentation` — für INF-001 (JSDoc landet in `lib/decorators.d.ts` und damit im Editor jedes Konsumenten) und CONS-017 (eine Deklaration verschwindet aus einer ausgelieferten `.d.ts`). IMPL-002 bekommt keine: `UniqIdGen` ist von außen nicht auflösbar.
- `klein`-Befunde aus dem Review, nicht nachgezogen:
  - `src/create-signal.spec.ts:313` — »The signature no longer allows anything else (TYPE-006)« ist absoluter als der Baum; ein Callback mit deklariertem `any`-Rückgabetyp passiert weiterhin. Dieselbe Überzeichnung, die das Review von Paket 3 an den Doku-Stellen notiert hat — 5b hat sie beim Korrigieren neu erzeugt. **Gehört in den Eingabestapel von Paket 6**, das denselben Vorbehalt in `docs/` und `skills/` nachzieht.
  - `src/SignalGroup.ts:949` (vorbestehend, nicht aus diesem Diff) — verweist auf `attachLink()`s Hook »above«, `attachLink` steht darunter bei `:993`.
- Nebenbefunde: keine neuen.

### [x] 6. Zwei Doku-Oberflächen nachziehen
- Findings: API-018 (low), DX-008 (info) · dazu **6b** (die TYPE-006-Ausnahme an vier Stellen) und **6c** (`pnpm world` in `CLAUDE.md` und `AGENTS.md`)
- Ziel: `beforeRead` trägt überall den Vorbehalt gegen `readAsValue: true`; die Doku-Landkarte in `CLAUDE.md` rottet nicht erneut.
- Hash: `dd8affb`
- Ergebnis: **3 Runden**, 3 Review-Durchgänge · **beide Findings behoben** · 8 Dateien, 28 Einfügungen · 673 Tests und Coverage unverändert · `pnpm world` grün in allen neun Stufen
- **Die Sachaussage wurde vor dem Schreiben gemessen, in beiden Richtungen.** Der Planer und der Reviewer haben unabhängig gegen ein gebautes `dist/` gefahren: mit `readAsValue: true` steht der `beforeRead`-Zähler nach `init`, drei Property-Lesungen, einem Schreibzugriff, einer Lesung im Effekt-Body und einer in `beQuiet()` auf **0** — erst ein direktes `sig.get()` feuert. Mit `readAsValue: false` feuert **jeder** Property-Zugriff, genau einmal. Regel und Ausnahme stimmen beide; eine Doku, die nur die Ausnahme trifft, wäre nicht besser gewesen als vorher.
- **`skills/using-signalize/SKILL.md` bekommt die Regel als Prosa**, nicht als Optionsblock — die Datei führt bewusst sechs kuratierte Verhaltensweisen und hat keine Dekorator-Optionstabelle. Der Absatz hängt an Verhalten 2 und nennt alle fünf Optionen von `SignalDecoratorOptions`.
- **Drei Runden für einen Satz, und das ist die Geschichte dieses Pakets.** Die Ausnahme von TYPE-006 stand an vier Stellen und war an dreien falsch:
  - Runde 0: »only a callback **pre-declared** with an `any` return type still slips through« — falsch, `sig.onChange((v): any => v * 2)` kommt inline ebenfalls durch.
  - Runde 1: »an **inline** callback with no return-type annotation is contextually typed … and has no such escape« — ebenfalls falsch. Kontextuelle Typisierung liefert den Parametertyp; der Rückgabetyp wird aus dem Rumpf inferiert, und ist der `any`, ist er zuweisbar. Dreifach gemessen (`(v) => anyVal || v`, `(v) => anyFn(v)`, `(v) => idAny(v)`).
  - Runde 2 nannte die Ursache richtig — `any`-Rückgabetyp, annotiert oder inferiert, inline wie vordeklariert —, behauptete aber Vollständigkeit.
  - Runde 3 strich die Ausschließlichkeit. Ein vordeklarierter `(v: T) => void`-Callback kommt ohne jedes `any` durch (TypeScripts void-Rückgaberegel greift, weil der Kontexttyp dort nicht die Union ist). **Diese Lücke wird nicht dokumentiert** (Entscheidung 2026-08-13) — der Satz sagt jetzt, was er weiß, und schweigt über den Rest.
  - Der Reviewer hat in Runde 2 und 3 zusammen 34 Aufrufformen gegen `pnpm typecheck` gefahren. Die Ausschließlichkeit ist nirgends mehr im Baum.
- **6c korrigiert drei Stellen, und eine ausdrücklich nicht.** `CLAUDE.md:20` nannte sieben Stufen für `pnpm world`, `AGENTS.md:182` acht, der CI-Absatz `AGENTS.md:211` ließ `typecheck` zweimal aus. Das Skript fährt neun. Unangetastet bleibt die `ci.yml`-Aufzählung am Satzanfang von `:211` — sie war schon richtig und ist die Quelle, gegen die die anderen korrigiert wurden; ein Angleichen aus Symmetrie-Eifer hätte sie verschlimmbessert. `git diff --word-diff` belegt genau drei Einfügungen in `AGENTS.md`.
- `CHANGELOG.md` bekommt drei Zeilen unter `### Documentation` — `docs/` und `skills/` liegen beide im `files`-Array, die Korrekturen wandern mit dem Tarball zum Konsumenten.
- Nebenbefunde:
  - `src/Signal.ts:91-98` ist eine fünfte Stelle mit derselben Regel, nennt die `any`-Ausnahme aber nicht. Nicht falsch, nur schweigsamer als die vier — und laut Sync-Reihenfolge in `CLAUDE.md` wäre JSDoc der Kopf der Kette.
  - `AGENTS.md:211` sagt »covers exactly the blocking steps« neben einer Liste, die `clean`, `compile` und `bundle` nicht führt. Planmäßig stehengelassen, kein Regress.
  - Der Fehlercode für einen inline unannotierten Callback mit Wertrückgabe ist `TS2322`, nicht `TS2345`; `TS2345` erscheint, wenn der Callback als Ganzes unzuweisbar ist (der `async`-Fall).

## Restplan-Prüfung (2026-08-13, nach dem Detailplan zu Paket 2)

Schnitt und Reihenfolge der Pakete 3 bis 6 bleiben, wie sie sind. Geprüft:

- Paket 1 hat ausschließlich `*.spec.ts` und `CHANGELOG.md` verändert — kein
  Produktivcode, den ein späteres Paket anders vorfände.
- Die Nebenbefunde aus Paket 1 (`link.ts:397` toter Zweig, `EffectImpl.ts:566`
  redundanter Guard) bleiben ohne eigenes Paket: der Lauf deckt die 12
  namentlich beauftragten Findings ab, und beide sind keins davon. Sie stehen
  gemeldet in Paket 1 und warten dort auf eine Entscheidung des Maintainers.
- Paket 5 hängt weiter an Paket 2: beide fassen `src/object-signals.ts` an,
  Paket 2 das JSDoc von `destroyObjectSignals()`, Paket 5 das von
  `storeAsObjectSignal` — dieselbe Datei, verschiedene Symbole.
- Paket 2 und Paket 3 ändern beide `docs/api.md`, in getrennten Abschnitten
  (`SignalAutoMap`/„Object signals" gegen `Signal#onChange`). Sequenziell
  ausgeführt kollidiert nichts; keine Umstellung nötig.

## Restplan-Prüfung (2026-08-13, nach dem Detailplan zu Paket 3)

Schnitt, Reihenfolge und Nummern der Pakete 4 bis 6 bleiben unverändert.
Geprüft:

- Die Abhängigkeit Paket 6 → Paket 3 hält, ist aber schwächer als der
  Grobplan sie las: beide fassen `docs/cheat-sheet.md` und
  `skills/using-signalize/references/api.md` an, jedoch an disjunkten Stellen
  — Paket 3 die `onChange`-Zeile im Signal-Block, Paket 6 die
  `beforeRead`-Zeilen im `createSignal`-Params-Block und in der Optionsliste
  weiter unten. Sequenziell ausgeführt kollidiert nichts. Die Reihenfolge
  bleibt trotzdem stehen: Paket 6 zieht Doku-Oberflächen nach und will den
  Stand vorfinden, den Paket 3 hinterlässt.
- Paket 3 fasst `skills/using-signalize/SKILL.md` **nicht** an (die einzige
  `onChange`-Erwähnung dort ist eine Eignungsaussage ohne Bezug zum
  Callback-Typ). Paket 6 hat diese Datei also allein.
- Paket 3 fasst keinen Code an, den Paket 4 oder Paket 5 braucht:
  `src/Signal.ts` kommt in beiden nicht vor.
- Paket 5 hängt weiter an Paket 2 (`src/object-signals.ts`), unverändert
  gegenüber der Prüfung von gestern.
- Kein neuer Befund der Schwere `critical` oder `high`. Der Breaking Change
  in Paket 3 ist eine gemessene Folge der beauftragten Empfehlung, kein
  eigenes Finding — er wird im CHANGELOG angesagt, nicht vermieden.

## Restplan-Prüfung (2026-08-13, nach dem Detailplan zu Paket 4)

Schnitt, Reihenfolge und Nummern der Pakete 5 und 6 bleiben. Zwei Bereiche
wachsen um je eine Kategorie Arbeit, die schon im Baum liegt; nichts wird
umnummeriert. Geprüft:

- **Die vier `klein`-Befunde aus Paket 3 sind verteilt, keiner geht ins nächste
  Audit.** Die zwei doku-seitigen (`docs/api.md:79` + `docs/cheat-sheet.md:39-40`,
  `skills/using-signalize/references/api.md:83-84`) stehen im Eingabestapel von
  Paket 6, das genau diese Formulierung anfasst; dafür kommt `docs/api.md` in
  dessen Bereich, sonst bliebe eine von drei parallelen Stellen falsch. Die zwei
  quellseitigen (`src/create-signal.spec.ts:313`,
  `src/types.public-surface.spec.ts:637-640`) stehen im Eingabestapel von Paket
  5, dem Kommentar- und JSDoc-Paket in `src/`. Begründung in beiden Blöcken:
  dieser Lauf hat beide Sätze selbst falsch werden lassen.
- **Paket 4 kollidiert mit nichts, auch mit 4b nicht.** `src/SignalGroup.ts`
  und `src/constants.ts` kommen in Paket 5 und 6 nicht vor; `CONTRIBUTING.md`
  ebenfalls nicht — Paket 6 fasst von den Doku-Oberflächen `CLAUDE.md` an, nicht
  `CONTRIBUTING.md`. Die drei Spec-Dateien aus 4b
  (`EffectImpl.destroy.spec.ts`, `effects.async.spec.ts`,
  `SignalGroup.off.spec.ts`) sind disjunkt zu den zweien im Eingabestapel von
  Paket 5 (`create-signal.spec.ts`, `types.public-surface.spec.ts`). Umgekehrt
  fasst Paket 4 keine Datei an, die ein späteres Paket anders vorfinden will.
- **Paket 4 ändert keine einzige Zeile Verhalten.** Sieben Dateien, davon fünf
  Kommentarblöcke in `src/`, die `pnpm compile` wegen `removeComments: true`
  ohnehin verwirft und die aus `*.spec.ts` gar nicht erst erreicht. Testzahl
  und Coverage bleiben, wo Paket 3 sie hinterlassen hat (673 Tests).
- **Die Abhängigkeit Paket 5 → Paket 2 hält**, unverändert
  (`src/object-signals.ts`, verschiedene Symbole). Neu hinzu kommt Paket 5 →
  Paket 3, weil dessen zwei `klein`-Befunde jetzt im Eingabestapel liegen —
  Paket 3 ist erledigt, die Reihenfolge ist damit schon erfüllt.
- **Kein neuer Befund der Schwere `critical` oder `high`.** Der einzige Fund
  dieser Planung, der über sein Finding hinausgeht, ist eine Sprachfrage: neun
  deutsche Kommentarblöcke in drei Spec-Dateien, die die neue Regel in
  `CONTRIBUTING.md` am Tag ihrer Niederschrift unterlaufen hätten. Dem Nutzer
  vorgelegt, von ihm am 2026-08-13 entschieden — sie gehen als Teilschritt 4b
  ins selbe Paket und denselben Commit. Keine offene Vorlage mehr.
- **Eine Empfehlung wird nicht wörtlich befolgt**, mit Messung statt Meinung:
  READ-016 will den stehengebliebenen Halbsatz durch eine Begründung ersetzen,
  die im Satz davor schon steht und außerdem die Symbol-Schlüsselung trägt, nicht
  die Ablage in `constants.ts`. Der Zielwortlaut in Paket 4 sagt stattdessen den
  Ablage-Grund, der sich am Baum halten lässt. Das kehrt keine Zeile aus
  „Entscheidungen" um; es ist eine Präzisierung innerhalb des beauftragten
  Findings.

## Restplan-Prüfung (2026-08-13, nach dem Detailplan zu Paket 5)

Nur Paket 6 steht danach offen. Schnitt, Reihenfolge und Nummer bleiben, sein
Bereich wächst nicht. Geprüft:

- **Paket 5 wird nicht geteilt.** Die drei Nachträge gehen als Teilschritt 5b
  in dasselbe Paket und denselben Commit, nach dem Muster von 4b. Sie sind
  Kommentarkorrekturen ohne Code- oder Testwirkung, in Dateien, die keine
  ausgelieferte Oberfläche berühren; ein eigenes Paket 7 dafür kostete einen
  zweiten vollen `pnpm world` für sechs Kommentarzeilen und trüge keine
  eigene Finding-ID. Die Grenze wird nicht behauptet, sondern geprüft: der
  auf Nicht-Kommentarzeilen gefilterte `src`-Diff muss leer sein.
- **Paket 5 und Paket 6 sind disjunkt.** Paket 5 fasst sechs Dateien unter
  `src/` und `CHANGELOG.md` an, Paket 6 vier Doku-Oberflächen plus
  `docs/api.md`. Keine Datei kommt in beiden vor.
- **Paket 5 fasst `docs/api.md` bewusst nicht an**, obwohl der INF-001-JSDoc
  aus dessen Dekorator-Abschnitt verdichtet wird. Der Abschnitt ist bereits
  richtig und vollständig; der JSDoc nimmt ihm nichts weg und widerspricht ihm
  nirgends. Paket 6 findet die Datei also genau so vor, wie Paket 3 sie
  hinterlassen hat — die Annahme, auf der sein Eingabestapel steht.
- **Der Eingabestapel von Paket 6 ist unberührt.** Die zwei doku-seitigen
  `klein`-Befunde aus Paket 3 (`docs/api.md:79` + `docs/cheat-sheet.md:39-40`,
  `skills/using-signalize/references/api.md:83-84`) liegen alle drei in
  Dateien, die Paket 5 nicht anfasst. Nach Paket 5 ist damit keiner der vier
  `klein`-Befunde aus Paket 3 mehr offen zugeteilt: zwei in 5b, zwei in Paket
  6.
- **Die Abhängigkeiten von Paket 5 sind erfüllt.** Paket 2 hat in
  `src/object-signals.ts` nur `destroyObjectSignals()` angefasst, Paket 5
  fasst `storeAsObjectSignal` an — verschiedene Symbole, gemessen am Baum.
  Paket 3 ist erledigt, seine zwei Befunde liegen im Eingabestapel.
- **Kein neuer Befund der Schwere `critical` oder `high`.** Der einzige Fund
  dieser Planung neben den drei Findings ist eine Präzisierung an einem
  Kommentar, den Paket 3 hinterließ: die Verengung von `ValueChangedCallback`
  nimmt zwei der vier fraglichen Aufrufformen weg, nicht vier. Gemessen, nicht
  aus dem Plan übernommen. Keine Vorlage an den Nutzer nötig, keine Zeile aus
  „Entscheidungen" berührt — insbesondere bleibt IMPL-002 eine JSDoc-Notiz und
  der Zähler unangetastet.

## Restplan-Prüfung (2026-08-13, nach dem Detailplan zu Paket 6)

Nach diesem Paket ist der Lauf zu Ende — es gibt keinen Restplan mehr zu
prüfen, also wurde stattdessen geprüft, was aus den Paketen 1 bis 5 liegen
geblieben ist und ob Paket 6 davon noch etwas mitnehmen kann. Paketnummern
werden nicht neu vergeben; ein Paket 7 entsteht nicht.

- **Alle drei geerbten `klein`-Befunde gehen mit.** Die zwei doku-seitigen aus
  Paket 3 liegen in Dateien des Bereichs, der dritte aus Paket 5
  (`src/create-signal.spec.ts:313`) kommt als Teilschritt 6b dazu. Damit ist
  kein `klein`-Befund aus Paket 3 oder 5 mehr offen zugeteilt.
- **Der Bereich wächst um zwei Dateien** gegenüber dem Grobplan:
  `src/create-signal.spec.ts` (6b, ein Kommentarblock) und `AGENTS.md` (6c,
  drei Einfügungen desselben Wortes). Das kehrt keine Zeile aus
  „Entscheidungen" um — dieselbe Mechanik, mit der Paket 4 seinerzeit
  `docs/api.md` in diesen Bereich geholt hat, mit derselben Begründung
  (dieselbe Aussage an mehreren Stellen wird ganz oder gar nicht korrigiert).
  6c steht zusätzlich auf einer eigenen Nutzerentscheidung vom 2026-08-13.
- **Paket 6 kollidiert mit nichts.** Die Pakete 1 bis 5 sind committet; von
  seinen sieben Dateien hat kein früheres Paket `docs/cheat-sheet.md`,
  `skills/using-signalize/SKILL.md`, `skills/using-signalize/references/api.md`
  oder `CLAUDE.md` in einer Weise hinterlassen, die den Zielwortlaut ungültig
  macht — nachgeprüft, nicht angenommen: Paket 3 hat in den beiden
  Kurzreferenzen ausschließlich die `onChange`-Zeilen berührt, nicht die
  Dekorator-Blöcke. `src/create-signal.spec.ts` wurde zuletzt von Paket 5 (5b)
  angefasst, und zwar an genau dem Kommentar, den 6b jetzt weiter präzisiert.
- **Kein neuer Befund der Schwere `critical` oder `high`.** Die zwei Funde
  dieser Planung sind ein vierter Fundort einer schon bekannten Überzeichnung
  (in 6b aufgenommen) und eine unvollständige Aufzählung der `pnpm world`-Stufen
  in `CLAUDE.md` und `AGENTS.md` (dem Nutzer vorgelegt, von ihm am 2026-08-13
  entschieden, in 6c aufgenommen). Keine offene Vorlage mehr.
- **Der Abschnitt „Was dieser Lauf offen lässt" ist damit vollständig und
  endgültig.** Er trägt keinen Punkt mehr, der auf eine Entscheidung wartet —
  nur noch, was gemessen, benannt und bewusst nicht behoben wurde.

## Semver-Bewertung

**Der Lauf ist `breaking`** — und hebt trotzdem keine Version an. Beides ist eine Entscheidung, keine Unterlassung.

Breaking ist er an zwei Stellen, jede für sich ausreichend:

- **TYPE-006 verschärft eine Typdefinition.** `Signal#onChange` nimmt statt `(val: ValueType) => any` jetzt `ValueChangedCallback<ValueType>`. Sechs Aufrufformen, die vorher compilierten, tun es nicht mehr: Ausdrucks-Body mit Wert (`TS2322`), Block-Body mit `return wert`, `async`-Callback, vorgetypte `(v: T) => unknown`-Variable (je `TS2345`). Zur Laufzeit passiert buchstäblich nichts anderes — wessen Build daran rot wird, dem hilft das nicht.
- **MEM-013 und BUG-015 ändern die Form eines geworfenen Fehlers.** `SignalAutoMap#clear()` und `destroyObjectSignals()` reichten bisher den ersten Fehler durch und brachen ab; sie sammeln jetzt und werfen bei zwei oder mehr einen `AggregateError`. Ein `catch`, das auf `instanceof` oder `.message` prüft, sieht etwas anderes als vorher.

Angehoben wird trotzdem nichts. `package.json` steht auf `1.0.0-dev`, und dieses Suffix ist kein Versehen: `scripts/publishPackage.cjs` verweigert die Veröffentlichung, solange es dort steht, und `main.yml` veröffentlicht bei jedem Push auf `main`. **Das Suffix fallen zu lassen ist der Release** — ohne Tag, ohne Freigabe dazwischen. Eine Versionsanhebung in diesem Lauf wäre damit keine Buchhaltung, sondern eine Veröffentlichung. Sie gehört dem Maintainer.

Der `## Unreleased`-Block trägt jetzt **54** Einträge unter `### Breaking Changes`, gegenüber 50 am Ende des vorigen Laufs. Das ist die Buchführung, die eine Versionsnummer hier ersetzt: wer `-dev` streicht, findet dort vollständig, was er dabei zusagt.

Kein zusammenfassender CHANGELOG-Eintrag für den Lauf als Ganzes. `CLAUDE.md` schreibt »eine Zeile, eine Tatsache« vor; jedes Paket hat seine Zeilen unter der passenden bestehenden Überschrift abgelegt, und ein Sammeleintrag darüber wäre die achte Fassung derselben Aussage.

## Was dieser Lauf offen lässt

Der Eingabestapel fürs Folgeaudit. Diese Datei wird nach dem Lauf noch
gelesen, und das hier ist der Grund. Nichts davon ist widerlegt oder
zurückgestellt — es ist gemessen, benannt und nicht behoben, je mit dem Grund.
Zeilennummern sind der Stand nach `bbd767e` und rotten; die Symbolnamen daneben
tun es nicht.

**Produktivcode, gemessen, ohne beauftragtes Finding**

- `src/link.ts:397` — `sourceSignal != null` in `getLinksCount()` ist tote
  Verteidigung: `WeakMap.prototype.get` liefert für einen Nicht-Objekt-Schlüssel
  spezifikationsgemäß `undefined`. Nicht behoben, weil Paket 1 ein Testpaket
  war und kein Produktivcode anfassen sollte.
- `src/EffectImpl.ts:566` — `!effect.destroyed` vor `saveSignalsFromDeps()` ist
  vollständig vom `#destroyed`-Guard in `whenSignalIsRead()` absorbiert.
  Derselbe Grund. Beide Zweige wurden in Paket 1 probeweise entfernt (664/664
  grün) und exakt zurückgestellt.
- `src/SignalAutoMap.ts:268-281` — `delete(key)` ist der letzte Teardown-Pfad
  ohne den `collect()`/`throwCollectedErrors()`-Vertrag: wirft `unsubscribe()`,
  wird `signal.destroy()` übersprungen und das Signal überlebt außerhalb der
  Map. In Paket 2 vom Planer bewusst außerhalb gelassen und als Kandidat fürs
  Folgeaudit gemeldet; die Buchführung dort ist seit CONS-016 sauber, das
  Verhalten nicht.
- `src/link.ts:317`, `src/SignalGroup.ts:456-457,466,470`,
  `src/EffectImpl.ts:1142-1143` — unabgedeckte Finalizer- und
  verwaiste-async-Cleanup-Pfade. Nie Teil der acht Wächter aus TEST-026.

**Aussagen, die zu stark oder unvollständig sind**

- `CHANGELOG.md:271` (`### Tests`, Eintrag zu TEST-026) — die Kopfaussage führt
  „the `gLinks` entry cleanup once a source's last link is destroyed" unter den
  gepinnten Wächtern; beobachtbar ist nur das Gegenteil, nämlich dass der
  Eintrag *nicht* fällt, solange noch ein Link lebt. Der Klammerzusatz
  entschärft die Pinning-Stärke, nicht die Beschreibung. Nicht behoben, weil
  eine tragfähige Neuformulierung einen frischen Mutationslauf auf
  `src/link.spec.ts` braucht — ein Apparat, den ein Doku-Paket nicht mitbringt.
- `src/Signal.ts` — der JSDoc von `onChange()` nennt untypisiertes JS als
  einzigen Ausweg aus der Rückgabetyp-Prüfung und lässt den zweiten aus, den
  6b überall sonst nachträgt: einen vorab deklarierten Callback mit
  `any`-Rückgabetyp. Die Aussage ist wahr, nur unvollständig — nach Regel 1
  dieses Pakets eine Lücke, keine Falschheit, und die Datei liegt außerhalb
  seines Bereichs. Der JSDoc wird nach `lib/Signal.d.ts` ausgeliefert.
- `docs/api.md:966` — die `delete(key)`-Zeile der `SignalAutoMap`-Tabelle nennt
  den einen Pfad nicht, auf dem das Signal überlebt. Absichtlich zusammen mit
  dem Code-Befund oben liegen gelassen: den Makel zu dokumentieren, während im
  selben Atemzug offen ist, ob er repariert wird, trennt zwei Hälften einer
  Entscheidung.
- `src/SignalGroup.ts:949` — verweist auf den Hook von `attachLink()` „above",
  der Hook steht bei `:1008-1012`, also darunter. Vorbestehend, aus keinem Diff
  dieses Laufs.
- `CONTRIBUTING.md:140` — die Sprachregel nennt „everything under `docs/`" und
  lässt die Wurzel-Markdowns (`README.md`, `AGENTS.md`, `CHANGELOG.md`)
  unerwähnt, obwohl READ-015 sie als englisch führt.
- `src/object-signals.ts:133` — `throwCollectedErrors(errors, 'destroying the
  signals of an object')` liest sich bei mehreren Objekten schief („2 errors
  while destroying the signals of **an** object"). Wörtlich aus der
  Audit-Empfehlung, öffentliche Fehlermeldung, im Test festgenagelt.

- **Die void-Lücke in der TYPE-006-Ausnahme.** Ein vordeklarierter Callback mit
  `(v: T) => void` kommt ohne jedes `any` durch die Signatur: TypeScripts
  void-Rückgaberegel erlaubt dem kontextuell typisierten Rumpf, einen Wert zu
  liefern, und `(v: T) => void` ist an `ValueChangedCallback<T>` zuweisbar, weil
  `void` in der Zielunion steht. Inline scheitert dieselbe Zeile. Keine der vier
  Stellen (`docs/api.md`, `docs/cheat-sheet.md`,
  `skills/using-signalize/references/api.md`, `src/create-signal.spec.ts`)
  dokumentiert das — sie behaupten es nach Runde 3 aber auch nicht mehr
  gegenteilig. Der Nutzer hat entschieden, die Lücke nicht zu füllen
  (2026-08-13); sie ist damit eine bewusste Auslassung, keine übersehene.
  Ebenfalls durchlässig und nirgends genannt: `const cb: any` und ein
  generischer Rückgabetyp `<R>(v: T) => R`.
- `AGENTS.md:211` — »covers exactly the blocking steps« steht neben einer Liste,
  die `clean`, `compile` und `bundle` nicht führt. In 6c planmäßig
  stehengelassen: `dist` ist keine Stufe von `world`, seine drei Teile sind es,
  während `typecheck` wörtlich gefahren wird. Kein Regress, aber das »exactly«
  trägt nicht.

**Kleinkram aus den Reviews**

- Der Fehlercode für einen inline unannotierten Callback mit Wertrückgabe an
  `onChange` ist `TS2322`, nicht `TS2345`; `TS2345` erscheint, wenn der Callback
  als Ganzes unzuweisbar ist (der `async`-Fall). Relevant, falls ein Folgeaudit
  auf den Code testet.

- `src/link.spec.ts:80` und `:823` — zwei Kommentare zitieren harte
  Zeilennummern (`link.ts:397`, `link.ts:313-314`), während die Codebasis sonst
  Symbole und Finding-IDs referenziert. `pnpm check:refs` deckt `docs/` und
  `skills/` ab, `src/` nicht; ob es das sollte, ist eine Entscheidung und keine
  Korrektur.
- `src/SignalAutoMap.spec.ts` — die `finally`-Blöcke sind uneinheitlich
  geschützt; empirisch unschädlich, aber die Begründung im Kommentar von Test 2
  gilt für Test 1 genauso.
- `src/effects.async.spec.ts:285` — „their promise" klein statt des im Plan von
  4b als Bezeichner gelisteten `Promise`. Die bessere Wahl, aber eine
  Abweichung vom Plantext.

**Nicht bewertet**

Die 20 Findings aus `./audit.html`, die dieser Lauf nie in die Hand genommen
hat — siehe „Was dieser Lauf nicht anfasst" am Dateianfang. Sie sind weder
widerlegt noch zurückgestellt; sie waren nicht beauftragt.
