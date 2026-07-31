import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform, arch } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const exec = (cmd) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
};

console.log("Building TypeScript...");
exec("npm run build");

const plat = platform();
const cpuArch = arch();
const targetMap = {
  win32: { x64: "node18-win-x64" },
  darwin: { x64: "node18-macos-x64", arm64: "node18-macos-arm64" },
  linux: { x64: "node18-linux-x64", arm64: "node18-linux-arm64" },
};
const target = targetMap[plat]?.[cpuArch] ?? "node18-win-x64";
const outName = plat === "win32" ? "ccg.exe" : "ccg";

console.log(`Packaging with pkg (target: ${target})...`);
exec(`npx pkg . --targets ${target} --output ${outName}`);

console.log(`Binary built: ${resolve(root, outName)}`);