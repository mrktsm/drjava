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
  const [code, setCode] = useState(`// DrJava Insights - Code Activity Viewer
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Welcome to DrJava Insights!");
        
        // This editor will show your actual Java files
        // based on DrJava activity logs
    }
}`);

  const [logData, setLogData] = useState(null);

  // Fetch log data from the server
  useEffect(() => {
    fetch("http://localhost:3001/api/logs")
      .then((res) => res.json())
      .then((data) => {
        console.log("Successfully fetched log data:", data);
        setLogData(data);
      })
      .catch((err) => console.error("Error fetching logs:", err));
  }, []);

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
            isPlaying={false}
            onPlayPause={() => console.log("Play/Pause")}
            onSkipBackward={() => console.log("Skip backward")}
            onSkipForward={() => console.log("Skip forward")}
            onRestart={() => console.log("Restart")}
            onSkipToEnd={() => console.log("Skip to end")}
          />
        </div>
      </div>
      <PlaybarComponent />
    </div>
  );
}

export default App;
