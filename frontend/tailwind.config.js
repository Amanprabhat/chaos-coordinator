/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm Neutral Theme
        primary:        '#1C1917',   // Stone-900  - rich warm dark
        accent:         '#6366F1',   // Indigo     - pops on warm backgrounds
        background:     '#F5F3EE',   // Warm sand  - main page bg
        surface:        '#FFFFFF',   // White      - cards / modals
        sidebar:        '#FAF8F4',   // Warm cream - sidebar bg
        border:         '#E5E0D8',   // Warm stone - borders
        textPrimary:    '#1C1917',   // Stone-900
        textSecondary:  '#78716C',   // Stone-500
        textTertiary:   '#A8A29E',   // Stone-400

        // State colors
        success: '#22C55E',
        warning: '#F59E0B',
        danger:  '#EF4444',
        info:    '#3B82F6',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up':        'fadeUp 0.45s ease-out forwards',
        'fade-in':        'fadeIn 0.3s ease-out forwards',
        'slide-in-left':  'slideInLeft 0.3s ease-out forwards',
        'scale-in':       'scaleIn 0.25s ease-out forwards',
        'shimmer':        'shimmer 2s infinite linear',
      },
      boxShadow: {
        'warm-sm':  '0 1px 3px 0 rgba(87,60,30,0.06), 0 1px 2px -1px rgba(87,60,30,0.04)',
        'warm-md':  '0 4px 12px -2px rgba(87,60,30,0.08), 0 2px 6px -2px rgba(87,60,30,0.05)',
        'warm-lg':  '0 12px 32px -4px rgba(87,60,30,0.10), 0 4px 12px -4px rgba(87,60,30,0.06)',
        'warm-xl':  '0 20px 48px -8px rgba(87,60,30,0.12), 0 8px 20px -6px rgba(87,60,30,0.08)',
      },
    },
  },
  plugins: [],
}
