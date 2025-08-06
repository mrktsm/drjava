import React, { memo } from "react";
import { formatGapDuration } from "../utils/timelineCompression";
import { MdOutlineHourglassBottom } from "react-icons/md";

/**
 * Component that renders gap indicators in the timeline to show inactive periods
 * that have been compressed out of the timeline.
 */
const TimelineGaps = memo(function TimelineGaps({
  compressionData,
  sessionStart,
  sessionDuration, // This is the compressed duration when compression is enabled
  timelineWidth,
  isEnabled = false, // Whether compression is enabled
}) {
  if (
    !isEnabled ||
    !compressionData ||
    !compressionData.gaps ||
    compressionData.gaps.length === 0 ||
    !compressionData.activeSegments ||
    compressionData.activeSegments.length < 2
  ) {
    return null;
  }

  // Calculate the 3-pixel gap equivalent as percentage
  const gapPercentage = (3 / timelineWidth) * 100;

  return (
    <div className="timeline-gaps">
      {/* Place gap indicators between active segments */}
      {compressionData.gaps.map((gap, gapIndex) => {
        // Find which two active segments this gap is between
        let segmentBefore = null;
        let segmentAfter = null;

        for (let i = 0; i < compressionData.activeSegments.length; i++) {
          const segment = compressionData.activeSegments[i];

          if (segment.endKeystrokeIndex === gap.startKeystrokeIndex) {
            segmentBefore = segment;
          }
          if (segment.startKeystrokeIndex === gap.endKeystrokeIndex) {
            segmentAfter = segment;
          }
        }

        if (!segmentBefore || !segmentAfter) {
          return null;
        }

        // Position the gap indicator at the end of the "before" segment
        const sessionStartTime = new Date(
          compressionData.activeSegments[0].compressedStartTime
        );
        const segmentEndTime = new Date(segmentBefore.compressedEndTime);

        const elapsedMs = segmentEndTime - sessionStartTime;
        const totalCompressedMs = compressionData.totalCompressedDuration;
        const positionPercentage = (elapsedMs / totalCompressedMs) * 100;

        return (
          <React.Fragment key={`gap-${gapIndex}`}>
            {/* Visual spacing element - creates the same 3px gap as between file segments */}
            <div
              className="timeline-gap-spacing"
              style={{
                position: "absolute",
                left: `${Math.max(
                  0,
                  Math.min(100, positionPercentage - gapPercentage / 2)
                )}%`,
                top: "0px",
                width: `${gapPercentage}%`,
                height: "100%",
                backgroundColor: "#f8f9fa", // Light background to show the gap
                borderLeft: "1px solid #dee2e6",
                borderRight: "1px solid #dee2e6",
                zIndex: 5, // Below other elements but above background
                pointerEvents: "none",
              }}
            />

            {/* Hourglass icon - positioned at the center of the gap */}
            <div
              className="timeline-gap-indicator"
              style={{
                position: "absolute",
                left: `${Math.max(0, Math.min(100, positionPercentage))}%`,
                top: "50%",
                transform: "translate(-50%, -50%)", // Center both horizontally and vertically
                zIndex: 25, // Above all other timeline elements
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={`Away for ${formatGapDuration(gap.duration)}`}
            >
              <MdOutlineHourglassBottom
                size={18}
                color="#ff8c00"
                style={{
                  backgroundColor: "white",
                  borderRadius: "4px",
                  padding: "2px",
                  border: "1px solid #ffb347",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
});

export default TimelineGaps;
