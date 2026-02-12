import type { CommandHandler } from "../../cli/types";
import { assertWorkspaceInitialized } from "../../workspace/assertions";
import { readTaskOrFail } from "../../workspace/store";
import { formatTaskLoadedResult } from "./result";

interface TaskShowInput {
  taskId: string;
}

export const taskShowCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as TaskShowInput;

  const workspaceFailure = assertWorkspaceInitialized(ctx.paths);
  if (workspaceFailure) {
    return workspaceFailure;
  }

  const taskRecord = await readTaskOrFail(ctx.paths, parsed.taskId);
  if (!("task" in taskRecord)) {
    return taskRecord;
  }

  return formatTaskLoadedResult(ctx, taskRecord.task, taskRecord.filePath);
};
