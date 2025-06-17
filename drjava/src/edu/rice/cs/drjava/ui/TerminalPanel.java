/*BEGIN_COPYRIGHT_BLOCK
 *
 * Copyright (c) 2001-2019, JavaPLT group at Rice University (drjava@rice.edu).  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
 * following conditions are met:
 *    * Redistributions of source code must retain the above copyright notice, this list of conditions and the following
 *      disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the
 *      following disclaimer in the documentation and/or other materials provided with the distribution.
 *    * Neither the names of DrJava, the JavaPLT group, Rice University, nor the names of its contributors may be used
 *      to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 * INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * This software is Open Source Initiative approved Open Source Software. Open Source Initative Approved is a trademark
 * of the Open Source Initiative.
 *
 * This file is part of DrJava.  Download the current version of this project from http://www.drjava.org/ or
 * http://sourceforge.net/projects/drjava/
 *
 * END_COPYRIGHT_BLOCK*/

package edu.rice.cs.drjava.ui;

import edu.rice.cs.drjava.DrJava;

import javax.swing.*;
import javax.swing.text.DefaultCaret;
import java.awt.*;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.io.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import edu.rice.cs.util.FileOps;
import edu.rice.cs.util.swing.BorderlessScrollPane;

/** Panel for displaying terminal functionality within DrJava.
 * This panel provides a basic terminal interface that allows users to execute shell commands.
 */
public class TerminalPanel extends TabbedPanel {
  
  /** The text area that displays terminal output and allows input. */
  private volatile JTextArea _terminalArea;
  
  /** The scroll pane containing the terminal area. */
  private volatile JScrollPane _scrollPane;
  
  /** The process for the currently running command. */
  private volatile Process _currentProcess;
  
  /** The writer for the process's input stream. */
  private volatile PrintWriter _processInput;
  
  /** The main frame that contains this panel. */
  private final MainFrame _mainFrame;
  
  /** Current working directory for the terminal. */
  private volatile File _workingDirectory;
  
  /** The executor service for running commands. */
  private final ExecutorService _executorService;
  
  /** The current command being typed. */
  private volatile StringBuilder _currentCommand;
  
  /** The position where the current command starts. */
  private volatile int _commandStartPos;
  
  /** Creates a new terminal panel.
    * @param frame the main frame that contains this panel
    */
  public TerminalPanel(MainFrame frame) {
    super(frame, "Terminal");
    _mainFrame = frame;
    _workingDirectory = new File(System.getProperty("user.home"));
    _executorService = Executors.newSingleThreadExecutor();
    _currentCommand = new StringBuilder();
    _commandStartPos = 0;
    
    _setupUI();
    _setupKeyHandling();
    _displayPrompt();
  }
  
  /** Sets up the user interface components. */
  private void _setupUI() {
    _mainPanel.setLayout(new BorderLayout());
    
    _terminalArea = new JTextArea();
    _terminalArea.setBackground(Color.WHITE);
    _terminalArea.setForeground(Color.BLACK);
    _terminalArea.setFont(DrJava.getConfig().getSetting(edu.rice.cs.drjava.config.OptionConstants.FONT_MAIN));
    _terminalArea.setCaretColor(Color.BLACK);
    _terminalArea.setCaret(new DefaultCaret() {
      public void setSelectionVisible(boolean visible) {
        super.setSelectionVisible(true);
      }
    });
    
    _scrollPane = new BorderlessScrollPane(_terminalArea);
    _mainPanel.add(_scrollPane, BorderLayout.CENTER);
  }
  
  /** Sets up key handling for terminal input. */
  private void _setupKeyHandling() {
    _terminalArea.addKeyListener(new KeyAdapter() {
      @Override
      public void keyPressed(KeyEvent e) {
        int keyCode = e.getKeyCode();
        
        if (keyCode == KeyEvent.VK_ENTER) {
          e.consume();
          _executeCommand();
        } else if (keyCode == KeyEvent.VK_BACK_SPACE) {
          // Prevent backspace beyond command start
          if (_terminalArea.getCaretPosition() <= _commandStartPos) {
            e.consume();
          }
        } else if (keyCode == KeyEvent.VK_LEFT || keyCode == KeyEvent.VK_UP || 
                   keyCode == KeyEvent.VK_HOME) {
          // Prevent cursor movement beyond command start
          if (_terminalArea.getCaretPosition() <= _commandStartPos) {
            if (keyCode != KeyEvent.VK_HOME) {
              e.consume();
            } else {
              // HOME key moves to start of command
              e.consume();
              _terminalArea.setCaretPosition(_commandStartPos);
            }
          }
        }
      }
      
      @Override
      public void keyTyped(KeyEvent e) {
        char c = e.getKeyChar();
        if (c >= 32 && c != 127) { // Printable characters
          _currentCommand.append(c);
        }
      }
    });
  }
  
  /** Displays the command prompt. */
  private void _displayPrompt() {
    SwingUtilities.invokeLater(() -> {
      String prompt = _workingDirectory.getName() + " $ ";
      _terminalArea.append(prompt);
      _commandStartPos = _terminalArea.getText().length();
      _terminalArea.setCaretPosition(_commandStartPos);
      _currentCommand.setLength(0);
    });
  }
  
  /** Executes the current command. */
  private void _executeCommand() {
    String command = _currentCommand.toString().trim();
    _currentCommand.setLength(0);
    
    SwingUtilities.invokeLater(() -> {
      _terminalArea.append("\n");
      if (!command.isEmpty()) {
        if (command.equals("clear")) {
          _clearTerminal();
          return;
        } else if (command.startsWith("cd ")) {
          _changeDirectory(command.substring(3).trim());
          _displayPrompt();
          return;
        }
        
        _appendOutput("Executing: " + command + "\n");
        _executeSystemCommand(command);
      } else {
        _displayPrompt();
      }
    });
  }
  
  /** Changes the current working directory.
    * @param path the new directory path
    */
  private void _changeDirectory(String path) {
    File newDir;
    if (path.startsWith("/") || path.contains(":")) {
      newDir = new File(path);
    } else {
      newDir = new File(_workingDirectory, path);
    }
    
    if (newDir.exists() && newDir.isDirectory()) {
      try {
        _workingDirectory = newDir.getCanonicalFile();
      } catch (IOException e) {
        _appendOutput("Error changing directory: " + e.getMessage() + "\n");
      }
    } else {
      _appendOutput("Directory not found: " + path + "\n");
    }
  }
  
  /** Executes a system command.
    * @param command the command to execute
    */
  private void _executeSystemCommand(String command) {
    _executorService.submit(() -> {
      try {
        ProcessBuilder pb = new ProcessBuilder();
        
        // Setup command based on OS
        String os = System.getProperty("os.name").toLowerCase();
        if (os.contains("win")) {
          pb.command("cmd", "/c", command);
        } else {
          pb.command("sh", "-c", command);
        }
        
        pb.directory(_workingDirectory);
        pb.redirectErrorStream(true);
        
        _currentProcess = pb.start();
        
        // Read output
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(_currentProcess.getInputStream()))) {
          String line;
          while ((line = reader.readLine()) != null) {
            final String outputLine = line;
            SwingUtilities.invokeLater(() -> _appendOutput(outputLine + "\n"));
          }
        }
        
        int exitCode = _currentProcess.waitFor();
        SwingUtilities.invokeLater(() -> {
          if (exitCode != 0) {
            _appendOutput("Command exited with code: " + exitCode + "\n");
          }
          _displayPrompt();
        });
        
      } catch (Exception e) {
        SwingUtilities.invokeLater(() -> {
          _appendOutput("Error executing command: " + e.getMessage() + "\n");
          _displayPrompt();
        });
      } finally {
        _currentProcess = null;
      }
    });
  }
  
  /** Appends output to the terminal area.
    * @param text the text to append
    */
  private void _appendOutput(String text) {
    _terminalArea.append(text);
    _terminalArea.setCaretPosition(_terminalArea.getText().length());
    _commandStartPos = _terminalArea.getText().length();
  }
  
  /** Clears the terminal. */
  private void _clearTerminal() {
    _terminalArea.setText("");
    _displayPrompt();
  }
  
  @Override
  protected void _close() {
    if (_currentProcess != null) {
      _currentProcess.destroy();
    }
    _executorService.shutdownNow();
    super._close();
  }
  
  @Override
  public boolean requestFocusInWindow() {
    return _terminalArea.requestFocusInWindow();
  }
} 