/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0F',
        card: '#14121C',
        carddeep: '#1E1636',
        body: '#D9D4E3',
        muted: '#a39cb5',
        grape: {
          DEFAULT: '#6D3FE0',
          light: '#9B6BFF',
          deep: '#2A1B4D',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(155, 107, 255, 0.35)',
        glowSoft: '0 0 14px rgba(109, 63, 224, 0.3)',
      },
    },
  },
  plugins: [],
};
