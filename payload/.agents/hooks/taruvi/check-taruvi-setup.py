#!/usr/bin/env python3
import json
import stat
import sys
from pathlib import Path
from urllib.parse import urlparse


REQUIRED_ENV = ("TARUVI_SITE_URL", "TARUVI_APP_SLUG", "TARUVI_API_KEY")


def read_env(path):
    values = {}
    if not path.exists():
        return values
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_json(path):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as error:
        print(f"Invalid JSON: {path}: {error}", file=sys.stderr)
        sys.exit(1)


def tenant_from_site_url(site_url):
    parsed = urlparse(site_url if "://" in site_url else f"https://{site_url}")
    host = parsed.netloc or parsed.path
    suffix = ".taruvi.cloud"
    if host.endswith(suffix):
        return host[: -len(suffix)]
    return host.split(".")[0] if host else ""


def tenant_from_mcp_url(url):
    parsed = urlparse(url)
    host = parsed.netloc or parsed.path
    suffix = ".taruvi.cloud"
    if host.endswith(suffix):
        return host[: -len(suffix)]
    return host.split(".")[0] if host else ""


def is_placeholder(value):
    return not value or "<" in value or ">" in value or "${" in value


def warn_permissions(path):
    if not path.exists():
        return
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        print(f"Warning: {path} is readable by group/others; prefer chmod 600.")


def main():
    root = Path.cwd()
    env_path = root / ".env"
    mcp_path = root / ".kiro" / "settings" / "mcp.json"

    env_values = read_env(env_path)
    missing_env = [key for key in REQUIRED_ENV if is_placeholder(env_values.get(key, ""))]
    if missing_env:
        print(f"Missing or placeholder .env values: {', '.join(missing_env)}", file=sys.stderr)
        return 1

    config = load_json(mcp_path)
    if not config:
        print("Missing .kiro/settings/mcp.json", file=sys.stderr)
        return 1

    server = config.get("mcpServers", {}).get("taruvi")
    if not isinstance(server, dict):
        print("Missing taruvi server in .kiro/settings/mcp.json", file=sys.stderr)
        return 1

    headers = server.get("headers", {})
    auth = headers.get("Authorization", "")
    app_slug = headers.get("X-App-Slug", "")
    url = server.get("url", "")
    problems = []

    if server.get("type") != "http":
        problems.append('taruvi server must include "type": "http"')
    if not url.endswith("/mcp/"):
        problems.append("taruvi server URL must end with /mcp/")
    if "/api/apps/" in url:
        problems.append("taruvi server URL must not use /api/apps/<app>/mcp/")
    if not auth.startswith("Api-Key ") or is_placeholder(auth):
        problems.append("taruvi Authorization header is missing or still a placeholder")
    if is_placeholder(app_slug):
        problems.append("taruvi X-App-Slug header is missing or still a placeholder")

    env_tenant = tenant_from_site_url(env_values["TARUVI_SITE_URL"])
    mcp_tenant = tenant_from_mcp_url(url)
    if env_tenant and mcp_tenant and env_tenant != mcp_tenant:
        problems.append(f"tenant mismatch: .env={env_tenant}, mcp={mcp_tenant}")
    if env_values["TARUVI_APP_SLUG"] != app_slug:
        problems.append("app slug mismatch between .env and mcp X-App-Slug")

    if problems:
        for problem in problems:
            print(problem, file=sys.stderr)
        return 1

    warn_permissions(env_path)
    warn_permissions(mcp_path)
    print(f"Taruvi setup looks complete for {env_tenant} / {app_slug}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
