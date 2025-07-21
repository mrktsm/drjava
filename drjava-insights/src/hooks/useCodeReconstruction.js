import { useMemo } from "react";

/**
 * Reconstructs the code content at a specific keystroke index by replaying
 * all insert and delete operations up to that point.
 *
 * The hook finds the corresponding log entry in the full logs using the
 * timestamp, type, and offset of the target keystroke. It then applies
 * each log entry in order (inserts and deletes) to build up the file content
 * as it would appear at that moment in the session.
 *
 * @param {Object} params
 * @param {Array<Object>} params.logs - The full list of log objects (insert/delete/app events).
 * @param {Array<Object>} params.keystrokeLogs - The filtered list of keystroke logs (insert/delete only).
 * @param {number} params.currentKeystrokeIndex - The index in keystrokeLogs to reconstruct up to.
 * @returns {string} The reconstructed file content at the given keystroke index.
 */
export default function useCodeReconstruction({
  logs,
  keystrokeLogs,
  currentKeystrokeIndex,
}) {
  return useMemo(() => {
    if (!logs || !keystrokeLogs || keystrokeLogs.length === 0) return "";
    const targetKeystroke = keystrokeLogs[currentKeystrokeIndex];
    const fullLogIndex = logs.findIndex(
      (log) =>
        log.timestamp === targetKeystroke.timestamp &&
        log.type === targetKeystroke.type &&
        log.offset === targetKeystroke.offset
    );
    let fileContent = "";
    for (let i = 0; i <= fullLogIndex && i < logs.length; i++) {
      const log = logs[i];
      if (log.type === "insert") {
        fileContent =
          fileContent.slice(0, log.offset) +
          log.insertedText +
          fileContent.slice(log.offset);
      } else if (log.type === "delete") {
        fileContent =
          fileContent.slice(0, log.offset) +
          fileContent.slice(log.offset + log.length);
      }
    }
    return fileContent;
  }, [logs, keystrokeLogs, currentKeystrokeIndex]);
}
