---
name: cursor-setup
description: Configure Taruvi for Cursor: app .env plus Cursor plugin variables guidance.
---

# cursor-setup

# Shared Taruvi Setup Flow

Use this common flow whenever the user asks to set up, connect, or configure
Taruvi for an agent.

Setup has two separate outputs:

1. **App runtime config** — `.env`, read by the Taruvi Refine app.
2. **Agent/MCP config** — vendor-specific config that lets the agent reach the
   Taruvi MCP server.

Do not treat one as a replacement for the other.

## Ask Once

Ask the user to open the app's **Connect** page in Taruvi Console:

`https://<console-host>/organizations/<org-slug>/sites/<site-slug>/apps/<app-slug>/settings?section=connect`

If those slugs are unknown, give the navigation path instead:

Console -> org -> site -> app -> **Settings -> Connect**

Tell the user to:

1. Click **Generate API Key**. Without this, the key renders as
   `<your-api-key>` and nothing authenticates.
2. Open the **Environment** tab.
3. Copy and paste the whole block:

```bash
TARUVI_SITE_URL=https://<tenant>.taruvi.cloud
TARUVI_APP_SLUG=<app-slug>
TARUVI_API_KEY=<generated-key>
```

Optionally ask for a Context7 API key, or allow the user to say `skip`.

## Parse

From the pasted block:

- `TARUVI_SITE_URL` goes into `.env` as-is.
- `TARUVI_APP_SLUG` goes into `.env` and the vendor's app-slug config.
- `TARUVI_API_KEY` goes into `.env` and the vendor's MCP auth config.
- Derive the MCP tenant by stripping `https://` and `.taruvi.cloud` from
  `TARUVI_SITE_URL`.

Reject and re-ask only when a required value is missing or unusable:

- `TARUVI_API_KEY=<your-api-key>` means the user skipped **Generate API Key**.
- Missing `TARUVI_SITE_URL`, `TARUVI_APP_SLUG`, or `TARUVI_API_KEY`.

If the user gives a bare tenant instead of a URL, expand it to
`https://<tenant>.taruvi.cloud` and confirm the derived URL before writing.

Never echo a full API key. Mask it as `...abcd`.

## Write `.env`

Write or update `.env` with:

```bash
TARUVI_SITE_URL=https://<tenant>.taruvi.cloud
TARUVI_APP_SLUG=<app-slug>
TARUVI_API_KEY=<generated-key>
```

Preserve unrelated existing `.env` keys. Ensure `.env` is gitignored. If `.env`
is tracked or was committed with a real key, tell the user to rotate the key.

After changing `.env`, tell the user to restart the dev server. Vite reads env
values at startup; hot reload is not enough.

## Safety Rules

- Never commit real Taruvi or Context7 credentials.
- Never write secrets into example/template files.
- Never query or mutate Taruvi until the agent's MCP connection is confirmed to
  point at the intended tenant and app.
- If tool results mention unexpected datatables or an unexpected app, stop and
  ask the user to reconnect or reconfigure before proceeding.


## Cursor-Specific Output

Use Cursor plugin conventions.

- Keep `mcp.json` as a plugin template with `${TARUVI_TENANT}`,
  `${TARUVI_API_KEY}`, `${TARUVI_APP_SLUG}`, and optional
  `${CONTEXT7_API_KEY}` placeholders.
- Declare those names in `.cursor-plugin/plugin.json` `variables`.
- Tell the user to set real values in Cursor Settings -> Plugins ->
  taruvi-plugin -> Configure.
- Do not replace placeholders in committed Cursor plugin files.
