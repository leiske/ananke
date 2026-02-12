import { fail } from "../cli/errors";
import type { CliFailure } from "../cli/types";
import { isAnankeIndex, isEpic, isTask } from "./guards";
import { readJsonFile, writeJsonFile } from "./io";
import type { WorkspacePaths } from "./paths";
import type { AnankeIndex, Epic, Task } from "./types";

interface LoadedEpic {
  epic: Epic;
  filePath: string;
}

interface LoadedTask {
  task: Task;
  filePath: string;
}

export async function readIndexOrFail(paths: WorkspacePaths): Promise<AnankeIndex | CliFailure> {
  try {
    const parsed = await readJsonFile<unknown>(paths.indexFile);
    if (!isAnankeIndex(parsed)) {
      return fail("CONFLICT", "Invalid .ananke/index.json contents");
    }

    return parsed;
  } catch (_error) {
    return fail("CONFLICT", "Failed reading .ananke/index.json");
  }
}

export async function readEpicOrFail(
  paths: WorkspacePaths,
  epicId: string,
): Promise<LoadedEpic | CliFailure> {
  const filePath = `${paths.epicsDir}/${epicId}.json`;

  try {
    const parsed = await readJsonFile<unknown>(filePath);
    if (!isEpic(parsed)) {
      return fail("CONFLICT", `Invalid epic file contents: ${epicId}`);
    }

    if (parsed.id !== epicId) {
      return fail("CONFLICT", `Epic file id mismatch: expected ${epicId}`);
    }

    return { epic: parsed, filePath };
  } catch (error) {
    if (isErrnoCode(error, "ENOENT")) {
      return fail("NOT_FOUND", `Epic not found: ${epicId}`);
    }

    return fail("CONFLICT", `Failed reading epic file: ${epicId}`);
  }
}

export async function readTaskOrFail(
  paths: WorkspacePaths,
  taskId: string,
): Promise<LoadedTask | CliFailure> {
  const filePath = `${paths.tasksDir}/${taskId}.json`;

  try {
    const parsed = await readJsonFile<unknown>(filePath);
    if (!isTask(parsed)) {
      return fail("CONFLICT", `Invalid task file contents: ${taskId}`);
    }

    if (parsed.id !== taskId) {
      return fail("CONFLICT", `Task file id mismatch: expected ${taskId}`);
    }

    return { task: parsed, filePath };
  } catch (error) {
    if (isErrnoCode(error, "ENOENT")) {
      return fail("NOT_FOUND", `Task not found: ${taskId}`);
    }

    return fail("CONFLICT", `Failed reading task file: ${taskId}`);
  }
}

export async function writeTask(paths: WorkspacePaths, task: Task): Promise<void> {
  const filePath = `${paths.tasksDir}/${task.id}.json`;
  await writeJsonFile(filePath, task);
}

export async function writeIndex(paths: WorkspacePaths, index: AnankeIndex): Promise<void> {
  await writeJsonFile(paths.indexFile, index);
}

function isErrnoCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}
