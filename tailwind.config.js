/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        // Override blue colors with black shades with more contrast
        blue: {
          50: '#f5f5f5',  // Very light gray for modal backgrounds
          100: '#e0e0e0',  // Light gray for hover states
          200: '#c2c2c2',  // Medium light gray
          300: '#a3a3a3',  // Medium gray
          400: '#858585',  // Medium dark gray
          500: '#666666',  // Dark gray for buttons
          600: '#4d4d4d',  // Darker gray for button hover
          700: '#333333',  // Very dark gray
          800: '#1a1a1a',  // Almost black
          900: '#000000',  // Pure black for background
        },
        // Make sure dark backgrounds are truly black
        gray: {
          50: '#f5f5f5',   // Very light gray for modal backgrounds
          100: '#e0e0e0',   // Light gray for hover states
          200: '#c2c2c2',   // Medium light gray
          300: '#a3a3a3',   // Medium gray
          400: '#858585',   // Medium dark gray
          500: '#666666',   // Dark gray for buttons
          600: '#4d4d4d',   // Darker gray for button hover
          700: '#333333',   // Very dark gray
          800: '#1a1a1a',   // Almost black
          900: '#000000',   // Pure black for background
        },
      },
    },
  },
  plugins: [],
};
