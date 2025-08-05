import { useState, useEffect, useMemo } from "react";
import { keystrokeIndexToTimelinePosition } from "../utils/keystrokePlaybackUtils";

/**
 * Custom hook to detect and track typing activity based on keystroke timing.
 *
 * This hook analyzes keystroke patterns to determine:
 * - Whether the user is currently actively typing
 * - Periods of high vs low typing activity
 * - Activity status at any given point in the timeline
 *
 * @param {Array<Object>} keystrokeLogs - Array of keystroke log objects
 * @param {number} currentKeystrokeIndex - Current position in keystroke playback
 * @param {boolean} isPlaying - Whether playback is currently active
 * @param {number} sessionStart - Session start time (in hours)
 * @param {number} sessionDuration - Total session duration (in hours)
 * @returns {Object} Activity state and analysis
 */
export default function useTypingActivity({
  keystrokeLogs = [],
  currentKeystrokeIndex = 0,
  isPlaying = false,
  sessionStart = 0,
  sessionDuration = 24,
}) {
  const [isActivelyTyping, setIsActivelyTyping] = useState(false);

  // Calculate typing activity segments using proper keystroke positioning
  const typingActivitySegments = useMemo(() => {
    if (!keystrokeLogs || keystrokeLogs.length === 0) {
      return [];
    }

    const segments = [];
    const ACTIVE_TYPING_THRESHOLD_MS = 3000; // If keystrokes are within 3 seconds, consider it active typing
    const MIN_SEGMENT_KEYSTROKES = 3; // Minimum keystrokes to be considered a meaningful segment

    let currentSegmentStart = null;
    let currentSegmentKeystrokes = [];

    for (let i = 0; i < keystrokeLogs.length; i++) {
      const currentKeystroke = keystrokeLogs[i];
      const currentTime = new Date(currentKeystroke.timestamp);

      // Check if this keystroke continues the current typing segment
      let continuesSegment = false;

      if (currentSegmentKeystrokes.length > 0) {
        const lastKeystroke =
          currentSegmentKeystrokes[currentSegmentKeystrokes.length - 1];
        const lastTime = new Date(lastKeystroke.timestamp);
        const timeDiff = currentTime - lastTime;

        continuesSegment = timeDiff <= ACTIVE_TYPING_THRESHOLD_MS;
      }

      if (continuesSegment || currentSegmentKeystrokes.length === 0) {
        // Continue or start a new segment
        if (currentSegmentKeystrokes.length === 0) {
          currentSegmentStart = i;
        }
        currentSegmentKeystrokes.push(currentKeystroke);
      } else {
        // End the current segment and start a new one
        if (currentSegmentKeystrokes.length >= MIN_SEGMENT_KEYSTROKES) {
          // Create segment using keystroke positioning
          const segmentStartTime = keystrokeIndexToTimelinePosition(
            currentSegmentStart,
            keystrokeLogs,
            sessionStart,
            sessionDuration
          );
          const segmentEndTime = keystrokeIndexToTimelinePosition(
            currentSegmentStart + currentSegmentKeystrokes.length - 1,
            keystrokeLogs,
            sessionStart,
            sessionDuration
          );

          segments.push({
            start: segmentStartTime,
            end: segmentEndTime,
            startIndex: currentSegmentStart,
            endIndex: currentSegmentStart + currentSegmentKeystrokes.length - 1,
            type: "active",
            keystrokeCount: currentSegmentKeystrokes.length,
          });
        }

        // Start new segment with current keystroke
        currentSegmentStart = i;
        currentSegmentKeystrokes = [currentKeystroke];
      }
    }

    // Don't forget to add the final segment
    if (currentSegmentKeystrokes.length >= MIN_SEGMENT_KEYSTROKES) {
      const segmentStartTime = keystrokeIndexToTimelinePosition(
        currentSegmentStart,
        keystrokeLogs,
        sessionStart,
        sessionDuration
      );
      const segmentEndTime = keystrokeIndexToTimelinePosition(
        currentSegmentStart + currentSegmentKeystrokes.length - 1,
        keystrokeLogs,
        sessionStart,
        sessionDuration
      );

      segments.push({
        start: segmentStartTime,
        end: segmentEndTime,
        startIndex: currentSegmentStart,
        endIndex: currentSegmentStart + currentSegmentKeystrokes.length - 1,
        type: "active",
        keystrokeCount: currentSegmentKeystrokes.length,
      });
    }

    return segments;
  }, [keystrokeLogs, sessionStart, sessionDuration]);

  // Determine current typing activity status
  useEffect(() => {
    if (!keystrokeLogs || keystrokeLogs.length === 0) {
      setIsActivelyTyping(false);
      return;
    }

    const currentKeystroke = keystrokeLogs[currentKeystrokeIndex];
    if (!currentKeystroke) {
      setIsActivelyTyping(false);
      return;
    }

    // Check if current keystroke index is within an active typing segment
    const activeSegment = typingActivitySegments.find(
      (segment) =>
        currentKeystrokeIndex >= segment.startIndex &&
        currentKeystrokeIndex <= segment.endIndex
    );

    setIsActivelyTyping(!!activeSegment && isPlaying);
  }, [currentKeystrokeIndex, keystrokeLogs, typingActivitySegments, isPlaying]);

  // Get activity status for a specific keystroke index
  const getActivityAtIndex = (index) => {
    if (!keystrokeLogs || index < 0 || index >= keystrokeLogs.length) {
      return "inactive";
    }

    const activeSegment = typingActivitySegments.find(
      (segment) => index >= segment.startIndex && index <= segment.endIndex
    );

    return activeSegment ? "active" : "inactive";
  };

  // Calculate typing speed (keystrokes per minute) for current window
  const getCurrentTypingSpeed = () => {
    if (!keystrokeLogs || currentKeystrokeIndex < 10) {
      return 0;
    }

    // Look at last 10 keystrokes to calculate speed
    const windowSize = Math.min(10, currentKeystrokeIndex + 1);
    const startIndex = currentKeystrokeIndex - windowSize + 1;
    const endIndex = currentKeystrokeIndex;

    const startTime = new Date(keystrokeLogs[startIndex].timestamp);
    const endTime = new Date(keystrokeLogs[endIndex].timestamp);
    const timeDiffMinutes = (endTime - startTime) / (1000 * 60);

    if (timeDiffMinutes === 0) return 0;

    return Math.round(windowSize / timeDiffMinutes);
  };

  return {
    isActivelyTyping,
    typingActivitySegments,
    getActivityAtIndex,
    getCurrentTypingSpeed,
    hasActivity: typingActivitySegments.length > 0,
  };
}
