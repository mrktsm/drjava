import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";

const TimelineTicks = memo(function TimelineTicks({
  sessionStart,
  sessionDuration,
  formatTime,
  zoomLevel,
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

  return <div className="time-ticks-container">{spacedLines}</div>;
});

// Reactive React Playbar Component
function PlaybarComponent({
  segments = [],
  activitySegments = [], // New prop for activity segments
  currentTime,
  onTimeChange,
  sessionStart = 0,
  sessionEnd = 24,
  sessionDuration = 24,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [playbarWidth, setPlaybarWidth] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1); // Will be updated on mount
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const containerRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const baseTimelineWidth = 800; // Base width in pixels

  // Calculate actual timeline width based on zoom
  const timelineWidth = useMemo(() => {
    return baseTimelineWidth * zoomLevel;
  }, [zoomLevel]);

  // Calculate initial zoom to fit container width
  const calculateInitialZoom = useCallback(() => {
    if (!timelineScrollRef.current) return 1;

    const containerWidth = timelineScrollRef.current.offsetWidth;
    // Subtract padding (30px total: 15px on each side)
    const availableWidth = containerWidth - 30;
    const initialZoom = Math.max(0.5, availableWidth / baseTimelineWidth);

    return Math.min(10, initialZoom); // Cap at max zoom level
  }, []);

  // Calculate minimum zoom to fit container width
  const getMinZoom = useCallback(() => {
    if (!timelineScrollRef.current) return 0.5;

    const containerWidth = timelineScrollRef.current.offsetWidth;
    // Subtract padding (30px total: 15px on each side)
    const availableWidth = containerWidth - 30;
    const minZoom = availableWidth / baseTimelineWidth;

    return Math.max(0.5, minZoom); // Still respect absolute minimum of 50%
  }, []);

  // Initialize zoom level on mount
  useEffect(() => {
    if (!isInitialized && timelineScrollRef.current) {
      const initialZoom = calculateInitialZoom();
      setZoomLevel(initialZoom);
      setIsInitialized(true);
    }
  }, [calculateInitialZoom, isInitialized]);

  // Recalculate zoom on window resize
  useEffect(() => {
    const handleResize = () => {
      if (isInitialized) {
        const newZoom = calculateInitialZoom();
        setZoomLevel(newZoom);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [calculateInitialZoom, isInitialized]);

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

  // Handle zoom change
  const handleZoomChange = useCallback(
    (e) => {
      const newZoom = parseFloat(e.target.value);
      const minZoom = getMinZoom();
      // Ensure zoom doesn't go below the minimum required to fill the window
      setZoomLevel(Math.max(minZoom, newZoom));
    },
    [getMinZoom]
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

  // Update playbar width based on current time
  useEffect(() => {
    const cursorPixelPosition = timeToPixels(currentTime);
    setPlaybarWidth(cursorPixelPosition);
  }, [currentTime, timeToPixels]);

  // Auto-scroll when playing
  useEffect(() => {
    scrollToKeepCursorVisible();
  }, [scrollToKeepCursorVisible]);

  // Handle scroll events
  const handleScroll = useCallback((e) => {
    setScrollLeft(e.target.scrollLeft);
  }, []);

  const currentPercentage = timeToPercentage(currentTime);

  return (
    <div className="playbar-wrapper">
      {/* Zoom Controls */}
      <div className="zoom-controls">
        <label htmlFor="zoom-slider">Zoom:</label>
        <input
          id="zoom-slider"
          type="range"
          min={getMinZoom()}
          max="10"
          step="0.1"
          value={zoomLevel}
          onChange={handleZoomChange}
          className="zoom-slider"
        />
        <span className="zoom-display">{Math.round(zoomLevel * 100)}%</span>
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
            />
            <div className="timeline-divider" />
            <div
              ref={containerRef}
              className="playbar-container"
              onMouseDown={handleMouseDown}
            >
              {/* Playbar (blue progress) */}
              <div className="playbar" style={{ width: `${playbarWidth}px` }} />

              {/* Cursor - moved out of playbar to respect z-index */}
              <div
                className="cursor"
                style={{
                  left: `${playbarWidth}px`,
                  cursor: isDragging ? "grabbing" : "grab",
                }}
              />
            </div>

            {/* Activity Bar (Orange) */}
            <div className="activity-bar-container">
              {activitySegments.map((seg, index) => {
                const left = timeToPercentage(seg.start);
                const width = timeToPercentage(seg.end) - left;
                return (
                  <div
                    key={index}
                    className="segment"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: "orange",
                    }}
                  />
                );
              })}
            </div>
          </div>
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
