import { useMemo } from "react";

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
