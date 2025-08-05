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
  const [compileEvents, setCompileEvents] = useState([]);
  const [runEvents, setRunEvents] = useState([]);

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

      // Filter keystroke logs to get session boundaries
      const keystrokeLogs = sortedLogs.filter(
        (log) => log.type === "insert" || log.type === "delete"
      );

      if (keystrokeLogs.length === 0) {
        return [];
      }

      const activityLogs = sortedLogs.filter(
        (log) => log.type === "app_activated" || log.type === "app_deactivated"
      );

      // Use keystroke session boundaries for everything
      const firstKeystrokeTime = new Date(keystrokeLogs[0].timestamp);
      const lastKeystrokeTime = new Date(
        keystrokeLogs[keystrokeLogs.length - 1].timestamp
      );

      console.log("=== ACTIVITY PROCESSING DEBUG ===");
      console.log("First keystroke:", firstKeystrokeTime.toISOString());
      console.log("Last keystroke:", lastKeystrokeTime.toISOString());
      console.log("Total activity events:", activityLogs.length);

      // Calculate session start/end using same logic as keystroke system
      const sessionStartHours =
        sessionStartTime.getHours() +
        sessionStartTime.getMinutes() / 60 +
        sessionStartTime.getSeconds() / 3600;
      const sessionEndHours =
        sessionEndTime.getHours() +
        sessionEndTime.getMinutes() / 60 +
        sessionEndTime.getSeconds() / 3600;
      const sessionDuration = sessionEndHours - sessionStartHours;

      // Filter activity logs to only those within the keystroke session time range
      const filteredActivityLogs = activityLogs.filter((log) => {
        const logTime = new Date(log.timestamp);
        return logTime >= firstKeystrokeTime && logTime <= lastKeystrokeTime;
      });

      console.log(
        "Filtered activity events within session:",
        filteredActivityLogs.length
      );
      filteredActivityLogs.forEach((log, i) => {
        console.log(`  ${i}: ${log.timestamp} - ${log.type}`);
      });

      // Helper function to convert activity timestamp to timeline position
      const activityTimeToTimelinePosition = (timestamp) => {
        const activityTime = new Date(timestamp);

        // Use the EXACT same calculation as keystroke positioning!
        const totalSessionMs = lastKeystrokeTime - firstKeystrokeTime;

        if (totalSessionMs === 0) {
          return sessionStartHours;
        }

        // Calculate progress relative to keystroke session boundaries (same as keystrokes)
        const progressThroughSession =
          (activityTime - firstKeystrokeTime) / totalSessionMs;

        // Clamp to valid range as a safety measure
        const clampedProgress = Math.max(
          0,
          Math.min(1, progressThroughSession)
        );

        return sessionStartHours + clampedProgress * sessionDuration;
      };

      const activitySegments = [];
      let currentActiveStart = null;
      const sortedActivityLogs = filteredActivityLogs.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      // Check if app was active at session start
      let wasActiveAtStart = false;
      const allSortedActivityLogs = activityLogs.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      // Find the actual app state at the time of the first keystroke
      // We need to trace through all activity events up to the first keystroke
      let currentState = false; // Assume inactive by default

      for (let i = 0; i < allSortedActivityLogs.length; i++) {
        const log = allSortedActivityLogs[i];
        const logTime = new Date(log.timestamp);

        // Stop when we reach events at or after the first keystroke
        if (logTime >= firstKeystrokeTime) {
          break;
        }

        // Update the current state based on this event
        if (log.type === "app_activated") {
          currentState = true;
          console.log(`Pre-keystroke activation: ${log.timestamp}`);
        } else if (log.type === "app_deactivated") {
          currentState = false;
          console.log(`Pre-keystroke deactivation: ${log.timestamp}`);
        }
      }

      wasActiveAtStart = currentState;
      console.log(
        `App state at first keystroke (${firstKeystrokeTime.toISOString()}): ${
          wasActiveAtStart ? "ACTIVE" : "INACTIVE"
        }`
      );

      if (wasActiveAtStart) {
        currentActiveStart = sessionStartHours;
        console.log("Starting with app active from session beginning");
      }

      // Process activity events within the session
      sortedActivityLogs.forEach((log, index) => {
        const timelinePosition = activityTimeToTimelinePosition(log.timestamp);
        console.log(
          `Processing event ${index}: ${log.timestamp} - ${log.type} -> timeline pos: ${timelinePosition}`
        );

        if (log.type === "app_deactivated") {
          if (currentActiveStart !== null) {
            const segment = {
              start: Math.max(currentActiveStart, sessionStartHours),
              end: Math.min(timelinePosition, sessionEndHours),
            };

            // Filter out very short segments (≤10ms equivalent in hours)
            const segmentDurationHours = segment.end - segment.start;
            const segmentDurationMs = segmentDurationHours * 3600 * 1000;

            console.log(
              `  -> Potential segment: ${segment.start} to ${segment.end} (${segmentDurationMs}ms)`
            );

            // Only add segments longer than 10ms
            if (segmentDurationMs > 10) {
              activitySegments.push(segment);
              console.log(
                `  -> Added segment: ${segment.start} to ${segment.end}`
              );
            } else {
              console.log(
                `  -> Filtered out short segment (${segmentDurationMs}ms)`
              );
            }

            currentActiveStart = null;
          }
        } else if (log.type === "app_activated") {
          currentActiveStart = Math.max(timelinePosition, sessionStartHours);
          console.log(
            `  -> Started new active period at: ${currentActiveStart}`
          );
        }
      });

      // Close any remaining active segment at session end
      if (currentActiveStart !== null) {
        const finalSegment = {
          start: currentActiveStart,
          end: sessionEndHours,
        };

        // Apply the same 10ms filter to the final segment
        const segmentDurationHours = finalSegment.end - finalSegment.start;
        const segmentDurationMs = segmentDurationHours * 3600 * 1000;

        console.log(
          `Final segment: ${finalSegment.start} to ${finalSegment.end} (${segmentDurationMs}ms)`
        );

        if (segmentDurationMs > 10) {
          activitySegments.push(finalSegment);
          console.log("Added final segment");
        } else {
          console.log("Filtered out short final segment");
        }
      }

      console.log(`Pre-merge activity segments: ${activitySegments.length}`);
      activitySegments.forEach((seg, i) => {
        console.log(`  ${i}: ${seg.start} to ${seg.end}`);
      });

      // Filter out inactive periods (gaps) that are too short to be meaningful
      // This merges activity segments that have very short gaps between them
      const MIN_INACTIVE_DURATION_MS = 500; // Filter out inactive periods shorter than 500ms
      const MIN_GAP_DURATION_SECONDS = 2; // Still merge gaps shorter than 2 seconds for UI clarity
      const mergedSegments = [];

      for (let i = 0; i < activitySegments.length; i++) {
        const currentSegment = activitySegments[i];

        if (mergedSegments.length === 0) {
          mergedSegments.push({ ...currentSegment });
          continue;
        }

        const lastMergedSegment = mergedSegments[mergedSegments.length - 1];
        const gapDurationHours = currentSegment.start - lastMergedSegment.end;
        const gapDurationMs = gapDurationHours * 3600 * 1000;
        const gapDurationSeconds = gapDurationMs / 1000;

        // If the inactive period (gap) is very short, merge the segments
        if (
          gapDurationMs < MIN_INACTIVE_DURATION_MS ||
          gapDurationSeconds < MIN_GAP_DURATION_SECONDS
        ) {
          console.log(
            `Merging segments: inactive period of ${gapDurationMs}ms (${gapDurationSeconds}s) is too short`
          );
          lastMergedSegment.end = Math.max(
            lastMergedSegment.end,
            currentSegment.end
          );
        } else {
          // Gap is significant, keep as separate segment
          console.log(
            `Keeping separate: inactive period of ${gapDurationMs}ms (${gapDurationSeconds}s) is significant`
          );
          mergedSegments.push({ ...currentSegment });
        }
      }

      console.log(`Final merged activity segments: ${mergedSegments.length}`);
      mergedSegments.forEach((seg, i) => {
        console.log(`  ${i}: ${seg.start} to ${seg.end}`);
      });
      console.log("=== END ACTIVITY DEBUG ===");

      return mergedSegments;
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

    // Use current host and port instead of hardcoded localhost:3001
    const apiUrl = `${window.location.protocol}//${window.location.host}/api/logs`;

    fetch(apiUrl)
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

        // Extract compile events (compile_started and compile_ended)
        const compileEventLogs = sortedLogs.filter(
          (log) =>
            log.type === "compile_started" || log.type === "compile_ended"
        );
        setCompileEvents(compileEventLogs);

        // Extract run events (android_run_started)
        const runEventLogs = sortedLogs.filter(
          (log) => log.type === "android_run_started"
        );
        setRunEvents(runEventLogs);

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
    compileEvents,
    runEvents,
  };
}
