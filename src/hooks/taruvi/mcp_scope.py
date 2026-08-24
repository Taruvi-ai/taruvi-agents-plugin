#!/usr/bin/env python3
import argparse
import hashlib
import json
import sys
from pathlib import Path
from urllib.parse import urlparse


TARUVI_TOOL_HINTS = (
    "get_datatable_schema",
    "create_update_schema",
    "datatable_data",
    "execute_raw_sql",
    "manage_policies",
    "manage_roles",
    "manage_function",
)


def load_json(path):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as error:
        print(f"Invalid JSON: {path}: {error}", file=sys.stderr)
        sys.exit(2)


def tenant_from_url(url):
    parsed = urlparse(url or "")
    host = parsed.netloc or parsed.path
    suffix = ".taruvi.cloud"
    if host.endswith(suffix):
        return host[: -len(suffix)]
    return host.split(".")[0] if host else ""


def server_app(server):
    headers = server.get("headers", {})
    return headers.get("X-App-Slug") or server.get("env", {}).get("TARUVI_APP_SLUG") or ""


def is_usable_taruvi(name, server):
    if "taruvi" in name.lower():
        return True
    url = str(server.get("url", ""))
    if "taruvi" in url or url.endswith("/mcp/"):
        return True
    approvals = server.get("autoApprove", [])
    return any(tool in approvals for tool in TARUVI_TOOL_HINTS)


def server_fingerprint(server):
    public_shape = {
        "type": server.get("type"),
        "url": server.get("url"),
        "app": server_app(server),
    }
    raw = json.dumps(public_shape, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def collect(scope, path):
    config = load_json(path)
    servers = config.get("mcpServers", {})
    result = []
    for name, server in servers.items():
        if isinstance(server, dict) and is_usable_taruvi(name, server):
            result.append((name, scope, path, server))
    return result


def describe(name, scope, server):
    host = tenant_from_url(server.get("url", "")) or "command"
    app = server_app(server) or "no-app-slug"
    return f"{name} ({scope}) -> {host} / {app}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--record", action="store_true")
    args = parser.parse_args()

    root = Path.cwd()
    workspace_path = root / ".kiro" / "settings" / "mcp.json"
    user_path = Path.home() / ".kiro" / "settings" / "mcp.json"
    state_path = root / ".kiro" / ".taruvi-mcp-confirmed"

    workspace = collect("workspace", workspace_path)
    user = collect("user", user_path)
    all_servers = workspace + user

    if args.verbose and not args.quiet:
        for name, scope, _path, server in all_servers:
            print(describe(name, scope, server))

    usable_workspace = [(name, server) for name, _scope, _path, server in workspace]

    if not usable_workspace:
        if not args.quiet:
            print("No usable workspace Taruvi MCP server found.")
            for name, _scope, _path, server in user:
                print(f"Inherited: {describe(name, 'user', server)}")
        return 1 if not user else 2

    if len(usable_workspace) > 1:
        if not args.quiet:
            print("Multiple workspace Taruvi MCP servers found:")
            for name, server in usable_workspace:
                print(describe(name, "workspace", server))
        return 2

    name, server = usable_workspace[0]
    fingerprint = server_fingerprint(server)

    if args.record:
        state_path.write_text(f"{fingerprint}\n")
        if not args.quiet:
            print(f"Recorded workspace Taruvi MCP server: {describe(name, 'workspace', server)}")
        return 0

    if state_path.exists() and state_path.read_text().strip() != fingerprint:
        if not args.quiet:
            print("Workspace Taruvi MCP config changed since last confirmation.")
            print(describe(name, "workspace", server))
        return 3

    if not args.quiet:
        print(f"Workspace Taruvi MCP server: {describe(name, 'workspace', server)}")
        inherited = [(n, s) for n, _scope, _path, s in user if n != name]
        for inherited_name, inherited_server in inherited:
            print(f"Unverified inherited server: {describe(inherited_name, 'user', inherited_server)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
