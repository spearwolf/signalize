import {Priority} from '@spearwolf/eventize';
import fc from 'fast-check';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {batch} from './batch.js';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import {createEffect, getEffectsCount} from './effects.js';
import {destroySignal} from './signal-core.js';

const FC = {seed: 20260807, numRuns: 500} as const;

const priorityArb = fc.oneof(
  {arbitrary: fc.integer({min: -3, max: 3}), weight: 3},
  {
    arbitrary: fc.constantFrom(
      Priority.Min,
      Priority.Low,
      Priority.Normal,
      Priority.Medium,
      Priority.High,
      Priority.Max,
    ),
    weight: 1,
  },
);

/** Infinity-safe: `b - a` is NaN for two infinities of the same sign. */
const byPriorityThenCreation = (
  a: readonly [number, number],
  b: readonly [number, number],
): number => (a[0] === b[0] ? a[1] - b[1] : a[0] > b[0] ? -1 : 1);

type Node = {type: 'write'; sig: number} | {type: 'batch'; body: Node[]};

/** The signal-index generator for effects/writes needs `numSignals` first
 * — `chain` instead of `record`, or half the indices would land outside
 * range. */
const scenarioArb = fc.integer({min: 1, max: 4}).chain((numSignals) =>
  fc.record({
    numSignals: fc.constant(numSignals),
    effects: fc.array(
      fc.record({
        priority: priorityArb,
        deps: fc.uniqueArray(fc.integer({min: 0, max: numSignals - 1}), {
          minLength: 1,
          maxLength: numSignals,
        }),
      }),
      {minLength: 1, maxLength: 6},
    ),
    writes: fc.array(fc.integer({min: 0, max: numSignals - 1}), {
      minLength: 1,
      maxLength: 8,
    }),
  }),
);

describe('ordering invariants (property based)', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('P1 — priority ordering without a batch', () => {
    fc.assert(
      fc.property(
        fc.array(priorityArb, {minLength: 1, maxLength: 8}),
        (priorities) => {
          const sig = createSignal(0);
          const calls: Array<[number, number]> = [];
          const effects = priorities.map((priority, creationOrder) =>
            createEffect(
              () => {
                sig.get();
                calls.push([priority, creationOrder]);
              },
              {priority},
            ),
          );

          try {
            calls.length = 0;
            sig.set(1);

            // Every effect ran exactly once — set equality plus a length
            // check against the deduplicated set, not just an array length,
            // which a double-run-one/skip-another swap would pass unnoticed.
            const ranIndices = calls.map(([, creationOrder]) => creationOrder);
            const expectedRan = priorities.map((_, i) => i);
            expect(new Set(ranIndices)).toEqual(new Set(expectedRan));
            expect(ranIndices).toHaveLength(new Set(ranIndices).size);

            const expected = [...calls].sort(byPriorityThenCreation);
            expect(calls).toEqual(expected);
          } finally {
            for (const effect of effects) effect.destroy();
            sig.destroy();
          }
        },
      ),
      FC,
    );
  });

  it('P2/P3/P4 — priority ordering, dedup and final values in a batch', () => {
    fc.assert(
      fc.property(scenarioArb, ({numSignals, effects: effectSpecs, writes}) => {
        const signals = Array.from({length: numSignals}, () => createSignal(0));

        const calls: Array<[number, number]> = [];
        const readValuesByEffect: number[][] = effectSpecs.map(
          (): number[] => [],
        );

        const effects = effectSpecs.map(({priority, deps}, creationOrder) =>
          createEffect(
            () => {
              calls.push([priority, creationOrder]);
              for (const dep of deps) {
                readValuesByEffect[creationOrder]!.push(signals[dep]!.get());
              }
            },
            {priority},
          ),
        );

        try {
          calls.length = 0;
          for (const arr of readValuesByEffect) arr.length = 0;

          const finalValues = signals.map((s) => s.value);
          let writeCounter = 0;

          batch(() => {
            for (const sigIndex of writes) {
              writeCounter += 1;
              finalValues[sigIndex] = writeCounter;
              signals[sigIndex]!.set(writeCounter);
            }
          });

          const touchedSignals = new Set(writes);
          const shouldRun = effectSpecs.map(({deps}) =>
            deps.some((dep) => touchedSignals.has(dep)),
          );

          // P3: exactly the effects whose deps intersect the writes ran,
          // each of them exactly once — no more, no less.
          const ranIndices = calls.map(([, creationOrder]) => creationOrder);
          const expectedRan = effectSpecs
            .map((_, i) => i)
            .filter((i) => shouldRun[i]);
          expect(new Set(ranIndices)).toEqual(new Set(expectedRan));
          expect(ranIndices).toHaveLength(new Set(ranIndices).size);

          // P2: the priorities of the effects that ran fall monotonically.
          // Unlike P1, there is no creation-order tie-break to assert here:
          // within one priority bucket the flush order follows the order in
          // which a *write* first touched one of that effect's deps, not
          // the order the effects were created in.
          const priorities = calls.map(([priority]) => priority);
          for (let i = 1; i < priorities.length; i++) {
            expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]!);
          }

          // P4: every effect that ran saw the batch's final values on every
          // signal it reads, never an intermediate write.
          effectSpecs.forEach(({deps}, i) => {
            if (!shouldRun[i]) return;
            deps.forEach((dep, depIdx) => {
              expect(readValuesByEffect[i]![depIdx]).toBe(finalValues[dep]);
            });
          });
        } finally {
          for (const effect of effects) effect.destroy();
          for (const sig of signals) sig.destroy();
        }
      }),
      FC,
    );
  });

  it('P5 — nested batches behave like one flat batch', () => {
    fc.assert(
      fc.property(
        fc.integer({min: 1, max: 4}).chain((numSignals) =>
          fc.record({
            numSignals: fc.constant(numSignals),
            effects: fc.array(
              fc.record({
                priority: priorityArb,
                deps: fc.uniqueArray(
                  fc.integer({min: 0, max: numSignals - 1}),
                  {
                    minLength: 1,
                    maxLength: numSignals,
                  },
                ),
              }),
              {minLength: 1, maxLength: 5},
            ),
            program: fc.letrec<{node: Node}>((tie) => ({
              node: fc.oneof(
                {maxDepth: 3, depthSize: 'small'},
                fc.record({
                  type: fc.constant('write' as const),
                  sig: fc.integer({min: 0, max: numSignals - 1}),
                }),
                fc.record({
                  type: fc.constant('batch' as const),
                  body: fc.array(tie('node'), {minLength: 1, maxLength: 4}),
                }),
              ),
            })).node,
          }),
        ),
        ({numSignals, effects: effectSpecs, program}) => {
          const buildScenario = () => {
            const signals = Array.from({length: numSignals}, () =>
              createSignal(0),
            );
            const calls: number[] = [];
            const effects = effectSpecs.map(({priority, deps}, creationOrder) =>
              createEffect(
                () => {
                  for (const dep of deps) signals[dep]!.get();
                  calls.push(creationOrder);
                },
                {priority},
              ),
            );
            calls.length = 0;
            return {signals, effects, calls};
          };

          const collectWrites = (node: Node, into: number[]): void => {
            if (node.type === 'write') {
              into.push(node.sig);
            } else {
              for (const child of node.body) collectWrites(child, into);
            }
          };

          const nested = buildScenario();
          const flat = buildScenario();

          try {
            // P5a: no effect has run before the outermost batch() returns —
            // sampled from inside the traversal, at every write.
            const noRunsYet: boolean[] = [];
            let counter = 0;

            const runProgram = (node: Node): void => {
              if (node.type === 'write') {
                counter += 1;
                noRunsYet.push(nested.calls.length === 0);
                nested.signals[node.sig]!.set(counter);
              } else {
                batch(() => {
                  for (const child of node.body) runProgram(child);
                });
              }
            };

            batch(() => {
              runProgram(program);
              // A flush that happens right after the last write but still
              // inside the outermost batch() is invisible to the per-write
              // samples above if it's the very last one — this closes that
              // gap.
              noRunsYet.push(nested.calls.length === 0);
            });

            expect(noRunsYet.every(Boolean)).toBe(true);

            // P5b: the nested tree is equivalent to one flat batch with the
            // same write sequence.
            const flatWrites: number[] = [];
            collectWrites(program, flatWrites);

            let flatCounter = 0;
            batch(() => {
              for (const sigIndex of flatWrites) {
                flatCounter += 1;
                flat.signals[sigIndex]!.set(flatCounter);
              }
            });

            expect(nested.calls).toEqual(flat.calls);
          } finally {
            for (const effect of nested.effects) effect.destroy();
            for (const sig of nested.signals) sig.destroy();
            for (const effect of flat.effects) effect.destroy();
            for (const sig of flat.signals) sig.destroy();
          }
        },
      ),
      FC,
    );
  });

  it('P6 — nested effects run in pre-order on every rerun', () => {
    fc.assert(
      fc.property(
        fc.integer({min: 0, max: 4}),
        fc.integer({min: 1, max: 5}),
        (depth, reruns) => {
          const trigger = createSignal(0);
          const calls: number[] = [];

          // Each level (past the outer, which is level 0) is a genuine
          // child effect, created while its parent's callback is running —
          // that is what makes it die and get rebuilt on every parent
          // rerun (`destroyChildEffects()`), not just a recursive call.
          const build = (level: number): void => {
            calls.push(level);
            if (level < depth) {
              createEffect(() => build(level + 1));
            }
          };

          const outer = createEffect(() => {
            calls.length = 0;
            trigger.get();
            build(0);
          });

          try {
            const expected = Array.from({length: depth + 1}, (_, i) => i);

            for (let i = 0; i < reruns; i++) {
              calls.length = 0;
              trigger.set(i + 1);

              expect(calls).toEqual(expected);
              expect(getEffectsCount()).toBe(depth + 1);
            }
          } finally {
            outer.destroy();
            trigger.destroy();
          }
        },
      ),
      FC,
    );
  });

  it('P7 — a memo read during a flush is never stale', () => {
    fc.assert(
      fc.property(
        fc.integer({min: 1, max: 3}).chain((numSignals) =>
          fc.record({
            numSignals: fc.constant(numSignals),
            memoDeps: fc.uniqueArray(
              fc.integer({min: 0, max: numSignals - 1}),
              {
                minLength: 1,
                maxLength: numSignals,
              },
            ),
            effects: fc.array(
              fc.record({
                readsMemo: fc.boolean(),
                deps: fc.uniqueArray(
                  fc.integer({min: 0, max: numSignals - 1}),
                  {
                    minLength: 0,
                    maxLength: numSignals,
                  },
                ),
                priority: fc.oneof(
                  fc.integer({min: -5, max: 0}),
                  fc.constantFrom(Priority.High, Priority.Critical, 1001),
                ),
              }),
              {minLength: 1, maxLength: 4},
            ),
            writes: fc.array(fc.integer({min: 0, max: numSignals - 1}), {
              minLength: 1,
              maxLength: 6,
            }),
          }),
        ),
        ({numSignals, memoDeps, effects: effectSpecs, writes}) => {
          const signals = Array.from({length: numSignals}, () =>
            createSignal(0),
          );
          const memo = createMemo(() =>
            memoDeps.reduce((sum, dep) => sum + signals[dep]!.get(), 0),
          );

          const observed: number[] = [];
          const effects = effectSpecs.map(({readsMemo, deps, priority}) =>
            createEffect(
              () => {
                for (const dep of deps) signals[dep]!.get();
                if (readsMemo) observed.push(memo());
              },
              {priority},
            ),
          );

          try {
            observed.length = 0;
            const finalValues = signals.map((s) => s.value);
            let writeCounter = 0;

            batch(() => {
              for (const sigIndex of writes) {
                writeCounter += 1;
                finalValues[sigIndex] = writeCounter;
                signals[sigIndex]!.set(writeCounter);
              }
            });

            const expectedMemoValue = memoDeps.reduce(
              (sum, dep) => sum + finalValues[dep]!,
              0,
            );

            for (const value of observed) {
              expect(value).toBe(expectedMemoValue);
            }
          } finally {
            for (const effect of effects) effect.destroy();
            destroySignal(memo);
            for (const sig of signals) sig.destroy();
          }
        },
      ),
      FC,
    );
  });

  it('P8 — a throwing effect changes nothing about who runs, or in which order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({priority: priorityArb, throws: fc.boolean()}), {
          minLength: 1,
          maxLength: 8,
        }),
        (specs) => {
          const sig = createSignal(0);
          const calls: Array<[number, number]> = [];
          const seen: number[] = [];
          const errors = specs.map((_, i) => new Error(`boom in effect ${i}`));

          let armed = false;
          const effects = specs.map(({priority, throws}, creationOrder) =>
            createEffect(
              () => {
                seen.push(sig.get());
                calls.push([priority, creationOrder]);
                if (armed && throws) throw errors[creationOrder];
              },
              {priority},
            ),
          );

          try {
            calls.length = 0;
            seen.length = 0;
            armed = true;

            let thrown: any;
            try {
              sig.set(1);
            } catch (err) {
              thrown = err;
            }

            // Same three assertions as P1 — they must hold with a throwing
            // effect in the fan-out exactly as they do without one.
            const ranIndices = calls.map(([, creationOrder]) => creationOrder);
            const expectedRan = specs.map((_, i) => i);
            expect(new Set(ranIndices)).toEqual(new Set(expectedRan));
            expect(ranIndices).toHaveLength(new Set(ranIndices).size);

            const expected = [...calls].sort(byPriorityThenCreation);
            expect(calls).toEqual(expected);

            // Every effect, the failing ones included, saw the written value.
            expect(seen).toEqual(specs.map(() => 1));

            // The failures reach the caller of set(), in delivery order.
            const expectedErrors = expected
              .map(([, creationOrder]) => creationOrder)
              .filter((i) => specs[i]!.throws)
              .map((i) => errors[i]);

            if (expectedErrors.length === 0) {
              expect(thrown).toBeUndefined();
            } else if (expectedErrors.length === 1) {
              expect(thrown).toBe(expectedErrors[0]);
            } else {
              expect(thrown).toBeInstanceOf(AggregateError);
              expect(thrown.errors).toEqual(expectedErrors);
            }
          } finally {
            for (const effect of effects) effect.destroy();
            sig.destroy();
          }
        },
      ),
      FC,
    );
  });
});
