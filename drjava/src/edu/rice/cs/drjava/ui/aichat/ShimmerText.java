package edu.rice.cs.drjava.ui.aichat;

import javax.swing.*;
import java.awt.*;
import java.awt.geom.Rectangle2D;

/**
 * A component that displays text with a shimmer animation effect
 */
public class ShimmerText extends JComponent {
  private String _text;
  private Font _font;
  private Color _baseColor;
  private Color _shimmerColor;
  private Timer _animationTimer;
  private float _shimmerPosition = 0.0f;
  private final float _shimmerWidth = 0.8f; // Much wider shimmer effect (was 0.3f)
  
  public ShimmerText(String text) {
    _text = text;
    _font = new Font("Segoe UI", Font.PLAIN, 13);
    _baseColor = new Color(101, 109, 118); // Secondary text color
    _shimmerColor = new Color(200, 200, 200); // Much lighter shimmer color
    
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
  
  @Override
  protected void paintComponent(Graphics g) {
    super.paintComponent(g);
    
    Graphics2D g2d = (Graphics2D) g.create();
    g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    
    g2d.setFont(_font);
    FontMetrics fm = g2d.getFontMetrics();
    
    int textWidth = fm.stringWidth(_text);
    int textHeight = fm.getHeight();
    
    // Center the text
    int x = (getWidth() - textWidth) / 2;
    int y = (getHeight() + fm.getAscent()) / 2;
    
    // Draw base text
    g2d.setColor(_baseColor);
    g2d.drawString(_text, x, y);
    
    // Calculate shimmer effect
    float shimmerStart = _shimmerPosition - _shimmerWidth / 2;
    float shimmerEnd = _shimmerPosition + _shimmerWidth / 2;
    
    // Convert relative positions to absolute pixel positions
    int shimmerStartPixel = (int) (shimmerStart * textWidth);
    int shimmerEndPixel = (int) (shimmerEnd * textWidth);
    
    // Draw shimmer effect
    if (shimmerStartPixel < textWidth && shimmerEndPixel > 0) {
      int gradientStart = Math.max(0, shimmerStartPixel) + x;
      int gradientEnd = Math.min(textWidth, shimmerEndPixel) + x;
      
      if (gradientEnd > gradientStart) {
        // Create clipping area for the shimmer effect
        Rectangle clipArea = new Rectangle(gradientStart, y - fm.getAscent(), gradientEnd - gradientStart, textHeight);
        Shape oldClip = g2d.getClip();
        g2d.setClip(clipArea);
        
        // Create a gradient for smoother shimmer effect
        int centerX = (gradientStart + gradientEnd) / 2;
        GradientPaint shimmerGradient = new GradientPaint(
          (float)gradientStart, (float)y, new Color(_shimmerColor.getRed(), _shimmerColor.getGreen(), _shimmerColor.getBlue(), 0),
          (float)centerX, (float)y, new Color(_shimmerColor.getRed(), _shimmerColor.getGreen(), _shimmerColor.getBlue(), 255),
          true // cyclic
        );
        g2d.setPaint(shimmerGradient);
        
        // Draw shimmer text with gradient
        g2d.drawString(_text, x, y);
        
        g2d.setClip(oldClip);
      }
    }
    
    g2d.dispose();
  }
  
  @Override
  public Dimension getPreferredSize() {
    FontMetrics fm = getFontMetrics(_font);
    int width = fm.stringWidth(_text) + 20; // Add some padding
    int height = fm.getHeight() + 10; // Add some padding
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
} 