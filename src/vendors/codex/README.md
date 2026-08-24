# Taruvi Plugin — Codex

Plugin root for Codex. See the [repo README](../README.md) for multi-host overview.

Install this `codex/` directory via Codex plugins. Run **codex-setup** to configure the project-local Taruvi MCP connection without committing secrets.

The installer copies `.codex/skills` and `.codex/.codex-plugin/plugin.json` into the workspace, but
that is not the same thing as enabling a Codex plugin for the running session. Workspace skills can
load from the project while plugin MCP servers remain absent.

For native `mcp__taruvi__...` tools, configure Taruvi in Codex's active MCP config. Current Codex
clients store MCP servers in `config.toml`; use user-level `~/.codex/config.toml` for personal
servers or project-level `.codex/config.toml` in a trusted project for repo-specific servers.

The bundled plugin `.mcp.json` only starts Context7, which has no Taruvi tenant secret. Taruvi is
project-specific, so `codex-setup` writes real values to ignored local config instead of keeping
placeholder secrets in the plugin package.

After `.codex/config.toml` changes, restart or reload the Codex session before verifying tools; MCP
servers are discovered at session load, so a running session can have valid config on disk while
`mcp__taruvi__...` tools are still absent.
