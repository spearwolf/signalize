# Backlog — Code-Analyse `@spearwolf/signalize`

> **Status:** Stand 2026-05-08 · alle 216 Tests grün (`pnpm test`) · Quelle: `src/`
>
> Dieses Dokument fasst die Befunde einer vollständigen Source- und Spec-Analyse zusammen. Punkte sind nach **Schweregrad** geordnet (🔴 Bug / Leak · 🟠 Risiko / Inkonsistenz · 🟡 Verbesserung · 🟢 Test-Lücke · ⚪ Aufräumen).

---

## 1. Bugs

### 🔴 1.1 `EffectImpl.attachChildEffect` setzt `parentEffect` auf sich selbst
**Datei:** `src/EffectImpl.ts:184-187`

```ts
private attachChildEffect(effect: EffectImpl): void {
  this.childEffects.push(effect);
  this.parentEffect = this;        // ← sollte: effect.parentEffect = this
}
```

Der **Parent** bekommt sich selbst als Parent zugewiesen, statt dass das **Child** seinen Parent referenziert. Die Bug-Wirkung ist aktuell harmlos, weil `parentEffect` nirgends im Code **gelesen** wird (nur in Tests heißen lokale Variablen so). Effektiv ist das Feld also **toter Code** — es lügt zusätzlich noch.

**Empfehlung:**
- Entweder Fix: `effect.parentEffect = this;`
- oder das Feld komplett entfernen (`#parentEffect`-Property + Zuweisung), wenn keine Verwendung geplant ist.

---

### 🔴 1.2 `SignalImpl.writer` ignoriert `muted`/`destroyed` im Touch-Pfad
**Datei:** `src/createSignal.ts:140-144`

```ts
if (!this.muted && !this.destroyed) {
  writeSignal(this.id, this.#value);
  return;
}

const touch = params?.touch ?? false;
if (touch) {
  writeSignal(this.id, this.#value, {touch: true});  // ← keine Prüfung!
}
```

Wird `set(value, {touch: true})` auf einem **gemuteten** oder **zerstörten** Signal aufgerufen und der Wert ändert sich nicht (oder ändert sich, aber im muted-Pfad wird durchfall'd), dann wird der Touch trotzdem emittiert. `touch.ts` macht es korrekt; der Writer ist inkonsistent.

**Empfehlung:** Bedingung um die zweite `writeSignal`-Stelle ergänzen:
```ts
if (touch && !this.muted && !this.destroyed) {
  writeSignal(this.id, this.#value, {touch: true});
}
```

---

### ✅ 1.3 `signalReader(callback)` leakt Effects — *erledigt*
**Datei:** `src/createSignal.ts`

Statt der Form einen Unsubscribe-Handle zu geben, ist sie nun **deprecated**. `signalReader(callback)` emittiert eine Once-per-Prozess `console.warn` und verweist auf `Signal.onChange()` als die saubere Alternative (gibt einen `unsubscribe` zurück). Tests in `createSignal.deprecation.spec.ts`. JSDoc auf `SignalReader<T>` aktualisiert; Eintrag im CHANGELOG unter `### Deprecations`.

**Zusatz-Bug im selben Block** (beforeRead nur im else-Zweig): bereits in Commit `037521d` behoben — `signal.beforeRead?.()` steht jetzt am Anfang der Reader-Funktion und gilt für beide Pfade. Regressions-Test in `createSignal.beforeRead.spec.ts`.

---

### 🔴 1.4 `SignalGroup`-Store ist eine **starke** `Map`, kein `WeakMap`
**Datei:** `src/SignalGroup.ts:9`

```ts
const store = new Map<object, SignalGroup>();
```

Jedes Objekt, das je als `attach`-Argument oder Decorator-Host benutzt wurde, wird **bis zum manuellen `clear()`/`delete()` festgehalten** und kann nicht GCed werden. Bei Decorator-Nutzung in vielen kurzlebigen Klassen-Instanzen ein **echter Memory-Leak**.

`g_objectStores` (`src/object-signals.ts:8`) ist korrekt als `WeakMap` umgesetzt — der Stilbruch in `SignalGroup.ts` ist auffällig.

**Empfehlung:**
- Primärspeicher: `WeakMap<object, SignalGroup>` für Lookup.
- Wenn `SignalGroup.clear()` über *alle* Gruppen iterieren muss: zusätzlich ein `Set<SignalGroup>` führen, dem beim Konstruktor add'd und im `clear()` deleted wird. (Set hält nur SignalGroups, nicht die User-Objekte → User-Objekte werden durch das Set nicht am Leben gehalten.)
- Alternative: nur Methoden, die das User-Objekt benötigen, gehen über die WeakMap; iterierende Methoden über das Set der SignalGroups.

---

### 🟠 1.5 `link()` ignoriert `options.attach` bei Re-Use
**Datei:** `src/link.ts:58-69`

```ts
if (gLinks.has(sourceSignal)) {
  links = gLinks.get(sourceSignal)!;
  const _target = signalImpl(target) ?? target;
  if (links.has(_target)) {
    return links.get(_target);   // ← attach-Option wird stillschweigend verworfen
  }
} ...
```

Der zweite `link(a, b, {attach: groupX})`-Aufruf gibt den Singleton zurück, hängt ihn aber **nicht** an `groupX`. Der User hat kein Anzeichen, dass die Gruppen-Bindung verloren ging.

**Empfehlung:** Entweder beim Re-Use trotzdem `link.attach(options.attach)` aufrufen oder dokumentiert eine Warnung emittieren. Test schreiben, der Re-Use mit divergierender `attach`-Option abdeckt.

---

### 🟠 1.6 `SignalAutoMap.get()` liefert **destroyte** Signals zurück
**Datei:** `src/SignalAutoMap.ts:81-88`

Wenn ein Signal in der Map existiert, aber externer Code `destroySignal()` darauf aufgerufen hat, gibt `get(key)` weiterhin die zerstörte Instanz zurück. Lese- und Schreiboperationen auf so einem Signal sind effektiv No-Ops, ohne dass der Aufrufer es merkt.

**Empfehlung:** In `get()` prüfen ob `signalImpl(existing).destroyed`, in dem Fall neu erzeugen (wie für unbekannte Keys).

---

### 🟠 1.7 `SignalGroup.attachSignalByName(name, sameSignal)` Mehrfach-Eintragung
**Datei:** `src/SignalGroup.ts:167-191`

```ts
group.attachSignalByName('x', sig);
group.attachSignalByName('x', sig);   // sig taucht jetzt 2× in #otherSignals.get('x')
```

`#otherSignals` ist ein `Map<name, ISignalImpl[]>` ohne Dedup. Erste `detachSignal(sig)` entfernt nur das *erste* Vorkommen via `splice(indexOf, 1)` — die Liste bleibt belegt, der Name "klebt".

**Empfehlung:** Vor dem Push prüfen `if (!otherSignals.includes(si)) otherSignals.push(si)` *oder* `Set` statt `Array` (Reihenfolge-Annahme im Code: "letztes ist aktiv" → `Set` mit `Array.from()` an den Stellen, wo "previous" gewählt wird).

---

### 🟠 1.8 `Batch.run()` registriert globale Listener pro Batch-Lauf
**Datei:** `src/batch.ts:33-44`

Bei jedem `flush()` werden zwei `on()`-Listener am `globalEffectQueue` und `globalEffectCalledQueue` neu registriert und am Ende abgemeldet. Bei nested Batches und Hibernate-Pfaden könnte das in der Theorie zu doppelten Listeners führen, falls eine Exception zwischen `on()` und der `unsubscribe.forEach()`-Schleife auftritt — die `on`-Calls werden nicht im `try/finally` geschützt.

**Empfehlung:** `Batch.run()` mit `try { … } finally { unsubscribe.forEach(...) }` umschließen.

---

### 🟡 1.9 `Batch.batch()` toter Branch + ineffiziente Insertion
**Datei:** `src/batch.ts:11-25`

```ts
for (let i = 0; i < len; i++) {
  const [prio, effects] = this.delayedEffects[i];
  if (prio > priority) {
                          // ← leerer Branch, fall through
  } else if (prio === priority) { ... }
  else { splice(i, 0, …); return; }
}
```

Lesbar, aber:
- Der leere `if`-Zweig ist nur als "skip" gedacht — explizit als `continue` schreiben oder in eine Bedingung umkippen.
- `splice(i, 0, …)` ist O(n). Bei vielen Prioritätsstufen pro Batch O(n²). Praktisch wahrscheinlich harmlos, aber eine sortierte Insertion via Map<priority, Set<symbol>> + sortiertes Drainen wäre sauberer.

---

## 2. Inkonsistenzen / API-Schiefstand

### ✅ 2.1 `beforeRead` wird im Reader-mit-Callback-Pfad nicht aufgerufen — *erledigt*
**Datei:** `src/createSignal.ts`

`signal.beforeRead?.()` wurde an den Anfang von `signalReader` gezogen und gilt jetzt für beide Pfade (Commit `037521d`). Regressions-Test: `createSignal.beforeRead.spec.ts` ("fires when reader is invoked with a callback").

---

### 🟠 2.2 `SignalImpl.value`-Getter mutiert (`lazy = false`, `valueFn = undefined`)
**Datei:** `src/createSignal.ts:93-100`

```ts
get value(): Type | undefined {
  if (this.lazy) {
    this.#value = this.valueFn();   // Side-Effect im Getter
    this.valueFn = undefined;
    this.lazy = false;
  }
  return this.#value;
}
```

Side-Effect-Getter sind generell ein Geruch. Funktional korrekt für Lazy-Memoization, aber:
- Wenn `valueFn` wirft: `lazy` bleibt `true`, beim nächsten Read erneut versucht → kein Cache. Eventuell gewollt.
- Tests decken den Throw-Fall im Lazy-Init nicht ab (siehe 4.1).

**Empfehlung:** Verhalten dokumentieren ("lazy retries on throw"); Test ergänzen.

---

### 🟠 2.3 `createSignal(otherSignal, {attach})` überträgt fremde Signale heimlich
**Datei:** `src/createSignal.ts:189-202`

```ts
if (isSignal(initialValue)) {
  signal = signalImpl(initialValue);   // returns the existing impl
}
...
if (params?.attach != null) {
  SignalGroup.findOrCreate(params.attach).attachSignal(signal);
}
```

Übergibt man ein bereits existierendes Signal *und* eine `attach`-Gruppe, wird das vorhandene Signal an die neue Gruppe gebunden — **zusätzlich** zu möglichen anderen Bindungen. Beim `clear()` mehrerer Gruppen wird das Signal mehrfach `destroySignal`-aufgerufen (idempotent, OK), aber das Verhalten ist unerwartet. JSDoc erwähnt das nicht.

**Empfehlung:** Im JSDoc explizit beschreiben oder den `attach`-Pfad bei Re-Use weglassen (mit Warning).

---

### 🟡 2.4 `Effect`-Wrapper hat keinen `isDestroyed`-Getter
**Datei:** `src/Effect.ts`

Der Wrapper setzt `[$effect] = undefined`, aber dieser Zustand ist nur via Symbol-Lookup beobachtbar. `Signal` hat `destroyed` indirekt via `value()` etc., `SignalLink` hat `isDestroyed`. Symmetrie fehlt.

**Empfehlung:** `get isDestroyed(): boolean` ergänzen (`return this[$effect] == null`).

---

### 🟡 2.5 `SignalGroup.findOrCreate` mit `null` wirft, `SignalGroup.get` gibt `undefined`
Asymmetrie: `get(null)` → `undefined`, `findOrCreate(null)` → `throw`. Beides ist sinnvoll, aber `findOrCreate(undefined)` greift in den `private constructor`-Pfad mit `object ??= this` — der Konstruktor versucht dann sich selbst als Key in den Store zu legen. Das funktioniert zwar, ist aber ein subtiler Sonderfall.

**Empfehlung:** `findOrCreate(undefined)` ebenfalls werfen oder explizit dokumentieren.

---

### 🟡 2.6 Deprecation-Warnungen ohne Versionsschwelle
`SignalGroup.destroy()` und `SignalGroup#destroy` warnen via `console.warn`, ohne Version, ab der das passiert, oder Hinweis wann entfernt. Die Tests müssen die Warnings extra spy'en/silencen.

**Empfehlung:** `console.warn` durch eine zentrale `deprecate('SignalGroup.destroy', 'v0.28', 'use clear() instead')`-Helper ersetzen, mit Once-Warning pro Call-Site, und eine **Version** für die geplante Entfernung nennen. CHANGELOG sollte das spiegeln.

---

### 🟡 2.7 `// @ts-ignore` an `onCreateEffect`/`onDestroyEffect`
**Datei:** `src/effects.ts:27,36`

```ts
export const onCreateEffect = (...args: unknown[]) =>
  // @ts-ignore
  on(globalEffectQueue, $createEffect, ...args);
```

Verbergt einen Typfehler. Eventize-`on` ist überladen, `unknown[]` ist zu locker. Konsumenten verlieren die Typsicherheit.

**Empfehlung:** Engere Signatur (`(listener: (effect: EffectImpl) => void, priority?: number) => () => void`) und `as Parameters<…>`-Casts.

---

## 3. Performance / Skalierung

### 🟡 3.1 `EffectImpl.run()` wirft bei jedem Run eine neue `Set<symbol>` weg
**Datei:** `src/EffectImpl.ts:217`

```ts
this.#lostSignals = new Set(this.#signals);
```

Pro Re-Run wird ein neues `Set` allokiert (Größe = aktuelle Dependencies). Bei Hot-Path-Effects und vielen Dependencies messbar. Eine wiederverwendete Mutation (`#lostSignals.clear(); for (s of #signals) #lostSignals.add(s);`) spart Allokationen. Dasselbe `#destroyedSignals.clear()` direkt darunter macht es richtig.

---

### 🟡 3.2 `Batch.run()` baut `delayedEffects` per `flatMap` neu auf
**Datei:** `src/batch.ts:46-48`

`flatMap` allokiert ein temporäres Array über alle Effects + `Array.from(set)`-Kopien. Bei großen Batches der zweitschwerste Pfad. Direkte Iteration über `delayedEffects` und Inline-Loop spart die Zwischenarrays.

---

### 🟡 3.3 `link.ts` mehrfach `signalImpl(target)` berechnet
**Datei:** `src/link.ts:60-82`

```ts
const _target = signalImpl(target) ?? target;     // einmal in Singleton-Lookup
...
const targetSignal = signalImpl(target);          // erneut für Branch-Entscheidung
```

`signalImpl` ist günstig (Symbol-Get), aber der Code liest das gleiche zweimal und ist verwirrend. Lokale Variable wiederverwenden.

---

### 🟡 3.4 Keine Rekursionsbremse bei Self-Triggernden Effects
**Datei:** `src/EffectImpl.ts`

Effekte, die Signale schreiben, von denen sie abhängen, lösen rekursive `run()`-Aufrufe aus (Test in `effects.spec.ts` setzt count bis 23). Bei höheren Schwellwerten Stack-Overflow.

**Empfehlung:** Optional einen `maxDepth`-Schutz oder eine Detektor-Heuristik einbauen, die warnt; mindestens eine Doku-Notiz an `createEffect`.

---

## 4. Test-Lücken

### 🟢 4.1 Kein Test für Throw in Lazy-`valueFn`
Was passiert, wenn `createSignal(() => { throw … }, {lazy: true})` und der Reader gerufen wird? Erneuter Read → erneuter Throw? Cache-State?

### 🟢 4.2 Kein Test für `set(value, {touch: true})` auf gemutetem/destroytem Signal
Direkt verbunden mit Bug 1.2.

### 🟢 4.3 Kein Test für `signalReader(callback)`-Leak
Effekt wird erzeugt, kein Handle zurückgegeben → `getEffectsCount` müsste verifizieren, dass *nur* `destroySignal` aufräumt (heute durch Spec-Setup verschleiert).

### 🟢 4.4 Kein Test für **starke** SignalGroup-Map-Leak
Ein `WeakRef`-basierter Test (nach `clear`/`gc()`-Hint via `--expose-gc`) würde den Leak heute hard-fail'en.

### 🟢 4.5 Kein Test für `link(a, b, {attach: g1})` und Re-Use mit `attach: g2`
Siehe Bug 1.5.

### 🟢 4.6 Kein Test für `SignalAutoMap.get` nach externer `destroySignal()`
Siehe Bug 1.6.

### 🟢 4.7 Kein expliziter Test für `value([obj, key])` und `touch([obj, key])`
Die Tuple-Overloads sind in `value.ts`/`touch.ts` definiert, werden im Decorator-Test indirekt mitgetestet, aber haben keinen eigenen Spec-Block.

### 🟢 4.8 Kein Test für `destroySignal` *während* eines Effect-Callbacks
Was, wenn der Effect-Callback ein Signal zerstört, das er gerade liest? Aktueller Code: `globalDestroySignalQueue` emittiert `signalId`, jeder Effect mit dieser Subscription führt `[$destroySignal]` synchron aus → räumt Subscriptions ab → wenn alle Signals weg → `destroy()` mitten in `run()`. Kein Spec deckt das.

### 🟢 4.9 Reentrancy von `batch()` mit Throw in der Callback
Tests prüfen Happy-Path-Nesting. Was, wenn der Callback wirft? Wird `Batch.current` korrekt resettet? (Ja — `finally`-Block — aber kein Test).

### 🟢 4.10 `globalEffectStack`-Tests lecken EffectImpls
**Datei:** `src/globalEffectStack.spec.ts:11-26`

`new EffectImpl(NOOP)` ohne `destroy()` → `EffectImpl.count` wächst. Tests profitieren von Jest-Modul-Isolierung pro Spec-Datei und "verstecken" so den Leak. Für die Doktrin "Subscription-Counter restored" (CLAUDE.md) ist das ein Pflichtversäumnis.

**Empfehlung:** Spec mit `effect.destroy()` aufräumen.

### 🟢 4.11 Kein Edge-Case-Test für NaN-Vergleich
Standard-Compare ist `===`. `NaN !== NaN` → jedes Schreiben von NaN triggert Effects, auch wenn der Wert "gleich" ist. Verhalten dokumentieren *oder* `Object.is` als Default verwenden.

---

## 5. Überflüssiges / Aufräumen

### ⚪ 5.1 Toter Code: `EffectImpl.parentEffect`-Feld
Siehe 1.1. Entweder fixen oder löschen.

### ⚪ 5.2 Toter Code: `EffectImpl.idGen` als `private static`
Wird nur in `EffectImpl` selbst genutzt. OK, aber Klassennamen-Prefix `EffectImpl.idGen` ist unnötig — `const idGen = new UniqIdGen('ef');` als Modul-Konstante reicht (wie in `createSignal.ts` mit `idCreator`).

### ⚪ 5.3 `LinkOptions.twoWay` auskommentiert
`src/link.ts:33-37` enthält einen kommentierten `twoWay`-Plan. Entweder umsetzen oder löschen — toter Kommentar bindet zukünftige Kontributorinnen.

### ⚪ 5.4 `XXX` Marker ohne Issue
`src/batch.ts:73` `// XXX batch() ist ein Hint, kein Guarantee …`. Wenn das eine bekannte Limitation ist, gehört es ins JSDoc oder die Doku, nicht als XXX-Marker.

### ⚪ 5.5 `Effect.Destroy = 'destroy'` als String-Konstante
`src/EffectImpl.ts:48` definiert die Konstante lokal, während `constants.ts` bereits `DESTROY = 'destroy'` exportiert. Doppelter Source-of-Truth.

**Empfehlung:** `EffectImpl.Destroy` durch `import {DESTROY} from './constants.js'` ersetzen.

### ⚪ 5.6 `createSignal.ts` und `Signal.ts` haben Zirkular-Pärchen
`Signal.ts` importiert aus `createSignal.ts` (für `destroySignal`), `createSignal.ts` aus `Signal.ts` (für die Klasse). NodeNext löst das, aber die Modul-Topologie ist fragil. Eine schmale `signal-types.ts`-Schicht könnte das entkoppeln.

### ⚪ 5.7 `SignalGroup` private constructor + `findOrCreate`-Smart-Return
**Datei:** `src/SignalGroup.ts:95-106`

Der `private constructor` gibt aus dem Body via `return obj` ein bereits existierendes SignalGroup zurück — TypeScript-zulässig, aber unüblich. `findOrCreate` macht `new SignalGroup(...)` und vertraut darauf. Funktional OK, aber ein expliziter Factory-Pfad wäre lesbarer.

### ⚪ 5.8 `console.warn` statt zentrales Logging
Zwei `console.warn` in `SignalGroup.ts` — kein Logger-Abstraction. Für eine Lib mit `sideEffects: false` eher unschön.

---

## 6. Zusammenfassung & Priorität

### Mittelfristig (API-Klarheit)

6. ~~**1.3** `signalReader(callback)` muss Unsubscribe zurückgeben — oder deprecaten.~~ ✅ deprecated mit Once-Warnung; verweist auf `Signal.onChange`.
7. **1.5** `link()` Re-Use mit divergierender `attach`-Option behandeln.
8. **1.6** `SignalAutoMap.get` muss zerstörte Signals neu erzeugen.
9. **1.7** `attachSignalByName` Mehrfach-Eintrag verhindern.
10. **2.4** `Effect.isDestroyed`-Getter ergänzen (Symmetrie zu `SignalLink`).

### Längerfristig (architektonisch)

11. **1.4** `SignalGroup.store`: `Map` → `WeakMap` + Set-Iteration.
12. **3.1 / 3.2** Hot-Path-Allokationen in `EffectImpl.run` und `Batch.run` reduzieren.
13. **3.4** Rekursionsbremse / Doku für Self-Triggernde Effects.
14. **5.6** Modul-Zirkularität entzerren.

### Tests (Test-Schulden)

15. Tests **4.1–4.9** ergänzen, insbesondere:
    - Lazy-Throw,
    - Touch-on-muted/destroyed,
    - Group-Leak-Detection (mit `--expose-gc`),
    - `destroySignal` während Effect-Callback,
    - Batch-Throw-Reset.

---

**Gesamtbewertung:** Architektur und API-Design sind solide, Tests umfangreich (228, Stand 2026-05-08), Subscription-Leak-Disziplin ist im `assert-helpers.ts` gut etabliert. Verbleibendes Hauptrisiko ist der **stille Memory-Leak** in `SignalGroup` (1.4); der Typo-Bug (1.1) und der Reader-Leak (1.3) sind adressiert (1.3 als Deprecation; eigentlicher Leak-Fix verbleibt zusammen mit der späteren Entfernung der Callback-Form). Keine kritischen Funktionsfehler — alles in Tests grün —, aber die Lücken zeigen sich erst in Langläufer- und Hot-Path-Szenarien.
