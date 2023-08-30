import {signal, effect} from '@spearwolf/signalize';

class CheekyCalc {
  @signal() accessor a = 0;
  @signal() accessor b = 1;

  @effect() calc() {
    const sum = this.a + this.b;
    console.log('sum of', this.a, 'and', this.b, 'is', sum);
  }

  constructor() {
    this.calc();
  }
}

const cheekyCalc = new CheekyCalc();
// => sum of 0 and 1 is 1

cheekyCalc.a = 2;
// => sum of 2 and 1 is 3
