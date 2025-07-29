import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import "./App.css";
import { BsFiletypeJava } from "react-icons/bs";
import { VscChevronDown } from "react-icons/vsc";
import PlaybarComponent from "./components/Playbar";
import useLogs from "./hooks/useLogs";
import useKeystrokePlayback from "./hooks/useKeystrokePlayback";
import useCodeReconstruction from "./hooks/useCodeReconstruction";

/**
 * DrJava Insights: A web-based tool for visualizing and replaying student coding sessions.
 *
 * This application allows instructors to load a log of student activity
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
 * @author Marko Tsymbaliuk
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
    files,
    // loading, // Loading state for the logs, could be used to show a loading screen
    // error, // Error state for the logs, could be used to show an error screen
  } = useLogs();

  // Playback logic extracted to hook
  const {
    isPlaying,
    currentKeystrokeIndex,
    currentKeystroke,
    setCurrentKeystrokeIndex,
    currentTime,
    // setCurrentTime
    handlePlayPause,
    handleRestart,
    handleSkipToEnd,
    handleSkipBackward,
    handleSkipForward,
    handleTimelineChange,
    playbackSpeed,
    setPlaybackSpeed,
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

  // File dropdown state
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);

  // Use the first file from logs as default, or fallback
  const [activeFile, setActiveFile] = useState("");

  // Font size state
  const [fontSize, setFontSize] = useState(18); // Default font size

  // Update active file when files are loaded
  useEffect(() => {
    if (files.length > 0 && !activeFile) {
      setActiveFile(files[0]);
    }
  }, [files, activeFile]);

  // Update active file based on the current keystroke during playback
  useEffect(() => {
    if (currentKeystroke && currentKeystroke.filename) {
      setActiveFile(currentKeystroke.filename);
    }
  }, [currentKeystroke]);

  // Keyboard shortcuts for font size
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      if (event.metaKey || event.ctrlKey) {
        if (event.key === "=" || event.key === "+") {
          event.preventDefault();
          setFontSize((prev) => Math.min(30, prev + 1)); // Max 30px
        } else if (event.key === "-") {
          event.preventDefault();
          setFontSize((prev) => Math.max(10, prev - 1)); // Min 10px
        }
      }
    };

    // Add event listener to document
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup function
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // Empty dependency array since we only want to set this up once

  const code = useCodeReconstruction({
    logs,
    keystrokeLogs,
    currentKeystrokeIndex,
    selectedFile: activeFile,
  });

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

  // Now actually implement file select functionality
  const handleFileSelect = (filename) => {
    setActiveFile(filename);
    setIsFileDropdownOpen(false); // Close dropdown when file is selected
    console.log("Selected file:", filename);
  };

  const toggleFileDropdown = () => {
    setIsFileDropdownOpen(!isFileDropdownOpen);
  };

  return (
    <div className="app">
      <div className="main-content">
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
                  fontSize: fontSize, // Use dynamic font size
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
        files={files}
        activeFile={activeFile}
        onFileSelect={handleFileSelect}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSkipBackward={handleSkipBackward}
        onSkipForward={handleSkipForward}
        onRestart={handleRestart}
        onSkipToEnd={handleSkipToEnd}
        playbackSpeed={playbackSpeed}
        onSetPlaybackSpeed={setPlaybackSpeed}
        fontSize={fontSize}
        onSetFontSize={setFontSize}
      />
    </div>
  );
}

export default App;
