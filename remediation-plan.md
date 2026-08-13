# Remediation-Plan — @spearwolf/signalize

Quelle: `./audit.html` vom 2026-08-13 · Branch: `main` · erstellt: 2026-08-13
Baseline: `pnpm world` in allen neun Stufen grün — 59 Spec-Dateien, 673 Tests, Coverage 99,47 / 97,01 / 99,64 / 99,52 · keine vorbestehenden Fehler
Scope: **4 von 24 Findings**, vom Nutzer namentlich beauftragt — MEM-014 (`medium`), API-019 (`low`), CONS-018 (`low`), SEC-002 (`info`)
Stand (2026-08-13): **LAUF ABGESCHLOSSEN.** Alle 3 Pakete `[x]` (`489f979`, `500152c`, `844a759`), keines blockiert, kein Stash offen. Alle 4 beauftragten Findings sind geschlossen. `pnpm world` grün in allen neun Stufen. Offene Arbeit gibt es hier nicht — was aussteht, steht unter »Was dieser Lauf offen lässt«.

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung
läuft · `[x]` erledigt · `[!]` blockiert.

**Diese Datei ist im Repo getrackt** (aus dem vorigen Lauf, Commit `c2fe023`
und früher) und wurde von diesem Lauf überschrieben. Der alte Endstand bleibt
über die Historie erreichbar. Während des Laufs bleibt sie aus **jedem**
Paket-Commit draußen — sie trägt die Hashes eben dieser Commits, also wird in
jedem Paket-Commit ausschließlich mit expliziten Pfaden gestaged. Ins Repo geht
sie einmal, mit dem Abschluss-Commit.

## ÜBERGABE — der Lauf ist abgeschlossen

**Für einen frischen Agenten ohne Vorwissen.** Diese Datei hat einen Lauf des
Skills `js-ts-audit-remediation` geführt und hält seinen **Endstand**. Jeder
Paketblock trägt `[x]`, einen Commit-Hash und eine `Ergebnis`-Zeile mit
Messwerten. Es gibt hier keine offene Arbeit.

Wer die Datei als Erstes findet, liest in dieser Reihenfolge:

1. **»Was dieser Lauf offen lässt«** — der Eingabestapel fürs Folgeaudit.
2. **»Semver-Bewertung«** — warum der Lauf `breaking` ist und trotzdem keine
   Version angehoben hat.
3. **Die Paketblöcke** — was gemessen wurde, und wo eine Empfehlung des Audits
   am Code nicht trug.

Das Folgeaudit läuft über `js-ts-project-audit`; es verifiziert jedes Finding
am Code neu. `./audit.html` wurde von diesem Lauf **nicht** angefasst — wer
sich selbst benotet, hat immer bestanden.

## Was dieser Lauf nicht anfasst

Die übrigen 20 Findings aus `./audit.html`. Sie sind nicht bewertet, nicht
widerlegt und nicht zurückgestellt — sie waren schlicht nicht beauftragt.
`acknowledged` ist im Audit leer. Die drei Punkte unter `openQuestions`
(Release des `-dev`-Suffix, Deploy-Authentifizierung, Hero-Assets in der
git-Historie) berühren keines der vier Findings und bleiben Maintainer-Sache.

## Entscheidungen

- **API-019 wird als Verhalten gefixt, nicht dokumentiert** (2026-08-13): im
  Effektkörper von `Signal#onChange` liest `this.get()` statt `this.value`, der
  Callback sieht damit denselben Wert wie jeder andere Leser. Die dokumentierte
  Variante aus der Empfehlung ist damit vom Tisch — was in der Doku entsteht,
  ist eine Zusicherung, kein Vorbehalt.

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

- `docs/conventions.md` ist kanonisch für Namensgebung, Importform,
  Kommentardichte und Tests. Wer Code schreibt, hat es gelesen.
- Imports in `src/` tragen die `.js`-Endung. Immer.
- Ändert sich die öffentliche API, wird in dieser Reihenfolge nachgezogen:
  JSDoc → `docs/api.md` → `docs/recipes.md` → `docs/cheat-sheet.md` →
  `skills/using-signalize/` → `README.md` → `CHANGELOG.md`.
- Jede benutzersichtbare Änderung bekommt eine Zeile unter `## Unreleased`.
  Ein Fakt pro Zeile. Released-Blöcke bleiben unangetastet.
- Nur `src/` und `scripts/` werden editiert; `lib/` und `dist/` sind generiert.

## Vorbestehende Fehler

Keine. Die Baseline ist auf ganzer Breite grün.

## Pakete

### [x] 1. EffectImpl: Signal-Abmeldung bricht nicht mehr auf halbem Weg ab

- Findings: MEM-014 (`medium`)
- Ziel: `unsubscribeSignal()` gibt beide Queue-Handles eines Signals frei und
  räumt sein Register auf, auch wenn ein Handle wirft.
- Hash: `489f979`
- Ergebnis: 2 Runden · MEM-014 behoben in `src/EffectImpl.ts` an beiden
  betroffenen Bahnen (`unsubscribeSignal()`, dazu die Schleife in
  `cleanupLostSignals()`, die sonst bei der ersten werfenden ID abgebrochen
  wäre) · neue `src/EffectImpl.teardown.unsubscribeThrows.spec.ts` mit drei
  Zeugen, je einzeln rot gesehen: die zwei Subskriptionsbahnen gegen `HEAD`,
  die Registerhälfte zusätzlich gegen eine Mutante, die beide Handles korrekt
  freigibt und nur den Registereintrag stehen lässt · drei CHANGELOG-Zeilen für
  die drei Aufrufer von `unsubscribeSignal()` (Detach, Zerstörung, Rerun-Prune)
  · `pnpm world` grün in allen neun Stufen, 60 Dateien, 676 Tests
- Offen gelassen, Stufe `klein`: das `try`/`finally` in `unsubscribeSignal()`
  kann nicht mehr greifen, weil `collect()` jeden Wurf schluckt — der
  Detailplan gab die Form vor, als Sichtanker vertretbar; am frühen `return`
  in `cleanupLostSignals()` fehlt die Äquivalenz-Begründung, die
  `destroyChildEffects()` im JSDoc trägt; das CHANGELOG erwähnt nicht, dass
  beide Stellen jetzt einen `AggregateError` liefern können — über die
  öffentliche API unerreichbar, weil eventize-Handles nicht werfen.
- Nebenbefunde:
  - `src/EffectImpl.ts:867-893` — `onSignalDestroyed()` überspringt bei einem
    Wurf aus `unsubscribeSignal()` weiterhin die `hasNoLiveSignals()`-Prüfung.
    Gemessen: ein Effekt mit genau einer Abhängigkeit zerstört sich mit und
    ohne diesen Fix nie selbst. Im Detach-Zweig bleibt die ID zusätzlich in
    `#signals` stehen, wodurch `whenSignalIsRead()` sie nie wieder abonniert —
    der Effekt ist für dieses Signal dauerhaft taub, auch nach erneutem Lesen.
    Vorbestehend, vom Detailplan bewusst ausgeklammert, nicht im Audit.

### [x] 2. Öffentliche Einstiege: `unlink()` wirft, `onChange()` liest sauber

- Findings: CONS-018 (`low`), API-019 (`low`)
- Ziel: Beide Einstiege verhalten sich wie ihre Geschwister — `unlink()` weist
  ein Nicht-Signal mit `TypeError` zurück, `onChange()` reicht dem Callback den
  Wert durch den `beforeRead`-Hook.
- Hash: `500152c`
- Ergebnis: 1 Runde, keine Befunde auf `kritisch` oder `wichtig` · CONS-018
  behoben in `src/link.ts:342-348`, API-019 in `src/Signal.ts:115` · drei
  Regressionstests, je einzeln rot gesehen und je gegen eine eigene Mutante
  geprüft — keine überlebte · elf Doku-Stellen nachgezogen, gegengesucht:
  keine Stelle im Baum schreibt `unlink()` noch Schweigen zu oder dem
  `onChange`-Callback einen ungetrackten Read · Zählschranken in
  `src/message-prefix.spec.ts` am Baum nachgemessen (A 26, Summe 41) ·
  `pnpm world` grün in allen neun Stufen, 60 Dateien, 679 Tests
- Offen gelassen, Stufe `klein`: der Wächter-Kommentar in `src/link.ts:342-345`
  beschreibt im Präsens, was nicht mehr passieren kann, ohne die Hedging-Form,
  die `src/touch.ts` an derselben Stelle verwendet; der Inline-Kommentar in
  `src/Signal.ts:111-114` wiederholt die JSDoc-Zusicherung vier Zeilen darüber
  fast wörtlich; `docs/recipes.md:17-18` ist nach dem Einschub ragged
  umbrochen; für zwei öffentlich zugesicherte Bedingungen (Doppelaufruf des
  Callbacks am Lazy-Memo, »the read registers no dependency«) gibt es einen
  Satz, aber keinen Test — beide wurden im Review gemessen und treffen zu.
- Nebenbefunde:
  - `src/create-signal.ts:88-93` — die deprecatete `signalReader(callback)`-Form
    trägt dieselbe Lücke, die API-019 für `onChange()` schließt: ihr Effektkörper
    liest `callback(signal.value)` und geht bei jedem Rerun am `beforeRead`-Hook
    vorbei. Nicht im Audit, nicht im Scope.
  - `docs/recipes.md:15-18` — die Aufzählung stellt den `onChange`-Callback und
    die deprecatete `signal.get(callback)`-Form als gleichartige Reader-Reads
    nebeneinander. Für die deprecatete Form gilt das nur beim abonnierenden
    Aufruf, nicht bei den Reruns. Folgt aus dem Nebenbefund darüber.

### [x] 3. Publish-Skript ohne Shell

- Findings: SEC-002 (`info`)
- Ziel: Die Versionsabfrage läuft über eine Argumentliste statt über eine
  zusammengebaute Shell-Zeile.
- Hash: `844a759`
- Ergebnis: 1 Runde, keine Befunde auf `kritisch` oder `wichtig` · beide
  `exec`-Aufrufe in `scripts/publishPackage.cjs` auf `execFile` mit
  Argumentliste umgestellt (`:18-26` Publish, `:37-58` Versionsabfrage) — der
  zweite stand nicht im Finding, trägt aber dieselbe Form in derselben Datei ·
  kein testbarer Kern, `scripts/` liegt außerhalb der Vitest-Wurzel; an seiner
  Stelle drei manuelle Läufe, alle vor `npm publish` endend und vom Reviewer
  unabhängig nachgefahren: `-dev`-Skip Exit 0, »already released« Exit 0 gegen
  die reale Registry, E404-Fehlerzweig Exit 1 · `package.json` nachweislich
  unverändert · keine `npm.cmd`-Behandlung, begründet am einzigen Aufrufer
  (`.github/workflows/main.yml`, Job `deploy`, `ubuntu-latest`), der Ausweg
  steht als Kommentar in der Datei · `pnpm world` grün in allen neun Stufen
- Nebenbefunde: keine.

## Semver-Bewertung

**Einstufung: `breaking`. Keine Versionsanhebung.**

Der Bruch hängt an einer einzigen Zeile: `unlink(source)` wirft für ein
Nicht-Signal einen `TypeError`, wo es still zurückkehrte und damit Erfolg für
einen Teardown meldete, der nie stattfand. Nach der Semver-Tabelle ist »wirft
jetzt, wo vorher still zurückgegeben wurde« major, und es gilt die höchste
zutreffende Stufe — die beiden anderen Findings wären für sich `patch`
(Ressourcen-Fix ohne Signaturänderung) beziehungsweise ohne Oberfläche
(Build-Skript).

Erreichbar ist der Bruch allein aus untypisiertem JavaScript: `LinkableSource<T>`
weist ein solches Argument schon zu `tsc`-Zeit ab, und keine Callsite im Baum —
`src/`, `smoke/`, `docs/`, `skills/` — reicht eines herein. Die CHANGELOG-Zeile
steht trotzdem unter `### Breaking Changes`, weil `docs/api.md` das Schweigen
bisher ausdrücklich zusicherte.

Angehoben wird nichts. `package.json` steht auf `1.0.0-dev`, und
`scripts/publishPackage.cjs` verweigert die Veröffentlichung genau so lange,
wie die Version auf `-dev` endet, während `.github/workflows/main.yml` bei
jedem Push auf `main` veröffentlicht. Das Suffix fallen zu lassen *ist* der
Release — ohne Tag und ohne Freigabe dazwischen. Diese Entscheidung gehört dem
Maintainer und steht als offene Frage im Audit; ein Remediation-Lauf trifft sie
nicht nebenbei. Der `## Unreleased`-Block sammelt weiter, dieser Lauf hat ihm
sieben Zeilen hinzugefügt.

## Was dieser Lauf offen lässt

Der Eingabestapel fürs Folgeaudit. Nichts davon ist Schaden dieses Laufs; kein
Paket blieb blockiert, keine Folge blieb uneingeholt.

**Nebenbefunde, bewusst nicht mehr hineingezogen** — je mit Fundstelle, damit
das Folgeaudit sie nicht neu suchen muss:

1. `src/EffectImpl.ts:867-893` — `onSignalDestroyed()` überspringt bei einem
   Wurf aus `unsubscribeSignal()` die `hasNoLiveSignals()`-Prüfung. Gemessen:
   ein Effekt mit genau einer Abhängigkeit zerstört sich nie selbst. Im
   Detach-Zweig bleibt die ID zusätzlich in `#signals`, wodurch
   `whenSignalIsRead()` sie nie wieder abonniert — der Effekt ist für dieses
   Signal dauerhaft taub, auch nach erneutem Lesen. Vorbestehend, nicht im
   Audit.
2. `src/create-signal.ts:88-93` — die deprecatete `signalReader(callback)`-Form
   trägt dieselbe Lücke, die dieser Lauf für `Signal#onChange` geschlossen hat:
   ihr Effektkörper liest `callback(signal.value)` und geht bei jedem Rerun am
   `beforeRead`-Hook vorbei.
3. `docs/recipes.md:15-18` — stellt den `onChange`-Callback und die deprecatete
   `signal.get(callback)`-Form als gleichartige Reader-Reads nebeneinander. Für
   die deprecatete Form gilt das nur beim abonnierenden Aufruf. Folgt aus (2).

**Kleine Review-Befunde, nicht behoben** — sie stehen je unter ihrem Paket:
drei zur Kommentarform in `src/EffectImpl.ts`, `src/link.ts` und
`src/Signal.ts`, einer zum Zeilenumbruch in `docs/recipes.md`, dazu zwei
öffentlich zugesicherte Bedingungen ohne Test (Doppelaufruf des Callbacks am
Lazy-Memo, »the read registers no dependency«) — beide im Review gemessen und
zutreffend.

**Die übrigen 20 Findings aus `./audit.html`.** Nicht bewertet, nicht
widerlegt, nicht zurückgestellt — nicht beauftragt.

**Die drei offenen Fragen des Audits** bleiben Maintainer-Sache: wann das
`-dev` aus `1.0.0-dev` fällt, womit sich der Deploy-Job authentifiziert
(`id-token: write` ohne `NODE_AUTH_TOKEN` und ohne `--provenance` passt nur
zusammen, wenn Trusted Publishing über OIDC eingerichtet ist), und ob die
21 MB Hero-Assets aus der git-Historie verschwinden sollen.
