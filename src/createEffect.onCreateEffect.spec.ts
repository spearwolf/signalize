import {createEffect, onCreateEffect} from './createEffect';

import {Effect} from './Effect';

describe('onCreateEffect', () => {
  it('creating an effect triggers a on-create-effect event', () => {
    const mock = jest.fn();

    const unsubscribe = onCreateEffect(mock);

    createEffect(() => {});

    expect(mock).toBeCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBeInstanceOf(Effect);

    unsubscribe();

    expect(mock).toBeCalledTimes(1);
  });
});
