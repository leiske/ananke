import { fail, ok } from "../../cli/errors";
import type { CommandHandler } from "../../cli/types";
import { assertWorkspaceInitialized } from "../../workspace/assertions";
import { readBlocksOrFail, writeBlocks } from "../../workspace/store";

interface DepRmInput {
  fromTask: string;
  toTask: string;
}

export const depRmCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as DepRmInput;

  const workspaceFailure = assertWorkspaceInitialized(ctx.paths);
  if (workspaceFailure) {
    return workspaceFailure;
  }

  const blocks = await readBlocksOrFail(ctx.paths);
  if (isCliFailure(blocks)) {
    return blocks;
  }

  const nextBlocks = blocks.filter(
    (edge) => edge.from !== parsed.fromTask || edge.to !== parsed.toTask,
  );

  if (nextBlocks.length === blocks.length) {
    return ok(`Dependency did not exist: ${parsed.fromTask} -> ${parsed.toTask}`, {
      edge: {
        from: parsed.fromTask,
        to: parsed.toTask,
      },
      applied: {
        removed: 0,
      },
    });
  }

  try {
    await writeBlocks(ctx.paths, nextBlocks);
  } catch (_error) {
    return fail("CONFLICT", "Failed writing .ananke/deps/blocks.json");
  }

  return ok(`Removed dependency ${parsed.fromTask} -> ${parsed.toTask}`, {
    edge: {
      from: parsed.fromTask,
      to: parsed.toTask,
    },
    applied: {
      removed: 1,
    },
  });
};

function isCliFailure(value: unknown): value is { ok: false } {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  return (value as { ok?: unknown }).ok === false;
}
