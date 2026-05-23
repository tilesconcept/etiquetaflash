import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7fb',
          100: '#e7ecf6',
          500: '#3b5bdb',
          600: '#3147b8',
          700: '#293c99',
          900: '#1a2766',
        },
      },
    },
  },
  plugins: [],
};

export default config;
