# Skills Backlog

## Open issues to work on, fix or rethink

_No open issues at this time._

## Resolved Issues

- ~~nested effects cleanup issue~~
  - **FIXED**: When outer effect re-runs, inner effects are now properly destroyed (with cleanup callbacks called) before being recreated.
  - Previously: Inner effects were recreated without cleanup callbacks being called.
  - Now: `destroyChildEffects()` is called in `run()` before the effect callback executes, ensuring all cleanup callbacks are properly invoked.
