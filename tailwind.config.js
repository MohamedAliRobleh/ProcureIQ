/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A0B0F',
        'bg-secondary': '#111318',
        'bg-card': '#16181F',
        'bg-hover': '#1C1F28',
        border: { DEFAULT: '#1E2130', accent: '#2A2D3E' },
        accent: {
          blue: '#3B82F6',
          'blue-light': '#60A5FA',
          green: '#10B981',
          amber: '#F59E0B',
          red: '#EF4444',
          purple: '#8B5CF6',
        },
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          muted: '#475569',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-blue': 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
        'gradient-green': 'linear-gradient(135deg, #059669, #10B981)',
      },
    },
  },
  plugins: [],
}
