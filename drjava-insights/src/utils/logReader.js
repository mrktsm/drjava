import fs from "fs";

/**
 * Reads and parses the log file at the given path.
 * @param {string} logFilePath - Path to the log file.
 * @returns {Promise<Array<Object>>} - Promise resolving to an array of parsed log objects.
 */
export function readAndParseLogs(logFilePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(logFilePath, "utf8", (err, data) => {
      if (err) return reject(err);

      const lines = data.split("\n");

      // Regex patterns for the new log format
      const insertRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+): Text inserted at position (\d+): "(.*)"/;
      const deleteRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+): Text deleted at position (\d+) \(length: (\d+)\)/;
      const appActivatedRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+): APP_ACTIVATED: (\d+)(?: \(away for (\d+)ms\))?/;
      const appDeactivatedRegex =
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+): APP_DEACTIVATED: (\d+)/;

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

          return null; // Ignore lines that don't match any format
        })
        .filter(Boolean); // Remove any null entries

      resolve(parsedLogs);
    });
  });
}
