import {createSignal, createEffect} from '@spearwolf/signalize';

const a = createSignal(0);
const b = createSignal(1);

createEffect(() => {
  const sum = a.get() + b.get();
  console.log('sum of', a.get(), 'and', b.get(), 'is', sum);
});
// => sum of 0 and 1 is 1

a.set(2);
// => sum of 2 and 1 is 3
