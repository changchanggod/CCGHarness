import express from "express";
import path from "node:path";
import fs from "node:fs";
import type { Server } from "node:http";
import { createConfigRouter } from "./routes.js";
import { attachWebSocket } from "./ws-handler.js";

export function createApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use(createConfigRouter());

    let publicDir = path.resolve(__dirname, "public");
    if (!fs.existsSync(path.join(publicDir, "index.html"))) {
      publicDir = path.resolve(__dirname, "..", "..", "web", "public");
    }
    app.use(express.static(publicDir));

    return app;
  }

  export function startServer(port: number): Promise<Server> {
    return new Promise((resolve) => {
      const app = createApp();
      const server = app.listen(port, () => {
        resolve(server);
      });
      attachWebSocket(server);
    });
  }

if (require.main === module) {
  const port = parseInt(process.env.PORT || "3000", 10);
  startServer(port).then(() => {
    console.log(`CCG Web Console running at http://localhost:${port}`);
  });
}