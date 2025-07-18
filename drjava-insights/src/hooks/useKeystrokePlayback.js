import { useState, useRef, useEffect } from "react";

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
  const [isUserScrubbing, setIsUserScrubbing] = useState(false);
  const timeoutRef = useRef(null);

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

  // Real-time keystroke playback effect
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

  // Timeline synchronization effect
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
        const currentKeystroke = keystrokeLogs[playbackStartKeystroke];
        const sessionElapsedMs = elapsedSincePlay * playbackSpeed;
        const currentKeystrokeTime = new Date(currentKeystroke.timestamp);
        const expectedCurrentTime = new Date(
          currentKeystrokeTime.getTime() + sessionElapsedMs
        );
        const totalSessionMs =
          new Date(keystrokeLogs[keystrokeLogs.length - 1].timestamp) -
          new Date(keystrokeLogs[0].timestamp);
        const progressThroughSession = Math.min(
          1,
          (expectedCurrentTime - new Date(keystrokeLogs[0].timestamp)) /
            totalSessionMs
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
    const skipAmount = Math.max(1, Math.floor(keystrokeLogs.length * 0.1));
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
    const skipAmount = Math.max(1, Math.floor(keystrokeLogs.length * 0.1));
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

  const handleTimelineChange = (newTime) => {
    if (isPlaying) {
      setIsPlaying(false);
      setIsUserScrubbing(true);
    }
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
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isUserScrubbing, currentTime]);

  return {
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
  };
}
