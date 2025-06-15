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
  
  // Color for the custom send button
  private Color _sendButtonColor = new Color(148, 163, 184); // Light blue-grey
  
  // HTTP client for MCP server communication
  private static final String MCP_SERVER_URL = "http://localhost:8080/chat";
  private static final String MCP_STREAM_URL = "http://localhost:8080/chat/stream";
  
  public AIChatPanel() {
    super(new BorderLayout());
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
    if (markdown == null || markdown.trim().isEmpty()) {
      return "";
    }
    
    String html = markdown;
    
    // Don't process code blocks here - they should be handled by _createMixedContentPanel
    // Convert headers (### ## #)
    html = html.replaceAll("(?m)^### (.+)$", "<h3>$1</h3>");
    html = html.replaceAll("(?m)^## (.+)$", "<h2>$1</h2>");
    html = html.replaceAll("(?m)^# (.+)$", "<h1>$1</h1>");
    
    // Convert inline code (`...`) only
    Pattern inlineCodePattern = Pattern.compile("`([^`]+)`");
    Matcher inlineCodeMatcher = inlineCodePattern.matcher(html);
    html = inlineCodeMatcher.replaceAll("<code style='background-color: #f6f8fa; padding: 1px 3px; border-radius: 2px; font-family: Consolas, Monaco, monospace; font-size: 12px;'>$1</code>");
    
    // Convert bold (**text**)
    Pattern boldPattern = Pattern.compile("\\*\\*([^*]+)\\*\\*");
    Matcher boldMatcher = boldPattern.matcher(html);
    html = boldMatcher.replaceAll("<strong>$1</strong>");
    
    // Convert italic (*text*)
    Pattern italicPattern = Pattern.compile("\\*([^*]+)\\*");
    Matcher italicMatcher = italicPattern.matcher(html);
    html = italicMatcher.replaceAll("<em>$1</em>");
    
    // Convert bullet points (• or - at start of line)
    html = html.replaceAll("(?m)^[•-]\\s+(.*)$", "<li>$1</li>");
    
    // Convert numbered lists (1. 2. etc)
    html = html.replaceAll("(?m)^\\d+\\.\\s+(.*)$", "<li>$1</li>");
    
    // Wrap consecutive <li> elements in <ul>
    html = html.replaceAll("(<li>.*?</li>)(?:\\s*<li>.*?</li>)*", "<ul>$0</ul>");
    
    // Convert line breaks but preserve paragraph breaks
    html = html.replaceAll("\\n\\n", "<br><br>");
    html = html.replaceAll("\\n", "<br>");
    
    // Wrap in basic HTML structure with NO margins - let component borders handle all spacing
    return "<html><head><style>" +
           "body { font-family: 'Segoe UI', sans-serif; font-size: 11px; line-height: 1.4; margin: 0; padding: 0; }" +
           "h1 { font-size: 14px; font-weight: bold; margin: 0; padding: 0; color: #1f2328; }" +
           "h2 { font-size: 13px; font-weight: bold; margin: 0; padding: 0; color: #1f2328; }" +
           "h3 { font-size: 12px; font-weight: bold; margin: 0; padding: 0; color: #1f2328; }" +
           "code { background-color: #f6f8fa; padding: 1px 3px; border-radius: 2px; font-family: Consolas, Monaco, monospace; font-size: 11px; }" +
           "pre { background-color: #f6f8fa; padding: 6px; border-radius: 3px; font-family: Consolas, Monaco, monospace; font-size: 11px; margin: 0; overflow-x: auto; line-height: 1.3; }" +
           "ul { margin: 0; padding-left: 18px; }" +
           "li { margin: 1px 0; }" +
           "p { margin: 0; padding: 0; }" +
           "strong { font-weight: bold; }" +
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
        
        // Check for comments first
        if (line.trim().startsWith("//")) {
          doc.insertString(doc.getLength(), line, commentStyle);
          continue;
        }
        
        if (line.trim().startsWith("/*") || line.trim().startsWith("*")) {
          doc.insertString(doc.getLength(), line, commentStyle);
          continue;
        }
        
        // Tokenize and highlight
        Pattern tokenPattern = Pattern.compile("(\"[^\"]*\"|'[^']*'|\\w+|\\s+|[^\\w\\s])");
        Matcher tokenMatcher = tokenPattern.matcher(line);
        
        while (tokenMatcher.find()) {
          String token = tokenMatcher.group();
          Style styleToUse = normalStyle;
          
          if (token.matches("\\s+")) {
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
        contentPanel.add(textPane);
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
        contentPanel.add(textPane);
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
    inputField.addActionListener(e -> _sendMessage());
    
    // Add key listener to the new input field
    inputField.addKeyListener(new KeyListener() {
      public void keyPressed(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_ENTER) {
          _sendMessage();
        }
      }
      public void keyReleased(KeyEvent e) {
        inputField.repaint();
      }
      public void keyTyped(KeyEvent e) {
        SwingUtilities.invokeLater(() -> inputField.repaint());
      }
    });
    
    // Update the class field reference
    _inputField = inputField;
    
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
    JTextField inputField = new JTextField();
    inputField.setOpaque(false);
    inputField.setBorder(null);
    inputField.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 14));
    inputField.setForeground(TEXT_COLOR);
    inputField.setCaretColor(TEXT_COLOR);
    inputField.setBackground(new Color(0, 0, 0, 0)); // Completely transparent
    inputField.addActionListener(e -> _sendMessage());
    
    // Add key listener to the input field
    inputField.addKeyListener(new KeyListener() {
      public void keyPressed(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_ENTER) {
          _sendMessage();
        }
      }
      public void keyReleased(KeyEvent e) {
        inputField.repaint();
      }
      public void keyTyped(KeyEvent e) {
        SwingUtilities.invokeLater(() -> inputField.repaint());
      }
    });
    
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
    _addAIMessage("Hello! I'm your AI programming assistant.\n\n" +
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
      _inputField.setText("");
      
      // Create an AI message panel that will be updated as text streams in
      JPanel streamingMessagePanel = _createStreamingAIMessagePanel();
      _messagesPanel.add(streamingMessagePanel);
      _messagesPanel.add(Box.createVerticalStrut(16));
      _messagesPanel.revalidate();
      _messagesPanel.repaint();
      _scrollToBottom();
      
      // Call MCP server with streaming
      _callMCPServerStreamAsync(message, streamingMessagePanel);
    }
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
    
    // Start with typing indicator
    JLabel typingLabel = new JLabel("Thinking...");
    typingLabel.setFont(new Font("Segoe UI", Font.ITALIC, 13));
    typingLabel.setForeground(SECONDARY_TEXT_COLOR);
    typingLabel.setBorder(new EmptyBorder(0, 0, 0, 0));
    
    messagePanel.add(typingLabel, BorderLayout.CENTER);
    messagePanel.putClientProperty("isStreaming", true);
    messagePanel.putClientProperty("streamContent", new StringBuilder());
    
    return messagePanel;
  }
  
  private void _callMCPServerStreamAsync(String message, JPanel streamingPanel) {
    CompletableFuture.runAsync(() -> {
      try {
        // Create request JSON
        String escapedMessage = message.replace("\"", "\\\"").replace("\n", "\\n");
        String requestJson = "{\"message\": \"" + escapedMessage + "\"}";
        
        // Build HTTP request for streaming
        HttpURLConnection httpClient = (HttpURLConnection) new URL(MCP_STREAM_URL).openConnection();
        httpClient.setRequestMethod("POST");
        httpClient.setDoOutput(true);
        httpClient.setRequestProperty("Content-Type", "application/json");
        httpClient.setRequestProperty("Accept", "text/event-stream");
        httpClient.setRequestProperty("Cache-Control", "no-cache");
        
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
            final long UPDATE_INTERVAL_MS = 150; // Increased from 100ms to 150ms to reduce jitter
            
            while ((line = reader.readLine()) != null) {
              if (line.startsWith("data: ")) {
                String jsonData = line.substring(6); // Remove "data: " prefix
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
    
    // Remove existing content
    streamingPanel.removeAll();
    
    if (isComplete) {
      // Final message - use full AI message panel
      boolean hasCodeBlocks = content.contains("```");
      
      if (hasCodeBlocks) {
        JComponent contentComponent = _createMixedContentPanel(content);
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
        JEditorPane messageText = new JEditorPane("text/html", _convertMarkdownToHTML(content));
        messageText.setContentType("text/html");
        messageText.setEditable(false);
        messageText.setOpaque(false);
        messageText.setBorder(new EmptyBorder(0, 0, 0, 0));
        
        // Don't honor display properties to ensure HTML uses our CSS sizes
        messageText.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
        
        streamingPanel.add(messageText, BorderLayout.CENTER);
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
    
    // Improved autoscroll strategy
    if (isComplete) {
      // For complete messages, do a proper scroll after a brief delay to ensure layout is complete
      SwingUtilities.invokeLater(() -> {
        _messagesPanel.revalidate();
        _messagesPanel.repaint();
        
        // Second delay to ensure revalidation is complete
        SwingUtilities.invokeLater(() -> {
          _scrollToBottom();
        });
      });
    } else {
      // For streaming updates, use a gentler approach that checks if we're already at bottom
      SwingUtilities.invokeLater(() -> {
        JScrollBar verticalBar = _chatScroll.getVerticalScrollBar();
        int maxValue = verticalBar.getMaximum() - verticalBar.getVisibleAmount();
        int currentValue = verticalBar.getValue();
        
        // Only scroll if we're within a reasonable distance of the bottom (within 50 pixels)
        // This prevents aggressive scrolling when user has scrolled up intentionally
        if (maxValue - currentValue <= 50) {
          verticalBar.setValue(maxValue);
        }
      });
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
        JComponent textComponent = _createStableStreamingTextPane(beforeText, true); // Enable markdown for complete text
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
          JComponent textComponent = _createStableStreamingTextPane(textBeforeIncomplete, true); // Enable markdown for complete text
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
      JEditorPane textPane = new JEditorPane("text/html", _convertMarkdownToHTML(text));
      textPane.setEditable(false);
      textPane.setOpaque(false);
      textPane.setBorder(new EmptyBorder(0, 0, 8, 0)); // Consistent 8px bottom spacing
      textPane.setFont(new Font("Segoe UI", Font.PLAIN, 11)); // Match HTML font size
      textPane.setBackground(Color.WHITE);
      
      // Use consistent sizing approach - let the component calculate its own preferred size
      textPane.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
      
      return textPane;
    } else {
      // Use JEditorPane with simple HTML instead of JTextArea for consistent rendering
      String simpleHtml = "<html><head><style>" +
                         "body { font-family: 'Segoe UI', sans-serif; font-size: 11px; line-height: 1.4; margin: 0; padding: 0; word-wrap: break-word; white-space: normal; }" +
                         "</style></head><body>" + 
                         text.replace("\n", "<br>").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") + 
                         "</body></html>";
      
      JEditorPane textPane = new JEditorPane("text/html", simpleHtml) {
        @Override
        public Dimension getPreferredSize() {
          // Force the JEditorPane to calculate size based on available width
          Dimension pref = super.getPreferredSize();
          Container parent = getParent();
          if (parent != null && parent.getWidth() > 0) {
            // Use parent width minus some padding for wrapping calculation
            int availableWidth = parent.getWidth() - 20; // Account for padding
            if (availableWidth > 100) { // Minimum reasonable width
              // Set a temporary size to force text wrapping calculation
              setSize(availableWidth, Integer.MAX_VALUE);
              pref = super.getPreferredSize();
              pref.width = availableWidth;
            }
          }
          return pref;
        }
      };
      textPane.setEditable(false);
      textPane.setOpaque(false);
      textPane.setBorder(new EmptyBorder(0, 0, 8, 0)); // Consistent 8px bottom spacing
      textPane.setBackground(Color.WHITE);
      
      // Use consistent sizing approach - let the component calculate its own preferred size
      textPane.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
      
      return textPane;
    }
  }
  
  /**
   * Creates a syntax-highlighted code pane for streaming (with cursor)
   */
  private JComponent _createStreamingSyntaxHighlightedCodePane(String code) {
    // This is similar to _createSyntaxHighlightedCodePane but optimized for streaming
    JTextPane codePane = new JTextPane() {
      @Override
      public boolean getScrollableTracksViewportWidth() {
        return false;
      }
      
      @Override
      public boolean getScrollableTracksViewportHeight() {
        return false;
      }
    };
    
    codePane.setEditable(false);
    codePane.setOpaque(true);
    codePane.setBackground(Color.WHITE);
    codePane.setBorder(null);
    
    StyledDocument doc = codePane.getStyledDocument();
    
    // Define styles
    Style defaultStyle = StyleContext.getDefaultStyleContext().getStyle(StyleContext.DEFAULT_STYLE);
    Style normalStyle = doc.addStyle("normal", defaultStyle);
    
    Font mainFont = DrJava.getConfig().getSetting(OptionConstants.FONT_MAIN);
    StyleConstants.setFontFamily(normalStyle, mainFont.getFamily());
    StyleConstants.setFontSize(normalStyle, 13);
    StyleConstants.setForeground(normalStyle, new Color(51, 51, 51));
    
    // For streaming, just use normal style to avoid complex highlighting that might be slow
    try {
      doc.insertString(0, code, normalStyle);
    } catch (BadLocationException e) {
      // Fallback
    }
    
    // Wrap in scroll pane
    JScrollPane codeScrollPane = new JScrollPane(codePane);
    codeScrollPane.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED);
    codeScrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_NEVER);
    codeScrollPane.setBorder(null);
    codeScrollPane.setOpaque(false);
    codeScrollPane.getViewport().setOpaque(false);
    
    // Calculate height
    FontMetrics fm = codePane.getFontMetrics(new Font(mainFont.getFamily(), Font.PLAIN, 13));
    int lineHeight = fm.getHeight();
    String[] lines = code.split("\n");
    int numLines = Math.max(1, lines.length);
    int fullHeight = (numLines * lineHeight) + 24;
    
    codeScrollPane.setPreferredSize(new Dimension(0, fullHeight));
    
    // Wrap in container with border
    JPanel codeContainer = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        g2d.setColor(new Color(208, 215, 222));
        g2d.fillRoundRect(0, 0, getWidth(), getHeight(), 12, 12);
        
        g2d.setColor(Color.WHITE);
        g2d.fillRoundRect(1, 1, getWidth() - 2, getHeight() - 2, 10, 10);
        
        g2d.dispose();
      }
    };
    codeContainer.setBackground(Color.WHITE);
    codeContainer.setBorder(new EmptyBorder(12, 12, 12, 12));
    codeContainer.add(codeScrollPane, BorderLayout.CENTER);
    
    return codeContainer;
  }
  
  private void _addUserMessage(String message) {
    JPanel messagePanel = _createUserMessagePanel(message);
    _messagesPanel.add(messagePanel);
    _messagesPanel.add(Box.createVerticalStrut(16));
    _messagesPanel.revalidate();
    _messagesPanel.repaint();
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
      
      // Override preferred size for responsiveness - DON'T CONSTRAIN WIDTH for code blocks
      JPanel wrapper = new JPanel(new BorderLayout()) {
      @Override
        public Dimension getPreferredSize() {
          Dimension pref = super.getPreferredSize();
          // For code blocks, let them use their natural width - don't constrain!
          return pref;
        }
        
        @Override
        public Dimension getMaximumSize() {
          // Allow unlimited width for code blocks
          return new Dimension(Integer.MAX_VALUE, getPreferredSize().height);
        }
      };
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
      
      messagePanel.add(messageText, BorderLayout.CENTER);
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
} 