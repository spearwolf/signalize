import {signal} from '@spearwolf/signalize';

class App {
  @signal() accessor foo = 123;
}

const app = new App();

app.foo; // => 123
app.foo = 456; // => 456
