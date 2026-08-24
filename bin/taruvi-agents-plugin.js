#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const payloadRoot = path.join(packageRoot, "payload");

const RUNTIME_IGNORES = [
  ".env",
  ".env.local",
  ".mcp.json",
  ".claude/.mcp.json",
  ".codex/.mcp.json",
  ".codex/log/",
  ".kiro/settings/mcp.json",
];

const SHARED_SKILLS = [
  "taruvi-app-developer",
  "taruvi-refine-providers",
];

function usage(exitCode = 0) {
  const out = exitCode === 0 ? console.log : console.error;
  out(`Usage:
  taruvi-agents-plugin install [--target <dir>] [--force] [--allow-non-template]

Installs Claude, Codex, Cursor, and Kiro agent support into a Taruvi template.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    command: argv[2],
    target: process.cwd(),
    force: false,
    allowNonTemplate: false,
  };

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") {
      const value = argv[index + 1];
      if (!value) usage(1);
      args.target = path.resolve(value);
      index += 1;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--allow-non-template") {
      args.allowNonTemplate = true;
    } else if (arg === "--help" || arg === "-h") {
      usage(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage(1);
    }
  }

  return args;
}

function pathExists(target) {
  return fs.existsSync(target);
}

function ensurePayload() {
  if (pathExists(path.join(payloadRoot, ".agents", "skills"))) {
    return;
  }

  const script = path.join(packageRoot, "scripts", "build-vendor-files.sh");
  if (!pathExists(script)) {
    throw new Error("Installer payload is missing and build script is unavailable.");
  }

  const result = spawnSync("bash", [script], {
    cwd: packageRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Failed to build installer payload.");
  }
}

function verifyTemplate(target, allowNonTemplate) {
  const markers = [
    "package.json",
    "src/taruviClient.ts",
    "AGENTS.md",
    "UI_Guidelines.md",
  ];

  const missing = markers.filter((marker) => !pathExists(path.join(target, marker)));
  if (missing.length === 0 || allowNonTemplate) {
    return;
  }

  throw new Error(
    `Target does not look like a Taruvi Refine template. Missing: ${missing.join(", ")}\n` +
      "Use --allow-non-template to install anyway."
  );
}

function copyDirectoryContents(source, destination) {
  if (!pathExists(source)) {
    return;
  }

  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    fs.cpSync(from, to, {
      recursive: true,
      force: true,
      dereference: false,
      verbatimSymlinks: true,
    });
  }
}

function removePath(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureSymlink(targetRoot, linkPath, relativeTarget) {
  const absoluteLink = path.join(targetRoot, linkPath);
  const parent = path.dirname(absoluteLink);
  fs.mkdirSync(parent, { recursive: true });

  try {
    fs.lstatSync(absoluteLink);
    removePath(absoluteLink);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  fs.symlinkSync(relativeTarget, absoluteLink, "dir");
}

function installPayload(targetRoot) {
  copyDirectoryContents(path.join(payloadRoot, ".agents"), path.join(targetRoot, ".agents"));
  copyDirectoryContents(path.join(payloadRoot, ".claude"), path.join(targetRoot, ".claude"));
  copyDirectoryContents(path.join(payloadRoot, ".codex"), path.join(targetRoot, ".codex"));
  copyDirectoryContents(path.join(payloadRoot, ".cursor"), path.join(targetRoot, ".cursor"));
  copyDirectoryContents(path.join(payloadRoot, ".kiro"), path.join(targetRoot, ".kiro"));
}

function installSharedSkillSymlinks(targetRoot) {
  for (const vendor of [".claude", ".codex", ".cursor", ".kiro"]) {
    for (const skill of SHARED_SKILLS) {
      ensureSymlink(
        targetRoot,
        path.join(vendor, "skills", skill),
        "../../.agents/skills/" + skill
      );
    }
  }

  const context7Source = path.join(targetRoot, ".codex", "skills", "context7-mcp");
  if (pathExists(context7Source)) {
    for (const vendor of [".claude", ".cursor", ".kiro"]) {
      ensureSymlink(
        targetRoot,
        path.join(vendor, "skills", "context7-mcp"),
        "../../.codex/skills/context7-mcp"
      );
    }
  }
}

function updateGitignore(targetRoot) {
  const gitignorePath = path.join(targetRoot, ".gitignore");
  const existing = pathExists(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";

  const lines = existing.split(/\r?\n/);
  const present = new Set(lines.map((line) => line.trim()).filter(Boolean));
  const missing = RUNTIME_IGNORES.filter((entry) => !present.has(entry));

  if (missing.length === 0) {
    return false;
  }

  const prefix = existing.endsWith("\n") || existing.length === 0 ? "" : "\n";
  const block = [
    "",
    "# Taruvi agent local runtime state",
    ...missing,
    "",
  ].join("\n");

  fs.writeFileSync(gitignorePath, existing + prefix + block);
  return true;
}

function assertNoForbiddenPayload() {
  const forbidden = [
    ".kiro/settings/mcp.json",
    ".codex/log/codex-tui.log",
    ".codex/.personality_migration",
    ".codex/config.toml",
  ];

  for (const rel of forbidden) {
    if (pathExists(path.join(payloadRoot, rel))) {
      throw new Error(`Forbidden runtime file present in payload: ${rel}`);
    }
  }
}

function install(args) {
  const targetRoot = path.resolve(args.target);
  ensurePayload();
  assertNoForbiddenPayload();
  verifyTemplate(targetRoot, args.allowNonTemplate);

  fs.mkdirSync(targetRoot, { recursive: true });
  installPayload(targetRoot);
  installSharedSkillSymlinks(targetRoot);
  const gitignoreUpdated = updateGitignore(targetRoot);

  console.log("Taruvi agent support installed.");
  console.log("");
  console.log(`Target: ${targetRoot}`);
  console.log("Installed: .agents, .claude, .codex, .cursor, .kiro");
  console.log(gitignoreUpdated ? "Updated: .gitignore" : "Updated: .gitignore already had required entries");
  console.log("");
  console.log("Next: open your preferred agent and say: setup taruvi");
}

const args = parseArgs(process.argv);

try {
  if (args.command !== "install") {
    usage(args.command ? 1 : 0);
  }
  install(args);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
