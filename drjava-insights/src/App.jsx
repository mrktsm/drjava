import { useState } from "react";
import Editor from "@monaco-editor/react";
import "./App.css";

function App() {
  const [code, setCode] = useState(`// DrJava Insights - Code Activity Viewer
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Welcome to DrJava Insights!");
        
        // This editor will show your actual Java files
        // based on DrJava activity logs
    }
}`);

  const handleEditorChange = (value) => {
    setCode(value);
  };

  return (
    <div className="app">
      <Editor
        height="100vh"
        defaultLanguage="java"
        value={code}
        onChange={handleEditorChange}
        theme="vs-dark"
        options={{
          fontSize: 14,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}

export default App;
