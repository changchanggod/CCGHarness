import express from "express";
import path from "node:path";
import fs from "node:fs";
import type { Server } from "node:http";

export function startServer(port: number): Promise<Server> {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());

    let publicDir = path.resolve(__dirname, "public");
    if (!fs.existsSync(publicDir)) {
      publicDir = path.resolve(__dirname, "..", "..", "web", "public");
    }
    app.use(express.static(publicDir));

    const server = app.listen(port, () => {
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer(3000).then(() => {
    console.log("CCG Web Console running at http://localhost:3000");
  });
}