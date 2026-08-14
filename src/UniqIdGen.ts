/**
 * Generator for unique, readable symbols (`Symbol('si1')`, `Symbol('ef1')`).
 *
 * The counter is process-wide monotonic by design: it only ever counts up,
 * it is never reset and never wraps, so no two symbols from the same
 * generator carry the same description for as long as the process lives.
 * That costs one integer and nothing else — the generator keeps no
 * reference to anything it hands out, so there is no growth behind the
 * number, only the theoretical ceiling at `Number.MAX_SAFE_INTEGER`.
 *
 * @internal
 */
export class UniqIdGen {
  readonly #prefix: string;
  #nextId: number;

  constructor(prefix = 'id', nextId = 1) {
    this.#prefix = prefix;
    this.#nextId = nextId;
  }

  make(): symbol {
    return Symbol(`${this.#prefix}${this.#nextId++}`);
  }
}
