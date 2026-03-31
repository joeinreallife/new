import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SOURCE_FILES } from "./src/sourceFiles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const port = Number(process.env.PORT) || 8787;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function serveAllowedSource(response, sourceKey) {
  const filePath = SOURCE_FILES[sourceKey];
  if (!filePath) {
    writeJson(response, 404, { error: `Unknown source key: ${sourceKey}` });
    return;
  }

  try {
    const buffer = await fsp.readFile(filePath);
    writeJson(response, 200, {
      sourceKey,
      filePath,
      fileName: path.basename(filePath),
      base64: buffer.toString("base64"),
    });
  } catch (error) {
    if (error?.code === "ENOENT") {
      writeJson(response, 404, { error: `Source file not found: ${filePath}` });
      return;
    }

    writeJson(response, 500, {
      error: error instanceof Error ? error.message : "Could not read source file.",
    });
  }
}

async function serveStaticAsset(requestPath, response) {
  const normalizedPath =
    requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  let assetPath = path.join(distDir, path.normalize(normalizedPath));

  try {
    const stats = await fsp.stat(assetPath);
    if (stats.isDirectory()) {
      assetPath = path.join(assetPath, "index.html");
    }
  } catch {
    assetPath = path.join(distDir, "index.html");
  }

  if (!assetPath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    await fsp.access(assetPath);
  } catch {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const extension = path.extname(assetPath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
  });
  fs.createReadStream(assetPath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    writeJson(response, 200, {
      ok: true,
      sourceKeys: Object.keys(SOURCE_FILES),
    });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/source-files/")) {
    const sourceKey = url.pathname.replace("/api/source-files/", "");
    await serveAllowedSource(response, sourceKey);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    writeJson(response, 405, { error: "Method not allowed." });
    return;
  }

  await serveStaticAsset(url.pathname, response);
});

server.listen(port, () => {
  console.log(`Dispatch Cockpit web server running at http://127.0.0.1:${port}`);
});
