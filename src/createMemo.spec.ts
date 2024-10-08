import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';

describe('createMemo', () => {
  it('works as expected (lazy by default)', () => {
    const {get: firstName, set: setFirstName} = createSignal<string>();
    const {get: lastName, set: setLastName} = createSignal<string>();

    let memoCallCount = 0;

    const fullName = createMemo(() => {
      ++memoCallCount;
      const first = firstName() ?? '';
      return lastName() ? `${first} ${lastName()}` : first;
    });

    expect(fullName()).toBe('');

    expect(memoCallCount).toBe(1);

    setFirstName('Spearwolf');

    expect(memoCallCount).toBe(1);

    expect(fullName()).toBe('Spearwolf');

    expect(memoCallCount).toBe(2);

    setLastName('Overlord');

    expect(memoCallCount).toBe(2);

    expect(fullName()).toBe('Spearwolf Overlord');

    for (let i = 0; i < 10; ++i) {
      fullName();
    }

    expect(memoCallCount).toBe(3);
  });
});
