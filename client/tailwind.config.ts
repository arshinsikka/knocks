import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current:     'currentColor',
      black:       '#000000',
      white:       '#ffffff',

      // Design-system palette — mirrors CSS variables exactly
      primary:   '#0a0a0a',   // --bg-primary
      elevated:  '#111111',   // --bg-elevated
      surface:   '#1a1a1a',   // --bg-surface
      hov:       '#222222',   // --bg-hover
      bsubtle:   '#2a2a2a',   // --border-subtle
      bmedium:   '#333333',   // --border-medium
      bbright:   '#555555',   // --border-bright
      tprimary:  '#ffffff',   // --text-primary
      tsecondary:'#b3b3b3',   // --text-secondary
      tmuted:    '#666666',   // --text-muted

      // Legacy aliases kept for landing page
      ink:    '#0a0a0a',
      paper:  '#ffffff',
      dim:    '#555555',
      subtle: '#888888',
      muted:  '#666666',
      border: '#2a2a2a',
      error:  '#999999',   // grey per spec (no colors)
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)',        'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)','monospace'],
      },
      screens: {
        xs: '360px',
      },
    },
  },
  plugins: [],
};

export default config;
