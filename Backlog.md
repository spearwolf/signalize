# Backlog — Code-Analyse `@spearwolf/signalize`

> **Status:** Stand 2026-05-09 · 234 Tests grün via `pnpm test` (+2 GC-Tests via `pnpm test:gc`, übersprungen ohne `--expose-gc`) · Quelle: `src/`
>
> Dieses Dokument listet die noch offenen Befunde der Source- und Spec-Analyse. Punkte sind nach **Schweregrad** geordnet (🟠 Risiko / Inkonsistenz · 🟡 Verbesserung · 🟢 Test-Lücke · ⚪ Aufräumen). Bereits erledigte Punkte sind im `CHANGELOG.md` unter `## Unreleased` dokumentiert.

---

## 1. Bugs / Risiken

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

**Empfehlung:** Entweder beim Re-Use trotzdem `link.attach(options.attach)` aufrufen oder dokumentiert eine Warnung emittieren. Test schreiben, der Re-Use mit divergierender `attach`-Option abdeckt (siehe 4.5).

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

## 2. Inkonsistenzen / API-Schiefstand

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

## 3. Test-Lücken

### 🟢 3.1 Kein Test für Throw in Lazy-`valueFn`
Was passiert, wenn `createSignal(() => { throw … }, {lazy: true})` und der Reader gerufen wird? Erneuter Read → erneuter Throw? Cache-State? (Verbunden mit 2.2.)

### 🟢 3.2 Kein Test für `signalReader(callback)`-Leak
Effekt wird erzeugt, kein Handle zurückgegeben → `getEffectsCount` müsste verifizieren, dass *nur* `destroySignal` aufräumt (heute durch Spec-Setup verschleiert). Die Callback-Form ist deprecated; der Leak-Fix verbleibt zusammen mit der Entfernung der Callback-Form.

### 🟢 3.3 Kein Test für `link(a, b, {attach: g1})` Re-Use mit `attach: g2`
Siehe 1.5.

### 🟢 3.4 Kein expliziter Test für `value([obj, key])` und `touch([obj, key])`
Die Tuple-Overloads sind in `value.ts`/`touch.ts` definiert, werden im Decorator-Test indirekt mitgetestet, aber haben keinen eigenen Spec-Block.

### 🟢 3.5 Kein Test für `destroySignal` *während* eines Effect-Callbacks
Was, wenn der Effect-Callback ein Signal zerstört, das er gerade liest? Aktueller Code: `globalDestroySignalQueue` emittiert `signalId`, jeder Effect mit dieser Subscription führt `[$destroySignal]` synchron aus → räumt Subscriptions ab → wenn alle Signals weg → `destroy()` mitten in `run()`. Kein Spec deckt das.

### 🟢 3.6 Kein Edge-Case-Test für NaN-Vergleich
Standard-Compare ist `===`. `NaN !== NaN` → jedes Schreiben von NaN triggert Effects, auch wenn der Wert "gleich" ist. Verhalten dokumentieren *oder* `Object.is` als Default verwenden.

---

## 4. Überflüssiges / Aufräumen

### ⚪ 4.1 Toter Code: `EffectImpl.idGen` als `private static`
Wird nur in `EffectImpl` selbst genutzt. OK, aber Klassennamen-Prefix `EffectImpl.idGen` ist unnötig — `const idGen = new UniqIdGen('ef');` als Modul-Konstante reicht (wie in `createSignal.ts` mit `idCreator`).

### ⚪ 4.2 `LinkOptions.twoWay` auskommentiert
`src/link.ts:33-37` enthält einen kommentierten `twoWay`-Plan. Entweder umsetzen oder löschen — toter Kommentar bindet zukünftige Kontributorinnen.

### ⚪ 4.3 `XXX` Marker ohne Issue
`src/batch.ts:73` `// XXX batch() ist ein Hint, kein Guarantee …`. Wenn das eine bekannte Limitation ist, gehört es ins JSDoc oder die Doku, nicht als XXX-Marker.

### ⚪ 4.4 `createSignal.ts` und `Signal.ts` haben Zirkular-Pärchen
`Signal.ts` importiert aus `createSignal.ts` (für `destroySignal`), `createSignal.ts` aus `Signal.ts` (für die Klasse). NodeNext löst das, aber die Modul-Topologie ist fragil. Eine schmale `signal-types.ts`-Schicht könnte das entkoppeln.

### ⚪ 4.5 `SignalGroup` private constructor + `findOrCreate`-Smart-Return
**Datei:** `src/SignalGroup.ts:95-106`

Der `private constructor` gibt aus dem Body via `return obj` ein bereits existierendes SignalGroup zurück — TypeScript-zulässig, aber unüblich. `findOrCreate` macht `new SignalGroup(...)` und vertraut darauf. Funktional OK, aber ein expliziter Factory-Pfad wäre lesbarer.

### ⚪ 4.6 `console.warn` statt zentrales Logging
Zwei `console.warn` in `SignalGroup.ts` — kein Logger-Abstraction. Für eine Lib mit `sideEffects: false` eher unschön. (Verbunden mit 2.6.)

---

## 5. Priorität

### Mittelfristig (API-Klarheit)

1. **1.5** `link()` Re-Use mit divergierender `attach`-Option behandeln (+ Test 3.3).
2. **1.7** `attachSignalByName` Mehrfach-Eintrag verhindern.
3. **2.4** `Effect.isDestroyed`-Getter ergänzen (Symmetrie zu `SignalLink`).
4. **2.6** / **4.6** Zentrale `deprecate()`-Helper, Version + Once-Warning.

### Längerfristig (architektonisch)

5. **4.4** Modul-Zirkularität (`createSignal.ts` ↔ `Signal.ts`) entzerren.
6. **2.3** / **2.5** Edge-Case-Verhalten von `createSignal(otherSignal, {attach})` und `findOrCreate(undefined)` dokumentieren oder verschärfen.

### Tests (Test-Schulden)

7. **3.1** Lazy-Throw,
8. **3.5** `destroySignal` während Effect-Callback,
9. **3.6** NaN-Vergleich,
10. **3.4** Tuple-Overloads `value([obj, key])` / `touch([obj, key])`.

---

**Gesamtbewertung:** Die akuten Memory- und Hot-Path-Risiken sind adressiert (`SignalGroup` WeakMap, Batch-Listener-Cleanup, `EffectImpl.run`-Allokation, `EffectImpl.maxDepth`-Bremse). Die verbleibenden Punkte sind API-Polish (1.5, 1.7, 2.4–2.7), Modul-Topologie (4.4) und Test-Lücken in selten begangenen Pfaden (3.1, 3.5, 3.6). Keine kritischen Funktionsfehler — alle 234+2 Tests grün.
