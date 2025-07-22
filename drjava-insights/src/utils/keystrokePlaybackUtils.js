/**
 * Converts a keystroke's zero-based index to its corresponding position on the playback timeline (e.g., in hours).
 *
 * @param {number} keystrokeIndex - The index of the keystroke.
 * @param {Array<object>} keystrokeLogs - All keystroke log objects.
 * @param {number} sessionStart - The timeline's start value.
 * @param {number} sessionDuration - The timeline's total duration.
 * @returns {number} The calculated timeline position.
 */
export function keystrokeIndexToTimelinePosition(
  keystrokeIndex,
  keystrokeLogs,
  sessionStart,
  sessionDuration
) {
  if (keystrokeLogs.length === 0) return sessionStart;
  const progress = keystrokeIndex / (keystrokeLogs.length - 1);
  return sessionStart + progress * sessionDuration;
}

/**
 * Converts a position on the playback timeline (e.g., a time in hours) back to a corresponding keystroke index.
 *
 * Handles clamping to valid index bounds and rounds to the nearest whole index.
 *
 * @param {number} timelinePos - The position on the timeline.
 * @param {Array<object>} keystrokeLogs - All keystroke log objects.
 * @param {number} sessionStart - The timeline's start value.
 * @param {number} sessionDuration - The timeline's total duration.
 * @returns {number} The calculated zero-based keystroke index.
 */
export function timelinePositionToKeystrokeIndex(
  timelinePos,
  keystrokeLogs,
  sessionStart,
  sessionDuration
) {
  if (sessionDuration === 0) return 0;
  const progress = Math.max(
    0,
    Math.min(1, (timelinePos - sessionStart) / sessionDuration)
  );
  return Math.min(
    keystrokeLogs.length - 1,
    Math.round(progress * (keystrokeLogs.length - 1))
  );
}
