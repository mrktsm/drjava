import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import "./App.css";
import { BsFiletypeJava } from "react-icons/bs";
import { VscChevronDown } from "react-icons/vsc";
import PlaybarComponent from "./components/Playbar";
import MediaControls from "./components/MediaControls";
import useLogs from "./hooks/useLogs";
import useKeystrokePlayback from "./hooks/useKeystrokePlayback";

function App() {
  const {
    logs,
    keystrokeLogs,
    segments,
    activitySegments,
    sessionStartTime,
    sessionEndTime,
    loading,
    error,
  } = useLogs();

  // Playback logic extracted to hook
  const {
    isPlaying,
    currentKeystrokeIndex,
    setCurrentKeystrokeIndex,
    currentTime,
    setCurrentTime,
    handlePlayPause,
    handleRestart,
    handleSkipToEnd,
    handleSkipBackward,
    handleSkipForward,
    handleTimelineChange,
    playbackSpeed,
    setPlaybackSpeed,
    isUserScrubbing,
    setIsUserScrubbing,
  } = useKeystrokePlayback({
    keystrokeLogs,
    sessionStart: sessionStartTime
      ? sessionStartTime.getHours() +
        sessionStartTime.getMinutes() / 60 +
        sessionStartTime.getSeconds() / 3600
      : 0,
    sessionEnd: sessionEndTime
      ? sessionEndTime.getHours() +
        sessionEndTime.getMinutes() / 60 +
        sessionEndTime.getSeconds() / 3600
      : 24,
    sessionDuration:
      sessionStartTime && sessionEndTime
        ? sessionEndTime.getHours() +
          sessionEndTime.getMinutes() / 60 +
          sessionEndTime.getSeconds() / 3600 -
          (sessionStartTime.getHours() +
            sessionStartTime.getMinutes() / 60 +
            sessionStartTime.getSeconds() / 3600)
        : 24,
  });

  const [code, setCode] = useState(
    `// DrJava Insights - Code Activity Viewer\n// Select a log file to begin...`
  );

  // File dropdown state
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);

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

  // Set session timeline values when logs are loaded
  useEffect(() => {
    if (keystrokeLogs.length > 0 && sessionStartTime && sessionEndTime) {
      setCurrentKeystrokeIndex(0);
    }
  }, [
    keystrokeLogs,
    sessionStartTime,
    sessionEndTime,
    setCurrentKeystrokeIndex,
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
        sessionStart={
          sessionStartTime
            ? sessionStartTime.getHours() +
              sessionStartTime.getMinutes() / 60 +
              sessionStartTime.getSeconds() / 3600
            : 0
        }
        sessionEnd={
          sessionEndTime
            ? sessionEndTime.getHours() +
              sessionEndTime.getMinutes() / 60 +
              sessionEndTime.getSeconds() / 3600
            : 24
        }
        sessionDuration={
          sessionStartTime && sessionEndTime
            ? sessionEndTime.getHours() +
              sessionEndTime.getMinutes() / 60 +
              sessionEndTime.getSeconds() / 3600 -
              (sessionStartTime.getHours() +
                sessionStartTime.getMinutes() / 60 +
                sessionStartTime.getSeconds() / 3600)
            : 24
        }
      />
    </div>
  );
}

export default App;
