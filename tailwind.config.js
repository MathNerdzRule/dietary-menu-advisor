/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nourish: {
          50: '#f2f9f1',
          100: '#e1f1df',
          200: '#c5e5c1',
          300: '#9ed298',
          400: '#71b66b',
          500: '#4e9849',
          600: '#3c7b39',
          700: '#326230',
          800: '#2b4f2a',
          900: '#254225',
          950: '#112312',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
