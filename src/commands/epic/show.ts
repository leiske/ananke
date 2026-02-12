import { fail, ok } from "../../cli/errors";
import type { CommandHandler } from "../../cli/types";
import { assertEpicExists, assertWorkspaceInitialized } from "../../workspace/assertions";
import { isEpic } from "../../workspace/guards";
import { readJsonFile, toWorkspaceRelative } from "../../workspace/io";
import type { Epic } from "../../workspace/types";

interface EpicShowInput {
  epicId: string;
}

export const epicShowCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as EpicShowInput;

  const workspaceRoot = ctx.paths.root;

  const workspaceFailure = assertWorkspaceInitialized(ctx.paths);
  if (workspaceFailure) {
    return workspaceFailure;
  }

  const epicPathOrFailure = assertEpicExists(ctx.paths, parsed.epicId);
  if (typeof epicPathOrFailure !== "string") {
    return epicPathOrFailure;
  }

  const epicPath = epicPathOrFailure;

  let epic: Epic;
  try {
    const parsedEpic = await readJsonFile<unknown>(epicPath);
    if (!isEpic(parsedEpic)) {
      return fail("CONFLICT", `Invalid epic file contents: ${parsed.epicId}`);
    }

    epic = parsedEpic;
  } catch (_error) {
    return fail("CONFLICT", `Failed reading epic file: ${parsed.epicId}`);
  }

  return ok(`Loaded epic ${parsed.epicId}`, {
    epic,
    path: toWorkspaceRelative(workspaceRoot, epicPath),
  });
};
