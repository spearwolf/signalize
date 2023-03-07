import {signal} from '.';

describe('@signal class field decorator', () => {
  it('works as expected', () => {
    class Foo {
      @signal foo = 1;
    }

    const foo = new Foo();

    expect(foo.foo).toBe(1);
  });
});
