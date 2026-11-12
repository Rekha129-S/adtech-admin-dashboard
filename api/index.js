"use strict";

// Vercel serverless function
const core = require("./lib/core");

module.exports = async (req, res) => {
  try {
    if (!core.handler) {
      return res.status(500).json({
        success: false,
        message: "API handler is missing"
      });
    }

    return core.handler(req, res);
  } catch (error) {
    console.error("API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};