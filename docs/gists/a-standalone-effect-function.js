import {createSignal, createEffect} from '@spearwolf/signalize';

const [a, setA] = createSignal(0);
const [b, setB] = createSignal(1);

createEffect(() => {
  const sum = a() + b();
  console.log('sum of', a(), 'and', b(), 'is', sum);
});
// => sum of 0 and 1 is 1

setA(2);
// => sum of 2 and 1 is 3
