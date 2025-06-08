package edu.rice.cs.drjava.ui;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.text.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.geom.Ellipse2D;
import java.awt.image.BufferedImage;
import java.net.URL;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentAdapter;

/**
 * A modern AI chat panel for DrJava with GitHub Copilot-inspired design.
 * Features animated avatars, message bubbles, and a chat-like interface.
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
  private static final Color USER_BUBBLE_COLOR = new Color(13, 110, 253);
  private static final Color AI_BUBBLE_COLOR = new Color(248, 249, 250);
  private static final Color USER_TEXT_COLOR = Color.WHITE;
  private static final Color AI_TEXT_COLOR = new Color(36, 41, 47);
  
  private JPanel _messagesPanel;
  private JTextField _inputField;
  private JButton _sendButton;
  private JScrollPane _chatScroll;
  private ImageIcon _aiAvatarIcon;
  private static final int AVATAR_SIZE = 32;
  
  // Color for the custom send button
  private Color _sendButtonColor = new Color(99, 102, 241);
  
  public AIChatPanel() {
    super(new BorderLayout());
    _loadAvatarIcon();
    _setUpComponents();
    _setUpLayout();
    _setUpEventListeners();
    _addWelcomeMessage();
    
    setPreferredSize(new Dimension(300, 400));
    setMinimumSize(new Dimension(250, 200));
    setBackground(BACKGROUND_COLOR);
  }
  
  private void _loadAvatarIcon() {
    try {
      // Use DrJava's standard icon loading mechanism
      // Expects a pre-processed 32x32 circular animated GIF
      ImageIcon avatarIcon = MainFrame.getIcon("ai-avatar32.gif");
      if (avatarIcon != null) {
        // Use the pre-processed avatar directly
        _aiAvatarIcon = avatarIcon;
      } else {
        // Fallback: create a simple circular avatar with gradient
        _aiAvatarIcon = _createDefaultAvatar();
      }
    } catch (Exception e) {
      // Fallback avatar
      _aiAvatarIcon = _createDefaultAvatar();
    }
  }
  
  private ImageIcon _createDefaultAvatar() {
    // Create a beautiful gradient avatar as fallback
    BufferedImage avatar = new BufferedImage(32, 32, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g2d = avatar.createGraphics();
    g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    
    // Create gradient from blue to purple
    GradientPaint gradient = new GradientPaint(
      0, 0, new Color(13, 110, 253),
      32, 32, new Color(120, 119, 198)
    );
    g2d.setPaint(gradient);
    g2d.fillOval(0, 0, 32, 32);
    
    // Add AI text
    g2d.setColor(Color.WHITE);
    g2d.setFont(new Font("Segoe UI", Font.BOLD, 12));
    FontMetrics fm = g2d.getFontMetrics();
    String text = "AI";
    int textX = (32 - fm.stringWidth(text)) / 2;
    int textY = (32 + fm.getAscent()) / 2 - 2;
    g2d.drawString(text, textX, textY);
    
    g2d.dispose();
    return new ImageIcon(avatar);
  }
  
  private void _setUpComponents() {
    // Messages panel with chat-like layout
    _messagesPanel = new JPanel();
    _messagesPanel.setLayout(new BoxLayout(_messagesPanel, BoxLayout.Y_AXIS));
    _messagesPanel.setBackground(CHAT_BACKGROUND);
    _messagesPanel.setBorder(new EmptyBorder(16, 16, 16, 16));
    
    // Modern scroll pane
    _chatScroll = new JScrollPane(_messagesPanel);
    _chatScroll.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED);
    _chatScroll.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
    _chatScroll.setBorder(null);
    _chatScroll.getViewport().setBackground(CHAT_BACKGROUND);
    _chatScroll.getVerticalScrollBar().setUnitIncrement(16);
    
    // Create embedded input field with send button inside
    _createEmbeddedInputField();
  }
  
  private void _createEmbeddedInputField() {
    // Modern input field with rounded border
    _inputField = new JTextField();
    _inputField.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    _inputField.setBackground(INPUT_BACKGROUND);
    _inputField.setForeground(TEXT_COLOR);
    _inputField.setBorder(new EmptyBorder(12, 16, 12, 50)); // Extra right padding for button
    _inputField.setPreferredSize(new Dimension(0, 44));
    
    // Create custom circular send button
    _sendButton = new JButton("→") {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Draw circular background using our stored color
        g2d.setColor(_sendButtonColor);
        g2d.fillOval(0, 0, getWidth(), getHeight());
        
        // Draw text
        g2d.setColor(getForeground());
        g2d.setFont(getFont());
        FontMetrics fm = g2d.getFontMetrics();
        String text = getText();
        int textX = (getWidth() - fm.stringWidth(text)) / 2;
        int textY = (getHeight() + fm.getAscent()) / 2 - 2;
        g2d.drawString(text, textX, textY);
        
        g2d.dispose();
      }
      
      @Override
      public boolean contains(int x, int y) {
        // Only respond to clicks within the circle
        int centerX = getWidth() / 2;
        int centerY = getHeight() / 2;
        int radius = Math.min(getWidth(), getHeight()) / 2;
        int dx = x - centerX;
        int dy = y - centerY;
        return (dx * dx + dy * dy) <= (radius * radius);
      }
    };
    
    _sendButton.setFont(new Font("Segoe UI", Font.BOLD, 16));
    _sendButton.setBackground(new Color(99, 102, 241)); // Subtle purple
    _sendButton.setForeground(Color.WHITE);
    _sendButton.setBorder(null);
    _sendButton.setFocusPainted(false);
    _sendButton.setCursor(new Cursor(Cursor.HAND_CURSOR));
    _sendButton.setPreferredSize(new Dimension(32, 32));
    _sendButton.setContentAreaFilled(false); // This removes the default square background
    _sendButton.setOpaque(false); // Make background completely transparent
    
    // Add hover effect to button
    _sendButton.addMouseListener(new java.awt.event.MouseAdapter() {
      public void mouseEntered(java.awt.event.MouseEvent e) {
        _sendButtonColor = new Color(79, 82, 221);
        _sendButton.repaint();
      }
      public void mouseExited(java.awt.event.MouseEvent e) {
        _sendButtonColor = new Color(99, 102, 241);
        _sendButton.repaint();
      }
    });
  }
  
  private void _setUpLayout() {
    // Create the embedded input panel
    JPanel inputContainer = _createEmbeddedInputPanel();
    
    // Chat area
    JPanel chatPanel = new JPanel(new BorderLayout());
    chatPanel.setBackground(CHAT_BACKGROUND);
    chatPanel.setBorder(null);
    chatPanel.add(_chatScroll, BorderLayout.CENTER);
    
    // Main layout
    setLayout(new BorderLayout());
    add(chatPanel, BorderLayout.CENTER);
    add(inputContainer, BorderLayout.SOUTH);
  }
  
  private JPanel _createEmbeddedInputPanel() {
    // Rounded background panel for the input field
    final JPanel roundedBackground = new JPanel(new BorderLayout());
    roundedBackground.setBackground(INPUT_BACKGROUND);
    roundedBackground.setBorder(new RoundedBorder(36, BORDER_COLOR, true));
    roundedBackground.add(_inputField, BorderLayout.CENTER);
    
    // Button positioned on the right side
    final JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 6));
    buttonPanel.setOpaque(false);
    buttonPanel.add(_sendButton);

    // Container for the embedded input. Use JLayeredPane for reliable layering.
    final JLayeredPane layeredPane = new JLayeredPane();
    // Give the pane a preferred size based on its main content.
    // This is crucial for the containing layout manager.
    layeredPane.setPreferredSize(roundedBackground.getPreferredSize());
    
    // Add components to the layered pane
    layeredPane.add(roundedBackground, JLayeredPane.DEFAULT_LAYER); // z-index 0
    layeredPane.add(buttonPanel, JLayeredPane.PALETTE_LAYER); // z-index 100
    
    // Since JLayeredPane has a null layout by default, we must manage child bounds.
    layeredPane.addComponentListener(new ComponentAdapter() {
      @Override
      public void componentResized(ComponentEvent e) {
        Component c = e.getComponent();
        roundedBackground.setBounds(0, 0, c.getWidth(), c.getHeight());
        buttonPanel.setBounds(0, 0, c.getWidth(), c.getHeight());
      }
    });
    
    // We put the layeredPane inside a final container panel that has the outer border.
    JPanel inputContainer = new JPanel(new BorderLayout());
    inputContainer.setBackground(CHAT_BACKGROUND);
    inputContainer.setBorder(new EmptyBorder(12, 16, 16, 16));
    inputContainer.add(layeredPane, BorderLayout.CENTER);
    
    return inputContainer;
  }
  
  private void _setUpEventListeners() {
    ActionListener sendAction = new ActionListener() {
      public void actionPerformed(ActionEvent e) {
        _sendMessage();
      }
    };
    _sendButton.addActionListener(sendAction);
    
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
    _addAIMessage("Hello! I'm your AI programming assistant. 🤖\n\n" +
      "I can help you with:\n" +
      "• Code explanations and debugging\n" +
      "• Java programming questions\n" +
      "• Code generation and suggestions\n" +
      "• Best practices and optimization\n\n" +
      "Type your question below to get started!");
  }
  
  private void _sendMessage() {
    String message = _inputField.getText().trim();
    if (!message.isEmpty()) {
      _addUserMessage(message);
      _addAIMessage("I'm still learning! This feature will be available soon. " +
        "In the meantime, keep coding! 🚀");
      _inputField.setText("");
      _scrollToBottom();
    }
  }
  
  private void _addUserMessage(String message) {
    JPanel messagePanel = _createUserMessagePanel(message);
    _messagesPanel.add(messagePanel);
    _messagesPanel.add(Box.createVerticalStrut(8));
    _messagesPanel.revalidate();
    _messagesPanel.repaint();
  }
  
  private void _addAIMessage(String message) {
    JPanel messagePanel = _createAIMessagePanel(message);
    _messagesPanel.add(messagePanel);
    _messagesPanel.add(Box.createVerticalStrut(8));
    _messagesPanel.revalidate();
    _messagesPanel.repaint();
  }
  
  private JPanel _createUserMessagePanel(String message) {
    JPanel messagePanel = new JPanel(new BorderLayout());
    messagePanel.setOpaque(false);
    messagePanel.setMaximumSize(new Dimension(Integer.MAX_VALUE, Integer.MAX_VALUE));
    
    // User name header
    JLabel nameLabel = new JLabel("You");
    nameLabel.setFont(new Font("Segoe UI", Font.BOLD, 13));
    nameLabel.setForeground(TEXT_COLOR);
    nameLabel.setBorder(new EmptyBorder(0, 16, 4, 0));
    
    // Message text (no bubble, clean style)
    JTextArea messageText = new JTextArea(message);
    messageText.setEditable(false);
    messageText.setOpaque(false);
    messageText.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    messageText.setForeground(TEXT_COLOR);
    messageText.setLineWrap(true);
    messageText.setWrapStyleWord(true);
    messageText.setBorder(new EmptyBorder(0, 16, 0, 16));
    
    messagePanel.add(nameLabel, BorderLayout.NORTH);
    messagePanel.add(messageText, BorderLayout.CENTER);
    
    return messagePanel;
  }
  
  private JPanel _createAIMessagePanel(String message) {
    JPanel messagePanel = new JPanel(new BorderLayout());
    messagePanel.setOpaque(false);
    messagePanel.setMaximumSize(new Dimension(Integer.MAX_VALUE, Integer.MAX_VALUE));
    
    // Header with avatar and name (like Copilot)
    JPanel headerPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
    headerPanel.setOpaque(false);
    
    // Avatar
    JLabel avatarLabel = new JLabel(_aiAvatarIcon);
    avatarLabel.setBorder(new EmptyBorder(0, 0, 0, 8));
    avatarLabel.setVerticalAlignment(SwingConstants.TOP);
    
    // Assistant name
    JLabel nameLabel = new JLabel("Assistant");
    nameLabel.setFont(new Font("Segoe UI", Font.BOLD, 13));
    nameLabel.setForeground(TEXT_COLOR);
    nameLabel.setVerticalAlignment(SwingConstants.CENTER);
    
    headerPanel.add(avatarLabel);
    headerPanel.add(nameLabel);
    
    // Message text (no bubble, just clean text)
    JTextArea messageText = new JTextArea(message);
    messageText.setEditable(false);
    messageText.setOpaque(false);
    messageText.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    messageText.setForeground(TEXT_COLOR);
    messageText.setLineWrap(true);
    messageText.setWrapStyleWord(true);
    messageText.setBorder(new EmptyBorder(4, 40, 0, 16)); // Left margin to align with text
    
    messagePanel.add(headerPanel, BorderLayout.NORTH);
    messagePanel.add(messageText, BorderLayout.CENTER);
    
    return messagePanel;
  }
  
  private JPanel _createMessageBubble(String message, Color backgroundColor, Color textColor) {
    JPanel bubble = new JPanel(new BorderLayout());
    bubble.setBackground(backgroundColor);
    
    // Improved border with better rendering
    bubble.setBorder(BorderFactory.createCompoundBorder(
      new RoundedBorder(8, BORDER_COLOR),
      new EmptyBorder(10, 14, 10, 14)
    ));
    
    JTextArea textArea = new JTextArea(message);
    textArea.setEditable(false);
    textArea.setOpaque(false);
    textArea.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    textArea.setForeground(textColor);
    textArea.setLineWrap(true);
    textArea.setWrapStyleWord(true);
    
    bubble.add(textArea, BorderLayout.CENTER);
    
    // Limit bubble width
    Dimension maxSize = new Dimension(250, Integer.MAX_VALUE);
    bubble.setMaximumSize(maxSize);
    bubble.setPreferredSize(new Dimension(Math.min(250, bubble.getPreferredSize().width), bubble.getPreferredSize().height));
    
    return bubble;
  }
  
  private void _scrollToBottom() {
    SwingUtilities.invokeLater(new Runnable() {
      public void run() {
        JScrollBar verticalBar = _chatScroll.getVerticalScrollBar();
        verticalBar.setValue(verticalBar.getMaximum());
      }
    });
  }
  
  // Simple rounded border implementation
  private static class RoundedBorder implements javax.swing.border.Border {
    private final int radius;
    private final Color color;
    private final boolean _isCapsule;
    
    RoundedBorder(int radius, Color color) {
      this(radius, color, false);
    }
    
    RoundedBorder(int radius, Color color, boolean isCapsule) {
      this.radius = radius;
      this.color = color;
      this._isCapsule = isCapsule;
    }
    
    public void paintBorder(Component c, Graphics g, int x, int y, int width, int height) {
      Graphics2D g2d = (Graphics2D) g.create();
      Insets insets = getBorderInsets(c);
      g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
      int r = radius;
      if (_isCapsule) {
        r = c.getHeight() - insets.top - insets.bottom;
      }
      g2d.setColor(color);
      g2d.drawRoundRect(x, y, width - 1, height - 1, r, r);
      g2d.dispose();
    }
    
    public Insets getBorderInsets(Component c) {
      int r = this.radius;
      if (_isCapsule) {
        r = c.getHeight();
      }
      return new Insets(r / 4, r / 2, r / 4, r / 2);
    }
    
    public boolean isBorderOpaque() {
      return false;
    }
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
    _messagesPanel.removeAll();
    _addWelcomeMessage();
    _messagesPanel.revalidate();
    _messagesPanel.repaint();
  }
} 