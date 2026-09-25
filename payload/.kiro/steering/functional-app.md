---
inclusion: manual
---

# Functional app default

Opt in with `#functional-app` when the user wants a real app built end to end.

This is deliberately not always-on: it authorises schema creation and data seeding, so a generic
"build me an app" prompt must not pick it up implicitly.

If the user asks to create or build an app, default to a functional, production-ready app —
not a mockup, not a demo, not an MVP.

A functional Taruvi app means:

- create the Taruvi schema with MCP tools
- seed enough real data to actually use the app
- register Refine resources in `src/App.tsx`
- build real list / create / edit / show flows for core resources
- wire dashboards and pages to live data, calculated from the system's own data and kept up to
  date — never hardcoded or demo values

If the user wants a UI-only prototype, they must say so explicitly.

Confirm the target tenant and app before the first schema or seed write — see
`taruvi-preflight.md`.
