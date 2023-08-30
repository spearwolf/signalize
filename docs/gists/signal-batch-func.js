import {batch} from '@spearwolf/signalize';

// ...

batch(() => {
  setA(4);
  setB(3);
});
// => sum of 4 and 3 is 7
