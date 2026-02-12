import { depAddCommand } from "../commands/dep/add";
import { depRmCommand } from "../commands/dep/rm";
import { epicCreateCommand } from "../commands/epic/create";
import { epicShowCommand } from "../commands/epic/show";
import { epicUpdateCommand } from "../commands/epic/update";
import { initCommand } from "../commands/init";
import { packCommand } from "../commands/pack";
import { readyCommand } from "../commands/ready";
import { taskCloseCommand } from "../commands/task/close";
import { taskCreateCommand } from "../commands/task/create";
import { taskShowCommand } from "../commands/task/show";
import { taskUpdateCommand } from "../commands/task/update";
import type { CommandDefinition } from "./types";

const COMMANDS: CommandDefinition[] = [
  {
    path: ["init"],
    description: "Initialize .ananke workspace scaffold",
    handler: initCommand,
  },
  {
    path: ["epic", "create"],
    description: "Create a new epic",
    handler: epicCreateCommand,
  },
  {
    path: ["epic", "show"],
    description: "Show one epic by id",
    handler: epicShowCommand,
  },
  {
    path: ["epic", "update"],
    description: "Update an existing epic",
    handler: epicUpdateCommand,
  },
  {
    path: ["task", "create"],
    description: "Create a new task",
    handler: taskCreateCommand,
  },
  {
    path: ["task", "show"],
    description: "Show one task by id",
    handler: taskShowCommand,
  },
  {
    path: ["task", "update"],
    description: "Update an existing task",
    handler: taskUpdateCommand,
  },
  {
    path: ["task", "close"],
    description: "Close a task with outcome summary",
    handler: taskCloseCommand,
  },
  {
    path: ["dep", "add"],
    description: "Add a blocks dependency edge",
    handler: depAddCommand,
  },
  {
    path: ["dep", "rm"],
    description: "Remove a blocks dependency edge",
    handler: depRmCommand,
  },
  {
    path: ["ready"],
    description: "List tasks ready to execute",
    handler: readyCommand,
  },
  {
    path: ["pack"],
    description: "Generate a task context pack",
    handler: packCommand,
  },
];

const commandByPath = new Map(
  COMMANDS.map((command) => [command.path.join(" "), command] as const),
);

export function listCommands(): CommandDefinition[] {
  return [...COMMANDS];
}

export function resolveCommand(path: string[]): CommandDefinition | null {
  return commandByPath.get(path.join(" ")) ?? null;
}
