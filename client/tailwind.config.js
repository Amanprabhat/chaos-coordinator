/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Slate Intelligence Theme
        primary: '#1E293B',      // Deep slate
        accent: '#6366F1',       // Indigo
        background: '#F8FAFC',   // Light neutral
        surface: '#FFFFFF',      // White
        border: '#E2E8F0',       // Very light gray
        textPrimary: '#0F172A',  // Primary text
        textSecondary: '#64748B', // Secondary text
        textTertiary: '#94A3B8', // Tertiary text
        
        // State colors
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      }
    },
  },
  plugins: [],
}

