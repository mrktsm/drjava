package edu.rice.cs.drjava.ui.aichat;

import javax.swing.*;
import java.awt.*;
import java.awt.geom.Rectangle2D;

/**
 * A component that displays text with a shimmer animation effect and an eye icon
 */
public class ShimmerText extends JComponent {
  private String _text;
  private Font _font;
  private Color _baseColor;
  private Color _shimmerColor;
  private Timer _animationTimer;
  private float _shimmerPosition = 0.0f;
  private final float _shimmerWidth = 0.8f; // Much wider shimmer effect (was 0.3f)
  private Icon _icon;
  private final int _iconTextGap = 4; // Gap between icon and text (reduced from 6)
  
  public ShimmerText(String text) {
    this(text, "/edu/rice/cs/drjava/ui/icons/LieEye.png");
  }
  
  public ShimmerText(String text, String iconPath) {
    _text = text != null ? text : "Processing..."; // Default to "Processing..." if no text provided
    _font = new Font("Segoe UI", Font.PLAIN, 13);
    _baseColor = new Color(101, 109, 118); // Secondary text color
    _shimmerColor = new Color(200, 200, 200); // Much lighter shimmer color
    
    // Load the specified icon
    _icon = loadIcon(iconPath);
    
    setOpaque(false);
    
    // Start the shimmer animation with faster, exponential movement
    _animationTimer = new Timer(15, e -> { // Faster timer
      // Calculate progress from 0 to 1 for the whole animation cycle
      float animationRange = 1.0f + (2 * _shimmerWidth);
      float currentPosition = _shimmerPosition + _shimmerWidth;
      float progress = Math.max(0f, currentPosition / animationRange); // Clamp to 0..1

      // A more pronounced ease-in (quartic)
      float easedProgress = progress * progress * progress * progress;
      
      // Adjust speed based on eased progress
      // Start very slow, and accelerate to a high speed
      _shimmerPosition += 0.01f + (easedProgress * 0.25f);
      
      if (_shimmerPosition > 1.0f + _shimmerWidth) {
        _shimmerPosition = -_shimmerWidth;
      }
      repaint();
    });
    _animationTimer.start();
  }
  
  /**
   * Loads an icon from the specified path
   */
  private Icon loadIcon(String iconPath) {
    try {
      java.net.URL iconURL = getClass().getResource(iconPath);
      if (iconURL != null) {
        ImageIcon originalIcon = new ImageIcon(iconURL);
        Image originalImage = originalIcon.getImage();
        
        // Get original dimensions
        int originalWidth = originalIcon.getIconWidth();
        int originalHeight = originalIcon.getIconHeight();
        
        // Calculate scaled dimensions while preserving aspect ratio
        // Target height of 12 pixels
        int targetHeight = 12;
        int targetWidth = (originalWidth * targetHeight) / originalHeight;
        
        // Use SCALE_AREA_AVERAGING for better quality when scaling down
        Image scaledImage = originalImage.getScaledInstance(targetWidth, targetHeight, Image.SCALE_AREA_AVERAGING);
        return new ImageIcon(scaledImage);
      }
    } catch (Exception e) {
      // Fall back to programmatic icon if loading fails
      System.err.println("Could not load icon from " + iconPath + ", using fallback icon: " + e.getMessage());
    }
    
    // Fallback to programmatic icon based on icon path
    if (iconPath.contains("Folder")) {
      return createFallbackFolderIcon();
    } else {
      return createFallbackEyeIcon();
    }
  }

  /**
   * Loads the LieEye.png icon from the icons directory
   */
  private Icon loadEyeIcon() {
    return loadIcon("/edu/rice/cs/drjava/ui/icons/LieEye.png");
  }
  
  /**
   * Creates a simple eye icon programmatically as fallback
   */
  private Icon createFallbackEyeIcon() {
    return new Icon() {
      @Override
      public void paintIcon(Component c, Graphics g, int x, int y) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setColor(_baseColor); // Match the base text color
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Draw simple eye shape (smaller size - 12x8)
        g2d.drawOval(x, y + 2, 12, 6); // Eye outline
        g2d.fillOval(x + 4, y + 3, 4, 4); // Pupil
        
        g2d.dispose();
      }
      
      @Override
      public int getIconWidth() { return 16; }
      
      @Override
      public int getIconHeight() { return 16; }
    };
  }
  
  /**
   * Creates a simple folder icon programmatically as fallback
   */
  private Icon createFallbackFolderIcon() {
    return new Icon() {
      @Override
      public void paintIcon(Component c, Graphics g, int x, int y) {
        Graphics2D g2d = (Graphics2D) g.create();
        g2d.setColor(_baseColor); // Match the base text color
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // Draw simple folder shape
        g2d.drawRect(x, y + 4, 12, 8); // Folder body
        g2d.drawRect(x, y + 2, 6, 2); // Folder tab
        
        g2d.dispose();
      }
      
      @Override
      public int getIconWidth() { return 16; }
      
      @Override
      public int getIconHeight() { return 16; }
    };
  }
  
  @Override
  protected void paintComponent(Graphics g) {
    super.paintComponent(g);
    
    Graphics2D g2d = (Graphics2D) g.create();
    g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    
    // Draw the icon on the left
    int iconY = (getHeight() - _icon.getIconHeight()) / 2 + 1; // Move down by 1 pixel
    _icon.paintIcon(this, g2d, 0, iconY);
    
    // Calculate text position (after icon + gap)
    int textStartX = _icon.getIconWidth() + _iconTextGap;
    
    g2d.setFont(_font);
    FontMetrics fm = g2d.getFontMetrics();
    
    int textWidth = fm.stringWidth(_text);
    int textHeight = fm.getHeight();
    
    // Position text vertically centered
    int textY = (getHeight() + fm.getAscent()) / 2;
    
    // Draw base text
    g2d.setColor(_baseColor);
    g2d.drawString(_text, textStartX, textY);
    
    // Calculate shimmer effect
    float shimmerStart = _shimmerPosition - _shimmerWidth / 2;
    float shimmerEnd = _shimmerPosition + _shimmerWidth / 2;
    
    // Convert relative positions to absolute pixel positions
    int shimmerStartPixel = (int) (shimmerStart * textWidth);
    int shimmerEndPixel = (int) (shimmerEnd * textWidth);
    
    // Draw shimmer effect
    if (shimmerStartPixel < textWidth && shimmerEndPixel > 0) {
      int gradientStart = Math.max(0, shimmerStartPixel) + textStartX;
      int gradientEnd = Math.min(textWidth, shimmerEndPixel) + textStartX;
      
      if (gradientEnd > gradientStart) {
        // Create clipping area for the shimmer effect
        Rectangle clipArea = new Rectangle(gradientStart, textY - fm.getAscent(), gradientEnd - gradientStart, textHeight);
        Shape oldClip = g2d.getClip();
        g2d.setClip(clipArea);
        
        // Create a gradient for smoother shimmer effect
        int centerX = (gradientStart + gradientEnd) / 2;
        GradientPaint shimmerGradient = new GradientPaint(
          (float)gradientStart, (float)textY, new Color(_shimmerColor.getRed(), _shimmerColor.getGreen(), _shimmerColor.getBlue(), 0),
          (float)centerX, (float)textY, new Color(_shimmerColor.getRed(), _shimmerColor.getGreen(), _shimmerColor.getBlue(), 255),
          true // cyclic
        );
        g2d.setPaint(shimmerGradient);
        
        // Draw shimmer text with gradient
        g2d.drawString(_text, textStartX, textY);
        
        g2d.setClip(oldClip);
      }
    }
    
    g2d.dispose();
  }
  
  @Override
  public Dimension getPreferredSize() {
    FontMetrics fm = getFontMetrics(_font);
    int textWidth = fm.stringWidth(_text);
    int textHeight = fm.getHeight();
    
    // Total width = icon width + gap + text width + padding
    int width = _icon.getIconWidth() + _iconTextGap + textWidth + 20;
    int height = Math.max(_icon.getIconHeight(), textHeight) + 10;
    
    return new Dimension(width, height);
  }
  
  public void stopAnimation() {
    if (_animationTimer != null) {
      _animationTimer.stop();
    }
  }
  
  public void startAnimation() {
    if (_animationTimer != null && !_animationTimer.isRunning()) {
      _animationTimer.start();
    }
  }
  
  /**
   * Updates the text and restarts the animation
   */
  public void setText(String text) {
    _text = text != null ? text : "Processing...";
    repaint();
  }
} 