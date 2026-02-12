import { notImplemented } from "./_stub";
import type { CommandHandler } from "../cli/types";

export const readyCommand: CommandHandler = async (_ctx, input) => {
  return notImplemented("ready", input);
};
