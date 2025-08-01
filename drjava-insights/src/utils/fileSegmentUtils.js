import { keystrokeIndexToTimelinePosition } from "./keystrokePlaybackUtils";

/**
 * Calculates file segments from keystroke logs to show file-based timeline segmentation.
 * Each segment represents a continuous period of work on a specific file.
 *
 * @param {Array<Object>} keystrokeLogs - Array of keystroke log objects with timestamp and filename
 * @param {number} sessionStart - Session start time (in hours)
 * @param {number} sessionDuration - Total session duration (in hours)
 * @returns {Array<Object>} Array of file segments with start, end, filename, and startIndex, endIndex
 */
export function calculateFileSegments(
  keystrokeLogs,
  sessionStart,
  sessionDuration
) {
  if (!keystrokeLogs || keystrokeLogs.length === 0) {
    return [];
  }

  const segments = [];
  let currentFile = null;
  let segmentStartIndex = 0;

  for (let i = 0; i < keystrokeLogs.length; i++) {
    const keystroke = keystrokeLogs[i];
    const filename = keystroke.filename || "untitled_document";

    // If this is a new file or the first keystroke
    if (currentFile !== filename) {
      // If we were tracking a previous file, close that segment
      if (currentFile !== null) {
        const segmentStartTime = keystrokeIndexToTimelinePosition(
          segmentStartIndex,
          keystrokeLogs,
          sessionStart,
          sessionDuration
        );
        const segmentEndTime = keystrokeIndexToTimelinePosition(
          i - 1,
          keystrokeLogs,
          sessionStart,
          sessionDuration
        );

        segments.push({
          filename: currentFile,
          start: segmentStartTime,
          end: segmentEndTime,
          startIndex: segmentStartIndex,
          endIndex: i - 1,
        });
      }

      // Start a new segment for the current file
      currentFile = filename;
      segmentStartIndex = i;
    }
  }

  // Close the final segment
  if (currentFile !== null && keystrokeLogs.length > 0) {
    const segmentStartTime = keystrokeIndexToTimelinePosition(
      segmentStartIndex,
      keystrokeLogs,
      sessionStart,
      sessionDuration
    );
    const segmentEndTime = keystrokeIndexToTimelinePosition(
      keystrokeLogs.length - 1,
      keystrokeLogs,
      sessionStart,
      sessionDuration
    );

    segments.push({
      filename: currentFile,
      start: segmentStartTime,
      end: segmentEndTime,
      startIndex: segmentStartIndex,
      endIndex: keystrokeLogs.length - 1,
    });
  }

  return segments;
}

/**
 * Gets the current file segment based on the current keystroke index
 *
 * @param {Array<Object>} fileSegments - Array of file segments
 * @param {number} currentKeystrokeIndex - Current keystroke index
 * @returns {Object|null} Current file segment or null if none found
 */
export function getCurrentFileSegment(fileSegments, currentKeystrokeIndex) {
  return (
    fileSegments.find(
      (segment) =>
        currentKeystrokeIndex >= segment.startIndex &&
        currentKeystrokeIndex <= segment.endIndex
    ) || null
  );
}

/**
 * Calculates the progress within the current file segment
 *
 * @param {Object} currentSegment - Current file segment
 * @param {number} currentKeystrokeIndex - Current keystroke index
 * @param {Array<Object>} keystrokeLogs - Array of keystroke logs
 * @param {number} sessionStart - Session start time (in hours)
 * @param {number} sessionDuration - Total session duration (in hours)
 * @returns {number} Current time position within the segment
 */
export function getCurrentTimeInSegment(
  currentSegment,
  currentKeystrokeIndex,
  keystrokeLogs,
  sessionStart,
  sessionDuration
) {
  if (!currentSegment || !keystrokeLogs[currentKeystrokeIndex]) {
    return currentSegment ? currentSegment.start : sessionStart;
  }

  return keystrokeIndexToTimelinePosition(
    currentKeystrokeIndex,
    keystrokeLogs,
    sessionStart,
    sessionDuration
  );
}
