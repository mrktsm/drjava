/**
 * Timeline compression utility for detecting and removing inactive gaps from the coding timeline.
 *
 * This utility analyzes keystroke logs to identify periods of inactivity longer than a threshold,
 * then creates a compressed timeline that removes these gaps while preserving the relative timing
 * of active coding periods. It maintains small buffer periods around gaps for better context.
 */

/**
 * Default threshold for considering a gap "inactive" (in milliseconds)
 * 3 minutes = 3 * 60 * 1000 = 180,000 ms
 */
export const DEFAULT_GAP_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Default buffer time to keep on each side of a gap (in milliseconds)
 * 3 seconds = 3 * 1000 = 3,000 ms
 */
export const DEFAULT_BUFFER_MS = 3 * 1000; // 3 seconds

/**
 * Detects gaps in keystroke activity that are longer than the specified threshold.
 *
 * @param {Array<Object>} keystrokeLogs - Array of keystroke log objects with timestamps
 * @param {number} gapThresholdMs - Threshold in milliseconds for considering a gap inactive
 * @param {number} bufferMs - Buffer time to keep on each side of gaps
 * @returns {Array<Object>} Array of gap objects with start, end, and duration info
 */
export function detectActivityGaps(
  keystrokeLogs,
  gapThresholdMs = DEFAULT_GAP_THRESHOLD_MS,
  bufferMs = DEFAULT_BUFFER_MS
) {
  if (!keystrokeLogs || keystrokeLogs.length < 2) {
    return [];
  }

  const gaps = [];

  for (let i = 0; i < keystrokeLogs.length - 1; i++) {
    const currentTime = new Date(keystrokeLogs[i].timestamp);
    const nextTime = new Date(keystrokeLogs[i + 1].timestamp);
    const gapDuration = nextTime - currentTime;

    if (gapDuration > gapThresholdMs) {
      // Calculate the actual gap to be removed (excluding buffers)
      const bufferTotal = bufferMs * 2; // Buffer on each side
      const removedDuration = Math.max(0, gapDuration - bufferTotal);

      gaps.push({
        startKeystrokeIndex: i,
        endKeystrokeIndex: i + 1,
        startTime: currentTime,
        endTime: nextTime,
        duration: gapDuration,
        removedDuration: removedDuration, // Duration actually removed from timeline
        bufferMs: bufferMs, // Buffer kept on each side
        durationMinutes: Math.round(gapDuration / (1000 * 60)),
        durationHours: gapDuration / (1000 * 60 * 60),
      });
    }
  }

  return gaps;
}

/**
 * Creates a compressed timeline that removes gaps longer than the threshold.
 * Keeps small buffer periods around gaps for better context.
 *
 * @param {Array<Object>} keystrokeLogs - Array of keystroke log objects
 * @param {number} gapThresholdMs - Threshold for gap detection
 * @param {number} bufferMs - Buffer time to keep on each side of gaps
 * @returns {Object} Compressed timeline data structure
 */
export function createCompressedTimeline(
  keystrokeLogs,
  gapThresholdMs = DEFAULT_GAP_THRESHOLD_MS,
  bufferMs = DEFAULT_BUFFER_MS
) {
  if (!keystrokeLogs || keystrokeLogs.length === 0) {
    return {
      compressedKeystrokeLogs: [],
      gaps: [],
      totalOriginalDuration: 0,
      totalCompressedDuration: 0,
      compressionRatio: 1,
      activeSegments: [],
    };
  }

  const gaps = detectActivityGaps(keystrokeLogs, gapThresholdMs, bufferMs);

  // If no gaps detected, return original timeline
  if (gaps.length === 0) {
    const firstTime = new Date(keystrokeLogs[0].timestamp);
    const lastTime = new Date(
      keystrokeLogs[keystrokeLogs.length - 1].timestamp
    );
    const originalDuration = lastTime - firstTime;

    return {
      compressedKeystrokeLogs: [...keystrokeLogs],
      gaps: [],
      totalOriginalDuration: originalDuration,
      totalCompressedDuration: originalDuration,
      compressionRatio: 1,
      activeSegments: [
        {
          originalStartTime: firstTime,
          originalEndTime: lastTime,
          compressedStartTime: firstTime,
          compressedEndTime: lastTime,
          startKeystrokeIndex: 0,
          endKeystrokeIndex: keystrokeLogs.length - 1,
        },
      ],
    };
  }

  // Create active segments between gaps (including buffer periods)
  const activeSegments = [];
  const compressedKeystrokeLogs = [];
  let compressedTimeOffset = 0;
  const firstTime = new Date(keystrokeLogs[0].timestamp);

  // First segment (before first gap, including buffer before the gap)
  if (gaps[0].startKeystrokeIndex > 0) {
    const segmentEnd = gaps[0].startKeystrokeIndex;
    const originalStartTime = new Date(keystrokeLogs[0].timestamp);
    const originalEndTime = new Date(keystrokeLogs[segmentEnd].timestamp);

    // Add buffer time after the last keystroke in this segment (consistent with other segments)
    const segmentEndWithBuffer = new Date(originalEndTime.getTime() + bufferMs);
    const segmentDuration = segmentEndWithBuffer - originalStartTime;

    activeSegments.push({
      originalStartTime,
      originalEndTime: segmentEndWithBuffer,
      compressedStartTime: new Date(firstTime.getTime() + compressedTimeOffset),
      compressedEndTime: new Date(
        firstTime.getTime() + compressedTimeOffset + segmentDuration
      ),
      startKeystrokeIndex: 0,
      endKeystrokeIndex: segmentEnd,
      duration: segmentDuration,
    });

    // Add keystrokes for this segment with compressed timestamps
    // Use consistent positioning logic with other segments
    for (let i = 0; i <= segmentEnd; i++) {
      const originalKeystroke = keystrokeLogs[i];
      const originalTime = new Date(originalKeystroke.timestamp);
      const relativeTime = originalTime - originalStartTime; // Relative to original start
      const compressedTime = new Date(
        firstTime.getTime() + compressedTimeOffset + relativeTime // No buffer offset for first segment
      );

      compressedKeystrokeLogs.push({
        ...originalKeystroke,
        timestamp: compressedTime.toISOString(),
        originalTimestamp: originalKeystroke.timestamp,
        originalIndex: i,
      });
    }

    compressedTimeOffset += segmentDuration;
  }

  // Segments between gaps (including buffer periods)
  for (let gapIndex = 0; gapIndex < gaps.length; gapIndex++) {
    const currentGap = gaps[gapIndex];
    const nextGap = gaps[gapIndex + 1];

    const segmentStart = currentGap.endKeystrokeIndex;
    const segmentEnd = nextGap
      ? nextGap.startKeystrokeIndex
      : keystrokeLogs.length - 1;

    if (segmentStart <= segmentEnd) {
      const originalStartTime = new Date(keystrokeLogs[segmentStart].timestamp);
      const originalEndTime = new Date(keystrokeLogs[segmentEnd].timestamp);

      // Add buffer before this segment starts and after it ends (if there's a next gap)
      const segmentStartWithBuffer = new Date(
        originalStartTime.getTime() - bufferMs
      );
      const segmentEndWithBuffer = nextGap
        ? new Date(originalEndTime.getTime() + bufferMs)
        : originalEndTime;

      const segmentDuration = segmentEndWithBuffer - segmentStartWithBuffer;

      activeSegments.push({
        originalStartTime: segmentStartWithBuffer,
        originalEndTime: segmentEndWithBuffer,
        compressedStartTime: new Date(
          firstTime.getTime() + compressedTimeOffset
        ),
        compressedEndTime: new Date(
          firstTime.getTime() + compressedTimeOffset + segmentDuration
        ),
        startKeystrokeIndex: segmentStart,
        endKeystrokeIndex: segmentEnd,
        duration: segmentDuration,
      });

      // Add keystrokes for this segment with compressed timestamps
      // Note: Use original segment times for keystroke positioning to maintain cursor/progress alignment
      for (let i = segmentStart; i <= segmentEnd; i++) {
        const originalKeystroke = keystrokeLogs[i];
        const originalTime = new Date(originalKeystroke.timestamp);
        const relativeTime = originalTime - originalStartTime; // Use original start, not buffered
        const compressedTime = new Date(
          firstTime.getTime() + compressedTimeOffset + bufferMs + relativeTime // Add buffer offset
        );

        compressedKeystrokeLogs.push({
          ...originalKeystroke,
          timestamp: compressedTime.toISOString(),
          originalTimestamp: originalKeystroke.timestamp,
          originalIndex: i,
        });
      }

      compressedTimeOffset += segmentDuration;
    }
  }

  // Calculate durations and compression ratio
  const lastTime = new Date(keystrokeLogs[keystrokeLogs.length - 1].timestamp);
  const totalOriginalDuration = lastTime - firstTime;

  // Use the actual compressed timeline length (includes buffers and active segments)
  const totalCompressedDuration = compressedTimeOffset;

  const compressionRatio =
    totalOriginalDuration > 0
      ? totalCompressedDuration / totalOriginalDuration
      : 1;

  return {
    compressedKeystrokeLogs,
    gaps,
    totalOriginalDuration,
    totalCompressedDuration,
    compressionRatio,
    activeSegments,
  };
}

/**
 * Converts original timeline position to compressed timeline position.
 *
 * @param {number} originalTimelinePos - Position in original timeline (decimal hours)
 * @param {Object} compressionData - Data from createCompressedTimeline
 * @param {number} sessionStart - Original session start (decimal hours)
 * @param {number} sessionDuration - Original session duration (decimal hours)
 * @returns {number} Compressed timeline position (decimal hours)
 */
export function originalToCompressedTimelinePosition(
  originalTimelinePos,
  compressionData,
  sessionStart,
  sessionDuration
) {
  if (!compressionData || compressionData.activeSegments.length === 0) {
    return originalTimelinePos;
  }

  // Convert timeline position to actual timestamp
  const firstTime = new Date(
    compressionData.activeSegments[0].originalStartTime
  );
  const progressThroughSession =
    (originalTimelinePos - sessionStart) / sessionDuration;
  const targetTime = new Date(
    firstTime.getTime() +
      progressThroughSession * compressionData.totalOriginalDuration
  );

  // Find which active segment contains this time
  for (const segment of compressionData.activeSegments) {
    if (
      targetTime >= segment.originalStartTime &&
      targetTime <= segment.originalEndTime
    ) {
      // Calculate position within this segment
      const segmentProgress =
        (targetTime - segment.originalStartTime) /
        (segment.originalEndTime - segment.originalStartTime);
      const compressedTargetTime = new Date(
        segment.compressedStartTime.getTime() +
          segmentProgress *
            (segment.compressedEndTime - segment.compressedStartTime)
      );

      // Convert back to compressed timeline position
      const compressedFirstTime = new Date(
        compressionData.activeSegments[0].compressedStartTime
      );
      const compressedProgress =
        (compressedTargetTime - compressedFirstTime) /
        compressionData.totalCompressedDuration;

      return (
        sessionStart +
        compressedProgress *
          (compressionData.totalCompressedDuration / (1000 * 60 * 60))
      );
    }
  }

  // If not in any active segment, return closest boundary
  if (targetTime < compressionData.activeSegments[0].originalStartTime) {
    return sessionStart;
  } else {
    const lastSegment =
      compressionData.activeSegments[compressionData.activeSegments.length - 1];
    const compressedFirstTime = new Date(
      compressionData.activeSegments[0].compressedStartTime
    );
    const compressedProgress =
      (lastSegment.compressedEndTime - compressedFirstTime) /
      compressionData.totalCompressedDuration;

    return (
      sessionStart +
      compressedProgress *
        (compressionData.totalCompressedDuration / (1000 * 60 * 60))
    );
  }
}

/**
 * Converts compressed timeline position back to original timeline position.
 *
 * @param {number} compressedTimelinePos - Position in compressed timeline (decimal hours)
 * @param {Object} compressionData - Data from createCompressedTimeline
 * @param {number} sessionStart - Original session start (decimal hours)
 * @param {number} sessionDuration - Original session duration (decimal hours)
 * @returns {number} Original timeline position (decimal hours)
 */
export function compressedToOriginalTimelinePosition(
  compressedTimelinePos,
  compressionData,
  sessionStart,
  sessionDuration
) {
  if (!compressionData || compressionData.activeSegments.length === 0) {
    return compressedTimelinePos;
  }

  const compressedDurationHours =
    compressionData.totalCompressedDuration / (1000 * 60 * 60);
  const compressedProgress =
    (compressedTimelinePos - sessionStart) / compressedDurationHours;

  const compressedFirstTime = new Date(
    compressionData.activeSegments[0].compressedStartTime
  );
  const targetCompressedTime = new Date(
    compressedFirstTime.getTime() +
      compressedProgress * compressionData.totalCompressedDuration
  );

  // Find which active segment contains this compressed time
  for (const segment of compressionData.activeSegments) {
    if (
      targetCompressedTime >= segment.compressedStartTime &&
      targetCompressedTime <= segment.compressedEndTime
    ) {
      // Calculate position within this segment
      const segmentProgress =
        (targetCompressedTime - segment.compressedStartTime) /
        (segment.compressedEndTime - segment.compressedStartTime);
      const originalTargetTime = new Date(
        segment.originalStartTime.getTime() +
          segmentProgress *
            (segment.originalEndTime - segment.originalStartTime)
      );

      // Convert back to original timeline position
      const originalFirstTime = new Date(
        compressionData.activeSegments[0].originalStartTime
      );
      const originalProgress =
        (originalTargetTime - originalFirstTime) /
        compressionData.totalOriginalDuration;

      return sessionStart + originalProgress * sessionDuration;
    }
  }

  // If not in any active segment, return closest boundary
  if (
    targetCompressedTime < compressionData.activeSegments[0].compressedStartTime
  ) {
    return sessionStart;
  } else {
    return sessionStart + sessionDuration;
  }
}

/**
 * Formats gap duration for display
 *
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatGapDuration(durationMs) {
  const minutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else {
      return `${hours}h`;
    }
  } else {
    return `${minutes}m`;
  }
}

/**
 * Creates a per-file compressed timeline that removes gaps when the user was working on other files.
 * This preserves thinking pauses within the same file but removes time spent on other files.
 *
 * @param {Array<Object>} keystrokeLogs - Array of all keystroke log objects
 * @param {string} targetFile - The filename to create the compressed timeline for
 * @param {number} gapThresholdMs - Threshold for gap detection within the same file
 * @param {number} bufferMs - Buffer time to keep on each side of gaps
 * @param {Array<Object>} compileEvents - Array of compile events (optional)
 * @param {Array<Object>} runEvents - Array of run events (optional)
 * @returns {Object} Per-file compressed timeline data structure
 */
export function createPerFileCompressedTimeline(
  keystrokeLogs,
  targetFile,
  gapThresholdMs = DEFAULT_GAP_THRESHOLD_MS,
  bufferMs = DEFAULT_BUFFER_MS,
  compileEvents = [],
  runEvents = []
) {
  if (!keystrokeLogs || keystrokeLogs.length === 0 || !targetFile) {
    return {
      compressedKeystrokeLogs: [],
      gaps: [],
      totalOriginalDuration: 0,
      totalCompressedDuration: 0,
      compressionRatio: 1,
      activeSegments: [],
      filteredKeystrokeLogs: [],
    };
  }

  // Filter keystrokes to only include the target file
  const filteredKeystrokeLogs = keystrokeLogs.filter(
    (keystroke) => (keystroke.filename || "untitled_document") === targetFile
  );

  if (filteredKeystrokeLogs.length === 0) {
    return {
      compressedKeystrokeLogs: [],
      gaps: [],
      totalOriginalDuration: 0,
      totalCompressedDuration: 0,
      compressionRatio: 1,
      activeSegments: [],
      filteredKeystrokeLogs: [],
    };
  }

  // Create segments by detecting gaps between keystrokes of the same file
  // Any gap (regardless of duration) that corresponds to working on other files should be removed
  // Only preserve gaps within the same file that are longer than the threshold
  const gaps = [];
  const activeSegments = [];
  const compressedKeystrokeLogs = [];

  // Find original indices for filtered keystrokes
  const originalIndices = filteredKeystrokeLogs.map((filteredKeystroke) =>
    keystrokeLogs.findIndex(
      (originalKeystroke) =>
        originalKeystroke.timestamp === filteredKeystroke.timestamp &&
        originalKeystroke.filename === filteredKeystroke.filename
    )
  );

  // Group consecutive keystrokes and detect gaps
  let currentGroupStart = 0;
  const groups = [];

  for (let i = 0; i < filteredKeystrokeLogs.length - 1; i++) {
    const currentTime = new Date(filteredKeystrokeLogs[i].timestamp);
    const nextTime = new Date(filteredKeystrokeLogs[i + 1].timestamp);
    const timeDifference = nextTime - currentTime;

    // Check if there are other file keystrokes between current and next
    const currentOriginalIndex = originalIndices[i];
    const nextOriginalIndex = originalIndices[i + 1];

    let hasOtherFileKeystrokes = false;
    let withinFileGap = false;

    // Check if there are keystrokes from other files between these two
    for (let j = currentOriginalIndex + 1; j < nextOriginalIndex; j++) {
      const intermediateKeystroke = keystrokeLogs[j];
      if (
        (intermediateKeystroke.filename || "untitled_document") !== targetFile
      ) {
        hasOtherFileKeystrokes = true;
        break;
      }
    }

    // If no other file keystrokes, check if it's a within-file gap above threshold
    if (!hasOtherFileKeystrokes && timeDifference > gapThresholdMs) {
      withinFileGap = true;
    }

    // Create a gap if there are other file keystrokes OR if it's a long within-file pause
    if (hasOtherFileKeystrokes || withinFileGap) {
      // Close current group
      if (i >= currentGroupStart) {
        groups.push({
          startIndex: currentGroupStart,
          endIndex: i,
          startTime: new Date(
            filteredKeystrokeLogs[currentGroupStart].timestamp
          ),
          endTime: new Date(filteredKeystrokeLogs[i].timestamp),
        });
      }

      // Record the gap
      const gapType = hasOtherFileKeystrokes ? "other_file" : "within_file";

      // For gaps caused by working on other files, calculate the actual duration
      // by finding the time span that includes work on other files
      let actualGapDuration = timeDifference;
      let gapStartTime = currentTime;
      let gapEndTime = nextTime;

      if (hasOtherFileKeystrokes) {
        // Find the actual start and end of the gap by looking at the original keystroke sequence
        const currentOriginalIndex = originalIndices[i];
        const nextOriginalIndex = originalIndices[i + 1];

        // The gap starts right after the current target file keystroke
        gapStartTime = new Date(keystrokeLogs[currentOriginalIndex].timestamp);
        // The gap ends right before the next target file keystroke
        gapEndTime = new Date(keystrokeLogs[nextOriginalIndex].timestamp);

        actualGapDuration = gapEndTime - gapStartTime;
      }

      // Count compile and run events within this gap
      let compileCount = 0;
      let runCount = 0;

      // Count events that fall within the actual gap time period
      compileEvents.forEach((event) => {
        const eventTime = new Date(event.timestamp);
        if (eventTime >= gapStartTime && eventTime <= gapEndTime) {
          compileCount++;
        }
      });

      runEvents.forEach((event) => {
        const eventTime = new Date(event.timestamp);
        if (eventTime >= gapStartTime && eventTime <= gapEndTime) {
          runCount++;
        }
      });

      gaps.push({
        startKeystrokeIndex: originalIndices[i], // Use original index
        endKeystrokeIndex: originalIndices[i + 1], // Use original index
        startTime: gapStartTime,
        endTime: gapEndTime,
        duration: actualGapDuration, // Use the actual gap duration
        removedDuration:
          gapType === "other_file"
            ? actualGapDuration // Remove the entire duration for other file gaps
            : Math.max(0, actualGapDuration - bufferMs * 2), // Keep buffer for within-file gaps
        bufferMs: bufferMs, // Use buffer for both gap types
        gapType: gapType,
        durationMinutes: Math.round(actualGapDuration / (1000 * 60)),
        durationHours: actualGapDuration / (1000 * 60 * 60),
        compileCount: compileCount, // Add compile event count
        runCount: runCount, // Add run event count
      });

      // Start new group
      currentGroupStart = i + 1;
    }
  }

  // Add final group
  if (currentGroupStart < filteredKeystrokeLogs.length) {
    groups.push({
      startIndex: currentGroupStart,
      endIndex: filteredKeystrokeLogs.length - 1,
      startTime: new Date(filteredKeystrokeLogs[currentGroupStart].timestamp),
      endTime: new Date(
        filteredKeystrokeLogs[filteredKeystrokeLogs.length - 1].timestamp
      ),
    });
  }

  // If no groups (single keystroke), create one group
  if (groups.length === 0 && filteredKeystrokeLogs.length > 0) {
    groups.push({
      startIndex: 0,
      endIndex: filteredKeystrokeLogs.length - 1,
      startTime: new Date(filteredKeystrokeLogs[0].timestamp),
      endTime: new Date(
        filteredKeystrokeLogs[filteredKeystrokeLogs.length - 1].timestamp
      ),
    });
  }

  // Create compressed timeline from groups
  let compressedTimeOffset = 0;
  const firstTime =
    filteredKeystrokeLogs.length > 0
      ? new Date(filteredKeystrokeLogs[0].timestamp)
      : new Date();

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];
    const groupKeystrokes = filteredKeystrokeLogs.slice(
      group.startIndex,
      group.endIndex + 1
    );

    // Determine buffer settings based on gap type
    // For per-file compression, we should add buffer for both types of gaps for visual consistency
    const previousGap = groupIndex > 0 ? gaps[groupIndex - 1] : null;
    const nextGap = groupIndex < gaps.length ? gaps[groupIndex] : null;

    // Add buffer before this segment if there was a previous gap
    const bufferBefore = previousGap ? bufferMs : 0;
    // Add buffer after this segment if there will be a next gap
    const bufferAfter = nextGap ? bufferMs : 0;

    const segmentDuration =
      group.endTime - group.startTime + bufferBefore + bufferAfter;

    const segment = {
      originalStartTime: new Date(group.startTime.getTime() - bufferBefore),
      originalEndTime: new Date(group.endTime.getTime() + bufferAfter),
      compressedStartTime: new Date(firstTime.getTime() + compressedTimeOffset),
      compressedEndTime: new Date(
        firstTime.getTime() + compressedTimeOffset + segmentDuration
      ),
      startKeystrokeIndex: originalIndices[group.startIndex],
      endKeystrokeIndex: originalIndices[group.endIndex],
      duration: segmentDuration,
    };

    activeSegments.push(segment);

    // Add compressed keystrokes for this group
    for (let i = group.startIndex; i <= group.endIndex; i++) {
      const originalKeystroke = filteredKeystrokeLogs[i];
      const originalTime = new Date(originalKeystroke.timestamp);
      const relativeTime = originalTime - group.startTime;
      const compressedTime = new Date(
        firstTime.getTime() + compressedTimeOffset + bufferBefore + relativeTime
      );

      compressedKeystrokeLogs.push({
        ...originalKeystroke,
        timestamp: compressedTime.toISOString(),
        originalTimestamp: originalKeystroke.timestamp,
        originalIndex: originalIndices[i],
      });
    }

    compressedTimeOffset += segmentDuration;
  }

  // Calculate durations and compression ratio
  const firstOriginalTime = new Date(filteredKeystrokeLogs[0].timestamp);
  const lastOriginalTime = new Date(
    filteredKeystrokeLogs[filteredKeystrokeLogs.length - 1].timestamp
  );
  const totalOriginalDuration = lastOriginalTime - firstOriginalTime;
  const totalCompressedDuration = compressedTimeOffset;

  const compressionRatio =
    totalOriginalDuration > 0
      ? totalCompressedDuration / totalOriginalDuration
      : 1;

  return {
    compressedKeystrokeLogs,
    gaps,
    totalOriginalDuration,
    totalCompressedDuration,
    compressionRatio,
    activeSegments,
    filteredKeystrokeLogs, // Include filtered logs for reference
  };
}
