const http = require("node:http");
const { createReadStream, existsSync, statSync } = require("node:fs");
const path = require("node:path");

const distDirectory = __dirname;
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

function resolveAssetPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(distDirectory, relativePath);
  const isInsideDist = candidate === distDirectory || candidate.startsWith(`${distDirectory}${path.sep}`);
  return isInsideDist ? candidate : null;
}

const server = http.createServer((request, response) => {
  let assetPath;
  try {
    assetPath = resolveAssetPath(request.url ?? "/");
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  if (!assetPath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  const hasRequestedAsset = existsSync(assetPath) && statSync(assetPath).isFile();
  const fallbackPath = path.join(distDirectory, "index.html");
  const filePath = hasRequestedAsset ? assetPath : fallbackPath;

  if (!existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "0.0.0.0", () => {
  console.info(`Serving static export on port ${port}`);
});
