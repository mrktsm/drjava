import { useState, useEffect } from "react";

export default function useLogs() {
  const [logs, setLogs] = useState([]);
  const [keystrokeLogs, setKeystrokeLogs] = useState([]);
  const [segments, setSegments] = useState([]);
  const [activitySegments, setActivitySegments] = useState([]);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionEndTime, setSessionEndTime] = useState(null);
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

    setLoading(true);
    fetch("http://localhost:3001/api/logs")
      .then((res) => res.json())
      .then((data) => {
        const sortedLogs = data.sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        setLogs(sortedLogs);
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
    loading,
    error,
  };
}
