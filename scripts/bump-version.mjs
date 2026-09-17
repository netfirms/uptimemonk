#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const PACKAGE_PATHS = [
  "package.json",
  "server/package.json",
  "web/package.json",
  "admin/package.json",
];

/**
 * Increment the patch component of a semantic version string (e.g. 0.5.1 -> 0.5.2).
 */
export function bumpPatch(version) {
  const match = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`Invalid semver version string: "${version}"`);
  }
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10) + 1;
  const prerelease = match[4] || "";
  return `${major}.${minor}.${patch}${prerelease}`;
}

/**
 * Update version across all workspace packages in sync.
 */
export function bumpAllPackages(targetVersion) {
  const rootPkgPath = path.join(ROOT_DIR, "package.json");
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
  const prevVersion = rootPkg.version;
  const newVersion = targetVersion || bumpPatch(prevVersion);

  const updatedFiles = [];
  for (const relPath of PACKAGE_PATHS) {
    const fullPath = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(content);
    parsed.version = newVersion;
    fs.writeFileSync(fullPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    updatedFiles.push(relPath);
  }

  return { prevVersion, newVersion, updatedFiles };
}

// CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const arg = process.argv[2];
  let customVersion = null;
  if (arg && /^\d+\.\d+\.\d+/.test(arg)) {
    customVersion = arg;
  }
  const { prevVersion, newVersion, updatedFiles } = bumpAllPackages(customVersion);
  console.log(`==> [version-bump] Updated ${prevVersion} -> ${newVersion} in:`);
  for (const f of updatedFiles) {
    console.log(`    - ${f}`);
  }
}
