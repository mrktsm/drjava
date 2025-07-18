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

export default InfoPanel;
