# Taruvi Plugin — Kiro

Plugin root for Kiro. See the repo README for the multi-host overview, and
[`INSTRUCTIONS.md`](INSTRUCTIONS.md) for step-by-step install, credential setup, and a test matrix.

```
kiro/
├── .kiro-plugin/plugin.json   # manifest
├── mcp.json                   # MCP servers (placeholders — do not commit secrets)
├── scripts/                   # created during install as a shared-script symlink
├── skills/                    # kiro-setup + shared product skills
├── steering/                  # always-on + fileMatch guidance
└── hooks/                     # event-driven automation
```

## Install

Copy this directory into your Kiro plugins folder:

```bash
cp -a /path/to/taruvi-plugin/kiro ~/.kiro/plugins/local/taruvi-plugin
```

Or wire the pieces from a built installer payload into a workspace directly:

```bash
PAYLOAD=/path/to/taruvi-agents-plugin/payload

mkdir -p /path/to/project/.agents/hooks
cp -a "$PAYLOAD/.agents/hooks/taruvi" /path/to/project/.agents/hooks/
cp -a "$PAYLOAD/.kiro/steering/."  /path/to/project/.kiro/steering/
cp -a "$PAYLOAD/.kiro/hooks/."     /path/to/project/.kiro/hooks/
cp -a "$PAYLOAD/.kiro/skills/."    /path/to/project/.kiro/skills/
cp    "$PAYLOAD/.kiro/mcp.json"    /path/to/project/.kiro/settings/mcp.json
ln -s ../.agents/hooks/taruvi      /path/to/project/.kiro/scripts
```

## Configure MCP (interactive)

1. Ask "setup taruvi" to load the **kiro-setup** skill.
2. It asks once: generate an API key on the app's **Connect** page, then paste the whole
   `TARUVI_SITE_URL` / `TARUVI_APP_SLUG` / `TARUVI_API_KEY` block back (plus optional Context7).
3. The skill writes values into `.kiro/settings/mcp.json` (workspace) using
   Kiro's HTTP transport shape: `type: "http"`, URL `https://<tenant>.taruvi.cloud/mcp/`,
   and static `Authorization` + `X-App-Slug` headers. Kiro merges workspace config over
   `~/.kiro/settings/mcp.json`.
4. Reconnect from the **MCP Server** view in the Kiro feature panel — no restart needed.
5. Verify with "List the datatables in this app."

**Keep `.kiro/settings/mcp.json` gitignored.** Unlike Claude Code (`userConfig`) and Cursor
(`variables`), Kiro has no plugin-level secret prompt, so keys land in a local config file.

## What's Kiro-specific

| Piece | Notes |
|---|---|
| `steering/` | Kiro's guidance mechanism. `taruvi-preflight.md` and `functional-app.md` are always on; `refine-v5.md` and `ui-guidelines.md` load conditionally via `inclusion: fileMatch`. |
| `hooks/` | Setup and safety automation, including secret checks and MCP scope verification. |
| `mcp.json` | Kiro shape — `type: "http"`, `disabled`, `autoApprove`, `url` + `headers` for HTTP servers. |
| `scripts/` | Symlink to shared `.agents/hooks/taruvi` scripts, used by hooks and steering to prevent half-configured or inherited MCP connections. |

Kiro also reads a root `AGENTS.md` automatically, so apps scaffolded from the
`agents-md-template.md` reference keep working without duplication. Steering adds conditional
loading that a single `AGENTS.md` cannot express.

## Subagents

Guidance that references an `Explore` subagent maps to Kiro's built-in **context-gatherer**
subagent — no extra config needed.
