import * as readline from "node:readline";
import { storeApiKey, removeApiKey, checkApiKey } from "./setup.js";

const SUPPORTED_PROVIDERS = ["openai", "anthropic", "ollama"];

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

export async function setupWizard(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("=== CCG Credential Setup ===\n");
  console.log("Credentials are stored encrypted in your user home directory.");
  console.log("Supported providers: openai, anthropic, ollama\n");

  for (const provider of SUPPORTED_PROVIDERS) {
    const hasKey = await checkApiKey(provider);
    const status = hasKey ? "[configured]" : "[not configured]";
    console.log(`  ${provider}: ${status}`);
  }

  console.log("");

  while (true) {
    const action = await askQuestion(rl, "Action: [s]et key, [r]emove key, [q]uit: ");
    const trimmed = action.trim().toLowerCase();

    if (trimmed === "q" || trimmed === "quit") {
      break;
    }

    if (trimmed === "s" || trimmed === "set") {
      const provider = await askQuestion(rl, "Provider (openai/anthropic/ollama): ");
      const trimmedProvider = provider.trim().toLowerCase();

      if (!SUPPORTED_PROVIDERS.includes(trimmedProvider)) {
        console.log(`Unsupported provider: ${trimmedProvider}`);
        continue;
      }

      const key = await askQuestion(rl, `API key for ${trimmedProvider}: `);
      const trimmedKey = key.trim();

      if (!trimmedKey) {
        console.log("Key cannot be empty.");
        continue;
      }

      await storeApiKey(trimmedProvider, trimmedKey);
      console.log(`API key stored for ${trimmedProvider}.\n`);
    } else if (trimmed === "r" || trimmed === "remove") {
      const provider = await askQuestion(rl, "Provider (openai/anthropic/ollama): ");
      const trimmedProvider = provider.trim().toLowerCase();

      if (!SUPPORTED_PROVIDERS.includes(trimmedProvider)) {
        console.log(`Unsupported provider: ${trimmedProvider}`);
        continue;
      }

      await removeApiKey(trimmedProvider);
      console.log(`API key removed for ${trimmedProvider}.\n`);
    } else {
      console.log("Unknown action. Use [s]et, [r]emove, or [q]uit.");
    }
  }

  rl.close();
  console.log("Setup complete.");
}