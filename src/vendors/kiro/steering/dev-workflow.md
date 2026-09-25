# Taruvi dev workflow

Operational rules for working in a Taruvi Refine template. These are guard rails, not a build
policy — the "build a full app" default lives in `functional-app.md` and is opt-in.

## Investigate before building

- Verify tables exist with the `get_datatable_schema` MCP tool before wiring a resource.
- Resource names must match datatable names exactly.
- Create referenced tables before the tables that point at them; foreign keys use integer id
  fields with `{ resource: "table_name", fields: "id" }`.

## Dev server

Assume a dev server is already running with hot reload. Do not start `npm run dev`, and only run
builds when explicitly asked.

## Browser errors

When the user reports a browser problem and the app has a `logs/frontend.ndjson` file, read it
instead of asking them to open DevTools. It is NDJSON — one event per line with `timestamp`,
`source`, `text`, `session_id`, and `method`/`url`/`status` for network errors. Secrets are
redacted server-side.

After shipping a fix, truncate it (`: > logs/frontend.ndjson`) before asking for a re-test so the
next reproduction is unambiguous. If the file is missing, no errors have been captured yet.
