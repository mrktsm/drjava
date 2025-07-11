import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import "./App.css";
import {
  FaPlay,
  FaPause,
  FaFastBackward,
  FaBackward,
  FaForward,
  FaFastForward,
} from "react-icons/fa";

// Playbar class converted for React
class Playbar {
  constructor(callback = null) {
    this.totalDuration = 24;
    this.segmentWidth = 100 / this.totalDuration;
    this.segments = [];
    this.playbarContainer = null;
    this.playbar = null;
    this.cursor = null;
    this.segmentsContainer = null;
    this.currentTime = "00:00";
    this.callback = callback;
  }

  create(container) {
    this.playbarContainer = container;

    this.createPlaybar();
    this.createCursor();
    this.createSegments();
    this.createHourLines();

    this.updatePlaybarAndLogTime({
      clientX: this.playbar.getBoundingClientRect().left,
    });

    this.cursor.addEventListener("mousedown", () => {
      document.addEventListener("mousemove", this.updatePlaybarAndLogTime);
    });

    document.addEventListener("mouseup", () => {
      document.removeEventListener("mousemove", this.updatePlaybarAndLogTime);
    });
  }

  createHourLines() {
    const numHours = this.totalDuration;
    this.hourLineContainer = document.createElement("div");
    this.hourLineContainer.className = "hour-line-container";

    this.hourLines = []; // Store references to hour lines

    for (let i = 1; i < numHours; i++) {
      // Start from 1 instead of 0 to skip leftmost line
      const hourLine = document.createElement("div");
      hourLine.className = "hour-line";
      hourLine.style.left = i * this.segmentWidth + "%";
      hourLine.dataset.hour = i; // Store hour for reference
      this.hourLineContainer.appendChild(hourLine);
      this.hourLines.push(hourLine);

      // Removed hour label creation - no more labels at the bottom
    }

    this.playbarContainer.appendChild(this.hourLineContainer);
    this.updateHourLineColors();
  }

  updateHourLineColors() {
    if (!this.hourLines) return;

    this.hourLines.forEach((line) => {
      const hour = parseInt(line.dataset.hour);
      const position = hour * this.segmentWidth; // Position as percentage

      // Check if this line is under the blue playbar
      const playbarWidth = parseFloat(this.playbar.style.width) || 0;
      const playbarPercentage =
        (playbarWidth / this.playbarContainer.offsetWidth) * 100;

      const isUnderPlaybar = position <= playbarPercentage;

      // Check if this line is under any orange segment
      const isUnderSegment = this.segments.some((segment) => {
        const startTime = segment.start.split(":");
        const startHour = parseInt(startTime[0]) + parseInt(startTime[1]) / 60;
        const endTime = segment.end.split(":");
        const endHour = parseInt(endTime[0]) + parseInt(endTime[1]) / 60;

        return hour >= startHour && hour <= endHour;
      });

      // Set color based on what's behind the line
      if (isUnderPlaybar) {
        // Darker blue when over blue playbar
        line.style.borderLeftColor = "#0088cc";
        line.style.backgroundColor = "#0088cc";
      } else if (isUnderSegment) {
        // Darker orange when over orange segment
        line.style.borderLeftColor = "#cc9900";
        line.style.backgroundColor = "#cc9900";
      } else {
        // Lighter grey when over grey background (less harsh than black)
        line.style.borderLeftColor = "#999";
        line.style.backgroundColor = "#999";
      }
    });
  }

  createPlaybar() {
    this.playbar = document.createElement("div");
    this.playbar.className = "playbar";
    this.playbarContainer.appendChild(this.playbar);
  }

  createCursor() {
    this.cursor = document.createElement("div");
    this.cursor.className = "cursor";
    this.playbar.appendChild(this.cursor);
  }

  createSegments() {
    this.segmentsContainer = document.createElement("div");
    this.segmentsContainer.className = "segments-container";
    this.playbarContainer.appendChild(this.segmentsContainer);

    this.segments.forEach((segment) => {
      this.createSegmentElement(segment.start, segment.end);
    });
  }

  createSegmentElement(start, end) {
    const startTime = start.split(":");
    const startHour = parseInt(startTime[0]);
    const startMinute = parseInt(startTime[1]);

    const endTime = end.split(":");
    const endHour = parseInt(endTime[0]);
    const endMinute = parseInt(endTime[1]);

    const segmentElement = document.createElement("div");
    segmentElement.className = "segment";
    segmentElement.style.left =
      (startHour + startMinute / 60) * this.segmentWidth + "%";
    segmentElement.style.width =
      (endHour - startHour + (endMinute - startMinute) / 60) *
        this.segmentWidth +
      "%";

    this.segmentsContainer.appendChild(segmentElement);
  }

  updatePlaybarAndLogTime = (event) => {
    const playbarWidth =
      event.clientX - this.playbar.getBoundingClientRect().left;
    const currentTime =
      (playbarWidth / this.playbarContainer.offsetWidth) * this.totalDuration;
    const formattedTime = this.formatTime(currentTime);

    clearTimeout(this.logTimeTimeout);

    this.logTimeTimeout = setTimeout(() => {
      console.log("Current time:", formattedTime);
      this.currentTime = formattedTime;

      if (this.callback) {
        this.callback(this.currentTime);
      }
    }, 500);

    this.playbar.style.width = playbarWidth + "px";
    this.cursor.style.left = playbarWidth + "px";

    // Update hour line colors when playbar changes
    this.updateHourLineColors();
  };

  jumpCursorToTime(time) {
    const [hours, minutes] = time.split(":");
    const targetPosition =
      (parseInt(hours) + parseInt(minutes) / 60) * this.segmentWidth;
    const targetWidth =
      targetPosition * (this.playbarContainer.offsetWidth / 100);

    this.cursor.style.left = targetWidth + "px";
    this.playbar.style.width = targetWidth + "px";

    console.log("Cursor jumped to:", time);
    this.currentTime = time;

    // Update hour line colors when cursor jumps
    this.updateHourLineColors();
  }

  formatTime(time) {
    const hours = Math.floor(time).toString().padStart(2, "0");
    const minutes = Math.round((time % 1) * 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  addSegment(start, end) {
    this.segments.push({ start, end });
    this.createSegmentElement(start, end);
    // Update hour line colors when segments change
    this.updateHourLineColors();
  }

  removeSegment(start, end) {
    const index = this.segments.findIndex(
      (segment) => segment.start === start && segment.end === end
    );

    if (index !== -1) {
      this.segments.splice(index, 1);
      this.segmentsContainer.removeChild(
        this.segmentsContainer.children[index]
      );
      // Update hour line colors when segments change
      this.updateHourLineColors();
    }
  }

  removeAllSegments() {
    this.segments = [];
    this.segmentsContainer.innerHTML = "";
    // Update hour line colors when segments change
    this.updateHourLineColors();
  }
}

// React component for media controls
function MediaControls({
  isPlaying = false,
  onPlayPause,
  onSkipBackward,
  onSkipForward,
  onRestart,
  onSkipToEnd,
}) {
  return (
    <div className="media-controls-container">
      <button className="control-button" onClick={onRestart} title="Restart">
        <FaFastBackward />
      </button>
      <button
        className="control-button"
        onClick={onSkipBackward}
        title="Skip Backward"
      >
        <FaBackward />
      </button>
      <button
        className="control-button primary"
        onClick={onPlayPause}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <FaPause /> : <FaPlay />}
      </button>
      <button
        className="control-button"
        onClick={onSkipForward}
        title="Skip Forward"
      >
        <FaForward />
      </button>
      <button
        className="control-button"
        onClick={onSkipToEnd}
        title="Skip to End"
      >
        <FaFastForward />
      </button>
    </div>
  );
}

// React component for the playbar
function PlaybarComponent() {
  const playbarRef = useRef(null);
  const playbarInstanceRef = useRef(null);
  const [currentTime, setCurrentTime] = useState("00:00");
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (playbarRef.current && !playbarInstanceRef.current) {
      const playbar = new Playbar((time) => {
        console.log("Time changed:", time);
        setCurrentTime(time);
      });

      playbar.create(playbarRef.current);
      playbar.addSegment("08:12", "11:32");
      playbar.addSegment("14:00", "18:00");
      playbar.jumpCursorToTime("08:12");
      setCurrentTime("08:12");

      playbarInstanceRef.current = playbar;
    }

    return () => {
      // Cleanup event listeners when component unmounts
      if (playbarInstanceRef.current) {
        document.removeEventListener(
          "mousemove",
          playbarInstanceRef.current.updatePlaybarAndLogTime
        );
      }
    };
  }, []);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    console.log(isPlaying ? "Paused" : "Playing");
  };

  const handleSkipBackward = () => {
    console.log("Skip backward");
    // Add logic to skip backward
  };

  const handleSkipForward = () => {
    console.log("Skip forward");
    // Add logic to skip forward
  };

  const handleRestart = () => {
    console.log("Restart");
    if (playbarInstanceRef.current) {
      playbarInstanceRef.current.jumpCursorToTime("00:00");
      setCurrentTime("00:00");
      setIsPlaying(false);
    }
  };

  const handleSkipToEnd = () => {
    console.log("Skip to end");
    if (playbarInstanceRef.current) {
      playbarInstanceRef.current.jumpCursorToTime("23:59");
      setCurrentTime("23:59");
      setIsPlaying(false);
    }
  };

  return (
    <>
      <MediaControls
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSkipBackward={handleSkipBackward}
        onSkipForward={handleSkipForward}
        onRestart={handleRestart}
        onSkipToEnd={handleSkipToEnd}
      />
      <div className="container">
        <div
          ref={playbarRef}
          id="playbar-container"
          className="playbar-container"
        ></div>
      </div>
    </>
  );
}

function App() {
  const [code, setCode] = useState(`// DrJava Insights - Code Activity Viewer
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Welcome to DrJava Insights!");
        
        // This editor will show your actual Java files
        // based on DrJava activity logs
    }
}`);

  // Detect platform and set appropriate font family to match DrJava
  const [fontFamily, setFontFamily] = useState("");

  useEffect(() => {
    // Detect if we're on Mac (like DrJava does)
    const isMac =
      /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
      /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

    if (isMac) {
      // On Mac, DrJava uses Monaco-12, so we use Monaco with fallbacks
      setFontFamily(
        "Monaco, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace"
      );
    } else {
      // On other platforms, DrJava uses Monospaced-12, so we use system monospace
      setFontFamily("'Courier New', Consolas, 'Liberation Mono', monospace");
    }
  }, []);

  const handleEditorChange = (value) => {
    setCode(value);
  };

  return (
    <div className="app">
      <div className="editor-container">
        <div className="editor-wrapper">
          <Editor
            height="100%"
            defaultLanguage="java"
            value={code}
            onChange={handleEditorChange}
            theme="vs"
            options={{
              fontSize: 18,
              fontFamily: fontFamily,
              fontWeight: "500",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              lineNumbers: "on",
              renderWhitespace: "selection",
              wordWrap: "off",
              scrollbar: {
                horizontal: "auto",
                vertical: "auto",
              },
            }}
          />
        </div>
      </div>
      <PlaybarComponent />
    </div>
  );
}

export default App;
