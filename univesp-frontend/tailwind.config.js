export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Barlow', 'sans-serif'],
        body: ['Open Sans', 'sans-serif'],
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
