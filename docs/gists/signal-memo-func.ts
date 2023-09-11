import {createSignal, createMemo} from '@spearwolf/signalize';

const [firstName, setFirstName] = createSignal<string>();
const [lastName, setLastName] = createSignal<string>();

const fullName = createMemo(() => `${firstName()} ${lastName()}`);
// => [function]

setFirstName('Monkey');
setLastName('D. Ruffy');

console.log('hej', fullName());
// => "hej Monkey D. Ruffy"
