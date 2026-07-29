import { execSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const exec = (cmd) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
};

console.log("Building TypeScript...");
exec("npm run build");

console.log("Generating SEA blob...");
exec("node --experimental-sea-config sea-config.json");

const nodeExe = process.execPath;
const binName = platform() === "win32" ? "ccg.exe" : "ccg";
const binPath = resolve(root, binName);

if (existsSync(binPath)) {
  rmSync(binPath);
}

console.log(`Copying ${nodeExe} to ${binPath}...`);
copyFileSync(nodeExe, binPath);

console.log("Injecting SEA blob...");
exec(`npx postject ${binName} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`);

console.log(`Binary built: ${binPath}`);