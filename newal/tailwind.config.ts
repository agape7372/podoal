import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        grape: {
          50: '#FAF7FE',
          100: '#EFE6FF',
          200: '#E0D2F8',
          300: '#C9B0EE',
          400: '#B294E2',
          500: '#9B7ED8',
          600: '#7B5FB8',
          700: '#624999',
          800: '#4A3679',
          900: '#33245B',
        },
        juice: {
          200: '#FFD6DD',
          300: '#FFB8C5',
          400: '#FF8FA3',
          500: '#FF6B8A',
          600: '#E84D6F',
        },
        leaf: {
          200: '#D2EBD7',
          300: '#A8D8B0',
          500: '#6BBE7E',
          600: '#5AA86C',
          700: '#4A8C58',
        },
        sunshine: {
          200: '#FFEFB5',
          300: '#FFE08A',
          500: '#FFC845',
          600: '#E6A92F',
        },
        clay: {
          bg: '#FBF4E3',
          surface: '#FFFAF0',
          pink: '#FFD4D4',
          mint: '#C6E6D5',
          lavender: '#E4D6F8',
          peach: '#FFD9B5',
          cream: '#FFF1D6',
          yellow: '#FFEEA8',
        },
        warm: {
          text: '#2A2434',
          sub: '#5C5263',
          light: '#9A8FA5',
          border: '#2A2434',
        },
        pop: {
          red: '#E55A4D',
          'red-dark': '#C03A2E',
          mustard: '#F2A93B',
          'mustard-dark': '#D88F22',
          cyan: '#4BA8B0',
          'cyan-dark': '#317E85',
          milk: '#FFF8E7',
          ink: '#2A2434',
        },
      },
      borderRadius: {
        clay: '24px',
        'clay-lg': '32px',
        'clay-xl': '40px',
        'clay-pill': '999px',
      },
      boxShadow: {
        clay: '0 4px 12px rgba(73, 50, 100, 0.06), 0 1px 3px rgba(73, 50, 100, 0.04)',
        'clay-sm': '0 2px 6px rgba(73, 50, 100, 0.05)',
        'clay-pressed': 'inset 0 2px 5px rgba(73, 50, 100, 0.08)',
        'clay-float':
          '0 8px 24px rgba(73, 50, 100, 0.10), 0 2px 6px rgba(73, 50, 100, 0.05)',
        'clay-puffy':
          '0 14px 32px rgba(73, 50, 100, 0.14), 0 4px 10px rgba(73, 50, 100, 0.07)',
        'grape-glow':
          '0 0 0 4px rgba(155, 126, 216, 0.15), 0 6px 18px rgba(123, 95, 184, 0.20)',
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"MaruBuri"', '"Noto Sans KR"', 'serif'],
      },
      lineHeight: {
        snug: '1.4',
        normal: '1.6',
        relaxed: '1.7',
        loose: '1.85',
      },
      letterSpacing: {
        tighter: '-0.03em',
        tight: '-0.02em',
        normal: '-0.01em',
        wide: '0.01em',
        wider: '0.03em',
      },
      animation: {
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'pop': 'pop 0.3s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'shake': 'shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'float': 'float 3s ease-in-out infinite',
        'sparkle': 'sparkle 0.6s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'grape-fill': 'grapeFill 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'reward-reveal': 'rewardReveal 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'confetti': 'confetti 1s ease-out forwards',
        'shimmer': 'shimmer 2s infinite',
        'wiggle': 'wiggle 0.25s ease-in-out',
      },
      keyframes: {
        bounceIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        sparkle: {
          '0%': { transform: 'scale(0) rotate(0deg)', opacity: '0' },
          '50%': { transform: 'scale(1.2) rotate(180deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(360deg)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        grapeFill: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        rewardReveal: {
          '0%': { transform: 'scale(0) rotateY(180deg)', opacity: '0' },
          '60%': { transform: 'scale(1.1) rotateY(10deg)' },
          '100%': { transform: 'scale(1) rotateY(0deg)', opacity: '1' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(-200px) rotate(720deg)', opacity: '0' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-2deg)' },
          '75%': { transform: 'rotate(2deg)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
