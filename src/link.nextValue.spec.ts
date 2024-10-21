import {createSignal, destroySignal, link} from './index.js';

describe('link.nextValue', () => {
  it("we don't wanna the retained value - we want the next value update", async () => {
    const a = createSignal(23);
    const {get: getB} = createSignal(-77);

    const con = link(a, getB);

    expect(getB()).toBe(23);

    let nextValue = con.nextValue();

    a.set(42);

    await expect(nextValue).resolves.toBe(42);

    a.set(666);

    await expect(nextValue).resolves.toBe(42); // the value of the promise that has already been fulfilled should not change

    nextValue = con.nextValue();

    a.set(100);

    await expect(nextValue).resolves.toBe(100);

    destroySignal(getB, a);
  });

  it('reject promise if link is destroyed', async () => {
    const {get: getA} = createSignal(23);
    const b = createSignal(-77);

    const con = link(getA, b);

    expect(b.value).toBe(23);

    const nextValue = con.nextValue();

    con.destroy();

    await expect(nextValue).rejects.toBeUndefined();

    destroySignal(b, getA);
  });
});
