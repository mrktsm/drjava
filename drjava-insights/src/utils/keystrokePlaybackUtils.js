/**
 * Converts a keystroke's zero-based index to its corresponding position on the playback timeline (e.g., in hours).
 * Uses actual timestamps for authentic timeline positioning.
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

  // Use actual timestamps for authentic positioning
  const currentKeystroke =
    keystrokeLogs[Math.min(keystrokeIndex, keystrokeLogs.length - 1)];
  const firstKeystroke = keystrokeLogs[0];
  const lastKeystroke = keystrokeLogs[keystrokeLogs.length - 1];

  const currentTime = new Date(currentKeystroke.timestamp);
  const firstTime = new Date(firstKeystroke.timestamp);
  const totalSessionMs = new Date(lastKeystroke.timestamp) - firstTime;

  // Handle edge case where all keystrokes have the same timestamp
  if (totalSessionMs === 0) {
    return sessionStart;
  }

  const progressThroughSession = (currentTime - firstTime) / totalSessionMs;
  return sessionStart + progressThroughSession * sessionDuration;
}

/**
 * Converts a position on the playback timeline (e.g., a time in hours) back to a corresponding keystroke index.
 * Uses actual timestamps for accurate conversion.
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
  if (keystrokeLogs.length === 0 || sessionDuration === 0) return 0;

  const progress = Math.max(
    0,
    Math.min(1, (timelinePos - sessionStart) / sessionDuration)
  );

  // Handle edge cases
  if (progress === 0) return 0;
  if (progress === 1) return keystrokeLogs.length - 1;

  // Use actual timestamps to find the closest keystroke
  const firstKeystroke = keystrokeLogs[0];
  const lastKeystroke = keystrokeLogs[keystrokeLogs.length - 1];
  const firstTime = new Date(firstKeystroke.timestamp);
  const totalSessionMs = new Date(lastKeystroke.timestamp) - firstTime;

  // Handle edge case where all keystrokes have the same timestamp
  if (totalSessionMs === 0) {
    return Math.round(progress * (keystrokeLogs.length - 1));
  }

  const targetTime = new Date(firstTime.getTime() + progress * totalSessionMs);

  // Find the keystroke closest to the target time
  let closestIndex = 0;
  let closestDistance = Math.abs(
    new Date(keystrokeLogs[0].timestamp) - targetTime
  );

  for (let i = 1; i < keystrokeLogs.length; i++) {
    const distance = Math.abs(
      new Date(keystrokeLogs[i].timestamp) - targetTime
    );
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }

  return closestIndex;
}
