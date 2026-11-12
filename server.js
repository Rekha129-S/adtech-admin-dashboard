"use strict";

/*
  LOCAL DEVELOPMENT ONLY  (run with:  npm start)
  On Vercel this file is NOT used - Vercel runs api/index.js instead.
*/

require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const core = require("./lib/core");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  let url;

  try {
    url = new URL(req.url, "http://localhost");
  } catch (e) {
    res.writeHead(400);
    return res.end("Bad request");
  }

  if (url.pathname.startsWith("/api/")) {
    return core.handler(req, res);
  }

  let p;

  try {
    p = decodeURIComponent(url.pathname);
  } catch (e) {
    res.writeHead(400);
    return res.end("Bad request");
  }

  if (p.includes("\0")) {
    res.writeHead(400);
    return res.end("Bad request");
  }

  if (p === "/") p = "/index.html";

  const file = path.normalize(path.join(ROOT, p));

  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }

    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });

    res.end(data);
  });
});

core
  .init()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Local server running at http://localhost:${PORT}`);
    });
  })
  .catch(error => {
    console.error("Startup failed:", error.message);
    console.error("Check your .env file and Supabase tables.");
    process.exit(1);
  });

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    console.log("Shutting down...");
    core.flush();

    try {
      await core.save();
    } catch (e) {
      console.error("Final save failed:", e.message);
    }

    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}