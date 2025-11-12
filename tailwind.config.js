/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary colors - warm, paper-like aesthetic
        'paper': '#F5F5F0',
        'stone-light': '#F0F0EA',
        'ink': '#000000',
        
        // Brown palette - warm accents
        'brown-light': '#D4C5B9',
        'brown-medium': '#8B7355',
        'brown-dark': '#6B5D4F',
      },
    },
  },
  plugins: [],
}

