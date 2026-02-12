import { existsSync } from "node:fs";
import path from "node:path";
import { fail } from "../cli/errors";
import type { CliFailure } from "../cli/types";
import type { WorkspacePaths } from "./paths";

const WORKSPACE_NOT_INITIALIZED_MESSAGE =
  "Workspace not initialized. Run `ananke init` first.";

export function assertWorkspaceInitialized(paths: WorkspacePaths): CliFailure | null {
  if (
    !existsSync(paths.anankeDir) ||
    !existsSync(paths.indexFile) ||
    !existsSync(paths.epicsDir) ||
    !existsSync(paths.tasksDir) ||
    !existsSync(paths.depsDir) ||
    !existsSync(paths.blocksFile)
  ) {
    return fail("NOT_FOUND", WORKSPACE_NOT_INITIALIZED_MESSAGE);
  }

  return null;
}

export function assertEpicExists(paths: WorkspacePaths, epicId: string): string | CliFailure {
  const epicPath = path.join(paths.epicsDir, `${epicId}.json`);
  if (!existsSync(epicPath)) {
    return fail("NOT_FOUND", `Epic not found: ${epicId}`);
  }

  return epicPath;
}

export function assertTaskExists(paths: WorkspacePaths, taskId: string): string | CliFailure {
  const taskPath = path.join(paths.tasksDir, `${taskId}.json`);
  if (!existsSync(taskPath)) {
    return fail("NOT_FOUND", `Task not found: ${taskId}`);
  }

  return taskPath;
}
