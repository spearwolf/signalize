import {connect, createSignal, destroySignal} from '.';

describe('Connection.nextValue', () => {
  it("we don't wanna the retained value - we want the next value update", async () => {
    const [sigA, setSigA] = createSignal(23);

    const [sigB] = createSignal(-77);

    const con = connect(sigA, sigB);

    expect(sigB()).toBe(23);

    let nextValue = con.nextValue();

    setSigA(42);

    await expect(nextValue).resolves.toBe(42);

    setSigA(666);

    await expect(nextValue).resolves.toBe(42);

    nextValue = con.nextValue();

    setSigA(100);

    await expect(nextValue).resolves.toBe(100);

    destroySignal(sigB, sigA);
  });

  it('reject promise if connection is destroyed', async () => {
    const [sigA] = createSignal(23);
    const [sigB] = createSignal(-77);

    const con = connect(sigA, sigB);

    expect(sigB()).toBe(23);

    const nextValue = con.nextValue();

    con.destroy();

    await expect(nextValue).rejects.toBeUndefined();

    destroySignal(sigB, sigA);
  });
});
