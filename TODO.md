# Backlog

## Open issues to work on, fix or rethink

## Resolved Issues

- ~~README: api at full glance: does not show all exported functions (add missing)~~
  - ~~double check if _all_ exported functions are fully documented~~
  - **FIXED**: Added missing "Object Signals" section to README "API at a Glance" with `destroyObjectSignals`, `findObjectSignalByName`, `findObjectSignalNames`, `findObjectSignals`. Full API (`docs/full-api.md`) was already complete.

- ~~memos: non-lazy have default priority of 1000 which is fine, but lazy memos should have default priority of -1000 !~~
  - ~~verify: does this has an effect at all? not sure..~~
  - Note: this has no effect at all, because lazy memos are _not_ called by dependencies, only by the user, so priority does not matter. So this is not an issue at all, and lazy memos can have default priority of 1000 as well.
- ~~check TODO comments inside index.ts~~
- ~~nested effects cleanup issue~~
  - **FIXED**: When outer effect re-runs, inner effects are now properly destroyed (with cleanup callbacks called) before being recreated.
  - Previously: Inner effects were recreated without cleanup callbacks being called.
  - Now: `destroyChildEffects()` is called in `run()` before the effect callback executes, ensuring all cleanup callbacks are properly invoked.
