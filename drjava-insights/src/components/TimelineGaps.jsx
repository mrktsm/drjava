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
  const handleGapClick = (gap, gapIndex, positionPercentage, event) => {
    // Prevent default behavior and stop propagation to avoid cursor jumping
    event.preventDefault();
    event.stopPropagation();

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

    // Get the actual position of the clicked element
    const rect = event.target
      .closest(".timeline-gap-indicator")
      .getBoundingClientRect();
    const tooltipLeft = rect.left + rect.width / 2; // Center of the gap indicator
    const tooltipTop = rect.top - 10; // Just above the gap indicator

    setSelectedGap({
      ...gap,
      gapIndex,
      compileCount,
      runCount,
      formattedDuration: formatGapDuration(gap.duration),
      position: positionPercentage, // Store percentage for reference
      absoluteLeft: tooltipLeft, // Store actual screen position
      absoluteTop: tooltipTop, // Store actual screen position
    });
  };

  const closeModal = (event) => {
    // Prevent cursor teleportation when closing
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
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
                onClick={(event) =>
                  handleGapClick(gap, gapIndex, positionPercentage, event)
                }
                onMouseDown={(event) => {
                  // Prevent mouse down from causing cursor movement
                  event.preventDefault();
                  event.stopPropagation();
                }}
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
            position: "fixed",
            left: `${selectedGap.absoluteLeft}px`,
            top: `${selectedGap.absoluteTop}px`,
            transform: "translate(-50%, -100%)",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
            borderRadius: "12px",
            padding: "12px",
            minWidth: "180px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
            zIndex: 9999,
            border: "1px solid rgba(255, 255, 255, 0.2)",
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
                fontSize: "14px",
                fontWeight: "500",
                color: "#374151",
              }}
            >
              Away for {selectedGap.formattedDuration}
            </div>
            <button
              onClick={closeModal}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                borderRadius: "4px",
                color: "#9CA3AF",
                transition: "color 0.2s ease",
                marginLeft: "12px",
                flexShrink: 0,
              }}
            >
              <MdClose size={16} />
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "13px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <BsTools size={16} color="#D97706" />
              <span style={{ fontWeight: "500", color: "#374151" }}>
                {selectedGap.compileCount} compile
                {selectedGap.compileCount !== 1 ? "s" : ""}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <BsPlayCircleFill size={16} color="#059669" />
              <span style={{ fontWeight: "500", color: "#374151" }}>
                {selectedGap.runCount} run
                {selectedGap.runCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Arrow pointing down */}
          <div
            style={{
              position: "absolute",
              bottom: "-8px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "8px solid rgba(255, 255, 255, 0.95)",
            }}
          />
        </div>
      )}

      <style jsx>{`
        .gap-icon-hover:hover {
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        }
      `}</style>
    </>
  );
});

export default TimelineGaps;
