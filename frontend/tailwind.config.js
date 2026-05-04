/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          0: '#FFFFFF',
          50: '#F7F8F9',
          100: '#EFF1F3',
          200: '#DCE0E5',
          300: '#B7BFC8',
          400: '#7E8896',
          500: '#56606E',
          600: '#3A434F',
          700: '#262C36',
          800: '#161A22',
          900: '#0B0E14',
          950: '#05070B',
        },
        primary: {
          50: '#ECFEF7',
          100: '#D0FBE9',
          200: '#A4F4D3',
          300: '#6CE8B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C1F',
        },
        accent: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
        },
        secondary: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Satoshi', 'system-ui', 'sans-serif'],
        display: ['"Clash Display"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.05em',
        eyebrow: '0.22em',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'glide': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'haptic': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -8px rgba(15,23,42,0.08)',
        'lift': '0 24px 60px -20px rgba(15,23,42,0.18), 0 2px 4px rgba(15,23,42,0.04)',
        'glow-emerald': '0 0 0 1px rgba(16,185,129,0.18), 0 20px 60px -20px rgba(16,185,129,0.45)',
        'inner-hl': 'inset 0 1px 0 rgba(255,255,255,0.6)',
        'inner-hl-dark': 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backgroundImage: {
        'mesh-emerald': 'radial-gradient(at 18% 22%, rgba(16,185,129,0.18) 0px, transparent 45%), radial-gradient(at 82% 10%, rgba(34,211,238,0.14) 0px, transparent 50%), radial-gradient(at 50% 90%, rgba(124,58,237,0.10) 0px, transparent 55%)',
        'grid-faint': "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(28px)', filter: 'blur(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        'orbit': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 900ms cubic-bezier(0.16,1,0.3,1) both',
        'pulse-soft': 'pulse-soft 6s ease-in-out infinite',
        'orbit-slow': 'orbit 28s linear infinite',
        'shimmer': 'shimmer 2.4s cubic-bezier(0.32,0.72,0,1) infinite',
        'marquee': 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
}
