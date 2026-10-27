/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#05070d', 900: '#080c16', 800: '#0c1222', 700: '#131b30' },
        cyanx: { 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4' },
        violetx: { 400: '#a78bfa', 500: '#8b5cf6' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.25), 0 8px 40px -12px rgba(34,211,238,0.35)',
      },
    },
  },
  plugins: [],
}
