import { notImplemented } from "../_stub";
import type { CommandHandler } from "../../cli/types";

export const depAddCommand: CommandHandler = async (_ctx, input) => {
  return notImplemented("dep add", input);
};
