import { useState, useEffect, useRef, useCallback } from "react";

// Reactive React Playbar Component
function PlaybarComponent() {
  const [currentTime, setCurrentTime] = useState(8.2); // 8:12 in decimal hours
  const [isDragging, setIsDragging] = useState(false);
  const [playbarWidth, setPlaybarWidth] = useState(0);

  const containerRef = useRef(null);
  const totalDuration = 24; // 24 hours

  // Sample segments - in a real app these would come from props
  const segments = [
    { start: 8.2, end: 11.53 }, // 08:12 to 11:32
    { start: 14, end: 18 }, // 14:00 to 18:00
  ];

  // Convert decimal hours to time string
  const formatTime = useCallback((decimalHours) => {
    const hours = Math.floor(decimalHours).toString().padStart(2, "0");
    const minutes = Math.round((decimalHours % 1) * 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}`;
  }, []);

  // Convert time position to percentage
  const timeToPercentage = useCallback(
    (time) => {
      return (time / totalDuration) * 100;
    },
    [totalDuration]
  );

  // Convert mouse position to time
  const mouseToTime = useCallback(
    (clientX) => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const percentage = Math.max(
        0,
        Math.min(100, (relativeX / rect.width) * 100)
      );
      return (percentage / 100) * totalDuration;
    },
    [totalDuration]
  );

  // Handle mouse down on playbar
  const handleMouseDown = useCallback(
    (e) => {
      setIsDragging(true);
      const newTime = mouseToTime(e.clientX);
      setCurrentTime(newTime);
      console.log("Time changed:", formatTime(newTime));
    },
    [mouseToTime, formatTime]
  );

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const newTime = mouseToTime(e.clientX);
      setCurrentTime(newTime);
      console.log("Time changed:", formatTime(newTime));
    },
    [isDragging, mouseToTime, formatTime]
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

  // Generate hour lines (1-23, skipping 0)
  const hourLines = [];
  for (let i = 1; i < totalDuration; i++) {
    const percentage = timeToPercentage(i);

    // Determine color based on what's behind the line
    const isUnderPlaybar = i <= currentTime;
    const isUnderSegment = segments.some(
      (segment) => i >= segment.start && i <= segment.end
    );

    let color = "#999"; // default grey

    if (isUnderPlaybar && isUnderSegment) {
      color = "#008080"; // Teal (blue-green) for overlap
    } else if (isUnderPlaybar) {
      color = "#0088cc"; // Darker blue
    } else if (isUnderSegment) {
      color = "#cc9900"; // Darker orange
    }

    hourLines.push(
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

  // Generate segment elements
  const segmentElements = segments.map((segment, index) => {
    const startPercentage = timeToPercentage(segment.start);
    const width = timeToPercentage(segment.end - segment.start);

    return (
      <div
        key={index}
        className="segment"
        style={{
          left: `${startPercentage}%`,
          width: `${width}%`,
        }}
      />
    );
  });

  const currentPercentage = timeToPercentage(currentTime);

  return (
    <div className="container">
      <div
        ref={containerRef}
        className="playbar-container"
        onMouseDown={handleMouseDown}
      >
        {/* Segments layer */}
        <div className="segments-container">{segmentElements}</div>

        {/* Hour lines layer */}
        <div className="hour-line-container">{hourLines}</div>

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
