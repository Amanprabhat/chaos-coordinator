const express = require('express');
const path = require('path');

// Create a simple route for serving Knowmax-inspired assets
const setupAssets = (app) => {
  // Serve static assets with transparency
  app.use('/assets', express.static(path.join(__dirname, '../assets')));
  
  // Route for Knowmax logo with transparency
  app.get('/api/assets/knowmax-logo', (req, res) => {
    // SVG Knowmax-inspired logo with transparency
    const svgLogo = `
    <svg width="120" height="40" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="knowmaxGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Knowledge nodes pattern -->
      <circle cx="20" cy="20" r="8" fill="url(#knowmaxGradient)" opacity="0.8"/>
      <circle cx="40" cy="15" r="5" fill="url(#knowmaxGradient)" opacity="0.6"/>
      <circle cx="60" cy="25" r="6" fill="url(#knowmaxGradient)" opacity="0.7"/>
      <circle cx="80" cy="18" r="4" fill="url(#knowmaxGradient)" opacity="0.5"/>
      <circle cx="100" cy="22" r="7" fill="url(#knowmaxGradient)" opacity="0.8"/>
      
      <!-- Connection lines -->
      <line x1="20" y1="20" x2="40" y2="15" stroke="url(#knowmaxGradient)" stroke-width="1" opacity="0.3"/>
      <line x1="40" y1="15" x2="60" y2="25" stroke="url(#knowmaxGradient)" stroke-width="1" opacity="0.3"/>
      <line x1="60" y1="25" x2="80" y2="18" stroke="url(#knowmaxGradient)" stroke-width="1" opacity="0.3"/>
      <line x1="80" y1="18" x2="100" y2="22" stroke="url(#knowmaxGradient)" stroke-width="1" opacity="0.3"/>
      
      <!-- Knowmax text -->
      <text x="50" y="35" font-family="Arial, sans-serif" font-size="12" font-weight="bold" 
            text-anchor="middle" fill="url(#knowmaxGradient)" filter="url(#glow)">
        Knowmax
      </text>
    </svg>
    `;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svgLogo.trim());
  });

  // Route for decorative patterns
  app.get('/api/assets/pattern/:type', (req, res) => {
    const { type } = req.params;
    let svgPattern = '';
    
    switch(type) {
      case 'dots':
        svgPattern = `
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="2" fill="#4F46E5" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotPattern)"/>
        </svg>
        `;
        break;
      case 'lines':
        svgPattern = `
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="linePattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="30" y2="30" stroke="#7C3AED" stroke-width="1" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#linePattern)"/>
        </svg>
        `;
        break;
      default:
        svgPattern = '<svg></svg>';
    }
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svgPattern.trim());
  });
};

module.exports = setupAssets;
