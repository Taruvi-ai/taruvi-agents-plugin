# Taruvi Agents Plugin

Connect AI coding agents (Claude Code, Codex, Cursor, Kiro) to TaruviBase with skills, hooks and MCP.

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE) ![Node](https://img.shields.io/badge/node-%3E%3D18-blue)

## Install

From the root of your Taruvi Refine project:

```bash
npx @taruvi/agents-plugin install
```

`@taruvi/agents-plugin` is not on npm yet. Until it is, install from a clone:

```bash
git clone https://github.com/Taruvi-ai/taruvi-agents-plugin.git
node taruvi-agents-plugin/bin/taruvi-agents-plugin.js install --target <path-to-your-project>
```

Then open your agent in the project and say:

```text
setup taruvi
```

Setup asks you to paste the Taruvi Connect block from your app's **Settings → Connect** page and writes the app and MCP configuration from it.

## What it installs

| Path | Contents |
|------|----------|
| `.agents/skills/` | `taruvi-app-developer` (tables, policies, functions, storage) and `taruvi-refine-providers` (Refine frontends) |
| `.agents/hooks/` | Shared Taruvi hook scripts |
| `.claude/`, `.codex/`, `.cursor/`, `.kiro/` | Per-agent setup skills and configuration |

The installer does not ask for credentials, create `.env`, or write MCP secrets. It adds `.env`, the local MCP config files and agent logs to `.gitignore`.

## Options

```text
taruvi-agents-plugin install [--target <dir>] [--allow-non-template]
```

- `--target <dir>`: project to install into (default: current directory)
- `--allow-non-template`: install into a project that doesn't have the Taruvi Refine files the installer checks for (`package.json`, `src/taruviClient.ts`, `AGENTS.md`)

## Learn more

[Documentation](https://docs.taruvibase.com/) · [Website](https://taruvibase.com/)

## Contributing

Shared skills live in `src/skills/`, shared hooks in `src/hooks/`, and common setup behaviour in `src/shared/setup-core.md`. Vendor setup skills are generated from the shared core plus vendor-specific guidance. The repository root is also an Agent Plugins v1 package: `plugin.json` is the manifest, `skills/` is generated from `src/skills/`, and `mcp.json` stays empty because Agent Plugins v1 has no portable way to configure Taruvi's site MCP endpoint.

```bash
npm run build:vendor-files   # rebuild the installer payload
npm test                     # validate and run a local install into /tmp
```

## License

MIT, see [LICENSE](LICENSE).
