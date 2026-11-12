"use strict";

// Vercel serverless function. vercel.json sends every /api/* request here.
const core = require("../lib/core");

module.exports = async (req, res) => {
  try {
    return await core.handler(req, res);
  } catch (error) {
    console.error("API Error:", error);

    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
};