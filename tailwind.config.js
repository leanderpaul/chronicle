/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.tsx', './components/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        border: 'var(--color-border)',
        content: {
          light: 'var(--color-content-light)',
          DEFAULT: 'var(--color-content)',
          dark: 'var(--color-content-dark)',
        },
        paper: {
          light: 'var(--color-paper-light)',
          DEFAULT: 'var(--color-paper)',
          dark: 'var(--color-paper-dark)',
        },
        primary: {
          light: 'var(--color-primary-light)',
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
          darker: 'var(--color-primary-darker)',
        },
      },
    },
  },
  plugins: [],
};
