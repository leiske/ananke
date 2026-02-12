import { notImplemented } from "../_stub";
import type { CommandHandler } from "../../cli/types";

export const taskCloseCommand: CommandHandler = async (_ctx, input) => {
  return notImplemented("task close", input);
};
