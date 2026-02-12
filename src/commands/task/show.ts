import { notImplemented } from "../_stub";
import type { CommandHandler } from "../../cli/types";

export const taskShowCommand: CommandHandler = async (_ctx, input) => {
  return notImplemented("task show", input);
};
