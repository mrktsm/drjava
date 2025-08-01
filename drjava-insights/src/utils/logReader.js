import fs from "fs";
import path from "path";

/**
 * Unescapes special characters in text that was escaped during logging
 * @param {string} escapedText - The escaped text from the log
 * @returns {string} - The unescaped text
 */
function unescapeText(escapedText) {
  return escapedText
    .replace(/\\"/g, '"') // Unescape quotes
    .replace(/\\t/g, "\t") // Unescape tabs
    .replace(/\\r/g, "\r") // Unescape carriage returns
    .replace(/\\n/g, "\n") // Unescape newlines
    .replace(/\\\\/g, "\\"); // Unescape backslashes (must be last)
}

/**
 * Extracts filename from a log filename (e.g., "file1.java.log" -> "file1.java")
 * @param {string} logFilename - The log filename
 * @returns {string} - The extracted filename
 */
function extractFilename(logFilename) {
  // Remove the .log suffix
  return logFilename.replace(/\.log$/, "");
}

/**
 * Reads and parses session events from session_events.log
 * @param {string} sessionEventsPath - Path to the session_events.log file
 * @returns {Promise<Array<Object>>} - Promise resolving to an array of session event objects
 */
function readSessionEvents(sessionEventsPath) {
  return new Promise((resolve, reject) => {
    fs.readFile(sessionEventsPath, "utf8", (err, data) => {
      if (err) {
        console.warn(
          `Warning: Could not read session events from ${sessionEventsPath}:`,
          err.message
        );
        return resolve([]); // Return empty array if session events can't be read
      }

      const lines = data.split("\n").filter((line) => line.trim());

      // Regex patterns for session events
      const appActivatedRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?): APP_ACTIVATED: (\d+)(?: \(away for (\d+)ms\))?/;
      const appDeactivatedRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?): APP_DEACTIVATED: (\d+)/;
      const fileOpenedRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?): FILE_OPENED: (.+)/;
      const compileStartedRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?): COMPILE_STARTED: (\d+)/;
      const compileEndedRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?): COMPILE_ENDED: (\d+)/;
      const androidRunStartedRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?): ANDROID_RUN_STARTED: (.+) at (\d+)/;

      const sessionEvents = lines
        .map((line) => {
          // Try to match app activated pattern
          const activatedMatch = line.match(appActivatedRegex);
          if (activatedMatch) {
            return {
              timestamp: activatedMatch[1],
              type: "app_activated",
              epochTime: parseInt(activatedMatch[2], 10),
              awayDuration: activatedMatch[3]
                ? parseInt(activatedMatch[3], 10)
                : null,
            };
          }

          // Try to match app deactivated pattern
          const deactivatedMatch = line.match(appDeactivatedRegex);
          if (deactivatedMatch) {
            return {
              timestamp: deactivatedMatch[1],
              type: "app_deactivated",
              epochTime: parseInt(deactivatedMatch[2], 10),
            };
          }

          // Try to match file opened pattern
          const fileOpenedMatch = line.match(fileOpenedRegex);
          if (fileOpenedMatch) {
            return {
              timestamp: fileOpenedMatch[1],
              type: "file_opened",
              filePath: fileOpenedMatch[2],
            };
          }

          // Try to match compile started pattern
          const compileStartedMatch = line.match(compileStartedRegex);
          if (compileStartedMatch) {
            return {
              timestamp: compileStartedMatch[1],
              type: "compile_started",
              epochTime: parseInt(compileStartedMatch[2], 10),
            };
          }

          // Try to match compile ended pattern
          const compileEndedMatch = line.match(compileEndedRegex);
          if (compileEndedMatch) {
            return {
              timestamp: compileEndedMatch[1],
              type: "compile_ended",
              epochTime: parseInt(compileEndedMatch[2], 10),
            };
          }

          // Try to match android run started pattern
          const androidRunStartedMatch = line.match(androidRunStartedRegex);
          if (androidRunStartedMatch) {
            return {
              timestamp: androidRunStartedMatch[1],
              type: "android_run_started",
              filename: androidRunStartedMatch[2],
              epochTime: parseInt(androidRunStartedMatch[3], 10),
            };
          }

          return null; // Ignore lines that don't match any format
        })
        .filter(Boolean); // Remove any null entries

      resolve(sessionEvents);
    });
  });
}

/**
 * Reads and parses text changes from a single text change log file
 * @param {string} filePath - Path to the text change log file
 * @param {string} filename - The filename associated with these changes
 * @returns {Promise<Array<Object>>} - Promise resolving to an array of text change objects
 */
function readTextChanges(filePath, filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) return reject(err);

      const lines = data.split("\n").filter((line) => line.trim());

      // Regex patterns for text changes
      const insertRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?): Text inserted at position (\d+): "(.*)"/;
      const initialContentRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?): Initial file content inserted at position (\d+): "(.*)"/;
      const deleteRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?): Text deleted at position (\d+) \(length: (\d+)\)/;

      const textChanges = lines
        .map((line) => {
          // Try to match initial content insertion pattern first
          const initialContentMatch = line.match(initialContentRegex);
          if (initialContentMatch) {
            const escapedText = initialContentMatch[3];
            const unescapedText = unescapeText(escapedText);
            return {
              timestamp: initialContentMatch[1],
              type: "insert",
              offset: parseInt(initialContentMatch[2], 10),
              insertedText: unescapedText,
              length: unescapedText.length,
              filename: filename,
              isInitialContent: true, // Flag to distinguish initial content
            };
          }

          // Try to match insertion pattern
          const insertMatch = line.match(insertRegex);
          if (insertMatch) {
            const escapedText = insertMatch[3];
            const unescapedText = unescapeText(escapedText);
            return {
              timestamp: insertMatch[1],
              type: "insert",
              offset: parseInt(insertMatch[2], 10),
              insertedText: unescapedText,
              length: unescapedText.length,
              filename: filename,
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
              filename: filename,
            };
          }

          return null; // Ignore lines that don't match any format
        })
        .filter(Boolean); // Remove any null entries

      resolve(textChanges);
    });
  });
}

/**
 * Reads and parses all log files from the DrJava logs directory.
 * @param {string} logDirectory - Path to the logs directory.
 * @returns {Promise<Array<Object>>} - Promise resolving to an array of parsed log objects.
 */
export function readAndParseLogs(logDirectory) {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if the log directory exists
      if (!fs.existsSync(logDirectory)) {
        return reject(
          new Error(`Log directory does not exist: ${logDirectory}`)
        );
      }

      const sessionEventsPath = path.join(logDirectory, "session_events.log");
      const textChangesDir = path.join(logDirectory, "text_changes");

      // Read session events
      const sessionEvents = await readSessionEvents(sessionEventsPath);

      // Read text changes from all files in text_changes directory
      let allTextChanges = [];

      if (fs.existsSync(textChangesDir)) {
        const textChangeFiles = fs
          .readdirSync(textChangesDir)
          .filter((file) => file.endsWith(".log"));

        for (const file of textChangeFiles) {
          const filePath = path.join(textChangesDir, file);
          const filename = extractFilename(file);
          const textChanges = await readTextChanges(filePath, filename);
          allTextChanges = allTextChanges.concat(textChanges);
        }
      }

      // Combine all logs and sort by timestamp
      const allLogs = [...sessionEvents, ...allTextChanges];
      const sortedLogs = allLogs.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      console.log(
        `Successfully parsed ${sortedLogs.length} log entries from ${logDirectory}`
      );
      console.log(
        `Found ${sessionEvents.length} session events and ${allTextChanges.length} text changes`
      );

      resolve(sortedLogs);
    } catch (error) {
      reject(error);
    }
  });
}
