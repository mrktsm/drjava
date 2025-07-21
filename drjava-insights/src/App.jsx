import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import "./App.css";
import { BsFiletypeJava } from "react-icons/bs";
import { VscChevronDown } from "react-icons/vsc";
import PlaybarComponent from "./components/Playbar";
import MediaControls from "./components/MediaControls";
import useLogs from "./hooks/useLogs";
import useKeystrokePlayback from "./hooks/useKeystrokePlayback";
import useCodeReconstruction from "./hooks/useCodeReconstruction";

/**
 * DrJava Insights: A web-based tool for visualizing and replaying student coding sessions.
 *
 * This application allows instructors or researchers to load a log of student activity
 * and watch a step-by-step reconstruction of their coding process. It features a
 * code editor that shows the code evolving over time, a timeline with activity segments,
 * and playback controls to navigate the session.
 *
 * This project was developed for CS111 at Gettysburg College under the supervision
 * of Professor Ivaylo Ilinkin.
 *
 * The `App` component serves as the main container that initializes all necessary hooks,
 * manages the overall application state, and renders the primary UI layout.
 *
 * @author markotsymbaluk
 * @returns {JSX.Element} The rendered App component.
 */
function App() {
  const {
    logs,
    keystrokeLogs,
    segments,
    activitySegments,
    sessionStartTime,
    sessionEndTime,
    // loading, // Loading state for the logs, could be used to show a loading screen
    // error, // Error state for the logs, could be used to show an error screen
  } = useLogs();

  // Playback logic extracted to hook
  const {
    isPlaying,
    currentKeystrokeIndex,
    setCurrentKeystrokeIndex,
    currentTime,
    // setCurrentTime
    handlePlayPause,
    handleRestart,
    handleSkipToEnd,
    handleSkipBackward,
    handleSkipForward,
    handleTimelineChange,
    // playbackSpeed, // Playback speed, could be used to show a playback speed selector
    // setPlaybackSpeed,
    // isUserScrubbing,
    // setIsUserScrubbing,
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

  const code = useCodeReconstruction({
    logs,
    keystrokeLogs,
    currentKeystrokeIndex,
  });

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

  const handleEditorChange = (value) => {
    // setCode(value); // This line is no longer needed as code is managed by useCodeReconstruction
  };

  // TODO: Implement file select
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
                  fontFamily:
                    "Monaco, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
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
