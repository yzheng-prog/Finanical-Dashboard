/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand — locked to #1E3A5F per doc 04
        brand: {
          DEFAULT: '#1E3A5F',
          light:   '#2A5080',
          dark:    '#152C4A',
        },
        // Semantic
        gain:    '#22A06B',
        loss:    '#E5484D',
        warning: '#E8B04F',
        info:    '#3B82F6',
        crypto:  '#8B5CF6',
        // Neutrals per doc 04
        surface:  '#FAFAFA',
        border:   '#E5E7EB',
        divider:  '#F3F4F6',
        subtext:  '#6B7280',
        maintext: '#1A1A1A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card:   '12px',
        button: '8px',
        input:  '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.05)',
        nav:  '2px 0 8px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};

