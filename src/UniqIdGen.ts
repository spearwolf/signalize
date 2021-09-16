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
