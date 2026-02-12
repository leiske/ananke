import { existsSync } from "node:fs";
import path from "node:path";

export interface WorkspacePaths {
  root: string;
  anankeDir: string;
  schemaFile: string;
  indexFile: string;
  epicsDir: string;
  tasksDir: string;
  depsDir: string;
  blocksFile: string;
  packsDir: string;
}

export function detectWorkspaceRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    if (existsSync(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }

    current = parent;
  }
}

export function getWorkspacePaths(root: string): WorkspacePaths {
  const normalizedRoot = path.resolve(root);
  const anankeDir = path.join(normalizedRoot, ".ananke");

  return {
    root: normalizedRoot,
    anankeDir,
    schemaFile: path.join(anankeDir, "schema.json"),
    indexFile: path.join(anankeDir, "index.json"),
    epicsDir: path.join(anankeDir, "epics"),
    tasksDir: path.join(anankeDir, "tasks"),
    depsDir: path.join(anankeDir, "deps"),
    blocksFile: path.join(anankeDir, "deps", "blocks.json"),
    packsDir: path.join(anankeDir, "packs"),
  };
}
