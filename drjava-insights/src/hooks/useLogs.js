import { useState, useEffect } from "react";

/**
 * A custom React hook for fetching, processing, and managing log data.
 *
 * This hook is responsible for:
 * - Fetching raw log data from the backend API.
 * - Parsing and sorting the fetched logs.
 * - Differentiating between keystroke logs (insert/delete) and other activity logs (app_activated/deactivated).
 * - Calculating and segmenting active coding periods (segments) and application activity periods (activitySegments).
 * - Determining the overall session start and end times based on keystroke logs.
 * - Managing loading and error states during data fetching.
 * - Extracting unique filenames from the logs.
 *
 * @returns {object} An object containing various states derived from the log data.
 * @property {Array<object>} logs - The complete, sorted array of all log entries.
 * @property {Array<object>} keystrokeLogs - A filtered array containing only insert and delete (keystroke) log entries.
 * @property {Array<object>} segments - An array of objects, each representing a continuous coding segment with `start` and `end` times (in hours).
 * @property {Array<object>} activitySegments - An array of objects, each representing periods of application activity with `start` and `end` times (in hours).
 * @property {Date|null} sessionStartTime - The timestamp of the first keystroke in the session, or `null` if no keystrokes.
 * @property {Date|null} sessionEndTime - The timestamp of the last keystroke in the session, or `null` if no keystrokes.
 * @property {Array<string>} files - An array of unique filenames found in the logs.
 * @property {boolean} loading - True if the log data is currently being fetched.
 * @property {Error|null} error - An error object if fetching fails, otherwise `null`.
 */
export default function useLogs() {
  const [logs, setLogs] = useState([]);
  const [keystrokeLogs, setKeystrokeLogs] = useState([]);
  const [segments, setSegments] = useState([]);
  const [activitySegments, setActivitySegments] = useState([]);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionEndTime, setSessionEndTime] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const processLogsIntoSegments = (sortedLogs) => {
      if (!sortedLogs || sortedLogs.length === 0) {
        return [];
      }
      const newSegments = [];
      let currentSegment = null;
      const SESSION_GAP_THRESHOLD = 5 * 60 * 1000; // 5 minutes in ms
      sortedLogs.forEach((log, index) => {
        if (log.type !== "insert" && log.type !== "delete") return;
        const logTime = new Date(log.timestamp);
        const timeInHours =
          logTime.getHours() +
          logTime.getMinutes() / 60 +
          logTime.getSeconds() / 3600;
        if (!currentSegment) {
          currentSegment = { start: timeInHours, end: timeInHours };
        } else {
          const previousLogTime = new Date(sortedLogs[index - 1].timestamp);
          const timeDiff = logTime - previousLogTime;
          if (timeDiff < SESSION_GAP_THRESHOLD) {
            currentSegment.end = timeInHours;
          } else {
            newSegments.push(currentSegment);
            currentSegment = { start: timeInHours, end: timeInHours };
          }
        }
      });
      if (currentSegment) {
        newSegments.push(currentSegment);
      }
      return newSegments;
    };

    const processActivityLogs = (
      sortedLogs,
      sessionStartTime,
      sessionEndTime
    ) => {
      if (
        !sortedLogs ||
        sortedLogs.length === 0 ||
        !sessionStartTime ||
        !sessionEndTime
      ) {
        return [];
      }
      const activityLogs = sortedLogs.filter(
        (log) => log.type === "app_activated" || log.type === "app_deactivated"
      );
      const sessionStartHours =
        sessionStartTime.getHours() +
        sessionStartTime.getMinutes() / 60 +
        sessionStartTime.getSeconds() / 3600;
      const sessionEndHours =
        sessionEndTime.getHours() +
        sessionEndTime.getMinutes() / 60 +
        sessionEndTime.getSeconds() / 3600;
      const activitySegments = [];
      let currentActiveStart = null;
      const sortedActivityLogs = activityLogs.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      let wasActiveAtStart = false;
      for (let i = sortedActivityLogs.length - 1; i >= 0; i--) {
        const log = sortedActivityLogs[i];
        const logTime = new Date(log.timestamp);
        if (logTime < sessionStartTime) {
          wasActiveAtStart = log.type === "app_activated";
          break;
        }
      }
      if (wasActiveAtStart) {
        currentActiveStart = sessionStartHours;
      }
      sortedActivityLogs.forEach((log) => {
        const logTime = new Date(log.timestamp);
        const timeInHours =
          logTime.getHours() +
          logTime.getMinutes() / 60 +
          logTime.getSeconds() / 3600;
        if (timeInHours < sessionStartHours || timeInHours > sessionEndHours) {
          return;
        }
        if (log.type === "app_deactivated") {
          if (currentActiveStart !== null) {
            activitySegments.push({
              start: Math.max(currentActiveStart, sessionStartHours),
              end: Math.min(timeInHours, sessionEndHours),
            });
            currentActiveStart = null;
          }
        } else if (log.type === "app_activated") {
          currentActiveStart = Math.max(timeInHours, sessionStartHours);
        }
      });
      if (currentActiveStart !== null) {
        activitySegments.push({
          start: currentActiveStart,
          end: sessionEndHours,
        });
      }
      return activitySegments;
    };

    const extractFilesFromLogs = (logs) => {
      const fileSet = new Set();
      logs.forEach((log) => {
        if (log.filename && log.filename.trim() !== "") {
          fileSet.add(log.filename.trim());
        }
      });
      return Array.from(fileSet);
    };

    setLoading(true);
    fetch("http://localhost:3001/api/logs")
      .then((res) => res.json())
      .then((data) => {
        const sortedLogs = data.sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        setLogs(sortedLogs);

        // Extract unique files from logs
        const uniqueFiles = extractFilesFromLogs(sortedLogs);
        setFiles(uniqueFiles);

        const keystrokeLogs = sortedLogs.filter(
          (log) => log.type === "insert" || log.type === "delete"
        );
        setKeystrokeLogs(keystrokeLogs);
        const processedSegments = processLogsIntoSegments(sortedLogs);
        setSegments(processedSegments);
        if (keystrokeLogs.length > 0) {
          const firstKeystrokeTime = new Date(keystrokeLogs[0].timestamp);
          const lastKeystrokeTime = new Date(
            keystrokeLogs[keystrokeLogs.length - 1].timestamp
          );
          setSessionStartTime(firstKeystrokeTime);
          setSessionEndTime(lastKeystrokeTime);
          const processedActivitySegments = processActivityLogs(
            sortedLogs,
            firstKeystrokeTime,
            lastKeystrokeTime
          );
          setActivitySegments(processedActivitySegments);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return {
    logs,
    keystrokeLogs,
    segments,
    activitySegments,
    sessionStartTime,
    sessionEndTime,
    files,
    loading,
    error,
  };
}
