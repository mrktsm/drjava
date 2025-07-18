function FileExplorer({ files, activeFile, onFileSelect }) {
  const [isProjectExpanded, setIsProjectExpanded] = useState(true);

  const toggleProjectFolder = () => {
    setIsProjectExpanded(!isProjectExpanded);
  };

  const getFileIcon = (filename) => {
    const extension = filename.split(".").pop().toLowerCase();
    switch (extension) {
      case "java":
        return <BsFiletypeJava className="file-icon java" />;
      default:
        return <VscFile className="file-icon" />;
    }
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">EXPLORER</div>
      <div className="explorer-content">
        <button className="project-folder" onClick={toggleProjectFolder}>
          <div className="chevron-container">
            {isProjectExpanded ? (
              <VscChevronDown size={16} className="chevron-icon" />
            ) : (
              <VscChevronRight size={16} className="chevron-icon" />
            )}
          </div>
          <span className="project-name">DRJAVA PROJECT</span>
        </button>

        {isProjectExpanded && (
          <div className="files-container">
            <div className="tree-line"></div>

            {files.map((file, index) => (
              <div
                key={index}
                className={`file-item-vscode ${
                  activeFile === file ? "active" : ""
                }`}
                onClick={() => onFileSelect(file)}
                title={file}
              >
                {getFileIcon(file)}
                <span className="file-name">{file}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
