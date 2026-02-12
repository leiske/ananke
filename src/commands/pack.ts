import { notImplemented } from "./_stub";
import type { CommandHandler } from "../cli/types";

export const packCommand: CommandHandler = async (_ctx, input) => {
  return notImplemented("pack", input);
};
