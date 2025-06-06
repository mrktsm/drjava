package edu.rice.cs.drjava.ui;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;

/**
 * A modern AI chat panel for DrJava with GitHub Copilot-inspired design.
 * Currently serves as a placeholder for future AI integration.
 */
public class AIChatPanel extends JPanel {
  
  // Modern color scheme
  private static final Color BACKGROUND_COLOR = new Color(248, 249, 250);
  private static final Color CHAT_BACKGROUND = Color.WHITE;
  private static final Color INPUT_BACKGROUND = Color.WHITE;
  private static final Color BORDER_COLOR = new Color(208, 215, 222);
  private static final Color TEXT_COLOR = new Color(36, 41, 47);
  private static final Color SECONDARY_TEXT_COLOR = new Color(101, 109, 118);
  private static final Color ACCENT_COLOR = new Color(13, 110, 253);
  
  private JTextArea _chatArea;
  private JTextField _inputField;
  private JButton _sendButton;
  private JScrollPane _chatScroll;
  
  public AIChatPanel() {
    super(new BorderLayout());
    _setUpComponents();
    _setUpLayout();
    _setUpEventListeners();
    _addWelcomeMessage();
    
    setPreferredSize(new Dimension(300, 400));
    setMinimumSize(new Dimension(250, 200));
    setBackground(BACKGROUND_COLOR);
  }
  
  private void _setUpComponents() {
    // Chat display area with modern styling
    _chatArea = new JTextArea();
    _chatArea.setEditable(false);
    _chatArea.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    _chatArea.setBackground(CHAT_BACKGROUND);
    _chatArea.setForeground(TEXT_COLOR);
    _chatArea.setLineWrap(true);
    _chatArea.setWrapStyleWord(true);
    _chatArea.setBorder(new EmptyBorder(16, 16, 16, 16));
    _chatArea.setMargin(new Insets(0, 0, 0, 0));
    
    // Modern scroll pane without borders
    _chatScroll = new JScrollPane(_chatArea);
    _chatScroll.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED);
    _chatScroll.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
    _chatScroll.setBorder(null);
    _chatScroll.getViewport().setBackground(CHAT_BACKGROUND);
    
    // Modern input field
    _inputField = new JTextField();
    _inputField.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    _inputField.setBackground(INPUT_BACKGROUND);
    _inputField.setForeground(TEXT_COLOR);
    _inputField.setBorder(BorderFactory.createCompoundBorder(
      BorderFactory.createLineBorder(BORDER_COLOR, 1),
      new EmptyBorder(8, 12, 8, 12)
    ));
    _inputField.setPreferredSize(new Dimension(0, 36));
    
    // Modern send button
    _sendButton = new JButton("Send");
    _sendButton.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    _sendButton.setBackground(ACCENT_COLOR);
    _sendButton.setForeground(Color.WHITE);
    _sendButton.setBorder(new EmptyBorder(8, 16, 8, 16));
    _sendButton.setFocusPainted(false);
    _sendButton.setCursor(new Cursor(Cursor.HAND_CURSOR));
    _sendButton.setPreferredSize(new Dimension(70, 36));
    
    // Add hover effect to button
    _sendButton.addMouseListener(new java.awt.event.MouseAdapter() {
      public void mouseEntered(java.awt.event.MouseEvent e) {
        _sendButton.setBackground(new Color(0, 95, 204));
      }
      public void mouseExited(java.awt.event.MouseEvent e) {
        _sendButton.setBackground(ACCENT_COLOR);
      }
    });
  }
  
  private void _setUpLayout() {
    // Clean header without ugly border
    JLabel headerLabel = new JLabel("AI Assistant");
    headerLabel.setFont(new Font("Segoe UI", Font.BOLD, 14));
    headerLabel.setForeground(TEXT_COLOR);
    headerLabel.setBorder(new EmptyBorder(12, 16, 8, 16));
    
    JPanel headerPanel = new JPanel(new BorderLayout());
    headerPanel.setBackground(BACKGROUND_COLOR);
    headerPanel.add(headerLabel, BorderLayout.WEST);
    
    // Input panel with modern spacing
    JPanel inputPanel = new JPanel(new BorderLayout(8, 0));
    inputPanel.setBackground(BACKGROUND_COLOR);
    inputPanel.setBorder(new EmptyBorder(12, 16, 16, 16));
    inputPanel.add(_inputField, BorderLayout.CENTER);
    inputPanel.add(_sendButton, BorderLayout.EAST);
    
    // Chat area with subtle border
    JPanel chatPanel = new JPanel(new BorderLayout());
    chatPanel.setBackground(CHAT_BACKGROUND);
    chatPanel.setBorder(BorderFactory.createMatteBorder(1, 0, 1, 0, BORDER_COLOR));
    chatPanel.add(_chatScroll, BorderLayout.CENTER);
    
    // Main layout - clean and modern
    setLayout(new BorderLayout());
    add(headerPanel, BorderLayout.NORTH);
    add(chatPanel, BorderLayout.CENTER);
    add(inputPanel, BorderLayout.SOUTH);
  }
  
  private void _setUpEventListeners() {
    // Send button action
    ActionListener sendAction = new ActionListener() {
      public void actionPerformed(ActionEvent e) {
        _sendMessage();
      }
    };
    _sendButton.addActionListener(sendAction);
    
    // Enter key in input field
    _inputField.addKeyListener(new KeyListener() {
      public void keyPressed(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_ENTER) {
          _sendMessage();
        }
      }
      public void keyReleased(KeyEvent e) {}
      public void keyTyped(KeyEvent e) {}
    });
  }
  
  private void _addWelcomeMessage() {
    _appendMessage("AI Assistant", "Hello! I'm your AI programming assistant. 🤖\n\n" +
      "I can help you with:\n" +
      "• Code explanations and debugging\n" +
      "• Java programming questions\n" +
      "• Code generation and suggestions\n" +
      "• Best practices and optimization\n\n" +
      "Type your question below to get started!", SECONDARY_TEXT_COLOR);
  }
  
  private void _sendMessage() {
    String message = _inputField.getText().trim();
    if (!message.isEmpty()) {
      _appendMessage("You", message, TEXT_COLOR);
      _appendMessage("AI Assistant", "I'm still learning! This feature will be available soon. " +
        "In the meantime, keep coding! 🚀", SECONDARY_TEXT_COLOR);
      _inputField.setText("");
      
      // Auto-scroll to bottom
      SwingUtilities.invokeLater(new Runnable() {
        public void run() {
          _chatArea.setCaretPosition(_chatArea.getDocument().getLength());
        }
      });
    }
  }
  
  private void _appendMessage(String sender, String message, Color textColor) {
    // Add some spacing
    if (_chatArea.getText().length() > 0) {
      _chatArea.append("\n");
    }
    
    // Add sender with bold formatting simulation
    _chatArea.append(sender + ":\n");
    _chatArea.append(message + "\n");
  }
  
  /**
   * Request focus for the input field
   */
  public boolean requestFocusInWindow() {
    return _inputField.requestFocusInWindow();
  }
  
  /**
   * Clear the chat area
   */
  public void clearChat() {
    _chatArea.setText("");
    _addWelcomeMessage();
  }
} 