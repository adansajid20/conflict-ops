import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        'ops-bg': 'var(--bg-base)',
        'ops-surface': 'var(--bg-surface)',
        'ops-border': 'var(--border)',
        'ops-primary': 'var(--primary)',
        'ops-muted': 'var(--text-muted)',
        'ops-text': 'var(--text-primary)',
      },
    },
  },
  plugins: [],
}

export default config
