export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Barlow', 'sans-serif'],
        body: ['Open Sans', 'sans-serif'],
      },
      borderRadius: {
        ui: 'var(--radius-md)',
        'ui-sm': 'var(--radius-sm)',
        'ui-lg': 'var(--radius-lg)',
        pill: '999px',
      },
      colors: {
        brand: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
          soft: 'var(--color-primary-soft)',
        },
        surface: {
          DEFAULT: 'var(--color-neutral-0)',
          muted: 'var(--color-neutral-50)',
          border: 'var(--border-default)',
        },
        ink: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
        },
        status: {
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          danger: 'var(--color-danger)',
          info: 'var(--color-info)',
        },
      },
      spacing: {
        'ui-1': 'var(--space-1)',
        'ui-2': 'var(--space-2)',
        'ui-3': 'var(--space-3)',
        'ui-4': 'var(--space-4)',
        'ui-5': 'var(--space-5)',
        'ui-6': 'var(--space-6)',
      },
      boxShadow: {
        float: 'var(--shadow-lg)',
        panel: 'var(--shadow-md)',
        soft: 'var(--shadow-sm)',
      },
    },
  },
  plugins: [],
}
