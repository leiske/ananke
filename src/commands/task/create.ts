import { notImplemented } from "../_stub";
import type { CommandHandler } from "../../cli/types";

export const taskCreateCommand: CommandHandler = async (_ctx, input) => {
  return notImplemented("task create", input);
};
