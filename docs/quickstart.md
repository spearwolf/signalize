# Getting Started

This guide will help you get up and running with `@spearwolf/signalize` in minutes.

## Installation

Install the package using your preferred package manager:

```shell
npm install @spearwolf/signalize
```

or

```shell
pnpm add @spearwolf/signalize
```

or

```shell
yarn add @spearwolf/signalize
```

## Hello World

Let's create a simple "Counter" example to demonstrate the basics of Signals and Effects.

Create a file named `index.ts` (or `index.js`) and add the following code:

```typescript
import { createSignal, createEffect } from '@spearwolf/signalize';

// 1. Create a signal
// This holds our state. We start with a value of 0.
const count = createSignal(0);

// 2. Create an effect
// This function will run immediately, and then re-run whenever `count` changes.
createEffect(() => {
  // Reading count.get() automatically subscribes this effect to the signal.
  console.log(`The count is now: ${count.get()}`);
});
// Output: "The count is now: 0"

// 3. Update the signal
// Changing the value automatically triggers the effect.
console.log('Updating count...');
count.set(1);
// Output: "The count is now: 1"

console.log('Updating count again...');
count.set(5);
// Output: "The count is now: 5"
```

### How it works

1.  **`createSignal(0)`**: We create a reactive container holding the number `0`.
2.  **`createEffect(...)`**: We define a function. Inside this function, we call `count.get()`.
3.  **Automatic Subscription**: Because we read `count` inside the effect, the library knows that this effect *depends* on `count`.
4.  **Reactivity**: When we call `count.set(1)`, the library notifies the effect, and it runs again automatically.

## Using with Classes (Optional)

If you prefer an object-oriented approach, you can use decorators.

> **Note:** You need to enable `experimentalDecorators: false` in your `tsconfig.json` to use standard decorators, or ensure your environment supports stage-3 decorators.

```typescript
import { createEffect } from '@spearwolf/signalize';
import { signal } from '@spearwolf/signalize/decorators';

class Counter {
  @signal() accessor value = 0;

  increment() {
    this.value++;
  }
}

const counter = new Counter();

createEffect(() => {
  console.log(`Counter value: ${counter.value}`);
});
// Output: "Counter value: 0"

counter.increment();
// Output: "Counter value: 1"
```

## Next Steps

Now that you've seen the basics, dive deeper into the library:

- Read the [Developer Guide](guide.md) for a comprehensive tour of all features.
- Check out the [Full API Reference](full-api.md) for detailed documentation.
