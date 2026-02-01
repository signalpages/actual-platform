/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{astro,js,jsx,ts,tsx}",
    "./components/**/*.{astro,js,jsx,ts,tsx}",
    "./views/**/*.{astro,js,jsx,ts,tsx}",
    "./lib/**/*.{astro,js,jsx,ts,tsx}",
    "./services/**/*.{astro,js,jsx,ts,tsx}",
    "./App.tsx",
    "./index.tsx"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
