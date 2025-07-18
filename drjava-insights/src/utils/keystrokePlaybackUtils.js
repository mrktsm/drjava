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
