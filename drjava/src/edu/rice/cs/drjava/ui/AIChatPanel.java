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
  private static final Color TEXT_COLOR = new Color(51, 51, 51); // Dark grey for text
  private static final Color SECONDARY_TEXT_COLOR = new Color(101, 109, 118);
  private static final Color ACCENT_COLOR = new Color(13, 110, 253);
  private static final Color USER_BUBBLE_COLOR = new Color(13, 110, 253);
  private static final Color AI_BUBBLE_COLOR = new Color(242, 242, 242);
  private static final Color USER_TEXT_COLOR = Color.WHITE;
  private static final Color AI_TEXT_COLOR = new Color(36, 41, 47);
  
  private JPanel _messagesPanel;
  private JTextField _inputField;
  private JButton _sendButton;
  private JScrollPane _chatScroll;
  private ImageIcon _aiAvatarIcon;
  private static final int AVATAR_SIZE = 32;
  
  // Color for the custom send button
  private Color _sendButtonColor = new Color(148, 163, 184); // Light blue-grey
  
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
      // Try to load the animated gif avatar
      URL avatarUrl = getClass().getResource("/edu/rice/cs/drjava/ui/icons/ai-avatar32.gif");
      if (avatarUrl != null) {
        // Use the animated gif directly - don't transform it or it breaks the animation
        _aiAvatarIcon = new ImageIcon(avatarUrl);
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
    // Create a circular avatar with a beautiful gradient background
    BufferedImage avatar = new BufferedImage(AVATAR_SIZE, AVATAR_SIZE, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g2d = avatar.createGraphics();
    g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    
    // Create a subtle gradient from light blue to darker blue
    GradientPaint gradient = new GradientPaint(
      0, 0, new Color(99, 179, 237),  // Light blue
      AVATAR_SIZE, AVATAR_SIZE, new Color(65, 131, 215)  // Darker blue
    );
    g2d.setPaint(gradient);
    g2d.fillOval(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    
    g2d.dispose();
    return new ImageIcon(avatar);
  }
  
  private ImageIcon _createUserAvatar() {
    // Create a simple grey circle for user messages
    int size = AVATAR_SIZE + 4; // Match AI avatar background size
    BufferedImage avatar = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g2d = avatar.createGraphics();
    g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    
    // Simple grey circle - clean and minimal
    g2d.setColor(new Color(156, 163, 175)); // Nice medium grey
    g2d.fillOval(0, 0, size, size);
    
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
    _inputField = _createEmbeddedInputField();
    _sendButton = _createSendButton();
  }
  
  private JTextField _createEmbeddedInputField() {
    final JTextField textField = new JTextField();
    textField.setOpaque(false); // Let the container handle the background
    textField.setBorder(new EmptyBorder(0, 12, 0, 50)); // Left padding + right space for button
    textField.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 14));
    textField.setForeground(TEXT_COLOR);
    textField.setCaretColor(TEXT_COLOR);
    
    // Remove any focus painting that might escape the clipping
    textField.setFocusTraversalKeysEnabled(false);
    
    textField.addActionListener(e -> _sendMessage());
    
    return textField;
  }
  
  private JButton _createSendButton() {
    JButton button = new JButton("→") {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Draw circular background
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
    
    button.setFont(new Font("Segoe UI", Font.BOLD, 16));
    button.setForeground(Color.WHITE);
    button.setBorder(null);
    button.setFocusPainted(false);
    button.setCursor(new Cursor(Cursor.HAND_CURSOR));
    button.setContentAreaFilled(false);
    button.setOpaque(false);
    
    // Add hover effect
    button.addMouseListener(new java.awt.event.MouseAdapter() {
      public void mouseEntered(java.awt.event.MouseEvent e) {
        _sendButtonColor = new Color(131, 146, 164);
        button.repaint();
      }
      public void mouseExited(java.awt.event.MouseEvent e) {
        _sendButtonColor = new Color(148, 163, 184);
        button.repaint();
      }
    });
    
    button.addActionListener(e -> _sendMessage());
    
    return button;
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
    // Custom rounded background panel that masks all content to capsule shape
    final JPanel roundedBackground = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Paint background
        g2d.setColor(getBackground());
        g2d.fillRect(0, 0, getWidth(), getHeight());
        g2d.dispose();
      }
      
      @Override
      protected void paintChildren(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Create capsule clipping mask for all children
        int height = getHeight();
        int width = getWidth();
        int radius = height - 4; // Match border calculation: height - top inset - bottom inset
        
        // Apply capsule clipping to all child painting
        g2d.setClip(new java.awt.geom.RoundRectangle2D.Float(0, 0, width, height, radius, radius));
        
        // Paint all children with clipping applied
        super.paintChildren(g2d);
        g2d.dispose();
      }
    };
    roundedBackground.setBackground(INPUT_BACKGROUND);
    roundedBackground.setBorder(new RoundedBorder(22, BORDER_COLOR, true));
    roundedBackground.add(_inputField, BorderLayout.CENTER);
    
    // Small button panel that only covers the button area
    final JPanel buttonPanel = new JPanel(null); // Use null layout for precise positioning
    buttonPanel.setOpaque(false);
    buttonPanel.setPreferredSize(new Dimension(44, 44)); // Just big enough for the button
    buttonPanel.add(_sendButton);

    // Container for the embedded input. Use JLayeredPane for reliable layering.
    final JLayeredPane layeredPane = new JLayeredPane();
    layeredPane.setPreferredSize(new Dimension(0, 44));
    
    // Add components to the layered pane
    layeredPane.add(roundedBackground, JLayeredPane.DEFAULT_LAYER);
    layeredPane.add(buttonPanel, JLayeredPane.PALETTE_LAYER);
    
    // Layout manager for JLayeredPane
    layeredPane.addComponentListener(new ComponentAdapter() {
      @Override
      public void componentResized(ComponentEvent e) {
        Component c = e.getComponent();
        roundedBackground.setBounds(0, 0, c.getWidth(), c.getHeight());
        
        // Position button panel precisely in the right side
        int buttonPanelWidth = 44;
        int buttonPanelHeight = 44;
        int x = c.getWidth() - buttonPanelWidth - 6; // 6px margin from right
        int y = (c.getHeight() - buttonPanelHeight) / 2; // Center vertically
        buttonPanel.setBounds(x, y, buttonPanelWidth, buttonPanelHeight);
        
        // Position the send button within its panel
        _sendButton.setBounds(6, 6, 32, 32); // Center the 32x32 button in the 44x44 panel
      }
    });
    
    // Container for the input with padding
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
      public void keyReleased(KeyEvent e) {
        // Force repaint to ensure text is visible
        _inputField.repaint();
      }
      public void keyTyped(KeyEvent e) {
        // Force repaint to ensure text is visible
        SwingUtilities.invokeLater(new Runnable() {
          public void run() {
            _inputField.repaint();
          }
        });
      }
    });
    
    // Ensure input field gets focus when panel is shown
    SwingUtilities.invokeLater(new Runnable() {
      public void run() {
        _inputField.requestFocusInWindow();
      }
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
    
    // Header with avatar and name (like AI messages)
    JPanel headerPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    headerPanel.setOpaque(false);
    
    // User avatar - simple grey circle
    JLabel avatarLabel = new JLabel(_createUserAvatar());
    avatarLabel.setBorder(new EmptyBorder(0, 0, 0, 0));
    avatarLabel.setVerticalAlignment(SwingConstants.TOP);
    avatarLabel.setPreferredSize(new Dimension(AVATAR_SIZE + 4, AVATAR_SIZE + 4)); // Same size as AI avatar
    
    // User name
    JLabel nameLabel = new JLabel("You");
    nameLabel.setFont(new Font("Segoe UI", Font.BOLD, 13));
    nameLabel.setForeground(TEXT_COLOR);
    nameLabel.setVerticalAlignment(SwingConstants.CENTER);
    
    headerPanel.add(avatarLabel);
    headerPanel.add(nameLabel);
    
    // Message text (no bubble, clean style like AI messages)
    JTextArea messageText = new JTextArea(message);
    messageText.setEditable(false);
    messageText.setOpaque(false);
    messageText.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    messageText.setForeground(TEXT_COLOR);
    messageText.setLineWrap(true);
    messageText.setWrapStyleWord(true);
    messageText.setBorder(new EmptyBorder(4, 52, 0, 16)); // Left margin to align with text
    
    messagePanel.add(headerPanel, BorderLayout.NORTH);
    messagePanel.add(messageText, BorderLayout.CENTER);
    
    return messagePanel;
  }
  
  private JPanel _createAIMessagePanel(String message) {
    JPanel messagePanel = new JPanel(new BorderLayout());
    messagePanel.setOpaque(false);
    messagePanel.setMaximumSize(new Dimension(Integer.MAX_VALUE, Integer.MAX_VALUE));
    
    // Header with avatar and name (like Copilot)
    JPanel headerPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    headerPanel.setOpaque(false);
    
    // Avatar with grey circle background
    JLabel avatarLabel = new JLabel(_aiAvatarIcon) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Paint grey circle background first
        g2d.setColor(new Color(229, 231, 235)); // Light grey background circle
        g2d.fillOval(0, 0, getWidth(), getHeight());
        
        // Paint the animated gif icon on top, centered (preserves animation)
        if (getIcon() != null) {
          int iconWidth = getIcon().getIconWidth();
          int iconHeight = getIcon().getIconHeight();
          int x = (getWidth() - iconWidth) / 2;
          int y = (getHeight() - iconHeight) / 2;
          getIcon().paintIcon(this, g2d, x, y);
        }
        
        g2d.dispose();
      }
    };
    avatarLabel.setBorder(new EmptyBorder(0, 0, 0, 0));
    avatarLabel.setVerticalAlignment(SwingConstants.TOP);
    avatarLabel.setPreferredSize(new Dimension(AVATAR_SIZE + 4, AVATAR_SIZE + 4)); // Slightly larger for outline
    
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
    messageText.setBorder(new EmptyBorder(4, 52, 0, 16)); // Left margin to align with text
    
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
      if (_isCapsule) {
        // For capsule style, use much smaller insets to prevent text clipping
        return new Insets(2, 8, 2, 8);
      }
      int r = this.radius;
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