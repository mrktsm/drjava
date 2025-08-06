import {
  originalToCompressedTimelinePosition,
  compressedToOriginalTimelinePosition,
} from "./timelineCompression";

/**
 * Converts a keystroke's zero-based index to its corresponding position on the compressed timeline.
 * This is the compressed version of keystrokeIndexToTimelinePosition.
 *
 * @param {number} keystrokeIndex - The index of the keystroke in the original logs
 * @param {Array<object>} originalKeystrokeLogs - Original keystroke logs
 * @param {Object} compressionData - Compression data from createCompressedTimeline
 * @param {number} sessionStart - The timeline's start value
 * @param {number} sessionDuration - The original timeline's total duration
 * @returns {number} The calculated compressed timeline position
 */
export function keystrokeIndexToCompressedTimelinePosition(
  keystrokeIndex,
  originalKeystrokeLogs,
  compressionData,
  sessionStart,
  sessionDuration
) {
  if (
    !originalKeystrokeLogs ||
    originalKeystrokeLogs.length === 0 ||
    !compressionData
  ) {
    return sessionStart;
  }

  // First, find the compressed keystroke that corresponds to this original index
  const compressedKeystroke = compressionData.compressedKeystrokeLogs.find(
    (ck) => ck.originalIndex === keystrokeIndex
  );

  if (!compressedKeystroke) {
    // If this keystroke was in a gap that was removed, find the closest active segment
    const activeSegment = compressionData.activeSegments.find(
      (segment) =>
        keystrokeIndex >= segment.startKeystrokeIndex &&
        keystrokeIndex <= segment.endKeystrokeIndex
    );

    if (activeSegment) {
      // Map to the start of this active segment in compressed time
      const compressedFirstTime = new Date(
        compressionData.activeSegments[0].compressedStartTime
      );
      const compressedProgress =
        (activeSegment.compressedStartTime - compressedFirstTime) /
        compressionData.totalCompressedDuration;
      const compressedDurationHours =
        compressionData.totalCompressedDuration / (1000 * 60 * 60);

      return sessionStart + compressedProgress * compressedDurationHours;
    } else {
      // Keystroke is in a gap, map to the nearest boundary
      return sessionStart;
    }
  }

  // Use the compressed timestamp for authentic positioning
  const compressedTime = new Date(compressedKeystroke.timestamp);
  const compressedFirstTime = new Date(
    compressionData.compressedKeystrokeLogs[0].timestamp
  );

  // Use the total compressed duration which includes buffers, not just keystroke span
  const totalCompressedMs = compressionData.totalCompressedDuration;

  // Handle edge case where all keystrokes have the same timestamp
  if (totalCompressedMs === 0) {
    return sessionStart;
  }

  const progressThroughSession =
    (compressedTime - compressedFirstTime) / totalCompressedMs;
  const compressedDurationHours =
    compressionData.totalCompressedDuration / (1000 * 60 * 60);

  return sessionStart + progressThroughSession * compressedDurationHours;
}

/**
 * Converts a position on the compressed timeline back to a corresponding keystroke index.
 * This is the compressed version of timelinePositionToKeystrokeIndex.
 *
 * @param {number} compressedTimelinePos - The position on the compressed timeline
 * @param {Array<object>} originalKeystrokeLogs - Original keystroke logs
 * @param {Object} compressionData - Compression data from createCompressedTimeline
 * @param {number} sessionStart - The timeline's start value
 * @param {number} sessionDuration - The original timeline's total duration
 * @returns {number} The calculated zero-based keystroke index in original logs
 */
export function compressedTimelinePositionToKeystrokeIndex(
  compressedTimelinePos,
  originalKeystrokeLogs,
  compressionData,
  sessionStart,
  sessionDuration
) {
  if (
    !originalKeystrokeLogs ||
    originalKeystrokeLogs.length === 0 ||
    !compressionData
  ) {
    return 0;
  }

  const compressedKeystrokeLogs = compressionData.compressedKeystrokeLogs;
  if (compressedKeystrokeLogs.length === 0) {
    return 0;
  }

  const compressedDurationHours =
    compressionData.totalCompressedDuration / (1000 * 60 * 60);
  const progress = Math.max(
    0,
    Math.min(
      1,
      (compressedTimelinePos - sessionStart) / compressedDurationHours
    )
  );

  // Handle edge cases
  if (progress === 0) return compressedKeystrokeLogs[0].originalIndex;
  if (progress === 1)
    return compressedKeystrokeLogs[compressedKeystrokeLogs.length - 1]
      .originalIndex;

  // Use compressed timestamps to find the closest keystroke
  const compressedFirstTime = new Date(compressedKeystrokeLogs[0].timestamp);

  // Use the total compressed duration which includes buffers, not just keystroke span
  const totalCompressedMs = compressionData.totalCompressedDuration;

  // Handle edge case where all keystrokes have the same timestamp
  if (totalCompressedMs === 0) {
    const targetIndex = Math.round(
      progress * (compressedKeystrokeLogs.length - 1)
    );
    return compressedKeystrokeLogs[targetIndex].originalIndex;
  }

  const targetTime = new Date(
    compressedFirstTime.getTime() + progress * totalCompressedMs
  );

  // Find the compressed keystroke closest to the target time
  let closestIndex = 0;
  let closestDistance = Math.abs(
    new Date(compressedKeystrokeLogs[0].timestamp) - targetTime
  );

  for (let i = 1; i < compressedKeystrokeLogs.length; i++) {
    const distance = Math.abs(
      new Date(compressedKeystrokeLogs[i].timestamp) - targetTime
    );
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }

  // Return the original index of the closest compressed keystroke
  return compressedKeystrokeLogs[closestIndex].originalIndex;
}

/**
 * Calculates compressed file segments based on compressed keystroke logs.
 *
 * @param {Object} compressionData - Compression data from createCompressedTimeline
 * @param {number} sessionStart - Session start time (in hours)
 * @param {number} sessionDuration - Compressed session duration (in hours)
 * @returns {Array<Object>} Array of compressed file segments
 */
export function calculateCompressedFileSegments(
  compressionData,
  sessionStart,
  sessionDuration
) {
  if (
    !compressionData ||
    !compressionData.compressedKeystrokeLogs ||
    compressionData.compressedKeystrokeLogs.length === 0
  ) {
    return [];
  }

  const compressedKeystrokeLogs = compressionData.compressedKeystrokeLogs;
  const segments = [];
  let currentFile = null;
  let segmentStartIndex = 0;

  for (let i = 0; i < compressedKeystrokeLogs.length; i++) {
    const keystroke = compressedKeystrokeLogs[i];
    const filename = keystroke.filename || "untitled_document";

    // If this is a new file or the first keystroke
    if (currentFile !== filename) {
      // If we were tracking a previous file, close that segment
      if (currentFile !== null) {
        const segmentStartTime = compressedKeystrokeIndexToTimelinePosition(
          segmentStartIndex,
          compressionData,
          sessionStart,
          sessionDuration
        );
        const segmentEndTime = compressedKeystrokeIndexToTimelinePosition(
          i,
          compressionData,
          sessionStart,
          sessionDuration
        );

        segments.push({
          filename: currentFile,
          start: segmentStartTime,
          end: segmentEndTime,
          startIndex: compressedKeystrokeLogs[segmentStartIndex].originalIndex,
          endIndex: compressedKeystrokeLogs[i - 1].originalIndex,
        });
      }

      // Start a new segment for the current file
      currentFile = filename;
      segmentStartIndex = i;
    }
  }

  // Close the final segment
  if (currentFile !== null && compressedKeystrokeLogs.length > 0) {
    const segmentStartTime = compressedKeystrokeIndexToTimelinePosition(
      segmentStartIndex,
      compressionData,
      sessionStart,
      sessionDuration
    );
    const segmentEndTime = compressedKeystrokeIndexToTimelinePosition(
      compressedKeystrokeLogs.length - 1,
      compressionData,
      sessionStart,
      sessionDuration
    );

    segments.push({
      filename: currentFile,
      start: segmentStartTime,
      end: segmentEndTime,
      startIndex: compressedKeystrokeLogs[segmentStartIndex].originalIndex,
      endIndex:
        compressedKeystrokeLogs[compressedKeystrokeLogs.length - 1]
          .originalIndex,
    });
  }

  return segments;
}

/**
 * Helper function to convert compressed keystroke index to timeline position
 * (for use within compressed segments)
 */
function compressedKeystrokeIndexToTimelinePosition(
  compressedIndex,
  compressionData,
  sessionStart,
  sessionDuration
) {
  if (
    !compressionData.compressedKeystrokeLogs ||
    compressionData.compressedKeystrokeLogs.length === 0
  ) {
    return sessionStart;
  }

  const compressedKeystroke =
    compressionData.compressedKeystrokeLogs[
      Math.min(
        compressedIndex,
        compressionData.compressedKeystrokeLogs.length - 1
      )
    ];
  const compressedFirstTime = new Date(
    compressionData.compressedKeystrokeLogs[0].timestamp
  );

  const compressedTime = new Date(compressedKeystroke.timestamp);

  // Use the total compressed duration which includes buffers, not just keystroke span
  const totalCompressedMs = compressionData.totalCompressedDuration;

  if (totalCompressedMs === 0) {
    return sessionStart;
  }

  const progressThroughSession =
    (compressedTime - compressedFirstTime) / totalCompressedMs;
  const compressedDurationHours =
    compressionData.totalCompressedDuration / (1000 * 60 * 60);

  return sessionStart + progressThroughSession * compressedDurationHours;
}
