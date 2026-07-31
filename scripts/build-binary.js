import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, createWriteStream, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform, arch } from "node:os";
import { get } from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const exec = (cmd) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
};

const download = (url, dest) => new Promise((resolve, reject) => {
  const file = createWriteStream(dest);
  get(url, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
      get(response.headers.location, (redirectRes) => {
        redirectRes.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", reject);
      return;
    }
    response.pipe(file);
    file.on("finish", () => { file.close(); resolve(); });
  }).on("error", reject);
});

console.log("Building TypeScript...");
exec("npm run build");

console.log("Creating CJS SEA entry point...");
writeFileSync(resolve(root, "dist", "sea-entry.cjs"), `"use strict";
// Node.js SEA entry point - CJS wrapper that loads ESM module via dynamic import
import("./src/cli/index.js").then(() => {}).catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
`);

console.log("Generating SEA blob...");
exec("node --experimental-sea-config sea-config.json");

const version = process.version.slice(1); // "22.22.0" -> "22.22.0"
const plat = platform(); // "win32", "darwin", "linux"
const cpuArch = arch(); // "x64", "arm64"

const binaryName = plat === "win32" ? "node.exe" : "node";
const binName = plat === "win32" ? "ccg.exe" : "ccg";
const binPath = resolve(root, binName);
const nodePath = resolve(root, binaryName);

const downloadUrl = plat === "win32"
  ? `https://nodejs.org/dist/v${version}/win-${cpuArch}/node.exe`
  : `https://nodejs.org/dist/v${version}/node-v${version}-${plat}-${cpuArch}.tar.gz`;

if (existsSync(binPath)) rmSync(binPath);
if (existsSync(nodePath) && plat === "win32") rmSync(nodePath);

console.log(`Downloading unsigned Node.js ${version} for ${plat}-${cpuArch}...`);
await download(downloadUrl, nodePath);

console.log(`Copying ${nodePath} to ${binPath}...`);
copyFileSync(nodePath, binPath);

console.log("Injecting SEA blob...");
exec(`npx postject ${binName} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`);

// Clean up downloaded node binary
if (existsSync(nodePath) && nodePath !== binPath) rmSync(nodePath);

console.log(`Binary built: ${binPath}`);