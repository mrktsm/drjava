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
import PlaybarComponent from "./components/Playbar";

// React component for file explorer
function FileExplorer({ files, activeFile, onFileSelect }) {
  return (
    <div className="file-explorer">
      <ul className="file-list">
        {files.map((file, index) => (
          <li
            key={index}
            className={`file-item ${activeFile === file ? "active" : ""}`}
            onClick={() => onFileSelect(file)}
          >
            {file}
          </li>
        ))}
      </ul>
    </div>
  );
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

function App() {
  const [code, setCode] = useState(
    `// DrJava Insights - Code Activity Viewer
// Select a log file to begin...`
  );
  const [segments, setSegments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [sessionStart, setSessionStart] = useState(0);
  const [sessionEnd, setSessionEnd] = useState(24);
  const [sessionDuration, setSessionDuration] = useState(24);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x real-time speed
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [playbackStartTime, setPlaybackStartTime] = useState(null);
  const [playbackPausedAt, setPlaybackPausedAt] = useState(0);

  // Fetch and process log data from the server
  useEffect(() => {
    const processLogsIntoSegments = (sortedLogs) => {
      if (!sortedLogs || sortedLogs.length === 0) {
        return [];
      }

      const newSegments = [];
      let currentSegment = null;
      const SESSION_GAP_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

      sortedLogs.forEach((log, index) => {
        const logTime = new Date(log.timestamp);
        const timeInHours =
          logTime.getHours() +
          logTime.getMinutes() / 60 +
          logTime.getSeconds() / 3600;

        if (!currentSegment) {
          currentSegment = { start: timeInHours, end: timeInHours };
        } else {
          const previousLogTime = new Date(sortedLogs[index - 1].timestamp);
          const timeDiff = logTime - previousLogTime;

          if (timeDiff < SESSION_GAP_THRESHOLD) {
            currentSegment.end = timeInHours;
          } else {
            newSegments.push(currentSegment);
            currentSegment = { start: timeInHours, end: timeInHours };
          }
        }
      });

      if (currentSegment) {
        newSegments.push(currentSegment);
      }

      return newSegments;
    };

    fetch("http://localhost:3001/api/logs")
      .then((res) => res.json())
      .then((data) => {
        console.log("Successfully fetched log data:", data);
        const sortedLogs = data.sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        setLogs(sortedLogs);

        const processedSegments = processLogsIntoSegments(sortedLogs);
        setSegments(processedSegments);

        // Calculate actual session duration from logs
        if (sortedLogs.length > 0) {
          const firstLogTime = new Date(sortedLogs[0].timestamp);
          const lastLogTime = new Date(
            sortedLogs[sortedLogs.length - 1].timestamp
          );

          const startTime =
            firstLogTime.getHours() +
            firstLogTime.getMinutes() / 60 +
            firstLogTime.getSeconds() / 3600;
          const endTime =
            lastLogTime.getHours() +
            lastLogTime.getMinutes() / 60 +
            lastLogTime.getSeconds() / 3600;

          // Use exact timing from first to last log entry
          const duration = endTime - startTime;

          setSessionStart(startTime);
          setSessionEnd(endTime);
          setSessionDuration(duration);
          setCurrentTime(startTime);
          setCurrentLogIndex(0);
        }

        if (processedSegments.length > 0) {
          setCurrentTime(processedSegments[0].start);
        }
      })
      .catch((err) => console.error("Error fetching logs:", err));
  }, []);

  // Smooth timeline movement - independent of keystroke timing
  useEffect(() => {
    let animationFrame;

    if (isPlaying && logs.length > 0) {
      const animate = () => {
        const now = Date.now();
        const elapsed = (now - playbackStartTime) / 1000; // seconds elapsed since play started
        const totalPlaybackDuration = sessionDuration * 3600; // convert hours to seconds
        const progress = Math.min(
          1,
          (playbackPausedAt + elapsed) / totalPlaybackDuration
        );

        const timelinePosition = sessionStart + progress * sessionDuration;
        setCurrentTime(timelinePosition);

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          // Reached the end
          setIsPlaying(false);
          setCurrentTime(sessionEnd);
        }
      };

      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [
    isPlaying,
    playbackStartTime,
    playbackPausedAt,
    sessionStart,
    sessionEnd,
    sessionDuration,
    logs.length,
  ]);

  // Event-driven playback for keystrokes - independent of timeline movement
  useEffect(() => {
    let timeout;

    if (isPlaying && logs.length > 0 && currentLogIndex < logs.length) {
      const nextLogIndex = currentLogIndex + 1;

      if (nextLogIndex < logs.length) {
        // Calculate when this keystroke should occur based on timeline position
        const currentLogProgress = currentLogIndex / (logs.length - 1);
        const nextLogProgress = nextLogIndex / (logs.length - 1);
        const progressDiff = nextLogProgress - currentLogProgress;

        // Timeline duration in seconds
        const totalTimelineSeconds = sessionDuration * 3600;
        const timeToNextKeystroke =
          (progressDiff * totalTimelineSeconds) / playbackSpeed;

        timeout = setTimeout(() => {
          setCurrentLogIndex(nextLogIndex);
        }, timeToNextKeystroke * 1000); // Convert to milliseconds
      }
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isPlaying, currentLogIndex, logs, playbackSpeed, sessionDuration]);

  // Reconstruct code for the editor based on the current log index
  useEffect(() => {
    if (logs.length === 0) return;

    const reconstructCodeAtLogIndex = (targetIndex, allLogs) => {
      let fileContent = "";
      for (let i = 0; i <= targetIndex && i < allLogs.length; i++) {
        const log = allLogs[i];
        if (log.type === "insert") {
          // Insert text at the specified position
          fileContent =
            fileContent.slice(0, log.offset) +
            log.insertedText +
            fileContent.slice(log.offset);
        } else if (log.type === "delete") {
          // Delete text from the specified position
          fileContent =
            fileContent.slice(0, log.offset) +
            fileContent.slice(log.offset + log.length);
        }
      }
      return fileContent;
    };

    const newCode = reconstructCodeAtLogIndex(currentLogIndex, logs);
    setCode(newCode);
  }, [currentLogIndex, logs]);

  // Sample files for the file explorer
  const [files] = useState([
    "HelloWorld.java",
    "StudentRecord.java",
    "Calculator.java",
    "FileManager.java",
    "DatabaseHelper.java",
    "UIController.java",
  ]);

  const [activeFile, setActiveFile] = useState("HelloWorld.java");

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

  const handleFileSelect = (filename) => {
    setActiveFile(filename);
    console.log("Selected file:", filename);
    // Here you would load the content for the selected file
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      // Pausing - record where we paused
      const now = Date.now();
      const elapsed = (now - playbackStartTime) / 1000;
      setPlaybackPausedAt((prev) => prev + elapsed);
      setIsPlaying(false);
    } else {
      // Starting/resuming - record when we started
      setPlaybackStartTime(Date.now());
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentLogIndex(0);
    setCurrentTime(sessionStart);
    setPlaybackPausedAt(0);
    setPlaybackStartTime(null);
  };

  const handleSkipToEnd = () => {
    setIsPlaying(false);
    setCurrentLogIndex(logs.length - 1);
    setCurrentTime(sessionEnd);
    setPlaybackPausedAt(sessionDuration * 3600); // Set to end
    setPlaybackStartTime(null);
  };

  const handleSkipBackward = () => {
    const skipAmount = Math.max(1, Math.floor(logs.length * 0.1)); // Skip back 10% of logs
    const newIndex = Math.max(0, currentLogIndex - skipAmount);
    setCurrentLogIndex(newIndex);

    // Update timeline to match the log position
    const progress = newIndex / (logs.length - 1);
    const newTimelinePosition = sessionStart + progress * sessionDuration;
    setCurrentTime(newTimelinePosition);

    // Update playback position for smooth timeline
    const totalPlaybackDuration = sessionDuration * 3600;
    setPlaybackPausedAt(progress * totalPlaybackDuration);
    setPlaybackStartTime(Date.now());
  };

  const handleSkipForward = () => {
    const skipAmount = Math.max(1, Math.floor(logs.length * 0.1)); // Skip forward 10% of logs
    const newIndex = Math.min(logs.length - 1, currentLogIndex + skipAmount);
    setCurrentLogIndex(newIndex);

    // Update timeline to match the log position
    const progress = newIndex / (logs.length - 1);
    const newTimelinePosition = sessionStart + progress * sessionDuration;
    setCurrentTime(newTimelinePosition);

    // Update playback position for smooth timeline
    const totalPlaybackDuration = sessionDuration * 3600;
    setPlaybackPausedAt(progress * totalPlaybackDuration);
    setPlaybackStartTime(Date.now());
  };

  return (
    <div className="app">
      <div className="main-content">
        {/* <FileExplorer
          files={files}
          activeFile={activeFile}
          onFileSelect={handleFileSelect}
        /> */}
        <div className="editor-and-controls-area">
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
          <MediaControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onSkipBackward={handleSkipBackward}
            onSkipForward={handleSkipForward}
            onRestart={handleRestart}
            onSkipToEnd={handleSkipToEnd}
          />
        </div>
      </div>
      <PlaybarComponent
        segments={segments}
        currentTime={currentTime}
        onTimeChange={setCurrentTime}
        sessionStart={sessionStart}
        sessionEnd={sessionEnd}
        sessionDuration={sessionDuration}
      />
    </div>
  );
}

export default App;
