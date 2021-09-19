import {createMemo} from './createMemo';
import {createSignal} from './createSignal';

describe('createMemo', () => {
  it('works as expected', () => {
    const [firstName, setFirstName] = createSignal<string>();
    const [lastName, setLastName] = createSignal<string>();

    const fullName = createMemo(() => {
      const first = firstName() ?? '';
      return lastName() ? `${first} ${lastName()}` : first;
    });

    expect(fullName()).toBe('');

    setFirstName('Spearwolf');

    expect(fullName()).toBe('Spearwolf');

    setLastName('Overlord');

    expect(fullName()).toBe('Spearwolf Overlord');
  });
});
