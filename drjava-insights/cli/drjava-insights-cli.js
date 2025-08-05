#!/usr/bin/env node

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { readAndParseLogs } from "../src/utils/logReader.js";
import open from "open";
import fs from "fs";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ASCII Art Banner
const banner = `
╔═════════════════════════════════════════════════════════════╗
║                                                             ║
║      ██████╗ ██████╗      ██╗ █████╗ ██╗   ██╗ █████╗       ║
║      ██╔══██╗██╔══██╗     ██║██╔══██╗██║   ██║██╔══██╗      ║
║      ██║  ██║██████╔╝     ██║███████║██║   ██║███████║      ║
║      ██║  ██║██╔══██╗██   ██║██╔══██║╚██╗ ██╔╝██╔══██║      ║
║      ██████╔╝██║  ██║╚█████╔╝██║  ██║ ╚████╔╝ ██║  ██║      ║
║      ╚═════╝ ╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝      ║
║                                                             ║
║               I N S I G H T S   V I E W E R                 ║
║                                                             ║
║         Visualize and replay student coding sessions        ║
║                                                             ║
╚═════════════════════════════════════════════════════════════╝
`;

class DrJavaInsightsCLI {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = null;
  }

  async findAvailablePort(startPort = 3001) {
    const isPortAvailable = (port) => {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.once("close", () => resolve(true));
          server.close();
        });
        server.on("error", () => resolve(false));
      });
    };

    for (let port = startPort; port <= startPort + 10; port++) {
      if (await isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(
      `No available ports found in range ${startPort}-${startPort + 10}`
    );
  }

  setupServer(logDirectory) {
    // CORS configuration - allow requests from same origin
    const corsOptions = {
      origin: [
        `http://localhost:${this.port}`,
        `http://127.0.0.1:${this.port}`,
        // Allow any localhost origin for development
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
      ],
      optionsSuccessStatus: 200,
    };

    this.app.use(cors(corsOptions));
    this.app.use(express.json());

    // API endpoint for logs - MUST come before static file serving
    this.app.get("/api/logs", async (req, res) => {
      try {
        const parsedLogs = await readAndParseLogs(logDirectory);
        res.json(parsedLogs);
      } catch (err) {
        console.error(`Error reading log files from ${logDirectory}:`, err);
        res.status(500).json({
          error: "Could not read log files.",
          message: err.message,
          path: logDirectory,
        });
      }
    });

    // Serve static files from dist directory
    const distPath = path.resolve(__dirname, "../dist");

    // Check if dist directory exists
    if (!fs.existsSync(distPath)) {
      throw new Error(
        `Build directory not found: ${distPath}. Please run 'npm run build-cli' first.`
      );
    }

    this.app.use(express.static(distPath));

    // Serve React app for all other routes (SPA fallback)
    this.app.get("*", (req, res) => {
      const indexPath = path.resolve(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res
          .status(404)
          .send("Build files not found. Please run 'npm run build-cli' first.");
      }
    });
  }

  async start(logDirectory) {
    console.log(banner);

    // Validate log directory
    if (!fs.existsSync(logDirectory)) {
      console.error(`Error: Log directory does not exist: ${logDirectory}`);
      process.exit(1);
    }

    console.log(`Log directory: ${path.resolve(logDirectory)}`);
    console.log(`Finding available port...`);

    try {
      this.port = await this.findAvailablePort(3001);
      if (this.port !== 3001) {
        console.log(`Port 3001 is in use, using port ${this.port} instead`);
      }
      console.log(`Starting DrJava Insights server on port ${this.port}...`);
    } catch (error) {
      console.error(`Error finding available port: ${error.message}`);
      console.log(
        `\nTip: If another DrJava Insights instance is running, stop it with Ctrl+C first.`
      );
      process.exit(1);
    }

    try {
      this.setupServer(logDirectory);
    } catch (error) {
      console.error(`Error setting up server: ${error.message}`);
      process.exit(1);
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          reject(err);
          return;
        }

        const url = `http://localhost:${this.port}`;
        console.log(`Server running at: ${url}`);
        console.log(`Opening browser...`);
        console.log(`\nDrJava Insights is now ready!`);
        console.log(`   Press Ctrl+C to stop the server\n`);

        // Open browser
        open(url).catch((err) => {
          console.warn(`Could not open browser automatically: ${err.message}`);
          console.log(`   Please open ${url} manually in your browser`);
        });

        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      console.log(`\nShutting down DrJava Insights server...`);
      this.server.close(() => {
        console.log(`Server stopped. Thank you for using DrJava Insights!`);
        process.exit(0);
      });
    }
  }
}

// CLI Logic
async function main() {
  const args = process.argv.slice(2);

  // Help message
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
DrJava Insights CLI - Visualize student coding sessions

Usage:
  drjava-insights <log-directory>     Start the insights viewer
  see-insights <log-directory>        Alternative command name
  
Options:
  -h, --help                         Show this help message
  
Examples:
  drjava-insights ./logs             View logs in current directory's logs folder
  drjava-insights /path/to/logs      View logs at specific path
  see-insights ~/drjava-logs         View logs in home directory
  
The tool will:
  1. Find an available port (starting from 3001)
  2. Start a local web server
  3. Parse your DrJava log files
  4. Open the insights viewer in your browser
  5. Allow you to replay and analyze coding sessions

Note: If port 3001 is in use, the tool will automatically find the next available port.
`);
    process.exit(0);
  }

  // Get log directory from arguments
  const logDirectory = args[0] || "./logs";

  if (args.length === 0) {
    console.log(`No log directory specified. Using default: ./logs`);
    console.log(`Use 'drjava-insights --help' for more options.\n`);
  }

  const cli = new DrJavaInsightsCLI();

  // Handle graceful shutdown
  process.on("SIGINT", () => cli.stop());
  process.on("SIGTERM", () => cli.stop());

  try {
    await cli.start(logDirectory);
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});
