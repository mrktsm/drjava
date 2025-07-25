import express from "express";
import fs from "fs";
import cors from "cors";
import { readAndParseLogs } from "./src/utils/logReader.js";

const app = express();
const port = 3001;

// Explicitly allow requests from the Vite development server
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4173",
  ],
  optionsSuccessStatus: 200, // For legacy browser compatibility
};

app.use(cors(corsOptions));

// Get the log directory path from environment variable or use the DrJava default
const logDirectory =
  process.env.LOG_DIR || "/Users/markotsymbaluk/Desktop/drjava/drjava/logs";

app.get("/api/logs", (req, res) => {
  readAndParseLogs(logDirectory)
    .then((parsedLogs) => res.json(parsedLogs))
    .catch((err) => {
      console.error(`Error reading log files from ${logDirectory}:`, err);
      res.status(500).json({
        error: "Could not read log files.",
        message: err.message,
        path: logDirectory,
      });
    });
});

app.listen(port, () => {
  console.log(`Log server listening at http://localhost:${port}`);
  console.log(`Serving logs from: ${logDirectory}`);
});
