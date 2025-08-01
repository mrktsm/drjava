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

const TimelineTicks = memo(function TimelineTicks({
  sessionStart,
  sessionDuration,
  formatTime,
  zoomLevel,
  timelineWidth,
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
        const timeAtLine = sessionStart + (i / totalLines) * sessionDuration;
        label = <div className="hour-label">{formatTime(timeAtLine)}</div>;
      }

      lines.push(
        <div key={i} className={className} style={style}>
          {label}
        </div>
      );
    }
    return lines;
  }, [sessionStart, sessionDuration, formatTime, zoomLevel]);

  return (
    <div className="time-ticks-container">
      {spacedLines}
      <TimelineEvents timelineWidth={timelineWidth} />
    </div>
  );
});

// Component for rendering run and compile events
const TimelineEvents = memo(function TimelineEvents({ timelineWidth }) {
  const events = useMemo(() => {
    // Generate random events for demonstration
    const eventTypes = [
      { icon: BsPlayCircleFill, type: "run", color: "#28a745" }, // Green for run
      { icon: BsTools, type: "compile", color: "#ffc107" }, // Yellow for compile
    ];

    const randomEvents = [];
    const numEvents = Math.floor(Math.random() * 8) + 4; // 4-12 events

    for (let i = 0; i < numEvents; i++) {
      let eventType = {
        ...eventTypes[Math.floor(Math.random() * eventTypes.length)],
      };
      const position = Math.random() * 90 + 5; // 5% to 95% across timeline

      // Randomly add errors to some compile events
      if (eventType.type === "compile" && Math.random() < 0.4) {
        // 40% chance of error
        eventType.hasError = true;
      }

      randomEvents.push({
        id: i,
        position,
        ...eventType,
      });
    }

    return randomEvents.sort((a, b) => a.position - b.position);
  }, [timelineWidth]);

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
}) {
  const [isDragging, setIsDragging] = useState(false);
  // Remove playbarWidth state since we now use file segments
  // const [playbarWidth, setPlaybarWidth] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1); // Represents the actual zoom factor
  const [baseZoom, setBaseZoom] = useState(1); // The zoom factor for "100% fit-to-width"
  const [
    // scrollLeft,
    setScrollLeft,
  ] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);

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

      // Get the scroll container's position (this is what's visible)
      const scrollRect = timelineScrollRef.current.getBoundingClientRect();
      const scrollContainer = timelineScrollRef.current;

      // Calculate mouse position relative to the scrollable area
      // Account for scroll position and padding (15px on left)
      const relativeX =
        clientX - scrollRect.left - 15 + scrollContainer.scrollLeft;

      // Convert to percentage of total timeline width
      const percentage = Math.max(
        0,
        Math.min(100, (relativeX / timelineWidth) * 100)
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

  // Remove old playbar width calculation since we now use file segments
  // const constrainedPlaybarWidth = useMemo(() => {
  //   if (!containerRef.current) return playbarWidth;
  //   const containerWidth = containerRef.current.offsetWidth;
  //   return Math.min(playbarWidth, containerWidth - 3);
  // }, [playbarWidth, containerRef.current?.offsetWidth]);

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
        const mouseTimelineX = mouseX + currentScrollLeft - 15; // Subtract 15px padding
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
          const targetScrollLeft = newMouseTimelineX - mouseViewportOffset + 15; // Add back 15px padding

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
      {/* Zoom Controls with File Explorer and Font Size */}
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
        </div>

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
            />
            <div className="timeline-divider" />
            <div
              ref={containerRef}
              className="playbar-container"
              onMouseDown={handleMouseDown}
            >
              {/* File-based Background Segments - divide the timeline background by files */}
              {fileSegments.map((segment, index) => {
                const segmentStartPixels = timeToPixels(segment.start);
                const segmentEndPixels = timeToPixels(segment.end);
                let segmentWidth = segmentEndPixels - segmentStartPixels;

                // Add a fixed 3-pixel gap between segments (except the last one)
                if (index < fileSegments.length - 1) {
                  segmentWidth = Math.max(0, segmentWidth - 3);
                }

                // Constrain positions to container boundaries
                const containerWidth =
                  containerRef.current?.offsetWidth || timelineWidth;
                const constrainedStartPixels = Math.min(
                  segmentStartPixels,
                  containerWidth - 3
                );
                const constrainedWidth = Math.min(
                  segmentWidth,
                  containerWidth - constrainedStartPixels
                );

                // Get the file color and lighter version for background
                const fileColor = fileColorMap[segment.filename] || "#E5E5E5";
                const lightFileColor = getLighterColor(fileColor);

                return (
                  <div
                    key={`file-bg-segment-${index}`}
                    className="file-background-segment"
                    style={{
                      position: "absolute",
                      left: `${constrainedStartPixels}px`,
                      top: "0px",
                      width: `${constrainedWidth}px`,
                      height: "100%",
                      backgroundColor: lightFileColor, // Use lighter version of file color
                      border: `1px solid ${fileColor}`, // Use main file color for border
                      borderRadius: "2px",
                      zIndex: 1, // Below progress bars but above default background
                    }}
                    title={`File: ${segment.filename}`}
                  />
                );
              })}

              {/* File-based Playbar Segments (colored progress) */}
              {fileSegments.map((segment, index) => {
                const segmentStartPixels = timeToPixels(segment.start);
                const segmentEndPixels = timeToPixels(segment.end);
                const fullSegmentWidth = segmentEndPixels - segmentStartPixels;

                // Calculate how much of this segment should be filled (based on full width)
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

                const fullFilledWidth = fullSegmentWidth * segmentProgress;

                // Apply the gap to the display width (for visual separation)
                let displaySegmentWidth = fullSegmentWidth;
                if (index < fileSegments.length - 1) {
                  displaySegmentWidth = Math.max(0, fullSegmentWidth - 3);
                }

                // The progress width should be proportional to the display width
                const filledWidth = Math.min(
                  fullFilledWidth,
                  displaySegmentWidth
                );

                // Constrain positions to container boundaries
                const containerWidth =
                  containerRef.current?.offsetWidth || timelineWidth;
                const constrainedStartPixels = Math.min(
                  segmentStartPixels,
                  containerWidth - 3
                );
                const constrainedFilledWidth = Math.min(
                  filledWidth,
                  containerWidth - constrainedStartPixels
                );

                // Get the file color
                const fileColor = fileColorMap[segment.filename] || "#2196F3";

                // Only render if there's progress to show
                if (constrainedFilledWidth > 0) {
                  return (
                    <div
                      key={`file-segment-${index}`}
                      className="file-playbar-segment"
                      style={{
                        position: "absolute",
                        left: `${constrainedStartPixels}px`,
                        top: "0px", // Align with the top of the playbar container
                        width: `${constrainedFilledWidth}px`,
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
              })}

              {/* Filename Labels - separate layer with highest z-index */}
              {fileSegments.map((segment, index) => {
                const segmentStartPixels = timeToPixels(segment.start);
                const segmentEndPixels = timeToPixels(segment.end);
                let segmentWidth = segmentEndPixels - segmentStartPixels;

                // Add a fixed 3-pixel gap between segments (except the last one)
                if (index < fileSegments.length - 1) {
                  segmentWidth = Math.max(0, segmentWidth - 3);
                }

                // Constrain positions to container boundaries
                const containerWidth =
                  containerRef.current?.offsetWidth || timelineWidth;
                const constrainedStartPixels = Math.min(
                  segmentStartPixels,
                  containerWidth - 3
                );
                const constrainedWidth = Math.min(
                  segmentWidth,
                  containerWidth - constrainedStartPixels
                );

                // Calculate cursor position relative to this segment
                const cursorPixels = timeToPixels(currentTime);

                // Extract just the filename without path
                const fileName = segment.filename
                  .split("/")
                  .pop()
                  .split("\\")
                  .pop();

                // Only show label if segment is wide enough
                if (constrainedWidth > 100) {
                  const textStartPixels = constrainedStartPixels + 4 + 18; // Account for left padding + icon width

                  return (
                    <div
                      key={`file-label-${index}`}
                      style={{
                        position: "absolute",
                        left: `${constrainedStartPixels + 4}px`,
                        top: "4px",
                        fontSize: "12px",
                        fontWeight: "600",
                        maxWidth: `${constrainedWidth - 10}px`,
                        overflow: "hidden",
                        zIndex: 15,
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
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
                        {fileName.split("").map((char, charIndex) => {
                          // Estimate character width (trying 6.5px per character for better alignment)
                          const charWidth = 5.5;
                          const charStartPixels =
                            textStartPixels + charIndex * charWidth;
                          const charEndPixels = charStartPixels + charWidth;

                          // Determine character color based on cursor position
                          let charColor = "#333"; // Default dark color

                          if (cursorPixels >= charEndPixels) {
                            // Cursor has passed this character completely
                            charColor = "#fff";
                          } else if (
                            cursorPixels >= charStartPixels &&
                            cursorPixels <= charEndPixels
                          ) {
                            // Cursor is within this character - smooth transition
                            const charProgress =
                              (cursorPixels - charStartPixels) / charWidth;
                            const opacity = Math.min(
                              1,
                              Math.max(0, charProgress)
                            );

                            // Interpolate between dark and light
                            const darkColor = { r: 51, g: 51, b: 51 };
                            const lightColor = { r: 255, g: 255, b: 255 };

                            const r = Math.round(
                              darkColor.r +
                                (lightColor.r - darkColor.r) * opacity
                            );
                            const g = Math.round(
                              darkColor.g +
                                (lightColor.g - darkColor.g) * opacity
                            );
                            const b = Math.round(
                              darkColor.b +
                                (lightColor.b - darkColor.b) * opacity
                            );

                            charColor = `rgb(${r}, ${g}, ${b})`;
                          }

                          return (
                            <span
                              key={charIndex}
                              style={{
                                color: charColor,
                                transition: "color 0.05s ease", // Faster transition for individual characters
                              }}
                            >
                              {char}
                            </span>
                          );
                        })}
                      </span>
                    </div>
                  );
                }
                return null;
              })}

              {/* Cursor - positioned based on current time */}
              <div
                className="cursor"
                style={{
                  left: `${Math.min(
                    timeToPixels(currentTime),
                    (containerRef.current?.offsetWidth || timelineWidth) - 3
                  )}px`,
                  cursor: isDragging ? "grabbing" : "grab",
                  zIndex: 20, // Highest z-index to appear above everything
                }}
              />
            </div>

            {/* Activity Bar (Orange) */}
            <div className="activity-bar-container">
              {activitySegments.map((seg, index) => {
                const leftPixels = timeToPixels(seg.start);
                const rightPixels = timeToPixels(seg.end);
                const widthPixels = rightPixels - leftPixels;
                const constrainedLeftPixels = Math.min(
                  leftPixels,
                  (containerRef.current?.offsetWidth || timelineWidth) - 3
                );
                const constrainedWidthPixels = Math.min(
                  widthPixels,
                  (containerRef.current?.offsetWidth || timelineWidth) -
                    constrainedLeftPixels
                );

                return (
                  <div
                    key={index}
                    className="segment"
                    style={{
                      left: `${constrainedLeftPixels}px`,
                      width: `${constrainedWidthPixels}px`,
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
          <MdSkipPrevious size={18} />
        </button>
        <button
          className="control-button"
          onClick={onSkipBackward}
          title="Skip Backward"
        >
          <MdFastRewind size={18} />
        </button>
        <button
          className="control-button primary"
          onClick={onPlayPause}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <MdPause size={18} /> : <MdPlayArrow size={18} />}
        </button>
        <button
          className="control-button"
          onClick={onSkipForward}
          title="Skip Forward"
        >
          <MdFastForward size={18} />
        </button>
        <button
          className="control-button"
          onClick={onSkipToEnd}
          title="Skip to End"
        >
          <MdSkipNext size={18} />
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
