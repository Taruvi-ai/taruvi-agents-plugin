# Taruvi Agents Plugin

Source of truth for Taruvi agent support across Claude, Codex, Cursor, and
Kiro.

## Install into a Taruvi template

From a cloned Taruvi hacks template:

```bash
npx @taruvi/agents-plugin install
```

The installer writes safe agent support files into the current project:

- `.agents/skills/`
- `.claude/`
- `.codex/`
- `.cursor/`
- `.kiro/`

It does not ask for credentials, does not create `.env`, and does not write
local MCP secrets. After install, open your preferred agent and say:

```text
setup taruvi
```

That later setup flow writes app and MCP configuration from the Taruvi Connect
block that the user pastes.

## Develop

Shared product skills live once under `src/skills/`. Common setup behavior lives
in `src/shared/setup-core.md`. Vendor setup skills are generated from that shared
core plus vendor-specific guidance.

Build the installer payload:

```bash
npm run build:vendor-files
```

Run a local install test:

```bash
node bin/taruvi-agents-plugin.js install --target /tmp/taruvi-agents-plugin-test --force --allow-non-template
```
