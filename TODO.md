# Skills Backlog

## Open issues to work on, fix or rethink

- nested effects cleanup issue
  - Critical behavior: When outer effect re-runs, inner effects are recreated, not re-run.
  - inner effects are recreated
  - only outer-effect run the destroy hook
