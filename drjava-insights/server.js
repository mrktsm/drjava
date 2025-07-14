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

    // Parse the raw log data into a structured format
    const lines = data.split("\n");

    // Regex patterns for the new log format
    const insertRegex =
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+): Text inserted at position (\d+): "(.*)"/;
    const deleteRegex =
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+): Text deleted at position (\d+) \(length: (\d+)\)/;

    const parsedLogs = lines
      .map((line) => {
        // Try to match insertion pattern
        const insertMatch = line.match(insertRegex);
        if (insertMatch) {
          return {
            timestamp: insertMatch[1],
            type: "insert",
            offset: parseInt(insertMatch[2], 10),
            insertedText: insertMatch[3],
            length: insertMatch[3].length,
          };
        }

        // Try to match deletion pattern
        const deleteMatch = line.match(deleteRegex);
        if (deleteMatch) {
          return {
            timestamp: deleteMatch[1],
            type: "delete",
            offset: parseInt(deleteMatch[2], 10),
            length: parseInt(deleteMatch[3], 10),
            insertedText: "", // For deletions, we don't insert anything
          };
        }

        return null; // Ignore lines that don't match either format
      })
      .filter(Boolean); // Remove any null entries

    console.log(`Parsed ${parsedLogs.length} log entries`);
    res.json(parsedLogs);
  });
});

app.listen(port, () => {
  console.log(`Log server listening at http://localhost:${port}`);
  console.log(`Serving logs from: ${logFilePath}`);
});
