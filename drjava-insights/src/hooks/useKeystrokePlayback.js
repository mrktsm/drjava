import { useState, useRef, useEffect } from "react";
import {
  keystrokeIndexToTimelinePosition,
  timelinePositionToKeystrokeIndex,
} from "../utils/keystrokePlaybackUtils";
import {
  keystrokeIndexToCompressedTimelinePosition,
  compressedTimelinePositionToKeystrokeIndex,
} from "../utils/compressedKeystrokePlaybackUtils";

/**
 * A custom hook to manage the state and logic of keystroke playback.
 *
 * This hook is the core engine for the session replay functionality. It handles:
 * - Play/pause state management.
 * - Scheduling keystrokes with authentic timing based on log timestamps.
 * - Synchronizing the visual timeline with the current playback position.
 * - Providing handler functions for all media controls (play, pause, skip, restart).
 * - Managing user interactions like scrubbing through the timeline.
 *
 * @param {object} props - The properties for configuring the playback.
 * @param {Array<object>} [props.keystrokeLogs=[]] - An array of keystroke log objects to be played back.
 * @param {number} [props.sessionStart=0] - The starting value of the timeline (e.g., in hours).
 * @param {number} [props.sessionEnd=24] - The ending value of the timeline (e.g., in hours).
 * @param {number} [props.sessionDuration=24] - The total duration represented by the timeline.
 *
 * @returns {object} An object containing the playback state and control handlers.
 * @property {boolean} isPlaying - True if the playback is currently active.
 * @property {number} currentKeystrokeIndex - The index of the current keystroke in the `keystrokeLogs` array.
 * @property {object|null} currentKeystroke - The full log object for the current keystroke.
 * @property {function} setCurrentKeystrokeIndex - Function to manually set the keystroke index.
 * @property {number} currentTime - The current position on the timeline, synchronized with playback.
 * @property {function} setCurrentTime - Function to manually set the timeline position.
 * @property {function} handlePlayPause - Toggles the playback state between playing and paused.
 * @property {function} handleRestart - Resets the playback to the beginning.
 * @property {function} handleSkipToEnd - Jumps the playback to the very end of the session.
 * @property {function} handleSkipBackward - Skips playback backward by a percentage of the total keystrokes.
 * @property {function} handleSkipForward - Skips playback forward by a percentage of the total keystrokes.
 * @property {function} handleTimelineChange - Handles user scrubbing/clicking on the timeline to jump to a specific time.
 * @property {number} playbackSpeed - The current speed multiplier for the playback (e.g., 1 for normal, 2 for double speed).
 * @property {function} setPlaybackSpeed - Function to update the playback speed.
 * @property {boolean} isUserScrubbing - True if the user is currently interacting with the timeline.
 */
export default function useKeystrokePlayback({
  keystrokeLogs = [],
  sessionStart = 0,
  sessionEnd = 24,
  sessionDuration = 24,
  compressionData = null, // New prop for compression data
  originalKeystrokeLogs = [], // New prop for original logs when using compression
}) {
  const [currentKeystrokeIndex, setCurrentKeystrokeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(sessionStart);
  const [playbackStartTime, setPlaybackStartTime] = useState(null);
  const [playbackStartKeystroke, setPlaybackStartKeystroke] = useState(0);
  const [playbackStartTimelinePosition, setPlaybackStartTimelinePosition] =
    useState(sessionStart); // NEW: Track starting timeline position
  const [isUserScrubbing, setIsUserScrubbing] = useState(false);
  const timeoutRef = useRef(null);

  // Derive the current keystroke object from the index
  const currentKeystroke =
    keystrokeLogs && keystrokeLogs.length > 0
      ? keystrokeLogs[currentKeystrokeIndex]
      : null;

  // Helper functions that use appropriate utilities based on compression state
  const keystrokeToTimelinePos = (keystrokeIndex) => {
    if (compressionData && originalKeystrokeLogs.length > 0) {
      return keystrokeIndexToCompressedTimelinePosition(
        keystrokeIndex,
        originalKeystrokeLogs,
        compressionData,
        sessionStart,
        sessionDuration
      );
    }
    return keystrokeIndexToTimelinePosition(
      keystrokeIndex,
      keystrokeLogs,
      sessionStart,
      sessionDuration
    );
  };

  const timelinePosToKeystroke = (timelinePos) => {
    if (compressionData && originalKeystrokeLogs.length > 0) {
      return compressedTimelinePositionToKeystrokeIndex(
        timelinePos,
        originalKeystrokeLogs,
        compressionData,
        sessionStart,
        sessionDuration
      );
    }
    return timelinePositionToKeystrokeIndex(
      timelinePos,
      keystrokeLogs,
      sessionStart,
      sessionDuration
    );
  };

  // Schedule the next keystroke with authentic timing
  const scheduleNextKeystroke = () => {
    if (!isPlaying || currentKeystrokeIndex >= keystrokeLogs.length - 1) {
      return;
    }
    const currentKeystroke = keystrokeLogs[currentKeystrokeIndex];
    const nextKeystroke = keystrokeLogs[currentKeystrokeIndex + 1];
    const currentTimeObj = new Date(currentKeystroke.timestamp);
    const nextTimeObj = new Date(nextKeystroke.timestamp);
    const actualDelay = nextTimeObj - currentTimeObj;
    const scaledDelay = actualDelay / playbackSpeed;
    timeoutRef.current = setTimeout(() => {
      if (isPlaying && !isUserScrubbing) {
        setCurrentKeystrokeIndex((prev) => prev + 1);
      }
    }, scaledDelay);
  };

  // Real-time keystroke playback effect - DISABLED in favor of smooth timeline progression
  // The timeline effect now handles both time progression and keystroke index updates
  /*
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (isPlaying && keystrokeLogs.length > 0 && !isUserScrubbing) {
      if (currentKeystrokeIndex < keystrokeLogs.length - 1) {
        scheduleNextKeystroke();
      } else {
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
  */

  // Clean up timeout when playback stops
  useEffect(() => {
    if (!isPlaying && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [isPlaying]);

  // Keystroke synchronization effect - sync keystroke index to current time
  useEffect(() => {
    if (!isUserScrubbing && keystrokeLogs.length > 0) {
      const syncedKeystrokeIndex = timelinePosToKeystroke(currentTime);
      if (syncedKeystrokeIndex !== currentKeystrokeIndex) {
        setCurrentKeystrokeIndex(syncedKeystrokeIndex);
      }
    }
  }, [
    currentTime,
    keystrokeLogs,
    sessionStart,
    sessionDuration,
    isUserScrubbing,
    compressionData,
    originalKeystrokeLogs,
  ]);

  // Timeline synchronization effect - smooth authentic timestamp-based progression
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

        // Calculate how much timeline progress should have been made based on elapsed time
        let totalSessionMs;

        if (compressionData) {
          // When compression is enabled, use the total compressed duration
          // This includes buffers and properly represents the timeline
          totalSessionMs = compressionData.totalCompressedDuration;
        } else {
          // For normal timeline, calculate from keystroke timestamps
          const firstTime = new Date(keystrokeLogs[0].timestamp);
          const lastTime = new Date(
            keystrokeLogs[keystrokeLogs.length - 1].timestamp
          );
          totalSessionMs = lastTime - firstTime;
        }

        // Calculate elapsed time in session scale
        const sessionElapsedMs = elapsedSincePlay * playbackSpeed;
        const timelineProgressDelta =
          (sessionElapsedMs / totalSessionMs) * sessionDuration;

        // Add progress to the exact starting timeline position where user clicked
        const timelinePosition = Math.min(
          sessionStart + sessionDuration,
          playbackStartTimelinePosition + timelineProgressDelta
        );

        setCurrentTime(timelinePosition);

        // Auto-stop when reaching the end
        if (timelinePosition >= sessionStart + sessionDuration) {
          setIsPlaying(false);
          setCurrentKeystrokeIndex(keystrokeLogs.length - 1);
          setCurrentTime(sessionStart + sessionDuration);
          return;
        }

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
    playbackStartTimelinePosition,
    keystrokeLogs,
    sessionStart,
    sessionDuration,
    playbackSpeed,
    compressionData, // Add compressionData to dependencies
    isUserScrubbing,
  ]);

  // Playback control handlers
  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      clearTimeout(timeoutRef.current);
    } else {
      setIsPlaying(true);
      setPlaybackStartTime(Date.now());
      setPlaybackStartKeystroke(currentKeystrokeIndex);
      setPlaybackStartTimelinePosition(currentTime);
    }
  };

  const handleRestart = () => {
    setCurrentKeystrokeIndex(0);
    setCurrentTime(sessionStart);
    setPlaybackStartTime(null);
    setPlaybackStartKeystroke(0);
    setPlaybackStartTimelinePosition(sessionStart);
    setIsPlaying(false);
    clearTimeout(timeoutRef.current);
  };

  const handleSkipToEnd = () => {
    const lastIndex = keystrokeLogs.length - 1;
    setCurrentKeystrokeIndex(lastIndex);
    setCurrentTime(sessionStart + sessionDuration);
    setPlaybackStartTime(null);
    setPlaybackStartKeystroke(lastIndex);
    setPlaybackStartTimelinePosition(sessionStart + sessionDuration);
    setIsPlaying(false);
    clearTimeout(timeoutRef.current);
  };

  const handleSkipBackward = () => {
    const skipAmount = Math.floor(keystrokeLogs.length * 0.05); // Skip 5% of keystrokes
    const newIndex = Math.max(0, currentKeystrokeIndex - skipAmount);
    const newTime = keystrokeToTimelinePos(newIndex);

    setCurrentKeystrokeIndex(newIndex);
    setCurrentTime(newTime);
    setPlaybackStartTime(Date.now());
    setPlaybackStartKeystroke(newIndex);
    setPlaybackStartTimelinePosition(newTime);
  };

  const handleSkipForward = () => {
    const skipAmount = Math.floor(keystrokeLogs.length * 0.05); // Skip 5% of keystrokes
    const newIndex = Math.min(
      keystrokeLogs.length - 1,
      currentKeystrokeIndex + skipAmount
    );
    const newTime = keystrokeToTimelinePos(newIndex);

    setCurrentKeystrokeIndex(newIndex);
    setCurrentTime(newTime);
    setPlaybackStartTime(Date.now());
    setPlaybackStartKeystroke(newIndex);
    setPlaybackStartTimelinePosition(newTime);
  };

  const handleTimelineChange = (newTime) => {
    const newKeystrokeIndex = timelinePosToKeystroke(newTime);

    setCurrentTime(newTime);
    setCurrentKeystrokeIndex(newKeystrokeIndex);
    setPlaybackStartTime(Date.now());
    setPlaybackStartKeystroke(newKeystrokeIndex);
    setPlaybackStartTimelinePosition(newTime);
    setIsUserScrubbing(false);
  };

  // Reset scrubbing state when user stops interacting
  useEffect(() => {
    if (isUserScrubbing) {
      const timer = setTimeout(() => {
        setIsUserScrubbing(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isUserScrubbing, currentTime]);

  return {
    isPlaying,
    currentKeystrokeIndex,
    currentKeystroke,
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
  };
}
