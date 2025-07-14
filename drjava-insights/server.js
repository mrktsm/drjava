import express from "express";
import fs from "fs";
import cors from "cors";

const app = express();
const port = 3001;

// Explicitly allow requests from the Vite development server
const corsOptions = {
  origin: "http://localhost:5173",
  optionsSuccessStatus: 200, // For legacy browser compatibility
};

app.use(cors(corsOptions));

// Get the log file path from environment variable or use a default
const logFilePath = process.env.LOG_FILE || "activity.log";

app.get("/api/logs", (req, res) => {
  fs.readFile(logFilePath, "utf8", (err, data) => {
    if (err) {
      console.error(`Error reading log file from ${logFilePath}:`, err);
      return res.status(500).json({
        error: "Could not read log file.",
        message: err.message,
        path: logFilePath,
      });
    }

    // For now, just send the raw log data.
    // Later we will parse this into structured JSON.
    const parsedLogs = {
      rawData: data,
    };

    res.json(parsedLogs);
  });
});

app.listen(port, () => {
  console.log(`Log server listening at http://localhost:${port}`);
  console.log(`Serving logs from: ${logFilePath}`);
});
