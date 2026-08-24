# Taruvi Plugin — Cursor

Plugin root for Cursor. See the [repo README](../README.md) for multi-host overview.

```bash
cp -a /path/to/taruvi-plugin/cursor ~/.cursor/plugins/local/taruvi-plugin
```

Then **Developer: Reload Window**.

## Configure MCP (interactive)

1. Run the **taruvi-setup** agent, or the `/setup-taruvi` command, or ask “setup taruvi” (loads **cursor-setup** skill).
2. It asks once: generate an API key on the app’s **Connect** page, then paste the whole
   `TARUVI_SITE_URL` / `TARUVI_APP_SLUG` / `TARUVI_API_KEY` block back (plus optional Context7).
3. Paste values into **Customize → Plugins → taruvi-plugin → Configure** (do not commit secrets into `mcp.json`).
4. Reload if needed; approve MCP servers; verify with “List the datatables in this app.”

The plugin `mcp.json` includes the Taruvi HTTP server template. Cursor resolves
`TARUVI_TENANT`, `TARUVI_API_KEY`, and `TARUVI_APP_SLUG` from plugin variables, then connects to
`https://<tenant>.taruvi.cloud/mcp/` with `Authorization` and `X-App-Slug` headers. If the config
was changed while a session/window was already open, reload before checking whether Taruvi tools
exist.

## What's Cursor-specific

| Piece | Notes |
|---|---|
| `.cursor-plugin/plugin.json` | Cursor plugin manifest. Declares variables for user-specified secrets and explicitly points to skills, rules, agents, commands, and MCP config. |
| `mcp.json` | Placeholder-only MCP template. Cursor substitutes `${VAR}` values from plugin Configure. |
| `rules/` | Cursor `.mdc` project rules. These complement the shared Agent Skills with lightweight routing guidance. |
| `commands/` | Markdown slash commands such as `/setup-taruvi`. |
| `agents/` | Cursor-specific setup agent instructions. |
