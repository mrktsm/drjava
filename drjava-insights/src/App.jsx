import { useState, useEffect, useMemo } from "react";
import Editor from "@monaco-editor/react";
import "./App.css";
import { BsFiletypeJava } from "react-icons/bs";
import { VscChevronDown } from "react-icons/vsc";
import PlaybarComponent from "./components/Playbar";
import useLogs from "./hooks/useLogs";
import useKeystrokePlayback from "./hooks/useKeystrokePlayback";
import useCodeReconstruction from "./hooks/useCodeReconstruction";
import useTypingActivity from "./hooks/useTypingActivity";
import {
  calculateFileSegments,
  createFileColorMap,
} from "./utils/fileSegmentUtils";
import {
  createCompressedTimeline,
  createPerFileCompressedTimeline,
  DEFAULT_GAP_THRESHOLD_MS,
  DEFAULT_BUFFER_MS,
} from "./utils/timelineCompression";
import { calculateCompressedFileSegments } from "./utils/compressedKeystrokePlaybackUtils";

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
    compileEvents,
    runEvents,
    // loading, // Loading state for the logs, could be used to show a loading screen
    // error, // Error state for the logs, could be used to show an error screen
  } = useLogs();

  // Timeline compression state
  const [compressionEnabled, setCompressionEnabled] = useState(true); // Enable by default
  const [gapThreshold, setGapThreshold] = useState(DEFAULT_GAP_THRESHOLD_MS);

  // File dropdown state
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);

  // Use the first file from logs as default, or fallback
  const [activeFile, setActiveFile] = useState("");

  // Font size state
  const [fontSize, setFontSize] = useState(18); // Default font size

  // Auto-switch files state
  const [autoSwitchFiles, setAutoSwitchFiles] = useState(true);

  // Create compressed timeline data
  const compressionData = useMemo(() => {
    if (!compressionEnabled || !keystrokeLogs || keystrokeLogs.length === 0) {
      return null;
    }

    // When auto-switch is OFF, use per-file compression for the active file
    if (!autoSwitchFiles && activeFile) {
      return createPerFileCompressedTimeline(
        keystrokeLogs,
        activeFile,
        gapThreshold,
        DEFAULT_BUFFER_MS,
        compileEvents,
        runEvents
      );
    }

    // When auto-switch is ON, use global compression
    return createCompressedTimeline(
      keystrokeLogs,
      gapThreshold,
      DEFAULT_BUFFER_MS
    );
  }, [
    keystrokeLogs,
    compressionEnabled,
    gapThreshold,
    autoSwitchFiles,
    activeFile,
    compileEvents,
    runEvents,
  ]);

  // Calculate session start/end/duration for timeline
  const sessionStart = sessionStartTime
    ? sessionStartTime.getHours() +
      sessionStartTime.getMinutes() / 60 +
      sessionStartTime.getSeconds() / 3600
    : 0;
  const sessionEnd = sessionEndTime
    ? sessionEndTime.getHours() +
      sessionEndTime.getMinutes() / 60 +
      sessionEndTime.getSeconds() / 3600
    : 24;
  const originalSessionDuration =
    sessionStartTime && sessionEndTime ? sessionEnd - sessionStart : 24;

  // Use compressed session duration when compression is enabled
  const sessionDuration = useMemo(() => {
    if (compressionEnabled && compressionData) {
      return compressionData.totalCompressedDuration / (1000 * 60 * 60); // Convert to hours
    }
    return originalSessionDuration;
  }, [compressionEnabled, compressionData, originalSessionDuration]);

  // Calculate file segments from keystroke logs
  const fileSegments = useMemo(() => {
    // When auto-switch is OFF, calculate segments for the active file only
    if (!autoSwitchFiles && activeFile) {
      if (compressionEnabled && compressionData) {
        // Use per-file compressed segments
        return calculateCompressedFileSegments(
          compressionData,
          sessionStart,
          sessionDuration
        );
      } else {
        // Calculate segments from filtered keystrokes (no compression)
        const filteredKeystrokes = keystrokeLogs.filter(
          (keystroke) =>
            (keystroke.filename || "untitled_document") === activeFile
        );
        return calculateFileSegments(
          filteredKeystrokes,
          sessionStart,
          originalSessionDuration
        );
      }
    }

    // When auto-switch is ON, use global file segments
    if (compressionEnabled && compressionData) {
      return calculateCompressedFileSegments(
        compressionData,
        sessionStart,
        sessionDuration
      );
    }
    return calculateFileSegments(
      keystrokeLogs,
      sessionStart,
      originalSessionDuration
    );
  }, [
    keystrokeLogs,
    sessionStart,
    originalSessionDuration,
    compressionEnabled,
    compressionData,
    sessionDuration,
    autoSwitchFiles,
    activeFile,
  ]);

  // Create color mapping for files
  const fileColorMap = useMemo(() => {
    return createFileColorMap(files);
  }, [files]);

  // Use compressed keystroke logs when compression is enabled
  const effectiveKeystrokeLogs = useMemo(() => {
    // When auto-switch is OFF, filter to only show the active file
    if (!autoSwitchFiles && activeFile) {
      if (compressionEnabled && compressionData) {
        // Use per-file compressed logs
        return compressionData.compressedKeystrokeLogs;
      } else {
        // Filter to only show keystrokes for the active file (no compression)
        return keystrokeLogs.filter(
          (keystroke) =>
            (keystroke.filename || "untitled_document") === activeFile
        );
      }
    }

    // When auto-switch is ON, use global compression or all keystrokes
    if (compressionEnabled && compressionData) {
      return compressionData.compressedKeystrokeLogs;
    }
    return keystrokeLogs;
  }, [
    keystrokeLogs,
    compressionEnabled,
    compressionData,
    autoSwitchFiles,
    activeFile,
  ]);

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
    keystrokeLogs: effectiveKeystrokeLogs,
    sessionStart,
    sessionEnd: sessionStart + sessionDuration,
    sessionDuration,
    compressionData: compressionEnabled ? compressionData : null,
    originalKeystrokeLogs: keystrokeLogs, // Pass original logs for mapping
  });

  // Calculate session start for typing activity based on compression mode
  const typingActivitySessionStart = useMemo(() => {
    if (
      !autoSwitchFiles &&
      compressionEnabled &&
      compressionData &&
      compressionData.compressedKeystrokeLogs.length > 0
    ) {
      // For per-file compression, use the start time of the first compressed keystroke
      const firstCompressedKeystroke =
        compressionData.compressedKeystrokeLogs[0];
      const firstTime = new Date(firstCompressedKeystroke.timestamp);
      return (
        firstTime.getHours() +
        firstTime.getMinutes() / 60 +
        firstTime.getSeconds() / 3600
      );
    }
    return sessionStart;
  }, [autoSwitchFiles, compressionEnabled, compressionData, sessionStart]);

  // Add typing activity detection
  const { typingActivitySegments } = useTypingActivity({
    keystrokeLogs: effectiveKeystrokeLogs,
    currentKeystrokeIndex,
    isPlaying,
    sessionStart: typingActivitySessionStart,
    sessionDuration: sessionDuration,
  });

  // Update active file when files are loaded
  useEffect(() => {
    if (files.length > 0 && !activeFile) {
      setActiveFile(files[0]);
    }
  }, [files, activeFile]);

  // Update active file based on the current timeline position and file segments (only if auto-switch is enabled)
  useEffect(() => {
    if (autoSwitchFiles && fileSegments.length > 0) {
      // Find which file segment the current time falls into
      const currentSegment = fileSegments.find(
        (segment) => currentTime >= segment.start && currentTime <= segment.end
      );

      if (currentSegment && currentSegment.filename) {
        setActiveFile(currentSegment.filename);
      }
    }
  }, [currentTime, autoSwitchFiles, fileSegments]);

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
        fileSegments={fileSegments}
        fileColorMap={fileColorMap}
        currentTime={currentTime}
        currentKeystrokeIndex={currentKeystrokeIndex}
        onTimeChange={handleTimelineChange}
        sessionStart={sessionStart}
        sessionEnd={sessionEnd}
        sessionDuration={sessionDuration}
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
        autoSwitchFiles={autoSwitchFiles}
        onToggleAutoSwitchFiles={(checked) => setAutoSwitchFiles(checked)}
        compileEvents={compileEvents}
        runEvents={runEvents}
        // Add typing activity props
        typingActivitySegments={typingActivitySegments}
        keystrokeLogs={effectiveKeystrokeLogs} // Use effective keystroke logs for proper alignment
        // Compression props
        compressionEnabled={compressionEnabled}
        onToggleCompression={setCompressionEnabled}
        compressionData={compressionData}
        gapThreshold={gapThreshold}
        onSetGapThreshold={setGapThreshold}
        bufferMs={DEFAULT_BUFFER_MS}
        onSetBufferMs={() => {}}
      />
    </div>
  );
}

export default App;
