# Taruvi Plugin — Codex

Plugin root for Codex. See the [repo README](../README.md) for multi-host overview.

Install this `codex/` directory via Codex plugins. Run **codex-setup** and fill local `.mcp.json` placeholders without committing secrets.

Project-local config is usually written to `.codex/.mcp.json`. After that file changes, restart or
reload the Codex plugin session before verifying tools; MCP servers are discovered at session load,
so a running session can have valid config on disk while `mcp__taruvi__...` tools are still absent.
