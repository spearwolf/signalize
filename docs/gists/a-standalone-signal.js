import {createSignal} from '@spearwolf/signalize';

const [foo, setFoo] = createSignal(123);

foo(); // => 123

setFoo(456);
foo(); // => 456
