#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { validateSkillContent } from "./lib/skill-frontmatter.mjs";

const root = process.cwd();
const errors = [];

const rel = (...parts) => path.join(...parts);
const abs = (...parts) => path.join(root, ...parts);

function fail(message) {
  errors.push(message);
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(abs(relativePath), "utf8"));
  } catch (error) {
    fail(`${relativePath}: ${error.message}`);
    return undefined;
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
    return false;
  }
  return true;
}

function assertPathField(manifest, basePath, pluginRoot, fieldName) {
  const value = manifest[fieldName];
  if (value === undefined) return;
  if (typeof value !== "string" || !value.startsWith("./")) {
    fail(`${basePath} ${fieldName} must be a plugin-root-relative path starting with ./`);
    return;
  }
  const target = abs(pluginRoot, value);
  if (!fs.existsSync(target)) {
    fail(`${basePath} ${fieldName} points to missing path ${value}`);
  }
}

function validateCursor() {
  const manifestPath = rel("src", "vendors", "cursor", ".cursor-plugin", "plugin.json");
  const pluginRoot = rel("payload", ".cursor");
  const mcpPath = rel("src", "vendors", "cursor", "mcp.json");
  const manifest = readJson(manifestPath);
  const mcp = readJson(mcpPath);
  if (!assertObject(manifest, manifestPath) || !assertObject(mcp, mcpPath)) return;

  for (const field of ["skills", "rules", "agents", "commands", "mcpServers"]) {
    assertPathField(manifest, manifestPath, pluginRoot, field);
  }

  if (!assertObject(manifest.variables, `${manifestPath} variables`)) return;
  if (!assertObject(manifest.variables.properties, `${manifestPath} variables.properties`)) return;

  const rawMcp = fs.readFileSync(abs(mcpPath), "utf8");
  const placeholders = new Set([...rawMcp.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map((match) => match[1]));
  for (const name of placeholders) {
    if (!manifest.variables.properties[name]) {
      fail(`${mcpPath} uses ${name}, but ${manifestPath} does not declare it in variables.properties`);
    }
  }
}

function validateClaude() {
  const manifestPath = rel("src", "vendors", "claude", ".claude-plugin", "plugin.json");
  const pluginRoot = rel("src", "vendors", "claude");
  const mcpPath = rel("src", "vendors", "claude", ".mcp.json");
  const manifest = readJson(manifestPath);
  const mcp = readJson(mcpPath);
  if (!assertObject(manifest, manifestPath) || !assertObject(mcp, mcpPath)) return;

  assertPathField(manifest, manifestPath, pluginRoot, "mcpServers");
  if (!assertObject(manifest.userConfig, `${manifestPath} userConfig`)) return;

  const rawMcp = fs.readFileSync(abs(mcpPath), "utf8");
  const placeholders = new Set([...rawMcp.matchAll(/\$\{user_config\.([a-z0-9_]+)\}/g)].map((match) => match[1]));
  for (const name of placeholders) {
    if (!manifest.userConfig[name]) {
      fail(`${mcpPath} uses user_config.${name}, but ${manifestPath} does not declare it in userConfig`);
    }
  }
}

function validateCodex() {
  const manifestPath = rel("src", "vendors", "codex", ".codex-plugin", "plugin.json");
  const pluginRoot = rel("payload", ".codex");
  const mcpPath = rel("src", "vendors", "codex", ".mcp.json");
  const manifest = readJson(manifestPath);
  const mcp = readJson(mcpPath);
  if (!assertObject(manifest, manifestPath) || !assertObject(mcp, mcpPath)) return;

  for (const field of ["skills", "mcpServers"]) {
    assertPathField(manifest, manifestPath, pluginRoot, field);
  }

  if (JSON.stringify(mcp).includes("TARUVI_") || JSON.stringify(mcp).includes("user_config.taruvi")) {
    fail(`${mcpPath} must stay secret-free; Taruvi MCP belongs in Codex config.toml.`);
  }
}

function validateKiroHooks() {
  const hooksDir = abs("src", "vendors", "kiro", "hooks");
  const allowedTriggers = new Set([
    "PostFileSave",
    "PreToolUse",
    "PostToolUse",
    "UserPromptSubmit",
    "SessionStart",
    "SessionEnd",
  ]);

  for (const fileName of fs.readdirSync(hooksDir).filter((name) => name.endsWith(".json")).sort()) {
    const hookPath = rel("src", "vendors", "kiro", "hooks", fileName);
    const config = readJson(hookPath);
    if (!assertObject(config, hookPath)) continue;
    if (config.version !== "v1") {
      fail(`${hookPath} must use Kiro hook schema version v1.`);
    }
    if (!Array.isArray(config.hooks) || config.hooks.length === 0) {
      fail(`${hookPath} must contain a non-empty hooks array.`);
      continue;
    }
    for (const [index, hook] of config.hooks.entries()) {
      const label = `${hookPath} hooks[${index}]`;
      if (!assertObject(hook, label)) continue;
      if (typeof hook.name !== "string" || hook.name.length === 0) {
        fail(`${label}.name must be a non-empty string.`);
      }
      if (!allowedTriggers.has(hook.trigger)) {
        fail(`${label}.trigger must be one of ${[...allowedTriggers].join(", ")}.`);
      }
      if (hook.matcher !== undefined) {
        try {
          new RegExp(hook.matcher);
        } catch (error) {
          fail(`${label}.matcher is not a valid regular expression: ${error.message}`);
        }
      }
      if (!assertObject(hook.action, `${label}.action`)) continue;
      if (!["agent", "command"].includes(hook.action.type)) {
        fail(`${label}.action.type must be agent or command.`);
      }
      if (hook.action.type === "agent" && typeof hook.action.prompt !== "string") {
        fail(`${label}.action.prompt must be a string for agent actions.`);
      }
      if (hook.action.type === "command" && typeof hook.action.command !== "string") {
        fail(`${label}.action.command must be a string for command actions.`);
      }
    }
  }
}

// Validate the extracted artifact, not just src/. Generated setup skills only
// exist in payload/, so this is the gate that has to catch broken frontmatter.
function findSkillFiles(startDir) {
  const found = [];
  if (!fs.existsSync(startDir)) return found;

  const stack = [startDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        found.push(entryPath);
      }
    }
  }
  return found.sort();
}

function validatePayloadSkills() {
  const payloadDir = abs("payload");
  if (!fs.existsSync(payloadDir)) {
    fail("payload/ is missing. Run npm run build:vendor-files before validating.");
    return;
  }

  const skillFiles = findSkillFiles(payloadDir);
  if (skillFiles.length === 0) {
    fail("payload/ contains no SKILL.md files.");
    return;
  }

  for (const skillFile of skillFiles) {
    const label = path.relative(root, skillFile);
    for (const error of validateSkillContent({
      content: fs.readFileSync(skillFile, "utf8"),
      label,
      expectedName: path.basename(path.dirname(skillFile)),
    })) {
      fail(error);
    }
  }
}

validateCursor();
validateClaude();
validateCodex();
validateKiroHooks();
validatePayloadSkills();

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Vendor plugin files look valid.");
