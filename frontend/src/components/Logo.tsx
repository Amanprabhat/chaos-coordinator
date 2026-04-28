import React, { useState, useEffect } from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large' | 'auth';
  className?: string;
  showText?: boolean;
  debug?: boolean;
}

interface LogoState {
  imageLoaded: boolean;
  imageError: boolean;
  imageDimensions: { width: number; height: number } | null;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '', showText = true, debug = false }) => {
  const [state, setState] = useState<LogoState>({
    imageLoaded: false,
    imageError: false,
    imageDimensions: null
  });

  // Logo configuration with square aspect ratios (1440x1440 = 1:1) - PERFECT SQUARE!
  const logoConfig = {
    small: { width: 'w-16', height: 'h-16', maxWidth: '64px' }, // 1:1 ratio
    medium: { width: 'w-20', height: 'h-20', maxWidth: '80px' }, // 1:1 ratio
    large: { width: 'w-24', height: 'h-24', maxWidth: '96px' }, // 1:1 ratio
    auth: { width: 'w-48', height: 'h-48', maxWidth: '192px' } // 1:1 ratio - LARGE SQUARE!
  };

  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-2xl',
    auth: 'text-3xl'
  };

  const config = logoConfig[size];
  const logoSrc = '/logo192.png';

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    setState({
      imageLoaded: true,
      imageError: false,
      imageDimensions: {
        width: img.naturalWidth,
        height: img.naturalHeight
      }
    });
    
    if (debug) {
      console.log('✅ Logo loaded successfully:', {
        src: logoSrc,
        naturalSize: `${img.naturalWidth}x${img.naturalHeight}`,
        displaySize: config.maxWidth,
        aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2)
      });
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('❌ Logo failed to load:', {
      src: logoSrc,
      size,
      error: 'Image file not found or corrupted'
    });
    
    setState(prev => ({ ...prev, imageLoaded: false, imageError: true }));
  };

  useEffect(() => {
    if (debug) {
      console.log('🔍 Logo component debug info:', {
        size,
        src: logoSrc,
        config,
        showText
      });
    }
  }, [size, debug, config, showText]);

  // Render fallback if image fails to load
  if (state.imageError) {
    return (
      <div className={`flex flex-col items-center space-y-4 ${className}`}>
        {debug && (
          <div className="text-xs text-red-500 bg-red-50 p-2 rounded max-w-xs">
            ❌ LOGO ERROR: Failed to load /logo192.png<br/>
            Size: {size}<br/>
            Check: Does file exist in /public/?
          </div>
        )}
        <div className={`${config.width} ${config.height} bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-2xl shadow-lg`}>
          CC
        </div>
        {showText && (
          <div className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-center`}>
            Chaos Coordinator
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {debug && (
        <div className="text-xs bg-blue-50 border border-blue-200 p-2 rounded max-w-xs">
          <div className="font-semibold text-blue-700">Logo Debug:</div>
          <div>Size: {size}</div>
          <div>Src: {logoSrc}</div>
          <div>Config: {config.maxWidth}</div>
          <div>Status: {state.imageLoaded ? '✅ Loaded' : '⏳ Loading...'}</div>
          {state.imageDimensions && (
            <div>Dimensions: {state.imageDimensions.width}×{state.imageDimensions.height}</div>
          )}
        </div>
      )}
      
      <div className="relative">
        <img
          src={logoSrc}
          alt="Chaos Coordinator Logo"
          className={`${config.width} ${config.height} object-contain transition-all duration-300 hover:scale-105`}
          style={{ 
            filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.25)) brightness(1.1) contrast(1.1)',
            maxWidth: config.maxWidth
          }}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        
        {/* Loading indicator */}
        {!state.imageLoaded && !state.imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {debug && state.imageLoaded && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
        )}
      </div>
      
      {showText && (
        <div className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-center`}>
          Chaos Coordinator
        </div>
      )}
    </div>
  );
};

export default Logo;
