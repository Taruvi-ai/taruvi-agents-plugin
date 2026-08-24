#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$REPO_ROOT/src"
PAYLOAD_DIR="$REPO_ROOT/payload"
PORTABLE_SKILLS_DIR="$REPO_ROOT/skills"
SETUP_CORE="$SRC_DIR/shared/setup-core.md"

copy_dir() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  cp -a "$src" "$dest"
}

reset_payload() {
  rm -rf "$PAYLOAD_DIR"
  mkdir -p "$PAYLOAD_DIR/.agents/skills"
}

sync_portable_skills() {
  rm -rf "$PORTABLE_SKILLS_DIR"
  mkdir -p "$PORTABLE_SKILLS_DIR"

  copy_dir "$SRC_DIR/skills/taruvi-app-developer" "$PORTABLE_SKILLS_DIR/taruvi-app-developer"
  copy_dir "$SRC_DIR/skills/taruvi-refine-providers" "$PORTABLE_SKILLS_DIR/taruvi-refine-providers"
}

copy_sources() {
  copy_dir "$SRC_DIR/skills/taruvi-app-developer" "$PAYLOAD_DIR/.agents/skills/taruvi-app-developer"
  copy_dir "$SRC_DIR/skills/taruvi-refine-providers" "$PAYLOAD_DIR/.agents/skills/taruvi-refine-providers"

  copy_dir "$SRC_DIR/vendors/claude/." "$PAYLOAD_DIR/.claude"
  copy_dir "$SRC_DIR/vendors/codex/." "$PAYLOAD_DIR/.codex"
  copy_dir "$SRC_DIR/vendors/cursor/." "$PAYLOAD_DIR/.cursor"
  copy_dir "$SRC_DIR/vendors/kiro/." "$PAYLOAD_DIR/.kiro"

  rm -rf \
    "$PAYLOAD_DIR/.kiro/settings" \
    "$PAYLOAD_DIR/.codex/log" \
    "$PAYLOAD_DIR/.codex/.personality_migration" \
    "$PAYLOAD_DIR/.codex/config.toml"
}

write_setup_skill() {
  local vendor="$1"
  local skill_dir="$2"
  local name="$3"
  local description="$4"

  mkdir -p "$skill_dir"
  {
    printf '%s\n' '---'
    printf 'name: %s\n' "$name"
    printf 'description: %s\n' "$description"
    printf '%s\n\n' '---'
    printf '# %s\n\n' "$name"
    cat "$SETUP_CORE"
    printf '\n\n## %s-Specific Output\n\n' "$vendor"
    case "$vendor" in
      Claude)
        cat <<'EOF'
Use Claude Code plugin conventions.

- Prefer plugin `userConfig` values when the plugin is installed through Claude.
- Project-local `.claude/skills` can load even when the Claude plugin was not
  enabled at startup. If `claude mcp list` shows no Taruvi server, the fix is
  to exit and relaunch Claude Code with the plugin loaded, for example
  `claude --plugin-dir /path/to/project/.claude`, then configure plugin
  `userConfig`.
- If writing a project-local MCP file is required, write `.claude/.mcp.json`.
- Use `${user_config.taruvi_tenant}`, `${user_config.taruvi_api_key}`,
  `${user_config.taruvi_app_slug}`, and `${user_config.context7_api_key}` only
  as placeholders in plugin-owned config.
- After changing plugin MCP config, tell the user to run `/reload-plugins` or
  restart Claude Code.
EOF
        ;;
      Codex)
        cat <<'EOF'
Use Codex plugin conventions.

- Workspace `.codex/skills` can load even when the Codex plugin itself is not
  installed/enabled for the running session. If Taruvi tools are absent, the
  Taruvi MCP server was not discovered by Codex.
- Configure Taruvi in Codex's active MCP config. Prefer project-local
  `.codex/config.toml` for a trusted Taruvi app workspace, or user-level
  `~/.codex/config.toml` for a personal reusable connection.
- If writing project-local MCP config, write `.codex/config.toml` and keep it
  gitignored. Do not write real Taruvi credentials to `.codex/.mcp.json`; the
  plugin-bundled `.mcp.json` is only for secret-free bundled servers.
- Keep bundled plugin files secret-free. Use placeholders in templates and real
  values only in local ignored config.
- A Taruvi streamable HTTP config needs `url = "https://<tenant>.taruvi.cloud/mcp/"`
  and `http_headers` containing `Authorization = "Api-Key <generated-key>"` and
  `X-App-Slug = "<app-slug>"`.
- After changing MCP config, tell the user to restart or reload the relevant
  Codex/ChatGPT session before verifying tools.
EOF
        ;;
      Cursor)
        cat <<'EOF'
Use Cursor plugin conventions.

- Keep `mcp.json` as a plugin template with `${TARUVI_TENANT}`,
  `${TARUVI_API_KEY}`, `${TARUVI_APP_SLUG}`, and optional
  `${CONTEXT7_API_KEY}` placeholders.
- Declare those names in `.cursor-plugin/plugin.json` `variables`.
- Tell the user to set real values in Cursor Settings -> Plugins ->
  taruvi-plugin -> Configure.
- Do not replace placeholders in committed Cursor plugin files.
EOF
        ;;
      Kiro)
        cat <<'EOF'
Use Kiro workspace conventions.

- Write real MCP credentials only to `.kiro/settings/mcp.json`.
- Keep `.kiro/mcp.json` as the secret-free plugin template.
- The `taruvi` MCP server must use Kiro's HTTP transport shape:

  ```json
  {
    "mcpServers": {
      "taruvi": {
        "type": "http",
        "url": "https://<tenant>.taruvi.cloud/mcp/",
        "headers": {
          "Authorization": "Api-Key <generated-key>",
          "X-App-Slug": "<app-slug>"
        },
        "disabled": false,
        "autoApprove": []
      }
    }
  }
  ```

- Do not use `/api/apps/<app-slug>/mcp/`; Taruvi's MCP endpoint is `/mcp/`
  and the app context belongs in the `X-App-Slug` header.
- After writing `.env` or `.kiro/settings/mcp.json`, set both files to owner
  read/write only (`chmod 600 .env .kiro/settings/mcp.json` when they exist).
- Kiro merges config with precedence `user < workspace`; confirm the workspace
  connection before any Taruvi MCP mutation.
- After writing `.kiro/settings/mcp.json`, tell the user to reconnect the
  `taruvi` MCP server from Kiro's MCP Server view or restart the session.
EOF
        ;;
    esac
  } > "$skill_dir/SKILL.md"
}

generate_setup_skills() {
  write_setup_skill \
    "Claude" \
    "$PAYLOAD_DIR/.claude/skills/claude-setup" \
    "claude-setup" \
    "Configure Taruvi for Claude Code: app .env plus Claude plugin MCP/userConfig guidance."

  write_setup_skill \
    "Codex" \
    "$PAYLOAD_DIR/.codex/skills/codex-setup" \
    "codex-setup" \
    "Configure Taruvi for Codex: app .env plus Codex plugin MCP guidance."

  write_setup_skill \
    "Cursor" \
    "$PAYLOAD_DIR/.cursor/skills/cursor-setup" \
    "cursor-setup" \
    "Configure Taruvi for Cursor: app .env plus Cursor plugin variables guidance."

  write_setup_skill \
    "Kiro" \
    "$PAYLOAD_DIR/.kiro/skills/kiro-setup" \
    "kiro-setup" \
    "Configure Taruvi for Kiro: app .env plus Kiro workspace MCP guidance."
}

assert_clean_payload() {
  local forbidden=(
    ".kiro/settings/mcp.json"
    ".codex/log/codex-tui.log"
    ".codex/.personality_migration"
    ".codex/config.toml"
  )

  for rel in "${forbidden[@]}"; do
    if [ -e "$PAYLOAD_DIR/$rel" ]; then
      echo "Forbidden runtime file in payload: $rel" >&2
      exit 1
    fi
  done

  if grep -R -nE 'ctx7sk-[A-Za-z0-9_-]+|Api-Key [A-Za-z0-9]{20,}' "$PAYLOAD_DIR" >/tmp/taruvi-agents-plugin-secret-scan.txt 2>/dev/null; then
    cat /tmp/taruvi-agents-plugin-secret-scan.txt >&2
    echo "Payload appears to contain a real secret." >&2
    exit 1
  fi
}

reset_payload
sync_portable_skills
copy_sources
generate_setup_skills
assert_clean_payload

echo "Built vendor payload at $PAYLOAD_DIR"
