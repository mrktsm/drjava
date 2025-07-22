import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";

const TimelineTicks = memo(function TimelineTicks({
  sessionStart,
  sessionDuration,
  formatTime,
}) {
  const spacedLines = useMemo(() => {
    const lines = [];
    const numberOfLines = 10; // Number of main sections
    const subdivisions = 2; // Number of subdivisions between main lines
    const totalLines = numberOfLines * subdivisions;

    for (let i = 0; i <= totalLines; i++) {
      const percentage = (i / totalLines) * 100;
      const color = "#999"; // Ticks are a constant color now
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
  }, [sessionStart, sessionDuration, formatTime]);

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

  const containerRef = useRef(null);

  // Convert decimal hours to time string
  const formatTime = useCallback((decimalHours) => {
    const hours = Math.floor(decimalHours).toString().padStart(2, "0");
    const minutes = Math.round((decimalHours % 1) * 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}`;
  }, []);

  // Convert time position to percentage (relative to session duration)
  const timeToPercentage = useCallback(
    (time) => {
      return ((time - sessionStart) / sessionDuration) * 100;
    },
    [sessionStart, sessionDuration]
  );

  // Convert mouse position to time
  const mouseToTime = useCallback(
    (clientX) => {
      if (!containerRef.current) return sessionStart;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const percentage = Math.max(
        0,
        Math.min(100, (relativeX / rect.width) * 100)
      );
      return sessionStart + (percentage / 100) * sessionDuration;
    },
    [sessionStart, sessionDuration]
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
    if (containerRef.current) {
      const percentage = timeToPercentage(currentTime);
      const width = (percentage / 100) * containerRef.current.offsetWidth;
      setPlaybarWidth(width);
    }
  }, [currentTime, timeToPercentage]);

  const currentPercentage = timeToPercentage(currentTime);

  return (
    <div className="container">
      <TimelineTicks
        sessionStart={sessionStart}
        sessionDuration={sessionDuration}
        formatTime={formatTime}
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
