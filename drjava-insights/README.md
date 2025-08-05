# DrJava Insights

A CLI tool for visualizing and replaying student coding sessions from DrJava IDE logs.

## Installation

```bash
npm install -g drjava-insights
```

## Usage

```bash
drjava-insights /path/to/logs
```

This will:

1. Start a local web server
2. Parse your DrJava log files
3. Open the insights viewer in your browser
4. Allow step-by-step replay of coding sessions

## Log File Structure

```
logs/
├── session_events.log
└── text_changes/
    ├── file1.java.log
    └── file2.java.log
```

## Commands

- `drjava-insights <log-directory>` - Start the viewer
- `see-insights <log-directory>` - Alternative command
- `drjava-insights --help` - Show help

## Features

- Session replay with playback controls
- Activity timeline visualization
- Multi-file support with auto-switching
- Compile event tracking
- Automatic port detection

---

_Developed for CS111 at Gettysburg College_
