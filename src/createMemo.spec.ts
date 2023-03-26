import {createMemo} from './createMemo';
import {createSignal} from './createSignal';

describe('createMemo', () => {
  it('works as expected (lazy by default)', () => {
    const [firstName, setFirstName] = createSignal<string>();
    const [lastName, setLastName] = createSignal<string>();

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
