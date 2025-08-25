/* eslint-disable no-console */
import {createEffect, createSignal, createMemo} from '@spearwolf/signalize';

// see https://github.com/milomg/reactively/blob/main/Reactive-algorithms.md#reactive-algorithms

// [A]
const a = createSignal(1);

// const b = createSignal(0);
// const c = createSignal(0);

console.log('--- Setup effects');

// [B]
// createEffect(() => {
//   console.log('[B], a=', a.value, 'b=', b.value);
//   b.set(a.get() * 0);
// });
const b = createMemo(() => {
  console.log('[memo:B], a=', a.value);
  return a.get() * 0;
});
// const b = createMemo(() => a.get() * 0);

// [C]
// createEffect(() => {
//   console.log('[C], b=', b.value);
//   c.set(b.get() + 1);
// });
const c = createMemo(() => {
  console.log('[memo:C], b=', b());
  return b() + 1;
});
// const c = createMemo(() => b() + 1);

// [D]
// createEffect(() => {
//   console.log('[D], a=', a.value, 'b=', b.get(), 'c=', c.get());
// });
createEffect(() => {
  console.log('[effect:D], a=', a.value, 'b=', b(), 'c=', c());
});

console.log('--- Update a to 2');
a.set(2);

console.log('--- Update a to 3');
a.set(3);
