import {batch} from '@spearwolf/signalize';

// ...

batch(() => {
  cheekyCalc.a = 4;
  cheekyCalc.b = 3;
});
// => sum of 4 and 3 is 7
