import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true, 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`${sizeClasses[size]} rounded-lg overflow-hidden shadow-sm`}>
        <img 
          src="/logo192.png" 
          alt="Chaos Coordinator" 
          className="w-full h-full object-cover"
        />
      </div>
      {showText && (
        <div>
          <h1 className={`${textSizeClasses[size]} font-bold text-textPrimary`}>
            Chaos Coordinator
          </h1>
          {size === 'lg' && (
            <p className="text-xs text-textTertiary">
              From Chaos to Control
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
