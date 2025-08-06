import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import {
  BsFiletypeJava,
  BsTools,
  BsPlayCircleFill,
  BsExclamationCircleFill,
} from "react-icons/bs";
import { VscChevronDown } from "react-icons/vsc";
import {
  MdPlayArrow,
  MdPause,
  MdSkipPrevious,
  MdFastRewind,
  MdFastForward,
  MdSkipNext,
} from "react-icons/md";
import {
  getCurrentFileSegment,
  getCurrentTimeInSegment,
  getLighterColor,
} from "../utils/fileSegmentUtils";
import TimelineGaps from "./TimelineGaps";
import {
  formatGapDuration,
  DEFAULT_BUFFER_MS,
} from "../utils/timelineCompression";

// Add TypingActivityOverlays Component (renamed and repositioned)
const TypingActivityOverlays = memo(function TypingActivityOverlays({
  typingActivitySegments = [],
  sessionStart,
  sessionDuration,
  currentKeystrokeIndex,
  keystrokeLogs = [],
  fileSegments = [],
  fileColorMap = {},
  currentTime,
  timelineWidth,
  activeFile = "", // New prop for current active file
  autoSwitchFiles = true, // New prop to know if autoswitch is enabled
  compressionEnabled = false, // New prop for compression state
  compressionData = null, // New prop for compression data
}) {
  // Helper function to darken a color
  const darkenColor = (color, amount = 0.3) => {
    // Remove # if present
    const hex = color.replace("#", "");

    // Parse RGB values
    const num = parseInt(hex, 16);
    const r = Math.floor((num >> 16) * (1 - amount));
    const g = Math.floor(((num >> 8) & 0x00ff) * (1 - amount));
    const b = Math.floor((num & 0x0000ff) * (1 - amount));

    // Convert back to hex
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };

  // Filter typing activity segments based on autoswitch mode
  const filteredSegments = useMemo(() => {
    if (!autoSwitchFiles && activeFile) {
      // When autoswitch is off, only show typing activity for the current active file
      return typingActivitySegments.filter((segment) => {
        if (
          keystrokeLogs.length > 0 &&
          segment.startIndex < keystrokeLogs.length
        ) {
          const keystrokeAtStart = keystrokeLogs[segment.startIndex];
          const filename = keystrokeAtStart?.filename || "untitled_document";
          return filename === activeFile;
        }
        return false;
      });
    } else {
      // When autoswitch is on, show all typing activity
      return typingActivitySegments;
    }
  }, [typingActivitySegments, autoSwitchFiles, activeFile, keystrokeLogs]);

  return (
    <>
      {filteredSegments
        .map((segment, index) => {
          const leftPercentage =
            ((segment.start - sessionStart) / sessionDuration) * 100;
          const rightPercentage =
            ((segment.end - sessionStart) / sessionDuration) * 100;
          const widthPercentage = rightPercentage - leftPercentage;

          // When compression is enabled, split typing activity around gaps
          let activityParts = [
            { left: leftPercentage, width: widthPercentage },
          ];

          if (compressionEnabled && compressionData && compressionData.gaps) {
            const gapsInSegment = compressionData.gaps.filter((gap) => {
              const sessionStartTime = new Date(
                compressionData.activeSegments[0].compressedStartTime
              );
              const segmentBefore = compressionData.activeSegments.find(
                (s) => s.endKeystrokeIndex === gap.startKeystrokeIndex
              );
              const segmentAfter = compressionData.activeSegments.find(
                (s) => s.startKeystrokeIndex === gap.endKeystrokeIndex
              );

              if (segmentBefore && segmentAfter) {
                const gapStartMs =
                  new Date(segmentBefore.compressedEndTime) - sessionStartTime;
                const gapEndMs =
                  new Date(segmentAfter.compressedStartTime) - sessionStartTime;
                const gapStartPercentage =
                  (gapStartMs / compressionData.totalCompressedDuration) * 100;
                const gapEndPercentage =
                  (gapEndMs / compressionData.totalCompressedDuration) * 100;

                // Check if this gap overlaps with the current typing activity segment
                return (
                  (gapStartPercentage >= leftPercentage &&
                    gapStartPercentage <= rightPercentage) ||
                  (gapEndPercentage >= leftPercentage &&
                    gapEndPercentage <= rightPercentage)
                );
              }
              return false;
            });

            if (gapsInSegment.length > 0) {
              // Split this typing activity around the gaps
              activityParts = [];
              let currentLeft = leftPercentage;

              gapsInSegment.forEach((gap) => {
                const sessionStartTime = new Date(
                  compressionData.activeSegments[0].compressedStartTime
                );
                const segmentBefore = compressionData.activeSegments.find(
                  (s) => s.endKeystrokeIndex === gap.startKeystrokeIndex
                );
                const segmentAfter = compressionData.activeSegments.find(
                  (s) => s.startKeystrokeIndex === gap.endKeystrokeIndex
                );

                if (segmentBefore && segmentAfter) {
                  const gapStartMs =
                    new Date(segmentBefore.compressedEndTime) -
                    sessionStartTime;
                  const gapEndMs =
                    new Date(segmentAfter.compressedStartTime) -
                    sessionStartTime;
                  const gapStartPercentage =
                    (gapStartMs / compressionData.totalCompressedDuration) *
                    100;
                  const gapEndPercentage =
                    (gapEndMs / compressionData.totalCompressedDuration) * 100;

                  // Add activity part before the gap, leaving space for visual gap
                  if (gapStartPercentage > currentLeft) {
                    const activityWidth = gapStartPercentage - currentLeft;
                    const visualGapPercentage = (3 / timelineWidth) * 100;

                    activityParts.push({
                      left: currentLeft,
                      width: Math.max(
                        0,
                        activityWidth - visualGapPercentage / 2
                      ), // Reserve half gap before
                    });
                  }

                  // Update current position to after the gap, accounting for visual spacing
                  const visualGapPercentage = (3 / timelineWidth) * 100;
                  currentLeft = gapEndPercentage + visualGapPercentage / 2; // Reserve half gap after
                }
              });

              // Add remaining part after all gaps
              if (currentLeft < rightPercentage) {
                activityParts.push({
                  left: currentLeft,
                  width: rightPercentage - currentLeft,
                });
              }
            }
          }

          return activityParts
            .map((part, partIndex) => {
              // Constrain to timeline boundaries
              const constrainedLeftPercentage = Math.max(
                0,
                Math.min(part.left, 100)
              );
              const constrainedWidthPercentage = Math.max(
                0,
                Math.min(part.width, 100 - constrainedLeftPercentage)
              );

              // Skip rendering if width is too small
              if (constrainedWidthPercentage < 0.1) {
                return null;
              }

              // Determine if this segment is currently active
              const isCurrentSegment =
                currentKeystrokeIndex >= segment.startIndex &&
                currentKeystrokeIndex <= segment.endIndex;

              // Find the file this typing activity belongs to
              let baseFileColor = "#E5E5E5"; // Default fallback color
              if (
                keystrokeLogs.length > 0 &&
                segment.startIndex < keystrokeLogs.length
              ) {
                const keystrokeAtStart = keystrokeLogs[segment.startIndex];
                const filename =
                  keystrokeAtStart?.filename || "untitled_document";
                baseFileColor = fileColorMap[filename] || "#E5E5E5";
              }

              // Use a darker version of the file color for better visibility
              const segmentFileColor = darkenColor(baseFileColor, 0.2); // 20% darker

              // Calculate progressive opacity based on cursor position (similar to filename text)
              const currentTimePercentage =
                ((currentTime - sessionStart) / sessionDuration) * 100;

              // Check if cursor is over this segment
              const isCursorOver =
                currentTimePercentage >= constrainedLeftPercentage &&
                currentTimePercentage <=
                  constrainedLeftPercentage + constrainedWidthPercentage;

              // Calculate how much of this segment the cursor has passed through
              let segmentProgress = 0;
              if (
                currentTimePercentage >=
                constrainedLeftPercentage + constrainedWidthPercentage
              ) {
                // Cursor has completely passed this segment
                segmentProgress = 1;
              } else if (currentTimePercentage >= constrainedLeftPercentage) {
                // Cursor is currently passing through this segment
                segmentProgress =
                  (currentTimePercentage - constrainedLeftPercentage) /
                  constrainedWidthPercentage;
              }
              // If currentTimePercentage < constrainedLeftPercentage, segmentProgress stays 0

              // Create opacity based on progress (similar to filename text)
              const baseOpacity = isCurrentSegment ? 0.4 : 0.2; // Base opacity when not revealed
              const revealedOpacity = isCurrentSegment ? 0.7 : 0.5; // Higher opacity when revealed by cursor

              // Calculate final opacity
              const finalOpacity =
                baseOpacity + (revealedOpacity - baseOpacity) * segmentProgress;

              // Convert to hex opacity
              const opacityHex = Math.round(finalOpacity * 255)
                .toString(16)
                .padStart(2, "0");

              // Border opacity (slightly higher than background)
              const borderOpacity = Math.min(1, finalOpacity + 0.2);
              const borderOpacityHex = Math.round(borderOpacity * 255)
                .toString(16)
                .padStart(2, "0");

              return (
                <div
                  key={`typing-activity-${index}-${partIndex}`}
                  className={`typing-activity-overlay ${
                    isCurrentSegment ? "current" : ""
                  } ${isCursorOver ? "cursor-over" : ""}`}
                  style={{
                    position: "absolute",
                    left: `${constrainedLeftPercentage}%`,
                    top: "0px",
                    width: `${constrainedWidthPercentage}%`,
                    height: "100%",
                    backgroundColor: `${segmentFileColor}${opacityHex}`,
                    borderRadius: "0px", // Square corners
                    zIndex: 12, // Above progress bars (10) but below cursor (20)
                    pointerEvents: "none", // Don't interfere with timeline interactions
                    border: `1px solid ${segmentFileColor}${borderOpacityHex}`,
                    transition: "all 0.1s ease-out", // Smooth transition as cursor moves
                  }}
                  title={`Active typing: ${segment.startIndex} - ${segment.endIndex} keystrokes`}
                />
              );
            })
            .filter(Boolean);
        })
        .flat()}
    </>
  );
});

const TimelineTicks = memo(function TimelineTicks({
  sessionStart,
  sessionDuration, // This should be compressed duration when compression is enabled
  formatTime,
  zoomLevel,
  timelineWidth,
  compileEvents = [],
  runEvents = [],
  compressionEnabled = false, // Add compression awareness
  compressionData = null, // Add compression data for proper time mapping
}) {
  const spacedLines = useMemo(() => {
    const lines = [];
    const numberOfLines = Math.max(10, Math.floor(10 * zoomLevel)); // More lines when zoomed in
    const subdivisions = zoomLevel > 2 ? 4 : 2; // More subdivisions when highly zoomed
    const totalLines = numberOfLines * subdivisions;

    for (let i = 0; i <= totalLines; i++) {
      const percentage = (i / totalLines) * 100;
      const color = "#999";
      const isMainLine = i % subdivisions === 0;

      const style = {
        left: `${percentage}%`,
        borderLeftColor: color,
      };

      if (percentage === 100) {
        style.marginLeft = "-1px";
      }

      const className = isMainLine ? "hour-line" : "hour-line hour-line--small";

      let label = null;
      if (isMainLine) {
        // Calculate the time at this position in the compressed timeline
        const timeAtLine = sessionStart + (i / totalLines) * sessionDuration;

        // When compression is enabled, we need to show meaningful time labels
        // For compressed timeline, show the relative time within the compressed session
        let displayTime;
        if (compressionEnabled && compressionData) {
          // For compressed timeline, show elapsed time from start
          const elapsedHours = (i / totalLines) * sessionDuration;
          const totalMinutes = Math.round(elapsedHours * 60);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;

          if (hours > 0) {
            displayTime = `${hours}:${minutes.toString().padStart(2, "0")}`;
          } else {
            displayTime = `${minutes}m`;
          }
        } else {
          // For normal timeline, show actual clock time
          displayTime = formatTime(timeAtLine);
        }

        label = <div className="hour-label">{displayTime}</div>;
      }

      lines.push(
        <div key={i} className={className} style={style}>
          {label}
        </div>
      );
    }
    return lines;
  }, [
    sessionStart,
    sessionDuration,
    formatTime,
    zoomLevel,
    compressionEnabled,
    compressionData,
  ]);

  return (
    <div className="time-ticks-container">
      {spacedLines}
      <TimelineEvents
        timelineWidth={timelineWidth}
        compileEvents={compileEvents}
        runEvents={runEvents}
        sessionStart={sessionStart}
        sessionDuration={sessionDuration}
        compressionEnabled={compressionEnabled}
        compressionData={compressionData}
      />
    </div>
  );
});

// Component for rendering run and compile events
const TimelineEvents = memo(function TimelineEvents({
  timelineWidth,
  compileEvents = [],
  runEvents = [],
  sessionStart,
  sessionDuration,
  compressionEnabled = false,
  compressionData = null,
}) {
  const events = useMemo(() => {
    const allEvents = [];

    // Helper function to convert original time to compressed timeline position
    const getCompressedPosition = (originalEventTime) => {
      if (!compressionEnabled || !compressionData) {
        // For normal timeline, use the original calculation
        const eventHours =
          originalEventTime.getHours() +
          originalEventTime.getMinutes() / 60 +
          originalEventTime.getSeconds() / 3600;
        return ((eventHours - sessionStart) / sessionDuration) * 100;
      }

      // For compressed timeline, find which active segment contains this event
      for (const segment of compressionData.activeSegments) {
        if (
          originalEventTime >= segment.originalStartTime &&
          originalEventTime <= segment.originalEndTime
        ) {
          // Calculate position within this segment
          const segmentProgress =
            (originalEventTime - segment.originalStartTime) /
            (segment.originalEndTime - segment.originalStartTime);

          // Map to compressed timeline
          const compressedEventTime = new Date(
            segment.compressedStartTime.getTime() +
              segmentProgress *
                (segment.compressedEndTime - segment.compressedStartTime)
          );

          // Convert to timeline position
          const compressedFirstTime = new Date(
            compressionData.activeSegments[0].compressedStartTime
          );
          const timeIntoCompressedSession =
            (compressedEventTime - compressedFirstTime) / 1000; // seconds
          const sessionDurationSeconds = sessionDuration * 3600; // convert hours to seconds
          return (timeIntoCompressedSession / sessionDurationSeconds) * 100;
        }
      }

      // Event is in a gap that was removed, don't show it
      return -1;
    };

    // Process compile events
    compileEvents.forEach((event, index) => {
      const eventTime = new Date(event.timestamp);
      const position = getCompressedPosition(eventTime);

      // Only add events that fall within the visible timeline
      if (position >= 0 && position <= 100) {
        allEvents.push({
          id: `compile-${index}`,
          position,
          icon: BsTools,
          type: "compile",
          color: "#ffc107", // Yellow for compile
          timestamp: event.timestamp,
          hasError: false, // Will implement error detection later
        });
      }
    });

    // Process run events
    runEvents.forEach((event, index) => {
      const eventTime = new Date(event.timestamp);
      const position = getCompressedPosition(eventTime);

      // Only add events that fall within the visible timeline
      if (position >= 0 && position <= 100) {
        allEvents.push({
          id: `run-${index}`,
          position,
          icon: BsPlayCircleFill,
          type: "run",
          color: "#28a745", // Green for run
          timestamp: event.timestamp,
          filename: event.filename,
        });
      }
    });

    return allEvents.sort((a, b) => a.position - b.position);
  }, [
    compileEvents,
    runEvents,
    sessionStart,
    sessionDuration,
    compressionEnabled,
    compressionData,
  ]);

  return (
    <div className="timeline-events">
      {events.map((event) => {
        const IconComponent = event.icon;
        return (
          <div
            key={event.id}
            className={`timeline-event timeline-event--${event.type}`}
            style={{
              left: `${event.position}%`,
              color: event.color,
            }}
            title={
              event.hasError
                ? "Compilation failed"
                : event.type === "run"
                ? "Code executed"
                : "Code compiled"
            }
          >
            <IconComponent size={16} />
            {event.hasError && (
              <div className="error-indicator">
                <BsExclamationCircleFill size={12} color="#dc3545" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// Reactive React Playbar Component
function PlaybarComponent({
  segments = [],
  activitySegments = [], // New prop for activity segments
  fileSegments = [], // New prop for file segments
  fileColorMap = {}, // New prop for file color mapping
  currentTime,
  currentKeystrokeIndex, // Current keystroke index for accurate file segment detection
  onTimeChange,
  sessionStart = 0,
  sessionEnd = 24,
  sessionDuration = 24,
  // File explorer props
  files = [],
  activeFile = "",
  onFileSelect,
  autoSwitchFiles = true, // New prop for controlling automatic file switching
  onToggleAutoSwitchFiles, // New prop for toggling auto-switch behavior
  // Media control props
  isPlaying = false,
  onPlayPause,
  onSkipBackward,
  onSkipForward,
  onRestart,
  onSkipToEnd,
  playbackSpeed,
  onSetPlaybackSpeed,
  fontSize,
  onSetFontSize,
  // Event props
  compileEvents = [],
  runEvents = [],
  // Activity props (only keeping what's needed for overlays)
  typingActivitySegments = [],
  keystrokeLogs = [], // New prop for keystroke logs
  // Compression props
  compressionEnabled = false,
  onToggleCompression,
  compressionData = null,
  gapThreshold = 180000, // 3 minutes in milliseconds
  onSetGapThreshold,
  bufferMs = 3000, // 3 seconds in milliseconds
  onSetBufferMs,
}) {
  const [isDragging, setIsDragging] = useState(false);
  // Remove playbarWidth state since we now use file segments
  // const [playbarWidth, setPlaybarWidth] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1); // Represents the actual zoom factor
  const [baseZoom, setBaseZoom] = useState(1); // The zoom factor for "100% fit-to-width"
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);

  // Create effective file segments based on autoSwitch state
  const effectiveFileSegments = useMemo(() => {
    if (!autoSwitchFiles && activeFile) {
      // When autoswitch is disabled, create a single continuous segment for the active file
      return [
        {
          filename: activeFile,
          start: sessionStart,
          end: sessionEnd,
          startIndex: 0,
          endIndex: keystrokeLogs.length - 1,
        },
      ];
    } else {
      // When autoswitch is enabled, use the original file segments for switching
      return fileSegments;
    }
  }, [
    autoSwitchFiles,
    activeFile,
    sessionStart,
    sessionEnd,
    fileSegments,
    keystrokeLogs.length,
  ]);

  const containerRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const baseTimelineWidth = 800; // Base width in pixels

  // Calculate actual timeline width based on zoom
  const timelineWidth = useMemo(() => {
    return baseTimelineWidth * zoomLevel;
  }, [zoomLevel]);

  // Calculate the zoom level required to make the timeline fit the container width
  const calculateFitToWidthZoom = useCallback(() => {
    if (!timelineScrollRef.current) return 1;

    const containerWidth = timelineScrollRef.current.offsetWidth;
    // Subtract padding (30px total: 15px on each side)
    const availableWidth = containerWidth - 30;
    const fitZoom = Math.max(0.5, availableWidth / baseTimelineWidth);

    return Math.min(10, fitZoom); // Cap at max zoom level
  }, []);

  // The minimum zoom is the "fit-to-width" zoom
  const getMinZoom = useCallback(() => {
    return baseZoom;
  }, [baseZoom]);

  // Initialize zoom level on mount
  useEffect(() => {
    if (!isInitialized && timelineScrollRef.current) {
      const initialFitZoom = calculateFitToWidthZoom();
      setBaseZoom(initialFitZoom); // Set the reference for 100%
      setZoomLevel(initialFitZoom); // Set the initial actual zoom to fit-to-width
      setIsInitialized(true);
    }
  }, [calculateFitToWidthZoom, isInitialized]);

  // Recalculate zoom on window resize while maintaining the relative zoom level
  useEffect(() => {
    const handleResize = () => {
      if (isInitialized && baseZoom > 0) {
        const newFitZoom = calculateFitToWidthZoom();
        const oldRelativeZoom = zoomLevel / baseZoom;
        const newActualZoom = newFitZoom * oldRelativeZoom;

        setBaseZoom(newFitZoom);
        setZoomLevel(newActualZoom);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [calculateFitToWidthZoom, isInitialized, zoomLevel, baseZoom]);

  // Convert decimal hours to time string
  const formatTime = useCallback((decimalHours) => {
    const hours = Math.floor(decimalHours).toString().padStart(2, "0");
    const minutes = Math.round((decimalHours % 1) * 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}`;
  }, []);

  // Convert time position to pixel position (accounting for zoom)
  const timeToPixels = useCallback(
    (time) => {
      const percentage = (time - sessionStart) / sessionDuration;
      return percentage * timelineWidth;
    },
    [sessionStart, sessionDuration, timelineWidth]
  );

  // Convert time position to percentage (relative to zoomed timeline)
  const timeToPercentage = useCallback(
    (time) => {
      return ((time - sessionStart) / sessionDuration) * 100;
    },
    [sessionStart, sessionDuration]
  );

  // Convert mouse position to time (accounting for scroll and zoom)
  const mouseToTime = useCallback(
    (clientX) => {
      if (!containerRef.current || !timelineScrollRef.current)
        return sessionStart;

      // Get the scroll container's position and dimensions
      const scrollRect = timelineScrollRef.current.getBoundingClientRect();
      const scrollContainer = timelineScrollRef.current;

      // At minimum zoom, the timeline width might be smaller than container width
      // In this case, CSS centers the timeline and padding behaves differently
      const containerWidth = scrollRect.width;

      let relativeX, usableWidth;

      if (timelineWidth <= containerWidth) {
        // Timeline fits in container - CSS centers it with padding
        // Calculate position relative to the centered timeline
        const timelineStartX = (containerWidth - timelineWidth) / 2;
        relativeX = clientX - scrollRect.left - timelineStartX;
        usableWidth = timelineWidth;
      } else {
        // Timeline is larger than container - normal scrolling behavior
        relativeX = clientX - scrollRect.left + scrollContainer.scrollLeft - 15;
        usableWidth = timelineWidth - 30;
      }

      // Convert to percentage of usable timeline width
      const percentage = Math.max(
        0,
        Math.min(100, (relativeX / usableWidth) * 100)
      );

      return sessionStart + (percentage / 100) * sessionDuration;
    },
    [sessionStart, sessionDuration, timelineWidth]
  );

  // Handle mouse down on playbar
  const handleMouseDown = useCallback(
    (e) => {
      setIsDragging(true);
      const newTime = mouseToTime(e.clientX);
      if (onTimeChange) {
        onTimeChange(newTime);
      }
    },
    [mouseToTime, onTimeChange]
  );

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const newTime = mouseToTime(e.clientX);
      if (onTimeChange) {
        onTimeChange(newTime);
      }
    },
    [isDragging, mouseToTime, onTimeChange]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle zoom change from the slider
  const handleZoomChange = useCallback(
    (e) => {
      // The slider's value is the *relative* zoom (e.g., 1.5 for 150%)
      const newRelativeZoom = parseFloat(e.target.value);
      // Convert it to the *actual* zoom factor for calculations
      const newActualZoom = baseZoom * newRelativeZoom;

      const minZoom = getMinZoom();
      const clampedZoom = Math.max(minZoom, newActualZoom);

      if (
        !timelineScrollRef.current ||
        Math.abs(clampedZoom - zoomLevel) < 0.001
      ) {
        setZoomLevel(clampedZoom);
        return;
      }

      // Store precise state before any changes
      const scrollContainer = timelineScrollRef.current;
      const currentScrollLeft = scrollContainer.scrollLeft;

      // Calculate cursor's viewport position with high precision based on the old zoom level
      const oldTimelineWidth = baseTimelineWidth * zoomLevel;
      const cursorTimePercentage =
        (currentTime - sessionStart) / sessionDuration;
      const cursorPixelPosition = cursorTimePercentage * oldTimelineWidth;
      const cursorViewportOffset = cursorPixelPosition - currentScrollLeft;

      // Calculate the exact pixel position where cursor should be after zoom
      const newTimelineWidth = baseTimelineWidth * clampedZoom;
      const newCursorPixelPosition = cursorTimePercentage * newTimelineWidth;
      const targetScrollLeft = newCursorPixelPosition - cursorViewportOffset;

      // Update the actual zoom level in the state
      setZoomLevel(clampedZoom);

      // Use RAF for smooth visual update
      requestAnimationFrame(() => {
        if (!timelineScrollRef.current) return;

        const maxScrollLeft =
          timelineScrollRef.current.scrollWidth -
          timelineScrollRef.current.clientWidth;
        const clampedScrollLeft = Math.max(
          0,
          Math.min(maxScrollLeft, targetScrollLeft)
        );

        // Round to prevent sub-pixel positioning issues
        timelineScrollRef.current.scrollLeft = Math.round(clampedScrollLeft);
      });
    },
    [
      baseZoom,
      getMinZoom,
      currentTime,
      sessionStart,
      sessionDuration,
      baseTimelineWidth,
      zoomLevel,
    ]
  );

  // Auto-scroll to keep cursor in view
  const scrollToKeepCursorVisible = useCallback(() => {
    if (!timelineScrollRef.current) return;

    const cursorPosition = timeToPixels(currentTime);
    const scrollContainer = timelineScrollRef.current;
    const containerWidth = scrollContainer.offsetWidth;
    const scrollLeft = scrollContainer.scrollLeft;
    const scrollRight = scrollLeft + containerWidth;

    // Add some padding for better UX
    const padding = 50;

    if (cursorPosition < scrollLeft + padding) {
      // Cursor is too far left, scroll left
      scrollContainer.scrollLeft = Math.max(0, cursorPosition - padding);
    } else if (cursorPosition > scrollRight - padding) {
      // Cursor is too far right, scroll right
      scrollContainer.scrollLeft = cursorPosition - containerWidth + padding;
    }
  }, [currentTime, timeToPixels]);

  // Set up global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Auto-scroll when playing
  useEffect(() => {
    scrollToKeepCursorVisible();
  }, [scrollToKeepCursorVisible]);

  // Handle scroll events
  const handleScroll = useCallback((e) => {
    setScrollLeft(e.target.scrollLeft);

    // Prevent overscroll bounce on Firefox and other browsers
    const scrollContainer = e.target;
    const maxScrollLeft =
      scrollContainer.scrollWidth - scrollContainer.clientWidth;

    // If user tries to scroll beyond boundaries, clamp the scroll position
    if (scrollContainer.scrollLeft < 0) {
      scrollContainer.scrollLeft = 0;
    } else if (scrollContainer.scrollLeft > maxScrollLeft) {
      scrollContainer.scrollLeft = maxScrollLeft;
    }
  }, []);

  // Prevent wheel events from causing overscroll
  const handleWheel = useCallback(
    (e) => {
      const scrollContainer = timelineScrollRef.current;
      if (!scrollContainer) return;

      // Check if Command key (Mac) or Ctrl key (Windows/Linux) is pressed for zoom
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();

        // Determine zoom direction and magnitude based on wheel delta
        const deltaY = Math.abs(e.deltaY);
        const zoomDirection = e.deltaY < 0 ? 1 : -1; // Scroll up = zoom in, scroll down = zoom out

        // Dynamic zoom step based on scroll magnitude for more natural feel
        const baseZoomStep = 0.02;
        const zoomStep = Math.min(0.1, baseZoomStep * (deltaY / 100 + 1));

        // Calculate new relative zoom
        const currentRelativeZoom = baseZoom > 0 ? zoomLevel / baseZoom : 1;
        const newRelativeZoom = Math.max(
          1,
          Math.min(10, currentRelativeZoom + zoomDirection * zoomStep)
        );

        // Convert to actual zoom factor
        const newActualZoom = baseZoom * newRelativeZoom;
        const minZoom = getMinZoom();
        const clampedZoom = Math.max(minZoom, newActualZoom);

        if (Math.abs(clampedZoom - zoomLevel) < 0.001) {
          return; // No change needed
        }

        // Get mouse position relative to the scroll container
        const scrollRect = scrollContainer.getBoundingClientRect();
        const mouseX = e.clientX - scrollRect.left;

        // Store precise state before any changes
        const currentScrollLeft = scrollContainer.scrollLeft;
        const oldTimelineWidth = baseTimelineWidth * zoomLevel;

        // Calculate mouse position in the timeline (including scroll offset)
        const mouseTimelineX = mouseX + currentScrollLeft;
        const mouseViewportOffset = mouseX; // Distance from left edge of viewport

        // Update zoom level
        setZoomLevel(clampedZoom);

        // Calculate new scroll position to keep mouse position stable
        requestAnimationFrame(() => {
          const newTimelineWidth = baseTimelineWidth * clampedZoom;
          const zoomRatio = newTimelineWidth / oldTimelineWidth;

          // Calculate where the mouse timeline position should be after zoom
          const newMouseTimelineX = mouseTimelineX * zoomRatio;

          // Calculate the target scroll position to keep mouse at same viewport position
          const targetScrollLeft = newMouseTimelineX - mouseViewportOffset;

          const maxScrollLeft =
            scrollContainer.scrollWidth - scrollContainer.clientWidth;
          const clampedScrollLeft = Math.max(
            0,
            Math.min(maxScrollLeft, targetScrollLeft)
          );
          scrollContainer.scrollLeft = Math.round(clampedScrollLeft);
        });

        return; // Exit early for zoom, don't handle scroll
      }

      // Original scroll handling for non-zoom wheel events
      const maxScrollLeft =
        scrollContainer.scrollWidth - scrollContainer.clientWidth;
      const currentScrollLeft = scrollContainer.scrollLeft;

      // Check if wheel would cause overscroll
      const deltaX = e.deltaX;
      const newScrollLeft = currentScrollLeft + deltaX;

      if (newScrollLeft < 0 || newScrollLeft > maxScrollLeft) {
        e.preventDefault(); // Prevent the overscroll
        // Clamp to boundaries
        scrollContainer.scrollLeft = Math.max(
          0,
          Math.min(maxScrollLeft, newScrollLeft)
        );
      }
    },
    [baseZoom, zoomLevel, getMinZoom, baseTimelineWidth]
  );

  // Add wheel event listener to prevent overscroll
  useEffect(() => {
    const scrollContainer = timelineScrollRef.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      scrollContainer.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Keyboard shortcuts for media controls
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle keyboard shortcuts if not typing in an input field
      if (
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          if (onPlayPause) {
            onPlayPause();
          }
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (onSkipBackward) {
            onSkipBackward();
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (onSkipForward) {
            onSkipForward();
          }
          break;
        default:
          break;
      }
    };

    // Add event listener to document
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup function
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onPlayPause, onSkipBackward, onSkipForward]);

  const toggleFileDropdown = () => {
    setIsFileDropdownOpen(!isFileDropdownOpen);
  };

  const handleFileSelect = (filename) => {
    if (onFileSelect) {
      onFileSelect(filename);
    }
    setIsFileDropdownOpen(false);
  };

  const currentPercentage = timeToPercentage(currentTime);

  // Get current file segment and progress within that segment
  const currentFileSegment = useMemo(() => {
    return getCurrentFileSegment(fileSegments, currentKeystrokeIndex || 0);
  }, [fileSegments, currentKeystrokeIndex]);

  return (
    <div className="playbar-wrapper">
      {/* Zoom Controls with File Explorer, Font Size, and Activity Indicator */}
      <div className="zoom-controls">
        {/* File Explorer */}
        <div className="file-explorer-controls">
          <div className="file-selector" onClick={toggleFileDropdown}>
            <BsFiletypeJava className="file-icon java" />
            <span className="file-title">{activeFile}</span>
            <VscChevronDown size={16} className="file-chevron" />
            {isFileDropdownOpen && (
              <div className="file-dropdown">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className={`file-dropdown-item ${
                      activeFile === file ? "active" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileSelect(file);
                    }}
                  >
                    <BsFiletypeJava className="file-icon java" />
                    <span className="file-name">{file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Auto-switch Files Checkbox */}
          <div className="auto-switch-control">
            <input
              type="checkbox"
              id="auto-switch-files"
              checked={autoSwitchFiles}
              onChange={(e) => {
                if (onToggleAutoSwitchFiles) {
                  onToggleAutoSwitchFiles(e.target.checked);
                }
              }}
              className="auto-switch-checkbox"
            />
            <label htmlFor="auto-switch-files" className="auto-switch-label">
              Auto-switch files
            </label>
          </div>

          {/* Timeline Compression Control */}
          <div className="compression-control">
            <input
              type="checkbox"
              id="timeline-compression"
              checked={compressionEnabled}
              onChange={(e) => {
                if (onToggleCompression) {
                  onToggleCompression(e.target.checked);
                }
              }}
              className="compression-checkbox"
            />
            <label htmlFor="timeline-compression" className="compression-label">
              Compress timeline
            </label>
            {compressionEnabled && compressionData && (
              <span className="compression-info">
                ({Math.round((1 - compressionData.compressionRatio) * 100)}%
                shorter)
              </span>
            )}
          </div>

          {/* Gap Threshold Control (shown when compression enabled) */}
          {compressionEnabled && (
            <div className="gap-threshold-control">
              <label htmlFor="gap-threshold-slider">Gap threshold:</label>
              <input
                id="gap-threshold-slider"
                type="range"
                min="60000" // 1 minute
                max="1800000" // 30 minutes
                step="60000" // 1 minute steps
                value={gapThreshold}
                onChange={(e) => {
                  if (onSetGapThreshold) {
                    onSetGapThreshold(parseInt(e.target.value));
                  }
                }}
                className="gap-threshold-slider"
              />
              <span className="gap-threshold-display">
                {formatGapDuration(gapThreshold)}
              </span>
            </div>
          )}
        </div>

        {/* Activity Indicator */}
        {/* Removed ActivityIndicator component */}

        <label htmlFor="zoom-slider">Zoom:</label>
        <input
          id="zoom-slider"
          type="range"
          min="1"
          max={baseZoom > 0 ? 10 / baseZoom : 10}
          step="0.1"
          value={baseZoom > 0 ? zoomLevel / baseZoom : 1}
          onChange={handleZoomChange}
          className="zoom-slider"
        />
        <span className="zoom-display">
          {Math.round((baseZoom > 0 ? zoomLevel / baseZoom : 1) * 100)}%
        </span>

        {/* Font Size Control */}
        <div className="font-size-control">
          <label htmlFor="font-size-slider">Font Size:</label>
          <input
            id="font-size-slider"
            type="range"
            min="10"
            max="30"
            step="1"
            value={fontSize}
            onChange={(e) => onSetFontSize(parseInt(e.target.value))}
            className="font-size-slider"
          />
          <span className="font-size-display">{fontSize}px</span>
        </div>
      </div>

      <div className="container">
        <div
          ref={timelineScrollRef}
          className="timeline-scroll-container"
          onScroll={handleScroll}
        >
          <div
            className="timeline-content"
            style={{ width: `${timelineWidth}px` }}
          >
            <TimelineTicks
              sessionStart={sessionStart}
              sessionDuration={sessionDuration}
              formatTime={formatTime}
              zoomLevel={zoomLevel}
              timelineWidth={timelineWidth}
              compileEvents={compileEvents}
              runEvents={runEvents}
              compressionEnabled={compressionEnabled}
              compressionData={compressionData}
            />
            <div className="timeline-divider" />
            <div
              ref={containerRef}
              className="playbar-container"
              onMouseDown={handleMouseDown}
            >
              {/* File-based Background Segments - divide the timeline background by files */}
              {effectiveFileSegments
                .map((segment, index) => {
                  const leftPercentage =
                    ((segment.start - sessionStart) / sessionDuration) * 100;
                  const rightPercentage =
                    ((segment.end - sessionStart) / sessionDuration) * 100;
                  const widthPercentage = rightPercentage - leftPercentage;

                  // When compression is enabled, we need to account for gaps that might be within this segment
                  let segmentParts = [
                    { left: leftPercentage, width: widthPercentage },
                  ];

                  if (
                    compressionEnabled &&
                    compressionData &&
                    compressionData.gaps
                  ) {
                    // Check if any gaps fall within this segment's time range
                    const gapsInSegment = compressionData.gaps.filter((gap) => {
                      // Find the compressed timeline positions for this gap
                      const sessionStartTime = new Date(
                        compressionData.activeSegments[0].compressedStartTime
                      );

                      // Find segments before and after this gap
                      const segmentBefore = compressionData.activeSegments.find(
                        (s) => s.endKeystrokeIndex === gap.startKeystrokeIndex
                      );
                      const segmentAfter = compressionData.activeSegments.find(
                        (s) => s.startKeystrokeIndex === gap.endKeystrokeIndex
                      );

                      if (segmentBefore && segmentAfter) {
                        const gapStartTime = new Date(
                          segmentBefore.compressedEndTime
                        );
                        const gapEndTime = new Date(
                          segmentAfter.compressedStartTime
                        );

                        const gapStartMs = gapStartTime - sessionStartTime;
                        const gapEndMs = gapEndTime - sessionStartTime;

                        const gapStartPercentage =
                          (gapStartMs /
                            compressionData.totalCompressedDuration) *
                          100;
                        const gapEndPercentage =
                          (gapEndMs / compressionData.totalCompressedDuration) *
                          100;

                        // Check if this gap overlaps with the current segment
                        return (
                          (gapStartPercentage >= leftPercentage &&
                            gapStartPercentage <= rightPercentage) ||
                          (gapEndPercentage >= leftPercentage &&
                            gapEndPercentage <= rightPercentage)
                        );
                      }
                      return false;
                    });

                    if (gapsInSegment.length > 0) {
                      // Split this segment around the gaps
                      segmentParts = [];
                      let currentLeft = leftPercentage;

                      gapsInSegment.forEach((gap) => {
                        const sessionStartTime = new Date(
                          compressionData.activeSegments[0].compressedStartTime
                        );
                        const segmentBefore =
                          compressionData.activeSegments.find(
                            (s) =>
                              s.endKeystrokeIndex === gap.startKeystrokeIndex
                          );
                        const segmentAfter =
                          compressionData.activeSegments.find(
                            (s) =>
                              s.startKeystrokeIndex === gap.endKeystrokeIndex
                          );

                        if (segmentBefore && segmentAfter) {
                          const gapStartTime = new Date(
                            segmentBefore.compressedEndTime
                          );
                          const gapEndTime = new Date(
                            segmentAfter.compressedStartTime
                          );

                          const gapStartMs = gapStartTime - sessionStartTime;
                          const gapEndMs = gapEndTime - sessionStartTime;

                          const gapStartPercentage =
                            (gapStartMs /
                              compressionData.totalCompressedDuration) *
                            100;
                          const gapEndPercentage =
                            (gapEndMs /
                              compressionData.totalCompressedDuration) *
                            100;

                          // Add segment part before the gap, leaving space for visual gap
                          if (gapStartPercentage > currentLeft) {
                            const segmentWidth =
                              gapStartPercentage - currentLeft;
                            const visualGapPercentage =
                              (3 / timelineWidth) * 100;

                            segmentParts.push({
                              left: currentLeft,
                              width: Math.max(
                                0,
                                segmentWidth - visualGapPercentage / 2
                              ), // Reserve half gap before
                            });
                          }

                          // Update current position to after the gap, accounting for visual spacing
                          const visualGapPercentage = (3 / timelineWidth) * 100;
                          currentLeft =
                            gapEndPercentage + visualGapPercentage / 2; // Reserve half gap after
                        }
                      });

                      // Add remaining part after all gaps
                      if (currentLeft < rightPercentage) {
                        segmentParts.push({
                          left: currentLeft,
                          width: rightPercentage - currentLeft,
                        });
                      }
                    }
                  }

                  // Add a fixed 3-pixel gap between segments (except the last one)
                  const adjustedSegmentParts = segmentParts.map(
                    (part, partIndex) => {
                      let adjustedWidth = part.width;
                      if (
                        index < effectiveFileSegments.length - 1 &&
                        partIndex === segmentParts.length - 1
                      ) {
                        // Convert 3 pixels to percentage based on current timeline width
                        const gapPercentage = (3 / timelineWidth) * 100;
                        adjustedWidth = Math.max(0, part.width - gapPercentage);
                      }
                      return { ...part, width: adjustedWidth };
                    }
                  );

                  return adjustedSegmentParts.map((part, partIndex) => {
                    // Constrain to timeline boundaries (respecting CSS padding)
                    const constrainedLeftPercentage = Math.max(
                      0,
                      Math.min(part.left, 100)
                    );
                    const constrainedWidthPercentage = Math.max(
                      0,
                      Math.min(part.width, 100 - constrainedLeftPercentage)
                    );

                    // Skip rendering if width is too small
                    if (constrainedWidthPercentage < 0.1) {
                      return null;
                    }

                    // Get the file color and lighter version for background
                    const fileColor =
                      fileColorMap[segment.filename] || "#E5E5E5";
                    const lightFileColor = getLighterColor(fileColor);

                    return (
                      <div
                        key={`file-bg-segment-${index}-${partIndex}`}
                        className="file-background-segment"
                        style={{
                          position: "absolute",
                          left: `${constrainedLeftPercentage}%`,
                          top: "0px",
                          width: `${constrainedWidthPercentage}%`,
                          height: "100%",
                          backgroundColor: lightFileColor, // Use lighter version of file color
                          border: `1px solid ${fileColor}`, // Use main file color for border
                          borderRadius: "2px",
                          zIndex: 1, // Below progress bars but above default background
                        }}
                        title={`File: ${segment.filename}`}
                      />
                    );
                  });
                })
                .flat()
                .filter(Boolean)}

              {/* File-based Playbar Segments (colored progress) */}
              {effectiveFileSegments
                .map((segment, index) => {
                  const leftPercentage =
                    ((segment.start - sessionStart) / sessionDuration) * 100;
                  const rightPercentage =
                    ((segment.end - sessionStart) / sessionDuration) * 100;
                  const fullSegmentWidthPercentage =
                    rightPercentage - leftPercentage;

                  // Calculate how much of this segment should be filled
                  let segmentProgress = 0;
                  if (
                    currentTime >= segment.start &&
                    currentTime <= segment.end
                  ) {
                    // Currently in this segment
                    segmentProgress =
                      (currentTime - segment.start) /
                      (segment.end - segment.start);
                  } else if (currentTime > segment.end) {
                    // Past this segment
                    segmentProgress = 1;
                  }

                  const fullFilledWidthPercentage =
                    fullSegmentWidthPercentage * segmentProgress;

                  // When compression is enabled, split progress around gaps
                  let progressParts = [
                    { left: leftPercentage, width: fullFilledWidthPercentage },
                  ];

                  if (
                    compressionEnabled &&
                    compressionData &&
                    compressionData.gaps &&
                    segmentProgress > 0
                  ) {
                    // Find gaps that intersect with this file segment's timeline position
                    const gapsInSegment = compressionData.gaps.filter((gap) => {
                      const sessionStartTime = new Date(
                        compressionData.activeSegments[0].compressedStartTime
                      );
                      const segmentBefore = compressionData.activeSegments.find(
                        (s) => s.endKeystrokeIndex === gap.startKeystrokeIndex
                      );
                      const segmentAfter = compressionData.activeSegments.find(
                        (s) => s.startKeystrokeIndex === gap.endKeystrokeIndex
                      );

                      if (segmentBefore && segmentAfter) {
                        const gapStartMs =
                          new Date(segmentBefore.compressedEndTime) -
                          sessionStartTime;
                        const gapEndMs =
                          new Date(segmentAfter.compressedStartTime) -
                          sessionStartTime;
                        const gapStartPercentage =
                          (gapStartMs /
                            compressionData.totalCompressedDuration) *
                          100;
                        const gapEndPercentage =
                          (gapEndMs / compressionData.totalCompressedDuration) *
                          100;

                        // Check if this gap overlaps with the file segment
                        return (
                          gapStartPercentage < rightPercentage &&
                          gapEndPercentage > leftPercentage
                        );
                      }
                      return false;
                    });

                    if (gapsInSegment.length > 0) {
                      progressParts = [];
                      const currentTimePercentage =
                        ((currentTime - sessionStart) / sessionDuration) * 100;

                      // Sort gaps by their start position
                      const sortedGaps = gapsInSegment.sort((a, b) => {
                        const sessionStartTime = new Date(
                          compressionData.activeSegments[0].compressedStartTime
                        );
                        const aStartMs =
                          new Date(
                            compressionData.activeSegments.find(
                              (s) =>
                                s.endKeystrokeIndex === a.startKeystrokeIndex
                            )?.compressedEndTime
                          ) - sessionStartTime;
                        const bStartMs =
                          new Date(
                            compressionData.activeSegments.find(
                              (s) =>
                                s.endKeystrokeIndex === b.startKeystrokeIndex
                            )?.compressedEndTime
                          ) - sessionStartTime;
                        return aStartMs - bStartMs;
                      });

                      let currentPos = leftPercentage;
                      const visualGapWidth = (3 / timelineWidth) * 100;

                      for (const gap of sortedGaps) {
                        const sessionStartTime = new Date(
                          compressionData.activeSegments[0].compressedStartTime
                        );
                        const segmentBefore =
                          compressionData.activeSegments.find(
                            (s) =>
                              s.endKeystrokeIndex === gap.startKeystrokeIndex
                          );
                        const segmentAfter =
                          compressionData.activeSegments.find(
                            (s) =>
                              s.startKeystrokeIndex === gap.endKeystrokeIndex
                          );

                        if (segmentBefore && segmentAfter) {
                          const gapStartMs =
                            new Date(segmentBefore.compressedEndTime) -
                            sessionStartTime;
                          const gapEndMs =
                            new Date(segmentAfter.compressedStartTime) -
                            sessionStartTime;
                          const gapStartPercentage =
                            (gapStartMs /
                              compressionData.totalCompressedDuration) *
                            100;
                          const gapEndPercentage =
                            (gapEndMs /
                              compressionData.totalCompressedDuration) *
                            100;

                          // Add progress before the gap (if current time reached it)
                          if (currentTimePercentage > currentPos) {
                            const progressWidth = Math.min(
                              currentTimePercentage - currentPos,
                              Math.max(0, gapStartPercentage - currentPos)
                            );

                            if (progressWidth > 0) {
                              progressParts.push({
                                left: currentPos,
                                width: progressWidth,
                              });
                            }
                          }

                          // Move position to after the gap
                          currentPos = gapEndPercentage + visualGapWidth;
                        }
                      }

                      // Add remaining progress after all gaps (if any)
                      if (
                        currentTimePercentage > currentPos &&
                        currentPos < rightPercentage
                      ) {
                        const remainingWidth = Math.min(
                          currentTimePercentage - currentPos,
                          rightPercentage - currentPos
                        );

                        if (remainingWidth > 0) {
                          progressParts.push({
                            left: currentPos,
                            width: remainingWidth,
                          });
                        }
                      }
                    }
                  }

                  // Apply the gap to the display width (for visual separation)
                  const adjustedProgressParts = progressParts.map(
                    (part, partIndex) => {
                      let displayWidth = part.width;
                      if (
                        index < effectiveFileSegments.length - 1 &&
                        partIndex === progressParts.length - 1 &&
                        segmentProgress >= 1 // Only apply gap when segment is fully completed
                      ) {
                        // Convert 3 pixels to percentage based on current timeline width
                        const gapPercentage = (3 / timelineWidth) * 100;
                        displayWidth = Math.max(0, part.width - gapPercentage);
                      }
                      return { ...part, width: displayWidth };
                    }
                  );

                  return adjustedProgressParts.map((part, partIndex) => {
                    // Constrain to timeline boundaries (respecting CSS padding)
                    const constrainedLeftPercentage = Math.max(
                      0,
                      Math.min(part.left, 100)
                    );
                    const constrainedFilledWidthPercentage = Math.max(
                      0,
                      Math.min(part.width, 100 - constrainedLeftPercentage)
                    );

                    // Only render if there's progress to show
                    if (constrainedFilledWidthPercentage > 0) {
                      // Get the file color
                      const fileColor =
                        fileColorMap[segment.filename] || "#2196F3";

                      return (
                        <div
                          key={`file-segment-${index}-${partIndex}`}
                          className="file-playbar-segment"
                          style={{
                            position: "absolute",
                            left: `${constrainedLeftPercentage}%`,
                            top: "0px", // Align with the top of the playbar container
                            width: `${constrainedFilledWidthPercentage}%`,
                            height: "100%", // Match the height of the main timeline bar
                            backgroundColor: fileColor, // Use file-specific color
                            borderRadius: "2px",
                            zIndex: 10, // Higher z-index to appear above timeline background
                          }}
                          title={`File: ${segment.filename} (Progress)`}
                        />
                      );
                    }
                    return null;
                  });
                })
                .flat()
                .filter(Boolean)}

              {/* Typing Activity Overlays - positioned above progress bars */}
              <TypingActivityOverlays
                typingActivitySegments={typingActivitySegments}
                sessionStart={sessionStart}
                sessionDuration={sessionDuration}
                currentKeystrokeIndex={currentKeystrokeIndex}
                keystrokeLogs={keystrokeLogs}
                fileSegments={effectiveFileSegments}
                fileColorMap={fileColorMap}
                currentTime={currentTime}
                timelineWidth={timelineWidth}
                activeFile={activeFile}
                autoSwitchFiles={autoSwitchFiles}
                compressionEnabled={compressionEnabled}
                compressionData={compressionData}
              />

              {/* Filename Labels - separate layer with highest z-index */}
              {effectiveFileSegments.map((segment, index) => {
                const leftPercentage =
                  ((segment.start - sessionStart) / sessionDuration) * 100;
                const rightPercentage =
                  ((segment.end - sessionStart) / sessionDuration) * 100;
                const widthPercentage = rightPercentage - leftPercentage;

                // Add a fixed 3-pixel gap between segments (except the last one)
                let adjustedWidthPercentage = widthPercentage;
                if (index < effectiveFileSegments.length - 1) {
                  // Convert 3 pixels to percentage based on current timeline width
                  const gapPercentage = (3 / timelineWidth) * 100;
                  adjustedWidthPercentage = Math.max(
                    0,
                    widthPercentage - gapPercentage
                  );
                }

                // Constrain to timeline boundaries (respecting CSS padding)
                const constrainedLeftPercentage = Math.max(
                  0,
                  Math.min(leftPercentage, 100)
                );
                const constrainedWidthPercentage = Math.max(
                  0,
                  Math.min(
                    adjustedWidthPercentage,
                    100 - constrainedLeftPercentage
                  )
                );

                // Extract just the filename without path
                const fileName = segment.filename
                  .split("/")
                  .pop()
                  .split("\\")
                  .pop();

                // Only show label if segment is wide enough (in percentage terms)
                if (constrainedWidthPercentage > 8) {
                  // Roughly equivalent to 100px at base zoom

                  // Calculate letter-by-letter color changes based on playhead position
                  const letters = fileName.split("");

                  return (
                    <div
                      key={`file-label-${index}`}
                      style={{
                        position: "absolute",
                        left: `${constrainedLeftPercentage}%`,
                        top: "4px",
                        fontSize: "12px",
                        fontWeight: "600",
                        width: `${constrainedWidthPercentage}%`,
                        overflow: "hidden",
                        zIndex: 15,
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        paddingLeft: "4px",
                      }}
                    >
                      <BsFiletypeJava
                        size={14}
                        style={{
                          color: "#dc3545",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          display: "flex",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {letters.map((letter, letterIndex) => {
                          // Calculate the horizontal position of this letter within the segment
                          // Account for the icon (14px + 4px gap = 18px) and padding (4px) = 22px total offset
                          const iconAndPaddingOffset = 22; // pixels
                          const iconOffsetPercentage =
                            (iconAndPaddingOffset / timelineWidth) * 100;

                          // More accurate character width mapping for 12px font
                          const getCharWidth = (char) => {
                            const charWidths = {
                              ".": 3, // period is very narrow
                              ",": 3, // comma is narrow
                              ":": 3, // colon is narrow
                              ";": 3, // semicolon is narrow
                              i: 3, // i is narrow
                              l: 3, // l is narrow
                              j: 4, // j is narrow
                              f: 4, // f is narrow
                              t: 4, // t is narrow
                              r: 4, // r is narrow
                              I: 2, // uppercase I is very narrow
                              " ": 4, // space
                              w: 9, // w is wide
                              m: 9, // m is wide
                              W: 10, // uppercase W is very wide
                              M: 9, // uppercase M is wide
                              A: 8, // most uppercase letters are wider
                              B: 7,
                              C: 7,
                              D: 8,
                              E: 6,
                              F: 6,
                              G: 8,
                              H: 8,
                              J: 5,
                              K: 7,
                              L: 6,
                              N: 8,
                              O: 8,
                              P: 6,
                              Q: 8,
                              R: 7,
                              S: 6,
                              T: 6,
                              U: 8,
                              V: 8,
                              X: 7,
                              Y: 7,
                              Z: 6,
                            };
                            return charWidths[char] || 7; // default to 7px for unlisted characters
                          };

                          // Calculate cumulative width up to this letter
                          let cumulativeWidth = 0;
                          for (let i = 0; i < letterIndex; i++) {
                            cumulativeWidth += getCharWidth(letters[i]);
                          }

                          const letterWidth = getCharWidth(letter);
                          const letterWidthPercentage =
                            (letterWidth / timelineWidth) * 100;
                          const cumulativeWidthPercentage =
                            (cumulativeWidth / timelineWidth) * 100;

                          // Calculate this letter's actual horizontal position
                          const letterStartPercentage =
                            constrainedLeftPercentage +
                            iconOffsetPercentage +
                            cumulativeWidthPercentage;

                          // Simple approach: start transition a fixed amount early, regardless of letter position
                          const earlyStartOffset = letterWidthPercentage * 0.5; // Always start 0.5 char early
                          const transitionStartPercentage =
                            letterStartPercentage - earlyStartOffset;
                          const transitionEndPercentage =
                            letterStartPercentage + letterWidthPercentage;
                          const transitionWidth =
                            letterWidthPercentage + earlyStartOffset;

                          // Calculate gradual color transition as playhead passes through this letter
                          let letterOpacity = 0;
                          if (currentPercentage >= transitionEndPercentage) {
                            // Playhead has completely passed this letter
                            letterOpacity = 1;
                          } else if (
                            currentPercentage >= transitionStartPercentage
                          ) {
                            // Playhead is currently passing through this letter
                            letterOpacity =
                              (currentPercentage - transitionStartPercentage) /
                              transitionWidth;
                          }
                          // If currentPercentage < transitionStartPercentage, letterOpacity stays 0

                          return (
                            <span
                              key={letterIndex}
                              style={{
                                color: `rgba(255, 255, 255, ${letterOpacity})`,
                                transition: "color 0.05s ease-out",
                                position: "relative",
                              }}
                            >
                              <span
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  color: "#333",
                                  zIndex: -1,
                                }}
                              >
                                {letter}
                              </span>
                              {letter}
                            </span>
                          );
                        })}
                      </span>
                    </div>
                  );
                }
                return null;
              })}

              {/* Timeline Gaps - positioned above all other elements */}
              <TimelineGaps
                compressionData={compressionData}
                sessionStart={sessionStart}
                sessionDuration={sessionDuration}
                timelineWidth={timelineWidth}
                isEnabled={compressionEnabled}
              />

              {/* Cursor - positioned based on current time */}
              <div
                className="cursor"
                style={{
                  left: `${currentPercentage}%`,
                  cursor: isDragging ? "grabbing" : "grab",
                  zIndex: 20, // Highest z-index to appear above everything
                }}
              />
            </div>

            {/* Activity Bar (Orange) */}
            <div className="activity-bar-container">
              {activitySegments.map((seg, index) => {
                const leftPercentage =
                  ((seg.start - sessionStart) / sessionDuration) * 100;
                const rightPercentage =
                  ((seg.end - sessionStart) / sessionDuration) * 100;
                const widthPercentage = rightPercentage - leftPercentage;

                // Constrain to timeline boundaries (respecting CSS padding)
                const constrainedLeftPercentage = Math.max(
                  0,
                  Math.min(leftPercentage, 100)
                );
                const constrainedWidthPercentage = Math.max(
                  0,
                  Math.min(widthPercentage, 100 - constrainedLeftPercentage)
                );

                return (
                  <div
                    key={index}
                    className="segment"
                    style={{
                      left: `${constrainedLeftPercentage}%`,
                      width: `${constrainedWidthPercentage}%`,
                      backgroundColor: "orange",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Media Controls */}
      <div className="media-controls-container">
        <button className="control-button" onClick={onRestart} title="Restart">
          <MdSkipPrevious size={24} />
        </button>
        <button
          className="control-button"
          onClick={onSkipBackward}
          title="Skip Backward"
        >
          <MdFastRewind size={24} />
        </button>
        <button
          className="control-button primary"
          onClick={onPlayPause}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <MdPause size={28} /> : <MdPlayArrow size={28} />}
        </button>
        <button
          className="control-button"
          onClick={onSkipForward}
          title="Skip Forward"
        >
          <MdFastForward size={24} />
        </button>
        <button
          className="control-button"
          onClick={onSkipToEnd}
          title="Skip to End"
        >
          <MdSkipNext size={24} />
        </button>

        {/* Playback Speed Control */}
        <div className="playback-speed-control">
          <label htmlFor="speed-slider">Speed:</label>
          <input
            id="speed-slider"
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={playbackSpeed}
            onChange={(e) => onSetPlaybackSpeed(parseFloat(e.target.value))}
            className="speed-slider"
          />
          <span className="speed-display">x{playbackSpeed.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

// Add some default props for demonstration
PlaybarComponent.defaultProps = {
  activitySegments: [
    { start: 2, end: 6 },
    { start: 7, end: 12 },
    { start: 15, end: 20 },
  ],
};

export default memo(PlaybarComponent);
