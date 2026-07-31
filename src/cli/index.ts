import { program } from "commander";
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
  .action(async (task: string | undefined, options: { config: string; verbose: boolean }) => {
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