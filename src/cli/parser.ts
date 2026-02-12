import path from "node:path";
import { Command, CommanderError, InvalidArgumentError, Option } from "commander";
import { isEpicId, isTaskId } from "../workspace/ids";
import { detectWorkspaceRoot } from "../workspace/paths";
import { CliError } from "./errors";
import type { CliGlobals, ParsedArgv, ParsedCommand } from "./types";

interface GlobalsAndArgs {
  globals: CliGlobals;
  args: string[];
}

export function parseArgv(argv: string[], cwd: string): ParsedArgv {
  const { globals, args } = parseGlobals(argv, cwd);
  if (args.length === 0) {
    return {
      globals,
      command: null,
    };
  }

  const command = parseCommand(args);
  return {
    globals,
    command,
  };
}

function parseGlobals(argv: string[], cwd: string): GlobalsAndArgs {
  const globals: CliGlobals = {
    json: false,
    root: detectWorkspaceRoot(cwd),
  };

  const args: string[] = [];
  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    if (token === undefined) {
      index += 1;
      continue;
    }

    if (token === "--json") {
      globals.json = true;
      index += 1;
      continue;
    }

    if (token === "--root") {
      const rootValue = argv[index + 1];
      if (
        rootValue === undefined ||
        rootValue === "--json" ||
        rootValue === "--root" ||
        rootValue.startsWith("--root=")
      ) {
        throw new CliError("INVALID_ARGS", "Missing value for --root", 2);
      }

      globals.root = path.resolve(cwd, rootValue);
      index += 2;
      continue;
    }

    if (token.startsWith("--root=")) {
      const rootValue = token.slice("--root=".length);
      if (rootValue.length === 0) {
        throw new CliError("INVALID_ARGS", "Missing value for --root", 2);
      }

      globals.root = path.resolve(cwd, rootValue);
      index += 1;
      continue;
    }

    args.push(token);
    index += 1;
  }

  return {
    globals,
    args,
  };
}

function parseCommand(argv: string[]): ParsedCommand {
  const first = argv[0];
  if (first === undefined) {
    throw new CliError("INVALID_ARGS", "Missing command", 2);
  }

  if (first === "init") {
    return {
      path: ["init"],
      input: parseInitInput(argv.slice(1)),
    };
  }

  if (first === "epic") {
    const subcommand = argv[1];
    if (subcommand === "create") {
      return {
        path: ["epic", "create"],
        input: parseEpicCreateInput(argv.slice(2)),
      };
    }

    if (subcommand === "show") {
      return {
        path: ["epic", "show"],
        input: parseEpicShowInput(argv.slice(2)),
      };
    }

    if (subcommand === "update") {
      return {
        path: ["epic", "update"],
        input: parseEpicUpdateInput(argv.slice(2)),
      };
    }

    return {
      path: subcommand === undefined ? ["epic"] : ["epic", subcommand],
      input: null,
    };
  }

  if (first === "task") {
    const subcommand = argv[1];

    if (subcommand === "create") {
      return {
        path: ["task", "create"],
        input: parseTaskCreateInput(argv.slice(2)),
      };
    }

    if (subcommand === "show") {
      return {
        path: ["task", "show"],
        input: parseTaskShowInput(argv.slice(2)),
      };
    }

    if (subcommand === "update") {
      return {
        path: ["task", "update"],
        input: parseTaskUpdateInput(argv.slice(2)),
      };
    }

    if (subcommand === "close") {
      return {
        path: ["task", "close"],
        input: parseTaskCloseInput(argv.slice(2)),
      };
    }

    return {
      path: subcommand === undefined ? ["task"] : ["task", subcommand],
      input: null,
    };
  }

  if (first === "dep") {
    const subcommand = argv[1];

    if (subcommand === "add") {
      return {
        path: ["dep", "add"],
        input: parseDepAddInput(argv.slice(2)),
      };
    }

    if (subcommand === "rm") {
      return {
        path: ["dep", "rm"],
        input: parseDepRmInput(argv.slice(2)),
      };
    }

    return {
      path: subcommand === undefined ? ["dep"] : ["dep", subcommand],
      input: null,
    };
  }

  if (first === "ready") {
    return {
      path: ["ready"],
      input: parseReadyInput(argv.slice(1)),
    };
  }

  if (first === "pack") {
    return {
      path: ["pack"],
      input: parsePackInput(argv.slice(1)),
    };
  }

  return {
    path: [first],
    input: null,
  };
}

function parseInitInput(args: string[]): { update: boolean; reset: boolean } {
  return parseWithCommander(args, (command, setInput) => {
    command
      .addOption(new Option("--update").conflicts("reset"))
      .addOption(new Option("--reset").conflicts("update"))
      .action((options: { update?: boolean; reset?: boolean }) => {
        setInput({
          update: options.update === true,
          reset: options.reset === true,
        });
      });
  });
}

function parseEpicCreateInput(args: string[]): {
  title: string;
  goal: string;
  constraints: string[];
  decisions: string[];
  context?: string;
} {
  return parseWithCommander(args, (command, setInput) => {
    command
      .requiredOption("--title <text>", "Epic title", parseNonEmptyText)
      .requiredOption("--goal <text>", "Epic goal", parseNonEmptyText)
      .option("--constraint <text>", "Add a constraint", collectNonEmptyValues, [])
      .option("--decision <text>", "Add a decision", collectNonEmptyValues, [])
      .option("--context <text>", "Epic context", parseNonEmptyText)
      .action((options: {
        title: string;
        goal: string;
        constraint: string[];
        decision: string[];
        context?: string;
      }) => {
        setInput({
          title: options.title,
          goal: options.goal,
          constraints: options.constraint,
          decisions: options.decision,
          context: options.context,
        });
      });
  });
}

function parseEpicShowInput(args: string[]): { epicId: string } {
  return parseWithCommander(args, (command, setInput) => {
    command.argument("<epic-id>").action((epicId: string) => {
      setInput({ epicId: parseEpicId(epicId) });
    });
  });
}

function parseEpicUpdateInput(args: string[]): {
  epicId: string;
  title?: string;
  goal?: string;
  status?: "active" | "paused" | "done";
  context?: string;
  digest?: string;
  addConstraints: string[];
  addDecisions: string[];
} {
  return parseWithCommander(args, (command, setInput) => {
    command
      .argument("<epic-id>")
      .option("--title <text>", "Updated title", parseNonEmptyText)
      .option("--goal <text>", "Updated goal", parseNonEmptyText)
      .addOption(new Option("--status <status>").choices(["active", "paused", "done"]))
      .option("--add-constraint <text>", "Append constraint", collectNonEmptyValues, [])
      .option("--add-decision <text>", "Append decision", collectNonEmptyValues, [])
      .option("--context <text>")
      .option("--digest <text>")
      .action((epicId: string, options: {
        title?: string;
        goal?: string;
        status?: "active" | "paused" | "done";
        addConstraint: string[];
        addDecision: string[];
        context?: string;
        digest?: string;
      }) => {
        const input = {
          epicId: parseEpicId(epicId),
          title: options.title,
          goal: options.goal,
          status: options.status,
          context: options.context,
          digest: options.digest,
          addConstraints: options.addConstraint,
          addDecisions: options.addDecision,
        };

        if (
          input.title === undefined &&
          input.goal === undefined &&
          input.status === undefined &&
          input.context === undefined &&
          input.digest === undefined &&
          input.addConstraints.length === 0 &&
          input.addDecisions.length === 0
        ) {
          throw new InvalidArgumentError("No updates provided");
        }

        setInput(input);
      });
  });
}

function parseTaskCreateInput(args: string[]): {
  epicId: string;
  title: string;
  description: string;
  priority: 0 | 1 | 2 | 3 | 4;
  acceptance: string[];
} {
  return parseWithCommander(args, (command, setInput) => {
    command
      .requiredOption("--epic <epic-id>", "Parent epic id", parseEpicId)
      .requiredOption("--title <text>", "Task title", parseNonEmptyText)
      .requiredOption("--description <text>", "Task description", parseNonEmptyText)
      .option("--acceptance <text>", "Add acceptance criteria", collectNonEmptyValues, [])
      .addOption(new Option("--priority <value>").argParser(parsePriorityValue).default(2))
      .action((options: {
        epic: string;
        title: string;
        description: string;
        priority: 0 | 1 | 2 | 3 | 4;
        acceptance: string[];
      }) => {
        setInput({
          epicId: options.epic,
          title: options.title,
          description: options.description,
          priority: options.priority,
          acceptance: options.acceptance,
        });
      });
  });
}

function parseTaskShowInput(args: string[]): { taskId: string } {
  return parseWithCommander(args, (command, setInput) => {
    command.argument("<task-id>").action((taskId: string) => {
      setInput({ taskId: parseTaskId(taskId) });
    });
  });
}

function parseTaskUpdateInput(args: string[]): {
  taskId: string;
  title?: string;
  description?: string;
  status?: "todo" | "doing" | "done";
  priority?: 0 | 1 | 2 | 3 | 4;
  notes?: string;
  outcomeSummary?: string;
  addAcceptance: string[];
} {
  return parseWithCommander(args, (command, setInput) => {
    command
      .argument("<task-id>")
      .option("--title <text>", "Updated title", parseNonEmptyText)
      .option("--description <text>", "Updated description", parseNonEmptyText)
      .addOption(new Option("--status <status>").choices(["todo", "doing", "done"]))
      .option("--notes <text>", "Task notes", parseNonEmptyText)
      .option("--outcome-summary <text>", "Task outcome summary", parseNonEmptyText)
      .option("--add-acceptance <text>", "Append acceptance criteria", collectNonEmptyValues, [])
      .addOption(new Option("--priority <value>").argParser(parsePriorityValue))
      .action((taskId: string, options: {
        title?: string;
        description?: string;
        status?: "todo" | "doing" | "done";
        priority?: 0 | 1 | 2 | 3 | 4;
        notes?: string;
        outcomeSummary?: string;
        addAcceptance: string[];
      }) => {
        const input = {
          taskId: parseTaskId(taskId),
          title: options.title,
          description: options.description,
          status: options.status,
          priority: options.priority,
          notes: options.notes,
          outcomeSummary: options.outcomeSummary,
          addAcceptance: options.addAcceptance,
        };

        if (
          input.title === undefined &&
          input.description === undefined &&
          input.status === undefined &&
          input.priority === undefined &&
          input.notes === undefined &&
          input.outcomeSummary === undefined &&
          input.addAcceptance.length === 0
        ) {
          throw new InvalidArgumentError("No updates provided");
        }

        if (input.status === "done" && input.outcomeSummary === undefined) {
          throw new InvalidArgumentError("--outcome-summary is required when --status is done");
        }

        setInput(input);
      });
  });
}

function parseTaskCloseInput(args: string[]): { taskId: string; summary: string } {
  return parseWithCommander(args, (command, setInput) => {
    command
      .argument("<task-id>")
      .requiredOption("--summary <text>", "Outcome summary", parseNonEmptyText)
      .action((taskId: string, options: { summary: string }) => {
        setInput({
          taskId: parseTaskId(taskId),
          summary: options.summary,
        });
      });
  });
}

function parseDepAddInput(args: string[]): { fromTask: string; toTask: string } {
  return parseWithCommander(args, (command, setInput) => {
    command
      .argument("<from-task>")
      .argument("<to-task>")
      .action((fromTask: string, toTask: string) => {
        const parsedFromTask = parseTaskId(fromTask);
        const parsedToTask = parseTaskId(toTask);

        if (parsedFromTask === parsedToTask) {
          throw new InvalidArgumentError("Cannot add dependency from task to itself");
        }

        setInput({ fromTask: parsedFromTask, toTask: parsedToTask });
      });
  });
}

function parseDepRmInput(args: string[]): { fromTask: string; toTask: string } {
  return parseWithCommander(args, (command, setInput) => {
    command
      .argument("<from-task>")
      .argument("<to-task>")
      .action((fromTask: string, toTask: string) => {
        setInput({ fromTask: parseTaskId(fromTask), toTask: parseTaskId(toTask) });
      });
  });
}

function parseReadyInput(args: string[]): { epicId?: string; limit?: number } {
  return parseWithCommander(args, (command, setInput) => {
    command
      .addOption(new Option("--epic <epic-id>").argParser(parseEpicId))
      .addOption(new Option("--limit <value>").argParser(parsePositiveIntValue))
      .action((options: { epic?: string; limit?: number }) => {
        setInput({
          epicId: options.epic,
          limit: options.limit,
        });
      });
  });
}

function parsePackInput(args: string[]): {
  taskId: string;
  format: "md" | "json";
  recent: number;
  stdout: boolean;
} {
  return parseWithCommander(args, (command, setInput) => {
    command
      .argument("<task-id>")
      .addOption(new Option("--format <format>").choices(["md", "json"]).default("md"))
      .addOption(new Option("--recent <value>").argParser(parseRecentValue).default(5))
      .option("--stdout")
      .action((taskId: string, options: { format: "md" | "json"; recent: number; stdout?: boolean }) => {
        setInput({
          taskId: parseTaskId(taskId),
          format: options.format,
          recent: options.recent,
          stdout: options.stdout === true,
        });
      });
  });
}

function parseWithCommander<T>(
  args: string[],
  configure: (command: Command, setInput: (input: T) => void) => void,
): T {
  let parsedInput: T | undefined;
  const command = new Command();
  command
    .showHelpAfterError(false)
    .allowExcessArguments(false)
    .exitOverride()
    .configureOutput({
      writeOut: () => undefined,
      writeErr: () => undefined,
      outputError: () => undefined,
    });

  configure(command, (input) => {
    parsedInput = input;
  });

  try {
    command.parse(args, { from: "user" });
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    if (error instanceof CommanderError) {
      throw new CliError("INVALID_ARGS", normalizeCommanderMessage(error.message), 2);
    }

    throw error;
  }

  if (parsedInput === undefined) {
    throw new CliError("INVALID_ARGS", "Invalid command arguments", 2);
  }

  return parsedInput;
}

function collectNonEmptyValues(value: string, previous: string[]): string[] {
  return [...previous, parseNonEmptyText(value)];
}

function parseNonEmptyText(value: string): string {
  if (value.trim().length === 0) {
    throw new InvalidArgumentError("value cannot be empty");
  }

  return value;
}

function parseEpicId(value: string): string {
  if (!isEpicId(value)) {
    throw new InvalidArgumentError(`Invalid epic id: ${value}`);
  }

  return value;
}

function parseTaskId(value: string): string {
  if (!isTaskId(value)) {
    throw new InvalidArgumentError(`Invalid task id: ${value}`);
  }

  return value;
}

function parsePriorityValue(value: string): 0 | 1 | 2 | 3 | 4 {
  const integer = parseIntegerValue(value);
  if (integer < 0 || integer > 4) {
    throw new InvalidArgumentError("expected 0..4");
  }

  return integer as 0 | 1 | 2 | 3 | 4;
}

function parsePositiveIntValue(value: string): number {
  const integer = parseIntegerValue(value);
  if (integer < 1) {
    throw new InvalidArgumentError("expected positive integer");
  }

  return integer;
}

function parseRecentValue(value: string): number {
  const integer = parsePositiveIntValue(value);
  if (integer > 20) {
    throw new InvalidArgumentError("expected 1..20");
  }

  return integer;
}

function parseIntegerValue(value: string): number {
  const text = parseNonEmptyText(value);
  if (!/^-?[0-9]+$/.test(text)) {
    throw new InvalidArgumentError("expected integer");
  }

  return Number.parseInt(text, 10);
}

function normalizeCommanderMessage(message: string): string {
  if (message.startsWith("error: ")) {
    return message.slice("error: ".length);
  }

  return message;
}
