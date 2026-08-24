# Taruvi Plugin — Codex

Plugin root for Codex. See the [repo README](../README.md) for multi-host overview.

Install this `codex/` directory via Codex plugins. Run **codex-setup** and fill local `.mcp.json` placeholders without committing secrets.

The installer copies `.codex/skills` and `.codex/.codex-plugin/plugin.json` into the workspace, but
that is not the same thing as enabling a Codex plugin for the running session. Workspace skills can
load from the project while plugin MCP servers remain absent.

For native `mcp__taruvi__...` tools, the Codex plugin must be installed/enabled so its manifest
loads `.codex/.mcp.json`, or the Taruvi MCP server must be configured in Codex's active MCP config.
After `.codex/.mcp.json` changes, restart or reload the Codex plugin session before verifying tools;
MCP servers are discovered at session load, so a running session can have valid config on disk while
`mcp__taruvi__...` tools are still absent.
