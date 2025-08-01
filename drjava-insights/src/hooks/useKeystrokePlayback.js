import { useState, useRef, useEffect } from "react";
import {
  keystrokeIndexToTimelinePosition,
  timelinePositionToKeystrokeIndex,
} from "../utils/keystrokePlaybackUtils";

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

  // Real-time keystroke playback effect - restored for authentic timing
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

  // Clean up timeout when playback stops
  useEffect(() => {
    if (!isPlaying && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [isPlaying]);

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
        const firstTime = new Date(keystrokeLogs[0].timestamp);
        const lastTime = new Date(
          keystrokeLogs[keystrokeLogs.length - 1].timestamp
        );
        const totalSessionMs = lastTime - firstTime;

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
    playbackStartTimelinePosition, // This is now the key - the exact clicked position
    keystrokeLogs,
    sessionStart,
    sessionDuration,
    playbackSpeed,
    isUserScrubbing,
  ]);

  // Playback control handlers
  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      if (currentKeystrokeIndex >= keystrokeLogs.length - 1) {
        setCurrentKeystrokeIndex(0);
        setCurrentTime(sessionStart);
      }
      setPlaybackStartTime(Date.now());
      setPlaybackStartKeystroke(currentKeystrokeIndex);
      setPlaybackStartTimelinePosition(currentTime); // Use current timeline position
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentKeystrokeIndex(0);
    setCurrentTime(sessionStart);
    setPlaybackStartKeystroke(0);
    setPlaybackStartTimelinePosition(sessionStart); // Reset to start
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleSkipToEnd = () => {
    setIsPlaying(false);
    const endIndex = keystrokeLogs.length - 1;
    setCurrentKeystrokeIndex(endIndex);
    setCurrentTime(sessionEnd);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleSkipBackward = () => {
    // Skip backward by 10 seconds (converted to timeline units)
    // Since timeline is in hours, 10 seconds = 10/3600 hours
    const skipTimeInterval = 10 / 3600; // 10 seconds in hours
    const newTime = Math.max(sessionStart, currentTime - skipTimeInterval);

    const newIndex = timelinePositionToKeystrokeIndex(
      newTime,
      keystrokeLogs,
      sessionStart,
      sessionDuration
    );

    setCurrentKeystrokeIndex(newIndex);
    setCurrentTime(newTime);
    setPlaybackStartKeystroke(newIndex);
    setPlaybackStartTimelinePosition(newTime);
    setPlaybackStartTime(Date.now());
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleSkipForward = () => {
    // Skip forward by 10 seconds (converted to timeline units)
    // Since timeline is in hours, 10 seconds = 10/3600 hours
    const skipTimeInterval = 10 / 3600; // 10 seconds in hours
    const newTime = Math.min(sessionEnd, currentTime + skipTimeInterval);

    const newIndex = timelinePositionToKeystrokeIndex(
      newTime,
      keystrokeLogs,
      sessionStart,
      sessionDuration
    );

    setCurrentKeystrokeIndex(newIndex);
    setCurrentTime(newTime);
    setPlaybackStartKeystroke(newIndex);
    setPlaybackStartTimelinePosition(newTime);
    setPlaybackStartTime(Date.now());
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleTimelineChange = (newTime) => {
    if (isPlaying) {
      setIsPlaying(false);
      setIsUserScrubbing(true);
    }
    const newKeystrokeIndex = timelinePositionToKeystrokeIndex(
      newTime,
      keystrokeLogs,
      sessionStart,
      sessionDuration
    );
    setCurrentKeystrokeIndex(newKeystrokeIndex);

    // Use the clicked position directly to allow positioning anywhere on timeline
    setCurrentTime(newTime);

    setPlaybackStartKeystroke(newKeystrokeIndex);
    setPlaybackStartTimelinePosition(newTime); // Store the exact clicked position
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
