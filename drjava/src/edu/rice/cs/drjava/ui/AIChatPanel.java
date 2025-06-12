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
  
  /**
   * Simple markdown to HTML converter for basic formatting
   */
  private String _convertMarkdownToHTML(String markdown) {
    if (markdown == null || markdown.trim().isEmpty()) {
      return "";
    }
    
    String html = markdown;
    
    // Convert code blocks (```...```) - we'll handle these specially now
    Pattern codeBlockPattern = Pattern.compile("```(.*?)```", Pattern.DOTALL);
    Matcher codeBlockMatcher = codeBlockPattern.matcher(html);
    html = codeBlockMatcher.replaceAll("__CODE_BLOCK__$1__CODE_BLOCK_END__");
    
    // Convert inline code (`...`)
    Pattern inlineCodePattern = Pattern.compile("`([^`]+)`");
    Matcher inlineCodeMatcher = inlineCodePattern.matcher(html);
    html = inlineCodeMatcher.replaceAll("<code style='background-color: #f6f8fa; padding: 1px 3px; border-radius: 2px; font-family: Consolas, Monaco, monospace; font-size: 11px;'>$1</code>");
    
    // Convert bold (**text**)
    Pattern boldPattern = Pattern.compile("\\*\\*([^*]+)\\*\\*");
    Matcher boldMatcher = boldPattern.matcher(html);
    html = boldMatcher.replaceAll("<strong>$1</strong>");
    
    // Convert italic (*text*)
    Pattern italicPattern = Pattern.compile("\\*([^*]+)\\*");
    Matcher italicMatcher = italicPattern.matcher(html);
    html = italicMatcher.replaceAll("<em>$1</em>");
    
    // Convert bullet points (• or -)
    html = html.replaceAll("^[•-]\\s+(.*)$", "<li>$1</li>");
    
    // Wrap consecutive <li> elements in <ul>
    html = html.replaceAll("(<li>.*?</li>)(?:\\s*<li>.*?</li>)*", "<ul>$0</ul>");
    
    // Convert line breaks
    html = html.replaceAll("\n", "<br>");
    
    // Wrap in basic HTML structure with consistent styling
    return "<html><head><style>" +
           "body { font-family: 'Segoe UI', sans-serif; font-size: 10px; line-height: 1.4; margin: 0; padding: 0; }" +
           "code { background-color: #f6f8fa; padding: 1px 3px; border-radius: 2px; font-family: Consolas, Monaco, monospace; font-size: 11px; }" +
           "pre { background-color: #f6f8fa; padding: 6px; border-radius: 3px; font-family: Consolas, Monaco, monospace; font-size: 11px; margin: 6px 0; overflow-x: auto; line-height: 1.3; }" +
           "ul { margin: 6px 0; padding-left: 18px; }" +
           "li { margin: 1px 0; }" +
           "p { margin: 0; padding: 0; }" +
           "</style></head><body>" + html + "</body></html>";
  }
  
  /**
   * Creates a syntax-highlighted JTextPane for Java code
   */
  private JComponent _createSyntaxHighlightedCodePane(String code) {
    // Custom JTextPane that clips to rounded corners
    JTextPane codePane = new JTextPane() {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Create rounded clipping area
        g2d.setClip(new java.awt.geom.RoundRectangle2D.Float(0, 0, getWidth(), getHeight(), 10, 10));
        
        // Fill background with white
        g2d.setColor(Color.WHITE);
        g2d.fillRoundRect(0, 0, getWidth(), getHeight(), 10, 10);
        
        // Let the text pane paint its content within the clipped area
        super.paintComponent(g2d);
        g2d.dispose();
      }
    };
    
    StyledDocument doc = codePane.getStyledDocument();
    
    // Define styles based on DrJava's color scheme
    Style defaultStyle = StyleContext.getDefaultStyleContext().getStyle(StyleContext.DEFAULT_STYLE);
    
    Style normalStyle = doc.addStyle("normal", defaultStyle);
    
    // Use DrJava's main font family but with chat text size (13)
    Font mainFont = DrJava.getConfig().getSetting(OptionConstants.FONT_MAIN);
    StyleConstants.setFontFamily(normalStyle, mainFont.getFamily());
    StyleConstants.setFontSize(normalStyle, 13); // Match chat text size
    StyleConstants.setForeground(normalStyle, new Color(51, 51, 51)); // NORMAL_COLOR
    StyleConstants.setLineSpacing(normalStyle, 0.2f);
    
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
    StyleConstants.setForeground(numberStyle, new Color(0, 139, 139)); // Muted cyan for numbers
    
    // Java keywords (excluding primitive types which are treated as types)
    String[] keywords = {
      "abstract", "assert", "break", "case", "catch", "class", "const",
      "continue", "default", "do", "else", "enum", "extends", "final", "finally",
      "for", "goto", "if", "implements", "import", "instanceof", "interface", "native",
      "new", "package", "private", "protected", "public", "return", "static", "strictfp",
      "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void",
      "volatile", "while", "true", "false", "null"
    };
    
    // Java types (primitives and common reference types)
    String[] types = {
      // Primitive types
      "boolean", "byte", "char", "double", "float", "int", "long", "short",
      // Reference types
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
        
        int lineStart = 0;
        
        // Check for comments first (they override everything else)
        if (line.trim().startsWith("//")) {
          doc.insertString(doc.getLength(), line, commentStyle);
          continue;
        }
        
        // Check for multi-line comments
        if (line.trim().startsWith("/*") || line.trim().startsWith("*")) {
          doc.insertString(doc.getLength(), line, commentStyle);
          continue;
        }
        
        // Tokenize and highlight - preserve whitespace and handle string literals properly
        Pattern tokenPattern = Pattern.compile("(\"[^\"]*\"|'[^']*'|\\w+|\\s+|[^\\w\\s])");
        Matcher tokenMatcher = tokenPattern.matcher(line);
        
        while (tokenMatcher.find()) {
          String token = tokenMatcher.group();
          Style styleToUse = normalStyle;
          
          // Don't style whitespace - just insert as-is
          if (token.matches("\\s+")) {
            doc.insertString(doc.getLength(), token, normalStyle);
            continue;
          }
          
          // Check if it's a string literal (including quotes)
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
            
            // Check if it's a type (only if not already a keyword)
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
    
    // Configure the text pane
    codePane.setEditable(false);
    codePane.setOpaque(true);
    codePane.setBackground(Color.WHITE); // White background for code
    codePane.setBorder(new EmptyBorder(12, 12, 12, 12)); // Increased padding for better readability
    
    // Use DrJava's main font family but with chat text size (13)
    Font codeFont = new Font(mainFont.getFamily(), Font.PLAIN, 13);
    codePane.setFont(codeFont);
    
    // Set tab size for proper indentation (4 spaces)
    TabStop[] tabs = new TabStop[50]; // Support up to 50 tab stops
    int tabWidth = codePane.getFontMetrics(codeFont).charWidth(' ') * 4; // 4 spaces per tab
    for (int i = 0; i < tabs.length; i++) {
      tabs[i] = new TabStop((i + 1) * tabWidth);
    }
    TabSet tabSet = new TabSet(tabs);
    SimpleAttributeSet attributes = new SimpleAttributeSet();
    StyleConstants.setTabSet(attributes, tabSet);
    codePane.setParagraphAttributes(attributes, false);
    
    // Wrap in a panel with grey border around white background
    JPanel codeContainer = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
    g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    
        // Draw grey border with rounded corners
        g2d.setColor(new Color(208, 215, 222)); // Grey border color
        g2d.fillRoundRect(0, 0, getWidth(), getHeight(), 12, 12);
        
        // Draw white inner area with rounded corners (slightly smaller to show border)
        g2d.setColor(Color.WHITE);
        g2d.fillRoundRect(1, 1, getWidth() - 2, getHeight() - 2, 11, 11);
    
    g2d.dispose();
      }
    };
    codeContainer.setBackground(Color.WHITE);
    codeContainer.setBorder(new EmptyBorder(1, 1, 1, 1)); // Minimal border to show the grey outline
    codeContainer.add(codePane, BorderLayout.CENTER);
    
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
        JEditorPane textPane = new JEditorPane();
        textPane.setContentType("text/html");
        textPane.setEditable(false);
        textPane.setOpaque(false);
        textPane.setText(_convertMarkdownToHTML(beforeText));
        textPane.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
        textPane.setBorder(new EmptyBorder(0, 0, 4, 0)); // Reduced bottom spacing
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
      contentPanel.add(Box.createVerticalStrut(4)); // Reduced spacing
      
      lastEnd = matcher.end();
    }
    
    // Add remaining text after last code block
    if (lastEnd < message.length()) {
      String remainingText = message.substring(lastEnd);
      if (!remainingText.trim().isEmpty()) {
        JEditorPane textPane = new JEditorPane();
        textPane.setContentType("text/html");
        textPane.setEditable(false);
        textPane.setOpaque(false);
        textPane.setText(_convertMarkdownToHTML(remainingText));
        textPane.putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, Boolean.FALSE);
        textPane.setBorder(null); // No border for final text
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
        int x = c.getWidth() - buttonPanelWidth - 3; // 3px margin from right
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
      _addAIMessage("I'm still learning! This feature will be available soon. " +
        "In the meantime, keep coding! 🚀\n\n" +
        "**Here's a sample of syntax highlighting:**\n" +
        "- *Italic text*\n" +
        "- **Bold text**\n" +
        "- `inline code`\n\n" +
        "```java\n" +
        "public class HelloWorld {\n" +
        "    private static final String GREETING = \"Hello World!\";\n" +
        "    \n" +
        "    public static void main(String[] args) {\n" +
        "        // This is a comment\n" +
        "        int count = 42;\n" +
        "        boolean isReady = true;\n" +
        "        \n" +
        "        if (isReady) {\n" +
        "            System.out.println(GREETING);\n" +
        "            for (int i = 0; i < count; i++) {\n" +
        "                System.out.println(\"Number: \" + i);\n" +
        "            }\n" +
        "        }\n" +
        "    }\n" +
        "}\n" +
        "```\n\n" +
        "Notice the **syntax highlighting** with different colors for:\n" +
        "- Keywords like `public`, `static`, `if`, `for`\n" +
        "- Types like `String`, `int`, `boolean`\n" +
        "- String literals in red\n" +
        "- Comments in green");
      _inputField.setText("");
      _scrollToBottom();
    }
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
    JPanel messagePanel = new JPanel(new BorderLayout());
    messagePanel.setOpaque(false);
    messagePanel.setMaximumSize(new Dimension(Integer.MAX_VALUE, Integer.MAX_VALUE));
    
    // Create rounded chat bubble for user message
    JPanel bubblePanel = new JPanel(new BorderLayout()) {
      @Override
      protected void paintComponent(Graphics g) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Paint rounded background
        g2d.setColor(getBackground());
        g2d.fillRoundRect(0, 0, getWidth(), getHeight(), 12, 12);
        
        g2d.dispose();
      }
      
      @Override
      public Dimension getPreferredSize() {
        Dimension pref = super.getPreferredSize();
        // Limit to 70% of parent width but be responsive
        Container parent = getParent();
        if (parent != null) {
          int maxWidth = (int) (parent.getWidth() * 0.7);
          if (maxWidth > 0 && pref.width > maxWidth) {
            pref.width = maxWidth;
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
    bubblePanel.setBorder(new EmptyBorder(8, 12, 8, 12));
    
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
    JPanel messagePanel = new JPanel(new BorderLayout());
    messagePanel.setOpaque(false);
    messagePanel.setMaximumSize(new Dimension(Integer.MAX_VALUE, Integer.MAX_VALUE));
    
    // Check if message contains code blocks
    boolean hasCodeBlocks = message.contains("```");
    
    if (hasCodeBlocks) {
      // Use mixed content panel with syntax highlighting
      JComponent contentComponent = _createMixedContentPanel(message);
      contentComponent.setAlignmentX(Component.LEFT_ALIGNMENT);
      
      // Override preferred size for responsiveness
      JPanel wrapper = new JPanel(new BorderLayout()) {
      @Override
        public Dimension getPreferredSize() {
          Dimension pref = super.getPreferredSize();
          // Limit to 85% of parent width but be responsive
          Container parent = getParent();
          if (parent != null) {
            int maxWidth = (int) (parent.getWidth() * 0.85);
            if (maxWidth > 0 && pref.width > maxWidth) {
              pref.width = maxWidth;
            }
          }
          return pref;
        }
        
        @Override
        public Dimension getMaximumSize() {
          return getPreferredSize();
        }
      };
      wrapper.setOpaque(false);
      wrapper.add(contentComponent, BorderLayout.CENTER);
      
      messagePanel.add(wrapper, BorderLayout.CENTER);
    } else {
      // Use simple HTML for text-only messages
      JEditorPane messageText = new JEditorPane() {
        @Override
        public Dimension getPreferredSize() {
          Dimension pref = super.getPreferredSize();
          // Limit to 85% of parent width but be responsive
          Container parent = getParent();
          if (parent != null) {
            int maxWidth = (int) (parent.getWidth() * 0.85);
            if (maxWidth > 0 && pref.width > maxWidth) {
              pref.width = maxWidth;
            }
          }
          return pref;
        }
        
        @Override
        public Dimension getMaximumSize() {
          return getPreferredSize();
        }
      };
      messageText.setContentType("text/html");
    messageText.setEditable(false);
    messageText.setOpaque(false);
      messageText.setText(_convertMarkdownToHTML(message));
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