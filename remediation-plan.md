# Remediation-Plan — @spearwolf/signalize

Quelle: ./audit.html vom 2026-08-14 · Branch: `main` · erstellt: 2026-08-14
Baseline: `pnpm world` vollständig grün (exit 0) — clean ✓ · check ✓ · typecheck ✓ · compile ✓ · bundle ✓ · test:smoke ✓ · checkPkgTypes ✓ · test ✓ (700 Tests, 62 Dateien, 99,48 % Statements) · test:gc ✓
Scope: 3 von 28 Findings, vom Nutzer namentlich benannt · ausgenommen: alle übrigen 25
Stand (2026-08-14): **Lauf abgeschlossen.** Beide Pakete erledigt, zwei Commits `060b054` und `cabf83b`. Nichts blockiert, keine offenen Folgen. `./audit.html` ist nachgeführt: vier Findings geschlossen, vier neu eingetragen, Score 89,5 → 90,0. Was bewusst ins nächste Audit geht, steht am Ende dieser Datei.

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung
läuft · `[x]` erledigt · `[!]` blockiert.

Diese Datei ist im Repo getrackt (der vorige Lauf hat sie committet) und wird
hier überschrieben. Solange der Lauf läuft, darf sie in keinen Paket-Commit
geraten — sie trägt die Hashes der Commits, in denen sie deshalb nicht liegen
kann. Also nie `git commit -a`, immer gezielt Pfade adden. Erst der
Abschluss-Commit nimmt sie mit.

## Scope

Im Lauf: ARCH-006, READ-018, READ-019.

Draußen, ohne Wertung — der Nutzer hat diesen Lauf ausdrücklich auf die drei
Punkte oben begrenzt: BUILD-022 (medium), TYPE-007, BUILD-023, BUILD-012,
BUILD-020, BUILD-021, DX-009, DX-002, DX-003, DX-004, DX-005, DX-006, DX-007,
DEP-002, TEST-027, TEST-028, DX-010, ARCH-005 (Rest, siehe unten), BUILD-024,
BUILD-019, BUILD-013, BUILD-014, BUILD-025, BUILD-026, DEP-004.

## Entscheidungen

- **READ-018 wird als eigener Durchgang erledigt** (2026-08-14). Die Empfehlung
  des Audits lautete »beim nächsten Anfassen der Stelle mitziehen«. Der Nutzer
  hat das Finding namentlich in diesen Lauf gegeben; damit gilt sein Auftrag.
  Die drei Dateien werden gezielt angefasst, nicht nebenbei.
- **READ-018 und READ-019 werden ein Paket** (2026-08-14). Beide sind dieselbe
  Sache — Kommentare, die statt der Sache die Vorgeschichte erzählen — und sie
  überschneiden sich in `src/SignalLink.ts`. Getrennt geschnitten müssten zwei
  Implementierer nacheinander dieselbe Datei anfassen, und READ-019s »entweder
  alle oder keine« zerfiele, wenn eins der beiden Pakete scheitert.
- **ARCH-005 gilt als behoben und wird im Audit gestrichen** (2026-08-14).
  Ansage des Nutzers. Gemessen: `diamond-example.mjs` ist aus dem Baum
  verschwunden und als Seite, Spec und Pitfall dokumentiert (`f1f4b3d`). Der
  zweite Teil der Empfehlung steht noch: `GEMINI.md` und `foo.mjs` stehen
  weiterhin in `.gitignore` statt in `.git/info/exclude`.
- **Der Rest von ARCH-005 wird mitgenommen** (2026-08-14, Antwort des Nutzers).
  `GEMINI.md` und `foo.mjs` wandern aus `.gitignore` nach `.git/info/exclude`.
  Angehängt an Paket 1, damit ARCH-005 vollständig erledigt ist und die
  Streichung im Audit belegbar bleibt.
- **Grobplan freigegeben** (2026-08-14): zwei Pakete in dieser Reihenfolge,
  READ-018 und READ-019 zusammen, Commits direkt auf `main`.
- **Finding-IDs bleiben im CHANGELOG erlaubt** (2026-08-14, Review Paket 1).
  Die Konvention oben verbietet sie in allem, was dieser Lauf schreibt. Der
  `## Unreleased`-Block dieses Projekts führt sie jedoch durchgängig
  (`(SEC-001)`, `(READ-009, CONS-010)`); eine ID-lose Zeile dazwischen liest
  sich als Lücke, nicht als Reinheit. Für `CHANGELOG.md` gewinnt der Hausstil,
  für Code, Kommentare und Doku gilt die Konvention unverändert.
- **READ-019 wird über alle drei Ringe umgesetzt** (2026-08-14, Antwort des
  Nutzers). Vorgelegt wurde die Erhebung des Planers: 29 Nennungen über 20
  Dateien statt der acht des Audits, aufgeteilt in ausgeschriebene
  Paketnummern in `src/`, nummernlose Verweise auf denselben Lauf, und die
  Fundstellen außerhalb `src/`. Alle drei gehen ins Paket. Ausgenommen bleibt,
  was der Planer in Schritt 11 als »bleibt stehen« aufführt.

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

Projektspezifisch dazu:

- `docs/conventions.md` ist kanonisch für alles, was in `src/` geschrieben
  wird, und trägt die beiden Regeln oben seit dem 14. August bereits selbst.
  Wer Code oder Kommentare anfasst, liest sie vorher.
- Imports in `src/` tragen die `.js`-Endung, auch wenn die Quelle `.ts` heißt.
- Prosa in Repo-Artefakten (Code, Kommentare, Doku, CHANGELOG) ist englisch;
  Commit-Messages folgen dem, was `git log` zeigt (englisch, Conventional
  Commits). Plan und Reports dieses Laufs sind deutsch.

## Vorbestehende Fehler

Keine. `pnpm world` war vor Lauf-Beginn vollständig grün.

## Pakete

### [x] 1. Ein Wächter für die Richtung der Modulschichtung
- Findings: ARCH-006 (low), ARCH-005 (info, Rest)
- Ziel: Eine Importkante, die die Schichtung verletzt, ohne einen Zyklus zu
  schließen, fällt in `pnpm check` auf statt zufällig irgendwann in
  `pnpm bundle`.
- Bereich: `scripts/`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`,
  `.gitignore`, `.git/info/exclude`; `src/**/*.ts` nur lesend
- Hängt ab von: —
- Modell: stärkste Stufe
- Hash: `060b054`
- Dateien: `scripts/check-layering.mjs` (neu), `package.json`, `AGENTS.md`,
  `CLAUDE.md`, `CHANGELOG.md`, `.gitignore`, `.git/info/exclude`

- Vorgehen:

  1. **`scripts/check-layering.mjs` anlegen**, im Stil von
     `scripts/check-doc-refs.mjs`: Shebang, Kopfkommentar, das der sagt, *warum*
     es das Skript gibt, `node:fs`-`globSync`, Projektwurzel über
     `fileURLToPath(import.meta.url)`, alle Treffer sammeln und am Ende in einem
     Block ausgeben, `process.exit(1)`.

  2. **Modulumfang** ist exakt der von `tsconfig.lib.json`: `src/**/*.ts` ohne
     `src/**/*.spec.ts` und ohne `src/__testing__/**`. Tests dürfen alles
     importieren; sie landen nicht im Bundle und tragen die Schichtung nicht.

  3. **Die Rangtabelle steht im Skript**, als geordnete Liste von Schichten —
     Index der Schicht ist ihr Rang. Sie wird nicht aus dem Graphen berechnet:
     ein berechneter Rang übernimmt jede Verletzung als neue Wahrheit und der
     Wächter wäre wertlos. Gemessen am 14. August, alle 31 Bibliotheksmodule,
     Modulname ohne `.ts`:

     | Rang | Module |
     | --- | --- |
     | 0 | `collect-errors`, `constants`, `effect-error-handlers`, `effect-hook`, `global-effect-stack`, `global-queues`, `thenable-guard`, `types`, `UniqIdGen` |
     | 1 | `batch`, `be-quiet`, `Effect`, `instances` |
     | 2 | `hibernate`, `signal-core`, `signalize-error` |
     | 3 | `deprecation-warnings`, `object-signals` |
     | 4 | `SignalGroup`, `touch`, `value` |
     | 5 | `EffectImpl`, `Signal`, `SignalLink` |
     | 6 | `create-signal`, `effects`, `link` |
     | 7 | `create-memo`, `decorators`, `SignalAutoMap` |
     | 8 | `index` |

     Jede Schicht bekommt im Skript einen kurzen Namen und einen Satz, was sie
     ist — Rang 0 sind die Blätter, die zur Laufzeit nichts aus dem Paket
     ziehen; Rang 8 ist der Einstiegspunkt. Die Namen der mittleren Schichten
     darf der Implementierer schärfen, die Zuordnung nicht ändern: sie ist
     gemessen und der aktuelle Baum erfüllt sie vollständig.

  4. **Die Regel**: eine Wertimport-Kante von A nach B ist erlaubt, wenn
     `rang(B) < rang(A)`. Gleicher Rang und höherer Rang fallen durch. Der
     aktuelle Baum enthält keine einzige Kante zwischen zwei Modulen desselben
     Rangs, die strikte Form ist also erfüllbar und wird genommen — sie ist es
     auch, die eine neue Geschwisterkante zur bewussten Entscheidung macht
     statt zu einer stillen.

  5. **Was als Wertkante zählt.** Erfasst werden `import`- und `export`-
     Statements mit `from './…'`; nur relative Ziele, alles andere (`node:*`,
     `@spearwolf/eventize`) wird übersprungen. Nicht erfasst:
     - `import type {…} from` und `export type {…} from` — reine Typkanten
       existieren im Bundle nicht, und `style/useImportType` als `error`
       erzwingt die Markierung bereits.
     Erfasst dagegen die Mischform `import {type A, b} from`, sobald auch nur
     ein Spezifizierer ohne `type` dabei ist, ebenso ein Default- oder
     Namespace-Import neben einer solchen Klausel, ebenso ein
     Seiteneffekt-Import `import './x.js'`. Gemessen: der Baum hat heute keine
     Seiteneffekt-Imports, keine dynamischen `import()`-Aufrufe und keine
     Sternformen in `src/`; die drei Fälle werden trotzdem behandelt, ein
     dynamisches `import()` mit relativem Ziel zählt als Wertkante.
     Imports tragen die `.js`-Endung, das Ziel wird auf `.ts` zurückgeführt.

  6. **Drei Wege in einen Fehlschlag, die nichts mit einer Kante zu tun haben** —
     das Doku-Gate dieses Projekts besteht still, wenn seine Globs nichts
     treffen, und dieser Wächter darf das nicht wiederholen:
     - Die Dateiliste ist leer → Fehler.
     - Ein Modul aus dem Umfang steht in keiner Schicht, oder eine Schicht nennt
       ein Modul, das es nicht gibt → Fehler mit Namen. Eine neue Datei in
       `src/` muss eingeordnet werden, bevor sie durchgeht.
     - Ein relatives Importziel löst auf keine Datei des Umfangs auf → Fehler.
     Dazu eine Selbstsicherung gegen das Parsen: die Zahl der erkannten
     Statements wird gegen die Zahl der `from '…'`-Vorkommen der Datei gehalten;
     weichen sie ab, hat der Scanner etwas übersehen und das ist ein Fehler,
     keine stille Null.

  7. **Ausgabe** im Ton der beiden vorhandenen Wächter: `[check-layering]`,
     Anzahl, dann je Verletzung eine Zeile mit Datei, Zeilennummer, Ziel und
     den beiden Rängen. Alle Verletzungen, nicht die erste.

  8. **Anschluss**: `check:layering` in die `scripts` von `package.json`, in die
     `check`-Kette hinter `check:refs` und `check:banner`.

  9. **Belegen, dass der Wächter anschlägt.** Eine Verletzung von Hand einbauen
     (Vorschlag: in `src/collect-errors.ts`, Rang 0, ein Wertimport aus
     `./signal-core.js`, Rang 2 — schließt keinen Zyklus, `tsc` schweigt),
     `pnpm check` laufen lassen, Ausgabe in den Report, Änderung zurücknehmen.
     Ohne diesen Nachweis ist das Paket nicht fertig; ein Wächter, der nur grün
     kann, ist das Finding selbst.

  10. **Doku nachziehen**, ohne Rückblick auf den Vorzustand:
      - `AGENTS.md`, Abschnitt »Module layering — no import cycles«: der
        Abschnitt beschreibt die Regel in Prosa und nennt `rollup.config.mjs`
        als das, was sie hält. Ergänzen, dass `scripts/check-layering.mjs` die
        Richtung hält und in `pnpm check` läuft, und dass die Rangtabelle dort
        die maßgebliche Fassung der Reihenfolge ist. Keine `datei:zeile`-
        Referenzen — `check:refs` verbietet sie in Prosa-Doku.
      - `CLAUDE.md`, Stichpunkt »No import cycles«: einen Satz, dass die
        Richtung ein eigenes Gate hat.
      - `CHANGELOG.md` unter `## Unreleased` → `### Build System`: eine Zeile.

  11. **Rest von ARCH-005**: die Zeilen `GEMINI.md` und `foo.mjs` aus
      `.gitignore` entfernen und in `.git/info/exclude` eintragen. Persönliche
      Kritzeldateien gehören nicht in eine Ignore-Liste, die das ganze Team
      trägt. `.git/info/exclude` ist nicht versioniert und taucht in keinem
      Diff auf — der Implementierer nennt im Report, was er dort eingetragen
      hat. Keine CHANGELOG-Zeile, das ist für Konsumenten unsichtbar.

- Verify: `pnpm check && pnpm typecheck && git status --short`
- Commit: `build: guard the direction of the module layering, not just its acyclicity (ARCH-006, ARCH-005)`
- Ergebnis: 1 Runde · ARCH-006 und der Rest von ARCH-005 behoben ·
  `scripts/check-layering.mjs` mit einer Leiter über 9 Ränge und alle 31
  Bibliotheksmodule, angeschlossen an `pnpm check` · Kantenerkennung zweimal
  gegen die im emittierten JS von `tsconfig.lib.json` verbliebenen Importe
  gediffed, beide Male 109 Kanten identisch · die vier Wege in einen
  Fehlschlag und der Statement-Zähler einzeln im Sandkasten ausgelöst · 23
  Importformen klassifiziert, keine falsch · `pnpm world` exit 0, 700 Tests,
  unverändert zur Baseline
- **Der Fund, der das Paket einordnet:** Die im Detailplan vorgeschlagene
  Proof-Kante (`collect-errors` → `signal-core`) taugte nicht — sie schließt
  einen Zweier-Ring, `pnpm bundle` fällt darüber, und der Nachweis hätte genau
  die Klasse gezeigt, die Rollup ohnehin sieht. Der Implementierer hat das
  gemessen und auf `UniqIdGen` → `be-quiet` gewechselt: aufwärts, ringfrei,
  `tsc` und Rollup schweigen beide. Ein Wächter, der nur die Fälle beweist,
  die schon jemand anders fängt, ist kein Wächter.
- klein, offen: `scripts/check-layering.mjs` — ein mehrzeiliges
  Template-Literal, dessen Zeile wie ein Import beginnt, erzeugt eine
  Phantom-Kante; der Statement-Zähler widerspricht dann und der Lauf fällt mit
  einer irreführenden Meldung durch. Laut statt still, und die Form existiert
  im Baum nicht.
- Nebenbefunde:
  - `scripts/check-doc-refs.mjs`, zweite Zeile — »Guard for package 29a«, die
    Paketnummer eines abgeschlossenen Laufs. Dieselbe Sache, die Paket 2 in
    `src/` ausräumt, nur eine Verzeichnisebene daneben. Der Planer von Paket 2
    entscheidet, ob sie mitgeht.
  - `.github/workflows/ci.yml`, Schritt zu `pnpm check` — heißt »Run biome
    checks (lint + format)«, obwohl dort schon vorher zwei Wächterskripte
    mitliefen, jetzt drei. Vorbestehend.
  - `AGENTS.md`, Abschnitt »Module layering« — die Schreibweise
    `effects.ts:createEffect` ähnelt der von `check:refs` verbotenen Form,
    zeigt aber auf ein Symbol und ist in Ordnung.
- Folgen: keine

### [x] 2. Kommentare in `src/` erzählen die Sache, nicht ihre Vorgeschichte
- Findings: READ-018 (info), READ-019 (info)
- Ziel: Kein Rumpfkommentar in `src/` verlangt vom Leser noch Kenntnis eines
  Vorzustands oder der Paketnummerierung eines abgeschlossenen Laufs.
- Bereich: `src/SignalLink.ts`, `src/link.ts`, `src/batch.ts`,
  `src/SignalGroup.ts` und die Spec-Dateien mit Paketnummern (Audit nennt acht
  Fundstellen, eine erste Messung findet neun — der Detailplan erhebt sie neu)
- Hängt ab von: —
- Modell: stärkste Stufe. Der Kommentarstil dieser Codebase ist dicht und
  trägt Messergebnisse; ein Umschreiben, das dabei Information verliert, wäre
  teurer als das Finding.
- Hash: `cabf83b`

- Abgleich (2026-08-14, gegen `060b054`):

  **READ-018 — unverändert.** Alle drei genannten Dateien tragen die
  Archäologie noch: `src/link.ts` (Messblock über `gLinks`, Kommentar über
  `gLinksCount`, Schlussabsatz des `gLinkFinalizer`-Kommentars), `src/batch.ts`
  (`Batch#flush()`), `src/SignalLink.ts` (fünf Stellen, siehe unten). Dazu
  `src/SignalGroup.ts` über `finalizeSignalGroup`, das das Audit unter
  READ-018 nicht nennt, aber unter READ-019 trifft.

  **READ-019 — unverändert, und die Menge ist größer als gemeldet.** Ich habe
  sie vollständig neu erhoben. Sie zerfällt in drei Ringe:

  - **Ring 1 — ausgeschriebene Paketnummern in `src/`: 10 Nennungen in 9
    Kommentarblöcken über 7 Dateien.** Das Audit zählt acht (es zählt Blöcke,
    und `SignalLink.ts`' `releaseAll()`-JSDoc trägt zwei Nennungen in einem
    Block), die Vormessung neun. Die zehnte findet keine Suche nach dem Wort
    »package«: `src/create-signal.passthrough.spec.ts` trägt die Nummer nackt
    im Testtitel — »the door 4a leaves open«.
  - **Ring 2 — derselbe Lauf ohne Nummer: 13 Nennungen über 8 Dateien.**
    »this package«, »the same package«, »the plan's named exceptions«, »rule
    c«, »Probe E from the audit«, »the reviewer of this package«. Sie
    scheitern an genau demselben Test wie Ring 1 — der Leser hat weder Plan
    noch Audit — und »this package« ist zusätzlich mehrdeutig gegen den
    legitimen Gebrauch (»das npm-Paket«), der im selben Baum sechsmal
    vorkommt. Sie gehören dazu: READ-019s »sonst sähe der Rest wie Absicht
    aus« zielt auf den Verweis, nicht auf die Ziffer.
  - **Ring 3 — außerhalb `src/`: 6 Nennungen über 4 Dateien.**
    `scripts/check-doc-refs.mjs`, `bench/effect.bench.ts`,
    `bench/signal-write.bench.ts` (dreimal), `AGENTS.md`. Begründung für die
    Aufnahme siehe Schritt 9.

  Zusammen 29 Nennungen über 20 Dateien. Alles Kommentar- und Titeltext, keine
  Codezeile ändert sich.

- Dateien: `src/SignalLink.ts`, `src/link.ts`, `src/batch.ts`,
  `src/SignalGroup.ts`, `src/index.public-surface.spec.ts`,
  `src/effects.noAutorun.spec.ts`, `src/create-signal.passthrough.spec.ts`,
  `src/effect-error-handlers.gc.spec.ts`, `src/effect-error-handlers.spec.ts`,
  `src/link.unlink.spec.ts`, `src/hibernate.spec.ts`, `src/link.gc.spec.ts`,
  `src/SignalAutoMap.gc.spec.ts`, `src/SignalAutoMap.spec.ts`,
  `src/EffectImpl.declarations.spec.ts`, `src/types.public-surface.spec.ts`,
  `scripts/check-doc-refs.mjs`, `bench/effect.bench.ts`,
  `bench/signal-write.bench.ts`, `AGENTS.md`, `docs/conventions.md`

- Vorgehen:

  0. **Erst lesen, dann schreiben.** `docs/conventions.md`, Abschnitt
     »Comments and inline documentation«, die Regeln »Say the thing, not where
     the thing is written down«, »No code archaeology« und »Keep it short«.
     Letztere trägt die zwei Fragen, die jeder Schnitt hier beantworten muss:
     Ist das, was stehen bleibt, ohne das Gestrichene noch wahr? Und trug der
     gestrichene Satz eine zweite, eigenständige Aussage, die der Grund für den
     Schnitt nicht abdeckt? Kein Satz wird gekürzt, ohne dass beide beantwortet
     sind.

  1. **`src/SignalLink.ts` — fünf Blöcke, alle mit einer Aussage, die bleibt.**

     a) Über `NEXT_VALUE_DESTROYED`: »… a constant makes that structural
        instead of a promise (side finding of package 6).« Aussage, die bleibt:
        eine Textkonstante für zwei Ablehnungsstellen, weil aus Sicht des
        Aufrufers kein Unterschied besteht und die beiden nicht auseinander
        driften dürfen. Vorgeschichte: die Klammer. Ersatzlos streichen, der
        Satz endet bei »instead of a promise«.

     b) JSDoc von `NextValueRead#releaseAll()`, der teuerste Block der Datei:
        »Clearing the hook is precaution, not load bearing, and the difference
        is measured. Package 6 removed the clearing and found nothing
        observable across seven scenarios: … (eventize unsubscribes are
        idempotent — measured again in package 8) … It stays because the next
        thing added to a settle path need not be inert.« Erhalten bleiben
        **vier** Aussagen, jede einzeln: (1) das Löschen des Cancel-Hooks ist
        Vorsichtsmaßnahme, nicht tragend; (2) warum es heute folgenlos ist —
        ein stehengebliebener Hook erreicht nur die Handles dieses Reads, die
        dann verbraucht sind; (3) eventize-Unsubscribes sind idempotent (eine
        Eigenschaft der Abhängigkeit, keine Historie — bleibt als Aussage,
        ohne das »measured again in«); (4) es bleibt trotzdem drin, weil das
        Nächste, was auf einen Settle-Pfad kommt, nicht inert sein muss.
        Vorgeschichte, die geht: »Package 6 removed the clearing and found
        nothing observable across seven scenarios« als Satzrahmen und beide
        Nummern. Die »seven scenarios« sind kein Messwert, den man aufhebt —
        sie zählen Testfälle eines Laufs, nicht ein Ergebnis; die Prüfung
        selbst steht als Tests in `SignalLink.spec.ts`. Vorschlag für den
        Rahmen: »Clearing the hook is precaution, not load bearing: a hook
        left behind reaches only this read's own handles, which are spent by
        then (eventize unsubscribes are idempotent), and it would reject a
        promise that has already settled. It stays because …«.

     c) In `#nextValue()`, an der `on(this, VALUE, …)`-Subskription: »`on`, not
        `once` — which is what the line that used to stand here ("we can not
        just use 'once' here because the value is retained") was reaching for,
        three refactors ago.« Aussage, die bleibt, und sie ist die ganze
        Begründung der Stelle: `on`, nicht `once`, weil ein retainter VALUE
        synchron noch innerhalb dieses `on()`-Aufrufs repliziert wird und ein
        Replay einer bereits verbrauchten Generation ignoriert werden muss,
        *ohne* die Subskription aufzugeben — ein `once` wäre vom Replay
        verbraucht und die Promise bliebe für immer pending. Vorgeschichte: das
        Zitat der toten Zeile und »three refactors ago«. Der Block beginnt
        danach direkt mit dem Grund, der Rest des Absatzes (K1-Verweis,
        `hasSettled`-Erklärung) bleibt unangetastet.

     d) Wenige Zeilen darunter, im `if (read.hasSettled)`-Zweig: »Release it
        here instead — the one thing `once` used to do for us, since a spent
        obligation removes itself.« Aussage, die bleibt: `releaseAll()` lief,
        bevor dieses Handle existierte, ist also daran vorbeigelaufen, deshalb
        wird hier von Hand freigegeben — und das ist genau der Dienst, den ein
        `once` selbst erbracht hätte, weil eine verbrauchte Verpflichtung sich
        selbst entfernt. Das ist die Kehrseite des Handels aus (c) und muss
        stehen bleiben; nur das Tempus geht: nicht »used to do for us«, sondern
        was ein `once` täte. Vorschlag: »— the one thing a `once` would do by
        itself, since a spent obligation removes itself.«

     e) JSDoc von `#consumeGeneration()`: »A plain `nextValue()` passes no
        cursor and therefore still settles on the replay, exactly as before.«
        Aussage: ein `nextValue()` ohne Cursor settlet auf dem Replay.
        Vorgeschichte: »still« und »exactly as before« — beides verweist auf
        den Zustand vor den Cursorn. Beides streichen.

     f) In `#asyncValues()`, am `cursor`: »a second iterator joining a running
        one still starts with the current value, as before«. Aussage: Cursor 0
        akzeptiert, was gerade im Slot steht, ein zweiter Iterator steigt
        also mit dem aktuellen Wert ein. Vorgeschichte: »still … as before«.
        Streichen, der Rest des Satzes trägt.

     g) In `destroy()`: »No `unretain(this, VALUE)` (and no `retainClear()`,
        which used to stand here) — `off(obj)` without a listener argument runs
        `keeper.removeAll()`, dropping every retain policy and every stored
        value in one go. The line that was here cleared a slot that the next
        line was about to remove outright.« Aussage: keiner der beiden Aufrufe
        ist nötig, weil `off(this)` über `keeper.removeAll()` Policy und Wert
        in einem Zug fallen lässt. Vorgeschichte: die Klammer und der komplette
        letzte Satz — er erklärt ausschließlich, warum eine Zeile ging, die es
        nicht mehr gibt. Beide streichen; der Kommentar beginnt dann mit »No
        `unretain(this, VALUE)` and no `retainClear()` —«.

  2. **`src/link.ts` — drei Stellen, davon eine mit einem Messwert, der
     nirgendwo sonst steht.**

     a) Der Messblock über `gLinks`, Schlusssatz: »The three figures this file
        used to carry — 75 µs "warm", 116 µs "cold", 0.60 ms "with no links" —
        are one per regime, in that order, each 20–30 % above what its own
        regime measures again today. They never contradicted each other; they
        answered three questions while all claiming to answer one, which is why
        only the warm number belongs near a hot path.« Zwei Dinge, sauber zu
        trennen:
        - **Bleibt, unverändert und vollständig:** die aktuelle Messung davor
          (2026-08-11, Node 25.9, `lib/`-Build, 1000 `set()`-Aufrufe, Mediane
          über fünf Prozesse; 59 µs warm, 96 µs für ein erstmals beschriebenes
          Signal in einem warmen Prozess, ~0,5 ms als Erstes in einem frischen
          Prozess; mit 1000 Callback-Links 55 ms warm, 60 ms kalt) samt dem
          Satz »That measurement lives here and nowhere else«. Sie ist der
          Grund für `LINK_COUNT_WARN_THRESHOLD` und steht tatsächlich nur hier.
          Sie wird **nicht** angefasst — die Konvention »no code archaeology«
          zielt auf den Vorzustand, nicht auf die Kennzahl der Gegenwart.
        - **Bleibt, umformuliert:** die Lehre »drei Regime, drei Fragen, nur
          die warme Zahl gehört neben einen Hot Path«. Sie steht schon im Satz
          davor (»the cost has three regimes, and keeping them apart is the
          whole point«) und trägt ohne die alten Zahlen. Vorschlag als
          Abschluss des Absatzes: »Keeping the three apart is the point: a
          single figure answers three questions while claiming to answer one,
          and only the warm number belongs near a hot path.«
        - **Geht:** die drei alten Zahlen (75 µs / 116 µs / 0,60 ms) und die
          Differenz »20–30 % above«. Sie sind kein aufzuhebender Messwert,
          sondern die Abweichung einer abgelösten Messung von der geltenden;
          wohin damit: nirgendwohin. Der Commit dieses Pakets konserviert den
          Absatz, und `CHANGELOG.md` führt keine Benchmarks.

     b) Über `gLinksCount`: »`getLinksCount()` without an argument used to
        iterate `gLinks.values()`, which a WeakMap cannot support. This tracks
        the same total explicitly.« Aussage: eine WeakMap lässt sich nicht
        iterieren, deshalb wird die Gesamtzahl explizit mitgeführt. Alles davor
        ist Vorgeschichte. Vorschlag, zwei Zeilen: »A WeakMap cannot be
        iterated, so the total `getLinksCount()` reports without an argument is
        tracked explicitly here.«

     c) Schlussabsatz des `gLinkFinalizer`-Kommentars: »It is neither
        schedulable nor observable — only the backlog it used to leave on the
        global queues is gone.« Aussage: der Finalizer ist weder planbar noch
        beobachtbar; das Einzige, was er bewirkt, ist, dass ein fallen
        gelassener Link keinen Rückstand auf den beiden globalen Queues
        hinterlässt. Vorgeschichte: nur das Tempus. Vorschlag: »— all it does
        is keep a dropped link from leaving its subscriptions on the two global
        queues.«

  3. **`src/batch.ts` — eine Stelle, und sie trägt eine Gefahr, keine
     Anekdote.** In `Batch#flush()`: »Clearing after `run()` instead of in a
     `finally` used to leave the whole queue standing — and `hibernate()`, its
     only caller, then restored a batch that recalled every one of them a
     second time when it closed: two runs of the same callback for one write,
     and the same failure reported at two different callers.« Aussage, die
     vollständig bleibt, weil sie erklärt, warum das `finally` dort steht: Ein
     Clear nach `run()` statt im `finally` lässt bei einem Throw die ganze
     Queue stehen; `hibernate()`, der einzige Aufrufer, stellt dann einen Batch
     wieder her, der beim Schließen jeden dieser Effekte ein zweites Mal
     abruft — zwei Läufe desselben Callbacks für einen Write, derselbe Fehler
     an zwei Aufrufern gemeldet. Nur die Zeitform geht: der Satz wird vom
     Rückblick in die Bedingung gedreht (»Clearing after `run()` instead of in
     the `finally` would leave the whole queue standing — and `hibernate()` …
     would then restore a batch that recalls …«). Der zweite Absatz des Blocks
     (»The argument covers the delivery, not `run()`'s own setup …«) bleibt
     unangetastet.

     Ausdrücklich geprüft und **nicht** anzufassen: das »as before« im JSDoc
     von `Batch#unbatch()` (»A later write re-queues the effect through
     `batch()` as before«). Es meint den normalen Ablauf zur Laufzeit, nicht
     eine frühere Fassung.

  4. **`src/SignalGroup.ts` — der Kommentar über `finalizeSignalGroup`.**
     »Since Package 1, `clear()` finishes the whole teardown before it throws,
     and it throws into a FinalizationRegistry job — a context with no
     caller.« Aussage: `clear()` zieht den Teardown vollständig durch, bevor es
     wirft, und hier wirft es in einen FinalizationRegistry-Job ohne Aufrufer —
     woraus der Rest des Absatzes (kein Re-Throw, kein stilles Schlucken,
     Diagnose-Kanal) folgt. Vorgeschichte: »Since Package 1,«. Streichen, der
     Satz beginnt mit »`clear()` finishes …«. Im selben Absatz zusätzlich »and
     without one it lands on `console.error` as it always did« → »… it lands on
     `console.error`«; »as it always did« ist eine Aussage über den Vorzustand
     und sonst nichts. Der Satz »This is the one path in the package where
     `clear()` runs without a caller at all« bleibt — »the package« ist hier
     das npm-Paket.

  5. **Ring 1, die fünf Spec-Dateien mit Paketnummern.**

     a) `src/index.public-surface.spec.ts`, im Test »carries no `export *`, in
        either form«: »… but not `export type * from …` — measured, not assumed
        (see the plan for Paket 5).« Aussage: Biomes
        `performance/noReExportAll` fängt die Wertform, aber nicht
        `export type *` — gemessen, nicht angenommen; deshalb deckt der Regex
        beide Formen ab und deshalb inspiziert die Datei Quelltext statt des
        kompilierten Moduls. Vorgeschichte: die Klammer. Streichen; »measured,
        not assumed« bleibt, es qualifiziert die Behauptung, nicht ihre
        Herkunft. Der Messwert geht dabei nicht verloren — `CLAUDE.md` führt
        ihn unter »Biome only« ausgeschrieben.

     b) `src/effects.noAutorun.spec.ts`, im `{autorun: false}`-Batch-Test:
        »… can be replaced by the flush in `batch()`'s `finally` (// Paket 12).
        The observation is copied out and checked afterwards.« Aussage: keine
        Assertion im Batch-Callback, weil der Flush im `finally` einen dort
        geworfenen Fehler ersetzen kann; die Beobachtung wird herauskopiert und
        danach geprüft. Vorgeschichte: `(// Paket 12)`. Streichen. Beim
        Anfassen die Zeile mit umbrechen — sie läuft derzeit über die Breite
        der übrigen Kommentare dieser Datei, und Biome formatiert Kommentare
        nicht nach.

     c) `src/create-signal.passthrough.spec.ts`, **zwei Stellen in einem
        Test**: der Titel »sees lazy through a SignalParams variable — the door
        4a leaves open« und im Rumpf »createSignal(existing, {lazy: true}) is
        TS2769 since package 4a.« Aussage im Rumpf: die Literalform ist ein
        TS2769-Fehler, und ohne diese Tür — eine als `SignalParams<T>` typisierte
        Variable statt eines Literals — wäre der `lazy`-Eintrag in
        `PASSTHROUGH_IGNORED_OPTIONS` ein toter Zweig. Vorgeschichte: »since
        package 4a«. Im Titel benennt »4a« die Tür über die Nummer des Laufs,
        der sie zugezogen hat; sie muss über die Sache benannt werden.
        Vorschlag: »sees lazy through a SignalParams variable — the door the
        overload leaves open«.

     d) `src/effect-error-handlers.gc.spec.ts`, im N13-Test: »The path the
        reviewer of package 8 drove by hand: an `EffectImpl` destroyed via
        `SignalGroup.clear()` from the FinalizationRegistry callback, not via
        an explicit `effect.destroy()` call.« Aussage: welchen Pfad dieser Test
        fährt. Vorgeschichte: wer ihn zuerst von Hand gefahren hat. Vorschlag:
        »The path this drives: an `EffectImpl` destroyed via …«. Der Rest des
        Blocks (async statt sync, und warum) bleibt unangetastet.

     e) `src/link.unlink.spec.ts`, im `finally` des Doppelfehler-Tests: »Rule
        (d) from package 7a: on the unfixed code `unlink()` leaves links
        standing that still carry their throwing listeners, so an unguarded
        teardown here would fail a second time and replace the assertion that
        brought us here. Each link goes down on its own.« Aussage: warum der
        Teardown hier pro Link einzeln und gekapselt läuft — ein `unlink()`,
        das Links mit werfenden Listenern stehen lässt, würde einen
        ungekapselten Teardown ein zweites Mal scheitern lassen und die
        Assertion ersetzen, die überhaupt hierher geführt hat. Vorgeschichte:
        die Regelnummer und »on the unfixed code«. Achtung beim Umschreiben:
        der Test prüft eine Zeile vorher `assertLinksCount(0)`, auf dem
        heutigen Code stehen die Links also gerade *nicht* mehr — der Satz darf
        nicht in eine Behauptung über die Gegenwart kippen, sondern bleibt
        konditional. Vorschlag: »Each link goes down on its own, and guarded:
        an `unlink()` that leaves links standing with their throwing listeners
        still attached would make a shared teardown here fail a second time and
        replace the assertion that brought us here.«

  6. **Ring 2, Teil 1 — die fünf Stellen in
     `src/types.public-surface.spec.ts`.** In allen fünf meint »this package«
     den Arbeitspaket-Lauf, nicht das npm-Paket:
     - Im Test »keeps a stray key out of the value branch«: »`lasy` is the
       neighbour of the very flag this package is about, and `createSignal` has
       always rejected both spellings.« → »`lasy` is the neighbour of `lazy`
       itself, and `createSignal` rejects both spellings.« Aussage: warum
       gerade dieser Tippfehler der teuerste ist, den die Exactness-Klausel
       fängt.
     - Zweimal wortgleich in `@ts-expect-error`-Kommentaren (im selben Test und
       im späteren `createSignal(5, {lasy: true, …})`-Test): »the one typo that
       would otherwise buy silence on the branch this package closes.« → »…
       on the branch the exactness clause closes.« Die Klausel ist im
       jeweiligen Blockkommentar darüber benannt; damit zeigt der Satz auf die
       Sache statt auf den Lauf.
     - Im Test »attachEffect takes the wrapper and gives it back«: »Still true
       after this package: the type is the whole defence here, which is why the
       call lives in type position only.« → »The type is the whole defence
       here, …«. Die Aussage, dass der Laufzeit-Guard `{}` durchlässt und erst
       das nächste `clear()` mit `TypeError` stirbt, steht davor und bleibt.
     - Im Test »publishes the diagnostics channel and its payload«: »the
       re-export is half of what this package promises« → »the re-export is
       part of the public surface«. Aussage, die bleibt: der Test geht
       absichtlich über den Einstiegspunkt statt über das Modul, weil
       `src/index.ts` eine Namensliste führt, deren Vollständigkeit kein
       Schritt von `pnpm world` prüft — und dass das nur für die Typliste gilt.

  7. **Ring 2, Teil 2 — die restlichen sieben Stellen.**

     a) `src/index.public-surface.spec.ts`, über `_opts`/`_key`: »The two type
        names this package moves off the link/automap stars and onto a by-name
        line (steps 1 and 2 of the plan).« Aussage: es geht um die beiden
        Typnamen, die `index.ts` namentlich statt über einen Stern
        veröffentlicht, und geprüft wird Erreichbarkeit, nicht Ablehnung.
        Vorgeschichte: die Bewegung selbst und der Verweis auf Planschritte.
        Vorschlag: »The two type names `index.ts` publishes by name rather than
        through a star. Presence, not rejection — …«.

     b) `src/effect-error-handlers.spec.ts`, im Block über die beiden nicht
        eigens getesteten Wege: »A `*` catch-all listener (`batch.ts` registers
        one) already made today's probe lie before this package:
        `getSubscribedEventNames()` would report `['*']`, and
        `.includes($effectError)` reads `false` regardless of a real
        `$effectError` subscriber. The counter behaves the same way it always
        did on that path — no behaviour change to pin.« Aussage, die bleibt und
        die der eigentliche Grund für den Absatz ist: Die Sonde lügt bei einem
        `*`-Listener, und deshalb gibt es für diesen Weg keinen eigenen
        Testfall — es gibt an ihm nichts festzunageln, weil der Zähler von ihm
        unberührt bleibt. Vorgeschichte: »already … before this package« und
        »the same way it always did«. Vorschlag: »A `*` catch-all listener
        (`batch.ts` registers one) makes today's probe lie:
        `getSubscribedEventNames()` reports `['*']`, and
        `.includes($effectError)` reads `false` regardless of a real
        `$effectError` subscriber. The counter is untouched by that path, so
        there is nothing to pin.« Der zweite Spiegelstrich des Blocks (`off()`
        direkt auf der Queue) bleibt unangetastet.

     c) `src/hibernate.spec.ts`, im Test »restores all three contexts when the
        flushed batch throws«: »an assertion failure in there is thrown away by
        `Batch.run()` in `batch()`'s `finally` (fixed in the same package).«
        Aussage: keine Assertion im Batch-Callback, weil sie dort verloren
        geht; die Beobachtungen werden danach geprüft. Vorgeschichte und
        obendrein mehrdeutig — ungeklärt, ob »fixed« sich auf das Wegwerfen
        oder auf den Fehler im Test darüber bezieht. Klammer ersatzlos
        streichen. Der Absatz davor (»The flush used to sit *before* the `try`
        …«) gehört zu einem Regressionstest und ist nicht Teil dieses Pakets —
        siehe »Was ausdrücklich stehen bleibt«.

     d) `src/SignalAutoMap.gc.spec.ts`: »Sharpened the way the reviewer of this
        package sharpened it: the unsubscribe handles are taken out of `unsubs`
        before the maps are dropped, so the resource finalizer has nothing to
        release …« Aussage: was der Aufbau tut und warum — die Handles werden
        vor dem Fallenlassen aus `unsubs` genommen, damit der Resource-
        Finalizer nichts freizugeben hat und die Subskriptionen nicht von
        selbst verschwinden können; was die Closure dann hält, hält sie für
        immer. Vorgeschichte: wer geschärft hat. Vorschlag: den Satz mit »The
        probe is sharpened past the obvious form: the unsubscribe handles are
        taken out of `unsubs` …« beginnen.

     e) `src/EffectImpl.declarations.spec.ts`, `describe`-Titel: »Z3 — the
        Effect facade stays bound; this package must not touch it«. Der
        Halbsatz nach dem Semikolon ist eine Aussage über den Auftrag eines
        Laufs, nicht über das Verhalten. Titel auf »Z3 — the Effect facade
        stays bound« kürzen. Das Kürzel `Z3` bleibt (siehe unten).

     f) `src/link.gc.spec.ts`, im ersten Test: »Probe E from the audit: create
        100 links, drop every external reference …« Aussage: was der Test tut
        und dass das Wegfallen des Quellsignals im selben Sweep tragend ist.
        Vorgeschichte: der Verweis auf ein Audit, das der Leser nicht hat —
        `docs/conventions.md` verbietet ihn ausdrücklich (»Never reference an
        issue, ticket, audit finding or bug number«). Vorschlag: »Create 100
        links, drop every external reference (signals, links, callbacks),
        force GC, and expect …«. Nebenbei zu reparieren, weil man ohnehin in
        der Zeile steht: der verrutschte Doppelpunkt am Zeilenanfang von »//:
        a link on a *live* source«.

     g) `src/SignalAutoMap.spec.ts`, zwei `finally`-Blöcke: »Not in the plan's
        named exceptions, but the same shape: … (rule c)« und »Not one of the
        plan's named exceptions, and not itself under test here — this test was
        left unwrapped in the first pass because …«. Beide Male ist die Aussage
        die Begründung des `finally` selbst und sie steht vollständig im Rest
        des Satzes: (erste Stelle) das zweite `clear()` wird von einer
        Assertion gefolgt und bleibt deshalb im `try`, und es stehen zwei
        Aufrufe hier, weil ein Fehlschlag vor dem zweiten `clear()` einen
        frischen `'a'`-Eintrag hinterlässt, den ein einzelnes `clear()` stehen
        ließe; (zweite Stelle) die eigene `delete()`-Schleife räumt nur auf dem
        Happy Path, ein Fehlschlag mittendrin lässt den Rest stehen, und
        `sm.clear()` ist dasselbe idempotente Sicherheitsnetz wie überall in
        dieser Datei. Vorgeschichte: der Verweis auf die Ausnahmenliste eines
        Plans, »rule c« und »in the first pass«. Beide Einleitungen streichen,
        beide Kommentare beginnen mit ihrer eigenen Begründung.

  8. **Ring 3a — `scripts/check-doc-refs.mjs`, zweite Zeile.** »Guard for
     package 29a: a `datei:zeile` reference in prose has a short half-life …«
     Die Nummer ist reine Etikettierung, der Rest des Kopfkommentars trägt den
     Grund vollständig. Auf »// A `datei:zeile` reference in prose has a short
     half-life …« kürzen. Begründung für die Aufnahme in dieses Paket: Der
     Test, an dem READ-019 hängt, ist verzeichnisunabhängig — der Leser hat den
     Plan des Laufs nicht, egal in welchem Ordner er steht. Dazu kommt ein
     Grund, den erst Paket 1 geschaffen hat: `scripts/check-layering.mjs` ist
     nach dem Vorbild dieser Datei gebaut. Der Kopfkommentar ist damit die
     Schablone für den nächsten Wächter, und eine Paketnummer in der Schablone
     wird wieder mitkopiert.

  9. **Ring 3b — `bench/` und `AGENTS.md`.** Vier Nennungen in `bench/`, eine
     in `AGENTS.md`, alle mit einem Ersatz, der schon im selben Kommentar
     steht:
     - `bench/effect.bench.ts`: »Baseline (reference point for package 12),
        measured on commit 5cb75f4« → Klammer streichen. Der Commit-Hash
        identifiziert die Messreihe bereits, und die Schwesterdatei
        `bench/signal-write.bench.ts` schreibt ihren Baseline-Block auf genau
        diese Weise ohne Nummer.
     - `bench/signal-write.bench.ts`, dreimal im letzten Block: »the Package 17
        numbers above«, »the commits since Package 17«, »the same
        alternating-runs protocol Package 17 used«. Gemeint ist jedes Mal der
        Messblock weiter oben in derselben Datei — der auf Commit `8cc46e9`,
        2026-08-11, mit den Zahlen 2.287.486 / 510.935 / 54.633 hz. Ersatz:
        »the `8cc46e9` numbers above«, »the commits since `8cc46e9`« und »the
        alternating-runs protocol that block used«. Keine Zahl, kein Datum und
        keine Aussage über Rauschen verändert sich dabei.
     - `AGENTS.md`, Abschnitt über `package.json#files`: »(measured: package
        29a's own edits moved it from 618.4/171.1 kB to 621.2/172.1 kB between
        two `npm pack --dry-run` runs taken hours apart)«. Aussage, die bleibt
        und die den ganzen Punkt trägt: gewöhnliche Dokumentationsarbeit
        verschiebt die Tarball-Größe messbar, weshalb hier eine Dateizahl
        steht und keine kB-Zahl. Vorgeschichte: welcher Lauf gemessen hat.
        Ersatz: »measured: one documentation package's edits moved it from
        618.4/171.1 kB …«. Beide Messwerte bleiben stehen.

  10. **`docs/conventions.md` schärfen, damit der Bestand nicht nachwächst.**
      Im Abschnitt »Comments and inline documentation«, Regel »Say the thing,
      not where the thing is written down«, die Aufzählung um den Fall
      erweitern, der in diesem Baum 29-mal vorkam und den die Regel heute nur
      dem Sinn nach abdeckt: die Nummer eines Arbeitspakets, eines Plans oder
      eines Review-Durchgangs (»package 7a«, »Paket 12«, »rule (d) from the
      plan«, »Probe E from the audit«) — der Leser hat den Plan noch weniger
      als den Tracker. Ein Satz, in der vorhandenen Stimme, ohne Verweis auf
      diesen Lauf und ohne Finding-ID. Dieselbe Regel gilt für `scripts/` und
      `bench/`; wo `docs/conventions.md` ihren Geltungsbereich nennt, wird das
      mitgesagt.

  11. **Was ausdrücklich stehen bleibt** — der Implementierer räumt hier nicht
      weiter auf, als das Paket reicht:
      - Die Sondenkürzel `K1`, `W1`, `S9`, `Z3`, `Z7`, `N13`, `E`-Buchstaben in
        Testtiteln und ihre Querverweise. Sie behaupten nichts über einen
        Vorzustand, sie sind die Anker, über die die Dateien einander zitieren
        (»Same probe as `effect-error-handlers.spec.ts`'s Z7«). Ein Umbenennen
        wäre eine Rename-Aktion ohne Gewinn für den Leser.
      - `src/link.ts` und `src/types.public-surface.spec.ts` verweisen auf
        »`pitfalls.md` 17b«. Das ist ein lebender Verweis auf eine nummerierte
        Stelle in `skills/using-signalize/references/pitfalls.md`, kein
        Paketverweis.
      - Die sechs Stellen, an denen »this package« das npm-Paket meint:
        `src/collect-errors.ts`, `src/thenable-guard.ts` (je »imports nothing,
        not even from this package«) und die vier Teardown-Specs
        (`EffectImpl.teardown.unsubscribeThrows.spec.ts`,
        `SignalGroup.teardown.unsubscribeThrows.spec.ts`,
        `teardown.offThrows.spec.ts`,
        `SignalAutoMap.teardown.unsubscribeThrows.spec.ts`, je »every
        subscription this package creates«). Sie sind korrekt und bleiben —
        sie sind zugleich die Referenz dafür, dass das Wort im Baum eine
        legitime Bedeutung hat.
      - `CHANGELOG.md`. Neun Einträge tragen »(audit follow-up, package 7b)«
        und Ähnliches, alle unter `## Unreleased` (die erste veröffentlichte
        Überschrift steht darunter, `v0.31.1`), also formal noch änderbar. Sie
        bleiben trotzdem: `docs/conventions.md` erklärt die Datei ausdrücklich
        zur Historie und nimmt sie aus, und die Entscheidung dieses Laufs vom
        14. August lässt für `CHANGELOG.md` den Hausstil gewinnen — dieselbe
        Klammer, die dort `(SEC-001)` trägt. Nicht anfassen.
      - Der breite Bestand an »used to«-Kommentaren in Spec-Dateien außerhalb
        der drei von READ-018 benannten Dateien (etwa `batch.spec.ts`,
        `create-memo.spec.ts`, `EffectImpl.destroy.spec.ts`,
        `hibernate.spec.ts`). Dort beschreibt »used to« meist, was ein
        Regressionstest festnagelt. Das ist ein eigenes Thema mit eigenem
        Umfang, kein Rest dieses Pakets — siehe »Folgen«.

  12. **Kein CHANGELOG-Eintrag und kein neuer Wächter.** Nichts an diesem Paket
      ist für einen Konsumenten sichtbar: keine Signatur, kein Verhalten, kein
      Ausgabetext ändert sich; zwei Testtitel ändern sich, was in keinem
      Artefakt landet, das ausgeliefert wird. `CLAUDE.md` lässt genau dafür das
      Auslassen zu. Und kein Skript in `scripts/` dafür: ein Muster, das
      »package 7a« fängt, fängt auch `package.json`, »npm package« und die
      sechs legitimen »this package«-Stellen; ein Wächter, dessen Ausnahmeliste
      länger ist als seine Regel, kostet mehr, als er hält.

  13. **Abschluss-Erhebung, mit Zahlen.** Nach den Änderungen laufen lassen und
      im Report belegen:
      - `grep -rnE '\b([Pp]aket|[Pp]ackage|[Pp]kg)\s*[0-9]+[a-z]?\b' src/ scripts/ bench/ AGENTS.md`
        → keine Ausgabe.
      - `grep -rn 'the door 4a' src/` → keine Ausgabe (die Nennung ohne das
        Wort »package«).
      - `grep -rniE 'this package|the same package|the plan|the reviewer|from the audit' src/`
        → **genau sechs** Zeilen, die sechs npm-Paket-Stellen aus Schritt 11.
      - `grep -rn 'used to' src/SignalLink.ts src/link.ts src/batch.ts src/SignalGroup.ts`
        → keine Ausgabe.
      Weicht eine der vier Zahlen ab, ist das Paket nicht fertig.

- Verify: `pnpm world` (erwartet: exit 0, 700 Tests, 62 Dateien, unverändert
  zur Baseline — dieses Paket ändert keine Codezeile, eine Abweichung bei der
  Testzahl bedeutet, dass ein Titel zerschossen wurde) und die vier Greps aus
  Schritt 13, danach `git status --short` gegen die Dateiliste oben.
- Commit: `docs: let the comments in src/ describe the code, not the run that changed it (READ-018, READ-019)`
- Ergebnis: 3 Runden · READ-018 und READ-019 behoben · 40 Dateien, 280+/305− ·
  aus »acht Kommentare in `src/`« wurden gemessen rund sechzig Stellen in vier
  Ringen: ausgeschriebene Paketnummern, derselbe Verweis ohne Ziffer
  (»this package«, »rule c«, »Probe E from the audit«, »measured during
  review«), dieselbe Klasse außerhalb `src/` in `scripts/`, `bench/` und
  `AGENTS.md`, und die Trümmer, die `c2fe023` beim Herausschneiden von
  Finding-IDs hinterlassen hat · kein Aussagenverlust an einer einzigen Stelle,
  vom Reviewer je Aussagenliste einzeln gegengeprüft · zwei Zählungen gegen den
  Code korrigiert statt umformuliert · `docs/conventions.md` gilt jetzt
  ausdrücklich auch für `scripts/`, `bench/` und `smoke/`, damit der Bestand
  nicht nachwächst · keine Codezeile geändert, sieben `describe`/`it`-Titel
  umformuliert · `pnpm world` exit 0, 700 Tests, unverändert zur Baseline
- **Der Fund, der das Paket einordnet:** Vier Sätze im Baum waren gar keine
  Archäologie mehr, sondern ihre Trümmer — ein früherer Aufräumlauf hatte
  Finding-IDs mitten im Nebensatz herausgeschnitten und die Reste stehen
  lassen. Einer davon behauptete seit dem im Präsens das Gegenteil der
  Assertion drei Zeilen unter ihm. Ein Verweis zu entfernen ist nicht
  dasselbe wie einen Satz zu Ende zu denken, und der Unterschied fällt
  niemandem auf, weil beides grün ist.
- klein, offen: keine.
- Nebenbefunde:
  - `src/message-prefix.spec.ts` — die selbstdefinierte Liste kündigt »Five
    things« an, läuft aber `(b)` bis `(f)`; ein `(a)` gibt es nicht, obwohl der
    Text es zitiert. Steht so seit der Erstfassung, nicht von einem Aufräumlauf
    verursacht. Bewusst nicht angefasst: die Datei war als vollständig
    ausgenommen.
  - Drei Testtitel mit »no longer«, die einen Vorzustand voraussetzen:
    `EffectImpl.declarations.spec.ts` (zwei) und
    `nested-effects-static-deps.spec.ts`. Die übrigen »no longer« im Baum
    meinen den Laufzeitablauf und sind korrekt.
- Folgen: keine

- Restplan: Paket 2 ist das letzte; der Schnitt bleibt, wie er freigegeben
  wurde. Geändert hat sich nur der Umfang innerhalb des Pakets — von acht
  Fundstellen in `src/` auf 29 in `src/`, `scripts/`, `bench/` und `AGENTS.md`,
  weil READ-019s »entweder alle oder keine« am Verweis auf einen verschwundenen
  Lauf hängt und nicht an der Ziffer oder am Verzeichnis. Ein Aufteilen in zwei
  Pakete würde genau diese Bedingung brechen.

## Abschluss

Semver: `package.json` steht auf `1.0.0-dev`, `scripts/publishPackage.cjs`
verweigert die Veröffentlichung, solange das Suffix da ist, und alles sammelt
sich unter `## Unreleased`. Beide Pakete haben die öffentliche Oberfläche nicht
berührt — kein Export, keine Signatur, kein Default, keine Engine-Anforderung,
kein ausgelieferter Typ. Nach der Tabelle wäre das `patch`; angehoben wird
nichts, weil dieses Projekt vor dem ersten Release keine Versionen vergibt.

CHANGELOG: eine Zeile unter `### Build System` für den Schichtungs-Wächter.
Paket 2 bekommt keine — Kommentare und Testtitel erreichen weder Aufrufer noch
Implementierer, und ein Umbau, der keines der beiden Publika erreicht, steht in
der Commit-Historie und nicht im CHANGELOG.

## Was ins nächste Audit geht

Bewusst nicht mehr in diesen Lauf gezogen, damit der Folgelauf sie nicht für
vorbestehende Defekte hält — alle vier sind in `./audit.html` eingetragen:

- `.github/workflows/ci.yml` — der Schritt zu `pnpm check` heißt »Run biome
  checks (lint + format)«, fährt aber drei Wächter. Vorbestehend.
- `scripts/check-layering.mjs` — ein mehrzeiliges Template-Literal, dessen
  Zeile wie ein Import beginnt, erzeugt eine Phantom-Kante samt irreführender
  Zählermeldung. Fällt laut aus, die Form existiert im Baum nicht.
- `src/message-prefix.spec.ts` — die selbstdefinierte Aufzählung kündigt fünf
  Punkte an und läuft `(b)` bis `(f)`, zitiert aber ein `(a)`, das es nicht
  gibt. Seit der Erstfassung so.
- Drei Testtitel mit »no longer«, die einen Vorzustand voraussetzen.
