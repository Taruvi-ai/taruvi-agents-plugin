// Strict SKILL.md frontmatter parser shared by the portable and vendor gates.
//
// This is deliberately stricter than a lenient key/value split: a generated
// value such as `description: Configure Taruvi for Codex: app .env ...` is a
// YAML error ("mapping values are not allowed here"), but a naive
// `key: rest-of-line` regex accepts it happily. Every real YAML loader rejects
// it, so the gate has to reject it too.

export const SKILL_NAME_RE = /^(?!.*--)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 1024;

// A plain (unquoted) scalar may not start with any of these YAML indicators.
const RESERVED_FIRST_CHARS = new Set(["[", "]", "{", "}", ",", "&", "*", "!", "%", "@", "`", "#"]);

const NESTED_MAP = Object.freeze({ kind: "map" });

function isBlockScalarHeader(raw) {
  return /^[>|][+-]?\d*$/.test(raw);
}

function collectIndentedBlock(lines, startIndex) {
  const block = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      block.push("");
      index += 1;
      continue;
    }
    if (!/^[ \t]/.test(line)) break;
    block.push(line.trim());
    index += 1;
  }
  return { block, nextIndex: index };
}

function parseQuoted(raw, key, label, errors) {
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      errors.push(`${label} ${key} is not a valid double-quoted YAML scalar: ${raw}`);
      // Best-effort value so a single syntax fault does not cascade into
      // "missing description" style follow-on errors.
      return raw.replace(/^"|"$/g, "");
    }
  }

  if (raw.length < 2 || !raw.endsWith("'")) {
    errors.push(`${label} ${key} has an unterminated single-quoted scalar: ${raw}`);
    return raw.replace(/^'|'$/g, "");
  }
  return raw.slice(1, -1).replace(/''/g, "'");
}

function validatePlainScalar(raw, key, label, errors) {
  if (/:(?:\s|$)/.test(raw)) {
    errors.push(
      `${label} ${key} has an unquoted ":" in a plain scalar, which no YAML loader accepts. ` +
        `Quote the value or use a block scalar (${key}: >).`
    );
    return false;
  }

  if (/\s#/.test(raw)) {
    errors.push(`${label} ${key} has an unquoted " #", which YAML reads as a comment. Quote the value.`);
    return false;
  }

  if (RESERVED_FIRST_CHARS.has(raw[0])) {
    errors.push(`${label} ${key} starts with the reserved YAML character "${raw[0]}". Quote the value.`);
    return false;
  }

  return true;
}

export function parseSkillFrontmatter(content, label) {
  const errors = [];
  const frontmatter = {};

  if (!content.startsWith("---\n")) {
    errors.push(`${label} must start with YAML frontmatter.`);
    return { frontmatter, errors };
  }

  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    errors.push(`${label} must close YAML frontmatter.`);
    return { frontmatter, errors };
  }

  const lines = content.slice(4, end).split(/\r?\n/);
  let index = 0;
  let sawKey = false;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "" || /^[ \t]/.test(line)) {
      index += 1;
      continue;
    }

    const match = line.match(/^([a-zA-Z0-9_-]+):(?:[ \t]+(.*))?$/);
    if (!match) {
      errors.push(`${label} has unsupported frontmatter line: ${line}`);
      index += 1;
      continue;
    }

    sawKey = true;
    const key = match[1];
    const raw = (match[2] ?? "").trim();
    index += 1;

    if (key in frontmatter) {
      errors.push(`${label} has a duplicate frontmatter key: ${key}`);
    }

    if (raw === "") {
      const { nextIndex } = collectIndentedBlock(lines, index);
      frontmatter[key] = nextIndex > index ? NESTED_MAP : "";
      index = nextIndex;
      continue;
    }

    if (isBlockScalarHeader(raw)) {
      const { block, nextIndex } = collectIndentedBlock(lines, index);
      index = nextIndex;
      frontmatter[key] = raw.startsWith(">")
        ? block.join(" ").replace(/\s+/g, " ").trim()
        : block.join("\n").trim();
      continue;
    }

    if (raw.startsWith('"') || raw.startsWith("'")) {
      frontmatter[key] = parseQuoted(raw, key, label, errors);
      continue;
    }

    validatePlainScalar(raw, key, label, errors);
    frontmatter[key] = raw;
  }

  if (!sawKey) {
    errors.push(`${label} has empty frontmatter.`);
  }

  return { frontmatter, errors };
}

export function validateSkillContent({ content, label, expectedName }) {
  const { frontmatter, errors } = parseSkillFrontmatter(content, label);

  const name = frontmatter.name;
  if (typeof name !== "string" || name === "") {
    errors.push(`${label} must declare a string name.`);
  } else {
    if (expectedName !== undefined && name !== expectedName) {
      errors.push(`${label} name "${name}" must match its parent directory "${expectedName}".`);
    }
    if (name.length > MAX_NAME_LENGTH || !SKILL_NAME_RE.test(name)) {
      errors.push(`${label} name must be 1-${MAX_NAME_LENGTH} chars of lowercase letters, numbers, and hyphens.`);
    }
  }

  const description = frontmatter.description;
  if (typeof description !== "string" || description === "") {
    errors.push(`${label} must declare a non-empty description.`);
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`${label} description must be at most ${MAX_DESCRIPTION_LENGTH} chars.`);
  }

  return errors;
}
