package edu.rice.cs.drjava.ui;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.text.*;
import javax.swing.text.html.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.MouseWheelEvent;
import java.awt.geom.Ellipse2D;
import java.awt.image.BufferedImage;
import java.net.URL;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentAdapter;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import edu.rice.cs.drjava.DrJava;
import edu.rice.cs.drjava.config.OptionConstants;
import edu.rice.cs.util.swing.Utilities;
import java.util.stream.Collectors;
// HTTP client imports for MCP server communication
import java.net.HttpURLConnection;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.util.concurrent.CompletableFuture;
// Add imports for conversation history
import java.util.List;
import java.util.ArrayList;

/**
 * A modern AI chat panel for DrJava with Cursor-inspired clean design.
 * Features a minimal interface with clean message layout and markdown support.
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
  private static final Color USER_BUBBLE_COLOR = new Color(242, 242, 242); // Light gray
  private static final Color AI_BUBBLE_COLOR = new Color(242, 242, 242);
  private static final Color USER_TEXT_COLOR = new Color(51, 51, 51); // Dark text for gray background
  private static final Color AI_TEXT_COLOR = new Color(36, 41, 47);
  
  private JPanel _messagesPanel;
  private JTextField _inputField;
  private JButton _sendButton;
  private JScrollPane _chatScroll;
  
  // Context indicator for selected text
  private JPanel _contextIndicator;
  private JLabel _contextLabel;
  private JButton _contextCloseButton;
  private String _contextText;
  private boolean _contextVisible = false;
  
  // Store context info for the current message being sent
  private String _currentContextFileName;
  private int _currentContextStartLine;
  private int _currentContextEndLine;
  
  // Color for the custom send button
  private Color _sendButtonColor = new Color(148, 163, 184); // Light blue-grey
  
  // HTTP client for MCP server communication
  private static final String MCP_SERVER_URL = "http://localhost:8080/chat";
  private static final String MCP_STREAM_URL = "http://localhost:8080/chat/stream";
  
  // Conversation history storage
  private List<ChatMessage> _conversationHistory;
  
  // Inner class to represent a chat message
  public static class ChatMessage {
    public final String role; // "user" or "assistant"
    public final String content;
    public final long timestamp;
    
    public ChatMessage(String role, String content) {
      this.role = role;
      this.content = content;
      this.timestamp = System.currentTimeMillis();
    }
  }
  
  public AIChatPanel() {
    super(new BorderLayout());
    _conversationHistory = new ArrayList<>();
    _setUpComponents();
    _setUpLayout();
    _setUpEventListeners();
    _addWelcomeMessage();
    
    setPreferredSize(new Dimension(400, 400));
    setMinimumSize(new Dimension(380, 200));
    setBackground(BACKGROUND_COLOR);
    
    // Add component listener to handle resizing properly
    addComponentListener(new ComponentAdapter() {
      @Override
      public void componentResized(ComponentEvent e) {
        // Force revalidation of messages panel when the main panel is resized
        SwingUtilities.invokeLater(new Runnable() {
          public void run() {
            if (_messagesPanel != null) {
              _messagesPanel.revalidate();
              _messagesPanel.repaint();
            }
          }
        });
      }
    });
  }
  
  /**
   * Simple markdown to HTML converter for basic formatting
   */
  private String _convertMarkdownToHTML(String markdown) {
    // Convert markdown to HTML with proper styling
    String html = markdown
      // Handle inline code first (before other formatting)
      .replaceAll("`([^`]+)`", "<code style=\"background-color: #f6f8fa; padding: 2px 4px; border-radius: 3px; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 10px;\">$1</code>")
      // Bold text
      .replaceAll("\\*\\*([^*]+)\\*\\*", "<strong>$1</strong>")
      // Italic text  
      .replaceAll("\\*([^*]+)\\*", "<em>$1</em>");
    
    // Headers (using Pattern for multiline)
    html = html.replaceAll("(?m)^### (.+)$", "<h3>$1</h3>");
    html = html.replaceAll("(?m)^## (.+)$", "<h2>$1</h2>");
    html = html.replaceAll("(?m)^# (.+)$", "<h1>$1</h1>");
    
    // Line breaks
    html = html.replaceAll("\n", "<br>");
    
    // Wrap in HTML structure with comprehensive styling and CSS-based width control
    return "<html><head><style>" +
           "body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; line-height: 1.4; margin: 0; padding: 0; color: #24292f; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; hyphens: auto; word-break: break-word; white-space: pre-wrap; }" +
           "h1 { font-size: 13px; font-weight: 600; margin: 8px 0 4px 0; color: #1f2328; word-wrap: break-word; }" +
           "h2 { font-size: 12px; font-weight: 600; margin: 6px 0 3px 0; color: #1f2328; word-wrap: break-word; }" +
           "h3 { font-size: 11px; font-weight: 600; margin: 4px 0 2px 0; color: #1f2328; word-wrap: break-word; }" +
           "code { background-color: #f6f8fa; padding: 2px 4px; border-radius: 3px; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 10px; word-break: break-all; white-space: pre-wrap; }" +
           "pre { background-color: #f6f8fa; padding: 8px; border-radius: 6px; overflow-x: auto; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 10px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }" +
           "ul { margin: 4px 0; padding-left: 20px; }" +
           "li { margin: 2px 0; word-wrap: break-word; }" +
           "p { margin: 4px 0; word-wrap: break-word; hyphens: auto; word-break: break-word; white-space: pre-wrap; }" +
           "strong { font-weight: 600; }" +
           "em { font-style: italic; }" +
           "</style></head><body>" + html + "</body></html>";
  }
  
  /**
   * Creates a syntax-highlighted code pane for Java code with horizontal scrolling
   */
  private JComponent _createSyntaxHighlightedCodePane(String code) {
    // Create JTextPane with syntax highlighting and no word wrapping
    JTextPane codePane = new JTextPane() {
      @Override
      public boolean getScrollableTracksViewportWidth() {
        return false; // Critical: Allow horizontal scrolling
      }
      
      @Override
      public boolean getScrollableTracksViewportHeight() {
        return false; // Allow vertical scrolling when needed
      }
    };
    
    codePane.setEditable(false);
    codePane.setOpaque(true);
    codePane.setBackground(Color.WHITE);
    codePane.setBorder(null); // Remove padding from text area
    
    StyledDocument doc = codePane.getStyledDocument();
    
    // Define styles based on DrJava's color scheme
    Style defaultStyle = StyleContext.getDefaultStyleContext().getStyle(StyleContext.DEFAULT_STYLE);
    Style normalStyle = doc.addStyle("normal", defaultStyle);
    
    // Use DrJava's main font family but with chat text size (13)
    Font mainFont = DrJava.getConfig().getSetting(OptionConstants.FONT_MAIN);
    StyleConstants.setFontFamily(normalStyle, mainFont.getFamily());
    StyleConstants.setFontSize(normalStyle, 13);
    StyleConstants.setForeground(normalStyle, new Color(51, 51, 51));
    
    Style keywordStyle = doc.addStyle("keyword", normalStyle);
    StyleConstants.setForeground(keywordStyle, new Color(0, 0, 255)); // Blue for keywords
    
    Style typeStyle = doc.addStyle("type", normalStyle);
    StyleConstants.setForeground(typeStyle, new Color(0, 0, 139)); // Dark blue for types
    
    Style stringStyle = doc.addStyle("string", normalStyle);
    StyleConstants.setForeground(stringStyle, new Color(139, 0, 0)); // Dark red for strings
    
    Style commentStyle = doc.addStyle("comment", normalStyle);
    StyleConstants.setForeground(commentStyle, new Color(0, 128, 0)); // Green for comments
    StyleConstants.setItalic(commentStyle, true);
    
    Style numberStyle = doc.addStyle("number", normalStyle);
    StyleConstants.setForeground(numberStyle, new Color(0, 139, 139)); // Cyan for numbers
    
    // Java keywords
    String[] keywords = {
      "abstract", "assert", "break", "case", "catch", "class", "const",
      "continue", "default", "do", "else", "enum", "extends", "final", "finally",
      "for", "goto", "if", "implements", "import", "instanceof", "interface", "native",
      "new", "package", "private", "protected", "public", "return", "static", "strictfp",
      "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void",
      "volatile", "while", "true", "false", "null"
    };
    
    // Java types
    String[] types = {
      "boolean", "byte", "char", "double", "float", "int", "long", "short",
      "String", "Object", "Integer", "Boolean", "Character", "Double", "Float", "Long", "Short",
      "BigInteger", "BigDecimal", "StringBuilder", "StringBuffer", "ArrayList", "HashMap", "List",
      "Map", "Set", "Collection", "Iterator", "Exception", "RuntimeException", "Thread", "System"
    };
    
    try {
      String[] lines = code.split("\n");
      for (int i = 0; i < lines.length; i++) {
        String line = lines[i];
        if (i > 0) {
          doc.insertString(doc.getLength(), "\n", normalStyle);
        }
        
        // Check for comments first - handle both line comments and inline comments
        if (line.trim().startsWith("//")) {
          doc.insertString(doc.getLength(), line, commentStyle);
          continue;
        }
        
        if (line.trim().startsWith("/*") || line.trim().startsWith("*")) {
          doc.insertString(doc.getLength(), line, commentStyle);
          continue;
        }
        
        // Check for inline comments - split line at "//" if present
        int commentIndex = line.indexOf("//");
        String codePartOfLine = (commentIndex != -1) ? line.substring(0, commentIndex) : line;
        String commentPartOfLine = (commentIndex != -1) ? line.substring(commentIndex) : null;
        
        // Tokenize and highlight the code part
        Pattern tokenPattern = Pattern.compile("(\"[^\"]*\"|'[^']*'|\\w+|\\s+|[^\\w\\s])");
        Matcher tokenMatcher = tokenPattern.matcher(codePartOfLine);
        
        while (tokenMatcher.find()) {
          String token = tokenMatcher.group();
          Style styleToUse = normalStyle;
          
          if (token.matches("\\s+")) {
            doc.insertString(doc.getLength(), token, normalStyle);
            continue;
          }
          
          // Special handling for cursor character
          if (token.equals("▊")) {
            doc.insertString(doc.getLength(), token, normalStyle);
            continue;
          }
          
          // Check if it's a string literal
          if ((token.startsWith("\"") && token.endsWith("\"")) || 
              (token.startsWith("'") && token.endsWith("'"))) {
            styleToUse = stringStyle;
          }
          // Check if it's a keyword
          else if (token.matches("\\w+")) {
            for (String keyword : keywords) {
              if (token.equals(keyword)) {
                styleToUse = keywordStyle;
                break;
              }
            }
            
            // Check if it's a type
            if (styleToUse == normalStyle) {
              for (String type : types) {
                if (token.equals(type)) {
                  styleToUse = typeStyle;
                  break;
                }
              }
            }
            
            // Check if it's a number
            if (styleToUse == normalStyle && token.matches("\\d+(\\.\\d+)?[fFdDlL]?")) {
              styleToUse = numberStyle;
            }
          }
          
          doc.insertString(doc.getLength(), token, styleToUse);
        }
        
        // Add the comment part if it exists
        if (commentPartOfLine != null) {
          doc.insertString(doc.getLength(), commentPartOfLine, commentStyle);
        }
      }
    } catch (BadLocationException e) {
      // Fallback: just insert as plain text
      try {
        doc.insertString(0, code, normalStyle);
      } catch (BadLocationException ex) {
        // This shouldn't happen
      }
    }
    
    // Wrap in a scroll pane for horizontal scrolling only
    JScrollPane codeScrollPane = new JScrollPane(codePane) {
      @Override
      protected void processMouseWheelEvent(MouseWheelEvent e) {
        // Only process horizontal scrolling (Shift+scroll wheel)
        if (e.isShiftDown()) {
          // Handle horizontal scrolling internally - don't forward to parent
          super.processMouseWheelEvent(e);
          return; // Important: don't continue to parent forwarding
        }
        
        // For vertical scrolling, forward to parent without processing
        Container parent = getParent();
        while (parent != null && !(parent instanceof JScrollPane)) {
          parent = parent.getParent();
        }
        if (parent instanceof JScrollPane) {
          JScrollPane parentScroll = (JScrollPane) parent;
          // Create a new event targeted at the parent scroll pane
          MouseWheelEvent parentEvent = new MouseWheelEvent(
            parentScroll,
            e.getID(),
            e.getWhen(),
            e.getModifiers(),
            e.getX(),
            e.getY(),
            e.getClickCount(),
            e.isPopupTrigger(),
            e.getScrollType(),
            e.getScrollAmount(),
            e.getWheelRotation()
          );
          parentScroll.dispatchEvent(parentEvent);
        }
      }
    };
    codeScrollPane.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED);
    codeScrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_NEVER); // No vertical scrolling
    codeScrollPane.setBorder(null);
    codeScrollPane.setOpaque(false);
    codeScrollPane.getViewport().setOpaque(false);
    
    // Set scroll increments for smooth horizontal scrolling
    codeScrollPane.getHorizontalScrollBar().setUnitIncrement(16);
    
    // Calculate full height based on number of lines - no height limit
    FontMetrics fm = codePane.getFontMetrics(new Font(mainFont.getFamily(), Font.PLAIN, 13));
    int lineHeight = fm.getHeight();
    String[] lines = code.split("\n");
    int numLines = Math.max(1, lines.length);
    int fullHeight = (numLines * lineHeight) + 24; // Add padding
    
    // Set the scroll pane to show full content height
    codeScrollPane.setPreferredSize(new Dimension(0, fullHeight));
    
    // Wrap in a panel with grey border around white background
    JPanel codeContainer = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Draw grey border with rounded corners
        g2d.setColor(new Color(208, 215, 222));
        g2d.fillRoundRect(0, 0, getWidth(), getHeight(), 12, 12);
        
        // Draw white inner area with rounded corners
        g2d.setColor(Color.WHITE);
        g2d.fillRoundRect(1, 1, getWidth() - 2, getHeight() - 2, 10, 10);
        
        g2d.dispose();
      }
    };
    codeContainer.setBackground(Color.WHITE);
    codeContainer.setBorder(new EmptyBorder(12, 12, 12, 12)); // Add padding to container instead
    codeContainer.add(codeScrollPane, BorderLayout.CENTER);
    
    return codeContainer;
  }
  
  /**
   * Creates a mixed content panel that can contain both HTML text and syntax-highlighted code blocks
   */
  private JComponent _createMixedContentPanel(String message) {
    JPanel contentPanel = new JPanel();
    contentPanel.setLayout(new BoxLayout(contentPanel, BoxLayout.Y_AXIS));
    contentPanel.setOpaque(false);
    contentPanel.setBorder(null); // Remove any default border
    
    // Split message by code blocks
    Pattern codeBlockPattern = Pattern.compile("```(.*?)```", Pattern.DOTALL);
    Matcher matcher = codeBlockPattern.matcher(message);
    
    int lastEnd = 0;
    
    while (matcher.find()) {
      // Add text before code block
      String beforeText = message.substring(lastEnd, matcher.start());
      if (!beforeText.trim().isEmpty()) {
        JEditorPane textPane = new JEditorPane("text/html", _convertMarkdownToHTML(beforeText));
        textPane.setContentType("text/html");
        textPane.setEditable(false);
        textPane.setOpaque(false);
        textPane.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
        textPane.setBorder(new EmptyBorder(0, 0, 8, 0)); // Standard 8px spacing before code blocks
        textPane.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        // Wrap text pane with responsive width constraint to match streaming behavior
        JPanel textWrapper = new JPanel(new BorderLayout()) {
          @Override
          public Dimension getPreferredSize() {
            Dimension pref = super.getPreferredSize();
            int maxWidth = getResponsiveMaxWidth();
            return new Dimension(Math.min(maxWidth, pref.width), pref.height);
          }
          
          @Override
          public Dimension getMaximumSize() {
            Dimension pref = getPreferredSize();
            int maxWidth = getResponsiveMaxWidth();
            return new Dimension(Math.min(maxWidth, pref.width), pref.height);
          }
          
          private int getResponsiveMaxWidth() {
            Container parent = getParent();
            while (parent != null && !(parent instanceof JScrollPane)) {
              parent = parent.getParent();
            }
            if (parent != null) {
              JScrollPane scrollPane = (JScrollPane) parent;
              int availableWidth = scrollPane.getViewport().getWidth();
              if (availableWidth > 100) {
                // Use 95% of available width, with reasonable minimum but no restrictive maximum
                return Math.max(300, (int)(availableWidth * 0.95));
              }
            }
            return 400; // Fallback to fixed width
          }
        };
        textWrapper.setOpaque(false);
        textWrapper.add(textPane, BorderLayout.CENTER);
        textWrapper.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        contentPanel.add(textWrapper);
      }
      
      // Add syntax-highlighted code block
      String codeContent = matcher.group(1).trim();
      
      // Remove language identifier if present (e.g., "java\n" -> "")
      if (codeContent.startsWith("java\n")) {
        codeContent = codeContent.substring(5);
      } else if (codeContent.startsWith("java ")) {
        codeContent = codeContent.substring(5);
      }
      
      JComponent codePane = _createSyntaxHighlightedCodePane(codeContent);
      codePane.setAlignmentX(Component.LEFT_ALIGNMENT);
      contentPanel.add(codePane);
      // Remove box strut - code blocks will handle their own spacing via borders
      
      lastEnd = matcher.end();
    }
    
    // Add remaining text after last code block
    if (lastEnd < message.length()) {
      String remainingText = message.substring(lastEnd);
      if (!remainingText.trim().isEmpty()) {
        JEditorPane textPane = new JEditorPane("text/html", _convertMarkdownToHTML(remainingText));
        textPane.setContentType("text/html");
        textPane.setEditable(false);
        textPane.setOpaque(false);
        textPane.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
        textPane.setBorder(new EmptyBorder(8, 0, 0, 0)); // Standard 8px spacing after code blocks
        textPane.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        // Wrap text pane with responsive width constraint to match streaming behavior
        JPanel textWrapper = new JPanel(new BorderLayout()) {
          @Override
          public Dimension getPreferredSize() {
            Dimension pref = super.getPreferredSize();
            int maxWidth = getResponsiveMaxWidth();
            return new Dimension(Math.min(maxWidth, pref.width), pref.height);
          }
          
          @Override
          public Dimension getMaximumSize() {
            Dimension pref = getPreferredSize();
            int maxWidth = getResponsiveMaxWidth();
            return new Dimension(Math.min(maxWidth, pref.width), pref.height);
          }
          
          private int getResponsiveMaxWidth() {
            Container parent = getParent();
            while (parent != null && !(parent instanceof JScrollPane)) {
              parent = parent.getParent();
            }
            if (parent != null) {
              JScrollPane scrollPane = (JScrollPane) parent;
              int availableWidth = scrollPane.getViewport().getWidth();
              if (availableWidth > 100) {
                // Use 95% of available width, with reasonable minimum but no restrictive maximum
                return Math.max(300, (int)(availableWidth * 0.95));
              }
            }
            return 400; // Fallback to fixed width
          }
        };
        textWrapper.setOpaque(false);
        textWrapper.add(textPane, BorderLayout.CENTER);
        textWrapper.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        contentPanel.add(textWrapper);
      }
    }
    
    return contentPanel;
  }
  
  private void _setUpComponents() {
    // Messages panel with chat-like layout
    _messagesPanel = new JPanel();
    _messagesPanel.setLayout(new BoxLayout(_messagesPanel, BoxLayout.Y_AXIS));
    _messagesPanel.setBackground(CHAT_BACKGROUND);
    _messagesPanel.setBorder(new EmptyBorder(16, 8, 16, 8)); // Reduced side padding from 20 to 8
    
    // Add component listener to automatically scroll when content changes
    _messagesPanel.addComponentListener(new ComponentAdapter() {
      @Override
      public void componentResized(ComponentEvent e) {
        // When messages panel size changes, scroll to bottom
        _scrollToBottom();
      }
    });
    
    // Modern scroll pane
    // Create a wrapper panel to align messages to the top, preventing them from vertically centering in a tall viewport.
    JPanel messagesWrapper = new JPanel(new BorderLayout());
    messagesWrapper.setBackground(CHAT_BACKGROUND);
    messagesWrapper.add(_messagesPanel, BorderLayout.NORTH);
    
    _chatScroll = new JScrollPane(messagesWrapper);
    _chatScroll.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED);
    _chatScroll.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
    _chatScroll.setBorder(null);
    _chatScroll.getViewport().setBackground(CHAT_BACKGROUND);
    _chatScroll.getVerticalScrollBar().setUnitIncrement(16);
    
    // Create embedded input field with send button inside
    _inputField = null; // Will be created in _createEmbeddedInputPanel
    _sendButton = _createSendButton();
  }
  
  private JTextField _createEmbeddedInputField() {
    // Create a completely transparent input field
    JTextField inputField = new JTextField() {
      @Override
      protected void paintComponent(Graphics g) {
        // Don't call super.paintComponent() to avoid any default background painting
        // Only paint the text content
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        
        // Paint text using the UI delegate but without background
        if (getUI() != null) {
          // Temporarily set background to transparent for UI painting
          Color oldBg = getBackground();
          setBackground(new Color(0, 0, 0, 0));
          
          // Let the UI paint text and caret, but not background
          getUI().paint(g2d, this);
          
          // Restore background
          setBackground(oldBg);
        }
        
        g2d.dispose();
      }
      
      @Override
      public boolean isOpaque() {
        return false; // Always return false to prevent background painting
      }
    };
    inputField.setOpaque(false);
    inputField.setBorder(null);
    inputField.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 14));
    inputField.setForeground(TEXT_COLOR);
    inputField.setCaretColor(TEXT_COLOR);
    inputField.setBackground(new Color(0, 0, 0, 0)); // Completely transparent
    
    return inputField;
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
    
    // Create context indicator
    _contextIndicator = _createContextIndicator();
    
    // Create bottom panel that includes context indicator and input
    JPanel bottomPanel = new JPanel(new BorderLayout());
    bottomPanel.setBackground(CHAT_BACKGROUND);
    bottomPanel.add(_contextIndicator, BorderLayout.NORTH);
    bottomPanel.add(inputContainer, BorderLayout.CENTER);
    
    // Chat area
    JPanel chatPanel = new JPanel(new BorderLayout());
    chatPanel.setBackground(CHAT_BACKGROUND);
    chatPanel.setBorder(null);
    chatPanel.add(_chatScroll, BorderLayout.CENTER);
    
    // Main layout
    setLayout(new BorderLayout());
    add(chatPanel, BorderLayout.CENTER);
    add(bottomPanel, BorderLayout.SOUTH);
  }
  
  private JPanel _createEmbeddedInputPanel() {
    // Create a rounded panel with custom rendering
    final JPanel roundedBackground = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Calculate capsule dimensions
        int height = getHeight();
        int width = getWidth();
        int radius = height;
        
        // Paint white background with rounded corners
        g2d.setColor(getBackground());
        g2d.fillRoundRect(0, 0, width, height, radius, radius);
        
        // Paint border
        g2d.setColor(BORDER_COLOR);
        g2d.setStroke(new BasicStroke(1.0f));
        g2d.drawRoundRect(0, 0, width - 1, height - 1, radius, radius);
        
        g2d.dispose();
      }
    };
    roundedBackground.setBackground(INPUT_BACKGROUND);
    roundedBackground.setBorder(new EmptyBorder(0, 16, 0, 50)); // Left padding + right space for button
    
    // Create a completely transparent input field
    JTextField inputField = _createEmbeddedInputField();
    
    // Update the class field reference
    _inputField = inputField;
    
    roundedBackground.add(inputField, BorderLayout.CENTER);
    
    // Create button panel
    final JPanel buttonPanel = new JPanel(null);
    buttonPanel.setOpaque(false);
    buttonPanel.setBackground(new Color(0, 0, 0, 0)); // Completely transparent
    buttonPanel.setPreferredSize(new Dimension(44, 44));
    buttonPanel.add(_sendButton);

    // Use JLayeredPane for proper layering
    final JLayeredPane layeredPane = new JLayeredPane();
    layeredPane.setPreferredSize(new Dimension(0, 44));
    layeredPane.setOpaque(false); // Make sure layered pane is transparent
    layeredPane.setBackground(new Color(0, 0, 0, 0)); // Completely transparent
    
    layeredPane.add(roundedBackground, JLayeredPane.DEFAULT_LAYER);
    layeredPane.add(buttonPanel, JLayeredPane.PALETTE_LAYER);
    
    // Layout manager for JLayeredPane
    layeredPane.addComponentListener(new ComponentAdapter() {
      @Override
      public void componentResized(ComponentEvent e) {
        Component c = e.getComponent();
        int width = c.getWidth();
        int height = c.getHeight();
        
        if (width <= 0 || height <= 0) return;
        
        roundedBackground.setBounds(0, 0, width, height);
        
        int buttonPanelWidth = 44;
        int buttonPanelHeight = 44;
        
        if (width > buttonPanelWidth + 6 && height >= buttonPanelHeight) {
          int x = width - buttonPanelWidth - 3;
          int y = (height - buttonPanelHeight) / 2;
          buttonPanel.setBounds(x, y, buttonPanelWidth, buttonPanelHeight);
          _sendButton.setBounds(6, 6, 32, 32);
        } else {
          buttonPanel.setBounds(-buttonPanelWidth, -buttonPanelHeight, buttonPanelWidth, buttonPanelHeight);
        }
      }
    });
    
    // Container for the input with padding - make sure this is also transparent
    JPanel inputContainer = new JPanel(new BorderLayout());
    inputContainer.setBackground(CHAT_BACKGROUND);
    inputContainer.setBorder(new EmptyBorder(0, 8, 16, 8));
    inputContainer.add(layeredPane, BorderLayout.CENTER);
    
    return inputContainer;
  }
  
  private JPanel _createContextIndicator() {
    JPanel contextPanel = new JPanel(new BorderLayout());
    contextPanel.setBackground(CHAT_BACKGROUND);
    contextPanel.setBorder(new EmptyBorder(4, 16, 4, 16));
    contextPanel.setVisible(false); // Hidden by default
    
    // Create the circular indicator with file info
    JPanel indicatorPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
    indicatorPanel.setBackground(CHAT_BACKGROUND);
    
    // Create rounded pill-shaped indicator
    JPanel pill = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        int height = getHeight();
        int width = getWidth();
        
        // Paint background - using light grey similar to input field
        g2d.setColor(new Color(248, 249, 250)); // Light grey background (matches BACKGROUND_COLOR)
        g2d.fillRoundRect(0, 0, width, height, height, height);
        
        // Paint border - using border color from the design system
        g2d.setColor(BORDER_COLOR); // Grey border color from constants
        g2d.setStroke(new BasicStroke(1.0f));
        g2d.drawRoundRect(0, 0, width - 1, height - 1, height, height);
        
        g2d.dispose();
      }
    };
    pill.setOpaque(false);
    pill.setBorder(new EmptyBorder(4, 10, 4, 4));
    
    _contextLabel = new JLabel();
    _contextLabel.setFont(new Font("Segoe UI", Font.PLAIN, 11));
    _contextLabel.setForeground(SECONDARY_TEXT_COLOR); // Grey text matching secondary text
    _contextLabel.setHorizontalAlignment(JLabel.CENTER); // Center horizontally
    _contextLabel.setVerticalAlignment(JLabel.CENTER); // Center vertically
    
    // Create close button
    _contextCloseButton = new JButton("×") {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Paint circular background on hover
        if (getModel().isRollover()) {
          g2d.setColor(new Color(239, 68, 68, 50)); // Light red on hover
          g2d.fillOval(2, 2, getWidth() - 4, getHeight() - 4);
        }
        
        // Paint text
        g2d.setColor(new Color(107, 114, 128)); // Gray text
        g2d.setFont(getFont());
        FontMetrics fm = g2d.getFontMetrics();
        int x = (getWidth() - fm.stringWidth("×")) / 2;
        int y = ((getHeight() - fm.getHeight()) / 2) + fm.getAscent();
        g2d.drawString("×", x, y);
        
        g2d.dispose();
      }
    };
    _contextCloseButton.setPreferredSize(new Dimension(18, 18));
    _contextCloseButton.setBorder(null);
    _contextCloseButton.setContentAreaFilled(false);
    _contextCloseButton.setFocusPainted(false);
    _contextCloseButton.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
    _contextCloseButton.addActionListener(e -> _hideContextIndicator());
    
    pill.add(_contextLabel, BorderLayout.CENTER);
    pill.add(_contextCloseButton, BorderLayout.EAST);
    
    indicatorPanel.add(pill);
    contextPanel.add(indicatorPanel, BorderLayout.CENTER);
    
    return contextPanel;
  }
  
  private void _setUpEventListeners() {
    ActionListener sendAction = new ActionListener() {
      public void actionPerformed(ActionEvent e) {
        _sendMessage();
      }
    };
    _sendButton.addActionListener(sendAction);
    _inputField.addActionListener(sendAction);
    
    // Ensure input field gets focus when panel is shown
    SwingUtilities.invokeLater(new Runnable() {
      public void run() {
        _inputField.requestFocusInWindow();
      }
    });
  }
  
  private void _addWelcomeMessage() {
    _addAIMessage("Hello! I'm your AI programming assistant.\n\n" +
      "I can help you with:\n" +
      "• Code explanations and debugging\n" +
      "• Java programming questions\n" +
      "• Code generation and suggestions\n" +
      "• Best practices and optimization\n\n" +
      "Type your question below to get started!");
    // Don't add welcome message to conversation history
  }
  
  private void _sendMessage() {
    String inputText = _inputField.getText().trim();
    
    // Store context information if available
    String contextFileName = null;
    int contextStartLine = 0;
    int contextEndLine = 0;
    
    if (_contextIndicator.isVisible() && _contextText != null && !_contextText.trim().isEmpty()) {
      contextFileName = _currentContextFileName;
      contextStartLine = _currentContextStartLine;
      contextEndLine = _currentContextEndLine;
    }
    
    // Hide context indicator after getting the information
    _hideContextIndicator();
    
    // Prepare message for server - combine context and input if context exists
    String messageForServer;
    String messageForDisplay;
    if (contextFileName != null) {
      messageForDisplay = inputText;
      if (inputText.isEmpty()) {
        messageForServer = _contextText;
      } else {
        messageForServer = "Regarding this code:\n" + _contextText + "\n\n" + inputText;
      }
    } else {
      messageForServer = inputText;
      messageForDisplay = inputText;
    }
    
    if (messageForServer.trim().isEmpty()) {
      return;
    }
    
    // Add user message to display with context if available
    if (contextFileName != null) {
      _addUserMessageWithContext(messageForDisplay, contextFileName, contextStartLine, contextEndLine);
    } else {
      _addUserMessage(messageForDisplay);
    }
    
    // Clear input field
    _inputField.setText("");
    
    // Add to conversation history
    _conversationHistory.add(new ChatMessage("user", messageForServer));
    
    // Create streaming panel for AI response
    JPanel streamingMessagePanel = _createStreamingAIMessagePanel();
    _messagesPanel.add(streamingMessagePanel);
    _messagesPanel.add(Box.createVerticalStrut(16));
    _messagesPanel.revalidate();
    _messagesPanel.repaint();
    _scrollToBottom();
    
    // Call MCP server with streaming and full conversation history
    _callMCPServerStreamAsync(_conversationHistory, streamingMessagePanel);
  }
  
  private JPanel _createLoadingMessage() {
    JPanel messagePanel = new JPanel(new BorderLayout()) {
      @Override
      public Dimension getMaximumSize() {
        Dimension pref = getPreferredSize();
        // Allow full width but constrain height to preferred size
        return new Dimension(Integer.MAX_VALUE, pref.height);
      }
    };
    messagePanel.setOpaque(false);
    
    JLabel loadingLabel = new JLabel("Thinking...");
    loadingLabel.setFont(new Font("Segoe UI", Font.ITALIC, 13));
    loadingLabel.setForeground(SECONDARY_TEXT_COLOR);
    loadingLabel.setBorder(new EmptyBorder(8, 0, 8, 0));
    
    messagePanel.add(loadingLabel, BorderLayout.CENTER);
    return messagePanel;
  }
  
  private JPanel _createStreamingAIMessagePanel() {
    JPanel messagePanel = new JPanel(new BorderLayout()) {
      @Override
      public Dimension getMaximumSize() {
        Dimension pref = getPreferredSize();
        // Allow full width but constrain height to preferred size
        return new Dimension(Integer.MAX_VALUE, pref.height);
      }
    };
    messagePanel.setOpaque(false);
    
    // Start with animated typing indicator
    JLabel typingLabel = new JLabel(".");
    typingLabel.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    typingLabel.setForeground(SECONDARY_TEXT_COLOR);
    typingLabel.setBorder(new EmptyBorder(0, 0, 0, 0));
    
    messagePanel.add(typingLabel, BorderLayout.CENTER);
    messagePanel.putClientProperty("isStreaming", true);
    messagePanel.putClientProperty("streamContent", new StringBuilder());
    messagePanel.putClientProperty("typingLabel", typingLabel);
    
    // Start the animation timer
    _startTypingAnimation(typingLabel);
    
    return messagePanel;
  }
  
  /**
   * Starts the animated typing indicator with cycling dots
   */
  private void _startTypingAnimation(JLabel typingLabel) {
    // Create a timer that updates the dots every 500ms
    javax.swing.Timer animationTimer = new javax.swing.Timer(500, null);
    
    // Store the current dot count (1, 2, or 3)
    final int[] dotCount = {1};
    
    animationTimer.addActionListener(e -> {
      // Only animate if the label is still visible and part of a streaming message
      if (typingLabel.isDisplayable() && typingLabel.getParent() != null) {
        Container parent = typingLabel.getParent();
        Boolean isStreaming = (Boolean) ((JComponent) parent).getClientProperty("isStreaming");
        
        if (isStreaming != null && isStreaming) {
          // Update the dots
          String dots;
          switch (dotCount[0]) {
            case 1:
              dots = ".";
              break;
            case 2:
              dots = "..";
              break;
            case 3:
              dots = "...";
              break;
            default:
              dots = ".";
              dotCount[0] = 0; // Will be incremented to 1 below
          }
          
          typingLabel.setText(dots);
          
          // Cycle to next dot count
          dotCount[0] = (dotCount[0] % 3) + 1;
        } else {
          // Stop animation if no longer streaming
          animationTimer.stop();
        }
      } else {
        // Stop animation if component is no longer displayable
        animationTimer.stop();
      }
    });
    
    // Store timer reference so we can stop it later if needed
    typingLabel.putClientProperty("animationTimer", animationTimer);
    
    animationTimer.start();
  }
  
  /**
   * Stops the typing animation for a given label
   */
  private void _stopTypingAnimation(JLabel typingLabel) {
    if (typingLabel != null) {
      javax.swing.Timer timer = (javax.swing.Timer) typingLabel.getClientProperty("animationTimer");
      if (timer != null) {
        timer.stop();
      }
    }
  }
  
  private void _callMCPServerStreamAsync(List<ChatMessage> conversationHistory, JPanel streamingPanel) {
    CompletableFuture.runAsync(() -> {
      try {
        // Create request JSON with conversation history
        StringBuilder messagesJson = new StringBuilder();
        messagesJson.append("[");
        for (int i = 0; i < conversationHistory.size(); i++) {
          ChatMessage msg = conversationHistory.get(i);
          if (i > 0) {
            messagesJson.append(", ");
          }
          messagesJson.append("{\"role\": \"")
                     .append(msg.role)
                     .append("\", \"content\": \"")
                     .append(msg.content.replace("\"", "\\\"").replace("\n", "\\n"))
                     .append("\"}");
        }
        messagesJson.append("]");
        
        String requestJson = "{\"messages\": " + messagesJson.toString() + "}";
        System.out.println("Frontend sending JSON: " + requestJson);
        
        // Build HTTP request for streaming
        HttpURLConnection httpClient = (HttpURLConnection) new URL(MCP_STREAM_URL).openConnection();
        httpClient.setRequestMethod("POST");
        httpClient.setDoOutput(true);
        httpClient.setRequestProperty("Content-Type", "application/json");
        httpClient.setRequestProperty("Accept", "text/event-stream");
        httpClient.setRequestProperty("Cache-Control", "no-cache");
        httpClient.setConnectTimeout(10000); // 10 second connection timeout
        httpClient.setReadTimeout(60000); // 60 second read timeout
        
        try (OutputStreamWriter out = new OutputStreamWriter(httpClient.getOutputStream())) {
          out.write(requestJson);
        }
        
        // Read streaming response
        int responseCode = httpClient.getResponseCode();
        if (responseCode == 200) {
          try (BufferedReader reader = new BufferedReader(new InputStreamReader(httpClient.getInputStream()))) {
            String line;
            StringBuilder fullContent = new StringBuilder();
            long lastUpdateTime = 0;
            long lastDataTime = System.currentTimeMillis();
            final long UPDATE_INTERVAL_MS = 350; // Reduced back to 200ms for better streaming word effect
            final long COMPLETION_TIMEOUT_MS = 5000; // 5 seconds without data = auto-complete
            boolean streamCompleted = false;
            
            while ((line = reader.readLine()) != null) {
              if (line.startsWith("data: ")) {
                String jsonData = line.substring(6); // Remove "data: " prefix
                lastDataTime = System.currentTimeMillis(); // Reset timeout
                
                // Handle special case for connection close
                if (jsonData.trim().equals("[DONE]")) {
                  streamCompleted = true;
                  SwingUtilities.invokeLater(() -> {
                    _updateStreamingMessage(streamingPanel, fullContent.toString(), true);
                  });
                  break;
                }
                
                try {
                  // Simple JSON parsing for chunk
                  String chunk = _extractJsonField(jsonData, "chunk");
                  boolean isDone = _extractJsonField(jsonData, "done") != null && 
                                   _extractJsonField(jsonData, "done").equals("true");
                  
                  if (chunk != null && !chunk.isEmpty()) {
                    fullContent.append(chunk);
                    final String currentContent = fullContent.toString();
                    
                    // Batch updates to reduce jitter
                    long currentTime = System.currentTimeMillis();
                    if (isDone || currentTime - lastUpdateTime >= UPDATE_INTERVAL_MS) {
                      lastUpdateTime = currentTime;
                      SwingUtilities.invokeLater(() -> {
                        _updateStreamingMessage(streamingPanel, currentContent, false);
                      });
                    }
                  }
                  
                  if (isDone) {
                    streamCompleted = true;
                    SwingUtilities.invokeLater(() -> {
                      _updateStreamingMessage(streamingPanel, fullContent.toString(), true);
                    });
                    break;
                  }
                } catch (Exception e) {
                  System.err.println("Error parsing SSE data: " + jsonData);
                  e.printStackTrace();
                }
              }
              
              // Check for timeout - if no data received for too long, auto-complete
              if (System.currentTimeMillis() - lastDataTime > COMPLETION_TIMEOUT_MS) {
                System.err.println("Streaming timeout reached, finalizing message");
                streamCompleted = true;
                SwingUtilities.invokeLater(() -> {
                  _updateStreamingMessage(streamingPanel, fullContent.toString(), true);
                });
                break;
              }
            }
            
            // If we reach here without explicit completion signal, treat as complete
            if (!streamCompleted) {
              System.err.println("Stream ended without completion signal, finalizing message");
              SwingUtilities.invokeLater(() -> {
                _updateStreamingMessage(streamingPanel, fullContent.toString(), true);
              });
            }
          }
        } else {
          SwingUtilities.invokeLater(() -> {
            _updateStreamingMessage(streamingPanel, "Sorry, there was an error connecting to the AI server (HTTP " + responseCode + ").", true);
          });
        }
        
      } catch (Exception e) {
        e.printStackTrace();
        SwingUtilities.invokeLater(() -> {
          _updateStreamingMessage(streamingPanel, "Sorry, I encountered an error: " + e.getMessage() + 
                                   "\n\nMake sure the MCP server is running on localhost:8080.", true);
        });
      }
    });
  }
  
  private void _updateStreamingMessage(JPanel streamingPanel, String content, boolean isComplete) {
    if (streamingPanel == null) return;
    
    // Check if user is currently scrolled near the bottom before updating
    boolean shouldAutoScroll = _isScrolledNearBottom();
    
    // Stop typing animation if this is the first content update
    JLabel typingLabel = (JLabel) streamingPanel.getClientProperty("typingLabel");
    if (typingLabel != null && !content.trim().isEmpty()) {
      _stopTypingAnimation(typingLabel);
      streamingPanel.putClientProperty("typingLabel", null); // Clear reference
    }
    
    // Remove existing content
    streamingPanel.removeAll();
    
    if (isComplete) {
      // Final message - remove any cursor characters and use full AI message panel
      String finalContent = content.replaceAll("▊", ""); // Remove cursor characters
      
      // Add AI response to conversation history when complete
      if (!finalContent.trim().isEmpty()) {
        _conversationHistory.add(new ChatMessage("assistant", finalContent));
      }
      
      boolean hasCodeBlocks = finalContent.contains("```");
      
      if (hasCodeBlocks) {
        JComponent contentComponent = _createMixedContentPanel(finalContent);
        contentComponent.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        JPanel wrapper = new JPanel(new BorderLayout()) {
          @Override
          public Dimension getPreferredSize() {
            Dimension pref = super.getPreferredSize();
            return pref;
          }
          
          @Override
          public Dimension getMaximumSize() {
            return new Dimension(Integer.MAX_VALUE, getPreferredSize().height);
          }
        };
        wrapper.setOpaque(false);
        wrapper.add(contentComponent, BorderLayout.CENTER);
        
        streamingPanel.add(wrapper, BorderLayout.CENTER);
      } else {
        JEditorPane messageText = new JEditorPane("text/html", _convertMarkdownToHTML(finalContent));
        messageText.setContentType("text/html");
        messageText.setEditable(false);
        messageText.setOpaque(false);
        messageText.setBorder(new EmptyBorder(0, 0, 0, 0));
        
        // Don't honor display properties to ensure HTML uses our CSS sizes
        messageText.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
        
        // Wrap in a panel with responsive width constraint to force CSS wrapping
        JPanel textWrapper = new JPanel(new BorderLayout()) {
          @Override
          public Dimension getPreferredSize() {
            Dimension pref = super.getPreferredSize();
            int maxWidth = getResponsiveMaxWidth();
            return new Dimension(Math.min(maxWidth, pref.width), pref.height);
          }
          
          @Override
          public Dimension getMaximumSize() {
            Dimension pref = getPreferredSize();
            int maxWidth = getResponsiveMaxWidth();
            return new Dimension(Math.min(maxWidth, pref.width), pref.height);
          }
          
          private int getResponsiveMaxWidth() {
            Container parent = getParent();
            while (parent != null && !(parent instanceof JScrollPane)) {
              parent = parent.getParent();
            }
            if (parent != null) {
              JScrollPane scrollPane = (JScrollPane) parent;
              int availableWidth = scrollPane.getViewport().getWidth();
              if (availableWidth > 100) {
                // Use 95% of available width, with reasonable minimum but no restrictive maximum
                return Math.max(300, (int)(availableWidth * 0.95));
              }
            }
            return 400; // Fallback to fixed width
          }
        };
        textWrapper.setOpaque(false);
        textWrapper.add(messageText, BorderLayout.CENTER);
        
        streamingPanel.add(textWrapper, BorderLayout.CENTER);
      }
      
      streamingPanel.putClientProperty("isStreaming", false);
    } else {
      // Streaming in progress - check if we have any code blocks (complete or incomplete)
      boolean hasAnyCodeBlocks = content.contains("```");
      
      if (hasAnyCodeBlocks) {
        // We have code blocks - use mixed content panel to show what we have so far
        // This handles both incomplete code blocks and newly completed ones
        JComponent contentComponent = _createStreamingMixedContentPanel(content);
        contentComponent.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        JPanel wrapper = new JPanel(new BorderLayout()) {
          @Override
          public Dimension getPreferredSize() {
            Dimension pref = super.getPreferredSize();
            return pref;
          }
          
          @Override
          public Dimension getMaximumSize() {
            return new Dimension(Integer.MAX_VALUE, getPreferredSize().height);
          }
        };
        wrapper.setOpaque(false);
        wrapper.add(contentComponent, BorderLayout.CENTER);
        
        streamingPanel.add(wrapper, BorderLayout.CENTER);
      } else {
        // No code blocks at all - show as regular streaming text
        JComponent streamingTextComponent = _createStableStreamingTextPane(content + "▊", true); // Enable markdown for streaming text
        streamingTextComponent.setAlignmentX(Component.LEFT_ALIGNMENT);
        
        streamingPanel.add(streamingTextComponent, BorderLayout.CENTER);
      }
    }
    
    streamingPanel.revalidate();
    streamingPanel.repaint();
    
    // Improved autoscroll strategy - only scroll if user was already near bottom
    if (shouldAutoScroll) {
      if (isComplete) {
        // For complete messages, do a proper scroll after layout is complete
        SwingUtilities.invokeLater(() -> {
          _messagesPanel.revalidate();
          _messagesPanel.repaint();
          
          // Second delay to ensure revalidation is complete
          SwingUtilities.invokeLater(() -> {
            _scrollToBottomSmooth();
          });
        });
      } else {
        // For streaming updates, use a gentler approach with less frequent updates
        _scrollToBottomSmooth();
      }
    }
  }
  
  /**
   * Count occurrences of a substring in a string
   */
  private int _countOccurrences(String text, String substring) {
    int count = 0;
    int index = 0;
    while ((index = text.indexOf(substring, index)) != -1) {
      count++;
      index += substring.length();
    }
    return count;
  }
  
  /**
   * Creates a mixed content panel for streaming that handles incomplete code blocks
   */
  private JComponent _createStreamingMixedContentPanel(String message) {
    JPanel contentPanel = new JPanel();
    contentPanel.setLayout(new BoxLayout(contentPanel, BoxLayout.Y_AXIS));
    contentPanel.setOpaque(false);
    contentPanel.setBorder(null);
    
    // First, handle any complete code blocks
    Pattern completeCodeBlockPattern = Pattern.compile("```(.*?)```", Pattern.DOTALL);
    Matcher completeMatcher = completeCodeBlockPattern.matcher(message);
    
    int lastProcessedIndex = 0;
    
    // Process all complete code blocks first
    while (completeMatcher.find()) {
      // Add text before this complete code block
      String beforeText = message.substring(lastProcessedIndex, completeMatcher.start());
      if (!beforeText.trim().isEmpty()) {
        // Remove cursor from completed text sections
        String cleanBeforeText = beforeText.replaceAll("▊", "");
        JComponent textComponent = _createStableStreamingTextPane(cleanBeforeText, true); // Enable markdown for complete text
        textComponent.setAlignmentX(Component.LEFT_ALIGNMENT);
        contentPanel.add(textComponent);
      }
      
      // Add the complete code block with full syntax highlighting
      String codeContent = completeMatcher.group(1).trim();
      if (codeContent.startsWith("java\n")) {
        codeContent = codeContent.substring(5);
      } else if (codeContent.startsWith("java ")) {
        codeContent = codeContent.substring(5);
      }
      
      // Remove cursor from completed code blocks
      codeContent = codeContent.replaceAll("▊", "");
      
      JComponent codePane = _createSyntaxHighlightedCodePane(codeContent);
      codePane.setAlignmentX(Component.LEFT_ALIGNMENT);
      contentPanel.add(codePane);
      // Remove box strut - code blocks will handle their own spacing via borders
      
      lastProcessedIndex = completeMatcher.end();
    }
    
    // Now handle remaining content after the last complete code block
    String remainingContent = message.substring(lastProcessedIndex);
    
    if (!remainingContent.trim().isEmpty()) {
      // Check if there's an incomplete code block in the remaining content
      int incompleteTripleIndex = remainingContent.indexOf("```");
      
      if (incompleteTripleIndex != -1) {
        // There's an incomplete code block
        String textBeforeIncomplete = remainingContent.substring(0, incompleteTripleIndex);
        String incompleteCodeContent = remainingContent.substring(incompleteTripleIndex + 3);
        
        // Add text before the incomplete code block
        if (!textBeforeIncomplete.trim().isEmpty()) {
          // Remove cursor from completed text sections
          String cleanTextBefore = textBeforeIncomplete.replaceAll("▊", "");
          JComponent textComponent = _createStableStreamingTextPane(cleanTextBefore, true); // Enable markdown for complete text
          textComponent.setAlignmentX(Component.LEFT_ALIGNMENT);
          contentPanel.add(textComponent);
        }
        
        // Add the incomplete code block with streaming cursor
        String codeContent = incompleteCodeContent;
        if (codeContent.startsWith("java\n")) {
          codeContent = codeContent.substring(5);
        } else if (codeContent.startsWith("java ")) {
          codeContent = codeContent.substring(5);
        }
        
        JComponent streamingCodePane = _createStreamingSyntaxHighlightedCodePane(codeContent + "▊");
        streamingCodePane.setAlignmentX(Component.LEFT_ALIGNMENT);
        contentPanel.add(streamingCodePane);
      } else {
        // No incomplete code block, just regular text with cursor
        JComponent textComponent = _createStableStreamingTextPane(remainingContent + "▊", true); // Enable markdown for streaming text
        textComponent.setAlignmentX(Component.LEFT_ALIGNMENT);
        contentPanel.add(textComponent);
      }
    }
    
    return contentPanel;
  }
  
  /**
   * Creates a stable text pane for streaming with optional markdown support
   */
  private JComponent _createStableStreamingTextPane(String text, boolean enableMarkdown) {
    if (enableMarkdown) {
      // Use JEditorPane for markdown-enabled text
      JEditorPane editorPane = new JEditorPane("text/html", _convertMarkdownToHTML(text));
      editorPane.setContentType("text/html");
      editorPane.setEditable(false);
      editorPane.setOpaque(false);
      editorPane.setFont(new Font("Segoe UI", Font.PLAIN, 10));
      editorPane.setBorder(new EmptyBorder(0, 0, 8, 0));
      editorPane.setBackground(Color.WHITE);
      
      // Don't honor display properties to ensure HTML uses our CSS sizes
      editorPane.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
      
      // Wrap in a panel with responsive width constraint to force CSS wrapping
      JPanel wrapper = new JPanel(new BorderLayout()) {
        @Override
        public Dimension getPreferredSize() {
          Dimension pref = super.getPreferredSize();
          int maxWidth = getResponsiveMaxWidth();
          return new Dimension(Math.min(maxWidth, pref.width), pref.height);
        }
        
        @Override
        public Dimension getMaximumSize() {
          Dimension pref = getPreferredSize();
          int maxWidth = getResponsiveMaxWidth();
          return new Dimension(Math.min(maxWidth, pref.width), pref.height);
        }
        
        private int getResponsiveMaxWidth() {
          Container parent = getParent();
          while (parent != null && !(parent instanceof JScrollPane)) {
            parent = parent.getParent();
          }
          if (parent != null) {
            JScrollPane scrollPane = (JScrollPane) parent;
            int availableWidth = scrollPane.getViewport().getWidth();
            if (availableWidth > 100) {
              // Use 95% of available width, with reasonable minimum but no restrictive maximum
              return Math.max(300, (int)(availableWidth * 0.95));
            }
          }
          return 400; // Fallback to fixed width
        }
      };
      wrapper.setOpaque(false);
      wrapper.add(editorPane, BorderLayout.CENTER);
      
      return wrapper;
    } else {
      // Use JTextArea for plain text with responsive wrapper for width control
      JTextArea textArea = new JTextArea(text);
      textArea.setEditable(false);
      textArea.setOpaque(false);
      textArea.setFont(new Font("Segoe UI", Font.PLAIN, 10));
      textArea.setBorder(new EmptyBorder(0, 0, 8, 0));
      textArea.setBackground(Color.WHITE);
      textArea.setLineWrap(true);
      textArea.setWrapStyleWord(true);
      
      // Wrap in a panel with responsive width constraint
      JPanel wrapper = new JPanel(new BorderLayout()) {
        @Override
        public Dimension getMaximumSize() {
          Dimension pref = getPreferredSize();
          int maxWidth = getResponsiveMaxWidth();
          return new Dimension(Math.min(maxWidth, pref.width), pref.height);
        }
        
        private int getResponsiveMaxWidth() {
          Container parent = getParent();
          while (parent != null && !(parent instanceof JScrollPane)) {
            parent = parent.getParent();
          }
          if (parent != null) {
            JScrollPane scrollPane = (JScrollPane) parent;
            int availableWidth = scrollPane.getViewport().getWidth();
            if (availableWidth > 100) {
              // Use 95% of available width, with reasonable minimum but no restrictive maximum
              return Math.max(300, (int)(availableWidth * 0.95));
            }
          }
          return 400; // Fallback to fixed width
        }
      };
      wrapper.setOpaque(false);
      wrapper.add(textArea, BorderLayout.CENTER);
      
      return wrapper;
    }
  }
  
  /**
   * Creates a syntax-highlighted code pane for streaming (with cursor)
   */
  private JComponent _createStreamingSyntaxHighlightedCodePane(String code) {
    return _createStreamingSyntaxHighlightedCodePane(code, null);
  }
  
  /**
   * Creates or updates a syntax-highlighted code pane for streaming (with cursor)
   */
  private JComponent _createStreamingSyntaxHighlightedCodePane(String code, JComponent existingComponent) {
    // If we have an existing component, try to update it efficiently
    if (existingComponent != null && existingComponent instanceof JPanel) {
      JPanel container = (JPanel) existingComponent;
      Component[] components = container.getComponents();
      if (components.length > 0 && components[0] instanceof JScrollPane) {
        JScrollPane scrollPane = (JScrollPane) components[0];
        JViewport viewport = scrollPane.getViewport();
        if (viewport.getView() instanceof JTextPane) {
          JTextPane existingPane = (JTextPane) viewport.getView();
          _updateStreamingCodePane(existingPane, code);
          
          // Recalculate height
          Font mainFont = DrJava.getConfig().getSetting(OptionConstants.FONT_MAIN);
          FontMetrics fm = existingPane.getFontMetrics(new Font(mainFont.getFamily(), Font.PLAIN, 13));
          int lineHeight = fm.getHeight();
          String[] lines = code.split("\n");
          int numLines = Math.max(1, lines.length);
          int fullHeight = (numLines * lineHeight) + 24;
          scrollPane.setPreferredSize(new Dimension(0, fullHeight));
          
          container.revalidate();
          container.repaint();
          return container;
        }
      }
    }
    
    // Create new component if we can't update existing one
    // Create JTextPane with syntax highlighting and no word wrapping
    JTextPane codePane = new JTextPane() {
      @Override
      public boolean getScrollableTracksViewportWidth() {
        return false; // Critical: Allow horizontal scrolling
      }
      
      @Override
      public boolean getScrollableTracksViewportHeight() {
        return false; // Allow vertical scrolling when needed
      }
    };
    
    codePane.setEditable(false);
    codePane.setOpaque(true);
    codePane.setBackground(Color.WHITE);
    codePane.setBorder(null); // Remove padding from text area
    
    _updateStreamingCodePane(codePane, code);
    
    // Wrap in a scroll pane for horizontal scrolling only
    JScrollPane codeScrollPane = new JScrollPane(codePane) {
      @Override
      protected void processMouseWheelEvent(MouseWheelEvent e) {
        // Only process horizontal scrolling (Shift+scroll wheel)
        if (e.isShiftDown()) {
          // Handle horizontal scrolling internally - don't forward to parent
          super.processMouseWheelEvent(e);
          return; // Important: don't continue to parent forwarding
        }
        
        // For vertical scrolling, forward to parent without processing
        Container parent = getParent();
        while (parent != null && !(parent instanceof JScrollPane)) {
          parent = parent.getParent();
        }
        if (parent instanceof JScrollPane) {
          JScrollPane parentScroll = (JScrollPane) parent;
          // Create a new event targeted at the parent scroll pane
          MouseWheelEvent parentEvent = new MouseWheelEvent(
            parentScroll,
            e.getID(),
            e.getWhen(),
            e.getModifiers(),
            e.getX(),
            e.getY(),
            e.getClickCount(),
            e.isPopupTrigger(),
            e.getScrollType(),
            e.getScrollAmount(),
            e.getWheelRotation()
          );
          parentScroll.dispatchEvent(parentEvent);
        }
      }
    };
    codeScrollPane.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED);
    codeScrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_NEVER); // No vertical scrolling
    codeScrollPane.setBorder(null);
    codeScrollPane.setOpaque(false);
    codeScrollPane.getViewport().setOpaque(false);
    
    // Set scroll increments for smooth horizontal scrolling
    codeScrollPane.getHorizontalScrollBar().setUnitIncrement(16);
    
    // Calculate full height based on number of lines - no height limit
    Font mainFont = DrJava.getConfig().getSetting(OptionConstants.FONT_MAIN);
    FontMetrics fm = codePane.getFontMetrics(new Font(mainFont.getFamily(), Font.PLAIN, 13));
    int lineHeight = fm.getHeight();
    String[] lines = code.split("\n");
    int numLines = Math.max(1, lines.length);
    int fullHeight = (numLines * lineHeight) + 24; // Add padding
    
    // Set the scroll pane to show full content height
    codeScrollPane.setPreferredSize(new Dimension(0, fullHeight));
    
    // Wrap in a panel with grey border around white background
    JPanel codeContainer = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Draw grey border with rounded corners
        g2d.setColor(new Color(208, 215, 222));
        g2d.fillRoundRect(0, 0, getWidth(), getHeight(), 12, 12);
        
        // Draw white inner area with rounded corners
        g2d.setColor(Color.WHITE);
        g2d.fillRoundRect(1, 1, getWidth() - 2, getHeight() - 2, 10, 10);
        
        g2d.dispose();
      }
    };
    codeContainer.setBackground(Color.WHITE);
    codeContainer.setBorder(new EmptyBorder(12, 12, 12, 12)); // Add padding to container instead
    codeContainer.add(codeScrollPane, BorderLayout.CENTER);
    
    return codeContainer;
  }
  
  /**
   * Updates the content of a streaming code pane with syntax highlighting
   */
  private void _updateStreamingCodePane(JTextPane codePane, String code) {
    StyledDocument doc = codePane.getStyledDocument();
    
    // Clear existing content
    try {
      doc.remove(0, doc.getLength());
    } catch (BadLocationException e) {
      // Continue with empty document
    }
    
    // Define styles based on DrJava's color scheme
    Style defaultStyle = StyleContext.getDefaultStyleContext().getStyle(StyleContext.DEFAULT_STYLE);
    Style normalStyle = doc.addStyle("normal", defaultStyle);
    
    // Use DrJava's main font family but with chat text size (13)
    Font mainFont = DrJava.getConfig().getSetting(OptionConstants.FONT_MAIN);
    StyleConstants.setFontFamily(normalStyle, mainFont.getFamily());
    StyleConstants.setFontSize(normalStyle, 13);
    StyleConstants.setForeground(normalStyle, new Color(51, 51, 51));
    
    Style keywordStyle = doc.addStyle("keyword", normalStyle);
    StyleConstants.setForeground(keywordStyle, new Color(0, 0, 255)); // Blue for keywords
    
    Style typeStyle = doc.addStyle("type", normalStyle);
    StyleConstants.setForeground(typeStyle, new Color(0, 0, 139)); // Dark blue for types
    
    Style stringStyle = doc.addStyle("string", normalStyle);
    StyleConstants.setForeground(stringStyle, new Color(139, 0, 0)); // Dark red for strings
    
    Style commentStyle = doc.addStyle("comment", normalStyle);
    StyleConstants.setForeground(commentStyle, new Color(0, 128, 0)); // Green for comments
    StyleConstants.setItalic(commentStyle, true);
    
    Style numberStyle = doc.addStyle("number", normalStyle);
    StyleConstants.setForeground(numberStyle, new Color(0, 139, 139)); // Cyan for numbers
    
    Style cursorStyle = doc.addStyle("cursor", normalStyle);
    StyleConstants.setForeground(cursorStyle, new Color(51, 51, 51)); // Same as normal text
    
    // Java keywords
    String[] keywords = {
      "abstract", "assert", "break", "case", "catch", "class", "const",
      "continue", "default", "do", "else", "enum", "extends", "final", "finally",
      "for", "goto", "if", "implements", "import", "instanceof", "interface", "native",
      "new", "package", "private", "protected", "public", "return", "static", "strictfp",
      "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void",
      "volatile", "while", "true", "false", "null"
    };
    
    // Java types
    String[] types = {
      "boolean", "byte", "char", "double", "float", "int", "long", "short",
      "String", "Object", "Integer", "Boolean", "Character", "Double", "Float", "Long", "Short",
      "BigInteger", "BigDecimal", "StringBuilder", "StringBuffer", "ArrayList", "HashMap", "List",
      "Map", "Set", "Collection", "Iterator", "Exception", "RuntimeException", "Thread", "System"
    };
    
    try {
      String[] lines = code.split("\n");
      for (int i = 0; i < lines.length; i++) {
        String line = lines[i];
        if (i > 0) {
          doc.insertString(doc.getLength(), "\n", normalStyle);
        }
        
        // Check for comments first - handle both line comments and inline comments
        if (line.trim().startsWith("//")) {
          doc.insertString(doc.getLength(), line, commentStyle);
          continue;
        }
        
        if (line.trim().startsWith("/*") || line.trim().startsWith("*")) {
          doc.insertString(doc.getLength(), line, commentStyle);
          continue;
        }
        
        // Check for inline comments - split line at "//" if present
        int commentIndex = line.indexOf("//");
        String codePartOfLine = (commentIndex != -1) ? line.substring(0, commentIndex) : line;
        String commentPartOfLine = (commentIndex != -1) ? line.substring(commentIndex) : null;
        
        // Tokenize and highlight the code part
        Pattern tokenPattern = Pattern.compile("(\"[^\"]*\"|'[^']*'|\\w+|\\s+|[^\\w\\s])");
        Matcher tokenMatcher = tokenPattern.matcher(codePartOfLine);
        
        while (tokenMatcher.find()) {
          String token = tokenMatcher.group();
          Style styleToUse = normalStyle;
          
          if (token.matches("\\s+")) {
            doc.insertString(doc.getLength(), token, normalStyle);
            continue;
          }
          
          // Special handling for cursor character
          if (token.equals("▊")) {
            doc.insertString(doc.getLength(), token, normalStyle);
            continue;
          }
          
          // Check if it's a string literal
          if ((token.startsWith("\"") && token.endsWith("\"")) || 
              (token.startsWith("'") && token.endsWith("'"))) {
            styleToUse = stringStyle;
          }
          // Check if it's a keyword
          else if (token.matches("\\w+")) {
            for (String keyword : keywords) {
              if (token.equals(keyword)) {
                styleToUse = keywordStyle;
                break;
              }
            }
            
            // Check if it's a type
            if (styleToUse == normalStyle) {
              for (String type : types) {
                if (token.equals(type)) {
                  styleToUse = typeStyle;
                  break;
                }
              }
            }
            
            // Check if it's a number
            if (styleToUse == normalStyle && token.matches("\\d+(\\.\\d+)?[fFdDlL]?")) {
              styleToUse = numberStyle;
            }
          }
          
          doc.insertString(doc.getLength(), token, styleToUse);
        }
        
        // Add the comment part if it exists
        if (commentPartOfLine != null) {
          doc.insertString(doc.getLength(), commentPartOfLine, commentStyle);
        }
      }
    } catch (BadLocationException e) {
      // Fallback: just insert as plain text
      try {
        doc.insertString(0, code, normalStyle);
      } catch (BadLocationException ex) {
        // This shouldn't happen
      }
    }
  }
  
  private void _addUserMessage(String message) {
    JPanel messagePanel = _createUserMessagePanel(message);
    _messagesPanel.add(messagePanel);
    _messagesPanel.add(Box.createVerticalStrut(16));
    _messagesPanel.revalidate();
    _messagesPanel.repaint();
  }
  
  private void _addUserMessageWithContext(String message, String fileName, int startLine, int endLine) {
    // Add context bubble if context info is provided
    if (fileName != null) {
      JPanel contextBubble = _createChatContextBubble(fileName, startLine, endLine);
      _messagesPanel.add(contextBubble);
      _messagesPanel.add(Box.createVerticalStrut(8)); // Smaller gap between context and message
    }
    
    // Add user message (can be empty if only context was sent)
    if (message != null && !message.trim().isEmpty()) {
      JPanel messagePanel = _createUserMessagePanel(message);
      _messagesPanel.add(messagePanel);
    }
    
    _messagesPanel.add(Box.createVerticalStrut(16));
    _messagesPanel.revalidate();
    _messagesPanel.repaint();
  }
  
  private JPanel _createChatContextBubble(String fileName, int startLine, int endLine) {
    JPanel contextPanel = new JPanel(new BorderLayout());
    contextPanel.setOpaque(false);
    
    // Create the circular indicator with file info (same style as input context indicator)
    JPanel indicatorPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
    indicatorPanel.setBackground(CHAT_BACKGROUND);
    
    // Create rounded pill-shaped indicator
    JPanel pill = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        int height = getHeight();
        int width = getWidth();
        
        // Paint background - using light grey similar to input field
        g2d.setColor(new Color(248, 249, 250)); // Light grey background (matches BACKGROUND_COLOR)
        g2d.fillRoundRect(0, 0, width, height, height, height);
        
        // Paint border - using border color from the design system
        g2d.setColor(BORDER_COLOR); // Grey border color from constants
        g2d.setStroke(new BasicStroke(1.0f));
        g2d.drawRoundRect(0, 0, width - 1, height - 1, height, height);
        
        g2d.dispose();
      }
    };
    pill.setOpaque(false);
    pill.setBorder(new EmptyBorder(4, 8, 4, 8)); // Smaller padding for chat context
    
    // Create context label with file info
    String contextInfo;
    if (startLine == endLine) {
      contextInfo = fileName + " (line " + startLine + ")";
    } else {
      contextInfo = fileName + " (" + startLine + "-" + endLine + ")";
    }
    
    JLabel contextLabel = new JLabel(contextInfo);
    contextLabel.setFont(new Font("Segoe UI", Font.PLAIN, 11)); // Slightly smaller font for chat
    contextLabel.setForeground(SECONDARY_TEXT_COLOR);
    contextLabel.setHorizontalAlignment(JLabel.CENTER);
    contextLabel.setVerticalAlignment(JLabel.CENTER);
    
    pill.add(contextLabel, BorderLayout.CENTER);
    indicatorPanel.add(pill);
    contextPanel.add(indicatorPanel, BorderLayout.CENTER);
    
    return contextPanel;
  }
  
  private void _addAIMessage(String message) {
    JPanel messagePanel = _createAIMessagePanel(message);
    _messagesPanel.add(messagePanel);
    _messagesPanel.add(Box.createVerticalStrut(16));
    _messagesPanel.revalidate();
    _messagesPanel.repaint();
  }
  
  private JPanel _createUserMessagePanel(String message) {
    JPanel messagePanel = new JPanel(new BorderLayout()) {
      @Override
      public Dimension getMaximumSize() {
        Dimension pref = getPreferredSize();
        // Allow full width but constrain height to preferred size
        return new Dimension(Integer.MAX_VALUE, pref.height);
      }
    };
    messagePanel.setOpaque(false);
    
    // Create rounded chat bubble for user message
    JPanel bubblePanel = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Paint rounded background with proper anti-aliasing
        g2d.setColor(getBackground());
        g2d.fillRoundRect(0, 0, getWidth(), getHeight(), 12, 12);
        
        // Paint border
        g2d.setColor(BORDER_COLOR);
        g2d.setStroke(new BasicStroke(1.0f));
        g2d.drawRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 12, 12);
        
        g2d.dispose();
      }
      
      @Override
      public Dimension getPreferredSize() {
        Dimension pref = super.getPreferredSize();
        // Limit to 98% of parent width for user messages (nearly full width for maximum text alignment)
        Container parent = getParent();
        if (parent != null) {
          int parentWidth = parent.getWidth();
          if (parentWidth > 100) {
            int maxWidth = parentWidth * 98 / 100;
            if (pref.width > maxWidth) {
              pref.width = maxWidth;
            }
          } else {
            // During initial layout or when parent is too small, use a reasonable default
            int maxWidth = Math.max(150, pref.width);
            pref.width = Math.min(pref.width, maxWidth);
          }
        }
        return pref;
      }
      
      @Override
      public Dimension getMaximumSize() {
        return getPreferredSize();
      }
    };
    bubblePanel.setBackground(USER_BUBBLE_COLOR);
    bubblePanel.setBorder(new EmptyBorder(8, 8, 8, 12)); // Reduced left padding for better text alignment
    
    // Message text inside the bubble
    JTextArea messageText = new JTextArea(message);
    messageText.setEditable(false);
    messageText.setOpaque(false);
    messageText.setBackground(new Color(0, 0, 0, 0)); // Fully transparent
    messageText.setFont(new Font("Segoe UI", Font.PLAIN, 13));
    messageText.setForeground(USER_TEXT_COLOR);
    messageText.setLineWrap(true);
    messageText.setWrapStyleWord(true);
    messageText.setBorder(null);
    
    bubblePanel.add(messageText, BorderLayout.CENTER);
    
    messagePanel.add(bubblePanel, BorderLayout.CENTER);
    
    return messagePanel;
  }
  
  private JPanel _createAIMessagePanel(String message) {
    JPanel messagePanel = new JPanel(new BorderLayout()) {
      @Override
      public Dimension getMaximumSize() {
        Dimension pref = getPreferredSize();
        // Allow full width but constrain height to preferred size
        return new Dimension(Integer.MAX_VALUE, pref.height);
      }
    };
    messagePanel.setOpaque(false);
    
    // Check if message contains code blocks
    boolean hasCodeBlocks = message.contains("```");
    
    if (hasCodeBlocks) {
      // Use mixed content panel with syntax highlighting
      JComponent contentComponent = _createMixedContentPanel(message);
      contentComponent.setAlignmentX(Component.LEFT_ALIGNMENT);
      
      // Simple wrapper without size constraints to avoid jitter
      JPanel wrapper = new JPanel(new BorderLayout());
      wrapper.setOpaque(false);
      wrapper.add(contentComponent, BorderLayout.CENTER);
      
      messagePanel.add(wrapper, BorderLayout.CENTER);
    } else {
      // Use simple HTML for text-only messages
      JEditorPane messageText = new JEditorPane("text/html", _convertMarkdownToHTML(message));
      messageText.setContentType("text/html");
      messageText.setEditable(false);
      messageText.setOpaque(false);
      messageText.setBorder(new EmptyBorder(0, 0, 0, 0));
      
      // Don't honor display properties to ensure HTML uses our CSS sizes
      messageText.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
      
      // Wrap in a panel with responsive width constraint to force CSS wrapping
      JPanel textWrapper = new JPanel(new BorderLayout()) {
        @Override
        public Dimension getPreferredSize() {
          Dimension pref = super.getPreferredSize();
          int maxWidth = getResponsiveMaxWidth();
          return new Dimension(Math.min(maxWidth, pref.width), pref.height);
        }
        
        @Override
        public Dimension getMaximumSize() {
          Dimension pref = getPreferredSize();
          int maxWidth = getResponsiveMaxWidth();
          return new Dimension(Math.min(maxWidth, pref.width), pref.height);
        }
        
        private int getResponsiveMaxWidth() {
          Container parent = getParent();
          while (parent != null && !(parent instanceof JScrollPane)) {
            parent = parent.getParent();
          }
          if (parent != null) {
            JScrollPane scrollPane = (JScrollPane) parent;
            int availableWidth = scrollPane.getViewport().getWidth();
            if (availableWidth > 100) {
              // Use 95% of available width, with reasonable minimum but no restrictive maximum
              return Math.max(300, (int)(availableWidth * 0.95));
            }
          }
          return 400; // Fallback to fixed width
        }
      };
      textWrapper.setOpaque(false);
      textWrapper.add(messageText, BorderLayout.CENTER);
      
      messagePanel.add(textWrapper, BorderLayout.CENTER);
    }
    
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
    Dimension maxSize = new Dimension(150, Integer.MAX_VALUE);
    bubble.setMaximumSize(maxSize);
    bubble.setPreferredSize(new Dimension(Math.min(150, bubble.getPreferredSize().width), bubble.getPreferredSize().height));
    
    return bubble;
  }
  
  private void _scrollToBottom() {
    SwingUtilities.invokeLater(new Runnable() {
      public void run() {
        JScrollBar verticalBar = _chatScroll.getVerticalScrollBar();
        
        // Ensure we have the latest maximum value
        int maxValue = verticalBar.getMaximum() - verticalBar.getVisibleAmount();
        
        // Use smooth scrolling by setting value directly
        verticalBar.setValue(maxValue);
        
        // Also ensure the viewport is properly positioned
        _chatScroll.getViewport().revalidate();
      }
    });
  }
  
  /**
   * Check if the user is currently scrolled near the bottom of the chat
   */
  private boolean _isScrolledNearBottom() {
    JScrollBar verticalBar = _chatScroll.getVerticalScrollBar();
    int maxValue = verticalBar.getMaximum() - verticalBar.getVisibleAmount();
    int currentValue = verticalBar.getValue();
    
    // Consider "near bottom" if within 50 pixels of the bottom
    // This gives users some leeway while still auto-scrolling when they're following the conversation
    return (maxValue - currentValue) <= 150;
  }
  
  /**
   * Smooth scroll to bottom with reduced jitter
   */
  private void _scrollToBottomSmooth() {
    SwingUtilities.invokeLater(new Runnable() {
      public void run() {
        JScrollBar verticalBar = _chatScroll.getVerticalScrollBar();
        int maxValue = verticalBar.getMaximum() - verticalBar.getVisibleAmount();
        int currentValue = verticalBar.getValue();
        
        // Only scroll if we're not already at the bottom (reduces unnecessary updates)
        if (currentValue < maxValue) {
          verticalBar.setValue(maxValue);
        }
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
    _conversationHistory.clear(); // Clear conversation history when chat is cleared
    _addWelcomeMessage();
    _messagesPanel.revalidate();
    _messagesPanel.repaint();
  }
  
  /**
   * Simple JSON field extractor - extracts value of a field from JSON string
   */
  private String _extractJsonField(String json, String fieldName) {
    try {
      String searchPattern = "\"" + fieldName + "\":";
      int startIndex = json.indexOf(searchPattern);
      if (startIndex == -1) {
        return null;
      }
      
      startIndex += searchPattern.length();
      
      // Skip whitespace
      while (startIndex < json.length() && Character.isWhitespace(json.charAt(startIndex))) {
        startIndex++;
      }
      
      if (startIndex >= json.length() || json.charAt(startIndex) != '"') {
        return null;
      }
      
      startIndex++; // Skip opening quote
      
      StringBuilder result = new StringBuilder();
      for (int i = startIndex; i < json.length(); i++) {
        char ch = json.charAt(i);
        if (ch == '"' && (i == startIndex || json.charAt(i-1) != '\\')) {
          String rawValue = result.toString();
          String decodedValue = _decodeJsonString(rawValue);
          return decodedValue;
        }
        result.append(ch);
      }
      
      return null;
    } catch (Exception e) {
      return null;
    }
  }
  
  /**
   * Decode JSON string escapes including Unicode escapes
   */
  private String _decodeJsonString(String jsonString) {
    if (jsonString == null) return null;
    
    StringBuilder result = new StringBuilder();
    int i = 0;
    while (i < jsonString.length()) {
      char c = jsonString.charAt(i);
      if (c == '\\' && i + 1 < jsonString.length()) {
        char next = jsonString.charAt(i + 1);
        switch (next) {
          case '"':
            result.append('"');
            i += 2;
            break;
          case '\\':
            result.append('\\');
            i += 2;
            break;
          case '/':
            result.append('/');
            i += 2;
            break;
          case 'b':
            result.append('\b');
            i += 2;
            break;
          case 'f':
            result.append('\f');
            i += 2;
            break;
          case 'n':
            result.append('\n');
            i += 2;
            break;
          case 'r':
            result.append('\r');
            i += 2;
            break;
          case 't':
            result.append('\t');
            i += 2;
            break;
          case 'u':
            // Unicode escape sequence like u0027
            if (i + 5 < jsonString.length()) {
              try {
                String hexCode = jsonString.substring(i + 2, i + 6);
                int codePoint = Integer.parseInt(hexCode, 16);
                result.append((char) codePoint);
                i += 6;
              } catch (NumberFormatException e) {
                // Invalid unicode escape, just append as is
                result.append(c);
                i++;
              }
            } else {
              result.append(c);
              i++;
            }
            break;
          default:
            result.append(c);
            i++;
            break;
        }
      } else {
        result.append(c);
        i++;
      }
    }
    return result.toString();
  }

  /**
   * Send a message to the chat programmatically
   * @param message The message to send
   */
  public void sendMessage(String message) {
    if (message != null && !message.trim().isEmpty()) {
      _inputField.setText(message.trim());
      _sendMessage();
    }
  }
  
  // New method to send message with file context
  public void sendMessageWithContext(String message, String fileName, int startLine, int endLine) {
    // Store context info for the message
    _currentContextFileName = fileName;
    _currentContextStartLine = startLine;
    _currentContextEndLine = endLine;
    _contextText = message; // Store the selected text as context
    
    _showContextIndicator(fileName, startLine, endLine);
    // Don't put the selected text in the input field - user can add their own question
    requestFocusInWindow();
  }
  
  private void _showContextIndicator(String fileName, int startLine, int endLine) {
    String contextInfo;
    if (startLine == endLine) {
      contextInfo = fileName + " (line " + startLine + ")";
    } else {
      contextInfo = fileName + " (" + startLine + "-" + endLine + ")";
    }
    _contextLabel.setText(contextInfo);
    _contextIndicator.setVisible(true);
    _contextVisible = true;
    revalidate();
    repaint();
  }
  
  private void _hideContextIndicator() {
    _contextIndicator.setVisible(false);
    _contextVisible = false;
    _contextText = null;
    revalidate();
    repaint();
  }
} 