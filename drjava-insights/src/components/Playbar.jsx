import { useState, useEffect, useRef, useCallback } from "react";

// Reactive React Playbar Component
function PlaybarComponent({
  segments = [],
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

  // Generate evenly spaced lines (not hour-based)
  const spacedLines = [];
  const numberOfLines = 10; // Number of evenly spaced lines

  for (let i = 1; i < numberOfLines; i++) {
    const percentage = (i / numberOfLines) * 100;
    const timeAtLine = sessionStart + (i / numberOfLines) * sessionDuration;

    // Determine color based on what's behind the line
    const isUnderPlaybar = timeAtLine <= currentTime;

    let color = "#999"; // default grey

    if (isUnderPlaybar) {
      color = "#0088cc"; // Darker blue
    }

    spacedLines.push(
      <div
        key={i}
        className="hour-line"
        style={{
          left: `${percentage}%`,
          borderLeftColor: color,
          backgroundColor: color,
        }}
      />
    );
  }

  const currentPercentage = timeToPercentage(currentTime);

  return (
    <div className="container">
      <div
        ref={containerRef}
        className="playbar-container"
        onMouseDown={handleMouseDown}
      >
        {/* Spaced lines layer */}
        <div className="hour-line-container">{spacedLines}</div>

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
    </div>
  );
}

export default PlaybarComponent;
