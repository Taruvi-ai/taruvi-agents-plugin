#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSkillContent } from "./lib/skill-frontmatter.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const PLUGIN_NAME_RE = /^(?!.*(?:--|\\.\\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fail(`${relativePath}: ${error.message}`);
    return null;
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be a JSON object.`);
    return false;
  }
  return true;
}

function assertString(value, label) {
  if (typeof value !== "string") {
    fail(`${label} must be a string.`);
    return false;
  }
  return true;
}

function assertContained(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} does not exist.`);
    return;
  }

  const rootRealPath = fs.realpathSync(root);
  const realPath = fs.realpathSync(absolutePath);
  if (realPath !== rootRealPath && !realPath.startsWith(`${rootRealPath}${path.sep}`)) {
    fail(`${relativePath} resolves outside the plugin root.`);
  }
}

function validatePluginManifest() {
  const manifest = readJson("plugin.json");
  if (!assertObject(manifest, "plugin.json")) return;

  const allowed = new Set([
    "$schema",
    "name",
    "version",
    "description",
    "author",
    "homepage",
    "repository",
    "license",
    "keywords",
    "extensions",
  ]);

  for (const key of Object.keys(manifest)) {
    if (!allowed.has(key)) {
      fail(`plugin.json has unknown top-level field: ${key}`);
    }
  }

  if (manifest.$schema !== PLUGIN_SCHEMA) {
    fail(`plugin.json $schema must be ${PLUGIN_SCHEMA}`);
  }

  if (!assertString(manifest.name, "plugin.json name")) return;
  if (manifest.name.length > 64 || !PLUGIN_NAME_RE.test(manifest.name)) {
    fail("plugin.json name must be 1-64 chars using lowercase letters, numbers, hyphens, and periods.");
  }

  if (manifest.author !== undefined) {
    if (assertObject(manifest.author, "plugin.json author")) {
      for (const key of Object.keys(manifest.author)) {
        if (!["name", "email", "url"].includes(key)) {
          fail(`plugin.json author has unknown field: ${key}`);
        }
        if (typeof manifest.author[key] !== "string") {
          fail(`plugin.json author.${key} must be a string.`);
        }
      }
    }
  }

  if (manifest.keywords !== undefined) {
    if (!Array.isArray(manifest.keywords) || manifest.keywords.some((item) => typeof item !== "string")) {
      fail("plugin.json keywords must be an array of strings.");
    }
  }

  if (manifest.extensions !== undefined) {
    if (assertObject(manifest.extensions, "plugin.json extensions")) {
      for (const [namespace, value] of Object.entries(manifest.extensions)) {
        if (!/^[a-z0-9]+(?:\.[a-z0-9-]+)+$/.test(namespace)) {
          fail(`plugin.json extension namespace should be reverse-domain style: ${namespace}`);
        }
        if (!assertObject(value, `plugin.json extensions.${namespace}`)) continue;
      }
    }
  }
}

function validateMcpConfig() {
  if (!fs.existsSync(path.join(root, "mcp.json"))) return;

  const config = readJson("mcp.json");
  if (!assertObject(config, "mcp.json")) return;

  const keys = Object.keys(config);
  for (const key of keys) {
    if (!["$schema", "mcpServers"].includes(key)) {
      fail(`mcp.json has unknown top-level field: ${key}`);
    }
  }

  if (config.$schema !== MCP_SCHEMA) {
    fail(`mcp.json $schema must be ${MCP_SCHEMA}`);
  }

  if (!assertObject(config.mcpServers, "mcp.json mcpServers")) return;

  for (const [name, server] of Object.entries(config.mcpServers)) {
    if (!assertObject(server, `mcp.json mcpServers.${name}`)) continue;

    if (server.type === "stdio") {
      for (const key of Object.keys(server)) {
        if (!["type", "command", "args", "env", "cwd"].includes(key)) {
          fail(`mcp.json server ${name} has invalid stdio field: ${key}`);
        }
      }
      if (!assertString(server.command, `mcp.json server ${name}.command`)) continue;
      if (server.command.includes(" ")) {
        fail(`mcp.json server ${name}.command must be one executable token.`);
      }
      if (server.command.startsWith("./")) {
        assertContained(server.command);
      } else if (server.command.startsWith("../") || server.command.startsWith("/")) {
        fail(`mcp.json server ${name}.command must be bare or plugin-relative with ./`);
      }
      if (server.args !== undefined && (!Array.isArray(server.args) || server.args.some((item) => typeof item !== "string"))) {
        fail(`mcp.json server ${name}.args must be an array of strings.`);
      }
      if (server.env !== undefined && (!assertObject(server.env, `mcp.json server ${name}.env`) || Object.values(server.env).some((item) => typeof item !== "string"))) {
        fail(`mcp.json server ${name}.env values must be strings.`);
      }
      if (server.cwd !== undefined && !server.cwd.startsWith("./") && !server.cwd.startsWith("${PLUGIN_ROOT}") && !server.cwd.startsWith("${PLUGIN_DATA}")) {
        fail(`mcp.json server ${name}.cwd must be plugin-relative, PLUGIN_ROOT-rooted, or PLUGIN_DATA-rooted.`);
      }
    } else if (server.type === "streamable-http" || server.type === "sse") {
      for (const key of Object.keys(server)) {
        if (!["type", "url", "headers"].includes(key)) {
          fail(`mcp.json server ${name} has invalid ${server.type} field: ${key}`);
        }
      }
      if (assertString(server.url, `mcp.json server ${name}.url`)) {
        try {
          const url = new URL(server.url);
          if (!["http:", "https:"].includes(url.protocol)) {
            fail(`mcp.json server ${name}.url must be HTTP or HTTPS.`);
          }
          if (url.username || url.password || url.hash) {
            fail(`mcp.json server ${name}.url must not contain user info or fragments.`);
          }
          const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
          if (url.protocol !== "https:" && !isLoopback) {
            fail(`mcp.json server ${name}.url must use HTTPS unless loopback.`);
          }
        } catch {
          fail(`mcp.json server ${name}.url must be an absolute URL without placeholders.`);
        }
      }
      if (server.headers !== undefined && (!assertObject(server.headers, `mcp.json server ${name}.headers`) || Object.values(server.headers).some((item) => typeof item !== "string"))) {
        fail(`mcp.json server ${name}.headers values must be strings.`);
      }
    } else {
      fail(`mcp.json server ${name}.type must be stdio, streamable-http, or sse.`);
    }
  }
}

function validateSkills() {
  const skillsDir = path.join(root, "skills");
  if (!fs.existsSync(skillsDir)) return;

  const stat = fs.statSync(skillsDir);
  if (!stat.isDirectory()) {
    fail("skills must be a directory.");
    return;
  }

  assertContained("skills");

  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

    const skillDir = path.join(skillsDir, entry.name);
    const skillFile = path.join(skillDir, "SKILL.md");
    const relativeSkillFile = path.relative(root, skillFile);
    if (!fs.existsSync(skillFile) || !fs.statSync(skillFile).isFile()) {
      fail(`${path.relative(root, skillDir)} must contain SKILL.md.`);
      continue;
    }

    assertContained(relativeSkillFile);

    for (const error of validateSkillContent({
      content: fs.readFileSync(skillFile, "utf8"),
      label: relativeSkillFile,
      expectedName: entry.name,
    })) {
      fail(error);
    }
  }
}

validatePluginManifest();
validateMcpConfig();
validateSkills();

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Agent Plugins foundation is valid.");
