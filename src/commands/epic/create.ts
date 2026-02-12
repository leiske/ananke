import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fail, ok } from "../../cli/errors";
import type { CliFailure, CommandHandler } from "../../cli/types";
import { EPIC_PREFIX } from "../../workspace/ids";
import type { AnankeIndex, Epic } from "../../workspace/types";

interface ParsedEpicCreateArgs {
  title: string;
  goal: string;
  constraints: string[];
  decisions: string[];
  context?: string;
}

export const epicCreateCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as ParsedEpicCreateArgs;

  const workspaceRoot = ctx.paths.root;
  const indexFile = ctx.paths.indexFile;
  const epicsDir = ctx.paths.epicsDir;

  if (!existsSync(indexFile) || !existsSync(epicsDir)) {
    return fail("NOT_FOUND", "Workspace not initialized. Run `ananke init` first.");
  }

  const index = await readIndex(indexFile);
  if (isCliFailure(index)) {
    return index;
  }

  const epicId = formatEpicId(index.next_epic);
  const epicPath = path.join(epicsDir, `${epicId}.json`);

  if (existsSync(epicPath)) {
    return fail("CONFLICT", `Epic already exists: ${epicId}`);
  }

  const timestamp = new Date().toISOString();
  const epic: Epic = {
    id: epicId,
    title: parsed.title,
    goal: parsed.goal,
    status: "active",
    constraints: parsed.constraints,
    decisions: parsed.decisions,
    created_at: timestamp,
    updated_at: timestamp,
  };

  if (typeof parsed.context === "string") {
    epic.context = parsed.context;
  }

  const nextIndex: AnankeIndex = {
    next_epic: index.next_epic + 1,
    next_task: index.next_task,
    updated_at: timestamp,
  };

  await writeJson(epicPath, epic);
  await writeJson(indexFile, nextIndex);

  return ok(`Created epic ${epicId}`, {
    epic: {
      id: epicId,
      status: epic.status,
    },
    path: relativePath(workspaceRoot, epicPath),
  });
};

async function readIndex(indexFile: string): Promise<AnankeIndex | CliFailure> {
  try {
    const raw = await readFile(indexFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<AnankeIndex>;

    if (
      typeof parsed.next_epic !== "number" ||
      !Number.isInteger(parsed.next_epic) ||
      parsed.next_epic < 1 ||
      typeof parsed.next_task !== "number" ||
      !Number.isInteger(parsed.next_task) ||
      parsed.next_task < 1 ||
      typeof parsed.updated_at !== "string"
    ) {
      return fail("CONFLICT", "Invalid .ananke/index.json contents");
    }

    return {
      next_epic: parsed.next_epic,
      next_task: parsed.next_task,
      updated_at: parsed.updated_at,
    };
  } catch (_error) {
    return fail("CONFLICT", "Failed reading .ananke/index.json");
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function formatEpicId(nextEpic: number): string {
  return `${EPIC_PREFIX}-${String(nextEpic).padStart(3, "0")}`;
}

function relativePath(root: string, target: string): string {
  const rel = path.relative(root, target);
  if (rel.length === 0) {
    return ".";
  }

  return rel;
}

function isCliFailure(
  value: CliFailure | AnankeIndex,
): value is CliFailure {
  return "ok" in value && value.ok === false;
}
