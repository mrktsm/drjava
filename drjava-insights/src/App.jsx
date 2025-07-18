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
import { BsFiletypeJava } from "react-icons/bs";
import { VscFile, VscChevronDown, VscChevronRight } from "react-icons/vsc";
import PlaybarComponent from "./components/Playbar";

// React component for file explorer
function FileExplorer({ files, activeFile, onFileSelect }) {
  const [isProjectExpanded, setIsProjectExpanded] = useState(true);

  const toggleProjectFolder = () => {
    setIsProjectExpanded(!isProjectExpanded);
  };

  const getFileIcon = (filename) => {
    const extension = filename.split(".").pop().toLowerCase();
    switch (extension) {
      case "java":
        return <BsFiletypeJava className="file-icon java" />;
      default:
        return <VscFile className="file-icon" />;
    }
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">EXPLORER</div>
      <div className="explorer-content">
        <button className="project-folder" onClick={toggleProjectFolder}>
          <div className="chevron-container">
            {isProjectExpanded ? (
              <VscChevronDown size={16} className="chevron-icon" />
            ) : (
              <VscChevronRight size={16} className="chevron-icon" />
            )}
          </div>
          <span className="project-name">DRJAVA PROJECT</span>
        </button>

        {isProjectExpanded && (
          <div className="files-container">
            <div className="tree-line"></div>

            {files.map((file, index) => (
              <div
                key={index}
                className={`file-item-vscode ${
                  activeFile === file ? "active" : ""
                }`}
                onClick={() => onFileSelect(file)}
                title={file}
              >
                {getFileIcon(file)}
                <span className="file-name">{file}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// React component for info panel (right side)
function InfoPanel({ keystrokeLogs, currentKeystrokeIndex, isPlaying }) {
  const currentKeystroke = keystrokeLogs[currentKeystrokeIndex];
  const totalKeystrokes = keystrokeLogs.length;
  const progress =
    totalKeystrokes > 0
      ? (((currentKeystrokeIndex + 1) / totalKeystrokes) * 100).toFixed(1)
      : 0;

  return (
    <div className="info-panel">
      <h3>SESSION INFO</h3>
      <div className="info-content">
        <div className="info-item">
          <label>Status:</label>
          <span className={`status ${isPlaying ? "playing" : "paused"}`}>
            {isPlaying ? "Playing" : "Paused"}
          </span>
        </div>
        <div className="info-item">
          <label>Progress:</label>
          <span>
            {currentKeystrokeIndex + 1} / {totalKeystrokes} ({progress}%)
          </span>
        </div>
        <div className="info-item">
          <label>Total Keystrokes:</label>
          <span>{totalKeystrokes}</span>
        </div>
        {currentKeystroke && (
          <>
            <div className="info-item">
              <label>Current Action:</label>
              <span className={`action-type ${currentKeystroke.type}`}>
                {currentKeystroke.type === "insert" ? "Insert" : "Delete"}
              </span>
            </div>
            <div className="info-item">
              <label>Character:</label>
              <span className="character">
                "{currentKeystroke.insertedText || "⌫"}"
              </span>
            </div>
            <div className="info-item">
              <label>Position:</label>
              <span>{currentKeystroke.offset}</span>
            </div>
            <div className="info-item">
              <label>Timestamp:</label>
              <span className="timestamp">
                {new Date(currentKeystroke.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </>
        )}
      </div>
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
  const [activitySegments, setActivitySegments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [keystrokeLogs, setKeystrokeLogs] = useState([]); // Only insert/delete logs

  // Real-time keystroke playback system
  const [currentKeystrokeIndex, setCurrentKeystrokeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sessionStartTime, setSessionStartTime] = useState(null); // First keystroke timestamp
  const [sessionEndTime, setSessionEndTime] = useState(null); // Last event timestamp

  // Timeline display values
  const [currentTime, setCurrentTime] = useState(0);
  const [sessionStart, setSessionStart] = useState(0);
  const [sessionEnd, setSessionEnd] = useState(24);
  const [sessionDuration, setSessionDuration] = useState(24);

  // Playback state for timeline synchronization
  const [playbackStartTime, setPlaybackStartTime] = useState(null); // When playback started
  const [playbackStartKeystroke, setPlaybackStartKeystroke] = useState(0); // Which keystroke we started from
  const [isUserScrubbing, setIsUserScrubbing] = useState(false);

  // File dropdown state
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);

  const timeoutRef = useRef(null); // For keystroke scheduling

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
        // Only process text insertion/deletion events for the blue timeline
        if (log.type !== "insert" && log.type !== "delete") return;

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

    const processActivityLogs = (
      sortedLogs,
      sessionStartTime,
      sessionEndTime
    ) => {
      if (
        !sortedLogs ||
        sortedLogs.length === 0 ||
        !sessionStartTime ||
        !sessionEndTime
      ) {
        return [];
      }

      const activityLogs = sortedLogs.filter(
        (log) => log.type === "app_activated" || log.type === "app_deactivated"
      );

      const sessionStartHours =
        sessionStartTime.getHours() +
        sessionStartTime.getMinutes() / 60 +
        sessionStartTime.getSeconds() / 3600;

      const sessionEndHours =
        sessionEndTime.getHours() +
        sessionEndTime.getMinutes() / 60 +
        sessionEndTime.getSeconds() / 3600;

      const activitySegments = [];
      let currentActiveStart = null;

      // Filter and sort activity logs by their timestamps
      const sortedActivityLogs = activityLogs.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      // Check if app was already active when session started
      // Look for the last activity event before session start
      let wasActiveAtStart = false;
      for (let i = sortedActivityLogs.length - 1; i >= 0; i--) {
        const log = sortedActivityLogs[i];
        const logTime = new Date(log.timestamp);
        if (logTime < sessionStartTime) {
          wasActiveAtStart = log.type === "app_activated";
          break;
        }
      }

      // If app was active at session start, begin with an active segment
      if (wasActiveAtStart) {
        currentActiveStart = sessionStartHours;
      }

      sortedActivityLogs.forEach((log) => {
        const logTime = new Date(log.timestamp);
        const timeInHours =
          logTime.getHours() +
          logTime.getMinutes() / 60 +
          logTime.getSeconds() / 3600;

        // Only process events within or overlapping the session boundaries
        if (timeInHours < sessionStartHours || timeInHours > sessionEndHours) {
          return;
        }

        if (log.type === "app_deactivated") {
          // App became inactive - end the current active segment
          if (currentActiveStart !== null) {
            activitySegments.push({
              start: Math.max(currentActiveStart, sessionStartHours),
              end: Math.min(timeInHours, sessionEndHours),
            });
            currentActiveStart = null;
          }
        } else if (log.type === "app_activated") {
          // App became active - start a new active segment
          currentActiveStart = Math.max(timeInHours, sessionStartHours);
        }
      });

      // If we end with an active session, close it at the session end
      if (currentActiveStart !== null) {
        activitySegments.push({
          start: currentActiveStart,
          end: sessionEndHours,
        });
      }

      console.log("Activity processing:", {
        wasActiveAtStart,
        currentActiveStart,
        sessionStartHours,
        sessionEndHours,
        activitySegments,
      });

      return activitySegments;
    };

    fetch("http://localhost:3001/api/logs")
      .then((res) => res.json())
      .then((data) => {
        console.log("Successfully fetched log data:", data);
        const sortedLogs = data.sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        setLogs(sortedLogs);

        // Extract keystroke logs for real-time playback
        const keystrokeLogs = sortedLogs.filter(
          (log) => log.type === "insert" || log.type === "delete"
        );
        setKeystrokeLogs(keystrokeLogs);

        const processedSegments = processLogsIntoSegments(sortedLogs);
        setSegments(processedSegments);

        // Calculate session boundaries
        if (keystrokeLogs.length > 0) {
          const firstKeystrokeTime = new Date(keystrokeLogs[0].timestamp);
          const lastKeystrokeTime = new Date(
            keystrokeLogs[keystrokeLogs.length - 1].timestamp
          );

          // Session ends at the last keystroke, not extended to activity events
          setSessionStartTime(firstKeystrokeTime);
          setSessionEndTime(lastKeystrokeTime);

          // Convert to hours for timeline display
          const startTimeHours =
            firstKeystrokeTime.getHours() +
            firstKeystrokeTime.getMinutes() / 60 +
            firstKeystrokeTime.getSeconds() / 3600;
          const endTimeHours =
            lastKeystrokeTime.getHours() +
            lastKeystrokeTime.getMinutes() / 60 +
            lastKeystrokeTime.getSeconds() / 3600;

          setSessionStart(startTimeHours);
          setSessionEnd(endTimeHours);
          setSessionDuration(endTimeHours - startTimeHours);
          setCurrentTime(startTimeHours);

          // Process activity segments with keystroke-only session boundaries
          const processedActivitySegments = processActivityLogs(
            sortedLogs,
            firstKeystrokeTime,
            lastKeystrokeTime
          );
          setActivitySegments(processedActivitySegments);

          // Reset playback state
          setCurrentKeystrokeIndex(0);
          setPlaybackStartKeystroke(0);
        }
      })
      .catch((err) => console.error("Error fetching logs:", err));
  }, []);

  // Convert keystroke index to timeline position
  const keystrokeIndexToTimelinePosition = (keystrokeIndex) => {
    if (keystrokeLogs.length === 0) return sessionStart;

    const progress = keystrokeIndex / (keystrokeLogs.length - 1);
    return sessionStart + progress * sessionDuration;
  };

  // Convert timeline position to keystroke index
  const timelinePositionToKeystrokeIndex = (timelinePos) => {
    if (sessionDuration === 0) return 0;
    const progress = Math.max(
      0,
      Math.min(1, (timelinePos - sessionStart) / sessionDuration)
    );
    return Math.min(
      keystrokeLogs.length - 1,
      Math.round(progress * (keystrokeLogs.length - 1))
    );
  };

  // Schedule the next keystroke with authentic timing
  const scheduleNextKeystroke = () => {
    if (!isPlaying || currentKeystrokeIndex >= keystrokeLogs.length - 1) {
      return;
    }

    const currentKeystroke = keystrokeLogs[currentKeystrokeIndex];
    const nextKeystroke = keystrokeLogs[currentKeystrokeIndex + 1];

    // Calculate actual delay between keystrokes
    const currentTime = new Date(currentKeystroke.timestamp);
    const nextTime = new Date(nextKeystroke.timestamp);
    const actualDelay = nextTime - currentTime;
    const scaledDelay = actualDelay / playbackSpeed;

    console.log(
      `Scheduling next keystroke in ${scaledDelay}ms (actual: ${actualDelay}ms)`
    );

    timeoutRef.current = setTimeout(() => {
      if (isPlaying && !isUserScrubbing) {
        setCurrentKeystrokeIndex((prev) => prev + 1);
      }
    }, scaledDelay);
  };

  // Real-time keystroke playback effect
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isPlaying && keystrokeLogs.length > 0 && !isUserScrubbing) {
      if (currentKeystrokeIndex < keystrokeLogs.length - 1) {
        scheduleNextKeystroke();
      } else {
        // Reached the end
        setIsPlaying(false);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [
    isPlaying,
    currentKeystrokeIndex,
    keystrokeLogs,
    playbackSpeed,
    isUserScrubbing,
  ]);

  // Timeline synchronization effect - update timeline position based on keystroke progress
  useEffect(() => {
    let animationFrame;

    if (
      isPlaying &&
      keystrokeLogs.length > 0 &&
      playbackStartTime &&
      !isUserScrubbing
    ) {
      const updateTimeline = () => {
        const now = Date.now();
        const elapsedSincePlay = now - playbackStartTime;

        // Calculate how much progress we've made through the keystrokes based on real time
        const currentKeystroke = keystrokeLogs[playbackStartKeystroke];
        const sessionElapsedMs = elapsedSincePlay * playbackSpeed;
        const currentKeystrokeTime = new Date(currentKeystroke.timestamp);
        const expectedCurrentTime = new Date(
          currentKeystrokeTime.getTime() + sessionElapsedMs
        );

        // Convert to timeline position
        const totalSessionMs = sessionEndTime - sessionStartTime;
        const progressThroughSession = Math.min(
          1,
          (expectedCurrentTime - sessionStartTime) / totalSessionMs
        );
        const timelinePosition =
          sessionStart + progressThroughSession * sessionDuration;

        setCurrentTime(timelinePosition);

        if (isPlaying) {
          animationFrame = requestAnimationFrame(updateTimeline);
        }
      };

      animationFrame = requestAnimationFrame(updateTimeline);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [
    isPlaying,
    playbackStartTime,
    playbackStartKeystroke,
    keystrokeLogs,
    sessionStartTime,
    sessionEndTime,
    sessionStart,
    sessionDuration,
    playbackSpeed,
    isUserScrubbing,
  ]);

  // Reconstruct code based on current keystroke index
  useEffect(() => {
    if (keystrokeLogs.length === 0) return;

    // Find the corresponding index in the full logs array
    const targetKeystroke = keystrokeLogs[currentKeystrokeIndex];
    const fullLogIndex = logs.findIndex(
      (log) =>
        log.timestamp === targetKeystroke.timestamp &&
        log.type === targetKeystroke.type &&
        log.offset === targetKeystroke.offset
    );

    const reconstructCodeAtLogIndex = (targetIndex, allLogs) => {
      let fileContent = "";
      for (let i = 0; i <= targetIndex && i < allLogs.length; i++) {
        const log = allLogs[i];
        if (log.type === "insert") {
          fileContent =
            fileContent.slice(0, log.offset) +
            log.insertedText +
            fileContent.slice(log.offset);
        } else if (log.type === "delete") {
          fileContent =
            fileContent.slice(0, log.offset) +
            fileContent.slice(log.offset + log.length);
        }
      }
      return fileContent;
    };

    const newCode = reconstructCodeAtLogIndex(fullLogIndex, logs);
    setCode(newCode);
  }, [currentKeystrokeIndex, keystrokeLogs, logs]);

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
    setIsFileDropdownOpen(false); // Close dropdown when file is selected
    console.log("Selected file:", filename);
    // Here you would load the content for the selected file
  };

  const toggleFileDropdown = () => {
    setIsFileDropdownOpen(!isFileDropdownOpen);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      // Pausing
      setIsPlaying(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // Check if we're at the end - if so, restart from beginning
      if (currentKeystrokeIndex >= keystrokeLogs.length - 1) {
        setCurrentKeystrokeIndex(0);
        setCurrentTime(sessionStart);
      }

      // Starting/resuming
      setPlaybackStartTime(Date.now());
      setPlaybackStartKeystroke(currentKeystrokeIndex);
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentKeystrokeIndex(0);
    setCurrentTime(sessionStart);
    setPlaybackStartKeystroke(0);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleSkipToEnd = () => {
    setIsPlaying(false);
    setCurrentKeystrokeIndex(keystrokeLogs.length - 1);
    setCurrentTime(sessionEnd);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleSkipBackward = () => {
    const skipAmount = Math.max(1, Math.floor(keystrokeLogs.length * 0.1)); // Skip back 10%
    const newIndex = Math.max(0, currentKeystrokeIndex - skipAmount);

    setCurrentKeystrokeIndex(newIndex);
    setCurrentTime(keystrokeIndexToTimelinePosition(newIndex));
    setPlaybackStartKeystroke(newIndex);
    setPlaybackStartTime(Date.now());

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleSkipForward = () => {
    const skipAmount = Math.max(1, Math.floor(keystrokeLogs.length * 0.1)); // Skip forward 10%
    const newIndex = Math.min(
      keystrokeLogs.length - 1,
      currentKeystrokeIndex + skipAmount
    );

    setCurrentKeystrokeIndex(newIndex);
    setCurrentTime(keystrokeIndexToTimelinePosition(newIndex));
    setPlaybackStartKeystroke(newIndex);
    setPlaybackStartTime(Date.now());

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Handle timeline scrubbing
  const handleTimelineChange = (newTime) => {
    // Pause playback during scrubbing
    if (isPlaying) {
      setIsPlaying(false);
      setIsUserScrubbing(true);
    }

    // Convert timeline position to keystroke index
    const newKeystrokeIndex = timelinePositionToKeystrokeIndex(newTime);
    setCurrentKeystrokeIndex(newKeystrokeIndex);
    setCurrentTime(newTime);
    setPlaybackStartKeystroke(newKeystrokeIndex);
    setPlaybackStartTime(Date.now());

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Reset scrubbing state when user stops interacting
  useEffect(() => {
    if (isUserScrubbing) {
      const timer = setTimeout(() => {
        setIsUserScrubbing(false);
      }, 500); // Reset after 500ms of no scrubbing

      return () => clearTimeout(timer);
    }
  }, [isUserScrubbing, currentTime]);

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
            <div className="editor-header" onClick={toggleFileDropdown}>
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
        {/* <InfoPanel
          keystrokeLogs={keystrokeLogs}
          currentKeystrokeIndex={currentKeystrokeIndex}
          isPlaying={isPlaying}
        /> */}
      </div>
      <PlaybarComponent
        segments={segments}
        activitySegments={activitySegments}
        currentTime={currentTime}
        onTimeChange={handleTimelineChange}
        sessionStart={sessionStart}
        sessionEnd={sessionEnd}
        sessionDuration={sessionDuration}
      />
    </div>
  );
}

export default App;
