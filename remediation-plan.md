# Remediation-Plan — @spearwolf/signalize

Quelle: `./audit.html` vom 2026-08-12 (Folgeaudit zum 2026-08-08) · Branch: `main` · erstellt: 2026-08-12
Baseline: `pnpm world` in allen neun Stufen grün — 49 Spec-Dateien, 596 Tests, Coverage 99,37 / 95,9 / 99,62 / 99,5
Scope: **28 von 54 Findings** — 4 `medium`, 24 `low`, alle aus der Domäne »Code & Laufzeit«
**Stand (2026-08-12): LAUF ABGESCHLOSSEN.** Alle 15 Pakete `[x]`, keines blockiert, kein Stash offen. 16 Commits von `f948597` bis zum Abschluss-Commit. Alle **28 beauftragten Findings sind geschlossen**. `pnpm world` grün in allen neun Stufen, `pnpm smoke` 8/8. Hier gibt es keine offene Arbeit mehr — was aussteht, steht unter »Was dieser Lauf offen lässt«.

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung
läuft · `[x]` erledigt · `[!]` blockiert.

## ÜBERGABE — der Lauf ist abgeschlossen

**Für einen frischen Agenten ohne Vorwissen.** Diese Datei hat einen Lauf des
Skills `js-ts-audit-remediation` geführt und hält seinen **Endstand**. Jeder
Paketblock trägt `[x]`, einen Commit-Hash und eine `Ergebnis`-Zeile mit
Messwerten. Es gibt hier keine offene Arbeit.

Wer die Datei als Erstes findet, liest in dieser Reihenfolge:

1. **»Was dieser Lauf offen lässt«** — der Eingabestapel fürs Folgeaudit.
2. **»Semver-Bewertung«** — warum der Lauf `breaking` ist und trotzdem keine Version angehoben hat.
3. **Die Paketblöcke** — was gemessen wurde und wo eine Empfehlung des Audits am Code gescheitert ist.

Das Folgeaudit läuft über `js-ts-project-audit`; es verifiziert jedes Finding
am Code neu. `./audit.html` wurde von diesem Lauf **nicht** angefasst — wer
sich selbst benotet, hat immer bestanden.

## Semver-Bewertung

**Der Lauf ist `breaking`.** Der `## Unreleased`-Block trägt **50** Einträge
unter `### Breaking Changes`, gegenüber 41 am Audit-Commit. Die schwersten:
`SignalWriter<T>` und `createSignal` weisen Aufrufformen ab, die vorher
compilierten (neun bzw. eine offene Menge, als Regel dokumentiert); `link()`
ist ein Overload-Paar, an dem jede Reduktion auf eine Signatur bricht;
`hibernate()` lehnt `async`-Callbacks ab; jede geworfene, abgelehnte und
gemeldete Meldung trägt jetzt `[signalize]`, was jeden Textvergleich bricht;
`Object.keys()` auf einer `EffectImpl`-Instanz liefert fünf statt neun Namen;
ein entkoppeltes `FailingEffect#destroy` wirft.

**Keine Versionsanhebung.** `package.json` steht auf `1.0.0-dev`, und das ist
ein Gate, kein vergessenes Feld: `scripts/publishPackage.cjs` verweigert die
Veröffentlichung, solange die Version darauf endet, und `.github/workflows/main.yml`
veröffentlicht bei jedem Push auf `main`. **Das Suffix fallen zu lassen ist der
Release** — ohne Tag, ohne Freigabe dazwischen. Diese Entscheidung gehört dem
Maintainer, nicht diesem Lauf. Paket 13 hat die Mechanik in `CONTRIBUTING.md`
beschrieben, damit sie niemand versehentlich auslöst.

**Kein zusammenfassender CHANGELOG-Eintrag.** Das Projekt führt eine Zeile je
Tatsache unter `## Unreleased`, und jedes Paket hat seine Zeilen dort
hinterlassen. Ein Lauf-Sammeleintrag verstieße gegen »One line, one fact« aus
`CLAUDE.md`.

## Was dieser Lauf offen lässt

Nichts davon war beauftragt; alles wurde unterwegs am Code gefunden und
bewusst nicht mehr hineingezogen. Eingabestapel fürs Folgeaudit:

1. `src/constants.ts:28` — der Kommentar behauptet weiter einen `export *` in
   `index.ts`, den Paket 5 abgeschafft hat. Der letzte von Paket 5 hinterlassene
   Kommentar, den kein Doku-Paket eingesammelt hat.
2. `src/message-prefix.spec.ts` — der Regel-Scanner hängt an Importnamen: ein
   aliasierter Import von `reportSignalizeError`/`warnDeprecatedOnce` macht
   eine Meldung unsichtbar. Einzeln möglich, seit der Summengrenze nicht mehr
   sammelbar. Ebenso: eine eigene Fehlerklasse ohne Namensendung `Error`, über
   eine Variable abgelehnt; Konstantenauflösung ist namens-, nicht
   scope-basiert; die Maske kennt keine Regex-Literale.
3. `src/effect-error-handlers.ts` — bekannte Grenze, im Code benannt: wer aus
   JS heraus einen `EffectImpl` als `onEffectError`-Objektlistener registriert,
   verliert die Subscription beim `destroy()` dieses Effects, ohne dass der
   Zähler heruntergeht. Typkonform nicht herstellbar.
4. `src/effect-error-handlers.spec.ts:404-418` — die vier Zwischenprüfungen in
   Z8 sind nicht unabhängig scharf; ihr Rot-Ausschlag stammt aus der Kaskade
   des Nachbartests Z4.
5. `docs/cheat-sheet.md:216` und `skills/using-signalize/references/api.md:316`
   — die `@signal()`-Optionsblöcke nennen `beforeRead` ohne die Wechselwirkung
   mit `readAsValue: true`. `skills/using-signalize/SKILL.md` nennt `beforeRead`
   gar nicht.
6. **Für das Audit selbst, nicht für die Bibliothek:** dieser Lauf hat in **acht**
   Paketen mindestens eine Zahl oder Begründung des Audits am Code widerlegt —
   READ-014 (194 Zeilen sind 128), READ-003 (die bereits korrigierte Zahl war
   wieder falsch), CONS-002 (eine von 22 sind zehn von 36), CONS-013 (17 waren
   16, und die Kernregel war am Stichtag schon hinfällig), PERF-009 (»132
   Zeilen« sind drei, und die Zeitersparnis ist null), PERF-006 (die 9 % liegen
   unter dem Messboden), READ-013 (die Unerreichbarkeit trägt nicht), READ-004
   und READ-008 (Empfehlung bzw. Fundstelle überholt). Ein Folgeaudit sollte
   jede übernommene Zahl neu messen statt sie als `carried-over` zu übernehmen.
7. Zwei Harness-Findings wurden beiläufig **halb** berührt und bleiben offen:
   BUILD-014 (drei von vier Fundstellen offen) und BUILD-020 (Biome-Hälfte für
   `scripts/**/*.mjs` geschlossen, Rest offen).

Der Vorgänger-Plan (Lauf zum Audit vom 2026-08-08, vollständig abgeschlossen,
42 Commits von `2dc2833` bis `f449033`) liegt unverändert in der Historie unter
Commit `fc35c22` und ist von dort jederzeit lesbar. Diese Datei ersetzt ihn.

## Scope und was draußen bleibt

Beauftragt sind alle `low` und `medium` der Domäne **»Code & Laufzeit«**. Nicht beauftragt:

- **6 `info` derselben Domäne** — ARCH-005, READ-007, IMPL-002, SEC-002, INF-001, ARCH-007.
- **Die gesamte Domäne »Projekt-Harness«** — 20 Findings (3 `medium`, 12 `low`, 5 `info`), darunter BUILD-012 (Hero-Assets), die Doku-Gate-Lücke und die fünf `pnpm audit`-Advisories.
- `acknowledged` im Audit: leer.

Wer sich später fragt, warum etwa PERF-011 oder TEST-026 in keinem Paket auftaucht: sie gehören zum Harness und waren nicht Teil des Auftrags.

## Entscheidungen

Alle vom Nutzer am 2026-08-12 getroffen.

- **Hero-Assets (BUILD-012):** Die 21 MB bleiben im Baum und in der Historie. Keine Historien-Umschreibung, kein `git-lfs`. Das Finding ist ohnehin außerhalb des Scopes; die Entscheidung steht hier, damit ein Folgeaudit sie nicht neu aufwirft.
- **Leerer Name (CONS-015):** Ein leerer Name gilt konsequent als »kein Name« — in beiden Zweigen von `createMemo`, und so dokumentiert.
- **Stabilitätszusage (API-011):** Pre-1.0, keine Zusagen. Bis zum 1.0.0-Release gilt keine Semver-Garantie; ab 1.0.0 gilt Semver für die öffentliche Oberfläche, der `@internal`-Teil bleibt ausgenommen.
- **Typfläche (BUG-014, TYPE-007):** Beide umsetzen. `set(wert, {lazy: true})` wird per Conditional Type ausgeschlossen, `link()` bekommt ein Overload-Paar. Der Preis — ein Conditional Type an der meistbenutzten Signatur — ist bewusst akzeptiert.
- **`createSignal(existing, params)` (API-012):** Im Typsystem ausschließen, nicht die verworfenen Parameter anwenden. Laufzeitverhalten bleibt, der Fehler wandert in den Compiler.
- **Busy-Bits in SignalGroup (READ-013):** Entfernen. Die Zyklusfreiheit wird im Floyd-Wächter von `attachGroup()` durchgesetzt, also an der einzigen Stelle, die Kanten anlegt. Das im Finding erwähnte Gegenstück TEST-018 existiert im aktuellen Audit nicht mehr — der Konflikt ist gegenstandslos.
- **Build-Banner (SEC-001):** Datumsanteil streichen, `+esm` behalten. Kein `SOURCE_DATE_EPOCH`-Fallback, keine Commit-Timestamp-Ermittlung — der einfachere der beiden vom Audit genannten Wege.
- **Biome-Regelliste (CONS-013):** Aufzählung in `CLAUDE.md` durch einen Verweis auf `biome.json` ersetzen und nur die nicht offensichtlichen Abschaltungen kommentieren, statt alle 17 einzeln zu begründen.
- **Zwei Berührungen mit Harness-Findings in Paket 11 (2026-08-12):** Vom Orchestrator getragen, nicht vom Nutzer erfragt, weil beide Hygiene an Dateien sind, die Paket 11 ohnehin anfasst oder neu anlegt. (1) Die tote `eslint-disable`-Zeile in `rollup/makeVersionWithBuild.mjs` fällt weg — eine von vier Fundstellen von BUILD-014 (`info`, Harness); das Finding bleibt mit den drei übrigen offen. (2) `scripts/**/*.mjs` kommt in `biome.json` → `files.includes` — sonst legt Paket 11 sein neues Gate-Skript in genau das ungelintete Loch, das BUILD-020 (`medium`, Harness) beschreibt, und verbreitert es von einer Datei auf zwei. BUILD-020 bleibt offen. Kosten gemessen: 105 statt 103 geprüfte Dateien, kein Befund, keine Formatdrift.
- **Reichweite der `[signalize]`-Regel (CONS-002, 2026-08-12):** Das Präfix gilt für **jede Meldung, die die Bibliothek erzeugt** — geworfen, abgelehnt oder über `reportSignalizeError` gemeldet —, nicht nur für die `throw`-Stellen des Findingtexts. Grund: die Annahme des Audits, die Diagnose-Meldungen führten das Präfix bereits durchgehend, ist gemessen falsch (5 von 11 ohne). Eine Regel und ein Scanner statt dreier Familien mit Ausnahmeliste. Betrifft 20 von 36 Fundstellen.
- **Busy-Bits in SignalGroup (READ-013, 2026-08-12, revidiert):** Die frühere Entscheidung »entfernen« ruhte auf der Annahme des Audits, `attachGroup()` sei die einzige Stelle, die eine Kante in der Parent-Kette anlegt. Das ist gemessen falsch: `[$setParentGroup]` (`src/SignalGroup.ts:552-554`) schreibt `#parentGroup` ohne Floyd-Walk, das Symbol liegt in der globalen Registrierung, die Methode überlebt ins Bundle, und ein Konsumentenskript gegen ein frisch gebautes `dist/index.js` baut damit `a ↔ b`. Die Bits sind außerdem seit dem Vorlauf bezeugt (`SignalGroup.spec.ts:1881`, `:1917`) — deshalb fehlt TEST-018 im aktuellen Audit. **Die Bits bleiben.** READ-013 wird über den zweiten vom Finding selbst angebotenen Weg geschlossen (»behalten und testen«, bereits erfüllt), plus eine Satzkorrektur im Kommentarblock, der einen Schutz behauptet, den `[$setParentGroup]` bricht.
- **Zweiter Handler-Scan in Paket 8 (PERF-005, 2026-08-12):** `reportSignalizeError()` in `src/signalize-error.ts` fährt dieselbe Probe gegen dieselbe Queue wie `emitEffectError()`. Ohne registrierten `onEffectError`-Handler — der Normalfall — scannt ein gemeldeter Fehler damit zweimal. Paket 8 nimmt beide Scans, obwohl kein Finding den zweiten deckt: hier ist es billiger als in jedem späteren Paket (modullokaler Zähler, kein neues Modul, keine Zyklusfrage, ~6 Zeilen plus spiegelbildliche Zeugen).
- **`runImmediately` in Paket 7 (PERF-009, 2026-08-12):** Die dritte Arrow-Property in `EffectImpl` wird mit umgestellt, obwohl das Finding nur `run` und `destroy` nennt. Sie ist gleich gebaut, wird ausschließlich gebunden gerufen und ist mit 104 von 232 Byte die teuerste der drei — die drei teilen einen `this`-Context, der erst mit der letzten fällt. Kosten auf der publizierten Fläche: keine, sie trägt `@internal` und steht in keiner ausgelieferten `.d.ts`.
- **Passthrough von `createSignal` (API-012, 2026-08-12, revidiert):** Der am selben Tag freigegebene Weg — im Typsystem ausschließen — ist gemessen nicht umsetzbar: die Überladungsauflösung fällt weiter durch, `createSignal(existing, {beforeRead})` landete als `Signal<Signal<T>>` auf der Wert-Überladung, und jeder Typtest, der ein Signal von dort fernhält, bricht `src/decorators.ts:56`. Sieben Varianten gemessen, keine trägt. Stattdessen wird zur Laufzeit gemeldet, über den Kanal aus API-009: `reportSignalizeError({level: 'warn', source: 'ignored-option', …})` benennt die folgenlosen Schlüssel. Laufzeitverhalten bleibt sonst unverändert. `{lazy: true}` auf dem Passthrough ist durch Paket 4a ohnehin schon ein Compile-Fehler.
- **Exaktheits-Klausel an `SignalWriter<T>` (BUG-014, 2026-08-12):** Die Wert-Überladung trägt zusätzlich zum Conditional Type ein `Record<Exclude<keyof P, keyof SignalWriterParams<T>>, never>`. Damit bleibt ein verschriebenes `lazy` ein Compile-Fehler und `set()` deckungsgleich mit `createSignal`. Bewusst in Kauf genommen sind drei vorher legale Formen, die dadurch brechen: ein Interface, das `SignalWriterParams` erweitert; eine Variable mit inferiertem Fremdschlüssel; ein Durchreicher, der generisch in seinen eigenen Params ist. Alle drei sind laute Compile-Fehler mit einer Ein-Zeilen-Reparatur — das war der Ausschlag gegen die stille Variante.
- **`twoWay`-Option (IMPL-001):** Ersatzlos entfernen. Kein Issue, keine Roadmap-Zeile — die Idee wird nicht weiterverfolgt.
- **Busy-Bits in SignalGroup (READ-013, 2026-08-12, zurück an den Nutzer):** Die Prämisse der Freigabe oben hält nicht. `attachGroup()` ist **nicht** die einzige Stelle, die eine Kante in der Parent-Kette anlegt: `[$setParentGroup]` (`src/SignalGroup.ts:552-554`) schreibt `#parentGroup` ohne Floyd-Walk, und `Symbol.for` hält den Seam im ausgelieferten `dist/` erreichbar — an einem frisch gebauten Bundle nachgestellt. Die Bits sind außerdem seit dem Vorlauf bezeugt (`src/SignalGroup.spec.ts:1881`, `:1917`), weshalb TEST-018 im aktuellen Audit fehlt. Gemessen: Entfernen verschlechtert die Coverage von `SignalGroup.ts` (98,78 → 98,73 Statements, 91,89 → 91,66 Branches), weil die Zweige gedeckt sind, und ein echter Zyklus endet danach im `RangeError`. Empfehlung im Detailplan zu Paket 9: behalten, Kommentar richtigstellen. Beide Ausgänge sind dort vollständig ausgeschrieben.

- **Publish-Mechanik bleibt unberührt (API-011, 2026-08-12, Zug 0 von Paket 13):** Vom Orchestrator getragen, nicht an den Nutzer zurückgegeben. Die erste offene Frage des Audits stimmt in jedem Teilsatz — nachgelesen in `scripts/publishPackage.cjs` und `.github/workflows/main.yml`: kein Tag-Trigger, kein Release-Event, kein Approval, das Fallen des `-dev`-Suffixes auf `main` *ist* die Veröffentlichung. Trotzdem wird keine der beiden Dateien angefasst, und die Zusage ist ohne diese Änderung ehrlich formulierbar. Grund: Semver ist ein Vertrag zwischen Versionsnummer und Kompatibilität, nicht zwischen Auslöser und Veröffentlichung — ein Gate machte keinen Satz des Abschnitts wahrer. Was die Mechanik wirklich erzeugt, ist ein Prozessrisiko des Maintainers (eine mitgemergte `version`-Änderung veröffentlicht sofort und verbrennt die Nummer dauerhaft), und das gehört nach `CONTRIBUTING.md`, wo Beitragende lesen. Eine Änderung an `main.yml` wäre zudem doppelt außerhalb: Domäne »Projekt-Harness« ist nicht beauftragt, und der Veröffentlichungsweg ist eine Projektentscheidung. **Wann** das Suffix fällt, beantwortet Paket 13 nicht — es schreibt nur den Mechanismus hin, damit der Zeitpunkt eine bewusste Handlung wird statt eines Nebeneffekts.

## Vorbestehende Fehler

Keine. Die Baseline war zu Lauf-Beginn in allen neun Stufen von `pnpm world` grün. Jeder rote Lauf ab hier gehört dem Paket, das ihn ausgelöst hat.

Zwei Zahlen sind der Maßstab für Refactor- und Performance-Pakete: die **Testzahl** und die **ungedeckten Einheiten** der Coverage. Bewegen sie sich bei einem Paket, das Äquivalenz behauptet, ist die Behauptung verletzt.

Zu Lauf-Beginn waren das 596 Tests bei 8/23/1/6 ungedeckten Einheiten
(Statements / Branches / Functions / Lines). Die Testzahl wächst mit jedem
Paket, das Zeugen mitbringt — verglichen wird deshalb immer gegen den Stand
**unmittelbar vor** dem Paket, nicht gegen die 596. Die ungedeckten Einheiten
stehen seit Lauf-Beginn unverändert auf 8/23/1/6 und sind der stabilere der
beiden Maßstäbe.

## Arbeitsweise dieses Laufs

- Jedes Paket wird **unmittelbar vor seiner Umsetzung** gegen den dann aktuellen Code detailliert — der Detailplan wandert in diese Datei unter das jeweilige Paket.
- Jedes Paket mit testbarem Kern schreibt **zuerst den fehlschlagenden Test**.
- Nach jedem Paket läuft `pnpm cbt`, vor dem Commit `pnpm world`. Grün ist Voraussetzung, nicht Bericht.
- Jede von außen sichtbare Änderung bekommt eine Zeile unter `## Unreleased` im `CHANGELOG.md`, gruppiert unter die bestehenden Überschriften.
- Commit-Messages auf Englisch, passend zur Historie des Projekts.
- `./remediation-plan.md` bleibt während des Laufs ungetrackt-dirty (die Datei trägt die Hashes der Commits, in denen sie deshalb nicht liegen kann) und wird am Ende in einem Abschluss-Commit mitgenommen.

## Pakete

### [x] 0. Den neuen Audit-Stand committen
- Findings: — (Vorarbeit, kein Finding)
- Ziel: `audit.html` vom 2026-08-12 als eigener Commit, damit kein Paket-Diff ihn mitschleppt.
- Hash: `f948597`
- Ergebnis: erledigt, kein Projektcode berührt.

### [x] 1. Aufräum-Pfade, die einen Eintrag verlieren
- Findings: CONS-005 (low), MEM-012 (low)
- Ziel: Ein werfendes Unsubscribe darf `clear()` nicht auf halbem Weg verlassen, und ein doppelter Key in `fromProps()` darf kein verwaistes Signal hinterlassen.
- Hash: `6c9be8a`
- Ergebnis: 2 Runden plus ein Nachzug · CONS-005 und MEM-012 behoben, jede Hälfte von CONS-005 an einem eigenen Zeugen · `pnpm world` grün, 600 Tests (Baseline 596), Coverage 99,37 / 95,9 / 99,62 / 99,5 unverändert
- Abweichung vom Detailplan: der Wächter in `SignalAutoMap#create()` ist entfallen. Nach der Dedup in `fromProps()` und mit dem `has()`-Guard in `get()` ist die Stelle über keinen Pfad mit belegtem Key erreichbar; ein toter Zweig reißt das 100-%-Gate, unter dem `SignalAutoMap.ts` in `vitest.config.ts` steht. Vom Reviewer nachgeprüft — das Finding bietet die Dedup als gleichwertigen Weg an.
- Nebenbefunde:
  - `src/SignalGroup.ts:838-874` (`#removeSignal`) — ein werfendes `#dropSignalSubscription()` bricht den Rest ab: `#signals.delete(si)`, `#directSignals.delete(si)` und die Namensauflösung laufen dann nicht mehr, das Signal bleibt in zwei Registern stehen, während seine Destroy-Subscription weg ist. Nur der direkte `detachSignal()`-Pfad, nicht `clear()`/`off()`. Keine Regression — vorher brach es eine Zeile früher ab.
  - `src/SignalAutoMap.ts:100` (`#create`) — die Invariante, auf der die Abweichung oben ruht (»wird nie mit belegtem Key erreicht«), steht nur hier im Plan, nicht am Code. `#drop()` trägt seine Invariante als Kommentar, `#create()` nicht.

### [x] 2. Der leere Name
- Findings: CONS-015 (low)
- Ziel: `createMemo(fn, {name: ''})` verhält sich mit und ohne `attach` gleich — `''` heißt »kein Name«, und die JSDoc sagt es.
- Hash: `5c6903d`
- Ergebnis: eine Runde, keine Abweichungen · CONS-015 behoben durch eine Normalisierung (`options?.name || undefined`) statt zweier getrennter Wahrheitsprüfungen · Reviewer hat den Rückbau gefahren, der Zeuge wird ohne Fix rot · `Symbol('')` bleibt ein Name (Symbole sind immer truthy) · fünf Doku-Stellen nachgezogen, `src/decorators.ts` nur JSDoc plus ein Test gegen einen späteren `??`-Umbau · `pnpm world` grün, 603 Tests
- Nebenbefunde: keine

### 3. Signaturen, die illegale Aufrufe durchlassen — geteilt, kein eigenes Paket mehr

Zug 0 am 2026-08-12 hat das ursprüngliche Paket 3 (BUG-014, TYPE-007,
ASYNC-004) geteilt. Grund: drei Findings, ~20 Bearbeitungsstellen und zwei
Zeugendateien, die alle drei anfassen — und zwei sehr verschiedene
Risikoprofile. BUG-014 verengt `set()`, die meistbenutzte Signatur der
Bibliothek, durch die jeder Schreibaufruf in 49 Spec-Dateien läuft; TYPE-007
verengt `link()`. Geht `pnpm world` rot, will man wissen, welche der beiden
Signaturen es war. Der Schnitt liegt entlang der Datei: 3a fasst
`src/types.ts` und `src/hibernate.ts` an, 3b `src/link.ts`. Beide teilen sich
`src/types.public-surface.spec.ts` und `smoke/dist-smoke.test.ts`, deshalb
läuft 3b nach 3a.

### [x] 3a. Ein Wert ist keine Faktorei, ein `async`-Callback kein Callback
- Findings: BUG-014 (medium), ASYNC-004 (low)
- Ziel: `set(wert, {lazy: true})` und `hibernate(async () => …)` scheitern am Compiler statt zur Laufzeit oder still.
- Hash: `a22fc99`
- Ergebnis: 2 Runden plus ein Nachtrag, 3 Review-Durchgänge, eine Nutzerentscheidung · BUG-014 und ASYNC-004 behoben, je doppelt bezeugt (`src/` unter `tsc` und `smoke/dist-smoke.test.ts` gegen die ausgelieferten `.d.ts`) · Wert-Überladung trägt Conditional Type plus Exaktheits-Klausel mit dreiteiligem Index-Signatur-Wächter, jeder Zweig einzeln bezeugt · `pnpm world` grün, 607 Tests (vorher 603), Coverage unverändert
- Restkosten, bewusst und dokumentiert: **neun** vorher legale Aufrufformen brechen — acht aus der Exaktheits-Klausel (jeder Params-Typ, dessen Schlüsselmenge über `keyof SignalWriterParams<T>` hinausgeht: erweiterndes Interface, Variable mit inferiertem Fremdschlüssel, annotierter Fremdtyp mit optionalem Fremdschlüssel, Intersection, Klasseninstanz mit Extrafeld, Rest-Objekt einer Destrukturierung, generischer Durchreicher, Pattern-Index-Signatur), eine aus der `lazy`-Klausel (`{lazy: flag}` mit auf `true` verengtem `flag`). Reparatur für alle: den Params-Typ benennen. Ein Spread repariert keine. Steht in JSDoc, `docs/api.md`, `docs/recipes.md`, `pitfalls.md` 4a und im CHANGELOG.
- Nebenbefunde:
  - `docs/api.md:43` — »accepts the union of `SignalParams<T>` and:« nennt eine Vereinigung, wo `SignalWriterParams<T>` per `extends` verbindet; die Tabelle darunter listet nur den `SignalValueParams`-Teil plus `lazy`. Paket 12.
  - `docs/api.md:891` — `SignalWriterParams<T>` in der Typtabelle erklärt nur die `lazy`-Seite und schweigt zur Exaktheit, obwohl der Typ jetzt für beide Zusagen der Bezugspunkt ist. Paket 12.
  - `docs/recipes.md:65-70` und `docs/api.md:50-54` — behaupten weiter unbedingt, `createSignal(v, {lazy: true})` sei folgenlos. Es compiliert, und der nächste Read wirft. Paket 4 schließt es.
  - `CHANGELOG.md:13` und `:125` — zwei ältere Einträge unter der Kennung `ASYNC-004` aus früheren Audits, beide ohne Datumsangabe, untereinander mehrdeutig. Beide stehen unter `## Unreleased`, wären also noch änderbar.
  - `skills/using-signalize/references/pitfalls.md:15` — der neue Absatz heißt `4a` nach der Konvention der Datei; wer die Pitfalls je durchnummeriert, muss ihn mitnehmen.

### [x] 3b. link() typisiert seinen Callback
- Findings: TYPE-007 (medium)
- Ziel: `link(sig, (v) => …)` leitet den Parametertyp aus der Quelle ab, statt `TS7006` zu melden oder still auf `any` zu fallen.
- Hash: `740fcbb`
- Ergebnis: 1 Runde plus ein Nachtrag, 3 Review-Durchgänge · TYPE-007 behoben, positiv nachgewiesen (`const wrong: string = v` → `TS2322`, nicht bloß Abwesenheit von `TS7006`), doppelt bezeugt in `src/` und gegen die Auslieferung · Überladungsreihenfolge mit gebrandmarkten Rückgaben gemessen: Signal-Überladung zuerst ist die einzige, die `link(src, dst)` und `link(src, dst.get)` auf der Laufzeit-Überladung hält · `pnpm world` grün, 608 Tests, `pnpm smoke` 6/6
- Kosten, als **Regel** dokumentiert statt als Liste: `link` trägt zwei Signaturen, und alles, was daraus wieder eine macht — Zuweisung an eine engere Signatur, generische Inferenz, eine Utility wie `Parameters<>` — landet auf der Callback-Signatur. Vier Erscheinungsformen als Beispiele in `CHANGELOG.md`, `docs/api.md`, `pitfalls.md` 17b und im JSDoc. Drei Durchgänge lieferten je eine weitere Kostengruppe nach; erst die Ursachen-Formulierung hat das beendet.
- Nebenbefunde: keine neuen

### 4. createSignal-Überladungen — geteilt, kein eigenes Paket mehr

Zug 0 am 2026-08-12 hat Paket 4 geteilt. Der Grund ist nicht Umfang, sondern
Beweislage: API-013 und der `lazy`-Nebenbefund aus 3a sind gemessen und
umsetzbar, API-012 ist es auf dem freigegebenen Weg nicht. Der Schnitt liegt
zwischen »ohne Initialwert / kein `lazy` am Konstruktor« (4a) und »Passthrough
nimmt nur `attach`« (4b). 4a fasst `src/createSignal.ts` an, 4b müsste
dieselbe Überladungskette noch einmal anfassen — deshalb läuft 4b nach 4a und
nicht daneben.

Korrigiert am 2026-08-12, Zug 0 von 4b: die Überladungskette fasst 4b nach der
Nutzerentscheidung *nicht* mehr an, nur den Rumpf und die JSDoc. Die Reihenfolge
bleibt trotzdem richtig, aus dem anderen Grund — 4a entscheidet, welche
Schlüssel den Meldezweig von 4b überhaupt noch erreichen.

#### Abgleich (2026-08-12, gegen `lib/` vom 3b-Stand und `dist/`)

Alle drei Sachverhalte bestehen unverändert. Die Proben liefen als
Consumer-Nachbau gegen die **gebauten** `.d.ts`, nicht gegen `src/`.

- **API-012** — unverändert. `src/createSignal.ts:220-229`: `lazy`, `compare`
  und `beforeRead` liegen im `else`-Zweig, nur `params?.attach` läuft in
  beiden. Laufzeit nachgestellt: `createSignal(existing, {compare, beforeRead,
  lazy: true})` liefert dasselbe Objekt zurück, der Vergleicher wird nie
  gerufen (0 Aufrufe), `beforeRead` nie ausgeführt; mit `{attach: host}` steht
  der Zähler nach `SignalGroup.delete(host)` auf 0, `attach` greift also.
  Typseitig compiliert heute jede Form, Literal wie Variable.
- **API-013** — unverändert, und die Korrektur des Audits trägt.
  `createSignal<number>()` liefert `Signal<number>`; `.value`, `value(sig.get)`
  und `sig.get()` halten zur Laufzeit `undefined`. Unter
  `strictNullChecks: true` gemessen: heute `Signal<number>`, `const n: number =
  sig.value` fehlerfrei — genau die Lücke. Die explizit annotierten `|
  undefined` stehen weiter in den ausgelieferten Deklarationen
  (`lib/types.d.ts:160` `readonly value: Type | undefined`), der ursprüngliche
  Befund bleibt also zu Recht zurückgezogen.
- **`lazy`-Nebenbefund aus 3a** — unverändert. `createSignal(1, {lazy: true})`
  compiliert gegen `lib/`, und der nächste Read wirft gegen `dist/`
  `TypeError: this.valueFn is not a function`. 3a hat nichts daran verschoben:
  `SignalParams<T>` und `SignalWriterParams<T>` sind unangetastet, der
  Conditional Type und die Exaktheits-Klausel sitzen allein in
  `SignalWriter<T>` (`src/types.ts:341-355`), `createSignal.ts` ist seit
  `f948597` unberührt.

### [x] 4a. Kein Initialwert, kein `lazy` am Konstruktor
- Findings: API-013 (low) + der `lazy`-Nebenbefund aus 3a
- Ziel: `createSignal<T>()` ohne Initialwert liefert `Signal<T | undefined>`, und `createSignal(v, {lazy: true})` ist ein Compile-Fehler statt eines `TypeError` beim nächsten Read.
- Hash: `fee90bc`
- Ergebnis: 2 Runden, 2 Review-Durchgänge · beides behoben, API-013 mit striktem Typgleichheits-Nachweis · No-Init-Überladung trägt denselben Klauselsatz wie die Wert-Überladung, weil `undefined` sonst das Loch ist, durch das jede Klausel fällt · `smoke/tsconfig.json` compiliert jetzt als Konsument (`strictNullChecks: true`) — jeder bestehende Smoke-Zeuge unter beiden Profilen nachgemessen, keiner maskiert · `pnpm world` grün, 612 Tests, `pnpm smoke` 8/8
- Kostenregel, nach drei Ausgängen der Params-Inferenz formuliert statt nach Erscheinungsformen: (1) konkrete Schlüsselmenge mit einem Schlüssel über den Optionstyp hinaus → `TS2769`, wobei ein Pattern-Index-Schlüssel `Exclude` unversehrt übersteht und deshalb komplett als fremd zählt; (2) nichts Prüfbares (blanker Typparameter) → pauschal abgelehnt, weil der Conditional aufgeschoben bleibt; (3) Constraint verfehlt → Inferenz fällt zurück, Klausel läuft leer, Aufruf compiliert. **Ausgang 3 ist die zweite Kostenseite:** die Weak-Type-Prüfung ist für einen disjunkten Params-Typ als Variable verloren (Literale fängt weiter die Frische). Für `set()` seit 3a, für `createSignal` neu — steht in allen fünf Doku-Stellen.
- Zwei Widerlegungen, die den Weg gespart haben: der Reviewer schlug `params?: SignalParams<Type> & {lazy?: false}` vor — gemessen kippt damit die API-013-Zusage still. Und seine Ursachenzeile (»was `P` nicht zu einer konkreten Schlüsselmenge auflöst«) deckt den Pattern-Schlüssel nicht, der sehr wohl auflöst.
- Nebenbefunde:
  - `src/decorators.ts:56` — hat jetzt den Kommentar, dass sein `<T>` tragend ist. Erledigt, hier nur zur Nachvollziehbarkeit vermerkt.
  - `docs/api.md:55` — »accepts the union of `SignalParams<T>` and:« nennt eine Vereinigung, wo `extends` verbindet. Offen aus 3a, Paket 12.
  - `CHANGELOG.md:13` und `:125` — zwei ältere `ASYNC-004`-Einträge ohne Datum, untereinander mehrdeutig. Offen aus 3a.
  - Die Typargument-Lücke (`createSignal<number>(5, {lazy: true})` compiliert) ist unvermeidbar — TypeScript kennt keine partielle Typargument-Inferenz — und an vier Doku-Stellen festgehalten.

### [x] 4b. Der Passthrough sagt, was er wegwirft
- Findings: API-012 (low)
- Ziel: `createSignal(existing, params)` verwirft `lazy`, `compare` und `beforeRead` nicht mehr still, sondern meldet sie.
- Hash: `638d0b4`
- Ergebnis: 1 Runde, 1 Review-Durchgang · API-012 behoben über den Laufzeit-Kanal aus API-009 (Nutzerentscheidung, siehe Kopf) · sieben Zeugen, jeder Zweig gedeckt, `createSignal.ts` bei 100 / 97,95 / 100 / 100 · `pnpm world` grün, 620 Tests, `pnpm smoke` 8/8
- Zwei Dinge, die den Fix tragen: die Liste der verworfenen Schlüssel steht **ausgeschrieben** statt aus `Object.keys(params)` abgeleitet, weil `decorators.ts` sein eigenes Optionsobjekt durchreicht und eine abgeleitete Liste dort `name`/`readAsValue` melden würde — vom Reviewer empirisch bestätigt. Dagegen hält ein **Stolperdraht auf Typebene**: kommt `SignalParams` ein Schlüssel dazu, bricht der Build an dieser Zeile mit einer Meldung, die sagt, wohin er gehört. Als `declare const`, nicht als `type`-Alias — ein unbenutzter Alias wird nie aufgelöst und fällt vorher `noUnusedLocals` zum Opfer (gemessen). Emittiert nichts nach `lib/`.
- Die Faktorei-Tür (`createSignal(sig.get, {lazy: true})`) läuft durch denselben Zweig, weil ein `SignalReader<T>` beides ist — `SignalLike<T>` und `() => T`. Der Zeuge prüft Identität mit dem Quellsignal, was der Faktorei-Zweig strukturell nicht liefern kann. Die Asymmetrie im Typsystem bleibt offen und dokumentiert: sie zu schließen hieße, die Faktorei-Überladung ein Signal ablehnen zu lassen — genau die Messung, die den ursprünglichen Weg blockiert hat.
- Nebenbefunde: keine neuen

### [x] 5. Die öffentliche Oberfläche schließen
- Findings: API-017 (low), IMPL-001 (low)
- Ziel: Kein `export *` mehr im Einstiegspunkt, keine auskommentierte Option in einem öffentlichen Interface.
- Hash: `c77d338`
- Ergebnis: 1 Runde, 1 Review-Durchgang, keine `wichtig`-Befunde · beide Findings behoben · publizierte Fläche unverändert bei **63 Namen** (33 Wert, 30 nur-Typ), von Planer, Implementierer und Reviewer unabhängig auf beiden Achsen gemessen · `pnpm world` grün, 623 Tests in 52 Dateien, `pnpm smoke` 8/8
- Das Gate, das den Zustand hält, und seine Grenze: `performance/noReExportAll` in `biome.json` reißt `pnpm check` bei einem Wert-Stern, erfasst aber **kein** `export type *` (gemessen) — genau die Form, vor der der alte Kommentar warnte. Deshalb daneben `src/index.public-surface.spec.ts`, das beide Stern-Formen und jede Drift der Wertliste fängt, gegen eine eigene ausgeschriebene Liste statt gegen eine zweite Ableitung aus `index.ts`. Für die Typhälfte gibt es kein Werkzeug (tsc löscht Typen); das ruht auf der Regel im Dateikopf und in `AGENTS.md`. **Offen und im Code benannt:** ein neuer Export in einem Modul bleibt unbemerkt — er publiziert sich nur nicht mehr selbst. Publizieren kostet jetzt zwei bewusste Edits statt keinem. Vom Reviewer in vier Rückbau-Proben einzeln bestätigt.
- IMPL-001 bekommt begründet **keine** CHANGELOG-Zeile: der auskommentierte Block erreicht `lib/` gar nicht, weil tsc nur deklarationsgebundene Doc-Kommentare überträgt.
- Erstes Paket des Laufs, das eine Biome-Regel **einschaltet** statt eine abzuschalten — für Paket 12 (CONS-013) vermerkt, dessen Umbau des Biome-Absatzes in `CLAUDE.md` jetzt beide Richtungen abdecken muss.
- Nebenbefunde: keine neuen

### [x] 6. SignalLink.nextValue() zerlegen
- Findings: READ-014 (medium)
- Ziel: Die längste Methode der Codebasis auf dieselbe Form bringen, die `EffectImpl.#run()` im Vorlauf bekommen hat — ohne eine ihrer Reihenfolgezusagen zu verlieren.
- Hash: `6468425`
- Ergebnis: 1 Runde, 1 Review-Durchgang, keine `wichtig`-Befunde · `#nextValue` von 128/65 auf 99/37 Zeilen · neue modulprivate Klasse `NextValueRead<ValueType>` plus `SignalLink.#consumeGeneration(cursor)` · Wächter, Subscribe-Sequenz und K1-Block stehen wörtlich und in unveränderter Reihenfolge · `pnpm world` grün, 625 Tests, `pnpm smoke` 8/8
- **Der Äquivalenznachweis ist die tragende Leistung dieses Pakets.** Alle 20 Mutationen wurden gegen die Vor- **und** die Nachfassung gefahren; jede kippt beidseitig die byte-identische Menge **benannter** Tests. Vom Reviewer unabhängig vollständig nachgefahren, nicht nur stichprobenartig. Dazu: die erzeugten `lib/**/*.d.ts` sind gegen `HEAD` byte-identisch, nur `SignalLink.js` unterscheidet sich. Testzahl und ungedeckte Einheiten (8/23/1/6) unbewegt.
- **Zwei unbezeugte, beobachtbare Zusagen** hat die Mutationsprüfung vor dem Refactor gefunden — beide bekamen einen Zeugen, keine wurde repariert: (1) vertauschte Wächter lassen `nextValue({signal})` auf zerstörtem Link mit dem Destroy-`Error` statt mit `signal.reason` ablehnen; (2) ohne gemeinsames `releaseAll()` im Abort-Pfad bleiben zwei link-seitige Subscriptions dauerhaft stehen. In beiden Fällen blieb die Suite vorher grün.
- Die Zielmarke von 91 Zeilen (`#run()`) ist mit 99 verfehlt — an der falschen Achse festgemacht: 62 der 99 Zeilen sind Kommentar oder leer, auf der Codezeilen-Achse liegt die Methode mit 37 gegen 50 deutlich darunter.
- Nebenbefunde, alle für Paket 12 (wörtlich mitgezogene Kommentare, die veraltete Bezeichner nennen):
  - `src/SignalLink.ts:366-382` — der K1-Block spricht von `subscriptions` (heißt jetzt `#handles`) und »pushed … immediately«
  - `src/SignalLink.ts:81-86` — die `releaseAll()`-JSDoc sagt »the cancel handle **below**«; das Handle ist die erste Anweisung derselben Methode
  - `src/SignalLink.ts:415-418` — die `hasSettled`-Weiche nennt »`unsubscribe()` ran«, heißt jetzt `releaseAll()`
  - `src/SignalLink.ts:105`, `:116`, `:351` — die drei Ablehnungstexte für Paket 10 (CONS-002) sind gewandert; der Destroy-Text steht jetzt zweimal, der Cancel-Text in `settleWithCancel()`

### [x] 7. EffectImpl: wie seine Member deklariert sind
- Findings: PERF-009 (low), READ-006 (low)
- Ziel: `run`, `runImmediately` und `destroy` auf den Prototyp, `childEffects` auf `#`-Privacy.
- Hash: `0ab2093`
- Ergebnis: 1 Runde, 1 Review-Durchgang, keine `wichtig`-Befunde · beide Findings behoben · vier Zeugen in `src/EffectImpl.declarations.spec.ts`, Z3 zuerst geschrieben · `pnpm world` grün, 631 Tests in 53 Dateien, ungedeckte Einheiten unverändert 8/23/1/6, `pnpm smoke` 8/8
- **Gemessen, weil die Begründung des Audits falsch war, auch wenn seine Empfehlung stimmte:** der Umbau spart **232 Byte pro `EffectImpl`** und **keine Zeit** — das Bench-Grundrauschen liegt bei 6,9 %, breiter als jeder Abstand zwischen den Fassungen. Von Planer, Implementierer und Reviewer unabhängig auf 231,9 B gemessen. Die Audit-Angabe »ein Closure über 132 Zeilen« trifft nicht mehr zu: `run` ist seit dem `#run()`-Umbau des Vorlaufs drei Zeilen lang. Weitere korrigierte Zahlen: 13 `#`-Felder statt elf, Fundstellen von `:442`/`:937` nach `:573`/`:1148` gewandert.
- **Die `Effect`-Fassade behält ihre Arrows, und das ist tragend, nicht inkonsistent:** `Signal#onChange()` destrukturiert `destroy` aus der Fassade und gibt es als Unsubscribe an den Konsumenten zurück, `createMemo()` reicht `runImmediately` und `destroy` entkoppelt weiter. Der Kommentar an `Effect#onDestroy()` empfahl bisher ausdrücklich, genau diese Gebundenheit »aufzuräumen« — er sagt jetzt das Gegenteil und begründet es. Z3 hält es fest und wurde durch Rückbau der Fassade von beiden Seiten rot gesehen.
- Zwei Breaking Changes, beide im CHANGELOG: ein entkoppeltes `FailingEffect#destroy` wirft jetzt, und `Object.keys()` auf einer `EffectImpl`-Instanz liefert fünf statt neun Namen. `lib/Effect.d.ts` bleibt byte-identisch, `lib/EffectImpl.d.ts` ändert genau die zwei Signaturen und verliert das Feld.
- Verfahrensvermerk: der Implementierer hat für einen `.d.ts`-Vergleich kurz `git stash` benutzt, was sein Auftrag ausschließt. Folgenlos — Stash-Liste leer, Arbeitsbaum und Plan intakt, vom Orchestrator geprüft.
- Nebenbefunde: keine neuen

### [x] 8. Arbeit aus den heißen Pfaden heben
- Findings: PERF-006 (low), PERF-005 (low) · dazu der zweite Handler-Scan in `reportSignalizeError()` (Nutzerentscheidung, siehe Kopf)
- Ziel: Kein Vergleicher-Closure pro Write, kein linearer Scan über alle Event-Namen pro gemeldetem Fehler.
- Hash: `3a63798`
- Ergebnis: 1 Runde plus ein Nachtrag, 1 Review-Durchgang, keine `wichtig`-Befunde · beide Findings behoben, dazu der zweite Scan · neues Blattmodul `src/effect-error-handlers.ts` · `pnpm world` grün, 641 Tests in 54 Dateien, ungedeckte Einheiten unverändert 8/23/1/6, `pnpm smoke` 8/8
- **PERF-006: die behaupteten 9 % halten nicht.** Zwölf Runden, alle sechs Reihenfolge-Permutationen: eine **byte-identische Kopie** der Bibliothek liegt systematisch 2,92 % unter dem Original, allein positionsbedingt — breiter als der gesuchte Effekt (−0,23 % Median). Der Fix trägt aus dem gemessenen Grund: Scavenges pro 20 Mio. Writes von 143 auf 76 (**−47 %**), rund **48 Byte Müll pro Write**. Die Escape-Analyse räumt ein Objektliteral weg, eine Closure nicht — das »V8 kann sie oft wegoptimieren« des Audits ist für diese Form widerlegt.
- **PERF-005: halten.** 15,96 µs Median bei 8000 lebenden Effects (Audit: 20,6 µs, am oberen Rand der Spanne), Array-Länge exakt gleich der Zahl lebender Effects. Die vom Audit genannte Bruchform meldet wirklich pro Lauf: 25 Writes → 26 Läufe → 26 Meldungen. Zählerblick 0,013 µs, Faktor ~1200. End-to-End −77,5 %.
- **Die eigentliche Arbeit lag in der Buchführung.** Ein Zähler kann falsch liegen, wo ein Scan es nicht kann, und falsch heißt hier: stumme Fehlermeldung. Die wörtliche Empfehlung des Audits hätte gedriftet — eventize' Unsubscribe ist **idempotent**, ein zweiter Aufruf hätte zweimal heruntergezählt und einen registrierten Handler stumm gemacht. Deshalb: `released`-Riegel je Handle, **erst herunterzählen, dann abmelden**, im Zweifel unterzählen statt überzählen. Der Reviewer hat vierzehn Driftwege gefahren (dreifaches und verschränktes Unsubscribe, Selbstabmeldung und Registrierung mitten in der Zustellung, werfender Handler, Wiedereintritt bis Tiefe 3, Objekt-Listener, gekreuzte Unsubscribes über zwei Queues, `batch()` mit Catch-All, Teardown, GC-Pfad über 600 Gruppen) — auf keinem typkonformen Weg Drift.
- **Eine bekannte Grenze, im Code festgehalten statt bewacht:** wer aus JS heraus einen `EffectImpl` als `onEffectError`-Objektlistener registriert, verliert die Subscription beim `destroy()` dieses Effects, ohne dass der Zähler heruntergeht — die nächste Meldung geht still an null Zuhörer. Typkonform nicht herstellbar (`EffectErrorCallback` ist ein Funktionstyp, es bräuchte eine Methode unter `Symbol.for('@spearwolf/signalize/effectError')`), ein Wächter dagegen wäre toter Code unter dem 100-%-Gate. Steht als »Known boundary« im JSDoc von `trackEffectErrorHandler()`, mit Spiegelhinweis in `signalize-error.ts`.
- Der Zähler brauchte ein eigenes Blattmodul: in `effects.ts` ergibt er einen Wertzyklus, den `tsc` verschweigt, `compile` durchlässt und `rollup` abbricht (`effects.js → EffectImpl.js → effects.js`) — von Planer und Reviewer je einzeln nachgestellt.
- Nebenbefund: `src/effect-error-handlers.spec.ts` Z8 deckt den GC-Pfad und ein explizites `group.clear()` nicht ab und prüft die Invariante erst nach dem gesamten Teardown-Block, nicht nach jedem Schritt. Der Reviewer hat den GC-Pfad selbst gefahren (600 Gruppen, drei erzwungene Sammlungen) und den Zähler sauber gefunden — die Lücke liegt im Zeugensatz, nicht im Code.

### [x] 9. SignalGroup: tote Bits, schiefe Namen, falsche Zahlen
- Findings: READ-013 (low), READ-005 (low), READ-003 (low) · dazu der Nebenbefund zu `#removeSignal` aus Paket 1
- Ziel: Register nach ihrem Inhalt benennen, die Allokationszahlen richtigstellen, die Busy-Bits einordnen.
- Hash: `9bb266c`
- Ergebnis: 3 Züge, 1 Review-Durchgang, keine `wichtig`-Befunde · alle drei Findings plus Nebenbefund geschlossen · `pnpm world` grün, 642 Tests in 54 Dateien, ungedeckte Einheiten unverändert 8/23/1/6, `pnpm smoke` 8/8
- **READ-013 hat die Entscheidung des Nutzers gekippt.** Die freigegebene Begründung — `attachGroup()` sei die einzige Stelle, die eine Kante anlegt — ist gemessen falsch: `[$setParentGroup]` schreibt `#parentGroup` ohne Floyd-Walk, das Symbol liegt in der globalen Registrierung, überlebt ins Bundle, und ein Konsumentenskript gegen ein frisch gebautes `dist/index.js` baut damit `a ↔ b`; die Bits fangen es ab. Vom Reviewer unabhängig aus `dist/` nachgestellt. Dazu sind sie seit dem Vorlauf bezeugt — daher fehlt TEST-018 im aktuellen Audit. **Die Bits bleiben**, das Finding schließt über den zweiten von ihm selbst angebotenen Weg, und der Kommentar, der einen Wald behauptete, benennt jetzt die Kante, die ihn bricht.
- **READ-003 war zur Hälfte gegenstandslos und zur anderen Hälfte schärfer als gemeldet.** Der beanstandete Text war längst korrigiert — und die Korrektur selbst falsch: das `unsubs` im `[$groupResources]`-Wrapper fehlte in der Zählung. Nachgezählt elf Container: sechs Sets, drei Maps, eine WeakMap, ein WeakSet; acht der neun übersprungenen sind Felder, das neunte ist das `unsubs` des Wrappers. `AGENTS.md:128` war und bleibt richtig.
- **Zug 1 (Rename) belegt Äquivalenz mit byte-identischen `.d.ts`** über alle 29 Dateien, 641 Tests unbewegt. Zug 2 (Nebenbefund) hebt auf 642. Getrennte Züge, getrennte Zahlen — von Implementierer und Reviewer je einzeln gemessen. Der Fix räumt die Register **und** reicht den Fehler weiter, er schluckt ihn nicht; durch Rückbau von beiden Seiten geprüft.
- Nebenbefunde: keine neuen

### [x] 10. Fehler und Warnungen einheitlich melden
- Findings: CONS-002 (low), CONS-004 (low)
- Ziel: Jede Meldung der Bibliothek trägt `[signalize]`, ein Test hält die Regel; alle drei Deprecations laufen über ein gemeinsames Gatter.
- Hash: `8c67eb7`
- Ergebnis: 3 Züge plus 2 Runden, 2 Review-Durchgänge · beide Findings behoben · `pnpm world` grün, 654 Tests in 57 Dateien, ungedeckte Einheiten unverändert 8/23/1/6, `pnpm smoke` 8/8
- **Drei Zahlen des Audits waren falsch.** Nicht eine von 22 Wurf-Stellen trägt das Präfix, sondern **zehn**; die Behauptung, die Diagnose-Meldungen führten es durchgehend, trifft für 5 von 11 nicht zu. Gesamtbild: **36 Meldungen, 20 ohne Präfix**. Der Nutzer hat die Regel daraufhin auf jede Meldung ausgedehnt — geworfen, abgelehnt, gemeldet.
- **Die eigentliche Arbeit war der Regel-Test, und er hat zwei Runden gebraucht.** Ein Scanner, der nicht mehr trifft, besteht klaglos und behauptet eine Zusage, die niemand hält. Die erste Fassung ließ sich still abschalten: Scan B ankerte auf `reportSignalizeError({`, ein Payload in einer untypisierten Variablen war unsichtbar, und die Untergrenze lag zwei unter dem Ist-Stand — zwei geprüfte Meldungen konnten dunkel werden, ohne dass etwas rot wurde. Der Reviewer hat das mit 27 Angriffswegen gefunden, sieben blieben grün.
- **Was den Test jetzt trägt**, sechs Zusicherungen: (a) Präfix, (b) unklassifizierbare Meldung ist Fehlschlag statt Übersprung, (c) unbekannte Fehlerklassen in Wurf- **und** Ablehnungsposition, (d) Untergrenzen je Scan **und in Summe** (A 25/≥24, B 10/≥9, C 3/≥2, D 2/≥1, Summe 40/≥39 — Spielraum ist einmal bezahlbar, nicht dreimal gleichzeitig), (e) rekursive Dateiliste mit `__testing__/` als einziger Ausnahme, (f) `console` nur in zwei Dateien. Jede Vorkehrung durch Rückbau als feuernd nachgewiesen, vom Implementierer wie vom Reviewer.
- **`console` ist eine Linter-Regel statt einer Regex** — `suspicious/noConsole` auf `error` für `src/**/*.ts`, `off` für `signalize-error.ts` und `EffectImpl.ts`. Dieselbe Bauart wie `noReExportAll` in Paket 5. Sie fängt die berechnete und die optionale Form, **nicht** den destrukturierten Alias; deshalb daneben Zusicherung (f). **Zweite von diesem Lauf eingeschaltete Biome-Regel** — für Paket 12 (CONS-013) vermerkt.
- CONS-004: `warnDeprecatedOnce(key, message)` in `src/deprecation-warnings.ts`, eine Lage **über** `signalize-error.ts` statt unterhalb `signal-core.ts` wie das Audit sagt — es braucht `reportSignalizeError`. Die Gegenrichtung bricht `rollup`, während `tsc` schweigt. `src/deprecation-sites.spec.ts` stößt alle drei Pfade in einem Modulgraphen an und vergleicht die **Menge** der Meldungstexte, nicht ihre Zahl.
- Nebenbefunde:
  - `biome.json` — ~~JSONC-Kommentare verwerfen die Konfiguration stillschweigend~~ **von Paket 12b widerlegt**: jede der drei natürlichen Platzierungen scheitert laut mit Exit 1 und Parse-Fehler. Die beobachtete Ausweitung der Prüfung ist die Folge des Fehlers, nicht sein Ersatz. Richtiggestellt in `CLAUDE.md`.
  - `src/message-prefix.spec.ts` — B und C hängen am **Importnamen**: ein aliasierter Import von `reportSignalizeError`/`warnDeprecatedOnce` macht die Meldung unsichtbar. Einzeln möglich, seit der Summengrenze nicht mehr sammelbar.
  - `src/message-prefix.spec.ts` — eine eigene Fehlerklasse **ohne** Namensendung `Error`, über eine Variable abgelehnt, passiert alle drei Muster.
  - `src/message-prefix.spec.ts` — Konstantenauflösung ist namens-, nicht scope-basiert; die Maske kennt keine Regex-Literale (heute keines in `src/`).

### [x] 11. Reproduzierbarer Bundle-Banner
- Findings: SEC-001 (low)
- Ziel: Zwei Builds desselben Commits erzeugen dieselben Bytes.
- Hash: `f57929a`
- Ergebnis: 1 Runde, 1 Review-Durchgang · SEC-001 behoben · `pnpm world` grün, 654 Tests in 57 Dateien, ungedeckte Einheiten unverändert 8/23/1/6, `pnpm smoke` 8/8
- **Der Schaden war größer als gemeldet.** Rollup hasht den Banner in den Chunknamen — das Datum änderte damit auch den **Dateinamen** und die `import`-Zeile in `index.js` und `decorators.js`. Vier von sechs `dist/`-Dateien driften, nicht eine.
- **Das Copyright-Jahr fällt mit**, und das entschied die Messung, nicht die Auslegung: mit gestrichenem Build-Stempel, aber weiterhin berechnetem `getFullYear()`, bleibt derselbe Commit unter einem auf 2027 gestellten Prozess byte-verschieden. Ersatz ist hart `Copyright 2022-2026`.
- **Nachher 96 von 96 Dateien byte-identisch** über `dist/` und `lib/` — vom Reviewer in vier Varianten unabhängig nachgemessen: zwei Läufe am selben Tag, über 365 Tage verschoben, unter fremder `TZ`/`LANG`, und zweimal im selben Prozess über die Rollup-JS-API. Keine weitere Quelle von Nichtdeterminismus gefunden; Sourcemaps führen nur relative Pfade.
- **Der Zeuge hatte ein Loch, und zwar genau an der Stelle des alten Fehlers.** `scripts/check-banner.mjs` stubbte `Date` **nach** seinen statischen Imports — jede Auswertung auf Modul-Top-Level war damit schon eingefangen und unsichtbar, also exakt die Form, die `makeVersionWithBuild` vorher hatte. Der Reviewer hat es empirisch belegt (Exit 0 bei echtem Drift). Repariert über cache-gebustete dynamische Imports nach dem Stub; ein `new Date()` auf Modulebene macht ihn jetzt rot. Verbleibende, im Skript benannte Grenze: nur die zwei direkt importierten Dateien sind cache-gebustet.
- Zwei nicht beauftragte Harness-Findings beiläufig berührt, beide bleiben offen: die tote `eslint-disable`-Zeile (BUILD-014, eine von vier Fundstellen) und `scripts/**/*.mjs` in Biomes `files.includes` (BUILD-020, Biome-Hälfte) — Letzteres, damit Paket 11 sein neues Gate-Skript nicht in ein ungelintetes Loch legt. 105 statt 103 geprüfte Dateien, kein Befund.
- Nebenbefunde: keine neuen

### 12. Doku gegen den Code halten — geteilt, kein eigenes Paket mehr

Zug 0 am 2026-08-12 hat Paket 12 geteilt. Der Grund ist nicht der Umfang
allein — fünf Findings plus vierzehn eingesammelte Nebenbefunde —, sondern
dass zwei verschiedene Handwerke drinstecken. In `src/` wird JSDoc gegen den
Code daneben gehalten; die Prüfung ist ein Blick auf die nächste Zeile. In
`docs/`, `skills/`, `CLAUDE.md` und `CHANGELOG.md` wird Prosa an sieben
parallelen Stellen auf **eine** gemessene Regel gebracht; die Prüfung ist der
Abgleich gegen die Messung, und ein Wortlaut, der an fünf Stellen stimmt und
an der sechsten nicht, ist der Fehler, den dieser Lauf schon viermal gemacht
hat.

Der Schnitt liegt entlang des Verzeichnisses: **12a fasst ausschließlich
`src/` an, 12b fasst `src/` nicht an.** Keine Datei liegt in beiden — außer
`CHANGELOG.md`, das jedes Paket für seine eigenen Zeilen anfasst, sequentiell
und damit konfliktfrei. 12a läuft zuerst, weil BUG-013 über die Grenze geht:
die korrigierte `value()`-JSDoc aus 12a ist der Bezugstext, gegen den 12b die
sieben Prosa-Stellen schreibt. Umgekehrt entstünde die vertraute Drift.

#### Abgleich (2026-08-12, gegen `HEAD` = `f57929a`, Arbeitsbaum sauber)

Jede Fundstelle gegen den Code geprüft, nicht gegen ihren Vorgängertext. Vier
Findings bestehen, eines ist zur Hälfte gegenstandslos, und zwei
Audit-Begründungen sind gemessen falsch.

- **READ-004 — verändert, besteht.** Der Block sitzt heute in
  `src/EffectImpl.ts:771-789` (Audit: `:501-516`). Beide beanstandeten Sätze
  stehen unverändert: »executed immediately in any case« und die
  Notwendigkeits-Liste. **Die Empfehlung des Audits ist inzwischen selbst
  falsch:** »führt ihn nur bei gesetztem `autorun` sofort aus« übergeht den
  zweiten Zweig. `[RECALL]()` lautet heute `if (!this.autorun &&
  !this.#explicitRunRequested) return;` — ein nicht-autorun Effect mit
  geparktem explizitem Run läuft sehr wohl (ASYNC-002). Wer die Empfehlung
  wörtlich umsetzt, baut die nächste Ungenauigkeit ein. Der
  Notwendigkeitstest sitzt tatsächlich in `#run()`
  (`src/EffectImpl.ts:615`, `if (!this.shouldRun) return;`), gelöscht wird
  das Flag in `:654`.
- **READ-008 — zu zwei Dritteln unverändert, zu einem Drittel
  gegenstandslos.**
  - `src/createMemo.ts:100` (Audit: `:71-72`) — besteht. `@param options -
    Configuration options (attach, name, lazy, priority)`; `CreateMemoOptions`
    deklariert fünf Felder (`attach`, `name`, `lazy`, `priority`,
    `batchWrites`), `batchWrites` fehlt weiter.
  - `src/effects.ts:37-38` (Audit: `:22-24`) — besteht. `@param dependencies -
    Optional array of signals to explicitly depend on`. Nachgemessen: die
    `@param`-Namen binden hier an gar nichts — der Export ist ein
    `const createEffect: typeof EffectImpl.createEffect` mit `...args: any[]`,
    und `lib/effects.d.ts` trägt den Block wörtlich über einer Deklaration
    ohne eigene Parameterliste. Die Zeile ist reine Prosa und beschreibt eine
    Signatur, die es nicht gibt.
  - `src/createSignal.ts` — **gegenstandslos.** Der beanstandete Text »a
    function for lazy initialization« existiert nirgends mehr im Baum
    (`grep` über `src/`, `docs/`, `skills/`, `README.md`: null Treffer). Paket
    4a und 4b haben die JSDoc aller drei Überladungen neu geschrieben; die
    `@param initialValue`-Zeilen lauten heute »Factory evaluated on the first
    read« (`:225`), »Nothing, or an explicit `undefined`« (`:267`) und
    »Initial value, or an existing signal to pass through« (`:388`), jede mit
    der `lazy`-Bedingung daneben. Erledigt durch einen Vorgänger, hier nichts
    zu tun.
- **BUG-013 — unverändert, und die Reichweite ist größer als gemeldet.**
  `src/value.ts:8` sagt weiter »Equivalent to wrapping the read in
  beQuiet(), but more convenient«. Gemessen gegen ein frisch gebautes
  `dist/index.js` (Zähler auf `beforeRead`): `sig.get()` → 1,
  `beQuiet(() => sig.get())` → 1, `hibernate(() => sig.get())` → 1,
  `sig.value` → 0, `value(sig)` → 0, nach `destroySignal` → 0. Der
  Reader ruft `signal.beforeRead?.()` **vor** dem Tracking-Zweig
  (`src/createSignal.ts:83`), also fällt der Hook nicht unter `beQuiet()`.
  **Die Prämisse des Findings, `docs/api.md` beschreibe es korrekt, ist
  falsch:** `docs/api.md:28` sagt »Hook called before each tracked read«, und
  dieselbe falsche Regel steht an fünf weiteren Stellen — `docs/api.md:1014`,
  `docs/recipes.md:15`, `docs/cheat-sheet.md:14`,
  `skills/using-signalize/references/api.md:64`, `…/pitfalls.md:11`. Sechs
  Doku-Stellen plus die Quelle für **eine** Regel, gegen zwei Fundstellen im
  Finding; dazu kommt in 12b `docs/api.md:220`, wo die Regel nicht falsch
  steht, sondern fehlt. Der
  `{lazy: true}`-Memo-Fall ist gemessen und schärfer als »dauerhaft
  `undefined`«: `value(memo)` liefert `undefined`, solange nie durch den
  Reader gelesen wurde, und danach dauerhaft den zuletzt berechneten Wert —
  nach zwei Schreibvorgängen auf die Quelle gemessen `200` statt `300` und
  `300` statt `400`. Ein eager Memo ist unbetroffen (sein Effect autoruns).
- **CONS-014 — unverändert.** `src/object-signals.ts:19`, `:40`, `:50`, `:70`
  — vier von `src/index.ts` exportierte Funktionen ohne eine Zeile JSDoc.
  `findObjectSignal` (`:35`) hat einen Block, trägt `@internal` und fällt
  durch `stripInternal` aus `lib/object-signals.d.ts` heraus — es ist nicht
  gemeint. `storeAsObjectSignal` (`:60`) ist ohne JSDoc **und** ohne
  `@internal`, steht aber nicht in `src/index.ts` und damit außerhalb des
  Findings.
- **CONS-013 — verändert, in beide Richtungen, und die Zahl des Audits war
  schon zur Audit-Zeit falsch.** Siehe die eigene Bilanz unten.

#### CONS-013: die Zahlen von heute, selbst nachgezählt

Gezählt am `linter.rules`-Block von `biome.json` und an den `overrides`,
jede Aussage gegen das Werkzeug geprüft (Biome 2.5.5).

- **16 Regeln stehen auf `off`**, nicht 17: sieben in `suspicious`, fünf in
  `complexity`, drei in `style`, eine in `correctness`.
- **Die 17 des Audits waren schon an seinem eigenen Stichtag falsch.** Am
  Audit-Commit `f948597` waren es ebenfalls 16. Der Unterschied ist
  `style/useImportType`: Commit `e039cb8` (ARCH-003, Vorlauf) hat die Regel
  von `off` auf `error` gedreht. Damit ist auch der schärfste Satz des
  Findings hinfällig — »unter den zwölf ungenannten ist `useImportType`, die
  Regel, deren Abschaltung die latenten Importzyklen erst ermöglicht«: die
  Regel ist nicht abgeschaltet, sie ist genau deshalb eingeschaltet, und
  `AGENTS.md:154` schreibt es dort auch hin. Ungenannt sind heute **elf**, nicht
  zwölf.
- **Vier Regeln stehen auf `error`, zwei davon kennt `recommended` nicht.**
  Gemessen in einem isolierten Nachbau mit `"preset": "recommended"` allein:
  `export * from …` und `console.log` erzeugen dort **keine** Diagnose, also
  sind `performance/noReExportAll` (Paket 5) und `suspicious/noConsole`
  (Paket 10, `error` für `src/**/*.ts` mit zwei ausgenommenen Dateien) echte
  Zuschaltungen. `style/useImportType` und `correctness/noUnusedVariables`
  feuern im Preset-Nachbau sehr wohl — die sind im Preset enthalten und hier
  nur von `warn` auf `error` gehoben (`noUnusedVariables` zusätzlich mit
  `ignoreRestSiblings: true`).
- **Drei weitere `off` stehen in den `overrides`**, alle dateibezogen:
  `noConsole` für `src/signalize-error.ts` und `src/EffectImpl.ts`,
  `noExplicitAny` und `style/useConst` für `src/**/*.spec.ts`. Das
  `noExplicitAny` dort ist redundant — die Regel ist global schon aus.
- **Die fünf in `CLAUDE.md:34` genannten Regeln stimmen alle**, jede hat eine
  echte Fundstelle: `noUnsafeDeclarationMerging` 3 (`EffectImpl.ts`,
  `SignalGroup.ts`, `SignalLink.ts`), `noConstructorReturn` 2
  (`SignalGroup.ts`), `noTsIgnore` 1 (`types.public-surface.spec.ts`),
  `noAsyncPromiseExecutor` 2 (`link.asyncValues.spec.ts`), `useArrowFunction`
  1 (`decorators.ts`).
- **Der Satz »each match a deliberate pattern in this codebase« ist für drei
  der 16 gemessen falsch.** Jede abgeschaltete Regel einzeln auf `error`
  gedreht und gegen den ganzen Baum gefahren (`--max-diagnostics=500`):
  `complexity/noUselessConstructor` 0, `complexity/noThisInStatic` 0,
  `style/noUselessElse` 0 Treffer. Die übrigen dreizehn treffen: `noExplicitAny`
  49, `noEmptyBlockStatements` 144, `noNonNullAssertion` 44,
  `noAssignInExpressions` 11, `noBannedTypes` 4, `noForEach` 3,
  `noConfusingVoidType` 1, `noParameterAssign` 1 — dazu die fünf oben.
- **`biome.json` verträgt keine Kommentare, und das ist für die
  Nutzerentscheidung tragend.** »Nur die nicht offensichtlichen kommentieren«
  kann nur in `CLAUDE.md` geschehen. In einem isolierten Nachbau des Baums
  gemessen: eine `//`-Zeile in `biome.json` bricht den Lauf **nicht** ab, sie
  degradiert die Konfiguration — 108 statt 106 geprüfte Dateien, 171 statt 2
  Befunde, weil `files.includes` verlorengeht. Deckt sich mit dem
  Nebenbefund aus Paket 10 (dort 177 statt 103 am damaligen Stand). Die
  `Checked N files`-Zeile ist der einzige Hinweis.

#### Eingesammelte Nebenbefunde und Vermerke (alle elf Vorgängerpakete)

Der Plan von oben nach unten durchgegangen. Vierzehn Zeilen, die auf Paket 12
zeigen — **drei davon haben Vorgänger schon geschlossen** (N2, N6, N12), eine
war nie eine Aufgabe (N7). Bleiben zehn, die hier Arbeit machen: fünf in 12a
(N1, N9, N10, N11, N13), fünf in 12b (N3, N4, N5, N8, N14).

| # | Herkunft | Fundstelle heute | Geht nach |
| --- | --- | --- | --- |
| N1 | Paket 1, über Paket 2 dazugenommen | `src/SignalAutoMap.ts:100` — Invariante an `#create()` unkommentiert | 12a |
| N2 | Paket 1 | `src/SignalGroup.ts` `#removeSignal` — **erledigt** in Paket 9 (Zug 2) | — |
| N3 | Paket 3a / 4a | `docs/api.md:84` — »accepts the union of `SignalParams<T>` and:«, wo `extends` verbindet | 12b |
| N4 | Paket 3a | `docs/api.md:1036` — `SignalWriterParams<T>`-Zeile erklärt nur die `lazy`-Seite | 12b |
| N5 | Paket 3a | `CHANGELOG.md:13`, `:51`, `:133` — drei `ASYNC-004`-Einträge, zwei ohne Datum | 12b |
| N6 | Paket 3a | `docs/recipes.md:65-70` / `docs/api.md:50-54` — »`{lazy: true}` folgenlos«: **erledigt** durch Paket 4a | — |
| N7 | Paket 3a | `skills/…/pitfalls.md` Absatz `4a` — Nummerierungskonvention, kein Fehler; nur ein Vermerk für eine spätere Durchnummerierung | — (Vermerk bleibt stehen) |
| N8 | Paket 5 | CONS-013 muss beide Richtungen abdecken (`noReExportAll` eingeschaltet) | 12b |
| N9 | Paket 6 | `src/SignalLink.ts:376`, `:382` — `subscriptions` heißt `#handles` / `read.add()` | 12a |
| N10 | Paket 6 | `src/SignalLink.ts:384`, `:397`, `:425` — `unsubscribe()` heißt `releaseAll()` | 12a |
| N11 | Paket 6 | `src/SignalLink.ts:80-86` — W1-JSDoc: »cancel handle below« und eine gemessen falsche Gefahrenbehauptung | 12a |
| N12 | Paket 6 | `src/SignalLink.ts:105/:116/:351` — Ablehnungstexte: **erledigt** in Paket 10 | — |
| N13 | Paket 8 | `src/effect-error-handlers.spec.ts` Z8 — GC-Pfad und `group.clear()` ungedeckt, Invariante erst nach dem ganzen Teardown geprüft | 12a |
| N14 | Paket 10 | `suspicious/noConsole` ist die zweite eingeschaltete Regel | 12b |

Drei Nebenbefunde aus Paket 10 zu `src/message-prefix.spec.ts` (Importname,
Fehlerklasse ohne `Error`-Endung, Konstantenauflösung) sind **nicht** an
Paket 12 gerichtet: sie beschreiben Grenzen eines Scanners, keine falsche
Doku, und ihre Reparatur wäre Testarbeit an einem Finding, das geschlossen
ist. Sie bleiben als Grenzen dokumentiert, wo sie stehen. Ebenso bleibt der
Vermerk aus Paket 4a zur Typargument-Lücke (`createSignal<number>(5, {lazy:
true})`) unberührt — er ist an vier Doku-Stellen festgehalten und richtig.

#### Vermerke der Vorgängerpakete (unverändert übernommen)

- Hängt ab von: Paket 3a, 3b, 4a, 4b, 6, 7 (die Doku wird gegen den Endstand der Signaturen geschrieben, nicht gegen einen Zwischenstand). Nachgezogen (Zug 0 von Paket 4b): 4b kommt, und es schreibt die JSDoc der Wert- und der Faktorei-Überladung von `createSignal` mit — die `@param`-Liste, die CONS-014 dort meint, ist danach eine andere. Gegen den 4b-Endstand prüfen, nicht gegen den 4a-Endstand. 3a, 3b und 4a ziehen die Doku für ihre eigenen Stellen selbst nach — `set`/`lazy`, `hibernate`, der gestrichene `link()`-Workaround, die `createSignal`-Klauseln —; was hier bleibt, sind die fünf Stellen der eigenen Fallliste. Nachgezogen (Zug 0 von Paket 4): CONS-014 nennt unter anderem die `@param`-Liste in `createSignal.ts`; 4a schreibt die JSDoc beider publizierter Überladungen ohnehin neu, also hier gegen deren Endstand prüfen statt gegen den heutigen.
- Nachgezogen (2026-08-12, Zug 0 von Paket 5): CONS-013 ersetzt den Biome-Absatz in `CLAUDE.md` durch einen Verweis auf `biome.json`. Paket 5 schaltet dort erstmals eine Regel **ein** (`performance/noReExportAll`), statt nur welche abzuschalten — der neue Absatz muss also beide Richtungen abdecken, sonst erklärt er die halbe Datei. Paket 5 fasst `CLAUDE.md` aus genau diesem Grund nicht an.
- Dazugenommen (2026-08-12, Zug 0 von Paket 6): zwei Kommentar-Stellen in `src/SignalLink.ts`. Erstens der W1-Block am gemeinsamen `unsubscribe()` — er behauptet, ein stehengebliebenes Cancel-Handle ließe »ein späteres `return()` die Listener eines *anderen* Aufrufs abmelden«. Gemessen trifft das nicht zu: entfernt man die Löschung, ändert sich in sieben Szenarien nichts Beobachtbares, denn das stehengebliebene Handle greift ausschließlich auf die eigenen, bereits verbrauchten Handles zu, und eventize-Handles sind danach inert. Die Löschung ist Vorsorge, nicht tragend — Paket 12 entscheidet, ob die Formulierung nachgezogen wird. Zweitens: Paket 6 verschiebt Kommentare wörtlich mit ihrem Code, ohne sie umzuformulieren (dieselbe Regel wie beim `#run()`-Umbau). Paket 12 prüft sie also gegen ihre **neuen** Positionen, nicht gegen die heutigen.
- Abgegrenzt (2026-08-12, Zug 0 von Paket 7): READ-004 schreibt die JSDoc über `[RECALL]()` um, die neben jeder Stelle von Paket 7 liegt. Zwei Kommentar-Stellen zieht Paket 7 selbst nach und nimmt sie damit hier heraus: die JSDoc von `destroyChildEffects` (nennt `childEffects`, heißt danach `#childEffects`) und die `@internal`-Notiz an `Effect#onDestroy()`, die die drei gebundenen Arrows der Fassade heute als zu bereinigende Inkonsistenz bezeichnet — nach Paket 7 tragen sie eine publizierte Zusage (`Signal#onChange()` gibt `destroy` entkoppelt zurück), und der Satz muss vorher umgedreht sein, nicht erst hier.
- Abgegrenzt (2026-08-12, Zug 0 von Paket 8): Paket 8 schreibt den JSDoc-Block über `emitEffectError()` in `src/EffectImpl.ts` und die Kostenpassage in der JSDoc von `onSignalizeError()` (`src/signalize-error.ts`) selbst neu — beide werden durch seinen Fix inhaltlich falsch. Hier kommt dadurch keine Stelle dazu, aber READ-004 und CONS-014 prüfen `EffectImpl.ts` gegen den Endstand **nach** Paket 8, nicht gegen den heutigen Wortlaut. Der `[RECALL]`-Text selbst liegt daneben und ist unberührt.
- Abgegrenzt (2026-08-12, Zug 0 von Paket 9): Paket 9 schreibt den Allokationskommentar in `SignalGroup.ts` selbst neu, legt zwei erklärende JSDoc-Zeilen an den beiden Namensregistern an und fasst den Re-Entrancy-Block an. Hier kommt dadurch keine Stelle dazu. Unter Ausgang B von READ-013 zieht Paket 9 zusätzlich `docs/api.md:915-918` und `skills/using-signalize/references/api.md:265-268` selbst nach — beide sind dann gegen den Endstand **nach** Paket 9 zu prüfen, nicht gegen den heutigen Wortlaut.
- Abgegrenzt (2026-08-12, Zug 0 von Paket 10): Paket 10 zieht vier Doku-Stellen selbst nach, weil es sie selbst falsch macht — `docs/api.md:447` (die `deprecation`-Zeile bekommt die Häufigkeitsangabe, die die `ignored-option`-Zeile daneben schon trägt), `docs/api.md:705` (zitierter Ablehnungstext), `skills/using-signalize/references/pitfalls.md:113` (»once per process« gilt danach für alle drei Deprecations) und vier Zitate in `CHANGELOG.md` (`:13`, `:18`, `:32`, `:141`, alle unter `## Unreleased`). Hier kommt dadurch keine Stelle dazu; `docs/api.md` und `pitfalls.md` sind aber gegen den Endstand **nach** Paket 10 zu prüfen, nicht gegen den heutigen Wortlaut. Weiter hier und von Paket 10 nicht angefasst: `docs/recipes.md:831-832` und `docs/api.md:866` — beide nennen nur die `@deprecated`-Tags, keine Meldungshäufigkeit, und bleiben richtig.
- Abgegrenzt (2026-08-12, Zug 0 von Paket 11): Paket 11 zieht die `pnpm check`-Zeile in `AGENTS.md`, `CONTRIBUTING.md` und `README.md` selbst nach (alle drei sagen heute »Biome lint + format« und verschweigen die Guard-Skripte). Hier kommt dadurch keine Stelle dazu, und diese drei Zeilen sind nicht noch einmal anzufassen. `CLAUDE.md` bleibt von Paket 11 unberührt, damit CONS-013 dort freie Bahn hat; Paket 11 ändert in `biome.json` ausschließlich `files.includes` (eine Zeile `scripts/**/*.mjs`), **keine Regel** — der Regel-Absatz, den CONS-013 durch einen Verweis ersetzt, ist davon nicht betroffen.
- Dazugenommen (2026-08-12, Zug 0 von Paket 2): der Nebenbefund aus Paket 1 zu `SignalAutoMap#create()` — die Invariante »wird nie mit belegtem Key erreicht« trägt heute die Abweichung von Paket 1, steht aber nur in diesem Plan. Sie gehört als Kommentar an den Code, wo `#drop()` seine eigene schon trägt; das ist dieselbe Arbeit wie die übrigen fünf Stellen dieses Pakets.

#### Was für beide Hälften gilt

- **Kein Verhalten ändert sich.** Beide Hälften fassen ausschließlich
  Kommentare, JSDoc und Prosa an — mit einer benannten Ausnahme: der
  Zeugensatz in 12a (N13). Der Maßstab dafür ist hart: **ungedeckte Einheiten
  bleiben 8/23/1/6**, und die Testzahl bewegt sich nur um die Zeugen, die 12a
  ausdrücklich mitbringt. Bewegt sich sonst etwas, wurde mehr als ein
  Kommentar angefasst.
- **Coverage-Gates:** `src/object-signals.ts`, `src/value.ts`,
  `src/createMemo.ts`, `src/effects.ts` und `src/effect-error-handlers.ts`
  fallen alle unter die 100-%-Stufe in `vitest.config.ts` (der negierte Glob,
  Tier 2). Kommentare bewegen daran nichts; ein neuer Zweig schon.
- **Das Doku-Gate `scripts/check-doc-refs.mjs`** (in `pnpm check` als
  `check:refs`) verbietet jedes `datei.ext:zeile` in `AGENTS.md`,
  `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/**/*.md` und
  `skills/**/*.md`. Es greift genau in 12b. Praktische Folge: der neue
  Biome-Absatz darf **nicht** `biome.json:45-75` schreiben — das Muster
  fängt auch `.json`. Symbolnamen und blanke Dateinamen sind erlaubt.
  `src/`-Kommentare (12a) prüft es nicht.
- **CHANGELOG:** JSDoc erreicht die ausgelieferten Deklarationen —
  `lib/value.d.ts` trägt den `value()`-Block wörtlich, `lib/effects.d.ts` den
  `createEffect`-Block. Das ist von außen sichtbar und bekommt Zeilen unter
  `### Documentation`. Beide Hälften schreiben ihre eigenen; Einträge unter
  `## v0.x.y` bleiben unberührt.
- **Reihenfolge:** 12a vor 12b.

### [x] 12a. JSDoc und Kommentare gegen den Code (nur `src/`)
- Findings: READ-004 (low), READ-008 (low), BUG-013 Quellhälfte (low), CONS-014 (low) · dazu die Nebenbefunde N1, N9, N10, N11, N13
- Ziel: Jeder Kommentar in `src/` sagt, was der Code daneben tut.
- Hash: `a77eb42`
- Ergebnis: 1 Runde, 1 Review-Durchgang, keine `wichtig`-Befunde · `pnpm world` grün, 655 Tests in 58 Dateien, ungedeckte Einheiten unverändert 8/23/1/6, `pnpm smoke` 8/8 · außerhalb von Schritt 9 enthält der Diff programmatisch geprüft **keine einzige Nicht-Kommentar-Zeile**
- **Zwei Angaben des Audits waren selbst falsch.** Die Empfehlung zu READ-004 datiert vor `#explicitRunRequested` — ein geparkter expliziter Run läuft sehr wohl. Und die dritte READ-008-Stelle in `createSignal.ts` ist gegenstandslos, weil 4a und 4b alle Überladungen neu geschrieben haben.
- **BUG-013 reicht weiter als gemeldet.** Gegen ein gebautes `dist/` gemessen, von Planer und Reviewer unabhängig: `get()` → 1, `beQuiet(get)` → 1, `hibernate(get)` → 1, `.value` → 0, `value()` → 0. Die Prämisse des Findings, `docs/api.md` sei korrekt, ist falsch — dieselbe falsche Regel steht an **sechs** Doku-Stellen. Die korrigierte JSDoc in `src/value.ts` ist der Bezugstext, gegen den 12b sie schreibt.
- Nebenbefund: `src/effect-error-handlers.spec.ts:404-418` — die vier neuen Zwischenprüfungen in Z8 sind bei heutiger Architektur **nicht unabhängig scharf**; keiner der geprüften Aufrufe (`group.clear()`, `SignalGroup.delete()`, zweimal `destroy()`) hat einen Pfad zu `handlerCount`. Ihr beobachteter Rot-Ausschlag stammt aus der Kaskade des vorbestehenden Nachbartests Z4. Der neue GC-Zeuge dagegen ist echt: gegen einen stummgeschalteten Report-Pfad wird er isoliert **und** im vollen Lauf rot.

### [x] 12b. Eine Regel, sieben Stellen — und die Biome-Liste
- Findings: BUG-013 Doku-Hälfte (low), CONS-013 (low) · dazu die Nebenbefunde N3, N4, N5, N8, N14
- Ziel: Dieselbe `beforeRead`-Regel an allen sieben Doku-Stellen, und ein Biome-Absatz, der in beide Richtungen stimmt.
- Hash: `9465e01`
- Ergebnis: 1 Runde plus ein Nachtrag, 2 Review-Durchgänge · `pnpm world` grün, 655 Tests in 58 Dateien, ungedeckte Einheiten unverändert 8/23/1/6, `pnpm smoke` 8/8
- **Die Regel, an allen sieben Stellen dieselbe:** `beforeRead` feuert bei jedem Lesen durch den Reader — getrackt oder nicht, `beQuiet()` und `hibernate()` unterdrücken die Subscription, nicht den Hook —, übersprungen wird er nur, wo der Reader umgangen wird (`.value`, `value(sig)`, ein `readAsValue: true`-Getter), und ein zerstörtes Signal feuert nichts. Zwei dieser Zusagen waren nie gemessen worden; der Reviewer hat beide gegen ein gebautes `dist/` bestätigt.
- **CONS-013: die Zahl des Audits war schon an seinem Stichtag falsch.** `useImportType` war im Vorlauf auf `error` gedreht worden — die Regel, auf deren Abschaltung der schärfste Satz des Findings beruhte. Heute: 16 abgeschaltet, 4 auf `error`, davon 2 echte Zuschaltungen dieses Laufs. Und »each match a deliberate pattern« ist für drei der 16 gemessen falsch: null Treffer bei sechzehn Einzelläufen.
- **Der JSONC-Nebenbefund aus Paket 10 war falsch, und beinahe wäre er in `CLAUDE.md` gelandet.** Er behauptete, ein Kommentar in `biome.json` degradiere die Konfiguration **still**. Gemessen in allen drei natürlichen Platzierungen: jede scheitert laut mit Exit 1 und einem Parse-Fehler auf exakter `datei:zeile:spalte`. Was Paket 10 sah, ist die **Folge**: bei zwei der drei Platzierungen läuft Biome danach auf einer Default-Konfiguration weiter, verliert `files.includes` und begräbt den Parse-Fehler unter ein paar hundert fremden Diagnosen; bei der Inline-Variante endet der Lauf vor der ersten Datei. Der Satz in `CLAUDE.md` sagt jetzt das Gemessene. **Die frühere Fassung dieses Nebenbefunds im Plan (Paket 10) ist damit widerlegt.**
- Nebenbefunde:
  - `docs/cheat-sheet.md:216` und `skills/using-signalize/references/api.md:316` — die `@signal()`-Optionsblöcke listen `beforeRead` kommentarlos neben einer `readAsValue`-Zeile; die Wechselwirkung (mit `readAsValue: true` feuert der Hook nie) fehlt dort. Keine falsche Aussage, nur eine fehlende.
  - `skills/using-signalize/SKILL.md` nennt `beforeRead` an keiner Stelle — konsistent mit seinem Zuschnitt auf sechs kuratierte Verhaltensweisen, aber es gibt dort keinen Einstieg in die Regel.

### [x] 13. Stabilitätszusage in die README
- Findings: API-011 (medium)
- Ziel: Ein Konsument liest, welche Zusage seine Versionsnummer trägt und welche nicht.
- Hash: `ad64dc0`
- Ergebnis: 1 Runde, 1 Review-Durchgang · API-011 behoben · `pnpm world` grün, 655 Tests in 58 Dateien, ungedeckte Einheiten unverändert 8/23/1/6, `pnpm smoke` 8/8, `check:refs` grün
- **Die Zusage macht bewusst keine Aussage über die Gegenwart** — kein »zurzeit«, keine Versionsnummer, kein Ausblick. Sie beschreibt, was eine Nummer bedeutet, und bleibt damit auf beiden Seiten von 1.0.0 wahr. Das npm-Badge vier Zeilen darüber beantwortet die Jetzt-Frage live.
- **»Drei Sätze reichen« aus dem Audit trug die Entscheidung nicht.** Zwei ihrer vier Klauseln sind ohne Bezug leer. Die Definition der Fläche brauchte eine Korrektur: die erste Fassung nannte »die zwei Einstiegspunkte plus die Typen in `lib/**/*.d.ts`« — gemessen ist dieser Glob **breiter als die Zusage**, acht von 30 Deklarationsdateien liegen außerhalb des Import-Graphen beider Einstiegspunkte und tragen trotzdem echte, nicht `@internal` markierte Deklarationen, darunter eine vollständige Klasse `UniqIdGen`. `tsc` emittiert eine je Quelldatei, `package.json#files` liefert alle aus. Die Fläche ist, was der Import-Graph erreicht.
- **`@internal` brauchte denselben Zusatz.** Die Symbole sind aus den ausgelieferten Deklarationen geschnitten, bleiben aber teils über die globale Symbol-Registry erreichbar — so hat Paket 9 gefunden, dass `[$setParentGroup]` aus Konsumentencode einen Zyklus baut. Vom Reviewer an drei Beispielen gegen `lib/*.d.ts` und gegen ein gebautes `dist/` nachgemessen.
- **Die Publish-Mechanik bleibt unberührt und ist beschrieben.** `main.yml` veröffentlicht bei jedem Push auf `main`, sobald das `-dev`-Suffix fällt — kein Tag, keine Freigabe; in jedem Teilsatz gegen `main.yml` und `publishPackage.cjs` gegengelesen. Semver ist ein Vertrag zwischen Nummer und Kompatibilität; ein Gate machte keinen Satz wahrer. Steht in `CONTRIBUTING.md`, wo es liest, wer `package.json` anfasst.
- 50 Breaking Changes stehen heute unter `## Unreleased`, am Audit-Commit waren es 41 — die Zahl des Findings war exakt, elf Pakete dieses Laufs haben neun dazugelegt. Als Argument im Plan, in keiner der drei Dateien.
- Nebenbefund: `src/constants.ts:28` — der Kommentar behauptet weiter einen `export *` in `index.ts`, den Paket 5 abgeschafft hat. Der letzte von Paket 5 hinterlassene Kommentar, den kein Doku-Paket eingesammelt hat. Ziel ist der Abschluss-Commit, nicht Paket 14.

### [x] 14. Modulnamen auf eine Konvention
- Findings: CONS-003 (low)
- Ziel: Kebab-case für jedes Nicht-Klassenmodul, die Regel in `AGENTS.md` festgehalten.
- Hash: `f719e2e`
- Ergebnis: 1 Runde, 1 Review-Durchgang, ein `klein` (fehlendes Leerzeichen in einer Tabellenzeile) · **18 Dateien per `git mv`**, alle mit 94–100 % Ähnlichkeit als Rename erkennbar · 66 Importspezifizierer in 48 Dateien · `pnpm world` grün, 655 Tests in 58 Dateien, ungedeckte Einheiten unverändert 8/23/1/6, `pnpm smoke` 8/8
- **Der Äquivalenznachweis ist der schärfste des Laufs.** Alle 30 erzeugten `.d.ts` sind nach Normalisierung der vier Dateinamen byte-identisch; die Restdifferenz erschöpft sich in vier Dateinamen und einer JSDoc-Zeile in `lib/EffectImpl.d.ts`. In `dist/` bleiben alle drei `.js` byte-identisch — **inklusive des inhaltsgehashten Chunknamens**; nur `sources`/`sourcesContent` der Sourcemaps driften. Vom Planer in einer Probe vorweggenommen, vom Implementierer getroffen, vom Reviewer unabhängig reproduziert.
- **Die Gegenrichtung wurde mitgeprüft:** die sieben Klassenmodule sind PascalCase geblieben, und `createSignal`/`createMemo`/`beQuiet` sind als **Bezeichner** unverändert — nur ihre Dateien heißen anders. Ein zu gieriges Ersetzen hätte die Exporte mit umbenannt, und kein Test hätte das gefangen, weil die Tests mitgewandert wären.
- **Die stille Falle aus Paket 12b trägt hier nicht**, wurde aber geprüft: die zwei wildcard-freien Pfade in `biome.json` → `overrides` zeigen auf `src/signalize-error.ts` (kebab) und `src/EffectImpl.ts` (Klassenmodul), beide bleiben. Ein toter Pfad dort würde von Biome **nicht** gemeldet — die stille Hälfte der Warnung existiert wirklich. Abgleich jedes Pfadliterals gegen das Dateisystem: `fehlend: []`.
- Nebenbefunde: keine neuen
