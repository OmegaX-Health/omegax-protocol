// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const programSrcDir = fileURLToPath(
  new URL("../../programs/omegax_protocol/src/", import.meta.url),
);

function listRustSources(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listRustSources(path);
    if (entry.isFile() && entry.name.endsWith(".rs")) return [path];
    return [];
  });

  return files.sort((a, b) => {
    if (basename(a) === "lib.rs") return 1;
    if (basename(b) === "lib.rs") return -1;
    return a.localeCompare(b);
  });
}

export const programSource = listRustSources(programSrcDir)
  .map((path) => `\n// source: ${path}\n${readFileSync(path, "utf8")}`)
  .join("\n");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractRustFunctionBody(name: string, source = programSource): string {
  const signature = new RegExp(
    String.raw`\bpub(?:\(\s*crate\s*\))?\s+fn\s+${escapeRegExp(name)}\s*\(`,
    "g",
  );
  const match = signature.exec(source);
  if (!match) {
    throw new Error(`function ${name} should exist in program source`);
  }

  const startIdx = match.index;
  let i = source.indexOf("{", startIdx);
  if (i === -1) {
    throw new Error(`function ${name} should have a body`);
  }

  let depth = 1;
  i += 1;
  for (; i < source.length && depth > 0; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") depth -= 1;
  }

  return source.slice(startIdx, i);
}

export function findEnclosingRustFunctionName(
  lines: string[],
  oneBasedLine: number,
): string | null {
  for (let i = oneBasedLine - 1; i >= 0; i -= 1) {
    const match = /\bpub(?:\(\s*crate\s*\))?\s+fn\s+(\w+)\s*\(/.exec(lines[i] ?? "");
    if (match) return match[1]!;
  }
  return null;
}
