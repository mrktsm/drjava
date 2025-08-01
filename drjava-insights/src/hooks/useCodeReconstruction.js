import { useMemo } from "react";

/**
 * Reconstructs the code content at a specific keystroke index by replaying
 * all insert and delete operations up to that point for a specific file.
 *
 * The hook finds the corresponding log entry in the full logs using the
 * timestamp, type, and offset of the target keystroke. It then applies
 * each log entry in order (inserts and deletes) to build up the file content
 * as it would appear at that moment in the session, but only for the specified file.
 *
 * @param {Object} params
 * @param {Array<Object>} params.logs - The full list of log objects (insert/delete/app events).
 * @param {Array<Object>} params.keystrokeLogs - The filtered list of keystroke logs (insert/delete only).
 * @param {number} params.currentKeystrokeIndex - The index in keystrokeLogs to reconstruct up to.
 * @param {string} params.selectedFile - The filename to reconstruct (e.g., "HelloWorld.java").
 * @returns {string} The reconstructed file content at the given keystroke index for the selected file.
 */
export default function useCodeReconstruction({
  logs,
  keystrokeLogs,
  currentKeystrokeIndex,
  selectedFile,
}) {
  return useMemo(() => {
    if (!logs || !keystrokeLogs || keystrokeLogs.length === 0 || !selectedFile)
      return "";

    const targetKeystroke = keystrokeLogs[currentKeystrokeIndex];
    if (!targetKeystroke) return "";

    const fullLogIndex = logs.findIndex(
      (log) =>
        log.timestamp === targetKeystroke.timestamp &&
        log.type === targetKeystroke.type &&
        log.offset === targetKeystroke.offset
    );

    let fileContent = "";
    for (let i = 0; i <= fullLogIndex && i < logs.length; i++) {
      const log = logs[i];

      // Only process text changes for the selected file
      if (log.type === "insert" || log.type === "delete") {
        // Handle both files with explicit filename and legacy logs without filename
        const logFilename = log.filename || "untitled_document";

        if (logFilename !== selectedFile) {
          continue; // Skip logs for other files
        }

        if (log.type === "insert") {
          const beforeContent = fileContent;
          fileContent =
            fileContent.slice(0, log.offset) +
            log.insertedText +
            fileContent.slice(log.offset);
          console.log(`INSERT at ${log.offset}: "${log.insertedText}"`);
          console.log(`Before: "${beforeContent}"`);
          console.log(`After: "${fileContent}"`);
        } else if (log.type === "delete") {
          const beforeContent = fileContent;
          const deletedText = fileContent.slice(
            log.offset,
            log.offset + log.length
          );
          fileContent =
            fileContent.slice(0, log.offset) +
            fileContent.slice(log.offset + log.length);
          console.log(
            `DELETE at ${log.offset} (length: ${log.length}): "${deletedText}"`
          );
          console.log(`Before: "${beforeContent}"`);
          console.log(`After: "${fileContent}"`);
        }
      }
    }

    return fileContent;
  }, [logs, keystrokeLogs, currentKeystrokeIndex, selectedFile]);
}
