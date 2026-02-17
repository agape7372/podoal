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
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
        clay: {
          bg: '#FFF8F3',
          surface: '#FFFFFF',
          pink: '#FFD4E0',
          mint: '#C5EBD6',
          lavender: '#E0D4F5',
          peach: '#FFE4CC',
          cream: '#FFF5E6',
          yellow: '#FFF3C4',
        },
        warm: {
          text: '#4A3B5C',
          sub: '#8B7A9E',
          light: '#B8A9C9',
          border: '#E8DFF0',
        },
      },
      borderRadius: {
        clay: '20px',
        'clay-lg': '28px',
        'clay-xl': '36px',
      },
      boxShadow: {
        clay: '8px 8px 16px rgba(0, 0, 0, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.9), inset 2px 2px 4px rgba(255, 255, 255, 0.7), inset -1px -1px 3px rgba(0, 0, 0, 0.04)',
        'clay-sm': '4px 4px 8px rgba(0, 0, 0, 0.06), -2px -2px 6px rgba(255, 255, 255, 0.9), inset 1px 1px 2px rgba(255, 255, 255, 0.7), inset -1px -1px 2px rgba(0, 0, 0, 0.03)',
        'clay-pressed': 'inset 4px 4px 8px rgba(0, 0, 0, 0.08), inset -2px -2px 6px rgba(255, 255, 255, 0.6), 2px 2px 4px rgba(255, 255, 255, 0.5)',
        'clay-float': '12px 12px 24px rgba(0, 0, 0, 0.1), -6px -6px 16px rgba(255, 255, 255, 0.95), inset 3px 3px 6px rgba(255, 255, 255, 0.8), inset -2px -2px 4px rgba(0, 0, 0, 0.05)',
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', 'system-ui', '-apple-system', 'sans-serif'],
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
          '50%': { transform: 'translateY(-10px)' },
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
      },
    },
  },
  plugins: [],
};

export default config;
