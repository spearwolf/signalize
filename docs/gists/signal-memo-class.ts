import {signal, memo} from '@spearwolf/signalize/decorators';

class Name {
  @signal() accessor firstName = '';
  @signal() accessor lastName = '';

  @memo() fullName() {
    return `${this.firstName} ${this.lastName}`;
  }
}

const name = new Name();

name.firstName = 'Monkey';
name.lastName = 'D. Ruffy';

console.log('hej', name.fullName());
// => "hej Monkey D. Ruffy"
