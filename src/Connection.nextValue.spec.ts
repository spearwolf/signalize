import {connect, createSignal, destroySignal} from '.';

describe('Connection.nextValue', () => {
  it("we don't wanna the retained value - we want the next value update", async () => {
    const [sigA, setSigA] = createSignal(23);

    const [sigB] = createSignal(-77);

    const con = connect(sigA, sigB);

    expect(sigB()).toBe(23);

    const nextValue = con.nextValue();

    setSigA(42);

    expect(await nextValue).toBe(42);

    destroySignal(sigB, sigA);
  });
});
