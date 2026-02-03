![signalize hero](https://github.com/spearwolf/signalize/blob/main/hero.gif?raw=true)

![npm (scoped)](https://img.shields.io/npm/v/%40spearwolf/signalize)
![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/spearwolf/signalize/main.yml)
![GitHub](https://img.shields.io/github/license/spearwolf/signalize)

`@spearwolf/signalize` - A lightweight JavaScript library for signals & effects.
Reactive programming, made simple. Works in Browser & Node.js.
Type-safe. Fast. No framework lock-in.

# Signals and Effects for All

`@spearwolf/signalize` is a JavaScript library for creating fine-grained reactivity through **signals** and **effects**.

- **Standalone** - Framework agnostic, works anywhere JavaScript runs
- **Side-effect free** - Targets ES2023+ environments
- **TypeScript-first** - Written in TypeScript v5 with full type support
- **Modern decorators** - Optional [TC39 decorators](https://github.com/tc39/proposal-decorators) for class-based APIs

> [!NOTE]
> Reactivity is the secret sauce to building modern, dynamic web apps.
> `@spearwolf/signalize` makes it easy. No frameworks, no boilerplate, just pure reactivity.

## Quick Start

### Installation

```shell
npm install @spearwolf/signalize
```

### Hello World

```typescript
import {createSignal, createEffect} from '@spearwolf/signalize';

// Create a signal with an initial value
const count = createSignal(0);

// Create an effect that runs whenever `count` changes
createEffect(() => {
  console.log(`The count is now: ${count.get()}`);
});
// => "The count is now: 0"

// Update the signal
count.set(5);
// => "The count is now: 5"

count.set(10);
// => "The count is now: 10"
```

That's it! No extra boilerplate, no framework dependencies. Just pure, simple reactivity.

## Core Concepts

The library revolves around four main primitives:

### Signals

Reactive values that notify dependents when changed. Think of them as reactive variables.

```typescript
const name = createSignal('Alice');
console.log(name.get()); // Read with tracking
console.log(name.value); // Read without tracking
name.set('Bob'); // Write
```

### Effects

Functions that automatically re-run when their signal dependencies change.

```typescript
createEffect(() => {
  // Automatically re-runs when `name` changes
  console.log(`Hello, ${name.get()}!`);
});
```

### Memos

Computed signals - cached derived values that update when dependencies change.

```typescript
const firstName = createSignal('John');
const lastName = createSignal('Doe');

const fullName = createMemo(() => `${firstName.get()} ${lastName.get()}`);
console.log(fullName()); // => "John Doe"
```

### Links

Explicit one-way data flow connections between signals. Inspired by visual programming tools like Unreal Engine Blueprints.

```typescript
const source = createSignal(10);
const target = createSignal(0);

link(source, target);
console.log(target.value); // => 10

source.set(42);
console.log(target.value); // => 42
```

## Class-based API with Decorators

For those who prefer object-oriented patterns:

```typescript
import {signal, memo} from '@spearwolf/signalize/decorators';

class Counter {
  @signal() accessor value = 0;

  @memo()
  doubled() {
    return this.value * 2;
  }

  increment() {
    this.value++;
  }
}
```

> [!IMPORTANT]
> The decorator API is still in the early stages of development.
> It only uses the new JavaScript standard decorators, not the legacy TypeScript ones.

## Documentation

For comprehensive documentation, see the **[docs/](./docs/)** folder:

| Document                                 | Description                         |
| ---------------------------------------- | ----------------------------------- |
| [Introduction](./docs/introduction.md)   | Overview and key features           |
| [Getting Started](./docs/quickstart.md)  | Installation and first steps        |
| [Developer Guide](./docs/guide.md)       | Comprehensive guide to all features |
| [Full API Reference](./docs/full-api.md) | Complete API documentation          |
| [Cheat Sheet](./docs/cheat-sheet.md)     | Quick reference for all APIs        |

## API at a Glance

### Signals

`createSignal`, `destroySignal`, `isSignal`, `getSignalsCount`, `muteSignal`, `unmuteSignal`, `touch`, `value`

### Effects

`createEffect`, `getEffectsCount`, `onCreateEffect`, `onDestroyEffect`

### Memos

`createMemo`

### Links

`link`, `unlink`, `getLinksCount`

### Groups & Collections

`SignalGroup`, `SignalAutoMap`

### Utilities

`batch`, `beQuiet`, `isQuiet`, `hibernate`

### Decorators (from `@spearwolf/signalize/decorators`)

`@signal`, `@memo`

## Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you want to contribute code or documentation, please open a pull request.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

This project is licensed under the Apache-2.0 License. See the [LICENSE](./LICENSE) file for details.

---

The hero image above was created at the request of spearwolf using OpenAI's DALL-E and guided by ChatGPT. It was then animated by KLING AI and converted by Ezgif.com.
