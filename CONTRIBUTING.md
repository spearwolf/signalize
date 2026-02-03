# Contributing to @spearwolf/signalize

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js (see `.nvmrc` for version)
- pnpm package manager

### Setup

```shell
# Clone the repository
git clone https://github.com/spearwolf/signalize.git
cd signalize

# Install dependencies
pnpm install
```

## Development Workflow

### Commands

| Command        | Description                                  |
| -------------- | -------------------------------------------- |
| `pnpm cbt`     | **Primary command** - clean + compile + test |
| `pnpm test`    | Run tests only (Jest via ts-jest)            |
| `pnpm lint`    | Run ESLint                                   |
| `pnpm compile` | TypeScript compilation only                  |
| `pnpm clean`   | Remove build artifacts                       |

**Always run `pnpm cbt` after making changes** to ensure build, linting, and tests pass.

### Project Structure

```
src/
├── index.ts           # Public API exports
├── constants.ts       # Symbols ($signal, $effect, RECALL, etc.)
├── types.ts           # TypeScript interfaces
├── Signal.ts          # Signal class (public wrapper)
├── createSignal.ts    # SignalImpl class, createSignal()
├── Effect.ts          # Effect class (public wrapper)
├── EffectImpl.ts      # Core effect implementation
├── effects.ts         # createEffect(), lifecycle hooks
├── createMemo.ts      # createMemo()
├── link.ts            # link(), unlink()
├── SignalLink.ts      # SignalLink classes
├── SignalGroup.ts     # SignalGroup class
├── SignalAutoMap.ts   # SignalAutoMap class
├── batch.ts           # batch() function
├── bequiet.ts         # beQuiet(), isQuiet()
├── hibernate.ts       # hibernate()
├── decorators.ts      # @signal, @memo decorators
└── *.spec.ts          # Test files (adjacent to implementation)
```

## Making Changes

### Adding a New Feature

1. **Plan** - Understand existing patterns by reading related source files
2. **Implement** - Follow existing code style and patterns
3. **Test** - Add tests in a corresponding `*.spec.ts` file
4. **Document** - Update documentation if it affects the public API
5. **Verify** - Run `pnpm cbt` to ensure everything passes

### Common Patterns

**Adding a new Signal method:**

1. Add method signature to `types.ts` (if interface-based)
2. Implement in `SignalImpl` class in `createSignal.ts`
3. Expose via `Signal` class in `Signal.ts`
4. Export from `index.ts` if standalone function
5. Add tests in `createSignal.spec.ts`

**Adding a new Effect option:**

1. Update `EffectOptions` interface in `EffectImpl.ts`
2. Handle option in `EffectImpl.constructor()` or `createEffect()`
3. Implement logic in `EffectImpl` class
4. Add tests in `effects.spec.ts`

**Adding a new utility function:**

1. Create new file `src/myutil.ts`
2. Export from `src/index.ts`
3. Create `src/myutil.spec.ts` with tests
4. Run `pnpm cbt`

## Testing

### Conventions

- **Test files:** `*.spec.ts` adjacent to implementation files
- **Framework:** Jest (via ts-jest)
- **Pattern:** Each public function should have corresponding tests

### Running Tests

```shell
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run specific test file
pnpm test -- createSignal.spec.ts
```

### Testing Tips

- Use `getSignalsCount()`, `getEffectsCount()`, `getLinksCount()` to verify cleanup
- Always destroy signals/effects in tests to prevent leaks
- Use `SignalGroup.clear()` in `afterEach` for complex test setups

## Code Style

- **ESLint** enforces coding rules - run `pnpm lint`
- Follow existing patterns in the codebase
- Use TypeScript strict mode features appropriately
- Prefer explicit types for public API, inference for internals

## Documentation

When changing the public API:

1. Update `README.md` for user-facing changes
2. Update `docs/` files for comprehensive documentation
3. Update `CHANGELOG.md` for notable changes

### Documentation Structure

| Location              | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `README.md`           | Quick overview and getting started           |
| `docs/guide.md`       | Comprehensive developer guide                |
| `docs/full-api.md`    | Complete API reference                       |
| `docs/cheat-sheet.md` | Quick reference                              |
| `AGENTS.md`           | AI assistant context (internal architecture) |

## Pull Requests

1. **Fork** the repository
2. **Create a branch** for your changes
3. **Make changes** following the guidelines above
4. **Run `pnpm cbt`** to verify everything passes
5. **Submit a PR** with a clear description of changes

### PR Guidelines

- Keep PRs focused on a single concern
- Include tests for new functionality
- Update documentation for API changes
- Write clear commit messages explaining the "why"

## Reporting Issues

When reporting bugs:

1. Check if the issue already exists
2. Provide a minimal reproduction case
3. Include your environment details (Node version, etc.)
4. Describe expected vs actual behavior

## Questions?

- Open an issue for questions or discussions
- Check existing documentation in `docs/`
- Review test files for usage examples

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
