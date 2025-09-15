import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'paper': '#FDFCF8',
        'ink': '#2C2416',
        'brown-light': '#D4C4B0',
        'brown-medium': '#A68B5B',
        'stone-light': '#F5F2ED',
        'purple': {
          500: '#a855f7',
          600: '#9333ea',
        },
        'blue': {
          500: '#3b82f6',
          600: '#2563eb',
        },
        'cyan': {
          500: '#06b6d4',
        },
        'pink': {
          500: '#ec4899',
        },
        'indigo': {
          500: '#6366f1',
        },
        'orange': {
          500: '#f97316',
        },
        'red': {
          500: '#ef4444',
        },
        'teal': {
          500: '#14b8a6',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
}

export default config