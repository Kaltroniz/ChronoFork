/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        console: {
          bg: '#0b0f19',
          card: '#111827',
          surface: '#151e32',
          border: '#1f293d',
          accent: '#06b6d4',
        },
        agent: {
          blue: '#3b82f6',
          amber: '#f59e0b',
          violet: '#8b5cf6',
          teal: '#10b981',
        },
        collision: {
          red: '#ef4444',
          glow: 'rgba(239, 68, 68, 0.4)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-red': 'glowRed 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        glowRed: {
          '0%': { boxShadow: '0 0 5px rgba(239, 68, 68, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(239, 68, 68, 0.9)' },
        }
      }
    },
  },
  plugins: [],
}
