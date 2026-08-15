---
name: using-signalize
description: Write, review, or debug code that uses `@spearwolf/signalize` — signals, effects, memos, links, SignalGroup, SignalAutoMap, or the `@signal` decorator. Use when a file imports `@spearwolf/signalize` or `@spearwolf/signalize/decorators`, when the user mentions signalize, or when reactivity built on it misbehaves (effect never re-runs, effect runs too often, memo looks stale, listeners leak). Loads the mental model plus the behaviours that differ from React/Solid/Vue; API, pitfall and pattern references load on demand.
---

# Using @spearwolf/signalize

Framework-agnostic, **synchronous** fine-grained reactivity. ESM-only, `sideEffects: false`, ES2023, Node `>=22` or any modern browser. Peer dep: `@spearwolf/eventize`. Fully typed.

```ts
import {createSignal, createEffect, createMemo, link, SignalGroup} from '@spearwolf/signalize';
import {signal} from '@spearwolf/signalize/decorators';
```

## Mental model

- **Signal** (reactive value) → **Effect** (auto-rerun) → **Memo** (cached derived signal) → **Link** (one-way flow). **SignalGroup** owns lifecycles.
- Propagation is **synchronous and inline**. `signal.set(x)` runs every dependent effect *before it returns*. No scheduler, no microtask queue, no tearing — and no free debounce; an effect that throws does not cut the delivery short, `set()` re-raises once every effect has run.
- Effects subscribe **on read**: calling `sig.get()` inside the callback registers the dependency. Deps are recomputed every run, so they may grow or shrink.
- Memos are signals driven by a high-priority (`1000`) effect, so they settle before ordinary effects.
- `async` effect callbacks are second-class citizens: nothing is awaited, the cleanup of a run that was superseded before its promise settled runs *late* rather than being dropped, and a rejection is reported via `onEffectError()` — or, with nobody listening there, via the general `onSignalizeError()` channel — instead of being thrown (`references/pitfalls.md`, 11a/11b).
- Lifecycles are explicit. Signals, effects and links live until destroyed — normally via the `attach` option plus `SignalGroup.delete(obj)`. A group attached to a host object additionally has a `FinalizationRegistry` backstop, but it is leak insurance, not a lifecycle (see behaviour 5).

## Six behaviours that silently produce wrong code

These cause no error and no warning. They are the difference between signalize and the signal libraries most code is modelled on.

**1 — `set()` takes a value, never an updater.** A function argument is *stored as the value*, not invoked.

```ts
count.set((v) => v + 1);        // ✗ stores the function
count.set(count.value + 1);     // ✓
```

**2 — `.get()` tracks, `.value` does not.** Reading `.value` inside an effect creates an effect that never re-runs.

```ts
createEffect(() => render(pos.value));   // ✗ runs once, never again
createEffect(() => render(pos.get()));   // ✓
```

The decorator has the same switch, and one of its options depends on it:
`@signal({readAsValue: true}) accessor pos = 0` makes the *property* an
untracked read, so the `beforeRead` hook that `@signal()` and
`createSignal()` both accept never fires for that property access — the
hook sits in the reader, and `.value` bypasses the reader. The decorator's
other options are `name`, `compare` and `attach` (`references/api.md`).

**3 — Static deps disable autorun *and* auto-tracking.** `createEffect(cb, [a, b])` (or `{dependencies: [...]}`) does not run on creation, and signals read inside the callback are not subscribed — only `a` and `b` trigger reruns.

```ts
const eff = createEffect(cb, [a, b]);
eff.run();   // ✓ call once if an initial pass is wanted
```

Tracking is off, the effect context is not: effects created inside the callback
are still child effects and die with the parent.

**4 — Lazy memos do not push.** Default `lazy: false` behaves like a computed signal: dependent effects re-run when deps change. With `lazy: true` the memo only recomputes on read and dependents are *not* notified. There is no memo decorator — a class-bound memo is `createMemo(..., {attach: this})`, which dies with the surrounding effect if the instance is constructed inside one (`references/pitfalls.md`, 7a).

**5 — Cleanup is explicit.** Effects and links outlive the scope that created them, and an unattached one stays reachable from the global registries indefinitely. Pass `{attach: obj}` at creation and tear down with `SignalGroup.delete(obj)`.

A group *with a host object* also gets a `FinalizationRegistry` backstop: once that object becomes unreachable without an explicit teardown, the group's `clear()` runs and the attached signals, effects and links are reclaimed. It is a genuine safety net, but GC timing is unobservable and it may never fire within a process — so it prevents the worst-case leak rather than defining when cleanup happens. Design for explicit disposal; treat the registry as insurance.

**6 — `createSignal(existingSignal)` is a passthrough.** It returns that same signal — no clone, no new instance. Handy for "value or signal" helpers; wrong if a copy was intended. Except for `{attach}`, everything in `params` is dropped and reported on every such call through `onSignalizeError()` (`source: 'ignored-option'`) — nothing configures a signal that was never created.

## Verifying reactive code

The library exports live counters. In tests, snapshot → run → destroy → assert restored; a mismatch is a leak:

```ts
const baseline = [getSignalsCount(), getEffectsCount(), getLinksCount()];
// … build, use, and tear down the scenario …
expect([getSignalsCount(), getEffectsCount(), getLinksCount()]).toEqual(baseline);
```

## Reference files

Read these when the task needs them — they are not loaded upfront.

| File | Read it when |
| --- | --- |
| `references/api.md` | Looking up exact signatures, options, or what is exported from which entry point |
| `references/pitfalls.md` | Behaviour is surprising, or reviewing code for subtle reactivity bugs — the full annotated list, of which the six above are the most common |
| `references/patterns.md` | Structuring something new: lifecycle bundles, frame-paced effects, derivation chains, decorator classes, and the idiomatic rewrite of each anti-pattern |
| `references/migration-v1.md` | Moving a codebase from `0.x` to `1.0.0` — what breaks, and the repair for each. Also the fastest way to see what a `TS2769` from `createSignal()`/`set()` or a fresh `AggregateError` is about |

The project's own `docs/` folder (`api.md`, `recipes.md`, `architecture.md`, `cheat-sheet.md`) goes deeper still when it is available.

## Judgement

This skill describes how signalize behaves, not a house style. Synchronous inline propagation, manual lifecycles and explicit `attach` are the library's design, so code that ignores them tends to leak or go stale — but how to structure an application on top is an open question. Prefer the user's existing conventions, and treat the items above as facts to design around rather than rules to enforce.

Signalize is a poor fit for cross-process or async-first state, for built-in time-travel/devtools, and for a single "call me when X changes" with no derivation graph (`sig.onChange(cb)` or plain eventize is simpler there). Say so rather than forcing it.
