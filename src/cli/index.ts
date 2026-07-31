import { program } from "commander";
import * as readline from "node:readline";
import { runTask } from "./commands.js";
import { setupWizard } from "./setup-wizard.js";

const pkg = {
  version: "0.1.0",
  description: "CCG - Coding Agent Harness CLI",
};

program
  .name("ccg")
  .version(pkg.version)
  .description(pkg.description);

program
  .argument("[task]", "Task to execute")
  .option("-c, --config <path>", "Config file path", "ccg.yaml")
  .option("-v, --verbose", "Verbose output", false)
  .option("-i, --interactive", "Interactive mode", false)
  .action(async (task: string | undefined, options: { config: string; verbose: boolean; interactive: boolean }) => {
    if (options.interactive) {
      await runInteractive(options.config, options.verbose);
      return;
    }

    if (!task) {
      console.error("Error: No task provided. Usage: ccg \"your task description\"");
      process.exit(1);
    }

    try {
      const result = await runTask(task, options.config, options.verbose);
      console.log(`\n${result}`);
    } catch (e: unknown) {
      const err = e as Error;
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

async function runInteractive(configPath: string, verbose: boolean): Promise<void> {
  console.log("CCG Interactive Mode");
  console.log("Type a task and press Enter. Type /quit to exit, /help for commands.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let closed = false;

  rl.on("close", () => {
    closed = true;
  });

  process.on("SIGINT", () => {
    if (!closed) {
      console.log("\nGoodbye.");
      rl.close();
    }
  });

  const ask = (): Promise<string> =>
    new Promise((resolve) => {
      if (closed) {
        resolve("/quit");
        return;
      }
      rl.question("ccg> ", resolve);
    });

  while (true) {
    let input: string;
    try {
      input = await ask();
    } catch {
      break;
    }

    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === "/quit" || trimmed === "/q") break;

    if (trimmed === "/help" || trimmed === "/h") {
      console.log("Commands:");
      console.log("  /quit, /q    Exit interactive mode");
      console.log("  /help, /h    Show this help");
      console.log("  /verbose, /v Toggle verbose output");
      console.log("  <task>       Execute a task\n");
      continue;
    }

    if (trimmed === "/verbose" || trimmed === "/v") {
      verbose = !verbose;
      console.log(`Verbose: ${verbose ? "on" : "off"}\n`);
      continue;
    }

    try {
      const result = await runTask(trimmed, configPath, verbose, undefined, rl);
      if (!verbose) console.log(`\n${result}\n`);
      else console.log();
    } catch (e: unknown) {
      const err = e as Error;
      console.error(`Error: ${err.message}\n`);
    }
  }

  if (!closed) {
    console.log("Goodbye.");
    rl.close();
  }
}

program
  .command("setup")
  .description("Run credential setup wizard")
  .action(async () => {
    try {
      await setupWizard();
    } catch (e: unknown) {
      const err = e as Error;
      console.error(`Setup error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);