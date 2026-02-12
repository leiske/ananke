import { existsSync } from "node:fs";
import path from "node:path";
import { fail, ok } from "../../cli/errors";
import type { CliFailure, CommandHandler } from "../../cli/types";
import { assertWorkspaceInitialized } from "../../workspace/assertions";
import { isAnankeIndex } from "../../workspace/guards";
import { EPIC_PREFIX } from "../../workspace/ids";
import { readJsonFile, toWorkspaceRelative, writeJsonFile } from "../../workspace/io";
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

  const workspaceFailure = assertWorkspaceInitialized(ctx.paths);
  if (workspaceFailure) {
    return workspaceFailure;
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

  await writeJsonFile(epicPath, epic);
  await writeJsonFile(indexFile, nextIndex);

  return ok(`Created epic ${epicId}`, {
    epic: {
      id: epicId,
      status: epic.status,
    },
    path: toWorkspaceRelative(workspaceRoot, epicPath),
  });
};

async function readIndex(indexFile: string): Promise<AnankeIndex | CliFailure> {
  try {
    const parsed = await readJsonFile<unknown>(indexFile);

    if (!isAnankeIndex(parsed)) {
      return fail("CONFLICT", "Invalid .ananke/index.json contents");
    }

    return parsed;
  } catch (_error) {
    return fail("CONFLICT", "Failed reading .ananke/index.json");
  }
}

function formatEpicId(nextEpic: number): string {
  return `${EPIC_PREFIX}-${String(nextEpic).padStart(3, "0")}`;
}

function isCliFailure(value: CliFailure | AnankeIndex): value is CliFailure {
  return "ok" in value && value.ok === false;
}
