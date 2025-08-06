import React, { memo, useState, useEffect } from "react";
import { formatGapDuration } from "../utils/timelineCompression";
import { MdOutlineHourglassBottom, MdClose } from "react-icons/md";
import { BsTools, BsPlayCircleFill } from "react-icons/bs";

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
  compileEvents = [], // Add compile events prop
  runEvents = [], // Add run events prop
}) {
  const [selectedGap, setSelectedGap] = useState(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        selectedGap &&
        !event.target.closest(".gap-tooltip") &&
        !event.target.closest(".timeline-gap-indicator")
      ) {
        setSelectedGap(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [selectedGap]);

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

  // Function to handle gap click
  const handleGapClick = (gap, gapIndex, positionPercentage) => {
    // Count compile and run events during this gap
    const gapStart = new Date(gap.originalStartTime);
    const gapEnd = new Date(gap.originalEndTime);

    const compileCount = compileEvents.filter((event) => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= gapStart && eventTime <= gapEnd;
    }).length;

    const runCount = runEvents.filter((event) => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= gapStart && eventTime <= gapEnd;
    }).length;

    setSelectedGap({
      ...gap,
      gapIndex,
      compileCount,
      runCount,
      formattedDuration: formatGapDuration(gap.duration),
      position: positionPercentage, // Store position for tooltip
    });
  };

  const closeModal = () => {
    setSelectedGap(null);
  };

  return (
    <>
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
                  pointerEvents: "auto", // Enable click events
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer", // Show clickable cursor
                }}
                title={`Away for ${formatGapDuration(
                  gap.duration
                )} - Click for details`}
                onClick={() =>
                  handleGapClick(gap, gapIndex, positionPercentage)
                }
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
                    transition: "all 0.2s ease-in-out",
                  }}
                  className="gap-icon-hover"
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Gap Details Tooltip */}
      {selectedGap && (
        <div
          className="gap-tooltip"
          style={{
            position: "fixed", // Change to fixed to escape stacking context
            left: `${Math.max(0, Math.min(95, selectedGap.position || 50))}%`,
            top: "200px", // Fixed position from top instead of relative to timeline
            transform: "translateX(-50%)",
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "12px",
            minWidth: "200px",
            maxWidth: "300px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            zIndex: 9999, // Much higher z-index
            border: "1px solid #ddd",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#333",
              }}
            >
              Away for {selectedGap.formattedDuration}
            </div>
            <button
              onClick={closeModal}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                borderRadius: "2px",
                color: "#666",
                fontSize: "12px",
              }}
            >
              <MdClose size={14} />
            </button>
          </div>

          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 8px",
                backgroundColor: "#fff3cd",
                borderRadius: "4px",
                border: "1px solid #ffeaa7",
                fontSize: "12px",
                height: "40px", // Fixed height
                width: "80px", // Fixed width instead of minWidth
                justifyContent: "center", // Center content
              }}
            >
              <BsTools size={14} color="#ffc107" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: "600", color: "#333" }}>
                  {selectedGap.compileCount}
                </div>
                <div style={{ fontSize: "10px", color: "#666" }}>
                  Compile{selectedGap.compileCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 8px",
                backgroundColor: "#d4edda",
                borderRadius: "4px",
                border: "1px solid #c3e6cb",
                fontSize: "12px",
                height: "40px", // Fixed height
                width: "80px", // Fixed width instead of minWidth
                justifyContent: "center", // Center content
              }}
            >
              <BsPlayCircleFill size={14} color="#28a745" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: "600", color: "#333" }}>
                  {selectedGap.runCount}
                </div>
                <div style={{ fontSize: "10px", color: "#666" }}>
                  Run{selectedGap.runCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Small arrow pointing down to the gap indicator */}
          <div
            style={{
              position: "absolute",
              bottom: "-6px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid white",
            }}
          />
        </div>
      )}

      <style jsx>{`
        .gap-icon-hover:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        }
      `}</style>
    </>
  );
});

export default TimelineGaps;
