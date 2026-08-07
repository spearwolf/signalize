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
  beQuiet,
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

  // `readAsValue: true` only differs from the default inside a running
  // effect, through dependency tracking: the plain accessor's getter calls
  // `si.get()` (tracked), the `readAsValue` one calls `si.value` (untracked).
  // Read outside an effect, as above, both look identical — that proved
  // nothing. Prove the actual difference: an effect reading the plain
  // accessor reruns when it changes, one reading the `readAsValue` accessor
  // does not, even though the value underneath did change.
  const fooRuns: number[] = [];
  const barRuns: string[] = [];

  const fooEffect = createEffect(() => {
    fooRuns.push(obj.foo);
  });
  const barEffect = createEffect(() => {
    barRuns.push(obj.bar);
  });

  assert.deepEqual(fooRuns, [2]);
  assert.deepEqual(barRuns, ['b']);

  obj.foo = 3;
  obj.bar = 'c';

  assert.deepEqual(fooRuns, [2, 3]);
  assert.deepEqual(barRuns, ['b']);
  // The signal itself did change; only the effect's subscription to it did
  // not happen — a decorator that silently ignored `readAsValue` (always
  // `si.get()`) would track `bar` here too and push 'c'.
  assert.equal(obj.bar, 'c');

  fooEffect.destroy();
  barEffect.destroy();
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

test("the shipped declarations hand back beQuiet()'s result", () => {
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
