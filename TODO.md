# Backlog

## Open issues to work on, fix or rethink

- check TODO comments inside index.ts
- README: api at full glance: does not show all exported functions (add missing)
  - double check if _all_ exported functions are fully documented
- memos: non-lazy have default priority of 1000 which is fine, but lazy memos should have default priority of -1000 !
  - verify: does this has an effect at all? not sure..

## Resolved Issues

- ~~nested effects cleanup issue~~
  - **FIXED**: When outer effect re-runs, inner effects are now properly destroyed (with cleanup callbacks called) before being recreated.
  - Previously: Inner effects were recreated without cleanup callbacks being called.
  - Now: `destroyChildEffects()` is called in `run()` before the effect callback executes, ensuring all cleanup callbacks are properly invoked.
