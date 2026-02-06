# Backlog

## Open issues to work on, fix or rethink

- check TODO comments inside index.ts
- README: api at full glance: does bot show all exported functions (add missing)
  - check if _all_ exported functions are fully documented

## Resolved Issues

- ~~nested effects cleanup issue~~
  - **FIXED**: When outer effect re-runs, inner effects are now properly destroyed (with cleanup callbacks called) before being recreated.
  - Previously: Inner effects were recreated without cleanup callbacks being called.
  - Now: `destroyChildEffects()` is called in `run()` before the effect callback executes, ensuring all cleanup callbacks are properly invoked.
