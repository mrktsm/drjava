import { keystrokeIndexToTimelinePosition } from "./keystrokePlaybackUtils";

/**
 * Generates a distinct color for a file based on its index
 * @param {number} fileIndex - The index of the file
 * @returns {string} A hex color string
 */
export function getFileColor(fileIndex) {
  // Predefined set of distinct, visually appealing colors
  const colors = [
    "#2196F3", // Blue
    "#4CAF50", // Green
    "#FF9800", // Orange
    "#9C27B0", // Purple
    "#F44336", // Red
    "#00BCD4", // Cyan
    "#FFEB3B", // Yellow
    "#795548", // Brown
    "#607D8B", // Blue Grey
    "#E91E63", // Pink
    "#3F51B5", // Indigo
    "#8BC34A", // Light Green
    "#FF5722", // Deep Orange
    "#673AB7", // Deep Purple
    "#009688", // Teal
  ];

  return colors[fileIndex % colors.length];
}

/**
 * Gets a lighter version of a color for backgrounds
 * @param {string} color - Hex color string
 * @returns {string} A lighter hex color string
 */
export function getLighterColor(color) {
  // Remove # if present
  const hex = color.replace("#", "");

  // Parse RGB components
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Make it lighter by adding to each component (closer to white)
  const lighter = (component) =>
    Math.min(255, Math.floor(component + (255 - component) * 0.7));

  const newR = lighter(r).toString(16).padStart(2, "0");
  const newG = lighter(g).toString(16).padStart(2, "0");
  const newB = lighter(b).toString(16).padStart(2, "0");

  return `#${newR}${newG}${newB}`;
}

/**
 * Creates a mapping of filenames to colors
 * @param {Array<string>} files - Array of filenames
 * @returns {Object} Object mapping filename to color
 */
export function createFileColorMap(files) {
  const colorMap = {};
  files.forEach((filename, index) => {
    colorMap[filename] = getFileColor(index);
  });
  return colorMap;
}

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
        // End the segment exactly at the current keystroke position (no gap)
        const segmentEndTime = keystrokeIndexToTimelinePosition(
          i,
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
