import { notImplemented } from "../_stub";
import type { CommandHandler } from "../../cli/types";

export const depRmCommand: CommandHandler = async (_ctx, input) => {
  return notImplemented("dep rm", input);
};
