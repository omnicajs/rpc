import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const entryFiles = process.argv.slice(2);
const files = entryFiles.length === 0 ? ['compose.yml'] : entryFiles;
const visited = new Set();
const serviceSources = new Map();

for (const file of files) {
  collectComposeFile(path.resolve(cwd, file));
}

const collisions = [...serviceSources.entries()].filter(
  ([, sources]) => sources.length > 1,
);

if (collisions.length > 0) {
  console.error('Compose service name collisions detected before merge:');

  for (const [service, sources] of collisions) {
    console.error(`\n  ${service}`);

    for (const source of sources) {
      console.error(`    - ${source}`);
    }
  }

  console.error('\nDocker Compose silently merges same-named services from different files.');
  console.error('Rename the service or move shared service configuration to one common file.');

  process.exit(1);
}

console.log(`Compose service names are unique across ${visited.size} file(s).`);

function collectComposeFile(filePath) {
  const resolvedPath = path.resolve(filePath);

  if (visited.has(resolvedPath)) {
    return;
  }

  visited.add(resolvedPath);

  const content = fs.readFileSync(resolvedPath, 'utf8');
  const source = toRelative(resolvedPath);

  for (const service of parseServices(content)) {
    const sources = serviceSources.get(service) ?? [];
    sources.push(source);
    serviceSources.set(service, sources);
  }

  for (const include of parseIncludes(content)) {
    collectComposeFile(path.resolve(path.dirname(resolvedPath), include));
  }
}

function parseServices(content) {
  const lines = content.split(/\r?\n/);
  const services = [];
  let servicesIndent = null;

  for (const line of lines) {
    if (isBlankOrComment(line)) {
      continue;
    }

    const indent = indentationOf(line);

    if (servicesIndent == null) {
      if (/^\s*services:\s*(?:#.*)?$/.test(line)) {
        servicesIndent = indent;
      }

      continue;
    }

    if (indent <= servicesIndent) {
      break;
    }

    if (indent !== servicesIndent + 2) {
      continue;
    }

    const match = line.trim().match(/^['"]?([a-zA-Z0-9_.-]+)['"]?:\s*(?:#.*)?$/);

    if (match) {
      services.push(match[1]);
    }
  }

  return services;
}

function parseIncludes(content) {
  const lines = content.split(/\r?\n/);
  const includes = [];
  let includeIndent = null;

  for (const line of lines) {
    if (isBlankOrComment(line)) {
      continue;
    }

    const indent = indentationOf(line);

    if (includeIndent == null) {
      if (/^\s*include:\s*(?:#.*)?$/.test(line)) {
        includeIndent = indent;
      }

      continue;
    }

    if (indent <= includeIndent) {
      break;
    }

    const includeMatch = line.trim().match(/^-\s+(?:(?:path:\s*)?['"]?([^'"\s#]+)['"]?)/);

    if (includeMatch) {
      includes.push(includeMatch[1]);
    }
  }

  return includes;
}

function isBlankOrComment(line) {
  return /^\s*(?:#.*)?$/.test(line);
}

function indentationOf(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function toRelative(filePath) {
  return path.relative(cwd, filePath) || path.basename(filePath);
}
