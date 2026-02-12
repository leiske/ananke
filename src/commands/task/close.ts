import type { CommandHandler } from "../../cli/types";
import { isCliFailure, mutateTask } from "./mutate";
import { formatTaskMutationResult } from "./result";

interface TaskCloseInput {
  taskId: string;
  summary: string;
}

export const taskCloseCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as TaskCloseInput;

  const mutation = await mutateTask(ctx, parsed.taskId, {
    status: "done",
    outcomeSummary: parsed.summary,
    addAcceptance: [],
  });

  if (isCliFailure(mutation)) {
    return mutation;
  }

  return formatTaskMutationResult(ctx, parsed.taskId, "Closed", mutation);
};
