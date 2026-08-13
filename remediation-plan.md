# Remediation-Plan — @spearwolf/signalize

Quelle: ./audit.html vom 2026-08-13 · Branch: `main` · erstellt: 2026-08-13
Baseline: `pnpm world` vollständig grün (exit 0) — check ✓ · typecheck ✓ · compile ✓ · bundle ✓ · test:smoke ✓ · checkPkgTypes ✓ · test ✓ (679 Tests, 60 Dateien, 99,48 % Statements) · test:gc ✓
Scope: 4 von 27 Findings, vom Nutzer namentlich benannt · ausgenommen: alle übrigen 23
Stand (2026-08-14): **Lauf abgeschlossen.** Alle zehn Pakete erledigt, zehn Commits von `2d442f7` bis `64893a0`. Nichts blockiert, keine offenen Folgen. Was bewusst ins nächste Audit geht, steht am Ende dieser Datei.

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung
läuft · `[x]` erledigt · `[!]` blockiert.

## Scope

Im Lauf: CONS-019, BUG-016, ASYNC-001, READ-017.

Draußen, ohne Wertung — der Nutzer hat diesen Lauf ausdrücklich auf die vier
Punkte oben begrenzt: BUILD-022 (medium), ARCH-006, TYPE-007, BUILD-023,
BUILD-012, BUILD-020, BUILD-021, DX-009, DX-002, DX-003, DX-004, DX-005,
DX-006, DX-007, DEP-002, TEST-027, TEST-028, ARCH-005, BUILD-024, BUILD-019,
BUILD-013, BUILD-014, DEP-004.

## Entscheidungen

- **BUG-016 wird repariert, nicht dokumentiert** (2026-08-13). `hibernate()`
  sammelt einen Fehler aus dem Flush des geretteten Batches und führt den
  Callback trotzdem aus; am Ende meldet `throwCollectedErrors()` einen Fehler
  unverändert, zwei als `AggregateError`. Das ist die Form, die `batch()` für
  Callback plus Flush bereits trägt. Verhaltensänderung, gehört in
  `## Unreleased`.
- **READ-017: das Gemessene wird verschoben, nicht gestrichen** (2026-08-13).
  Die neun Params-Formen und die drei Inferenz-Ausgänge wandern nach
  `docs/api.md`; im JSDoc bleibt die Regel in wenigen Sätzen plus Verweis.
- **READ-017 reicht über die öffentliche JSDoc in `src/`** (2026-08-13), also
  über jedes exportierte Symbol. Kommentare im Funktionsrumpf bleiben.
  `docs/conventions.md` wird mitgezogen, sonst stellt der nächste Beitragende
  den alten Zustand wieder her.
- **Zwei ungetestete Invarianten werden vor der JSDoc-Arbeit festgenagelt**
  (2026-08-13). Ein Abgleich aller Kommentare, die eine Invariante behaupten,
  gegen die Specs hat zwei Stellen ohne Deckung ergeben, beide an einer
  Overload-Reihenfolge, beide in Dateien, die die Pakete 5 und 8 umschreiben.
  Solange der Kommentar die einzige Sicherung ist, nimmt seine Kürzung die
  Sicherung mit. Alles Übrige, was in `src/` als load-bearing markiert ist, ist
  gedeckt: die Closure-Invarianten über die vier GC-Specs, die Params-Klauseln
  und die Decorator-Typargument-Bindung über `types.public-surface.spec.ts` und
  den Compiler, die Passthrough-Liste über ihre eigene Typ-Stolperfalle. Die
  Zweige, deren Kommentar sagt, kein Test könne sie fahren, sind unerreichbar
  und sollen es bleiben; die 100-%-Schwellen in `vitest.config.ts` erzwingen das.
- **Korrektur an der Zeile darüber, Hälfte eins** (2026-08-13, Planung Paket 4).
  »Zwei Stellen ohne Deckung« stimmt für `link()` und nicht für
  `SignalReader<T>`. Der Test `nested effects work as expected` in
  `effects.spec.ts` schreibt `vi.fn(getA)` und ruft das Ergebnis ohne Argument
  auf; eine Umkehr der Reihenfolge kostet ihn neun `TS2554`. Am Paket ändert
  das nichts — die Deckung ist beiläufig, ungenannt, hängt an der Inferenz von
  `vi.fn` und daran, dass dieser Test weiter `{get}` destrukturiert statt
  `() => sig.get()` zu schreiben, und ihre Fehlermeldung zeigt auf
  verschachtelte Effekte statt auf eine Overload-Reihenfolge. Sie zählt als
  Frühwarnung, nicht als Sicherung.

- **Vier Doku-Befunde aus Paket 2 werden nach Paket 3 verschoben** (2026-08-13).
  Der Reviewer hat für `hibernate()` einen fehlenden Eintrag in
  `skills/using-signalize/references/pitfalls.md` (Pitfall 11d, Aufzählung der
  Wege in die gesammelte Fehlerform) als `wichtig` gemeldet, dazu drei kleine:
  die Verschachtelung eines Flush-`AggregateError` in `errors[0]` ist nicht
  benannt, `hibernate()` trägt nur ein `@throws` statt eines je Wurfform, und
  `docs/cheat-sheet.md` schweigt bei `hibernate` zur Fehlerform. Nach der Regel
  löst der `wichtig`-Befund eine Runde in Paket 2 aus. Er wird trotzdem
  verschoben, weil Paket 3 dieselbe Funktion und dieselben Doku-Absätze
  anfasst und ihr eine **zweite** Wurfform hinzufügt: ein jetzt geschriebener
  Pitfall-Eintrag wäre nach Paket 3 sofort unvollständig. Die vier Punkte
  stehen als benannte Pflicht im Block zu Paket 3; sie sind damit nicht
  gestundet, sondern zugewiesen.

## Konventionen

Gelten für jede Zeile, die in diesem Lauf entsteht — Code, Kommentare,
Dokumentation, CHANGELOG, Migrations-Hinweise:

- Inline-Kommentare sind erwünscht, wo sie erklären, *warum* etwas so ist.
- Keine Finding-IDs. Sie gehören diesem einen Audit und sind danach tot. Sie
  leben in diesem Plan und in Commit-Messages, sonst nirgends.
- Kein Rückblick auf den Vorzustand: kein »früher«, kein »statt bisher«, kein
  »im Zuge des Audits umgestellt«. Der Test: Ergibt der Satz für jemanden Sinn,
  der den Vorzustand nie gesehen hat? Dann bleibt er. Braucht er ihn, gehört er
  in die Commit-Message — die Historie ist bereits konserviert.

Projektspezifisch, aus `CLAUDE.md` und `docs/conventions.md`:

- Imports in `src/` tragen die `.js`-Endung, auch für `.ts`-Quellen.
- `strict: true`, aber `strictNullChecks: false` — keine defensiven `?:` gegen
  Fehler, die hier keine sind.
- Keine Importzyklen. `pnpm bundle` bricht auf `CIRCULAR_DEPENDENCY` ab, `tsc`
  schweigt dazu. Ein neues Blattmodul importiert nichts aus `src/`.
- `sideEffects: false` — Modul-Toplevel bleiben nebenwirkungsfrei.
- Ein neues Modul ist für Konsumenten unsichtbar, bis `src/index.ts` es
  benennt; `index.public-surface.spec.ts` pinnt diese Liste.
- Jede nach außen sichtbare Änderung bekommt eine Zeile unter `## Unreleased`,
  unter der passenden `###`-Überschrift. Ein Fakt pro Zeile.
- `pnpm check` fährt `check:refs`: in `AGENTS.md`, `CLAUDE.md`, `README.md`,
  `CONTRIBUTING.md`, `docs/**/*.md` und `skills/**/*.md` ist jede
  `datei:zeile`-Referenz verboten. Symbolnamen statt Zeilennummern.

### JSDoc-Regel für die Pakete 5 bis 9

Sie gilt für die JSDoc jedes exportierten Symbols und ersetzt für diese Pakete
alles, was `docs/conventions.md` heute zur Kommentardichte sagt:

- Dokumentiert wird, was jemand wissen muss, um die Funktion richtig zu
  benutzen: Zweck in ein bis drei Sätzen, die Bedingungen, unter denen sie sich
  anders verhält als erwartet, und was sie zurückgibt oder wirft.
- Nicht dokumentiert wird, was der Name schon sagt. `@param signal - The signal
  to mute` an `muteSignal(signal)` fällt weg.
- Keine Herleitung, keine Messreihen, keine Aufzählung verworfener Alternativen,
  keine Begründung, warum eine Zeile so und nicht anders steht.
- Kein Verweis auf einen früheren Zustand, kein »used to«, kein »measured, both
  ways«, kein »three refactors ago«.
- Was ein Aufrufer trotzdem braucht — gemessene Grenzfälle, Params-Formen,
  Inferenzverhalten —, wandert nach `docs/api.md` und wird von dort verlinkt.
- **Eine Verdichtung mehrerer Sätze wird aussagenweise geprüft, nicht satzweise.**
  Die Inventur bucht pro Altsatz; ein Altsatz kann mehrere Aussagen tragen.
  Fällt eine beim Zusammenziehen weg, bleibt die Disposition `bleibt` stehen
  und sieht geprüft aus. In Paket 6 verschwand so ein `TS2769` samt seinem
  Verweis. (Lehre aus Paket 6.)
- **Ein Altsatz kann eine zweite, eigenständige Aussage tragen** — nicht nur
  eine Bedingung. Die Disposition gilt für den ganzen Satz, also verschwindet
  sie mit ihm, und die verbliebene Aussage bleibt dabei richtig: es fehlt nur
  etwas. Prüffrage neben Regel 3: »trägt der gestrichene Satz eine zweite
  Aussage, die nicht unter dieselbe Klausel fällt«. (Lehre aus Paket 8.)
- **Bucht eine Verdichtung die Bedingung einer Aussage weg und behält die
  Aussage, bleibt eine unbedingte Behauptung stehen.** Die Prüffrage lautet
  nicht »fehlt etwas«, sondern »stimmt das, was übrig blieb, noch ohne das
  Weggebuchte«. In Paket 7 entstand so eine falsche Aussage an `createMemo`,
  die ausgeliefert wurde. (Lehre aus Paket 7.)
- **Nennt ein Satz einen konkreten Fehlercode, eine Meldung oder ein Symptom,
  ist er Benutzungswissen** — egal wie sehr er nach Herleitung klingt, und egal
  ob er als eigener Satz oder als Klausel in einem anderen steht. Er bekommt nie
  `weg:`. (Lehre aus den Paketen 5 und 6.)
- Eine Warnung, die eine Regression verhindert, für die es keinen Test gibt
  (etwa: die Reihenfolge zweier Overloads ist load-bearing), bleibt erhalten,
  aber als `//`-Kommentar über der Deklaration statt als JSDoc. Der Planer
  belegt am erzeugten `lib/*.d.ts`, dass diese Form nicht ausgeliefert wird.

**Beleg zum letzten Punkt** (2026-08-13, Planung Paket 5, gilt für 5 bis 9):
`//`-Kommentare werden nicht ausgeliefert, `/** */`-Blöcke schon. Zwei
Messungen, beide mit `tsc` 7.0.2:

1. Am Baum selbst. `src/link.ts` trägt über der ersten `link()`-Overload einen
   JSDoc-Block und darunter vier `//`-Zeilen (»Order matters and nothing here
   re-checks it …«). In `lib/link.d.ts` steht der JSDoc-Block, die vier
   `//`-Zeilen fehlen — `grep "Order matters" lib/link.d.ts` ist leer.
2. An einer Sonde außerhalb des Baums, mit den `compilerOptions` aus
   `tsconfig.types.json` (`removeComments: false`, `stripInternal: true`,
   `emitDeclarationOnly`). Gefallen sind: `//` über einem `export interface`,
   über einer `export function`, über einer `export const`, an einem
   Interface-Member, und ein `//` das direkt hinter einem JSDoc-Block steht
   (der Block bleibt, die Zeile darunter fällt). Kein `//` hat es in die
   `.d.ts` geschafft.

Die Form trägt also. Sie kostet nur, was sie kosten soll: der Hinweis steht für
Beitragende in `src/` und für niemanden im Editor-Tooltip.

## Vorbestehende Fehler

Keine. Die Baseline war auf allen Stufen grün.

## Pakete

### [x] 1. Teardown: die letzten beiden Schritte außerhalb des collect()-Musters
- Findings: CONS-019 (low)
- Ziel: `SignalGroup#clear()` und `SignalLink#destroy()` bauen bis zum Ende ab
  und melden erst danach, auch wenn `off(this)` wirft.
- Hash: `2d442f7`
- Ergebnis: 2 Runden · CONS-019 an beiden Fundstellen behoben ·
  `src/teardown.offThrows.spec.ts` neu, 4 Tests, roter Lauf belegt ·
  `docs/api.md` um den fehlenden »Teardown errors«-Absatz für
  `SignalLink#destroy()` ergänzt · `pnpm world` exit 0, 683 Tests (vorher 679)
- Nebenbefunde: keine
- Folgen: keine

### [x] 2. hibernate(): der Callback läuft auch nach einem gescheiterten Flush
- Findings: BUG-016 (low)
- Ziel: Ein werfender Effekt im Flush des geretteten Batches kostet den
  Aufrufer nicht mehr seinen eigenen Callback.
- Hash: `ef0ff4c`
- Ergebnis: 2 Runden · BUG-016 behoben · Flush und Callback laufen je unter
  `collect()`, der Rückgabewert wird bis hinter `throwCollectedErrors()`
  zurückgehalten · Reviewer hat alle vier Pfade einzeln geprüft, kein Weg zu
  einem uninitialisierten `result` · zwei neue Tests plus der mitgezogene
  Bestandstest `restores all three contexts when the flushed batch throws` ·
  `pnpm world` exit 0, 687 Tests (vorher 683)
- Nebenbefunde: keine
- Folgen: vier Doku-Punkte an Paket 3 übergeben, dort erledigt

### [x] 3. beQuiet() und hibernate() weisen einen thenable Callback zur Laufzeit ab
- Findings: ASYNC-001 (low)
- Ziel: Alle drei Kontextklammern verhalten sich gleich; ein `async` Callback
  ist ein `TypeError` am Aufrufer statt einer stillen Fehlfunktion.
- Hash: `123b5bc`
- Ergebnis: 4 Runden · ASYNC-001 für `beQuiet()` und `hibernate()` behoben ·
  `src/thenable-guard.ts` neu (Blatt, importiert nichts), beide
  `isThenable`-Kopien gelöscht · alle sieben »no runtime check«-Stellen
  bereinigt, die vier aus Paket 2 übernommenen Doku-Punkte erledigt · drei
  Tests in `smoke/` und `types.public-surface.spec.ts` mitgezogen, Typ-Zeugen
  intakt · `pnpm world` exit 0, 693 Tests (vorher 687)
- Runde 3 korrigierte einen Sachfehler aus Runde 1: die Gegenprobe »ein
  `await` auf den `batch()`-Aufruf empfing die Rejection« beschrieb einen
  Zustand, den es nie gab — `batch()` gibt seit dem ersten Commit `void`
  zurück. An drei Stellen einheitlich formuliert und einheitlich falsch; vom
  Reviewer gefunden, vom Orchestrator am Baum verifiziert.
- Nebenbefunde: `docs/api.md` nannte den `beQuiet`-Parameter `callback`, die
  Signatur `action` — in Runde 1 dieses Pakets miterledigt.
- Folgen: keine offen

### [x] 4. Die zwei Overload-Reihenfolgen als Typ-Witness festnageln
- Findings: keines — Vorbedingung der Pakete 5 bis 9
- Ziel: Wer eine der beiden Reihenfolgen umdreht, bekommt `pnpm typecheck` rot
  statt einer Regression beim Konsumenten.
- Hash: `0584c80`
- Ergebnis: 2 Runden · beide Zeugen in `src/types.public-surface.spec.ts`,
  `src/types.ts` und `src/link.ts` unverändert · vier Gegenproben gefahren und
  vom Reviewer unabhängig nachgestellt: Reihenfolge gedreht → `TS2554`+`TS2578`
  bzw. zwei `TS2322`; Zeuge entschärft → je ein `TS2578` · keine harmlose
  Änderung an den beiden Symbolen macht einen Zeugen fälschlich rot ·
  `pnpm world` exit 0, 695 Tests (vorher 693)
- Korrektur am Kopf-Abschnitt: die Annahme »zwei Stellen ohne Deckung« traf nur
  für `link()` zu. `SignalReader<T>` war beiläufig gedeckt, über ein
  `vi.fn(getA)` in `src/effects.spec.ts` — ungenannt, an fremder Stelle, an der
  Inferenz von `vi.fn` hängend. Das Paket blieb deshalb in vollem Umfang.
- Bekannte Grenze: beide Zeugen stützen sich darauf, dass generische Inferenz
  die letzte Overload-Signatur greift. Gemessenes `tsc`-Verhalten, keine
  Sprachgarantie — ein Compiler-Sprung kann sie kippen. Die Fehlerrichtung ist
  die sichere: der Zeuge würde rot, nicht still.
- Nebenbefunde: keine
- Folgen: Pakete 5 und 8 schreiben die beiden betroffenen Kommentare um statt
  sie zu kürzen — »breaks consumer code no suite here covers« und »Order
  matters and nothing here re-checks it« sind jetzt sachlich falsch.

### [x] 5. types.ts und create-signal.ts: das Gemessene nach docs/api.md
- Findings: READ-017 (info), Kern
- Ziel: `SignalWriter` und die drei `createSignal`-Overloads tragen die Regel,
  `docs/api.md` trägt die Grenzfälle.
- Hash: `eec601c`
- Ergebnis: 3 Runden · Satz-Inventur über 187 Altsätze, jeder mit genau einer
  Disposition (`bleibt` 61 · `//` 14 · `api.md:` 12 · `dup:` 82 · `weg:` 18) ·
  von 82 Dubletten-Behauptungen erwies sich eine als falsch und wurde
  verschoben statt gestrichen · Reviewer prüfte 24 davon unabhängig nach, keine
  unauffindbar · JSDoc 274→134 bzw. 176→52 Zeilen, `lib/types.d.ts`
  18028→8570 B, `lib/create-signal.d.ts` 11661→3463 B · `pnpm world` exit 0,
  695 Tests unverändert
- Gemessen und im Plan-Kopf belegt: ein `//`-Kommentar über einer Deklaration
  wird von `tsc` nicht in die `.d.ts` emittiert. Zweifach nachgewiesen, vom
  Orchestrator unabhängig gegengeprüft.
- Zwei Verluste, die erst der Review fand und die Runde 1 zurückholte: die
  Fehlercodes `TS1166`/`TS2420` an `SignalLike` (als »Herleitung« gestrichen,
  tatsächlich das, was ein Aufrufer auf dem Bildschirm sieht) und die
  Kapselungshälfte des `LinkSource`-Absatzes. Runde 2 korrigierte eine
  Zeugennennung, die mehr Deckung behauptete als vorhanden.
- Nebenbefunde: `docs/api.md` trägt an vier Stellen Rückblicke auf frühere
  Fassungen (»An earlier revision of this page said …«, »used to refuse«,
  »All of it used to go straight to the console«, »It used to cost read
  freshness«) plus ein »Measured, both ways.« — Bestand, gehört in Paket 10.
- Folgen: Paket 8 verweist für `LinkSource.value` auf »What `source.value`
  shows« in `docs/api.md`, statt den Inhalt erneut zu erzählen.

### [x] 6. Öffentliche JSDoc: Signal-Ebene
- Findings: READ-017 (info)
- Ziel: Jedes exportierte Symbol dieser Dateien sagt, wofür es da ist und wo es
  überrascht, und sonst nichts.
- Hash: `df43566`
- Ergebnis: 3 Runden · 99 Altsätze disponiert (`bleibt` 61 · `dup` 26 · `weg` 11
  · `api.md` 1 · `//` 0) · alle 24 Dubletten-Behauptungen nachgeschlagen, keine
  falsch, drei davon in `recipes.md`/`architecture.md` statt `api.md` und dort
  belassen · Overload-Reihenfolgen in `value.ts` und `touch.ts` probeweise
  getauscht, beide Male grün, also nicht tragend, kein Zeuge erfunden ·
  `lib/*.d.ts` der fünf Dateien 12804→8455 B · `pnpm world` exit 0, 695 Tests
- Was der Review fand und die Runden zurückholten: ein **elfter** Fehlercode-Satz
  (`TS2769` zu undeklarierten Params-Schlüsseln), der in einer Verdichtung
  verschwand, samt dem Zeiger, der als einziger zur überlebenden Regel führte;
  die Compile-Zeit/Laufzeit-Trennung an `onChange()`; ein Verweis, der ins
  Link-Kapitel statt auf den eigenen Tabelleneintrag zeigte; die einzige
  Überraschung des obersten `touch()`.
- Lehre für die Pakete 7 bis 9, im Plan-Kopf ergänzt: **die Inventur bucht pro
  Altsatz, aber ein Satz kann mehrere Aussagen tragen.** Verschwindet eine davon
  beim Zusammenziehen, bleibt die Disposition `bleibt` stehen und sieht korrekt
  aus. Jede Verdichtung braucht deshalb eine eigene Prüfung, aussagenweise.
- Nebenbefunde: keine
- Folgen: keine

### [x] 7. Öffentliche JSDoc: Effekt-Ebene
- Findings: READ-017 (info)
- Ziel: Jedes exportierte Symbol der Effekt-Ebene sagt, wofür es da ist und wo
  es überrascht, und sonst nichts.
- Hash: `854bf01`
- Ergebnis: 4 Runden · 101 Altsätze disponiert · 18 Fehlercode-Sätze erhalten,
  vier davon Klauseln in längeren Sätzen · alle 16 Dubletten nachgeschlagen,
  vom Reviewer alle 16 unabhängig gegengeprüft · `createEffect`-Overloads
  1↔2 und 3↔4 probeweise getauscht, grün, kein Zeuge erfunden · Klasse
  `EffectImpl` unangetastet · `lib`: `effects.d.ts` 7238→5132,
  `Effect.d.ts` 922→571, `create-memo.d.ts` 5110→2513 B · `pnpm world`
  exit 0, 695 Tests
- **Zwei falsche Aussagen korrigiert statt gekürzt.**
  `EffectOptionsWithNameDeps` versprach die Verhinderung eines `TypeError`,
  den es nicht gibt — der Konstruktor prüft die Gruppe selbst und wirft mit
  Text. Und `createEffect` behauptete den Sofortlauf als Voreinstellung, den
  statische `dependencies` unabhängig von `autorun` abschalten.
- **Ein dritter Fehlertyp, den der Review fand:** die Verdichtung buchte die
  *Bedingung* einer Aussage als Dublette weg und behielt die *Aussage*. Übrig
  blieb an `createMemo` eine unbedingte Behauptung über den Rollback, die für
  den `{attach}`-Fall falsch ist — und ausgeliefert wurde. Schlimmer als ein
  Verlust: wer sie liest, baut darauf.
- Nebenbefunde: keine offen
- Folgen: keine

### [x] 8. Öffentliche JSDoc: Container und Links
- Findings: READ-017 (info)
- Ziel: Jedes exportierte Symbol dieser vier Dateien sagt, wofür es da ist und
  wo es überrascht — samt seiner Bedingungen.
- Hash: `11fe4dd`
- Ergebnis: 2 Runden · größtes Paket des Laufs · 199 Altsätze disponiert
  (`bleibt` 148 · `weg` 37 · `dup` 11 · `api.md` 1 · `//` 2) · 69 Bedingungen
  einzeln geführt, 65 am Symbol · 20 Fehlercode-Sätze, alle am Symbol · alle
  11 Dubletten nachgeschlagen, vom Reviewer 8 unabhängig gegengeprüft, keine
  falsch verortet · 742 Zeilen Rumpfkommentar und jede Codezeile unberührt ·
  `lib`: 31218→23041 B · `pnpm world` exit 0, 695 Tests
- Zwei Gegenproben am Baum: `link()`-Overloads getauscht → genau zwei `TS2322`,
  beide im benannten Zeugen; `settleWithDestroy()` auf `resolve` umgestellt →
  `reject next value when link is destroyed` wird rot. Erst danach durften
  Zeuge und Testname im Kommentar genannt werden.
- **Regel 3 griff achtmal.** Der schärfste Fall: `link()`s »There is no fifth
  way« war absolut formuliert und trug seine Bedingung in der Klammer dahinter,
  die als Dublette gebucht war. Ein regelkonformes `dup:` hätte die Bedingung
  entfernt und die absolute Behauptung ausgeliefert.
- **Eine zweite Ausprägung derselben Klasse, vom Review gefunden:** ein Altsatz
  kann nicht nur eine Bedingung, sondern eine **zweite eigenständige Aussage**
  tragen. An `attachEffect()` fiel so der einzige öffentliche Hinweis darauf,
  dass `attachSignal()` und `attachLink()` dieselbe Regel mit eigenen Meldungen
  durchsetzen. Die erneute Prüfung aller 37 Streichungen fand einen zweiten
  Fall (`asyncValues`, die Schließpflicht des Aufrufers).
- Nebenbefunde: `$autoMapResources` wird aus `src/constants.ts` nach
  `lib/constants.d.ts` emittiert, weil es dort `//` statt `@internal` trägt —
  für Konsumenten unerreichbar, da weder `index.ts` noch die `exports`-Map
  dorthin führen. Kein Handlungsbedarf in diesem Lauf.
- Folgen: die vier `api.md`-Einschübe werden von Paket 10 ergänzt, nicht
  dupliziert; zwei davon sind neuer Stoff für `cheat-sheet.md` und `skills/`.

### [x] 9. Öffentliche JSDoc: Frames, Diagnose, Decorators
- Findings: READ-017 (info)
- Ziel: Die drei Kontextklammern, der Diagnosekanal und der Decorator-Einstieg
  sagen, wofür sie da sind und wo sie überraschen.
- Hash: `6e9d051`
- Ergebnis: 2 Runden · 89 Altsätze disponiert (`bleibt` 65 · `dup` 10 ·
  `weg` 11 · `//` 2 · `api.md` 1) · alle 21 Fehlercode-Sätze am Symbol · 35 der
  38 Bedingungen am Symbol · Regel-4-Prüfung ohne Fund, vom Reviewer an fünf
  Streichungen nachgestellt · `lib`: 14140→11798 B · `pnpm world` exit 0,
  695 Tests
- Die Absätze, die die Pakete 2 und 3 in `hibernate()` und `beQuiet()`
  eingetragen haben, sind **byte-identisch** erhalten — vom Reviewer Wort für
  Wort gegen `git show HEAD` geprüft. Ein Lauf, der wegoptimiert, was er selbst
  erarbeitet hat, wäre die teuerste Art von Konsequenz.
- `src/index.ts` liegt außerhalb: sein Kopfkommentar hängt an keinem Symbol,
  adressiert Beitragende und erreicht keine `.d.ts` (gemessen).
- **Ein Befund aus der Wechselwirkung mehrerer Pakete:** `signal()` zeigte für
  seine Optionen auf `SignalDecoratorOptions`; dieser Block schrumpfte in
  Paket 9, `SignalParams` verlor seine Member-JSDoc in Paket 5, und
  »`name` defaults to the property name« fiel hier als Dublette. Jede
  Entscheidung für sich richtig, zusammen ein Tooltip, in dem `name` dreimal
  vorkommt und nirgends erklärt wird.
- Nebenbefunde: die JSDoc von `Batch#unbatch`/`Batch#run` (~1,5 kB) wird über
  `declare class Batch` ausgeliefert, obwohl die Klasse nicht exportiert ist —
  gleiche Lage wie `EffectImpl` in Paket 7, bleibt stehen. Zwei Rumpf-`//` in
  `src/batch.ts` tragen »right now« und »used to«, außerhalb jedes Pakets.
- Folgen: vier Vorgaben an Paket 10 (Decorator-Einschub in `api.md`, die
  Rückblick-Liste in `docs/` und `skills/`, die zwei neuen `//`-Begründungen
  für den `architecture.md`-Prüfstand).

### [x] 10. docs/conventions.md nachziehen, Doku-Abgleich, CHANGELOG
- Findings: READ-017 (info), Abschluss
- Ziel: Die Regel steht dort, wo der nächste Beitragende sie sucht, und die
  Doku-Kette ist wieder in sich stimmig.
- Hash: `64893a0`
- Ergebnis: 2 Runden · sechs Eingriffe in `docs/conventions.md` · 40
  Rückblick-Fundstellen umgeschrieben, 13 bewusst stehengelassen (dort meint
  »no longer« einen Zustandswechsel im beschriebenen Ablauf) · drei
  Doku-Nachzugsketten `api.md` → `cheat-sheet.md` → `skills/` geschlossen ·
  `thenable-guard.ts` in `docs/architecture.md` eingetragen · drei
  CHANGELOG-Zeilen · `pnpm world` exit 0, 695 Tests
- **Der Fund, der den Lauf einordnet:** `docs/conventions.md` verlangte JSDoc
  über »what the thing does, **its parameters**, and the behaviour a caller can
  rely on«. Dieses pauschale »its parameters« hat das `@param signal - The
  signal to mute` erzeugt, das die Pakete 5 bis 9 hundertfach entfernt haben.
  Die Konvention war nicht veraltet, sie war die Ursache. Korrigiert, nicht
  ergänzt.
- **Ein Beinahe-Verlust der teuersten Lehre.** Der zusammenfassende Satz unter
  »Keep it short« trug Regel 3 und **widerrief** Regel 2: seine Eröffnung »the
  question is not whether something is missing« schob genau die Prüffrage weg,
  die in Paket 8 den Verlust an `attachEffect()` gefunden hatte. Ursache war
  die Vorgabe des Orchestrators, drei Lehren auf einen Satz zu ziehen. Der Satz
  stellt jetzt beide Fragen.
- Nebenbefunde: keine offen
- Folgen: keine

## Was ins nächste Audit geht

Bewusst nicht mehr in diesen Lauf gezogen, damit der Folgelauf sie nicht für
vorbestehende Defekte hält:

- `$autoMapResources` wird aus `src/constants.ts` nach `lib/constants.d.ts`
  emittiert (dort `//` statt `@internal`, `stripInternal` greift nicht). Für
  Konsumenten unerreichbar, weder über `index.ts` noch über die `exports`-Map.
- Die JSDoc von `Batch#unbatch`/`Batch#run` (~1,5 kB) wird über `declare class
  Batch` ausgeliefert, obwohl die Klasse nicht exportiert ist. Gleiche Lage wie
  `EffectImpl`.
- Rückblicke in Rumpfkommentaren von `src/SignalLink.ts`, `src/link.ts` und
  `src/batch.ts` — außerhalb jedes Pakets, weil die Entscheidung im Kopf
  Rumpfkommentare draußen hält.
- Acht Paketnummern früherer Läufe in `src/`-Kommentaren. Eine reparieren und
  sieben stehen lassen wäre willkürlich.
- Zwei ältere Lücken der Tabelle »Source layout« in `docs/architecture.md`:
  `effect-error-handlers.ts` und `deprecation-warnings.ts`.
