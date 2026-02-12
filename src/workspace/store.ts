import { fail } from "../cli/errors";
import type { CliFailure } from "../cli/types";
import { isAnankeIndex, isBlockEdgeArray, isEpic, isTask } from "./guards";
import { readJsonFile, writeJsonFile } from "./io";
import type { WorkspacePaths } from "./paths";
import type { AnankeIndex, BlockEdge, Epic, Task } from "./types";

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

export async function readBlocksOrFail(paths: WorkspacePaths): Promise<BlockEdge[] | CliFailure> {
  try {
    const parsed = await readJsonFile<unknown>(paths.blocksFile);
    if (!isBlockEdgeArray(parsed)) {
      return fail("CONFLICT", "Invalid .ananke/deps/blocks.json contents");
    }

    return parsed;
  } catch (_error) {
    return fail("CONFLICT", "Failed reading .ananke/deps/blocks.json");
  }
}

export async function writeBlocks(paths: WorkspacePaths, edges: BlockEdge[]): Promise<void> {
  await writeJsonFile(paths.blocksFile, edges);
}

export async function readAllTasksOrFail(paths: WorkspacePaths): Promise<Task[] | CliFailure> {
  try {
    const taskFilePaths = await listJsonFiles(paths.tasksDir);
    const tasks: Task[] = [];

    for (const filePath of taskFilePaths) {
      const parsed = await readJsonFile<unknown>(filePath);
      if (!isTask(parsed)) {
        return fail("CONFLICT", `Invalid task file contents: ${filePath}`);
      }

      tasks.push(parsed);
    }

    return tasks;
  } catch (_error) {
    return fail("CONFLICT", "Failed reading task files");
  }
}

export async function readAllEpicsOrFail(paths: WorkspacePaths): Promise<Epic[] | CliFailure> {
  try {
    const epicFilePaths = await listJsonFiles(paths.epicsDir);
    const epics: Epic[] = [];

    for (const filePath of epicFilePaths) {
      const parsed = await readJsonFile<unknown>(filePath);
      if (!isEpic(parsed)) {
        return fail("CONFLICT", `Invalid epic file contents: ${filePath}`);
      }

      epics.push(parsed);
    }

    return epics;
  } catch (_error) {
    return fail("CONFLICT", "Failed reading epic files");
  }
}

async function listJsonFiles(directory: string): Promise<string[]> {
  const paths: string[] = [];
  const glob = new Bun.Glob("*.json");

  for await (const entry of glob.scan({ cwd: directory })) {
    paths.push(`${directory}/${entry}`);
  }

  paths.sort();
  return paths;
}

function isErrnoCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}
