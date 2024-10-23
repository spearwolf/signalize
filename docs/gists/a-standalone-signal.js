import {createSignal} from '@spearwolf/signalize';

const foo = createSignal(123);

foo.get(); // => 123

foo.set(456);
foo.value; // => 456
