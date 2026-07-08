/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens — driven by CSS variables (light/dark swap in index.css)
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        heading: 'var(--heading)',
        body: 'var(--body)',
        muted: 'var(--muted)',
        link: 'var(--link)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        // Fixed accents
        accent: {
          blue: '#3B82F6',
          purple: '#8B5CF6',
          orange: '#F59E0B',
          coral: '#EF4444',
          teal: '#14B8A6',
          success: '#22C55E',
        },
        chart: {
          green: '#22C55E',
          blue: '#3B82F6',
          purple: '#8B5CF6',
          orange: '#FB923C',
          cyan: '#06B6D4',
          teal: '#14B8A6',
        },
      },
      fontFamily: {
        display: ['Archivo', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '20px',
        btn: '12px',
        input: '16px',
        badge: '999px',
      },
      boxShadow: {
        card: '0 4px 20px rgba(15,23,42,0.05)',
        'card-dark': '0 4px 20px rgba(0,0,0,0.25)',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
}
